import React, { useState } from 'react';
import { ScrollText, Trash2, Search, Filter, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import { LogEntry, SeverityLevel } from '../simulation/types';

interface EventLogProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const EventLog: React.FC<EventLogProps> = ({ logs, onClearLogs }) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLogs = logs.filter((log) => {
    if (filterSeverity !== 'ALL' && log.severity !== filterSeverity) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q)) ||
        log.type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getSeverityBadge = (severity: SeverityLevel) => {
    switch (severity) {
      case 'CRITICAL':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'WARNING':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'INFO':
        return 'text-slate-600 bg-slate-100 border-slate-200';
      default:
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-800">
            System Event & Diagnostic Log
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            ({filteredLogs.length} events)
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-md bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 w-36 sm:w-48"
            />
          </div>

          {/* Severity filter */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 font-medium focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="WARNING">Warnings</option>
            <option value="INFO">Info Logs</option>
          </select>

          {/* Clear Log */}
          <button
            onClick={onClearLogs}
            className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Clear Event Log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log Feed */}
      <div className="h-64 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs scrollbar-thin">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
            No events match current filter criteria.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-2 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${getSeverityBadge(
                    log.severity
                  )}`}
                >
                  {log.severity}
                </span>

                <div className="min-w-0">
                  <div className="text-slate-800 font-sans font-medium text-[11px] truncate">
                    {log.message}
                  </div>
                  {log.details && (
                    <div className="text-slate-500 text-[10px] font-mono mt-0.5">
                      {log.details}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0 text-[10px] text-slate-400 font-mono">
                <div>{log.timestamp}</div>
                <div>{log.timeSec.toFixed(1)}s sim</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
