import React, { useState } from 'react';
import {
  HeartPulse,
  Thermometer,
  Zap,
  Waves,
  ShieldCheck,
  AlertOctagon,
  Sparkles,
  Settings2,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import {
  AIAnalysisResult,
  DiagnosticThresholds,
  FaultDefinition,
  MotorTelemetry,
} from '../simulation/types';
import { ConditionEvaluation } from '../simulation/diagnosticEngine';

interface HealthAssessmentProps {
  telemetry: MotorTelemetry;
  condition: ConditionEvaluation;
  thresholds: DiagnosticThresholds;
  activeFault: FaultDefinition;
  eventLogs: any[];
  config: any;
  onUpdateThresholds: (t: DiagnosticThresholds) => void;
}

export const HealthAssessment: React.FC<HealthAssessmentProps> = ({
  telemetry,
  condition,
  thresholds,
  activeFault,
  eventLogs,
  config,
  onUpdateThresholds,
}) => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [tempThresholds, setTempThresholds] = useState<DiagnosticThresholds>(thresholds);
  const [isConsultingAI, setIsConsultingAI] = useState(false);
  const [aiReport, setAiReport] = useState<AIAnalysisResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Call Gemini Diagnostic API
  const handleRequestAIDiagnosis = async () => {
    setIsConsultingAI(true);
    setAiError(null);
    try {
      const response = await fetch('/api/gemini/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetry,
          activeFault,
          faultHistory: eventLogs.slice(0, 5),
          config,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.analysis) {
        setAiReport(data.analysis);
      } else {
        throw new Error('Invalid diagnostic response structure');
      }
    } catch (err: any) {
      console.warn('AI diagnostic call failed, generating localized evaluation:', err);
      setAiError(err.message || 'Could not connect to AI diagnostic specialist.');
    } finally {
      setIsConsultingAI(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 55) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-800">
            Condition Monitoring & Health Assessment
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Consultation Button */}
          <button
            onClick={handleRequestAIDiagnosis}
            disabled={isConsultingAI}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Request AI Powertrain Specialist FMEA Diagnostics"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {isConsultingAI ? 'Analyzing...' : 'AI Specialist Diagnosis'}
          </button>

          {/* Thresholds Config Button */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Configure Diagnostic Thresholds"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Primary Health Score & Subsystem Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Overall Health Score Card */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between ${getHealthColor(telemetry.healthIndex)}`}>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
              Overall Motor Health
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-3xl font-extrabold font-mono tracking-tight">
                {telemetry.healthIndex}
              </span>
              <span className="text-xs font-semibold opacity-70">/ 100</span>
            </div>
          </div>

          <div className="text-[11px] font-medium pt-2 border-t border-current/20">
            Condition: {telemetry.healthIndex >= 80 ? 'Nominal / Healthy' : telemetry.healthIndex >= 55 ? 'Stressed / Warning' : 'Degraded / Critical'}
          </div>
        </div>

        {/* Thermal Margin */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-slate-500" />
              Thermal Margin
            </span>
            <span className="text-[10px] font-mono font-semibold text-slate-500">Class H (150°C)</span>
          </div>

          <div className="my-1.5">
            <span className="text-2xl font-bold font-mono text-slate-800">
              {telemetry.thermalMarginC.toFixed(1)} <span className="text-xs font-normal text-slate-500">°C</span>
            </span>
          </div>

          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>Status:</span>
            <span className={condition.thermalStatus === 'OPTIMAL' ? 'text-emerald-700 font-medium' : 'text-amber-700 font-semibold'}>
              {condition.thermalStatus}
            </span>
          </div>
        </div>

        {/* Inverter Current Headroom */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-slate-500" />
              Current Headroom
            </span>
            <span className="text-[10px] font-mono font-semibold text-slate-500">Trip: 360A</span>
          </div>

          <div className="my-1.5">
            <span className="text-2xl font-bold font-mono text-slate-800">
              {telemetry.currentHeadroomA.toFixed(0)} <span className="text-xs font-normal text-slate-500">A</span>
            </span>
          </div>

          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>Inverter Status:</span>
            <span className={condition.electricalStatus === 'BALANCED' ? 'text-emerald-700 font-medium' : 'text-amber-700 font-semibold'}>
              {condition.electricalStatus}
            </span>
          </div>
        </div>

        {/* Vibration ISO & Sensor Confidence */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-slate-500" />
              ISO 10816 Zone
            </span>
            <span className="text-[10px] font-mono font-semibold text-slate-500">Vib: {telemetry.vibrationRms.toFixed(2)}</span>
          </div>

          <div className="my-1.5">
            <span className="text-xl font-bold font-mono text-slate-800">
              {condition.vibrationZone.replace('_', ' ')}
            </span>
          </div>

          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>Sensor Confidence:</span>
            <span className="font-semibold text-slate-700 font-mono">
              {condition.sensorConfidencePct}%
            </span>
          </div>
        </div>
      </div>

      {/* Suggested Maintenance Actions List */}
      <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
          Recommended Engineering & Maintenance Interventions
        </span>
        <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
          {condition.maintenanceRecommendations.map((rec, idx) => (
            <li key={idx} className="leading-snug">
              {rec}
            </li>
          ))}
        </ul>
      </div>

      {/* AI Powertrain Specialist Report View */}
      {aiReport && (
        <div className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs flex flex-col gap-3 shadow-md border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-white">
                AI Powertrain Specialist FMEA Diagnostics (Gemini 3.8 Flash)
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              aiReport.severityLevel === 'CRITICAL' ? 'bg-rose-900 text-rose-200' :
              aiReport.severityLevel === 'WARNING' ? 'bg-amber-900 text-amber-200' : 'bg-emerald-900 text-emerald-200'
            }`}>
              {aiReport.severityLevel}
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <strong className="text-slate-300">Root Cause Hypothesis:</strong>{' '}
              <p className="text-slate-300 mt-0.5 leading-relaxed">{aiReport.rootCauseAnalysis}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <div>
                <strong className="text-slate-300">Thermal / Electromagnetic:</strong>
                <p className="text-slate-400 mt-0.5 leading-relaxed">{aiReport.thermalElectromagneticAssessment}</p>
              </div>
              <div>
                <strong className="text-slate-300">Mechanical Integrity:</strong>
                <p className="text-slate-400 mt-0.5 leading-relaxed">{aiReport.mechanicalIntegrityAssessment}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <strong className="text-slate-300">Standards & Compliance:</strong>{' '}
              <span className="text-slate-400">{aiReport.isoComplianceNote}</span>
            </div>

            {aiReport.recommendedActions?.length > 0 && (
              <div className="pt-2 border-t border-slate-800">
                <strong className="text-slate-300">Immediate Action Steps:</strong>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300 mt-1">
                  {aiReport.recommendedActions.map((act, i) => (
                    <li key={i}>{act}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Threshold Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-600" />
                Configure Diagnostic Alarm Thresholds
              </h4>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Adjust threshold boundaries for condition monitoring alerts and health index scoring penalties according to test specifications.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-medium">Winding Temp Warning (°C)</label>
                <input
                  type="number"
                  value={tempThresholds.windingTempWarningC}
                  onChange={(e) => setTempThresholds({ ...tempThresholds, windingTempWarningC: Number(e.target.value) })}
                  className="border rounded px-2.5 py-1.5 font-mono text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-medium">Winding Temp Critical (°C)</label>
                <input
                  type="number"
                  value={tempThresholds.windingTempCriticalC}
                  onChange={(e) => setTempThresholds({ ...tempThresholds, windingTempCriticalC: Number(e.target.value) })}
                  className="border rounded px-2.5 py-1.5 font-mono text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-medium">Phase Current Warning (A)</label>
                <input
                  type="number"
                  value={tempThresholds.phaseCurrentWarningA}
                  onChange={(e) => setTempThresholds({ ...tempThresholds, phaseCurrentWarningA: Number(e.target.value) })}
                  className="border rounded px-2.5 py-1.5 font-mono text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-medium">Phase Current Critical (A)</label>
                <input
                  type="number"
                  value={tempThresholds.phaseCurrentCriticalA}
                  onChange={(e) => setTempThresholds({ ...tempThresholds, phaseCurrentCriticalA: Number(e.target.value) })}
                  className="border rounded px-2.5 py-1.5 font-mono text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-medium">Vibration Warning (mm/s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempThresholds.vibrationWarningMms}
                  onChange={(e) => setTempThresholds({ ...tempThresholds, vibrationWarningMms: Number(e.target.value) })}
                  className="border rounded px-2.5 py-1.5 font-mono text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-medium">Vibration Critical (mm/s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempThresholds.vibrationCriticalMms}
                  onChange={(e) => setTempThresholds({ ...tempThresholds, vibrationCriticalMms: Number(e.target.value) })}
                  className="border rounded px-2.5 py-1.5 font-mono text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onUpdateThresholds(tempThresholds);
                  setShowConfigModal(false);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Save Thresholds
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
