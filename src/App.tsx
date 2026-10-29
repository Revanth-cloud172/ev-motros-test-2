import React from 'react';
import { useSimulation } from './simulation/useSimulation';
import { DashboardHeader } from './components/DashboardHeader';
import { HardwareConnectionPanel } from './components/HardwareConnectionPanel';
import { TelemetryCards } from './components/TelemetryCards';
import { MotorVisualization } from './components/MotorVisualization';
import { TelemetryCharts } from './components/TelemetryCharts';
import { SimulationControls } from './components/SimulationControls';
import { FaultInjectionPanel } from './components/FaultInjectionPanel';
import { HealthAssessment } from './components/HealthAssessment';
import { EventLog } from './components/EventLog';
import { ExportReports } from './components/ExportReports';

export default function App() {
  const {
    status,
    dataSourceMode,
    config,
    activeFaultId,
    activeFault,
    currentTelemetry,
    telemetryHistory,
    cumulativeSamples,
    eventLogs,
    condition,
    thresholds,
    sampleCount,
    serialStatus,
    serialStats,
    terminalLogs,
    isWebSerialSupported,
    connectHardware,
    disconnectHardware,
    setDataSourceMode,
    toggleMode,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    emergencyStop,
    setLoad,
    setSpeedSetpoint,
    setAmbientTemp,
    setCoolingEffectiveness,
    setUpdateRate,
    toggleRegen,
    injectFault,
    clearFault,
    clearLogs,
    updateThresholds,
    addLog,
  } = useSimulation();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* 1. Header with System Status, Hardware Badge & Simulation Controls */}
      <DashboardHeader
        status={status}
        timeSec={currentTelemetry.timeSec}
        sampleCount={sampleCount}
        activeFaultName={activeFault.name}
        dataSourceMode={dataSourceMode}
        serialStatus={serialStatus}
        isStale={serialStats.isStale}
        validHardwarePackets={serialStats.validCount}
        onStart={startSimulation}
        onPause={pauseSimulation}
        onResume={resumeSimulation}
        onReset={resetSimulation}
        onEmergencyStop={emergencyStop}
        onToggleMode={toggleMode}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-5 sm:px-6 flex-1 w-full flex flex-col gap-5">
        {/* 2. STM32 NUCLEO-F446RE Hardware Connection Panel */}
        <section>
          <HardwareConnectionPanel
            serialStatus={serialStatus}
            serialStats={serialStats}
            terminalLogs={terminalLogs}
            dataSourceMode={dataSourceMode}
            isWebSerialSupported={isWebSerialSupported}
            onConnect={connectHardware}
            onDisconnect={disconnectHardware}
            onToggleMode={toggleMode}
            onSetMode={setDataSourceMode}
          />
        </section>

        {/* 3. Live Telemetry Metric Cards */}
        <section>
          <TelemetryCards telemetry={currentTelemetry} thresholds={thresholds} />
        </section>

        {/* 4. Primary Two-Column Workbench: 3D Motor Twin & Real-time Charts */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left: 3D Motor Visualization */}
          <div className="lg:col-span-5 flex flex-col">
            <MotorVisualization
              telemetry={currentTelemetry}
              activeFaultId={activeFaultId}
            />
          </div>

          {/* Right: Real-time Telemetry Charts */}
          <div className="lg:col-span-7 flex flex-col">
            <TelemetryCharts
              history={telemetryHistory}
              thresholds={thresholds}
            />
          </div>
        </section>

        {/* 5. Powertrain Simulation Controls (Active in Simulation mode or for testing bounds) */}
        <section>
          <SimulationControls
            config={config}
            onSetLoad={setLoad}
            onSetSpeedSetpoint={setSpeedSetpoint}
            onSetAmbientTemp={setAmbientTemp}
            onSetCoolingEffectiveness={setCoolingEffectiveness}
            onSetUpdateRate={setUpdateRate}
            onToggleRegen={toggleRegen}
          />
        </section>

        {/* 6. Fault Injection Scenarios */}
        <section>
          <FaultInjectionPanel
            activeFaultId={activeFaultId}
            onInjectFault={injectFault}
            onClearFault={clearFault}
          />
        </section>

        {/* 7. Condition Monitoring & Diagnostic Health Assessment */}
        <section>
          <HealthAssessment
            telemetry={currentTelemetry}
            condition={condition}
            thresholds={thresholds}
            activeFault={activeFault}
            eventLogs={eventLogs}
            config={config}
            onUpdateThresholds={updateThresholds}
          />
        </section>

        {/* 8. Event Log & Data Export Reports */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 flex flex-col">
            <EventLog logs={eventLogs} onClearLogs={clearLogs} />
          </div>
          <div className="lg:col-span-6 flex flex-col">
            <ExportReports
              cumulativeSamples={cumulativeSamples}
              currentTelemetry={currentTelemetry}
              eventLogs={eventLogs}
              config={config}
              onAddLog={addLog}
            />
          </div>
        </section>
      </main>

      {/* Engineering Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <span className="font-semibold text-slate-700">EV Motor Digital Twin</span> — Permanent Magnet Synchronous Traction Motor (PMSM 150 kW)
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Hardware Interface: STM32 NUCLEO-F446RE USART2 (PA2/PA3) VCP @ 115200 8N1
          </div>
        </div>
      </footer>
    </div>
  );
}
