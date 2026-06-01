import React from "react";
import type { PulseAlert } from "../types";

interface PulseAlertsProps {
  alerts: PulseAlert[];
  onMarkRead: (alertId: string) => void;
  onMarkAllRead: () => void;
  onSelectNode: (nodeId: string) => void;
}

export default function PulseAlerts({
  alerts,
  onMarkRead,
  onMarkAllRead,
  onSelectNode,
}: PulseAlertsProps) {
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "URGENT":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "WARNING":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      default:
        return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "URGENT":
        return (
          <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/10 text-rose-500 font-bold text-xs">
            ⛔
          </span>
        );
      case "WARNING":
        return (
          <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 font-bold text-xs">
            ⚠️
          </span>
        );
      default:
        return (
          <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-sky-500/10 text-sky-500 font-bold text-xs">
            ℹ️
          </span>
        );
    }
  };

  const handleAlertClick = (alert: PulseAlert) => {
    if (alert.link) {
      // e.g. '/nodes/N-DRV-01' -> extract 'N-DRV-01'
      const parts = alert.link.split("/");
      const nodeId = parts[parts.length - 1];
      if (nodeId) {
        onSelectNode(nodeId);
      }
    }
    if (!alert.is_read) {
      onMarkRead(alert.id);
    }
  };

  const unreadAlerts = alerts.filter((a) => !a.is_read);

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Pulse Alerts
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Targeted notifications routed by role
          </p>
        </div>

        {unreadAlerts.length > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-[10px] uppercase font-bold tracking-wider text-slate-400 hover:text-white transition-all bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 max-h-[420px] pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500 text-xs">
            <svg
              className="w-8 h-8 mb-2 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span>No notifications yet.</span>
            <span>Alerts route here when governance changes happen.</span>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => handleAlertClick(alert)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                alert.is_read
                  ? "bg-slate-900/20 border-slate-900/60 opacity-60 hover:opacity-90"
                  : "bg-slate-800/40 border-slate-800 hover:border-slate-700 shadow-md hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-start gap-3">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3
                      className={`flex-1 min-w-0 text-xs font-bold truncate leading-tight ${alert.is_read ? "text-slate-400" : "text-slate-100"}`}
                    >
                      {alert.title}
                    </h3>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${getSeverityStyles(alert.severity)}`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] mt-1 leading-normal ${alert.is_read ? "text-slate-500" : "text-slate-300"}`}
                  >
                    {alert.body}
                  </p>

                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-[9px] text-slate-500 font-medium">
                      {new Date(alert.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {alert.link && (
                      <span className="text-[10px] text-indigo-400 font-semibold hover:underline flex items-center gap-0.5">
                        Inspect Node
                        <svg
                          className="w-2.5 h-2.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
