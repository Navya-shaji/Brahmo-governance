import React, { useState } from "react";
import type {
  KnowledgeNode,
  NodeType,
  NodeStatus,
  User,
  AuditLog,
} from "../types";

interface NodeDetailPanelProps {
  node: KnowledgeNode | null;
  currentUser: User;
  auditLogs: AuditLog[];
  onAction: (
    action: "CONFIRM" | "SUPERSEDE" | "EXPIRE" | "TRANSITION",
    metadata: {
      comment?: string;
      newTitle?: string;
      newContent?: string;
      newType?: NodeType;
      newImportance?: number;
      validUntil?: string;
      newStatus?: NodeStatus;
    },
  ) => Promise<void>;
  isLoading: boolean;
}

export default function NodeDetailPanel({
  node,
  currentUser,
  auditLogs,
  onAction,
  isLoading,
}: NodeDetailPanelProps) {
  const [activeForm, setActiveForm] = useState<
    "NONE" | "CONFIRM" | "SUPERSEDE" | "EXPIRE" | "HOLD"
  >("NONE");

  // Form fields
  const [comment, setComment] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<NodeType>("DECISION");
  const [newImportance, setNewImportance] = useState(0.8);
  const [validUntil, setValidUntil] = useState("");

  if (!node) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl h-full flex flex-col items-center justify-center text-slate-500 text-xs">
        <svg
          className="w-12 h-12 mb-3 text-slate-700"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
          />
        </svg>
        <span>
          Select any node in the cascade visualization to view details, enforce
          state changes, or complete a human review.
        </span>
      </div>
    );
  }

  const getTypeStyle = (type: NodeType) => {
    switch (type) {
      case "CONSTRAINT":
        return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "DECISION":
        return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      case "ANTI_PATTERN":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    }
  };

  const getStatusBadge = (status: NodeStatus) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-500 text-slate-950 font-extrabold shadow-[0_0_8px_rgba(16,185,129,0.3)]";
      case "REVIEW_REQUIRED":
        return "bg-amber-500 text-slate-950 font-extrabold shadow-[0_0_8px_rgba(245,158,11,0.3)] animate-pulse";
      case "SUPERSEDED":
        return "bg-slate-800 text-slate-400 border border-slate-700";
      case "EXPIRED":
        return "bg-rose-500/20 text-rose-400 border border-rose-500/30";
      case "LEGAL_HOLD":
        return "bg-indigo-500 text-white font-extrabold shadow-[0_0_8px_rgba(99,102,241,0.3)]";
    }
  };

  const initSupersedeForm = () => {
    setNewTitle(`${node.title} v3`);
    setNewContent(
      node.content
        .replace(/v2 \(2024\)/g, "v3 (2026)")
        .replace(/3 HOURS/g, "1 HOUR"),
    );
    setNewType(node.type);
    setNewImportance(node.importance);
    setValidUntil("");
    setComment(
      "Upgrading sepsis protocol to v3 clinical standard (lactate measurement within 1 hour).",
    );
    setActiveForm("SUPERSEDE");
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAction("CONFIRM", { comment });
    setComment("");
    setActiveForm("NONE");
  };

  const handleSupersedeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAction("SUPERSEDE", {
      comment,
      newTitle,
      newContent,
      newType,
      newImportance,
      validUntil: validUntil || undefined,
    });
    setComment("");
    setActiveForm("NONE");
  };

  const handleExpireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAction("EXPIRE", { comment });
    setComment("");
    setActiveForm("NONE");
  };

  const handleHoldSubmit = async (status: NodeStatus) => {
    await onAction("TRANSITION", {
      newStatus: status,
      comment:
        status === "LEGAL_HOLD"
          ? "Legal hold placed due to ongoing medical litigation."
          : "Legal hold released by hospital administration.",
    });
    setActiveForm("NONE");
  };

  const isOldNodeSuperseded = node.status === "SUPERSEDED";
  const isAdmin = currentUser.role === "ADMIN";

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl h-full flex flex-col overflow-y-auto max-h-[750px] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
      {/* Node Header */}
      <div className="border-b border-slate-800 pb-4 mb-4">
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono text-slate-500 font-bold">
                {node.id}
              </span>
              <span
                className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${getTypeStyle(node.type)}`}
              >
                {node.type}
              </span>
              <span
                className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${getStatusBadge(node.status)}`}
              >
                {node.status.replace("_", " ")}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-100 leading-snug">
              {node.title}
            </h3>
          </div>
        </div>
      </div>

      {/* Node Content */}
      <div className="mb-4 text-left">
        <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
          Content / Formula
        </h4>
        <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-205 leading-relaxed font-sans whitespace-pre-line">
          {node.content}
        </div>
      </div>

      {/* Node Metadata Row */}
      <div className="grid grid-cols-2 gap-4 mb-5 p-3.5 bg-slate-950/20 rounded-xl border border-slate-800 text-xs text-left">
        <div>
          <span className="text-slate-500 block mb-0.5 text-[10px]">
            Department
          </span>
          <span className="font-semibold text-slate-355 capitalize">
            {node.department || "General Hospital"}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block mb-0.5 text-[10px]">
            Importance Weighted
          </span>
          <span className="font-semibold text-slate-355">
            {node.importance.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block mb-0.5 text-[10px]">
            Created By
          </span>
          <span className="font-semibold text-slate-355">
            {node.created_by}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block mb-0.5 text-[10px]">
            Valid Until
          </span>
          <span className="font-semibold text-slate-355">
            {node.valid_until
              ? new Date(node.valid_until).toLocaleDateString()
              : "Never Expiable"}
          </span>
        </div>
      </div>

      {/* Actions Section */}
      {!isOldNodeSuperseded && activeForm === "NONE" && (
        <div className="space-y-3 mb-6">
          <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 text-left">
            Governance Actions
          </h4>

          {node.status === "REVIEW_REQUIRED" && (
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setActiveForm("CONFIRM")}
                disabled={isLoading}
                className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition-all shadow-[0_0_10px_rgba(16,185,129,0.15)] flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <span>✅</span>
                <span>Confirm Valid</span>
              </button>

              <button
                onClick={initSupersedeForm}
                disabled={isLoading}
                className="bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white font-bold text-xs py-2 px-3 rounded-lg transition-all shadow-[0_0_10px_rgba(99,102,241,0.15)] flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <span>🔄</span>
                <span>Supersede</span>
              </button>

              <button
                onClick={() => setActiveForm("EXPIRE")}
                disabled={isLoading}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-bold text-xs py-2 px-3 rounded-lg transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <span>⌛</span>
                <span>Mark Expired</span>
              </button>
            </div>
          )}

          {/* Trigger Cascade Action for Root Sepsis v2 */}
          {node.id === "N-M08" && node.status === "ACTIVE" && (
            <button
              onClick={initSupersedeForm}
              disabled={isLoading}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl transition-all shadow-[0_0_12px_rgba(99,102,241,0.25)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.228 9H18.01"
                />
              </svg>
              Supersede Sepsis v2 → v3 (Trigger Cascade)
            </button>
          )}

          {/* State Machine Transition: LEGAL_HOLD toggle */}
          <div className="flex gap-2 text-left">
            {node.status !== "LEGAL_HOLD" ? (
              <button
                onClick={() => handleHoldSubmit("LEGAL_HOLD")}
                disabled={isLoading || !isAdmin}
                title={
                  !isAdmin ? "Only Administrator can enforce Legal Hold" : ""
                }
                className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isAdmin
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-indigo-500/20 hover:border-indigo-500/40 active:scale-95"
                    : "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
                }`}
              >
                🔒 Place on Legal Hold {!isAdmin && "(Admin Only)"}
              </button>
            ) : (
              <button
                onClick={() => handleHoldSubmit("ACTIVE")}
                disabled={isLoading || !isAdmin}
                title={
                  !isAdmin ? "Only Administrator can release Legal Hold" : ""
                }
                className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isAdmin
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shadow-[0_0_10px_rgba(99,102,241,0.25)]"
                    : "bg-slate-900 text-slate-600 cursor-not-allowed"
                }`}
              >
                🔓 Release Legal Hold {!isAdmin && "(Admin Only)"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Review Forms */}
      {activeForm !== "NONE" && (
        <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-4 mb-6 text-left">
          <div className="flex justify-between items-center mb-3">
            <h5 className="text-xs font-bold text-slate-200">
              {activeForm === "CONFIRM" && "Confirm Protocol Valid"}
              {activeForm === "SUPERSEDE" &&
                "Supersede Node (Create New Version)"}
              {activeForm === "EXPIRE" && "Mark Protocol Expired"}
            </h5>
            <button
              onClick={() => setActiveForm("NONE")}
              className="text-[10px] text-slate-500 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {activeForm === "CONFIRM" && (
            <form onSubmit={handleConfirmSubmit} className="space-y-3">
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">
                  Reasoning / Comments
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Explain why this decision/fact is still valid despite the parent change..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  rows={3}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs py-2 rounded-lg cursor-pointer"
              >
                Submit Confirmation (Verify Active)
              </button>
            </form>
          )}

          {activeForm === "EXPIRE" && (
            <form onSubmit={handleExpireSubmit} className="space-y-3">
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">
                  Reason for Expiration
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Explain why this node is no longer relevant to the clinical workflow..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  rows={3}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs py-2 rounded-lg cursor-pointer"
              >
                Expire Node
              </button>
            </form>
          )}

          {activeForm === "SUPERSEDE" && (
            <form onSubmit={handleSupersedeSubmit} className="space-y-3.5">
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">
                  New Version Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">
                  New Content / Parameters
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">
                    Node Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as NodeType)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="CONSTRAINT">CONSTRAINT</option>
                    <option value="DECISION">DECISION</option>
                    <option value="ANTI_PATTERN">ANTI_PATTERN</option>
                    <option value="FACT">FACT</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">
                    Importance (0.0 - 1.0)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="1.0"
                    value={newImportance}
                    onChange={(e) =>
                      setNewImportance(parseFloat(e.target.value))
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">
                  Supersession Justification
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="State the reason for this upgrade..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  rows={2}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold text-xs py-2 rounded-lg transition-all cursor-pointer"
              >
                Confirm Replacement & Cascade
              </button>
            </form>
          )}
        </div>
      )}

      {/* Audit Log Timeline */}
      <div className="flex-1 mt-2 text-left">
        <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-3">
          Audit Trail / Node History
        </h4>

        {auditLogs.length === 0 ? (
          <p className="text-[10px] text-slate-650 italic">
            No logs recorded for this node.
          </p>
        ) : (
          <div className="relative border-l border-slate-800 ml-1.5 pl-4 space-y-4">
            {auditLogs.map((log, idx) => (
              <div key={log.id || idx} className="relative text-left">
                {/* Timeline circle indicator */}
                <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-900 border-2 border-indigo-500" />

                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                  <span className="text-slate-300">{log.action}</span>
                  <span className="font-mono text-slate-500 font-medium">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="text-[10px] text-slate-350 mt-0.5 leading-snug">
                  {log.reason}
                </p>

                <div className="flex items-center gap-1.5 text-[9px] text-slate-500 mt-1">
                  <span>
                    Actor:{" "}
                    <span className="font-semibold text-slate-400">
                      {log.actor_id}
                    </span>
                  </span>
                  {log.old_value && (
                    <span>
                      • Status:{" "}
                      <span className="font-semibold">{log.old_value}</span> →{" "}
                      <span className="font-semibold text-slate-400">
                        {log.new_value}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
