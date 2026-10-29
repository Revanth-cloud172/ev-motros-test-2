import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  Zap,
  Wrench,
  BatteryLow,
  Activity,
  Waves,
  Fan,
  RotateCcw,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { FaultDefinition, FaultId } from '../simulation/types';
import { FAULT_CATALOG } from '../simulation/faultModels';

interface FaultInjectionPanelProps {
  activeFaultId: FaultId;
  onInjectFault: (faultId: FaultId) => void;
  onClearFault: () => void;
}

export const FaultInjectionPanel: React.FC<FaultInjectionPanelProps> = ({
  activeFaultId,
  onInjectFault,
  onClearFault,
}) => {
  const [expandedFault, setExpandedFault] = useState<FaultId | null>(null);

  const getFaultIcon = (id: FaultId) => {
    switch (id) {
      case 'none':
        return CheckCircle2;
      case 'overheating':
        return Flame;
      case 'overcurrent':
        return Zap;
      case 'bearing_wear':
        return Wrench;
      case 'undervoltage':
        return BatteryLow;
      case 'sensor_drift':
        return Activity;
      case 'excessive_vibration':
        return Waves;
      case 'cooling_degraded':
        return Fan;
      default:
        return AlertTriangle;
    }
  };

  const activeDef = FAULT_CATALOG[activeFaultId];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-800">
            Fault Injection & Stress Scenarios
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            (8 Scenarios)
          </span>
        </div>

        {/* Global Clear Action */}
        <div className="flex items-center gap-2">
          {activeFaultId !== 'none' ? (
            <button
              onClick={onClearFault}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Fault & Restore Normal
            </button>
          ) : (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/70 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Baseline Nominal Mode Active
            </span>
          )}
        </div>
      </div>

      {/* Active Fault Diagnostic Notice */}
      {activeFaultId !== 'none' && (
        <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Active Injected Condition: {activeDef.name}
            </span>
            <span className="text-[11px] font-mono font-bold text-amber-700 bg-white px-2 py-0.5 rounded border border-amber-200">
              Severity: {activeDef.severity}
            </span>
          </div>

          <p className="text-amber-800 text-[11px] leading-relaxed">
            {activeDef.description}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-amber-200/60 text-[11px]">
            <div>
              <span className="font-semibold text-amber-900">Recommended Action:</span>{' '}
              <span className="text-amber-800">{activeDef.recommendedAction}</span>
            </div>
            <div>
              <span className="font-semibold text-amber-900">Inspection Procedure:</span>{' '}
              <span className="text-amber-800">{activeDef.inspectionProcedure}</span>
            </div>
          </div>
        </div>
      )}

      {/* Grid of 8 Fault Scenario Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {(Object.keys(FAULT_CATALOG) as FaultId[]).map((id) => {
          const item = FAULT_CATALOG[id];
          const Icon = getFaultIcon(id);
          const isActive = activeFaultId === id;
          const isExpanded = expandedFault === id;

          return (
            <div
              key={id}
              className={`rounded-lg border p-3 flex flex-col justify-between transition-all ${
                isActive
                  ? 'border-amber-400 bg-amber-50/40 ring-1 ring-amber-400/50 shadow-xs'
                  : 'border-slate-200 bg-slate-50/40 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`p-1 rounded ${
                        isActive
                          ? 'bg-amber-100 text-amber-800'
                          : id === 'none'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200/80 text-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    {item.category}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">
                  {item.description}
                </p>

                {/* Affected Parameters Badge List */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.affectedParameters.map((param, pIdx) => (
                    <span
                      key={pIdx}
                      className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono"
                    >
                      {param}
                    </span>
                  ))}
                </div>

                {/* Collapsible Inspection Details */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-600 flex flex-col gap-1">
                    <div>
                      <strong className="text-slate-700">Corrective Action:</strong> {item.recommendedAction}
                    </div>
                    <div>
                      <strong className="text-slate-700">Inspection:</strong> {item.inspectionProcedure}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Buttons */}
              <div className="pt-2 mt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                <button
                  onClick={() => setExpandedFault(isExpanded ? null : id)}
                  className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                >
                  {isExpanded ? (
                    <>Less <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>Details <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>

                {isActive ? (
                  <button
                    onClick={onClearFault}
                    className="px-2.5 py-1 rounded text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                  >
                    Clear
                  </button>
                ) : (
                  <button
                    onClick={() => onInjectFault(id)}
                    className="px-2.5 py-1 rounded text-xs font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors"
                  >
                    {id === 'none' ? 'Set Baseline' : 'Inject Fault'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
