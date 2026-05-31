import React from 'react';
import type { KnowledgeNode, Edge, NodeType, NodeStatus } from '../types';

interface CascadeTreeProps {
  nodes: KnowledgeNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  rootId: string;
}

export default function CascadeTree({ nodes, edges, selectedNodeId, onSelectNode, rootId }: CascadeTreeProps) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Get children derived from a parent
  const getChildren = (parentId: string) => {
    return edges
      .filter(e => e.target_id === parentId && e.edge_type === 'DERIVED_FROM')
      .map(e => nodeMap.get(e.source_id))
      .filter((n): n is KnowledgeNode => n !== undefined);
  };

  const rootNode = nodeMap.get(rootId);
  const children = rootNode ? getChildren(rootNode.id) : [];

  const getTypeStyle = (type: NodeType) => {
    switch (type) {
      case 'CONSTRAINT':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'DECISION':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'ANTI_PATTERN':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
  };

  const getStatusBadge = (status: NodeStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500 text-slate-950 font-extrabold shadow-[0_0_8px_rgba(16,185,129,0.4)]';
      case 'REVIEW_REQUIRED':
        return 'bg-amber-500 text-slate-950 font-extrabold shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse';
      case 'SUPERSEDED':
        return 'bg-slate-700 text-slate-300 font-bold border border-slate-600';
      case 'EXPIRED':
        return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      case 'LEGAL_HOLD':
        return 'bg-indigo-500 text-white font-extrabold shadow-[0_0_8px_rgba(99,102,241,0.4)]';
    }
  };

  const renderNodeCard = (node: KnowledgeNode, depthLabel: string) => {
    const isSelected = selectedNodeId === node.id;
    return (
      <div
        key={node.id}
        onClick={() => onSelectNode(node.id)}
        className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group text-left ${
          isSelected
            ? 'bg-slate-800 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500'
            : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70 hover:shadow-lg'
        }`}
      >
        <div className="flex justify-between items-start gap-2 mb-1.5">
          <span className="text-[10px] font-mono text-slate-500 font-bold tracking-wider">{node.id}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-slate-950/60 text-slate-400 border border-slate-800">
            {depthLabel}
          </span>
        </div>
        <h4 className="text-xs font-bold text-slate-100 line-clamp-1 group-hover:text-white leading-snug">
          {node.title}
        </h4>
        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
          {node.content}
        </p>

        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800/50">
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${getTypeStyle(node.type)}`}>
            {node.type}
          </span>
          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${getStatusBadge(node.status)}`}>
            {node.status.replace('_', ' ')}
          </span>
          {node.superseded_by && (
            <span className="text-[9px] text-slate-500 font-mono ml-auto">
              → {node.superseded_by}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-x-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
          Cascade Visualization
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">Real-time status updates flowing down the derived graph</p>
      </div>

      {!rootNode ? (
        <div className="text-center py-10 text-slate-500 text-xs">
          No hierarchy loaded. Reset database to view Sepsis Protocol structure.
        </div>
      ) : (
        <div className="space-y-8 min-w-max text-center pb-4">
          {/* Depth 0: Root Protocol */}
          <div className="flex justify-center relative">
            <div className="w-[320px]">
              {renderNodeCard(rootNode, 'TRIGGER NODE')}
            </div>
            {/* Vertical connector out of root */}
            {children.length > 0 && (
              <div className="absolute top-full left-1/2 w-0.5 h-8 bg-slate-700 -translate-x-1/2" />
            )}
          </div>

          {/* Depth 1 & 2 */}
          {children.length > 0 && (
            <div className="relative pt-8">
              {/* Horizontal bar connecting children */}
              <div className="absolute top-0 left-[5%] right-[5%] h-0.5 bg-slate-700" />
              
              <div className="flex justify-center gap-6 items-start">
                {children.map(child => {
                  const grandchildren = getChildren(child.id);
                  return (
                    <div key={child.id} className="flex flex-col items-center gap-8 relative w-[260px]">
                      {/* Vertical line from horizontal connection */}
                      <div className="absolute -top-8 left-1/2 w-0.5 h-8 bg-slate-700 -translate-x-1/2" />

                      {/* Child Card */}
                      <div className="w-full relative">
                        {renderNodeCard(child, 'DEPTH 1')}
                        {/* Vertical line out of child */}
                        {grandchildren.length > 0 && (
                          <div className="absolute top-full left-1/2 w-0.5 h-8 bg-slate-700 -translate-x-1/2" />
                        )}
                      </div>

                      {/* Grandchildren Level */}
                      {grandchildren.length > 0 && (
                        <div className="w-full space-y-4 pt-8 relative">
                          {/* Horizontal line for grandchildren link */}
                          {grandchildren.length > 1 && (
                            <div className="absolute top-0 left-[20%] right-[20%] h-0.5 bg-slate-700" />
                          )}
                          {grandchildren.map(gc => (
                            <div key={gc.id} className="w-full relative">
                              <div className="absolute -top-8 left-1/2 w-0.5 h-8 bg-slate-700 -translate-x-1/2" />
                              {renderNodeCard(gc, 'DEPTH 2')}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
