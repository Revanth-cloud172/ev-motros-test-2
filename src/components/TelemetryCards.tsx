import React from 'react';
import {
  Activity,
  Gauge,
  Zap,
  Thermometer,
  RotateCw,
  Cpu,
  Waves,
  HeartPulse,
  Usb,
} from 'lucide-react';
import { DiagnosticThresholds, MotorTelemetry, SeverityLevel } from '../simulation/types';

interface TelemetryCardsProps {
  telemetry: MotorTelemetry;
  thresholds: DiagnosticThresholds;
}

interface MetricCardConfig {
  id: string;
  label: string;
  value: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  severity: SeverityLevel;
  subtext: string;
  nominalBand: string;
  isDerived?: boolean;
}

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({
  telemetry,
  thresholds,
}) => {
  const isHardware = telemetry.dataSource === 'HARDWARE';

  // Determine severity for each metric
  const getSpeedSeverity = (): SeverityLevel => {
    return 'NOMINAL';
  };

  const getCurrentSeverity = (): SeverityLevel => {
    if (telemetry.phaseCurrentA >= thresholds.phaseCurrentCriticalA) return 'CRITICAL';
    if (telemetry.phaseCurrentA >= thresholds.phaseCurrentWarningA) return 'WARNING';
    return 'NOMINAL';
  };

  const getVoltageSeverity = (): SeverityLevel => {
    if (telemetry.dcBusVoltageV <= thresholds.dcBusMinCriticalV) return 'CRITICAL';
    if (telemetry.dcBusVoltageV <= thresholds.dcBusMinWarningV) return 'WARNING';
    return 'NOMINAL';
  };

  const getTempSeverity = (): SeverityLevel => {
    if (telemetry.windingTempC >= thresholds.windingTempCriticalC) return 'CRITICAL';
    if (telemetry.windingTempC >= thresholds.windingTempWarningC) return 'WARNING';
    return 'NOMINAL';
  };

  const getVibrationSeverity = (): SeverityLevel => {
    if (telemetry.vibrationRms >= thresholds.vibrationCriticalMms) return 'CRITICAL';
    if (telemetry.vibrationRms >= thresholds.vibrationWarningMms) return 'WARNING';
    return 'NOMINAL';
  };

  const getHealthSeverity = (): SeverityLevel => {
    if (telemetry.healthIndex <= thresholds.healthCriticalThreshold) return 'CRITICAL';
    if (telemetry.healthIndex <= thresholds.healthWarningThreshold) return 'WARNING';
    return 'NOMINAL';
  };

  const cards: MetricCardConfig[] = [
    {
      id: 'speed',
      label: 'Motor Speed',
      value: telemetry.speedRpm.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      unit: 'RPM',
      icon: Gauge,
      severity: getSpeedSeverity(),
      subtext: isHardware ? 'STM32 Encoder / Hall Read' : `Target: ${telemetry.speedSetpointRpm} RPM`,
      nominalBand: '0 – 12,000 RPM',
    },
    {
      id: 'current',
      label: 'Phase Current RMS',
      value: telemetry.phaseCurrentA.toFixed(1),
      unit: 'A',
      icon: Zap,
      severity: getCurrentSeverity(),
      subtext: isHardware ? 'STM32 Shunt / LEM Current' : `Headroom: ${telemetry.currentHeadroomA.toFixed(0)} A`,
      nominalBand: '< 280 A (Trip: 340A)',
    },
    {
      id: 'voltage',
      label: 'DC Bus Voltage',
      value: telemetry.dcBusVoltageV.toFixed(1),
      unit: 'V',
      icon: Activity,
      severity: getVoltageSeverity(),
      subtext: isHardware ? 'STM32 HV Divider Potential' : 'Inverter Link Potential',
      nominalBand: '380 – 420 V DC',
    },
    {
      id: 'temperature',
      label: 'Winding Temperature',
      value: telemetry.windingTempC.toFixed(1),
      unit: '°C',
      icon: Thermometer,
      severity: getTempSeverity(),
      subtext: isHardware ? 'STM32 NTC / RTD Read' : `Margin: ${telemetry.thermalMarginC.toFixed(1)}°C to limit`,
      nominalBand: '< 105°C (Class H)',
    },
    {
      id: 'torque',
      label: 'Shaft Torque',
      value: telemetry.torqueNm.toFixed(1),
      unit: 'Nm',
      icon: RotateCw,
      severity: 'NOMINAL',
      subtext: isHardware && telemetry.derivedFields?.torque ? 'Calculated from Current (Kt=0.88)' : `Base: 310 Nm Peak`,
      nominalBand: '0 – 310 Nm',
      isDerived: isHardware && telemetry.derivedFields?.torque,
    },
    {
      id: 'power',
      label: 'Mechanical Power',
      value: telemetry.powerKw.toFixed(1),
      unit: 'kW',
      icon: Cpu,
      severity: 'NOMINAL',
      subtext: isHardware && telemetry.derivedFields?.power ? 'Derived: (Torque × ω) / 1000' : `Eff: ${telemetry.efficiencyPct.toFixed(1)}%`,
      nominalBand: 'Rated: 150 kW',
      isDerived: isHardware && telemetry.derivedFields?.power,
    },
    {
      id: 'vibration',
      label: 'Vibration RMS',
      value: telemetry.vibrationRms.toFixed(2),
      unit: 'mm/s',
      icon: Waves,
      severity: getVibrationSeverity(),
      subtext: telemetry.vibrationRms < 1.8 ? 'ISO Zone A (Good)' : telemetry.vibrationRms < 4.5 ? 'ISO Zone B (Acceptable)' : 'ISO Zone C/D (Degraded)',
      nominalBand: 'ISO 10816 < 4.5 mm/s',
    },
    {
      id: 'health',
      label: 'Motor Health Index',
      value: `${telemetry.healthIndex}`,
      unit: '/ 100',
      icon: HeartPulse,
      severity: getHealthSeverity(),
      subtext: isHardware && telemetry.derivedFields?.health ? 'Calculated from Multi-Stress Rules' : (telemetry.healthIndex >= 85 ? 'Optimal Condition' : 'Warning/Maintenance Required'),
      nominalBand: 'Target: > 85 pts',
      isDerived: isHardware && telemetry.derivedFields?.health,
    },
  ];

  const getBorderColor = (severity: SeverityLevel) => {
    switch (severity) {
      case 'CRITICAL':
        return 'border-rose-300 bg-rose-50/20';
      case 'WARNING':
        return 'border-amber-300 bg-amber-50/20';
      default:
        return 'border-slate-200/90 bg-white';
    }
  };

  const getBadgeStyle = (severity: SeverityLevel) => {
    switch (severity) {
      case 'CRITICAL':
        return 'text-rose-700 bg-rose-100/70 border-rose-200';
      case 'WARNING':
        return 'text-amber-700 bg-amber-100/70 border-amber-200';
      default:
        return 'text-emerald-700 bg-emerald-50 border-emerald-200/80';
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.id}
            className={`rounded-xl border p-3.5 shadow-xs transition-all flex flex-col justify-between ${getBorderColor(
              card.severity
            )}`}
          >
            {/* Top row: Label & Icon */}
            <div className="flex items-center justify-between gap-1.5 mb-1.5">
              <span className="text-xs font-medium text-slate-500 truncate" title={card.label}>
                {card.label}
              </span>
              <div className="flex items-center gap-1">
                {isHardware && (
                  <span
                    className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold border ${
                      card.isDerived
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                    title={card.isDerived ? 'Calculated value from measured inputs' : 'Direct measured hardware sensor reading'}
                  >
                    {card.isDerived ? 'CALC' : 'HW'}
                  </span>
                )}
                <div className="p-1 rounded-md bg-slate-100 text-slate-600 shrink-0">
                  <IconComponent className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Middle row: Big Value + Unit */}
            <div className="flex items-baseline gap-1.5 my-0.5">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {card.value}
              </span>
              <span className="text-xs font-semibold text-slate-500 font-mono">{card.unit}</span>
            </div>

            {/* Bottom row: Subtext & Status indicator */}
            <div className="pt-2 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px] gap-1">
              <span className="text-slate-500 truncate font-mono" title={card.subtext}>
                {card.subtext}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${getBadgeStyle(
                  card.severity
                )}`}
              >
                {card.severity === 'NOMINAL' ? 'OK' : card.severity}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
