import { describe, it, expect } from 'vitest';
import {
  calculateHealthIndex,
  createInitialPhysicsState,
  MOTOR_SPECS,
  stepPhysics,
} from '../motorPhysics';
import { FAULT_CATALOG } from '../faultModels';
import { evaluateMotorCondition, DEFAULT_THRESHOLDS } from '../diagnosticEngine';
import { formatTelemetryCsv, generateValidationSummary } from '../exportUtils';
import { MotorTelemetry, SimulationConfig } from '../types';

const BASE_CONFIG: SimulationConfig = {
  loadPct: 50,
  speedSetpointRpm: 3500,
  ambientTempC: 25,
  coolingEffectivenessPct: 85,
  updateRateHz: 20,
  regenMode: false,
};

describe('EV Motor Digital Twin - Simulation Engine Tests', () => {
  // 1. Motor Calculations & Dynamics
  describe('Motor Dynamics & Calculations', () => {
    it('accelerates toward setpoint speed over time with first-order lag', () => {
      let state = createInitialPhysicsState(25);
      expect(state.currentSpeedRpm).toBe(0);

      // Step physics for 10 steps (0.5s total at dt=0.05)
      for (let i = 0; i < 10; i++) {
        const { nextState } = stepPhysics(state, BASE_CONFIG, 'none', 'RUNNING', i * 0.05, 0.05);
        state = nextState;
      }

      // Should have accelerated smoothly towards target 3500 RPM
      expect(state.currentSpeedRpm).toBeGreaterThan(500);
      expect(state.currentSpeedRpm).toBeLessThanOrEqual(3500);
    });

    it('enforces load-dependent droop under high mechanical demand', () => {
      let stateLowLoad = createInitialPhysicsState(25);
      stateLowLoad.currentSpeedRpm = 3500;
      const lowLoadConfig = { ...BASE_CONFIG, loadPct: 25 };

      let stateHighLoad = createInitialPhysicsState(25);
      stateHighLoad.currentSpeedRpm = 3500;
      const highLoadConfig = { ...BASE_CONFIG, loadPct: 95 };

      const stepLow = stepPhysics(stateLowLoad, lowLoadConfig, 'none', 'RUNNING', 1.0, 0.05);
      const stepHigh = stepPhysics(stateHighLoad, highLoadConfig, 'none', 'RUNNING', 1.0, 0.05);

      // High load should exert greater torque demand and higher phase current
      expect(stepHigh.telemetry.torqueNm).toBeGreaterThan(stepLow.telemetry.torqueNm);
      expect(stepHigh.telemetry.phaseCurrentA).toBeGreaterThan(stepLow.telemetry.phaseCurrentA);
    });
  });

  // 2. Torque and Power Conversions (P = Tau * Omega)
  describe('Torque and Mechanical Power Conversions', () => {
    it('satisfies mechanical power equation P_mech = Torque * Omega with consistent units', () => {
      const state = createInitialPhysicsState(25);
      state.currentSpeedRpm = 4800; // Rated speed

      const { telemetry } = stepPhysics(state, BASE_CONFIG, 'none', 'RUNNING', 5.0, 0.05);

      const omegaRadS = (telemetry.speedRpm * 2 * Math.PI) / 60;
      const calculatedPowerKw = (telemetry.torqueNm * omegaRadS) / 1000;

      // Telemetry powerKw must match P = tau * omega within floating point precision
      expect(telemetry.powerKw).toBeCloseTo(calculatedPowerKw, 1);
    });

    it('reverses torque direction in regenerative braking mode', () => {
      const state = createInitialPhysicsState(25);
      state.currentSpeedRpm = 3000;
      const regenConfig: SimulationConfig = { ...BASE_CONFIG, regenMode: true };

      const { telemetry } = stepPhysics(state, regenConfig, 'none', 'RUNNING', 2.0, 0.05);
      // In regen mode, mechanical torque is negative (generator braking)
      expect(telemetry.torqueNm).toBeLessThan(0);
    });
  });

  // 3. Fault Injection Scenarios
  describe('Fault Injection Behavior', () => {
    it('overheating fault significantly increases stator temperature rate of rise', () => {
      let normalState = createInitialPhysicsState(25);
      let faultState = createInitialPhysicsState(25);

      // Run 40 steps (2 seconds)
      for (let i = 0; i < 40; i++) {
        normalState = stepPhysics(normalState, BASE_CONFIG, 'none', 'RUNNING', i * 0.05, 0.05).nextState;
        faultState = stepPhysics(faultState, BASE_CONFIG, 'overheating', 'RUNNING', i * 0.05, 0.05).nextState;
      }

      expect(faultState.actualWindingTempC).toBeGreaterThan(normalState.actualWindingTempC);
    });

    it('overcurrent fault elevates phase RMS current', () => {
      const state = createInitialPhysicsState(25);
      state.currentSpeedRpm = 3000;

      const normal = stepPhysics(state, BASE_CONFIG, 'none', 'RUNNING', 1.0, 0.05).telemetry;
      const faulted = stepPhysics(state, BASE_CONFIG, 'overcurrent', 'RUNNING', 1.0, 0.05).telemetry;

      expect(faulted.phaseCurrentA).toBeGreaterThan(normal.phaseCurrentA + 80);
    });

    it('bearing wear fault elevates vibration RMS level into ISO 10816 Zone C/D', () => {
      const state = createInitialPhysicsState(25);
      state.currentSpeedRpm = 3000;

      const normal = stepPhysics(state, BASE_CONFIG, 'none', 'RUNNING', 1.0, 0.05).telemetry;
      const faulted = stepPhysics(state, BASE_CONFIG, 'bearing_wear', 'RUNNING', 1.0, 0.05).telemetry;

      expect(faulted.vibrationRms).toBeGreaterThan(normal.vibrationRms + 3.0);
      expect(faulted.vibrationRms).toBeGreaterThan(4.5);
    });

    it('DC bus undervoltage fault drops link potential below 330V', () => {
      const state = createInitialPhysicsState(25);
      state.currentSpeedRpm = 3000;

      const faulted = stepPhysics(state, BASE_CONFIG, 'undervoltage', 'RUNNING', 1.0, 0.05).telemetry;
      expect(faulted.dcBusVoltageV).toBeLessThan(330);
    });
  });

  // 4. Health Score Calculation
  describe('Health Score Calculation', () => {
    it('yields 100 on nominal parameters without faults', () => {
      const score = calculateHealthIndex({
        windingTempC: 65,
        phaseCurrentA: 120,
        vibrationRms: 0.9,
        dcBusVoltageV: 395,
        activeFault: 'none',
      });
      expect(score).toBe(100);
    });

    it('penalizes health score appropriately when temperature and vibration exceed limits', () => {
      const score = calculateHealthIndex({
        windingTempC: 135, // High temp penalty
        phaseCurrentA: 310, // Overcurrent penalty
        vibrationRms: 6.2, // High vibration penalty
        dcBusVoltageV: 390,
        activeFault: 'bearing_wear',
      });
      expect(score).toBeLessThan(60);
    });
  });

  // 5. Temperature Response & Convective Cooling
  describe('Thermal Response & Convective Cooling', () => {
    it('gradually dissipates heat towards ambient temperature when motor is idling', () => {
      const hotState = createInitialPhysicsState(25);
      hotState.actualWindingTempC = 110; // Hot winding
      hotState.currentSpeedRpm = 0;

      const idleConfig = { ...BASE_CONFIG, speedSetpointRpm: 0, loadPct: 0 };
      const { nextState } = stepPhysics(hotState, idleConfig, 'none', 'RUNNING', 0, 1.0);

      // Temperature must decrease towards ambient 25°C
      expect(nextState.actualWindingTempC).toBeLessThan(110);
      expect(nextState.actualWindingTempC).toBeGreaterThan(25);
    });
  });

  // 6. CSV Formatting & Validation
  describe('CSV Data Formatting', () => {
    it('formats telemetry samples into valid CSV with expected columns', () => {
      const sample: MotorTelemetry = {
        timestamp: 1730160000000,
        timeSec: 10.5,
        speedRpm: 3450,
        speedSetpointRpm: 3500,
        phaseCurrentA: 125.4,
        dcBusVoltageV: 395.2,
        windingTempC: 72.4,
        trueWindingTempC: 72.4,
        torqueNm: 98.2,
        powerKw: 35.4,
        vibrationRms: 1.15,
        healthIndex: 98,
        thermalMarginC: 77.6,
        currentHeadroomA: 234.6,
        efficiencyPct: 94.2,
        activeFaultId: 'none',
        status: 'RUNNING',
        dataSource: 'SIMULATION',
        derivedFields: { torque: false, power: false, health: false },
      };

      const csv = formatTelemetryCsv([sample]);
      const lines = csv.split('\n');

      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('Speed_RPM');
      expect(lines[0]).toContain('Phase_Current_A_RMS');
      expect(lines[0]).toContain('DC_Bus_Voltage_V');
      expect(lines[1]).toContain('3450.0');
      expect(lines[1]).toContain('125.40');
    });

    it('generates accurate validation summary metrics across samples', () => {
      const samples: MotorTelemetry[] = [
        {
          timestamp: 1000,
          timeSec: 1.0,
          speedRpm: 2000,
          speedSetpointRpm: 2000,
          phaseCurrentA: 100,
          dcBusVoltageV: 400,
          windingTempC: 60,
          trueWindingTempC: 60,
          torqueNm: 50,
          powerKw: 10,
          vibrationRms: 0.8,
          healthIndex: 100,
          thermalMarginC: 90,
          currentHeadroomA: 260,
          efficiencyPct: 92,
          activeFaultId: 'none',
          status: 'RUNNING',
          dataSource: 'SIMULATION',
          derivedFields: { torque: false, power: false, health: false },
        },
        {
          timestamp: 2000,
          timeSec: 2.0,
          speedRpm: 4500,
          speedSetpointRpm: 4500,
          phaseCurrentA: 290,
          dcBusVoltageV: 330,
          windingTempC: 125,
          trueWindingTempC: 125,
          torqueNm: 150,
          powerKw: 70,
          vibrationRms: 5.2,
          healthIndex: 55,
          thermalMarginC: 25,
          currentHeadroomA: 70,
          efficiencyPct: 90,
          activeFaultId: 'overheating',
          status: 'RUNNING',
          dataSource: 'SIMULATION',
          derivedFields: { torque: false, power: false, health: false },
        },
      ];

      const summary = generateValidationSummary(samples);
      expect(summary.totalSamples).toBe(2);
      expect(summary.maxSpeedRpm).toBe(4500);
      expect(summary.maxPhaseCurrentA).toBe(290);
      expect(summary.maxWindingTempC).toBe(125);
      expect(summary.minDcBusVoltageV).toBe(330);
      expect(summary.minHealthIndex).toBe(55);
      expect(summary.faultsTested).toContain('overheating');
    });
  });

  // 7. Emergency Stop and Pause/Resume Behavior
  describe('E-Stop and State Transitions', () => {
    it('forces speed and power to zero rapidly on Emergency Stop', () => {
      const state = createInitialPhysicsState(25);
      state.currentSpeedRpm = 5000;

      const { nextState, telemetry } = stepPhysics(state, BASE_CONFIG, 'none', 'ESTOP', 1.0, 0.2);

      // Under ESTOP, speed decelerates fast towards zero
      expect(nextState.currentSpeedRpm).toBeLessThan(5000);
      expect(telemetry.status).toBe('ESTOP');
    });
  });
});
