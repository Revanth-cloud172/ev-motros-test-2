/**
 * EV Motor Digital Twin - Core Types and Interfaces
 * Model: 150 kW Interior Permanent Magnet Synchronous Motor (IPM-PMSM)
 */

export type SimulationStatus = 'RUNNING' | 'PAUSED' | 'ESTOP' | 'STOPPED';

export type DataSourceType = 'SIMULATION' | 'HARDWARE';

export type SeverityLevel = 'NOMINAL' | 'INFO' | 'WARNING' | 'CRITICAL';

export type FaultId =
  | 'none'
  | 'overheating'
  | 'overcurrent'
  | 'bearing_wear'
  | 'undervoltage'
  | 'sensor_drift'
  | 'excessive_vibration'
  | 'cooling_degraded';

export interface FaultDefinition {
  id: FaultId;
  name: string;
  category: 'THERMAL' | 'ELECTRICAL' | 'MECHANICAL' | 'SENSOR';
  description: string;
  affectedParameters: string[];
  severity: SeverityLevel;
  recommendedAction: string;
  inspectionProcedure: string;
}

export interface MotorTelemetry {
  timestamp: number;        // Epoch millis
  timeSec: number;          // Elapsed simulation/stream seconds
  speedRpm: number;         // Motor shaft speed [RPM]
  speedSetpointRpm: number; // User target speed [RPM]
  phaseCurrentA: number;    // Phase RMS current [A]
  dcBusVoltageV: number;    // Inverter DC bus link voltage [V]
  windingTempC: number;     // Stator winding thermistor measurement [°C]
  trueWindingTempC: number; // Actual physical temperature without sensor drift [°C]
  torqueNm: number;         // Mechanical shaft torque [Nm]
  powerKw: number;          // Shaft mechanical power [kW]
  vibrationRms: number;     // Accelerometer RMS vibration velocity [mm/s]
  healthIndex: number;      // Composite motor health index [0 - 100]
  thermalMarginC: number;   // Degrees until critical insulation limit [°C]
  currentHeadroomA: number; // Margin until inverter trip [A]
  efficiencyPct: number;    // Electromechanical efficiency [%]
  activeFaultId: FaultId;   // Current active fault ID
  status: SimulationStatus;
  dataSource: DataSourceType; // 'SIMULATION' or 'HARDWARE'
  derivedFields: {
    torque: boolean;        // true if torque was calculated rather than directly measured
    power: boolean;         // true if power was calculated rather than directly measured
    health: boolean;        // true if health index was calculated rather than directly measured
  };
}

export interface SimulationConfig {
  loadPct: number;              // 0 to 100%
  speedSetpointRpm: number;     // 0 to 12000 RPM
  ambientTempC: number;         // -10 to 50 °C (default 25)
  coolingEffectivenessPct: number; // 0 to 100% (default 85)
  updateRateHz: number;         // 10, 20, or 50 Hz
  regenMode: boolean;           // Regenerative braking mode
}

export interface DiagnosticThresholds {
  windingTempWarningC: number;  // Default: 105 °C
  windingTempCriticalC: number; // Default: 130 °C
  phaseCurrentWarningA: number; // Default: 280 A
  phaseCurrentCriticalA: number;// Default: 340 A
  dcBusMinWarningV: number;     // Default: 350 V
  dcBusMinCriticalV: number;    // Default: 310 V
  vibrationWarningMms: number;  // Default: 4.5 mm/s (ISO 10816 Zone C)
  vibrationCriticalMms: number; // Default: 7.1 mm/s (ISO 10816 Zone D)
  healthWarningThreshold: number; // Default: 70
  healthCriticalThreshold: number;// Default: 45
}

export interface DiagnosticAlert {
  id: string;
  timestamp: string;
  timeSec: number;
  severity: SeverityLevel;
  metric: string;
  message: string;
  value: number;
  threshold: number;
  unit: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  timeSec: number;
  type: 'SIMULATION' | 'HARDWARE' | 'FAULT' | 'SETPOINT' | 'WARNING' | 'EXPORT' | 'RESET';
  severity: SeverityLevel;
  message: string;
  details?: string;
}

export interface MotorSpecs {
  modelName: string;
  motorType: string;
  ratedPowerKw: number;
  peakTorqueNm: number;
  ratedSpeedRpm: number;
  maxSpeedRpm: number;
  nominalVoltageV: number;
  maxCurrentA: number;
  polePairs: number;
  statorSlots: number;
  insulationClass: string;
  maxWindingTempC: number;
  bearingModel: string;
  massKg: number;
}

export interface AIAnalysisResult {
  severityLevel: 'NOMINAL' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
  rootCauseAnalysis: string;
  thermalElectromagneticAssessment: string;
  mechanicalIntegrityAssessment: string;
  isoComplianceNote: string;
  recommendedActions: string[];
}

// Hardware & Serial Protocol Types
export type SerialConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'BLOCKED'
  | 'ERROR'
  | 'UNSUPPORTED';

export interface HardwarePacketStats {
  validCount: number;
  invalidCount: number;
  lastTimestamp: number | null;
  bytesReceived: number;
  isStale: boolean;
  portInfo?: string;
  error?: string;
}

export interface RawHardwarePacket {
  rpm?: number;
  current_A?: number;
  voltage_V?: number;
  temperature_C?: number;
  vibration_mm_s?: number;
  load_pct?: number;
  torque_Nm?: number;
  power_kW?: number;
  health_index?: number;
  [key: string]: any;
}
