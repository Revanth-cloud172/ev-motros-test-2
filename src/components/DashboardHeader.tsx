import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  OctagonAlert,
  Clock,
  Database,
  Cpu,
  Usb,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { DataSourceType, SerialConnectionStatus, SimulationStatus } from '../simulation/types';

interface DashboardHeaderProps {
  status: SimulationStatus;
  timeSec: number;
  sampleCount: number;
  activeFaultName: string;
  dataSourceMode: DataSourceType;
  serialStatus: SerialConnectionStatus;
  isStale: boolean;
  validHardwarePackets: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onEmergencyStop: () => void;
  onToggleMode: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  status,
  timeSec,
  sampleCount,
  activeFaultName,
  dataSourceMode,
  serialStatus,
  isStale,
  validHardwarePackets,
  onStart,
  onPause,
  onResume,
  onReset,
  onEmergencyStop,
  onToggleMode,
}) => {
  // Format simulation clock (MM:SS.SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    const paddedMins = mins.toString().padStart(2, '0');
    const paddedSecs = (seconds % 60) < 10 ? `0${secs}` : secs;
    return `${paddedMins}:${paddedSecs}s`;
  };

  const getConnectionStateBadge = () => {
    if (serialStatus === 'BLOCKED') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          CONNECTION BLOCKED BY BROWSER
        </span>
      );
    }

    if (dataSourceMode === 'HARDWARE' && serialStatus === 'CONNECTED') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          HARDWARE CONNECTED
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
        <span className="w-2 h-2 rounded-full bg-indigo-500" />
        SIMULATION MODE
      </span>
    );
  };

  const getRunnerStatusBadge = () => {
    if (dataSourceMode === 'HARDWARE') {
      if (serialStatus === 'CONNECTED' && isStale) {
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            STALE (&gt;2.5s)
          </span>
        );
      }
      return null;
    }

    switch (status) {
      case 'RUNNING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            RUNNING
          </span>
        );
      case 'PAUSED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            PAUSED
          </span>
        );
      case 'ESTOP':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-bounce flex items-center gap-1">
            <OctagonAlert className="w-3 h-3 text-rose-600" />
            E-STOP
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Title & Hardware distinction badge */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
            <Cpu className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                EV Motor Digital Twin
              </h1>
              {getConnectionStateBadge()}
              {getRunnerStatusBadge()}
            </div>
            <p className="text-xs text-slate-500">
              150 kW Permanent Magnet Synchronous Motor (PMSM) • Real-Time Telemetry & Diagnostics
            </p>
          </div>
        </div>

        {/* Status Indicators & Control Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Clock & Samples */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-1 text-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold">{formatTime(timeSec)}</span>
            </div>
            <div className="h-3 w-px bg-slate-200" />
            <div className="flex items-center gap-1 text-slate-600">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>{sampleCount} pts</span>
            </div>
          </div>

          {/* Mode Switch Toggle */}
          <button
            onClick={onToggleMode}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              dataSourceMode === 'HARDWARE'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle between Simulation and Physical STM32 Hardware stream"
          >
            <Radio className="w-3.5 h-3.5 text-slate-500" />
            {dataSourceMode === 'HARDWARE' ? 'Using STM32' : 'Using Simulation'}
          </button>

          {/* Simulation Action Controls (Available in Simulation Mode or E-stop) */}
          <div className="flex items-center gap-1.5">
            {status === 'RUNNING' ? (
              <button
                onClick={onPause}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs flex items-center gap-1.5 transition-colors"
                title="Pause Simulation"
              >
                <Pause className="w-3.5 h-3.5 text-slate-600" />
                Pause
              </button>
            ) : (
              <button
                onClick={onResume}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-xs flex items-center gap-1.5 transition-colors"
                title="Resume / Start Simulation"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                {status === 'ESTOP' ? 'Resume Drive' : 'Start'}
              </button>
            )}

            <button
              onClick={onReset}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              title="Reset Simulation to Initial State"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Industrial Emergency Stop (E-STOP) */}
            <button
              onClick={onEmergencyStop}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 border shadow-xs ${
                status === 'ESTOP'
                  ? 'bg-rose-700 text-white border-rose-800 ring-2 ring-rose-500/50'
                  : 'bg-rose-600 text-white hover:bg-rose-700 border-rose-700 active:scale-95'
              }`}
              title="Trigger Emergency Motor Stop"
            >
              <OctagonAlert className="w-3.5 h-3.5" />
              E-STOP
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
