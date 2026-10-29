/**
 * EV Motor Digital Twin - Rule-Based Diagnostic Engine
 * Transparent, deterministic condition monitoring according to industrial standards:
 * - ISO 10816-3: Mechanical vibration of industrial machines
 * - IEC 60034-1: Rating and performance of rotating electrical machines (Insulation Class H)
 * - ISO 26262: Functional safety for road vehicles
 */

import { DiagnosticAlert, DiagnosticThresholds, FaultId, MotorTelemetry, SeverityLevel } from './types';

export const DEFAULT_THRESHOLDS: DiagnosticThresholds = {
  windingTempWarningC: 105,
  windingTempCriticalC: 130,
  phaseCurrentWarningA: 280,
  phaseCurrentCriticalA: 340,
  dcBusMinWarningV: 350,
  dcBusMinCriticalV: 310,
  vibrationWarningMms: 4.5,
  vibrationCriticalMms: 7.1,
  healthWarningThreshold: 70,
  healthCriticalThreshold: 45,
};

export interface ConditionEvaluation {
  overallSeverity: SeverityLevel;
  activeAlerts: DiagnosticAlert[];
  thermalStatus: 'OPTIMAL' | 'ELEVATED' | 'CRITICAL';
  electricalStatus: 'BALANCED' | 'NEAR_LIMIT' | 'OVERLOAD';
  vibrationZone: 'ZONE_A' | 'ZONE_B' | 'ZONE_C' | 'ZONE_D';
  voltageStatus: 'NOMINAL' | 'SAG_WARNING' | 'CRITICAL_UNDERVOLT';
  sensorConfidencePct: number;
  maintenanceRecommendations: string[];
}

export function evaluateMotorCondition(
  telemetry: MotorTelemetry,
  thresholds: DiagnosticThresholds = DEFAULT_THRESHOLDS
): ConditionEvaluation {
  const alerts: DiagnosticAlert[] = [];
  const recommendations: string[] = [];
  let worstSeverity: SeverityLevel = 'NOMINAL';

  const addAlert = (
    severity: SeverityLevel,
    metric: string,
    message: string,
    value: number,
    threshold: number,
    unit: string
  ) => {
    alerts.push({
      id: `${metric}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      timeSec: telemetry.timeSec,
      severity,
      metric,
      message,
      value,
      threshold,
      unit,
    });
    if (severity === 'CRITICAL') {
      worstSeverity = 'CRITICAL';
    } else if (severity === 'WARNING' && worstSeverity !== 'CRITICAL') {
      worstSeverity = 'WARNING';
    } else if (severity === 'INFO' && worstSeverity === 'NOMINAL') {
      worstSeverity = 'INFO';
    }
  };

  // 1. THERMAL EVALUATION
  let thermalStatus: 'OPTIMAL' | 'ELEVATED' | 'CRITICAL' = 'OPTIMAL';
  if (telemetry.windingTempC >= thresholds.windingTempCriticalC) {
    thermalStatus = 'CRITICAL';
    addAlert(
      'CRITICAL',
      'Winding Temperature',
      `Stator temperature (${telemetry.windingTempC}°C) exceeds critical insulation threshold (${thresholds.windingTempCriticalC}°C). High dielectric breakdown hazard.`,
      telemetry.windingTempC,
      thresholds.windingTempCriticalC,
      '°C'
    );
    recommendations.push('Immediate motor torque derating to 0 Nm. Keep coolant circulation active to prevent thermal hot-spot soak.');
  } else if (telemetry.windingTempC >= thresholds.windingTempWarningC) {
    thermalStatus = 'ELEVATED';
    addAlert(
      'WARNING',
      'Winding Temperature',
      `Stator temperature elevated at ${telemetry.windingTempC}°C (Warning threshold: ${thresholds.windingTempWarningC}°C).`,
      telemetry.windingTempC,
      thresholds.windingTempWarningC,
      '°C'
    );
    recommendations.push('Inspect cooling radiator airflow and increase cooling pump PWM duty cycle.');
  }

  // 2. ELECTRICAL CURRENT EVALUATION
  let electricalStatus: 'BALANCED' | 'NEAR_LIMIT' | 'OVERLOAD' = 'BALANCED';
  if (telemetry.phaseCurrentA >= thresholds.phaseCurrentCriticalA) {
    electricalStatus = 'OVERLOAD';
    addAlert(
      'CRITICAL',
      'Phase Current',
      `RMS Phase current (${telemetry.phaseCurrentA} A) exceeds inverter safe operating area (${thresholds.phaseCurrentCriticalA} A).`,
      telemetry.phaseCurrentA,
      thresholds.phaseCurrentCriticalA,
      'A'
    );
    recommendations.push('Inverter gate driver overcurrent trip imminent. Verify stator winding phase-to-phase insulation.');
  } else if (telemetry.phaseCurrentA >= thresholds.phaseCurrentWarningA) {
    electricalStatus = 'NEAR_LIMIT';
    addAlert(
      'WARNING',
      'Phase Current',
      `Continuous phase current near limit at ${telemetry.phaseCurrentA} A (Threshold: ${thresholds.phaseCurrentWarningA} A).`,
      telemetry.phaseCurrentA,
      thresholds.phaseCurrentWarningA,
      'A'
    );
    recommendations.push('Limit transient vehicle acceleration rate to avoid thermal accumulation in inverter silicon.');
  }

  // 3. DC BUS VOLTAGE EVALUATION
  let voltageStatus: 'NOMINAL' | 'SAG_WARNING' | 'CRITICAL_UNDERVOLT' = 'NOMINAL';
  if (telemetry.dcBusVoltageV <= thresholds.dcBusMinCriticalV) {
    voltageStatus = 'CRITICAL_UNDERVOLT';
    addAlert(
      'CRITICAL',
      'DC Bus Voltage',
      `DC Bus link voltage dropped to ${telemetry.dcBusVoltageV} V (Critical trip: ${thresholds.dcBusMinCriticalV} V).`,
      telemetry.dcBusVoltageV,
      thresholds.dcBusMinCriticalV,
      'V'
    );
    recommendations.push('Check traction battery pack SoC, main high-voltage contactor resistance, and DC fuse integrity.');
  } else if (telemetry.dcBusVoltageV <= thresholds.dcBusMinWarningV) {
    voltageStatus = 'SAG_WARNING';
    addAlert(
      'WARNING',
      'DC Bus Voltage',
      `DC link voltage sag observed (${telemetry.dcBusVoltageV} V). Under-voltage margin degraded.`,
      telemetry.dcBusVoltageV,
      thresholds.dcBusMinWarningV,
      'V'
    );
  }

  // 4. VIBRATION EVALUATION (ISO 10816-3 Severity Standards)
  let vibrationZone: 'ZONE_A' | 'ZONE_B' | 'ZONE_C' | 'ZONE_D' = 'ZONE_A';
  if (telemetry.vibrationRms >= thresholds.vibrationCriticalMms) {
    vibrationZone = 'ZONE_D';
    addAlert(
      'CRITICAL',
      'Vibration RMS',
      `Vibration level (${telemetry.vibrationRms} mm/s) in ISO 10816 Zone D (Dangerous/Permissible Damage).`,
      telemetry.vibrationRms,
      thresholds.vibrationCriticalMms,
      'mm/s'
    );
    recommendations.push('Risk of mechanical stator rub or catastrophic bearing seizure. Cease high-speed rotation.');
  } else if (telemetry.vibrationRms >= thresholds.vibrationWarningMms) {
    vibrationZone = 'ZONE_C';
    addAlert(
      'WARNING',
      'Vibration RMS',
      `Vibration level (${telemetry.vibrationRms} mm/s) in ISO 10816 Zone C (Restricted Long-term Operation).`,
      telemetry.vibrationRms,
      thresholds.vibrationWarningMms,
      'mm/s'
    );
    recommendations.push('Perform bearing envelope demodulation (high-frequency impact) and dynamic unbalance balancing.');
  } else if (telemetry.vibrationRms >= 1.8) {
    vibrationZone = 'ZONE_B';
  } else {
    vibrationZone = 'ZONE_A';
  }

  // 5. SENSOR CONFIDENCE ASSESSMENT
  // In a real digital twin, physical model state is compared with sensor telemetry
  // If reported temp deviates sharply from model or current without physical heat dissipation reason:
  const sensorDelta = Math.abs(telemetry.windingTempC - telemetry.trueWindingTempC);
  let sensorConfidencePct = 100;
  if (sensorDelta > 5.0) {
    sensorConfidencePct = Math.max(15, Math.round(100 - (sensorDelta * 2.8)));
    addAlert(
      'WARNING',
      'Sensor Telemetry',
      `Temperature sensor anomaly detected: measurement deviates by ${sensorDelta.toFixed(1)}°C from physics observer model.`,
      sensorDelta,
      5.0,
      '°C'
    );
    recommendations.push('Calibrate NTC thermistor sensor wiring and inspect grounding shielding.');
  }

  // 6. HEALTH SCORE ALERTS
  if (telemetry.healthIndex <= thresholds.healthCriticalThreshold) {
    addAlert(
      'CRITICAL',
      'Motor Health Index',
      `Overall motor health index critical at ${telemetry.healthIndex}/100. Multi-subsystem degradation.`,
      telemetry.healthIndex,
      thresholds.healthCriticalThreshold,
      'pts'
    );
  } else if (telemetry.healthIndex <= thresholds.healthWarningThreshold) {
    addAlert(
      'WARNING',
      'Motor Health Index',
      `Motor health index degraded to ${telemetry.healthIndex}/100.`,
      telemetry.healthIndex,
      thresholds.healthWarningThreshold,
      'pts'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('All parameters within nominal design limits. No maintenance intervention required.');
  }

  return {
    overallSeverity: worstSeverity,
    activeAlerts: alerts,
    thermalStatus,
    electricalStatus,
    vibrationZone,
    voltageStatus,
    sensorConfidencePct,
    maintenanceRecommendations: recommendations,
  };
}
