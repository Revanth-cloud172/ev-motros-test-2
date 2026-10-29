import React, { useMemo, useRef, useState, useEffect } from 'react';
import { LineChart, Maximize2, Pause, Play, Sliders, Clock } from 'lucide-react';
import { DiagnosticThresholds, MotorTelemetry } from '../simulation/types';

interface TelemetryChartsProps {
  history: MotorTelemetry[];
  thresholds: DiagnosticThresholds;
}

type ChartChannel = 'all' | 'speed' | 'current' | 'temperature' | 'vibration' | 'voltage' | 'health';

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({
  history,
  thresholds,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 680, height: 260 });
  const [timeWindowSec, setTimeWindowSec] = useState<number>(30);
  const [activeChannel, setActiveChannel] = useState<ChartChannel>('all');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isChartPaused, setIsChartPaused] = useState(false);
  const frozenHistoryRef = useRef<MotorTelemetry[]>([]);

  // Keep chart size responsive
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 50) {
          setDimensions({
            width: entry.contentRect.width,
            height: 270,
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update frozen buffer when paused
  if (isChartPaused && frozenHistoryRef.current.length === 0 && history.length > 0) {
    frozenHistoryRef.current = [...history];
  } else if (!isChartPaused) {
    frozenHistoryRef.current = [];
  }

  const activeData = isChartPaused ? frozenHistoryRef.current : history;

  // Filter samples based on selected time window
  const filteredSamples = useMemo(() => {
    if (activeData.length === 0) return [];
    const latestTime = activeData[activeData.length - 1].timeSec;
    const startTime = Math.max(0, latestTime - timeWindowSec);
    return activeData.filter((s) => s.timeSec >= startTime);
  }, [activeData, timeWindowSec]);

  const padding = { top: 20, right: 25, bottom: 30, left: 55 };
  const graphWidth = Math.max(50, dimensions.width - padding.left - padding.right);
  const graphHeight = Math.max(50, dimensions.height - padding.top - padding.bottom);

  // Helper to map values to SVG coordinates
  const createPath = (getValue: (d: MotorTelemetry) => number, minY: number, maxY: number) => {
    if (filteredSamples.length < 2) return '';
    const spanY = maxY - minY || 1;
    return filteredSamples
      .map((d, i) => {
        const x = padding.left + (i / (filteredSamples.length - 1)) * graphWidth;
        const val = Math.max(minY, Math.min(maxY, getValue(d)));
        const y = padding.top + (1 - (val - minY) / spanY) * graphHeight;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  // Channel configurations
  const channelConfigs = {
    speed: {
      label: 'Motor Speed',
      unit: 'RPM',
      color: '#0284c7', // Sky-600
      minY: 0,
      maxY: 12000,
      getValue: (d: MotorTelemetry) => d.speedRpm,
      warningLimit: null,
      criticalLimit: null,
    },
    current: {
      label: 'Phase Current',
      unit: 'A',
      color: '#ea580c', // Orange-600
      minY: 0,
      maxY: 360,
      getValue: (d: MotorTelemetry) => d.phaseCurrentA,
      warningLimit: thresholds.phaseCurrentWarningA,
      criticalLimit: thresholds.phaseCurrentCriticalA,
    },
    temperature: {
      label: 'Winding Temp',
      unit: '°C',
      color: '#dc2626', // Red-600
      minY: 20,
      maxY: 160,
      getValue: (d: MotorTelemetry) => d.windingTempC,
      warningLimit: thresholds.windingTempWarningC,
      criticalLimit: thresholds.windingTempCriticalC,
    },
    voltage: {
      label: 'DC Bus Voltage',
      unit: 'V',
      color: '#6366f1', // Indigo-500
      minY: 250,
      maxY: 430,
      getValue: (d: MotorTelemetry) => d.dcBusVoltageV,
      warningLimit: thresholds.dcBusMinWarningV,
      criticalLimit: thresholds.dcBusMinCriticalV,
    },
    vibration: {
      label: 'Vibration RMS',
      unit: 'mm/s',
      color: '#9333ea', // Purple-600
      minY: 0,
      maxY: 10,
      getValue: (d: MotorTelemetry) => d.vibrationRms,
      warningLimit: thresholds.vibrationWarningMms,
      criticalLimit: thresholds.vibrationCriticalMms,
    },
    health: {
      label: 'Health Index',
      unit: 'pts',
      color: '#10b981', // Emerald-500
      minY: 0,
      maxY: 100,
      getValue: (d: MotorTelemetry) => d.healthIndex,
      warningLimit: thresholds.healthWarningThreshold,
      criticalLimit: thresholds.healthCriticalThreshold,
    },
  };

  const hoveredSample = hoverIndex !== null && filteredSamples[hoverIndex] ? filteredSamples[hoverIndex] : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col gap-3">
      {/* Chart Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-800">
            Real-Time Telemetry Time-Series
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            ({filteredSamples.length} rolling samples)
          </span>
        </div>

        {/* Channel Selection & Range Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setActiveChannel('all')}
              className={`px-2 py-1 rounded-md font-medium transition-colors ${
                activeChannel === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Metrics
            </button>
            <button
              onClick={() => setActiveChannel('speed')}
              className={`px-2 py-1 rounded-md font-medium transition-colors ${
                activeChannel === 'speed' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              RPM
            </button>
            <button
              onClick={() => setActiveChannel('current')}
              className={`px-2 py-1 rounded-md font-medium transition-colors ${
                activeChannel === 'current' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Current
            </button>
            <button
              onClick={() => setActiveChannel('temperature')}
              className={`px-2 py-1 rounded-md font-medium transition-colors ${
                activeChannel === 'temperature' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Temp
            </button>
            <button
              onClick={() => setActiveChannel('vibration')}
              className={`px-2 py-1 rounded-md font-medium transition-colors ${
                activeChannel === 'vibration' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vibration
            </button>
          </div>

          {/* Time Window Buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <span className="px-1.5 text-slate-400">
              <Clock className="w-3 h-3" />
            </span>
            {[15, 30, 60, 120].map((sec) => (
              <button
                key={sec}
                onClick={() => setTimeWindowSec(sec)}
                className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${
                  timeWindowSec === sec ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>

          {/* Pause / Freeze Toggle */}
          <button
            onClick={() => setIsChartPaused(!isChartPaused)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
              isChartPaused
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title={isChartPaused ? 'Resume live chart scrolling' : 'Freeze chart for inspection'}
          >
            {isChartPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Primary SVG Chart View */}
      <div
        ref={containerRef}
        className="w-full relative select-none"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg
          width={dimensions.width}
          height={dimensions.height}
          className="overflow-visible"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left - padding.left;
            if (mouseX >= 0 && mouseX <= graphWidth && filteredSamples.length > 1) {
              const idx = Math.round((mouseX / graphWidth) * (filteredSamples.length - 1));
              setHoverIndex(Math.max(0, Math.min(filteredSamples.length - 1, idx)));
            } else {
              setHoverIndex(null);
            }
          }}
        >
          {/* Background Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + ratio * graphHeight;
            return (
              <line
                key={ratio}
                x1={padding.left}
                y1={y}
                x2={padding.left + graphWidth}
                y2={y}
                stroke="#f1f5f9"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Time axis ticks */}
          {filteredSamples.length > 1 && [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const idx = Math.min(filteredSamples.length - 1, Math.round(ratio * (filteredSamples.length - 1)));
            const sample = filteredSamples[idx];
            const x = padding.left + ratio * graphWidth;
            return (
              <g key={ratio}>
                <line x1={x} y1={padding.top} x2={x} y2={padding.top + graphHeight} stroke="#f1f5f9" strokeWidth="1" />
                <text
                  x={x}
                  y={dimensions.height - 8}
                  textAnchor="middle"
                  fill="#94a3b8"
                  className="text-[10px] font-mono"
                >
                  {sample ? `${sample.timeSec.toFixed(1)}s` : ''}
                </text>
              </g>
            );
          })}

          {/* Y-Axis Labeling based on active channel */}
          {activeChannel === 'all' ? (
            // In 'all' view, show normalized percent or primary metric scale
            [0, 0.5, 1].map((ratio) => {
              const y = padding.top + (1 - ratio) * graphHeight;
              return (
                <text
                  key={ratio}
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  className="text-[10px] font-mono"
                >
                  {ratio === 1 ? 'MAX' : ratio === 0.5 ? '50%' : '0%'}
                </text>
              );
            })
          ) : (
            // Dedicated scale for selected channel
            [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const cfg = channelConfigs[activeChannel];
              const val = cfg.minY + ratio * (cfg.maxY - cfg.minY);
              const y = padding.top + (1 - ratio) * graphHeight;
              return (
                <text
                  key={ratio}
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  className="text-[10px] font-mono"
                >
                  {Math.round(val)} {cfg.unit}
                </text>
              );
            })
          )}

          {/* Warning / Critical Threshold Reference Lines for focused channel */}
          {activeChannel !== 'all' && channelConfigs[activeChannel].warningLimit !== null && (
            (() => {
              const cfg = channelConfigs[activeChannel];
              const wVal = cfg.warningLimit!;
              const wY = padding.top + (1 - (wVal - cfg.minY) / (cfg.maxY - cfg.minY)) * graphHeight;
              return (
                <g>
                  <line
                    x1={padding.left}
                    y1={wY}
                    x2={padding.left + graphWidth}
                    y2={wY}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left + graphWidth - 4}
                    y={wY - 4}
                    textAnchor="end"
                    fill="#d97706"
                    className="text-[9px] font-semibold"
                  >
                    Warning: {wVal} {cfg.unit}
                  </text>
                </g>
              );
            })()
          )}

          {activeChannel !== 'all' && channelConfigs[activeChannel].criticalLimit !== null && (
            (() => {
              const cfg = channelConfigs[activeChannel];
              const cVal = cfg.criticalLimit!;
              const cY = padding.top + (1 - (cVal - cfg.minY) / (cfg.maxY - cfg.minY)) * graphHeight;
              return (
                <g>
                  <line
                    x1={padding.left}
                    y1={cY}
                    x2={padding.left + graphWidth}
                    y2={cY}
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left + graphWidth - 4}
                    y={cY - 4}
                    textAnchor="end"
                    fill="#dc2626"
                    className="text-[9px] font-semibold"
                  >
                    Critical: {cVal} {cfg.unit}
                  </text>
                </g>
              );
            })()
          )}

          {/* RENDER WAVEFORMS */}
          {activeChannel === 'all' ? (
            <>
              {/* Speed RPM (Normalized) */}
              <path
                d={createPath((d) => d.speedRpm, 0, 12000)}
                fill="none"
                stroke={channelConfigs.speed.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Phase Current */}
              <path
                d={createPath((d) => d.phaseCurrentA, 0, 360)}
                fill="none"
                stroke={channelConfigs.current.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Winding Temperature */}
              <path
                d={createPath((d) => d.windingTempC, 20, 160)}
                fill="none"
                stroke={channelConfigs.temperature.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Vibration RMS */}
              <path
                d={createPath((d) => d.vibrationRms, 0, 10)}
                fill="none"
                stroke={channelConfigs.vibration.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </>
          ) : (
            <path
              d={createPath(
                channelConfigs[activeChannel].getValue,
                channelConfigs[activeChannel].minY,
                channelConfigs[activeChannel].maxY
              )}
              fill="none"
              stroke={channelConfigs[activeChannel].color}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Interactive Hover Crosshair */}
          {hoverIndex !== null && filteredSamples[hoverIndex] && (
            (() => {
              const x = padding.left + (hoverIndex / (filteredSamples.length - 1)) * graphWidth;
              return (
                <g>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={padding.top + graphHeight}
                    stroke="#475569"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                  <circle cx={x} cy={padding.top + graphHeight / 2} r="3" fill="#0f172a" />
                </g>
              );
            })()
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredSample && (
          <div className="absolute top-2 right-4 bg-slate-900/90 text-white rounded-lg p-2.5 text-xs shadow-lg backdrop-blur-xs font-mono pointer-events-none flex flex-col gap-1 border border-slate-700">
            <div className="text-[10px] text-slate-400 font-sans border-b border-slate-700 pb-1 flex justify-between gap-3">
              <span>Sample @ {hoveredSample.timeSec.toFixed(2)}s</span>
              <span className="text-emerald-400">Health: {hoveredSample.healthIndex}%</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <div>Speed: <span className="text-sky-300">{hoveredSample.speedRpm.toFixed(0)} RPM</span></div>
              <div>Current: <span className="text-amber-300">{hoveredSample.phaseCurrentA.toFixed(1)} A</span></div>
              <div>Temp: <span className="text-rose-300">{hoveredSample.windingTempC.toFixed(1)} °C</span></div>
              <div>DC Bus: <span className="text-indigo-300">{hoveredSample.dcBusVoltageV.toFixed(1)} V</span></div>
              <div>Vibration: <span className="text-purple-300">{hoveredSample.vibrationRms.toFixed(2)} mm/s</span></div>
              <div>Torque: <span className="text-slate-200">{hoveredSample.torqueNm.toFixed(1)} Nm</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-sky-600" />
            <span className="font-medium text-slate-700">Speed (RPM)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-orange-600" />
            <span className="font-medium text-slate-700">Current (A)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-red-600" />
            <span className="font-medium text-slate-700">Winding Temp (°C)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-purple-600" />
            <span className="font-medium text-slate-700">Vibration (mm/s)</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Sampling: {history.length > 0 ? (1000 / (history.length > 1 ? (history[1].timeSec - history[0].timeSec) * 1000 : 50)).toFixed(0) : '20'} Hz Discrete Time-Step
        </div>
      </div>
    </div>
  );
};
