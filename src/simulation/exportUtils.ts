/**
 * EV Motor Digital Twin - Data Export & Validation Utilities
 * Generates verified CSV logs from actual simulation & hardware samples and provides review summaries.
 */

import { LogEntry, MotorTelemetry } from './types';

export function formatTelemetryCsv(samples: MotorTelemetry[]): string {
  const headers = [
    'Timestamp_ISO',
    'Elapsed_Sec',
    'Data_Source',
    'Speed_RPM',
    'Target_RPM',
    'Phase_Current_A_RMS',
    'DC_Bus_Voltage_V',
    'Winding_Temp_C',
    'True_Winding_Temp_C',
    'Torque_Nm',
    'Torque_Derived',
    'Mechanical_Power_kW',
    'Power_Derived',
    'Vibration_RMS_mms',
    'Health_Index',
    'Health_Derived',
    'Thermal_Margin_C',
    'Current_Headroom_A',
    'Efficiency_Pct',
    'Active_Fault_ID',
    'Simulation_Status',
  ];

  const rows = samples.map((s) => [
    new Date(s.timestamp).toISOString(),
    s.timeSec.toFixed(2),
    s.dataSource || 'SIMULATION',
    s.speedRpm.toFixed(1),
    s.speedSetpointRpm,
    s.phaseCurrentA.toFixed(2),
    s.dcBusVoltageV.toFixed(1),
    s.windingTempC.toFixed(1),
    s.trueWindingTempC.toFixed(1),
    s.torqueNm.toFixed(1),
    s.derivedFields?.torque ? 'YES (Calc)' : 'NO (Direct)',
    s.powerKw.toFixed(2),
    s.derivedFields?.power ? 'YES (Calc)' : 'NO (Direct)',
    s.vibrationRms.toFixed(2),
    s.healthIndex,
    s.derivedFields?.health ? 'YES (Calc)' : 'NO (Direct)',
    s.thermalMarginC.toFixed(1),
    s.currentHeadroomA.toFixed(1),
    s.efficiencyPct.toFixed(1),
    s.activeFaultId,
    s.status,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function formatEventLogCsv(logs: LogEntry[]): string {
  const headers = ['Timestamp', 'Elapsed_Sec', 'Type', 'Severity', 'Message', 'Details'];
  const rows = logs.map((l) => [
    l.timestamp,
    l.timeSec.toFixed(2),
    l.type,
    l.severity,
    `"${l.message.replace(/"/g, '""')}"`,
    l.details ? `"${l.details.replace(/"/g, '""')}"` : '""',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function triggerDownload(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ValidationSummaryData {
  totalSamples: number;
  totalTimeSec: number;
  samplesFromHardware: number;
  samplesFromSimulation: number;
  maxSpeedRpm: number;
  maxPhaseCurrentA: number;
  maxWindingTempC: number;
  minDcBusVoltageV: number;
  maxVibrationRms: number;
  minHealthIndex: number;
  maxPowerKw: number;
  faultsTested: string[];
}

export function generateValidationSummary(samples: MotorTelemetry[]): ValidationSummaryData {
  if (samples.length === 0) {
    return {
      totalSamples: 0,
      totalTimeSec: 0,
      samplesFromHardware: 0,
      samplesFromSimulation: 0,
      maxSpeedRpm: 0,
      maxPhaseCurrentA: 0,
      maxWindingTempC: 0,
      minDcBusVoltageV: 0,
      maxVibrationRms: 0,
      minHealthIndex: 100,
      maxPowerKw: 0,
      faultsTested: [],
    };
  }

  const faultsSet = new Set<string>();
  let maxSpeed = 0;
  let maxCurrent = 0;
  let maxTemp = -Infinity;
  let minVoltage = Infinity;
  let maxVib = 0;
  let minHealth = 100;
  let maxPower = 0;
  let hwCount = 0;
  let simCount = 0;

  for (const s of samples) {
    if (s.dataSource === 'HARDWARE') {
      hwCount++;
    } else {
      simCount++;
    }

    if (s.speedRpm > maxSpeed) maxSpeed = s.speedRpm;
    if (s.phaseCurrentA > maxCurrent) maxCurrent = s.phaseCurrentA;
    if (s.windingTempC > maxTemp) maxTemp = s.windingTempC;
    if (s.dcBusVoltageV < minVoltage) minVoltage = s.dcBusVoltageV;
    if (s.vibrationRms > maxVib) maxVib = s.vibrationRms;
    if (s.healthIndex < minHealth) minHealth = s.healthIndex;
    if (s.powerKw > maxPower) maxPower = s.powerKw;
    if (s.activeFaultId !== 'none') faultsSet.add(s.activeFaultId);
  }

  const last = samples[samples.length - 1];

  return {
    totalSamples: samples.length,
    totalTimeSec: last.timeSec,
    samplesFromHardware: hwCount,
    samplesFromSimulation: simCount,
    maxSpeedRpm: maxSpeed,
    maxPhaseCurrentA: maxCurrent,
    maxWindingTempC: maxTemp === -Infinity ? 0 : maxTemp,
    minDcBusVoltageV: minVoltage === Infinity ? 0 : minVoltage,
    maxVibrationRms: maxVib,
    minHealthIndex: minHealth,
    maxPowerKw: maxPower,
    faultsTested: Array.from(faultsSet),
  };
}
