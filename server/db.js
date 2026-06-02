require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Health score is computed in-memory (not stored in Supabase) ──────────────
const healthScoreCache = {};

function calculateHealthScore(nodes, levels, department, pending = false) {
  const orgId = 'supra';
  const allOrgNodes = nodes.filter(n => n.org_id === orgId);
  const allOrgLevels = levels.filter(l => l.org_id === orgId);

  if (allOrgNodes.length === 0) {
    return { overall: 1.0, coverage: 1.0, freshness: 1.0, balance: 1.0, consistency: 1.0, timestamp: new Date().toISOString(), pending, department };
  }

  const populatedNodes = allOrgNodes.filter(n => n.status === 'ACTIVE' || n.status === 'REVIEW_REQUIRED');
  const populatedLevelIds = new Set(populatedNodes.map(n => n.hierarchy_level_id).filter(Boolean));
  const coverage = allOrgLevels.length > 0 ? populatedLevelIds.size / allOrgLevels.length : 1.0;

  const activeOrRR = allOrgNodes.filter(n => n.status === 'ACTIVE' || n.status === 'REVIEW_REQUIRED');
  const freshNodes = allOrgNodes.filter(n =>
    n.status === 'ACTIVE' && (n.valid_until === null || new Date(n.valid_until).getTime() > Date.now())
  );
  const freshness = activeOrRR.length > 0 ? freshNodes.length / activeOrRR.length : 1.0;

  const types = ['CONSTRAINT', 'DECISION', 'ANTI_PATTERN', 'FACT'];
  const counts = types.map(t => allOrgNodes.filter(n => n.type === t).length);
  const avgCount = counts.reduce((s, c) => s + c, 0) / counts.length;
  let balance = 1.0;
  if (avgCount > 0) {
    const variance = counts.reduce((s, c) => s + Math.pow(c - avgCount, 2), 0) / counts.length;
    balance = Math.max(0, 1.0 - Math.sqrt(variance) / avgCount);
  }

  const activeCount = allOrgNodes.filter(n => n.status === 'ACTIVE').length;
  const rrCount = allOrgNodes.filter(n => n.status === 'REVIEW_REQUIRED').length;
  const consistency = (activeCount + rrCount) > 0 ? activeCount / (activeCount + rrCount) : 1.0;

  const weights = { coverage: 0.25, freshness: 0.30, balance: 0.20, consistency: 0.25 };
  const overall = (coverage * weights.coverage) + (freshness * weights.freshness) +
                  (balance * weights.balance) + (consistency * weights.consistency);

  return { overall, coverage, freshness, balance, consistency, timestamp: new Date().toISOString(), pending, department };
}

// ── INITIAL SEED DATA ────────────────────────────────────────────────────────
const INITIAL_STATE = {
  organizations: [
    { id: 'supra', name: 'Supra Multi-Specialty Hospital', config: { cascade_max_depth: 3, health_score_weights: { coverage: 0.25, freshness: 0.30, balance: 0.20, consistency: 0.25 } } }
  ],
  hierarchy_levels: [
    { id: 'HL-01', org_id: 'supra', level_number: 1, level_name: 'Hospital', department: null },
    { id: 'HL-03', org_id: 'supra', level_number: 3, level_name: 'Clinical Division', department: null },
    { id: 'HL-05-MED', org_id: 'supra', level_number: 5, level_name: 'Gen Medicine Dept', department: 'medicine' },
    { id: 'HL-05-ORTHO', org_id: 'supra', level_number: 5, level_name: 'Orthopaedics Dept', department: 'ortho' },
    { id: 'HL-08-MED', org_id: 'supra', level_number: 8, level_name: 'Medicine General', department: 'medicine' },
    { id: 'HL-08-ORTHO', org_id: 'supra', level_number: 8, level_name: 'Ortho General', department: 'ortho' },
    { id: 'HL-10-MED', org_id: 'supra', level_number: 10, level_name: 'Medicine Ward', department: 'medicine' },
    { id: 'HL-10-ORTHO', org_id: 'supra', level_number: 10, level_name: 'Ortho Ward', department: 'ortho' }
  ],
  users: [
    { id: 'U-MEERA', org_id: 'supra', name: 'Dr. Meera (HOD Medicine)', role: 'HOD', department: 'medicine' },
    { id: 'U-ANANYA', org_id: 'supra', name: 'Dr. Ananya (Junior)', role: 'EDITOR', department: 'medicine' },
    { id: 'U-VIKRAM', org_id: 'supra', name: 'Dr. Vikram (HOD Ortho)', role: 'HOD', department: 'ortho' },
    { id: 'U-PRIYA', org_id: 'supra', name: 'Nurse Priya', role: 'VIEWER', department: 'ortho' },
    { id: 'U-SURESH', org_id: 'supra', name: 'Admin Suresh', role: 'ADMIN', department: 'admin' }
  ],
  knowledge_nodes: [
    { id: 'N-M02', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'CONSTRAINT', title: 'Sepsis Protocol v1 (2022)', content: 'Supra Sepsis Bundle v1 (2022): lactate within 6 hours, antibiotics within 4 hours.', importance: 0.90, status: 'SUPERSEDED', superseded_by: 'N-M08', department: 'medicine', valid_until: null, created_by: 'U-MEERA', created_at: '2022-03-01T10:00:00+05:30' },
    { id: 'N-M08', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'DECISION', title: 'Sepsis Protocol v2 (2024)', content: 'Supra Sepsis Bundle v2 (2024): blood cultures before antibiotics, lactate within 3 HOURS, 30mL/kg crystalloid for hypotension.', importance: 0.95, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-MEERA', created_at: '2024-03-01T10:00:00+05:30' },
    { id: 'N-DRV-01', org_id: 'supra', hierarchy_level_id: 'HL-08-MED', type: 'DECISION', title: 'Lactate Monitoring Schedule', content: 'Lactate levels monitored per Sepsis v2 protocol: every 3 hours for suspected sepsis patients. ICU escalation if lactate > 4 mmol/L.', importance: 0.78, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-ANANYA', created_at: '2024-05-10T11:00:00+05:30' },
    { id: 'N-DRV-02', org_id: 'supra', hierarchy_level_id: 'HL-08-MED', type: 'DECISION', title: 'Night Shift Sepsis Screening', content: 'Night shift nurses screen for sepsis using qSOFA (based on Sepsis v2 parameters): altered mentation, RR >= 22, SBP <= 100.', importance: 0.75, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-MEERA', created_at: '2024-06-20T08:00:00+05:30' },
    { id: 'N-DRV-03', org_id: 'supra', hierarchy_level_id: 'HL-08-MED', type: 'DECISION', title: 'Empiric Antibiotic Selection', content: 'Based on Sepsis v2 bundle: Piperacillin-Tazobactam 4.5g IV within 3-hour window. Culture-guided de-escalation at 72 hours.', importance: 0.82, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-MEERA', created_at: '2024-07-05T15:00:00+05:30' },
    { id: 'N-DRV-04', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'DECISION', title: 'ICU Admission from Sepsis Screening', content: 'Patients meeting 2/3 qSOFA criteria with lactate > 2 mmol/L: assess for ICU admission within 1 hour.', importance: 0.80, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-ANANYA', created_at: '2024-08-12T10:00:00+05:30' },
    { id: 'N-DRV-05', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'FACT', title: 'Sepsis Mortality Tracking', content: 'Supra sepsis mortality Q3 2024: 18% (national average 22%). Improvement attributed to v2 bundle compliance reaching 78%.', importance: 0.60, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-MEERA', created_at: '2024-10-01T09:00:00+05:30' },
    { id: 'N-DRV-06', org_id: 'supra', hierarchy_level_id: 'HL-10-MED', type: 'CONSTRAINT', title: 'Pharmacy Pre-Auth for IV Antibiotics', content: 'Per Sepsis v2 timing: pharmacy pre-authorizes Pip-Tazo for suspected sepsis. No approval delay within 3-hour window.', importance: 0.72, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-ANANYA', created_at: '2024-11-15T14:00:00+05:30' },
    { id: 'N-DRV-04-A', org_id: 'supra', hierarchy_level_id: 'HL-08-MED', type: 'DECISION', title: 'ICU Bed Reservation Protocol', content: 'Based on ICU admission criteria (N-DRV-04): reserve 2 ICU beds per shift for suspected sepsis admissions.', importance: 0.65, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-ANANYA', created_at: '2025-01-20T10:00:00+05:30' },
    { id: 'N-DRV-04-B', org_id: 'supra', hierarchy_level_id: 'HL-10-MED', type: 'FACT', title: 'ICU Occupancy from Sepsis Admissions', content: 'ICU sepsis admissions average 3 per week (2024). Peak: 7 in monsoon season (water-borne infections).', importance: 0.55, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-MEERA', created_at: '2025-02-15T09:00:00+05:30' },
    { id: 'N-DRV-02-A', org_id: 'supra', hierarchy_level_id: 'HL-10-MED', type: 'DECISION', title: 'Night Shift Escalation Timing', content: 'Night shift sepsis screening positive: call duty doctor within 15 minutes. If no response: escalate to HOD within 30 minutes.', importance: 0.70, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-ANANYA', created_at: '2025-03-01T08:00:00+05:30' },
    { id: 'N-HELD', org_id: 'supra', hierarchy_level_id: 'HL-08-MED', type: 'DECISION', title: 'Sepsis Bundle Compliance Audit Data', content: 'Compliance data under medico-legal review: v2 bundle adherence was 78% in Q3 2024. Two adverse outcomes under investigation.', importance: 0.75, status: 'LEGAL_HOLD', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-MEERA', created_at: '2024-09-01T10:00:00+05:30' },
    { id: 'N-M01', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'CONSTRAINT', title: 'Diabetic Fasting Protocol', content: 'Fasting diabetic patients: adjust insulin timing not dose. Skip Glimepiride on fast days.', importance: 0.90, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-MEERA', created_at: '2025-06-01T09:00:00+05:30' },
    { id: 'N-M03', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'ANTI_PATTERN', title: 'Insulin Sliding Scale Alone', content: 'Do NOT use sliding scale as sole glycemic management. Always include basal insulin.', importance: 0.87, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-ANANYA', created_at: '2025-07-15T14:00:00+05:30' },
    { id: 'N-M04', org_id: 'supra', hierarchy_level_id: 'HL-08-MED', type: 'ANTI_PATTERN', title: 'Fasting Glucose Only for Diabetic Monitoring', content: 'Do NOT rely on fasting glucose alone for diabetic monitoring. Always order HbA1c every 3 months.', importance: 0.80, status: 'ACTIVE', superseded_by: null, department: 'medicine', valid_until: null, created_by: 'U-MEERA', created_at: '2025-05-10T11:00:00+05:30' },
    { id: 'N-O01', org_id: 'supra', hierarchy_level_id: 'HL-05-ORTHO', type: 'CONSTRAINT', title: 'DVT Prophylaxis Protocol', content: 'ALL ortho surgical patients: Enoxaparin 40mg SC daily. TKR 14d, THR 28d.', importance: 0.93, status: 'ACTIVE', superseded_by: null, department: 'ortho', valid_until: null, created_by: 'U-VIKRAM', created_at: '2025-04-01T10:00:00+05:30' },
    { id: 'N-O02', org_id: 'supra', hierarchy_level_id: 'HL-08-ORTHO', type: 'DECISION', title: 'Paracetamol First-Line Post-TKR', content: 'Paracetamol 650mg QDS first-line. Tramadol if VAS > 6. No NSAIDs.', importance: 0.88, status: 'ACTIVE', superseded_by: null, department: 'ortho', valid_until: null, created_by: 'U-VIKRAM', created_at: '2025-01-20T11:00:00+05:30' },
    { id: 'N-O03', org_id: 'supra', hierarchy_level_id: 'HL-08-ORTHO', type: 'DECISION', title: 'PT Within 24 Hours Post-TKR', content: 'Physiotherapy must begin within 24 hours of TKR. Day 1: ankle pumps.', importance: 0.90, status: 'ACTIVE', superseded_by: null, department: 'ortho', valid_until: null, created_by: 'U-VIKRAM', created_at: '2025-03-10T08:00:00+05:30' },
    { id: 'N-O04', org_id: 'supra', hierarchy_level_id: 'HL-10-ORTHO', type: 'FACT', title: 'Ortho Ward Capacity', content: 'Ortho Ward: 45 beds. 85-90% occupancy. Overflow to Medicine in winter.', importance: 0.50, status: 'ACTIVE', superseded_by: null, department: 'ortho', valid_until: null, created_by: 'U-VIKRAM', created_at: '2025-05-01T09:00:00+05:30' },
    { id: 'N-EXP', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'FACT', title: 'Antibiotic Sensitivity Report Q2 2024', content: 'E. coli sensitivity to Pip-Tazo: 89%. K. pneumoniae: 72%. Based on 2024 Q2 data.', importance: 0.55, status: 'EXPIRED', superseded_by: null, department: 'medicine', valid_until: '2025-01-01T00:00:00+05:30', created_by: 'U-MEERA', created_at: '2024-07-01T09:00:00+05:30' }
  ],
  edges: [
    { id: 'E-01', source_id: 'N-DRV-01', target_id: 'N-M08', edge_type: 'DERIVED_FROM', created_at: '2024-05-10T11:00:00+05:30' },
    { id: 'E-02', source_id: 'N-DRV-02', target_id: 'N-M08', edge_type: 'DERIVED_FROM', created_at: '2024-06-20T08:00:00+05:30' },
    { id: 'E-03', source_id: 'N-DRV-03', target_id: 'N-M08', edge_type: 'DERIVED_FROM', created_at: '2024-07-05T15:00:00+05:30' },
    { id: 'E-04', source_id: 'N-DRV-04', target_id: 'N-M08', edge_type: 'DERIVED_FROM', created_at: '2024-08-12T10:00:00+05:30' },
    { id: 'E-05', source_id: 'N-DRV-05', target_id: 'N-M08', edge_type: 'DERIVED_FROM', created_at: '2024-10-01T09:00:00+05:30' },
    { id: 'E-06', source_id: 'N-DRV-06', target_id: 'N-M08', edge_type: 'DERIVED_FROM', created_at: '2024-11-15T14:00:00+05:30' },
    { id: 'E-07', source_id: 'N-DRV-04-A', target_id: 'N-DRV-04', edge_type: 'DERIVED_FROM', created_at: '2025-01-20T10:00:00+05:30' },
    { id: 'E-08', source_id: 'N-DRV-04-B', target_id: 'N-DRV-04', edge_type: 'DERIVED_FROM', created_at: '2025-02-15T09:00:00+05:30' },
    { id: 'E-09', source_id: 'N-DRV-02-A', target_id: 'N-DRV-02', edge_type: 'DERIVED_FROM', created_at: '2025-03-01T08:00:00+05:30' },
    { id: 'E-10', source_id: 'N-HELD', target_id: 'N-M08', edge_type: 'DERIVED_FROM', created_at: '2024-09-01T10:00:00+05:30' },
    { id: 'E-11', source_id: 'N-M01', target_id: 'N-DRV-01', edge_type: 'SUPPORTS', created_at: '2025-06-01T09:00:00+05:30' },
    { id: 'E-12', source_id: 'N-O01', target_id: 'N-O02', edge_type: 'SUPPORTS', created_at: '2025-04-01T10:00:00+05:30' },
    { id: 'E-13', source_id: 'N-O02', target_id: 'N-O01', edge_type: 'DERIVED_FROM', created_at: '2025-01-20T11:00:00+05:30' },
    { id: 'E-14', source_id: 'N-O03', target_id: 'N-O01', edge_type: 'DERIVED_FROM', created_at: '2025-03-10T08:00:00+05:30' },
    { id: 'E-15', source_id: 'N-M08', target_id: 'N-M02', edge_type: 'SUPERSEDES', created_at: '2024-03-01T10:00:00+05:30' }
  ],
  audit_log: [
    { id: 'A-INIT-1', node_id: 'N-M02', action: 'CREATE', old_value: null, new_value: 'ACTIVE', actor_id: 'U-MEERA', org_id: 'supra', reason: 'Initial setup of Sepsis v1', metadata: {}, timestamp: '2022-03-01T10:00:00+05:30' },
    { id: 'A-INIT-2', node_id: 'N-M08', action: 'SUPERSEDE', old_value: 'N-M02', new_value: 'N-M08', actor_id: 'U-MEERA', org_id: 'supra', reason: 'Upgrade Sepsis Protocol to v2', metadata: {}, timestamp: '2024-03-01T10:00:00+05:30' }
  ]
};

// ── DB API — all reads/writes go directly to Supabase ───────────────────────
const db = {

  initDB: async () => {
    console.log('Checking Supabase connection...');
    const { data: orgs, error } = await supabase.from('organizations').select('*');
    if (error) throw new Error(`Supabase connection failed: ${error.message}`);

    if (!orgs || orgs.length === 0) {
      console.log('Supabase is empty. Seeding from INITIAL_STATE...');
      const upsert = async (table, data) => {
        if (!data || data.length === 0) return;
        const { error } = await supabase.from(table).upsert(data);
        if (error) console.error(`Seed failed [${table}]:`, error.message);
        else console.log(`  ✓ ${table}: ${data.length} rows`);
      };
      await upsert('organizations', INITIAL_STATE.organizations);
      await upsert('users', INITIAL_STATE.users);
      await upsert('hierarchy_levels', INITIAL_STATE.hierarchy_levels);
      await upsert('knowledge_nodes', INITIAL_STATE.knowledge_nodes);
      await upsert('edges', INITIAL_STATE.edges);
      await upsert('audit_logs', INITIAL_STATE.audit_log);
      console.log('Supabase seeded successfully.');
    } else {
      console.log('Supabase data found. Ready.');
    }
  },

  reset: async () => {
    // Delete all rows from each table in correct dependency order
    await supabase.from('pulse_alerts').delete().gte('created_at', '2000-01-01');
    await supabase.from('audit_logs').delete().gte('timestamp', '2000-01-01');
    await supabase.from('edges').delete().neq('id', '');
    await supabase.from('knowledge_nodes').delete().neq('id', '');
    await supabase.from('hierarchy_levels').delete().neq('id', '');
    await supabase.from('users').delete().neq('id', '');
    await supabase.from('organizations').delete().neq('id', '');

    // Re-insert seed data
    await supabase.from('organizations').insert(INITIAL_STATE.organizations);
    await supabase.from('users').insert(INITIAL_STATE.users);
    await supabase.from('hierarchy_levels').insert(INITIAL_STATE.hierarchy_levels);
    await supabase.from('knowledge_nodes').insert(INITIAL_STATE.knowledge_nodes);
    await supabase.from('edges').insert(INITIAL_STATE.edges);
    await supabase.from('audit_logs').insert(INITIAL_STATE.audit_log);

    // Clear health score cache
    Object.keys(healthScoreCache).forEach(k => delete healthScoreCache[k]);
    console.log('Database reset to initial state.');
    return INITIAL_STATE;
  },

  getOrganizations: async () => {
    const { data } = await supabase.from('organizations').select('*');
    return data || [];
  },

  getHierarchyLevels: async () => {
    const { data } = await supabase.from('hierarchy_levels').select('*');
    return data || [];
  },

  getUsers: async () => {
    const { data } = await supabase.from('users').select('*');
    return data || [];
  },

  getUser: async (id) => {
    const { data } = await supabase.from('users').select('*').eq('id', id).single();
    return data || null;
  },

  getNodes: async (department) => {
    let query = supabase.from('knowledge_nodes').select('*');
    if (department) query = query.eq('department', department);
    const { data } = await query;
    return data || [];
  },

  getNode: async (id) => {
    const { data } = await supabase.from('knowledge_nodes').select('*').eq('id', id).single();
    return data || null;
  },

  insertNode: async (node) => {
    const { error } = await supabase.from('knowledge_nodes').insert(node);
    if (error) throw new Error(`insertNode failed: ${error.message}`);
  },

  updateNode: async (id, updates) => {
    const { error } = await supabase.from('knowledge_nodes').update(updates).eq('id', id);
    if (error) throw new Error(`updateNode failed: ${error.message}`);
  },

  getEdges: async () => {
    const { data } = await supabase.from('edges').select('*');
    return data || [];
  },

  insertEdge: async (edge) => {
    const { error } = await supabase.from('edges').insert(edge);
    if (error) throw new Error(`insertEdge failed: ${error.message}`);
  },

  getAuditLogs: async (nodeId) => {
    let query = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
    if (nodeId) query = query.eq('node_id', nodeId);
    const { data } = await query;
    return data || [];
  },

  insertAuditLog: async (log) => {
    const newLog = {
      ...log,
      id: 'A-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      timestamp: new Date().toISOString()
    };
    const { error } = await supabase.from('audit_logs').insert(newLog);
    if (error) throw new Error(`insertAuditLog failed: ${error.message}`);
  },

  getAlerts: async (userId) => {
    let query = supabase.from('pulse_alerts').select('*').order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data } = await query;
    return data || [];
  },

  insertAlert: async (alert) => {
    const newAlert = {
      ...alert,
      id: 'PL-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      is_read: false,
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from('pulse_alerts').insert(newAlert);
    if (error) throw new Error(`insertAlert failed: ${error.message}`);
  },

  markAlertRead: async (alertId) => {
    await supabase.from('pulse_alerts').update({ is_read: true }).eq('id', alertId);
  },

  markAllAlertsRead: async (userId) => {
    await supabase.from('pulse_alerts').update({ is_read: true }).eq('user_id', userId);
  },

  getHealthScore: async (department) => {
    if (healthScoreCache[department]) return healthScoreCache[department];
    return db.recomputeHealthScore(department);
  },

  setHealthScorePending: async (department) => {
    if (healthScoreCache[department]) {
      healthScoreCache[department].pending = true;
    }
  },

  recomputeHealthScore: async (department) => {
    const [nodes, levels] = await Promise.all([db.getNodes(), db.getHierarchyLevels()]);
    const newScore = calculateHealthScore(nodes, levels, department, false);

    const oldScore = healthScoreCache[department];
    if (oldScore && !oldScore.pending) {
      const oldPct = Math.round(oldScore.overall * 100);
      const newPct = Math.round(newScore.overall * 100);
      if (newPct < oldPct && newPct < 75) {
        const users = await db.getUsers();
        const targets = users.filter(u => u.department === department && (u.role === 'HOD' || u.role === 'EDITOR'));
        for (const u of targets) {
          await db.insertAlert({
            org_id: 'supra', user_id: u.id, alert_type: 'HEALTH_DROP', severity: 'WARNING',
            title: `Health score dropped from ${oldPct}% to ${newPct}%`,
            body: `Knowledge base quality for ${department} department has decreased. Freshness: ${Math.round(newScore.freshness * 100)}%, Consistency: ${Math.round(newScore.consistency * 100)}%.`,
            link: null
          });
        }
      }
    }

    healthScoreCache[department] = newScore;
    return newScore;
  }
};

module.exports = { db };
