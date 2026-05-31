import React from 'react';

interface HealthScore {
  overall: number;
  coverage: number;
  freshness: number;
  balance: number;
  consistency: number;
  timestamp: string;
  pending: boolean;
}

interface HealthDashboardProps {
  score: HealthScore;
  onRecompute: () => void;
  isLoading: boolean;
}

export default function HealthDashboard({ score, onRecompute, isLoading }: HealthDashboardProps) {
  const formatPct = (val: number) => `${Math.round(val * 100)}%`;

  const getScoreColor = (val: number) => {
    if (val >= 0.85) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (val >= 0.70) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  const getBarColorClass = (val: number) => {
    if (val >= 0.85) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]';
    if (val >= 0.70) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]';
    return 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]';
  };

  const dimensions = [
    {
      name: 'Coverage',
      desc: '% of hierarchy levels with at least one active node',
      value: score.coverage,
    },
    {
      name: 'Freshness',
      desc: '% of active nodes that are not review required or expired',
      value: score.freshness,
    },
    {
      name: 'Balance',
      desc: 'Type distribution variety (fact, decision, constraint, etc)',
      value: score.balance,
    },
    {
      name: 'Consistency',
      desc: '% of active nodes not flagged for review',
      value: score.consistency,
    },
  ];

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Knowledge Health Score
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time vitals representing governance quality</p>
        </div>

        <div className="flex items-center gap-3">
          {score.pending && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
              ⚠️ Review Pending
            </span>
          )}
          <button
            onClick={onRecompute}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all flex items-center gap-1.5 ${
              score.pending
                ? 'bg-amber-500 hover:bg-amber-600 active:scale-95 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700'
            } disabled:opacity-50`}
          >
            {isLoading ? (
              <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.228 9H18.01" />
              </svg>
            )}
            Recompute
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Overall score large display */}
        <div className="flex flex-col items-center justify-center pb-6 border-b border-slate-800/80">
          <div className="relative flex items-center justify-center">
            {/* Simple progress ring */}
            <svg className="w-28 h-28 transform -rotate-90">
              <circle cx="56" cy="56" r="48" className="stroke-slate-800" strokeWidth="6" fill="transparent" />
              <circle
                cx="56"
                cy="56"
                r="48"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 48}
                strokeDashoffset={2 * Math.PI * 48 * (1 - score.overall)}
                className={`transition-all duration-1000 ${
                  score.overall >= 0.85
                    ? 'text-emerald-500'
                    : score.overall >= 0.70
                    ? 'text-amber-500'
                    : 'text-rose-500'
                }`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {formatPct(score.overall)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Overall</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 text-center px-4 max-w-xs">
            Aggregated metric representing organizational knowledge hygiene
          </p>
        </div>

        {/* Individual bars */}
        <div className="w-full space-y-4">
          {dimensions.map((dim, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-200" title={dim.desc}>{dim.name}</span>
                <span className={`font-bold tabular-nums px-1.5 py-0.5 rounded ${getScoreColor(dim.value)}`}>
                  {formatPct(dim.value)}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${getBarColorClass(dim.value)}`}
                  style={{ width: `${Math.round(dim.value * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {score.pending && (
        <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-2.5">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-[11px] text-slate-300 leading-normal">
            <span className="font-semibold text-amber-400">Score recalculation is deferred.</span> Immediate scores are frozen during cascade changes to prevent visual alarm. Click &quot;Recompute&quot; above to calculate live stats.
          </div>
        </div>
      )}
    </div>
  );
}
