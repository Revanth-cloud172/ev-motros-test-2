import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DataSourceType,
  DiagnosticAlert,
  DiagnosticThresholds,
  FaultId,
  HardwarePacketStats,
  LogEntry,
  MotorTelemetry,
  SerialConnectionStatus,
  SimulationConfig,
  SimulationStatus,
} from './types';
import { FAULT_CATALOG } from './faultModels';
import {
  createInitialPhysicsState,
  PhysicsInternalState,
  stepPhysics,
} from './motorPhysics';
import {
  ConditionEvaluation,
  DEFAULT_THRESHOLDS,
  evaluateMotorCondition,
} from './diagnosticEngine';
import { Stm32SerialManager } from './serialProtocol';

const INITIAL_CONFIG: SimulationConfig = {
  loadPct: 50,
  speedSetpointRpm: 3500,
  ambientTempC: 25,
  coolingEffectivenessPct: 85,
  updateRateHz: 20, // 20 Hz = 50ms timestep
  regenMode: false,
};

export interface RawTerminalLine {
  id: string;
  timestamp: string;
  text: string;
  isError: boolean;
}

export function useSimulation() {
  const [status, setStatus] = useState<SimulationStatus>('RUNNING');
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceType>('SIMULATION');
  const [config, setConfig] = useState<SimulationConfig>(INITIAL_CONFIG);
  const [activeFaultId, setActiveFaultId] = useState<FaultId>('none');
  const [thresholds, setThresholds] = useState<DiagnosticThresholds>(DEFAULT_THRESHOLDS);

  // Hardware connection state
  const [serialStatus, setSerialStatus] = useState<SerialConnectionStatus>('DISCONNECTED');
  const [serialStats, setSerialStats] = useState<HardwarePacketStats>({
    validCount: 0,
    invalidCount: 0,
    lastTimestamp: null,
    bytesReceived: 0,
    isStale: false,
  });
  const [terminalLogs, setTerminalLogs] = useState<RawTerminalLine[]>([]);

  // High-frequency telemetry buffer and state
  const [currentTelemetry, setCurrentTelemetry] = useState<MotorTelemetry>(() => {
    const initPhys = createInitialPhysicsState(INITIAL_CONFIG.ambientTempC);
    const { telemetry } = stepPhysics(initPhys, INITIAL_CONFIG, 'none', 'RUNNING', 0, 0.05);
    return telemetry;
  });

  const [telemetryHistory, setTelemetryHistory] = useState<MotorTelemetry[]>([]);
  const [eventLogs, setEventLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      timeSec: 0,
      type: 'SIMULATION',
      severity: 'INFO',
      message: 'EV Motor Digital Twin simulation engine initialized.',
      details: 'PMSM 150kW model loaded with 400V DC bus and 310 Nm peak torque baseline.',
    },
  ]);

  const [condition, setCondition] = useState<ConditionEvaluation>(() =>
    evaluateMotorCondition(currentTelemetry, DEFAULT_THRESHOLDS)
  );

  // References for the simulation loop to avoid stale closure
  const statusRef = useRef<SimulationStatus>(status);
  statusRef.current = status;

  const dataSourceModeRef = useRef<DataSourceType>(dataSourceMode);
  dataSourceModeRef.current = dataSourceMode;

  const configRef = useRef<SimulationConfig>(config);
  configRef.current = config;

  const activeFaultRef = useRef<FaultId>(activeFaultId);
  activeFaultRef.current = activeFaultId;

  const thresholdsRef = useRef<DiagnosticThresholds>(thresholds);
  thresholdsRef.current = thresholds;

  const physicsStateRef = useRef<PhysicsInternalState>(
    createInitialPhysicsState(INITIAL_CONFIG.ambientTempC)
  );

  const timeSecRef = useRef<number>(0);
  const sampleCountRef = useRef<number>(0);
  const cumulativeSamplesRef = useRef<MotorTelemetry[]>([]);
  const previousAlertsRef = useRef<Set<string>>(new Set());

  // Serial Manager ref
  const serialManagerRef = useRef<Stm32SerialManager | null>(null);

  // Helper to add event log
  const addLog = useCallback(
    (
      type: LogEntry['type'],
      severity: LogEntry['severity'],
      message: string,
      details?: string
    ) => {
      const newEntry: LogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        timeSec: Number(timeSecRef.current.toFixed(2)),
        type,
        severity,
        message,
        details,
      };
      setEventLogs((prev) => [newEntry, ...prev.slice(0, 249)]); // Keep last 250 logs
    },
    []
  );

  // Handle incoming hardware telemetry
  const handleHardwareTelemetry = useCallback(
    (hwTelemetry: MotorTelemetry) => {
      if (dataSourceModeRef.current !== 'HARDWARE') {
        // Automatically switch to hardware mode when packets arrive
        setDataSourceMode('HARDWARE');
        dataSourceModeRef.current = 'HARDWARE';
      }

      sampleCountRef.current += 1;
      timeSecRef.current = hwTelemetry.timeSec;

      setCurrentTelemetry(hwTelemetry);

      // Rolling chart history
      setTelemetryHistory((prev) => {
        const next = [...prev, hwTelemetry];
        return next.length > 120 ? next.slice(next.length - 120) : next;
      });

      // Cumulative buffer for export
      if (cumulativeSamplesRef.current.length < 3000) {
        cumulativeSamplesRef.current.push(hwTelemetry);
      } else {
        cumulativeSamplesRef.current.shift();
        cumulativeSamplesRef.current.push(hwTelemetry);
      }

      // Run diagnostics on real hardware telemetry
      const evaluation = evaluateMotorCondition(hwTelemetry, thresholdsRef.current);
      setCondition(evaluation);

      // Check alert transitions
      for (const alert of evaluation.activeAlerts) {
        const alertKey = `HW-${alert.metric}-${alert.severity}`;
        if (!previousAlertsRef.current.has(alertKey)) {
          previousAlertsRef.current.add(alertKey);
          addLog(
            'WARNING',
            alert.severity,
            `Hardware Alert: ${alert.message}`,
            `Value: ${alert.value} ${alert.unit} (Limit: ${alert.threshold} ${alert.unit})`
          );
        }
      }
      const currentKeys = new Set(evaluation.activeAlerts.map((a) => `HW-${a.metric}-${a.severity}`));
      previousAlertsRef.current = currentKeys;
    },
    [addLog]
  );

  // Setup Serial Manager
  useEffect(() => {
    serialManagerRef.current = new Stm32SerialManager({
      onTelemetry: (t) => handleHardwareTelemetry(t),
      onRawLine: (line, isError) => {
        setTerminalLogs((prev) => [
          ...prev.slice(-99),
          {
            id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toLocaleTimeString(),
            text: line,
            isError,
          },
        ]);
      },
      onStatusChange: (newStatus, errorMsg) => {
        setSerialStatus(newStatus);
        if (newStatus === 'CONNECTED') {
          setDataSourceMode('HARDWARE');
          dataSourceModeRef.current = 'HARDWARE';
          addLog(
            'HARDWARE',
            'INFO',
            'STM32 NUCLEO-F446RE connected via USB Virtual COM Port.',
            'Baud: 115200, 8N1, Newline-terminated JSON protocol.'
          );
        } else if (newStatus === 'DISCONNECTED') {
          addLog('HARDWARE', 'INFO', 'STM32 disconnected. (Hardware stream inactive).');
        } else if (newStatus === 'BLOCKED') {
          addLog(
            'HARDWARE',
            'WARNING',
            'Web Serial Access Blocked by Browser / Iframe Security.',
            errorMsg || 'Open the application in a top-level Chrome/Edge tab or localhost:3000.'
          );
        } else if (newStatus === 'ERROR') {
          addLog('HARDWARE', 'WARNING', `Serial Communication Error: ${errorMsg || 'Unknown error'}`);
        }
      },
      onStatsUpdate: (newStats) => {
        setSerialStats(newStats);
        if (newStats.isStale) {
          addLog('WARNING', 'WARNING', 'Hardware Telemetry Stale: No JSON frames received for >2.5 seconds.');
        }
      },
    });

    return () => {
      if (serialManagerRef.current) {
        serialManagerRef.current.disconnect();
      }
    };
  }, [addLog, handleHardwareTelemetry]);

  // Connect & Disconnect Hardware API
  const connectHardware = useCallback(async (baudRate = 115200) => {
    if (serialManagerRef.current) {
      await serialManagerRef.current.connect(baudRate);
    }
  }, []);

  const disconnectHardware = useCallback(async () => {
    if (serialManagerRef.current) {
      await serialManagerRef.current.disconnect();
    }
  }, []);

  // Simulation tick step (active in SIMULATION mode only - NEVER synthesizes STM32 measurements)
  const executeTick = useCallback(() => {
    // If in hardware mode, do NOT synthesize or advance simulation telemetry!
    if (dataSourceModeRef.current === 'HARDWARE') {
      return;
    }

    const curStatus = statusRef.current;
    if (curStatus === 'PAUSED' || curStatus === 'STOPPED') return;

    const dt = 1.0 / configRef.current.updateRateHz;
    timeSecRef.current += dt;
    sampleCountRef.current += 1;

    const { nextState, telemetry } = stepPhysics(
      physicsStateRef.current,
      configRef.current,
      activeFaultRef.current,
      curStatus,
      timeSecRef.current,
      dt
    );

    physicsStateRef.current = nextState;
    setCurrentTelemetry(telemetry);

    // Maintain history buffer (last 120 samples for live charts)
    setTelemetryHistory((prev) => {
      const next = [...prev, telemetry];
      return next.length > 120 ? next.slice(next.length - 120) : next;
    });

    // Store in cumulative buffer for CSV export
    if (cumulativeSamplesRef.current.length < 3000) {
      cumulativeSamplesRef.current.push(telemetry);
    } else {
      cumulativeSamplesRef.current.shift();
      cumulativeSamplesRef.current.push(telemetry);
    }

    // Run diagnostics
    const evaluation = evaluateMotorCondition(telemetry, thresholdsRef.current);
    setCondition(evaluation);

    // Detect new warning transitions to log
    for (const alert of evaluation.activeAlerts) {
      const alertKey = `SIM-${alert.metric}-${alert.severity}`;
      if (!previousAlertsRef.current.has(alertKey)) {
        previousAlertsRef.current.add(alertKey);
        addLog(
          'WARNING',
          alert.severity,
          `Diagnostic Alert: ${alert.message}`,
          `Value: ${alert.value} ${alert.unit} (Limit: ${alert.threshold} ${alert.unit})`
        );
      }
    }

    // Clear resolved alerts from tracking set
    const currentKeys = new Set(evaluation.activeAlerts.map((a) => `SIM-${a.metric}-${a.severity}`));
    previousAlertsRef.current = currentKeys;
  }, [addLog, serialStatus, serialStats.isStale]);

  // Main simulation timer loop
  useEffect(() => {
    const intervalMs = Math.round(1000 / config.updateRateHz);
    const intervalId = setInterval(executeTick, intervalMs);
    return () => clearInterval(intervalId);
  }, [config.updateRateHz, executeTick]);

  // Simulation Controls API
  const startSimulation = useCallback(() => {
    setStatus('RUNNING');
    addLog('SIMULATION', 'INFO', 'Simulation started / running.');
  }, [addLog]);

  const pauseSimulation = useCallback(() => {
    setStatus('PAUSED');
    addLog('SIMULATION', 'INFO', 'Simulation paused by operator.');
  }, [addLog]);

  const resumeSimulation = useCallback(() => {
    setStatus('RUNNING');
    addLog('SIMULATION', 'INFO', 'Simulation resumed.');
  }, [addLog]);

  const emergencyStop = useCallback(() => {
    setStatus('ESTOP');
    setConfig((prev) => ({ ...prev, speedSetpointRpm: 0, loadPct: 0 }));
    addLog(
      'SIMULATION',
      'CRITICAL',
      'EMERGENCY STOP (E-STOP) TRIGGERED!',
      'Torque and speed demand forced to zero. High dynamic deceleration engaged.'
    );
  }, [addLog]);

  const resetSimulation = useCallback(() => {
    setStatus('PAUSED');
    timeSecRef.current = 0;
    sampleCountRef.current = 0;
    cumulativeSamplesRef.current = [];
    previousAlertsRef.current.clear();
    physicsStateRef.current = createInitialPhysicsState(configRef.current.ambientTempC);
    setActiveFaultId('none');

    const { telemetry } = stepPhysics(
      physicsStateRef.current,
      configRef.current,
      'none',
      'PAUSED',
      0,
      0.05
    );
    setCurrentTelemetry(telemetry);
    setTelemetryHistory([telemetry]);
    setCondition(evaluateMotorCondition(telemetry, thresholdsRef.current));

    addLog('RESET', 'INFO', 'Simulation state reset to baseline initial conditions.');
  }, [addLog]);

  const setLoad = useCallback(
    (loadPct: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(loadPct)));
      setConfig((prev) => ({ ...prev, loadPct: clamped }));
      addLog('SETPOINT', 'INFO', `Motor load changed to ${clamped}%.`);
    },
    [addLog]
  );

  const setSpeedSetpoint = useCallback(
    (rpm: number) => {
      const clamped = Math.max(0, Math.min(12000, Math.round(rpm)));
      setConfig((prev) => ({ ...prev, speedSetpointRpm: clamped }));
      if (statusRef.current === 'ESTOP') setStatus('RUNNING');
      addLog('SETPOINT', 'INFO', `Speed setpoint adjusted to ${clamped} RPM.`);
    },
    [addLog]
  );

  const setAmbientTemp = useCallback((tempC: number) => {
    setConfig((prev) => ({ ...prev, ambientTempC: tempC }));
  }, []);

  const setCoolingEffectiveness = useCallback((coolingPct: number) => {
    setConfig((prev) => ({ ...prev, coolingEffectivenessPct: coolingPct }));
  }, []);

  const setUpdateRate = useCallback(
    (hz: number) => {
      setConfig((prev) => ({ ...prev, updateRateHz: hz }));
      addLog('SETPOINT', 'INFO', `Simulation update rate changed to ${hz} Hz.`);
    },
    [addLog]
  );

  const toggleRegen = useCallback(() => {
    setConfig((prev) => {
      const nextRegen = !prev.regenMode;
      addLog(
        'SETPOINT',
        'INFO',
        nextRegen
          ? 'Regenerative braking mode engaged (negative torque generated).'
          : 'Motoring drive mode restored.'
      );
      return { ...prev, regenMode: nextRegen };
    });
  }, [addLog]);

  const injectFault = useCallback(
    (faultId: FaultId) => {
      setActiveFaultId(faultId);
      const def = FAULT_CATALOG[faultId];
      if (faultId === 'none') {
        addLog('FAULT', 'INFO', 'Fault cleared. Normal baseline operation restored.');
      } else {
        addLog(
          'FAULT',
          def.severity,
          `Fault Injected: ${def.name}`,
          def.description
        );
      }
    },
    [addLog]
  );

  const clearFault = useCallback(() => {
    injectFault('none');
  }, [injectFault]);

  const clearLogs = useCallback(() => {
    setEventLogs([]);
    setTerminalLogs([]);
  }, []);

  const updateThresholds = useCallback((newThresholds: DiagnosticThresholds) => {
    setThresholds(newThresholds);
  }, []);

  const setMode = useCallback(
    (mode: DataSourceType) => {
      setDataSourceMode(mode);
      dataSourceModeRef.current = mode;
      if (mode === 'HARDWARE') {
        if (serialStats.validCount === 0) {
          // Zero out measurements to ensure simulation values are NEVER displayed as STM32 measurements
          const standbyHwTelemetry: MotorTelemetry = {
            timestamp: Date.now(),
            timeSec: 0,
            speedRpm: 0,
            speedSetpointRpm: 0,
            phaseCurrentA: 0,
            dcBusVoltageV: 0,
            windingTempC: configRef.current.ambientTempC,
            trueWindingTempC: configRef.current.ambientTempC,
            torqueNm: 0,
            powerKw: 0,
            vibrationRms: 0,
            healthIndex: 100,
            thermalMarginC: 110,
            currentHeadroomA: 380,
            efficiencyPct: 0,
            activeFaultId: 'none',
            status: 'STOPPED',
            dataSource: 'HARDWARE',
            derivedFields: {
              torque: false,
              power: false,
              health: false,
            },
          };
          setCurrentTelemetry(standbyHwTelemetry);
          setCondition(evaluateMotorCondition(standbyHwTelemetry, thresholdsRef.current));
        }
        addLog('HARDWARE', 'INFO', 'Data source set to Physical STM32 Hardware stream.');
      } else {
        addLog('SIMULATION', 'INFO', 'Data source set to Internal Physics Simulation engine.');
      }
    },
    [addLog, serialStats.validCount]
  );

  const toggleMode = useCallback(() => {
    setMode(dataSourceModeRef.current === 'SIMULATION' ? 'HARDWARE' : 'SIMULATION');
  }, [setMode]);

  return {
    status,
    dataSourceMode,
    config,
    activeFaultId,
    activeFault: FAULT_CATALOG[activeFaultId],
    currentTelemetry,
    telemetryHistory,
    cumulativeSamples: cumulativeSamplesRef.current,
    eventLogs,
    condition,
    thresholds,
    sampleCount: sampleCountRef.current,
    // Serial state & actions
    serialStatus,
    serialStats,
    terminalLogs,
    isWebSerialSupported: Stm32SerialManager.isSupported(),
    serialEnv: Stm32SerialManager.checkEnvironment(),
    connectHardware,
    disconnectHardware,
    setDataSourceMode: setMode,
    toggleMode,
    // Simulation actions
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
  };
}
