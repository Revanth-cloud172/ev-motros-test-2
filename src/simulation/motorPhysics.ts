/**
 * EV Motor Digital Twin - Motor Physics & Electromechanical Calculations
 * 
 * Physical Model:
 * 150 kW Permanent Magnet Synchronous Motor (PMSM) for EV Traction
 * Fixed-step physics equations for deterministic, reproducible simulation
 */

import { FaultId, MotorSpecs, MotorTelemetry, SimulationConfig, SimulationStatus } from './types';

export const MOTOR_SPECS: MotorSpecs = {
  modelName: 'PMSM-150-TX',
  motorType: 'Interior Permanent Magnet Synchronous (IPM)',
  ratedPowerKw: 150,
  peakTorqueNm: 310,
  ratedSpeedRpm: 4800,
  maxSpeedRpm: 12000,
  nominalVoltageV: 400,
  maxCurrentA: 360,
  polePairs: 4,
  statorSlots: 48,
  insulationClass: 'Class H (180°C max)',
  maxWindingTempC: 150,
  bearingModel: 'SKF 6208-2RZ Deep Groove Ball Bearings',
  massKg: 52.4,
};

// Physical Constants
const R_STATOR_25C = 0.028; // Stator phase resistance at 25°C [Ohms]
const ALPHA_COPPER = 0.00393; // Copper temperature coefficient [1/°C]
const C_THERMAL = 2800; // Thermal heat capacity of stator core [J/°C]
const R_THERMAL_NOMINAL = 0.052; // Nominal thermal resistance to ambient [°C/W]
const TORQUE_CONSTANT_KT = 0.88; // Torque constant [Nm/A_rms]
const IDLE_CURRENT_RMS = 12.0; // Idle inverter & magnetizing current [A]
const INVERTER_BASE_EFF = 0.965; // Nominal inverter power stage efficiency

export interface PhysicsInternalState {
  currentSpeedRpm: number;
  actualWindingTempC: number;
  sensorOffsetC: number;
  bearingDegradationLevel: number;
  vibrationHistory: number[];
}

export function createInitialPhysicsState(ambientTempC = 25): PhysicsInternalState {
  return {
    currentSpeedRpm: 0,
    actualWindingTempC: ambientTempC + 2.0,
    sensorOffsetC: 0,
    bearingDegradationLevel: 0,
    vibrationHistory: [],
  };
}

/**
 * Perform one discrete physics update step with fixed dt
 * @param state Previous physical state
 * @param config User simulation controls
 * @param activeFault Currently injected fault
 * @param status Simulation running status
 * @param timeSec Total elapsed simulation seconds
 * @param dt Time step in seconds (e.g. 0.05s for 20Hz)
 */
export function stepPhysics(
  state: PhysicsInternalState,
  config: SimulationConfig,
  activeFault: FaultId,
  status: SimulationStatus,
  timeSec: number,
  dt: number
): { nextState: PhysicsInternalState; telemetry: MotorTelemetry } {
  // If Emergency Stop or Stopped, set target to 0 immediately
  const effectiveTargetRpm = status === 'ESTOP' || status === 'STOPPED' 
    ? 0 
    : config.speedSetpointRpm;

  // 1. ROTATIONAL DYNAMICS (Speed Response)
  // First-order acceleration lag with load-dependent droop
  const accelTimeConstant = status === 'ESTOP' ? 0.35 : 0.85; // Faster decel on E-stop
  const speedError = effectiveTargetRpm - state.currentSpeedRpm;
  
  // High load creates a small natural speed droop (~1.5% at 95% load)
  const loadDroopRpm = (config.loadPct / 100) * 0.018 * state.currentSpeedRpm;
  const speedChange = (speedError / accelTimeConstant) * dt;
  let nextSpeedRpm = Math.max(0, Math.min(MOTOR_SPECS.maxSpeedRpm, state.currentSpeedRpm + speedChange - (loadDroopRpm * dt * 0.5)));
  if (nextSpeedRpm < 1.0 && effectiveTargetRpm === 0) nextSpeedRpm = 0;

  // Small realistic rotational jitter (±2 RPM)
  const speedJitter = nextSpeedRpm > 10 ? (Math.sin(timeSec * 32.0) * 1.5 + Math.cos(timeSec * 71.0) * 1.2) : 0;
  const measuredSpeedRpm = Math.max(0, nextSpeedRpm + speedJitter);

  // 2. TORQUE CALCULATION (Nm)
  // Base demand proportional to load percentage
  let loadFraction = config.loadPct / 100;
  if (config.regenMode) loadFraction = -0.45 * (config.loadPct / 100);

  // Above rated speed (4800 RPM), PMSM enters constant power / field-weakening region:
  // Torque capacity drops inversely with speed: T_avail = T_rated * (N_rated / N)
  const speedRatio = Math.max(1.0, nextSpeedRpm / MOTOR_SPECS.ratedSpeedRpm);
  const maxAvailableTorque = MOTOR_SPECS.peakTorqueNm / speedRatio;
  
  let targetTorqueNm = loadFraction * maxAvailableTorque;

  // Bearing wear fault introduces parasitic drag friction torque (+8 to 12 Nm)
  if (activeFault === 'bearing_wear') {
    targetTorqueNm += 9.5;
  }

  // Aerodynamic and bearing friction drag: T_drag = b * omega
  const omegaRadS = (nextSpeedRpm * 2 * Math.PI) / 60;
  const frictionTorque = 0.0035 * omegaRadS;
  const netTorqueNm = nextSpeedRpm > 0 ? targetTorqueNm + frictionTorque : 0;

  // 3. MECHANICAL POWER (kW)
  // P_mech = Torque [Nm] * Omega [rad/s] / 1000 [W -> kW]
  const powerKw = (netTorqueNm * omegaRadS) / 1000;

  // 4. ELECTRICAL PHASE CURRENT (A RMS)
  // Quadrature torque current: Iq = Torque / Kt
  // Add no-load magnetizing current and field-weakening d-axis current component
  let iq = Math.abs(netTorqueNm) / TORQUE_CONSTANT_KT;
  let id = 0;
  if (nextSpeedRpm > MOTOR_SPECS.ratedSpeedRpm) {
    // Field-weakening demagnetizing current
    id = 45.0 * ((nextSpeedRpm - MOTOR_SPECS.ratedSpeedRpm) / (MOTOR_SPECS.maxSpeedRpm - MOTOR_SPECS.ratedSpeedRpm));
  }
  let baseCurrentA = Math.sqrt(Math.pow(iq, 2) + Math.pow(id, 2)) + (nextSpeedRpm > 0 ? IDLE_CURRENT_RMS : 0);

  // Overcurrent Fault Injection: Phase short / driver fault adds large surge (+110A)
  if (activeFault === 'overcurrent') {
    baseCurrentA += 115.0 + Math.sin(timeSec * 45) * 12.0;
  }

  // Current ripple from 3-phase inverter PWM switching
  const currentRipple = nextSpeedRpm > 0 ? (Math.sin(timeSec * 120.0) * 1.8 + Math.cos(timeSec * 85.0) * 1.1) : 0;
  const phaseCurrentA = Math.max(0, baseCurrentA + currentRipple);

  // 5. DC BUS VOLTAGE (V)
  // Nominal 400V with high-voltage battery internal resistance sag (delta_V = P_elec * R_internal)
  let baseDcVoltageV = MOTOR_SPECS.nominalVoltageV - (Math.max(0, powerKw) * 0.12);
  
  // Undervoltage Fault: Battery pack/contactor degradation drops bus to 305V
  if (activeFault === 'undervoltage') {
    baseDcVoltageV = 308.0 + Math.sin(timeSec * 8.0) * 6.5;
  }

  // Inverter DC bus switching ripple
  const busVoltageRipple = Math.sin(timeSec * 60.0) * 1.2;
  const dcBusVoltageV = Math.max(100, baseDcVoltageV + busVoltageRipple);

  // 6. THERMAL RESPONSE (Lumped Parameter Heat Transfer Model)
  // Copper losses: P_cu = 3 * I_phase^2 * R_s(T)
  const currentResistance = R_STATOR_25C * (1 + ALPHA_COPPER * (state.actualWindingTempC - 25));
  const copperLossW = 3 * Math.pow(phaseCurrentA, 2) * currentResistance;

  // Stator core eddy current and hysteresis iron losses: P_fe ~ k_h * f + k_e * f^2
  const electricalFreqHz = (MOTOR_SPECS.polePairs * nextSpeedRpm) / 60;
  const ironLossW = (1.2 * electricalFreqHz) + (0.008 * Math.pow(electricalFreqHz, 2));

  // Additional fault heat sources
  let faultHeatW = 0;
  if (activeFault === 'overheating') {
    // Thermal breakdown fault adds continuous 3800 W internal dissipation
    faultHeatW += 4200;
  }

  const totalHeatGeneratedW = copperLossW + ironLossW + faultHeatW;

  // Heat Dissipation to Ambient via Liquid Cooling Jacket
  // R_th = R_th_nominal / (coolingEffectiveness / 100)
  let effectiveCoolingPct = config.coolingEffectivenessPct;
  if (activeFault === 'cooling_degraded') {
    effectiveCoolingPct *= 0.28; // 72% cooling capacity loss
  }
  const coolingFactor = Math.max(0.08, effectiveCoolingPct / 100);
  const effectiveThermalResistance = R_THERMAL_NOMINAL / coolingFactor;

  const heatDissipatedW = (state.actualWindingTempC - config.ambientTempC) / effectiveThermalResistance;
  
  // dT/dt = (Q_in - Q_out) / C_th
  const deltaTempC = ((totalHeatGeneratedW - heatDissipatedW) / C_THERMAL) * dt;
  let nextActualWindingTempC = state.actualWindingTempC + deltaTempC;

  // Bound actual physical temperature realistically
  nextActualWindingTempC = Math.max(config.ambientTempC, Math.min(185.0, nextActualWindingTempC));

  // SENSOR MEASUREMENT & SENSOR DRIFT FAULT
  let sensorOffset = 0;
  if (activeFault === 'sensor_drift') {
    // Artificial 32°C offset with high noise
    sensorOffset = 32.5 + Math.sin(timeSec * 4.2) * 2.8 + (Math.random() - 0.5) * 1.5;
  }
  const reportedWindingTempC = nextActualWindingTempC + sensorOffset;

  // 7. VIBRATION MODEL (mm/s RMS Velocity - ISO 10816 standards)
  // Baseline vibration grows quadratically with speed from mechanical residual unbalance
  const speedNormalized = nextSpeedRpm / MOTOR_SPECS.maxSpeedRpm;
  let baseVibrationMms = 0.55 + 0.95 * Math.pow(speedNormalized, 2);

  // Bearing wear fault: high frequency impacts and bearing raceway spalling
  if (activeFault === 'bearing_wear') {
    baseVibrationMms += 5.2 + Math.sin(timeSec * 88.0) * 0.6 + (Math.random() - 0.5) * 0.4;
  }

  // Excessive vibration fault: severe dynamic unbalance / bent shaft
  if (activeFault === 'excessive_vibration') {
    baseVibrationMms += 7.1 + Math.sin(timeSec * (nextSpeedRpm / 60) * 2 * Math.PI) * 1.2 + (Math.random() - 0.5) * 1.4;
  }

  // Add slight natural measurement noise
  const vibrationNoise = nextSpeedRpm > 0 ? (Math.random() - 0.5) * 0.15 : 0;
  const vibrationRms = Math.max(0.1, Number((baseVibrationMms + vibrationNoise).toFixed(2)));

  // 8. MOTOR HEALTH INDEX (0 - 100 Scale)
  // Calculated via deterministic multi-stress penalty model
  const healthIndex = calculateHealthIndex({
    windingTempC: nextActualWindingTempC, // True health depends on true physical physics
    phaseCurrentA,
    vibrationRms,
    dcBusVoltageV,
    activeFault,
  });

  // 9. EFFICIENCY (%)
  const totalElectricalInputW = Math.max(0, powerKw * 1000) + totalHeatGeneratedW;
  const efficiencyPct = powerKw > 0.5 && totalElectricalInputW > 0 
    ? Math.min(97.2, Math.max(40.0, ((powerKw * 1000) / totalElectricalInputW) * 100 * INVERTER_BASE_EFF))
    : 0;

  // Margins
  const thermalMarginC = Math.max(0, MOTOR_SPECS.maxWindingTempC - reportedWindingTempC);
  const currentHeadroomA = Math.max(0, MOTOR_SPECS.maxCurrentA - phaseCurrentA);

  const nextState: PhysicsInternalState = {
    currentSpeedRpm: nextSpeedRpm,
    actualWindingTempC: nextActualWindingTempC,
    sensorOffsetC: sensorOffset,
    bearingDegradationLevel: activeFault === 'bearing_wear' ? state.bearingDegradationLevel + 0.05 * dt : state.bearingDegradationLevel,
    vibrationHistory: [...state.vibrationHistory.slice(-20), vibrationRms],
  };

  const telemetry: MotorTelemetry = {
    timestamp: Date.now(),
    timeSec: Number(timeSec.toFixed(2)),
    speedRpm: Number(measuredSpeedRpm.toFixed(1)),
    speedSetpointRpm: config.speedSetpointRpm,
    phaseCurrentA: Number(phaseCurrentA.toFixed(2)),
    dcBusVoltageV: Number(dcBusVoltageV.toFixed(1)),
    windingTempC: Number(reportedWindingTempC.toFixed(1)),
    trueWindingTempC: Number(nextActualWindingTempC.toFixed(1)),
    torqueNm: Number(netTorqueNm.toFixed(1)),
    powerKw: Number(powerKw.toFixed(2)),
    vibrationRms,
    healthIndex: Math.round(healthIndex),
    thermalMarginC: Number(thermalMarginC.toFixed(1)),
    currentHeadroomA: Number(currentHeadroomA.toFixed(1)),
    efficiencyPct: Number(efficiencyPct.toFixed(1)),
    activeFaultId: activeFault,
    status,
    dataSource: 'SIMULATION',
    derivedFields: {
      torque: false,
      power: false,
      health: false,
    },
  };

  return { nextState, telemetry };
}

/**
 * Deterministic Health Index Calculation (0 to 100)
 */
export function calculateHealthIndex(params: {
  windingTempC: number;
  phaseCurrentA: number;
  vibrationRms: number;
  dcBusVoltageV: number;
  activeFault: FaultId;
}): number {
  let score = 100;

  // 1. Thermal Penalty
  if (params.windingTempC > 105) {
    const tempOver = params.windingTempC - 105;
    score -= Math.min(45, tempOver * 1.5);
  }

  // 2. Current Penalty
  if (params.phaseCurrentA > 280) {
    const currentOver = params.phaseCurrentA - 280;
    score -= Math.min(30, currentOver * 0.45);
  }

  // 3. Vibration Penalty (ISO 10816 Zone C & D)
  if (params.vibrationRms > 4.5) {
    const vibOver = params.vibrationRms - 4.5;
    score -= Math.min(35, vibOver * 8.0);
  }

  // 4. Undervoltage Penalty
  if (params.dcBusVoltageV < 340) {
    const voltUnder = 340 - params.dcBusVoltageV;
    score -= Math.min(25, voltUnder * 0.35);
  }

  // 5. Active Fault baseline stress
  if (params.activeFault === 'bearing_wear') score -= 18;
  if (params.activeFault === 'cooling_degraded') score -= 12;
  if (params.activeFault === 'sensor_drift') score -= 10;

  return Math.max(5, Math.min(100, Math.round(score)));
}
