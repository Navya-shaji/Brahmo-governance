import React, { useState, useEffect } from 'react';
import HealthDashboard from './components/HealthDashboard';
import PulseAlerts from './components/PulseAlerts';
import CascadeTree from './components/CascadeTree';
import NodeDetailPanel from './components/NodeDetailPanel';
import type { KnowledgeNode, Edge, User, AuditLog, PulseAlert } from './types';

export default function App() {
  // Application state
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [alerts, setAlerts] = useState<PulseAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeDept, setActiveDept] = useState<'medicine' | 'ortho'>('medicine');
  const [healthScore, setHealthScore] = useState<any>({
    overall: 0.86,
    coverage: 0.82,
    freshness: 0.91,
    balance: 0.78,
    consistency: 0.92,
    pending: false,
    timestamp: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [sysLogs, setSysLogs] = useState<string[]>([]);

  // System logging helper
  const logSys = (msg: string) => {
    setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 15));
  };

  // Fetch initial data
  const fetchData = async (department: 'medicine' | 'ortho') => {
    try {
      setIsLoading(true);
      // Fetch users
      const usersRes = await fetch('/api/users');
      const usersData = await usersRes.json();
      if (usersData.success) {
        setUsers(usersData.users);
        if (!currentUser && usersData.users.length > 0) {
          // Default to Dr. Meera (HOD Medicine)
          const meera = usersData.users.find((u: User) => u.id === 'U-MEERA') || usersData.users[0];
          setCurrentUser(meera);
        }
      }

      // Fetch all nodes
      const nodesRes = await fetch('/api/nodes');
      const nodesData = await nodesRes.json();
      if (nodesData.success) {
        setNodes(nodesData.nodes);
      }

      // Fetch edges
      const edgesRes = await fetch('/api/edges');
      const edgesData = await edgesRes.json();
      if (edgesData.success) {
        setEdges(edgesData.edges);
      }

      // Fetch health score for current department
      const healthRes = await fetch(`/api/health?department=${department}`);
      const healthData = await healthRes.json();
      if (healthData.success) {
        setHealthScore(healthData.score);
      }

      // Fetch audit logs
      const auditRes = await fetch('/api/audit');
      const auditData = await auditRes.json();
      if (auditData.success) {
        setAuditLogs(auditData.auditLogs);
      }

    } catch (err: any) {
      logSys(`Error loading data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load alerts when user swaps
  useEffect(() => {
    if (currentUser) {
      fetch(`/api/alerts?userId=${currentUser.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) setAlerts(data.alerts);
        });
      logSys(`Simulating role change to ${currentUser.name} (${currentUser.role})`);
    }
  }, [currentUser]);

  // Load data on load and when dept changes
  useEffect(() => {
    fetchData(activeDept);
  }, [activeDept]);

  // Handle recomputing health score
  const handleRecompute = async () => {
    try {
      setIsLoading(true);
      logSys(`Forcing health score recalculation for ${activeDept} department...`);
      const res = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: activeDept })
      });
      const data = await res.json();
      if (data.success) {
        setHealthScore(data.score);
        logSys(`Recalculation complete. Overall score: ${Math.round(data.score.overall * 100)}%`);
        // Refresh alert list as recompute might have triggered warnings
        if (currentUser) {
          const alertsRes = await fetch(`/api/alerts?userId=${currentUser.id}`);
          const alertsData = await alertsRes.json();
          if (alertsData.success) setAlerts(alertsData.alerts);
        }
      }
    } catch (err: any) {
      logSys(`Recalculation failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset database helper
  const handleReset = async () => {
    try {
      setIsLoading(true);
      logSys('Resetting database to seed state...');
      const res = await fetch('/api/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        logSys('Database reset complete. Graph state refreshed.');
        setSelectedNodeId(null);
        setActiveDept('medicine');
        // Reload all data
        await fetchData('medicine');
      }
    } catch (err: any) {
      logSys(`Reset failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Alert Read
  const handleMarkAlertRead = async (alertId: string) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId })
      });
      const data = await res.json();
      if (data.success) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
      }
    } catch (err: any) {
      logSys(`Failed to mark alert read: ${err.message}`);
    }
  };

  // Handle Mark All Alerts Read
  const handleMarkAllAlertsRead = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, markAll: true })
      });
      const data = await res.json();
      if (data.success) {
        setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
        logSys('All alerts marked read.');
      }
    } catch (err: any) {
      logSys(`Failed to mark all read: ${err.message}`);
    }
  };

  // Handle Node Actions (Reviews, Transitions, Supersessions)
  const handleNodeAction = async (action: string, metadata: any) => {
    if (!currentUser || !selectedNodeId) return;
    try {
      setIsLoading(true);
      logSys(`Executing action "${action}" on node ${selectedNodeId}...`);
      
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          nodeId: selectedNodeId,
          actorId: currentUser.id,
          ...metadata
        })
      });
      
      const data = await res.json();
      if (data.success) {
        logSys(`Action completed successfully. status updated.`);
        // Reload all data to propagate states
        await fetchData(activeDept);
        
        if (data.newNodeId) {
          setSelectedNodeId(data.newNodeId);
          logSys(`Created new replacement node: ${data.newNodeId}`);
        }
      } else {
        logSys(`Action rejected: ${data.error}`);
        alert(`Action Rejected: ${data.error}`);
      }
    } catch (err: any) {
      logSys(`Action failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Scenario 1: The Sepsis Cascade Trigger
  const triggerSepsisCascade = async () => {
    if (!currentUser) return;
    try {
      setIsLoading(true);
      logSys('Initiating Sepsis Protocol v2 -> v3 Supersession cascade...');
      
      const res = await fetch('/api/cascade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supersededNodeId: 'N-M08',
          newTitle: 'Sepsis Protocol v3 (2026)',
          newContent: 'Supra Sepsis Bundle v3 (2026): blood cultures before antibiotics, lactate measurement within 1 HOUR, 30mL/kg crystalloid for hypotension.',
          newType: 'DECISION',
          newImportance: 0.95,
          actorId: currentUser.id
        })
      });

      const data = await res.json();
      if (data.success) {
        const updated = data.affectedNodes.filter((r: any) => r.action === 'TRANSITION' || r.newStatus === 'REVIEW_REQUIRED').length || data.affectedNodes.filter((r: any) => r.action === 'UPDATED').length;
        const skippedHold = data.affectedNodes.filter((r: any) => r.action === 'SKIPPED_HOLD').length;
        const skippedOld = data.affectedNodes.filter((r: any) => r.action === 'SKIPPED_SUPERSEDED').length;
        
        logSys(`Sepsis Cascade complete: ${updated} nodes set to REVIEW_REQUIRED, ${skippedHold} LEGAL_HOLD nodes skipped, ${skippedOld} SUPERSEDED nodes skipped.`);
        
        // Refresh everything
        await fetchData('medicine');
        setSelectedNodeId(data.newNode.id);
      } else {
        logSys(`Cascade failed: ${data.error}`);
        alert(`Cascade failed: ${data.error}`);
      }
    } catch (err: any) {
      logSys(`Cascade request failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Surprise Test: Orthopaedics Cascade (Scenario 5)
  const triggerOrthoCascade = async () => {
    if (!currentUser) return;
    try {
      setIsLoading(true);
      logSys('Initiating Surprise Test: Superseding DVT Prophylaxis Protocol (N-O01) in Ortho...');
      
      const res = await fetch('/api/cascade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supersededNodeId: 'N-O01',
          newTitle: 'DVT Prophylaxis Protocol v2',
          newContent: 'ALL ortho surgical patients: Enoxaparin 40mg SC daily (v2). TKR 10d (tightened from 14d), THR 28d.',
          newType: 'CONSTRAINT',
          newImportance: 0.93,
          actorId: currentUser.id
        })
      });

      const data = await res.json();
      if (data.success) {
        const updated = data.affectedNodes.filter((r: any) => r.action === 'TRANSITION' || r.newStatus === 'REVIEW_REQUIRED').length || data.affectedNodes.filter((r: any) => r.action === 'UPDATED').length;
        logSys(`Ortho Cascade complete: ${updated} derived nodes flagged in Orthopaedics.`);
        
        // Refresh ortho data
        setActiveDept('ortho');
        await fetchData('ortho');
        setSelectedNodeId(data.newNode.id);
      } else {
        logSys(`Ortho Cascade failed: ${data.error}`);
        alert(`Ortho Cascade failed: ${data.error}`);
      }
    } catch (err: any) {
      logSys(`Ortho Cascade request failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;
  const filteredAuditLogs = auditLogs.filter(log => log.node_id === selectedNodeId);

  // Department node root mappings
  const deptRootMap: Record<string, string> = {
    medicine: 'N-M08',
    ortho: 'N-O01'
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Header Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            B
          </div>
          <div className="text-left">
            <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
              BRAHMO <span className="text-slate-500 font-normal">|</span> <span className="text-indigo-400 font-bold bg-indigo-500/5 px-2 py-0.5 rounded text-xs border border-indigo-500/10">Governance Engine</span>
            </h1>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium tracking-wide uppercase">Cascade Invalidation • Vitals Health Score • Pulse Alerts</p>
          </div>
        </div>

        {/* Top Actions: User selection, Reset */}
        <div className="flex items-center flex-wrap gap-3">
          {/* User Role Simulation Select */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs font-semibold">Simulate User:</span>
            <select
              value={currentUser?.id || ''}
              onChange={e => {
                const u = users.find(x => x.id === e.target.value);
                if (u) setCurrentUser(u);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer hover:bg-slate-850 transition-all"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Reset DB */}
          <button
            onClick={handleReset}
            className="bg-slate-900 hover:bg-slate-850 active:scale-95 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Reset
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 max-w-[1600px] mx-auto w-full">
        {/* Left Column: Health score + Pulse Alerts */}
        <div className="xl:col-span-3 flex flex-col gap-6">
          <HealthDashboard
            score={healthScore}
            onRecompute={handleRecompute}
            isLoading={isLoading}
          />
          <PulseAlerts
            alerts={alerts}
            onMarkRead={handleMarkAlertRead}
            onMarkAllRead={handleMarkAllAlertsRead}
            onSelectNode={setSelectedNodeId}
          />

          {/* Simulation / Testing Panel */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl hidden lg:block">
            <h3 className="text-xs uppercase font-extrabold text-slate-500 tracking-wider mb-3 text-left">Governance Scenarios</h3>
            <div className="space-y-3.5">
              <div className="p-3 bg-slate-950/30 border border-slate-800/80 rounded-xl text-left">
                <h4 className="text-xs font-bold text-slate-200">Scenario 1: Sepsis Protocol Update</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                  Simulate Dr. Meera superseding Sepsis v2 → v3. This triggers a cascade setting derived nodes to REVIEW_REQUIRED, skips compliance node (LEGAL_HOLD), and alerts doctors.
                </p>
                <button
                  onClick={triggerSepsisCascade}
                  disabled={isLoading || currentUser?.id !== 'U-MEERA'}
                  className={`mt-2.5 w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    currentUser?.id === 'U-MEERA'
                      ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_0_8px_rgba(99,102,241,0.2)] active:scale-95'
                      : 'bg-slate-900 text-slate-650 cursor-not-allowed border border-slate-800'
                  }`}
                >
                  ⚡ Run Scenario 1 (Sepsis Cascade)
                </button>
                {currentUser?.id !== 'U-MEERA' && (
                  <span className="text-[9px] text-amber-500 mt-1 block">Simulate Dr. Meera (HOD Medicine) to trigger this scenario.</span>
                )}
              </div>

              <div className="p-3 bg-slate-950/30 border border-slate-800/80 rounded-xl text-left">
                <h4 className="text-xs font-bold text-slate-200">Scenario 5: Surprise Ortho Cascade</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                  Simulate Dr. Vikram updating the Ortho DVT Prophylaxis protocol. Test graph boundaries, visited set, and alerts routing to Ortho doctors (not Medicine).
                </p>
                <button
                  onClick={triggerOrthoCascade}
                  disabled={isLoading || currentUser?.id !== 'U-VIKRAM'}
                  className={`mt-2.5 w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    currentUser?.id === 'U-VIKRAM'
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.2)] active:scale-95'
                      : 'bg-slate-900 text-slate-655 cursor-not-allowed border border-slate-800'
                  }`}
                >
                  ⚡ Run Scenario 5 (Surprise Test)
                </button>
                {currentUser?.id !== 'U-VIKRAM' && (
                  <span className="text-[9px] text-cyan-500 mt-1 block">Simulate Dr. Vikram (HOD Ortho) to trigger this scenario.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column: Cascade Tree Visualization */}
        <div className={`${selectedNode ? 'xl:col-span-6' : 'xl:col-span-9'} flex flex-col gap-6 transition-all duration-300`}>
          {/* Department Tabs */}
          <div className="flex border border-slate-800 bg-slate-950/40 p-1.5 rounded-xl max-w-md mx-auto w-full">
            <button
              onClick={() => {
                setActiveDept('medicine');
                setSelectedNodeId(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDept === 'medicine'
                  ? 'bg-slate-800 text-white shadow-[0_0_8px_rgba(0,0,0,0.4)] border border-slate-750'
                  : 'text-slate-400 hover:text-slate-250'
              }`}
            >
              Medicine Department
            </button>
            <button
              onClick={() => {
                setActiveDept('ortho');
                setSelectedNodeId(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDept === 'ortho'
                  ? 'bg-slate-800 text-white shadow-[0_0_8px_rgba(0,0,0,0.4)] border border-slate-750'
                  : 'text-slate-400 hover:text-slate-250'
              }`}
            >
              Orthopaedics Department
            </button>
          </div>

          <CascadeTree
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            rootId={deptRootMap[activeDept]}
          />

          {/* System Console Logs */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider mb-2 flex items-center justify-between">
              <span>System Event Console</span>
              <span className="text-[9px] text-slate-600 font-normal">Diagnostic logs</span>
            </h3>
            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 h-[100px] overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1.5 text-left scrollbar-thin scrollbar-thumb-slate-900">
              {sysLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-6">Ready. Operations will log here.</div>
              ) : (
                sysLogs.map((log, idx) => (
                  <div key={idx} className="truncate select-all" title={log}>{log}</div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Node Details Inspector & Action Buttons */}
        {selectedNode && (
          <div className="xl:col-span-3 transition-all duration-300">
            <NodeDetailPanel
              node={selectedNode}
              currentUser={currentUser || users[0]}
              auditLogs={filteredAuditLogs}
              onAction={handleNodeAction}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>

      {/* Footer bar */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-[10px] text-slate-600">
        BRAHMO Governance Framework • Active Org: Supra Multi-Specialty Hospital • Max Cascade Depth: 3
      </footer>
    </main>
  );
}
