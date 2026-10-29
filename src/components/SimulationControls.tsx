import React from 'react';
import { Sliders, RotateCw, Wind, Gauge, Activity, BatteryCharging } from 'lucide-react';
import { SimulationConfig } from '../simulation/types';

interface SimulationControlsProps {
  config: SimulationConfig;
  onSetLoad: (loadPct: number) => void;
  onSetSpeedSetpoint: (rpm: number) => void;
  onSetAmbientTemp: (tempC: number) => void;
  onSetCoolingEffectiveness: (pct: number) => void;
  onSetUpdateRate: (hz: number) => void;
  onToggleRegen: () => void;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  config,
  onSetLoad,
  onSetSpeedSetpoint,
  onSetAmbientTemp,
  onSetCoolingEffectiveness,
  onSetUpdateRate,
  onToggleRegen,
}) => {
  const loadPresets = [25, 50, 75, 95];
  const speedPresets = [
    { label: 'Idle (1k)', rpm: 1000 },
    { label: 'Urban (3.5k)', rpm: 3500 },
    { label: 'Highway (7k)', rpm: 7000 },
    { label: 'Max (12k)', rpm: 12000 },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-800">
            Powertrain Simulation Controls
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Physically Coupled Equations
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. MOTOR LOAD TORQUE SETTING */}
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-slate-500" />
              Mechanical Load Demand
            </label>
            <span className="text-xs font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {config.loadPct}%
            </span>
          </div>

          {/* Preset Buttons required by prompt: 25%, 50%, 75%, 95% */}
          <div className="grid grid-cols-4 gap-1">
            {loadPresets.map((pct) => (
              <button
                key={pct}
                onClick={() => onSetLoad(pct)}
                className={`py-1 rounded text-xs font-medium font-mono transition-all border ${
                  config.loadPct === pct
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Smooth slider */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={config.loadPct}
            onChange={(e) => onSetLoad(Number(e.target.value))}
            className="w-full accent-slate-800 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />

          {/* Regenerative Braking Switch */}
          <div className="flex items-center justify-between pt-1 mt-1 border-t border-slate-200/60">
            <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" />
              Regenerative Braking
            </span>
            <button
              onClick={onToggleRegen}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all ${
                config.regenMode
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {config.regenMode ? 'ACTIVE (Gen)' : 'OFF (Drive)'}
            </button>
          </div>
        </div>

        {/* 2. SPEED SETPOINT */}
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-slate-500" />
              Speed Setpoint
            </label>
            <span className="text-xs font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {config.speedSetpointRpm} RPM
            </span>
          </div>

          {/* Speed Presets */}
          <div className="grid grid-cols-2 gap-1">
            {speedPresets.map((item) => (
              <button
                key={item.rpm}
                onClick={() => onSetSpeedSetpoint(item.rpm)}
                className={`py-1 px-1.5 rounded text-[11px] font-medium transition-all border truncate ${
                  config.speedSetpointRpm === item.rpm
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Speed Slider */}
          <input
            type="range"
            min={0}
            max={12000}
            step={100}
            value={config.speedSetpointRpm}
            onChange={(e) => onSetSpeedSetpoint(Number(e.target.value))}
            className="w-full accent-slate-800 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>0 RPM</span>
            <span>4,800 (Base)</span>
            <span>12,000 RPM</span>
          </div>
        </div>

        {/* 3. THERMAL & COOLING ENVIRONMENT */}
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-slate-500" />
              Thermal & Cooling Loop
            </label>
            <span className="text-xs font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {config.ambientTempC}°C | {config.coolingEffectivenessPct}%
            </span>
          </div>

          {/* Ambient Temp Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Ambient Temp:</span>
              <span className="font-mono font-semibold">{config.ambientTempC}°C</span>
            </div>
            <input
              type="range"
              min={-10}
              max={50}
              step={1}
              value={config.ambientTempC}
              onChange={(e) => onSetAmbientTemp(Number(e.target.value))}
              className="w-full accent-slate-800 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
          </div>

          {/* Cooling Effectiveness Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Cooling Effectiveness:</span>
              <span className="font-mono font-semibold">{config.coolingEffectivenessPct}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={config.coolingEffectivenessPct}
              onChange={(e) => onSetCoolingEffectiveness(Number(e.target.value))}
              className="w-full accent-slate-800 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
          </div>

          {/* Simulation Update Rate */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
            <span className="text-slate-600 flex items-center gap-1 font-medium">
              <Activity className="w-3 h-3 text-slate-400" />
              Update Rate:
            </span>
            <div className="flex gap-1">
              {[10, 20, 50].map((hz) => (
                <button
                  key={hz}
                  onClick={() => onSetUpdateRate(hz)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                    config.updateRateHz === hz
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {hz}Hz
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
