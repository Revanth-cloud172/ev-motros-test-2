import React, { useState } from 'react';
import {
  Cpu,
  Usb,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Terminal,
  HelpCircle,
  ExternalLink,
  Sliders,
  Radio,
  Clock,
  Layers,
} from 'lucide-react';
import {
  DataSourceType,
  HardwarePacketStats,
  SerialConnectionStatus,
} from '../simulation/types';
import { SUPPORTED_BAUD_RATES } from '../simulation/serialProtocol';
import { RawTerminalLine } from '../simulation/useSimulation';

interface HardwareConnectionPanelProps {
  serialStatus: SerialConnectionStatus;
  serialStats: HardwarePacketStats;
  terminalLogs: RawTerminalLine[];
  dataSourceMode: DataSourceType;
  isWebSerialSupported: boolean;
  onConnect: (baudRate: number) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onToggleMode: () => void;
  onSetMode: (mode: DataSourceType) => void;
}

export const HardwareConnectionPanel: React.FC<HardwareConnectionPanelProps> = ({
  serialStatus,
  serialStats,
  terminalLogs,
  dataSourceMode,
  isWebSerialSupported,
  onConnect,
  onDisconnect,
  onToggleMode,
  onSetMode,
}) => {
  const [selectedBaud, setSelectedBaud] = useState<number>(115200);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await onConnect(selectedBaud);
    } finally {
      setIsConnecting(false);
    }
  };

  const formatTimestamp = (ts: number | null) => {
    if (!ts) return 'No data yet';
    const date = new Date(ts);
    return `${date.toLocaleTimeString()}.${date.getMilliseconds().toString().padStart(3, '0')}`;
  };

  const getStatusBadge = () => {
    if (serialStatus === 'BLOCKED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          CONNECTION BLOCKED BY BROWSER
        </span>
      );
    }

    if (serialStatus === 'CONNECTED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          HARDWARE CONNECTED
        </span>
      );
    }

    if (serialStatus === 'CONNECTING') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          CONNECTING...
        </span>
      );
    }

    if (serialStatus === 'ERROR') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          COMMUNICATION ERROR
        </span>
      );
    }

    if (serialStatus === 'UNSUPPORTED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          WEB SERIAL UNSUPPORTED
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1.5">
        <WifiOff className="w-3.5 h-3.5 text-slate-400" />
        SIMULATION MODE
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col gap-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
            <Usb className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              STM32 NUCLEO-F446RE Hardware Connection
              <span className="text-[10px] font-mono font-normal text-slate-500">
                USART2 (PA2/PA3) via ST-LINK VCP
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Live USB serial telemetry bridge (115200 baud, 8N1, Newline-delimited JSON)
            </p>
          </div>
        </div>

        {/* Status Badge & Mode Switch */}
        <div className="flex items-center gap-2 flex-wrap">
          {getStatusBadge()}

          {/* Mode Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => onSetMode('SIMULATION')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                dataSourceMode === 'SIMULATION'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Simulation Mode
            </button>
            <button
              onClick={() => onSetMode('HARDWARE')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                dataSourceMode === 'HARDWARE'
                  ? 'bg-slate-900 text-white shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Cpu className="w-3 h-3" />
              Hardware Stream
            </button>
          </div>

          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            title="Setup & Troubleshooting Instructions"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Browser Web Serial API Security / Permission Policy Banner */}
      {serialStatus === 'BLOCKED' && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex flex-col gap-2.5 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-bold text-rose-900 text-sm block">
                Connection Blocked by Browser Security Policy
              </strong>
              <p className="mt-1 text-rose-800 leading-relaxed text-[11px]">
                The browser blocked <code>navigator.serial.requestPort()</code> with a <code>SecurityError</code> ("requestPort() is not allowed in this context"). This occurs because this development preview is embedded inside a sandboxed iframe where the browser's Permissions Policy restricts direct hardware USB/Serial port enumeration.
              </p>
            </div>
          </div>
          <div className="bg-white/90 p-3 rounded-lg border border-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-slate-700">
              <span className="font-semibold block text-slate-900 mb-0.5">To connect your physical STM32 Nucleo board:</span>
              1. Open this app directly as a <strong>top-level window</strong> in desktop <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.
              <br />
              2. Or run locally: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-900">npm run dev</code> and open <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-900">http://localhost:3000</code>.
            </div>
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5 transition-colors shadow-xs text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in New Window
            </a>
          </div>
        </div>
      )}

      {/* Browser Web Serial API Compatibility Warning if not supported */}
      {!isWebSerialSupported && serialStatus !== 'BLOCKED' && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Web Serial API is not available in this browser.</strong>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              To connect your STM32 NUCLEO-F446RE, open this application in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> on desktop. Ensure the app is served via HTTPS or localhost.
            </p>
          </div>
        </div>
      )}

      {/* Main Connection Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Connection Action & Baud Selector */}
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              Baud Rate Configuration
            </label>
            <select
              value={selectedBaud}
              disabled={serialStatus === 'CONNECTED' || isConnecting}
              onChange={(e) => setSelectedBaud(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-md p-1.5 bg-white font-mono font-medium text-slate-800 focus:outline-none"
            >
              {SUPPORTED_BAUD_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate} baud {rate === 115200 ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            {serialStatus === 'CONNECTED' ? (
              <button
                onClick={onDisconnect}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <WifiOff className="w-3.5 h-3.5" />
                Disconnect STM32
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={!isWebSerialSupported || isConnecting}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Usb className="w-3.5 h-3.5" />
                {isConnecting ? 'Requesting Port...' : 'Connect STM32 Board'}
              </button>
            )}
          </div>
        </div>

        {/* Valid Packets Counter */}
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500">Valid Packets Received</span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-2xl font-bold font-mono text-emerald-700">
              {serialStats.validCount.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-mono">frames</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono truncate">
            Bytes: {(serialStats.bytesReceived / 1024).toFixed(1)} KB
          </div>
        </div>

        {/* Invalid / Malformed Packets Counter */}
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500">Malformed / Dropped</span>
          <div className="flex items-baseline gap-1 my-1">
            <span
              className={`text-2xl font-bold font-mono ${
                serialStats.invalidCount > 0 ? 'text-amber-700' : 'text-slate-700'
              }`}
            >
              {serialStats.invalidCount}
            </span>
            <span className="text-xs text-slate-400 font-mono">errors</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono truncate">
            {serialStats.invalidCount === 0 ? 'Protocol CRC: 100% Valid' : 'Check baud / framing'}
          </div>
        </div>

        {/* Stream Health & Watchdog Status */}
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500">Last Telemetry Frame</span>
          <div className="my-1 font-mono text-xs font-semibold text-slate-800">
            {formatTimestamp(serialStats.lastTimestamp)}
          </div>
          <div className="text-[11px]">
            {serialStats.isStale && serialStatus === 'CONNECTED' ? (
              <span className="text-rose-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                STALE (No data &gt;2.5s)
              </span>
            ) : serialStatus === 'CONNECTED' ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Stream Active (~5–10 Hz)
              </span>
            ) : (
              <span className="text-slate-400 italic">Standby</span>
            )}
          </div>
        </div>
      </div>

      {/* Active Mode Notice Banner */}
      <div
        className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
          dataSourceMode === 'HARDWARE'
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2">
          <Radio
            className={`w-4 h-4 ${
              dataSourceMode === 'HARDWARE' ? 'text-emerald-600 animate-pulse' : 'text-slate-400'
            }`}
          />
          <div>
            <span className="font-semibold">
              {dataSourceMode === 'HARDWARE'
                ? 'Active Data Source: PHYSICAL HARDWARE (STM32 NUCLEO-F446RE)'
                : 'Active Data Source: SIMULATION ENGINE (PHYSICS MODEL)'}
            </span>
            <span className="text-[11px] block text-slate-500">
              {dataSourceMode === 'HARDWARE'
                ? 'Dashboard telemetry, charts, and 3D twin are rendered directly from received STM32 JSON frames.'
                : 'Using internal first-order ODE electromechanical & thermal simulation.'}
            </span>
          </div>
        </div>

        <button
          onClick={onToggleMode}
          className="text-xs font-semibold px-2.5 py-1 rounded bg-white border border-current hover:bg-slate-50 transition-colors shadow-2xs"
        >
          Switch to {dataSourceMode === 'HARDWARE' ? 'Simulation' : 'Hardware'}
        </button>
      </div>

      {/* Live Serial Stream Monitor Terminal */}
      <div className="rounded-lg border border-slate-200 bg-slate-900 text-slate-100 flex flex-col overflow-hidden text-xs">
        <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono font-medium text-[11px] text-slate-300">
              Live Serial Terminal Monitor (ASCII Stream)
            </span>
          </div>
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className="text-[10px] text-slate-400 hover:text-white"
          >
            {showTerminal ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {showTerminal && (
          <div className="p-3 font-mono text-[11px] h-36 overflow-y-auto space-y-1 bg-slate-900/90 scrollbar-thin">
            {terminalLogs.length === 0 ? (
              <div className="text-slate-500 italic text-[11px]">
                No serial data received yet. Click 'Connect STM32 Board' above to open port.
              </div>
            ) : (
              terminalLogs.map((log) => (
                <div
                  key={log.id}
                  className={`leading-tight ${
                    log.isError ? 'text-rose-400' : 'text-emerald-300'
                  }`}
                >
                  <span className="text-slate-500 mr-2">[{log.timestamp}]</span>
                  <span>{log.text}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Setup & Reconnection Instructions Modal / Expander */}
      {showInstructions && (
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h4 className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-slate-700" />
              STM32 NUCLEO-F446RE Quick Connection Guide
            </h4>
            <button
              onClick={() => setShowInstructions(false)}
              className="text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-600 leading-relaxed text-[11px]">
            <div>
              <strong className="text-slate-800 block mb-1">1. Physical ST-LINK USB Link</strong>
              <p>
                Connect the Micro-USB cable to the upper ST-LINK USB connector (CN1) on the NUCLEO board. The onboard ST-LINK V2-1 enumerates as a Virtual COM Port (VCP) routed internally to USART2 on PA2 (TX) and PA3 (RX). No separate external FTDI cable is required!
              </p>
            </div>

            <div>
              <strong className="text-slate-800 block mb-1">2. Ubuntu / Linux Permissions</strong>
              <p>
                Ensure your user account is in the <code>dialout</code> group:
                <br />
                <code className="text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  sudo usermod -a -G dialout $USER
                </code>
                <br />
                Verify device node: <code>ls /dev/ttyACM*</code> or <code>dmesg | tail -30</code>
              </p>
            </div>

            <div>
              <strong className="text-slate-800 block mb-1">3. JSON Packet Schema</strong>
              <p>
                The firmware sends one JSON line every 100ms (10 Hz) terminated with <code>\n</code>:
                <br />
                <code className="text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 block mt-1 overflow-x-auto">
                  {`{"rpm":3200,"current_A":18.4,"voltage_V":360,"temperature_C":68.2,"vibration_mm_s":1.8,"load_pct":50}`}
                </code>
              </p>
            </div>

            <div>
              <strong className="text-slate-800 block mb-1">4. Reconnection & Troubleshooting</strong>
              <p>
                If the port does not appear in the browser dialog, unplug and replug the USB cable, press the black RESET button (B2) on the Nucleo, and check Windows Device Manager under "Ports (COM & LPT)" for "STMicroelectronics STLink Virtual COM Port".
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
