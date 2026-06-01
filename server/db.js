const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const DB_FILE_PATH = path.join(__dirname, 'db.json');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const INITIAL_STATE = {
  organizations: [
    {
      id: 'supra',
      name: 'Supra Multi-Specialty Hospital',
      config: {
        cascade_max_depth: 3,
        health_score_weights: {
          coverage: 0.25,
          freshness: 0.30,
          balance: 0.20,
          consistency: 0.25
        }
      }
    }
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
    {
      id: 'N-M02', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'CONSTRAINT',
      title: 'Sepsis Protocol v1 (2022)',
      content: 'Supra Sepsis Bundle v1 (2022): lactate within 6 hours, antibiotics within 4 hours.',
      importance: 0.90, status: 'SUPERSEDED', superseded_by: 'N-M08', department: 'medicine',
      valid_until: null, created_by: 'U-MEERA', created_at: '2022-03-01T10:00:00+05:30'
    },
    {
      id: 'N-M08', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'DECISION',
      title: 'Sepsis Protocol v2 (2024)',
      content: 'Supra Sepsis Bundle v2 (2024): blood cultures before antibiotics, lactate within 3 HOURS, 30mL/kg crystalloid for hypotension.',
      importance: 0.95, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-MEERA', created_at: '2024-03-01T10:00:00+05:30'
    },
    {
      id: 'N-DRV-01', org_id: 'supra', hierarchy_level_id: 'HL-08-MED', type: 'DECISION',
      title: 'Lactate Monitoring Schedule',
      content: 'Lactate levels monitored per Sepsis v2 protocol: every 3 hours for suspected sepsis patients. ICU escalation if lactate > 4 mmol/L.',
      importance: 0.78, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-ANANYA', created_at: '2024-05-10T11:00:00+05:30'
    },
    {
      id: 'N-DRV-02', org_id: 'supra', hierarchy_level_id: 'HL-08-MED', type: 'DECISION',
      title: 'Night Shift Sepsis Screening',
      content: 'Night shift nurses screen for sepsis using qSOFA (based on Sepsis v2 parameters): altered mentation, RR >= 22, SBP <= 100.',
      importance: 0.75, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      created_by: 'U-MEERA', valid_until: null, created_at: '2024-06-20T08:00:00+05:30'
    },
    {
      id: 'N-DRV-03', org_id: 'supra', hierarchy_level_id: 'HL-08-MED', type: 'DECISION',
      title: 'Empiric Antibiotic Selection',
      content: 'Based on Sepsis v2 bundle: Piperacillin-Tazobactam 4.5g IV within 3-hour window. Culture-guided de-escalation at 72 hours.',
      importance: 0.82, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-MEERA', created_at: '2024-07-05T15:00:00+05:30'
    },
    {
      id: 'N-DRV-04', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'DECISION',
      title: 'ICU Admission from Sepsis Screening',
      content: 'Patients meeting 2/3 qSOFA criteria with lactate > 2 mmol/L: assess for ICU admission within 1 hour.',
      importance: 0.80, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-ANANYA', created_at: '2024-08-12T10:00:00+05:30'
    },
    {
      id: 'N-DRV-05', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'FACT',
      title: 'Sepsis Mortality Tracking',
      content: 'Supra sepsis mortality Q3 2024: 18% (national average 22%). Improvement attributed to v2 bundle compliance reaching 78%.',
      importance: 0.60, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-MEERA', created_at: '2024-10-01T09:00:00+05:30'
    },
    {
      id: 'N-DRV-06', org_id: 'supra', hierarchy_level_id: 'HL-10-MED', type: 'CONSTRAINT',
      title: 'Pharmacy Pre-Auth for IV Antibiotics',
      content: 'Per Sepsis v2 timing: pharmacy pre-authorizes Pip-Tazo for suspected sepsis. No approval delay within 3-hour window.',
      importance: 0.72, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-ANANYA', created_at: '2024-11-15T14:00:00+05:30'
    },
    {
      id: 'N-DRV-04-A', org_id: 'supra', hierarchy_level_id: 'HL-08-MED', type: 'DECISION',
      title: 'ICU Bed Reservation Protocol',
      content: 'Based on ICU admission criteria (N-DRV-04): reserve 2 ICU beds per shift for suspected sepsis admissions.',
      importance: 0.65, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-ANANYA', created_at: '2025-01-20T10:00:00+05:30'
    },
    {
      id: 'N-DRV-04-B', org_id: 'supra', hierarchy_level_id: 'HL-10-MED', type: 'FACT',
      title: 'ICU Occupancy from Sepsis Admissions',
      content: 'ICU sepsis admissions average 3 per week (2024). Peak: 7 in monsoon season (water-borne infections).',
      importance: 0.55, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-MEERA', created_at: '2025-02-15T09:00:00+05:30'
    },
    {
      id: 'N-DRV-02-A', org_id: 'supra', hierarchy_level_id: 'HL-10-MED', type: 'DECISION',
      title: 'Night Shift Escalation Timing',
      content: 'Night shift sepsis screening positive: call duty doctor within 15 minutes. If no response: escalate to HOD within 30 minutes.',
      importance: 0.70, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-ANANYA', created_at: '2025-03-01T08:00:00+05:30'
    },
    {
      id: 'N-HELD', org_id: 'supra', hierarchy_level_id: 'HL-08-MED', type: 'DECISION',
      title: 'Sepsis Bundle Compliance Audit Data',
      content: 'Compliance data under medico-legal review: v2 bundle adherence was 78% in Q3 2024. Two adverse outcomes under investigation.',
      importance: 0.75, status: 'LEGAL_HOLD', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-MEERA', created_at: '2024-09-01T10:00:00+05:30'
    },
    {
      id: 'N-M01', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'CONSTRAINT',
      title: 'Diabetic Fasting Protocol',
      content: 'Fasting diabetic patients: adjust insulin timing not dose. Skip Glimepiride on fast days.',
      importance: 0.90, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-MEERA', created_at: '2025-06-01T09:00:00+05:30'
    },
    {
      id: 'N-M03', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'ANTI_PATTERN',
      title: 'Insulin Sliding Scale Alone',
      content: 'Do NOT use sliding scale as sole glycemic management. Always include basal insulin.',
      importance: 0.87, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-ANANYA', created_at: '2025-07-15T14:00:00+05:30'
    },
    {
      id: 'N-M04', org_id: 'supra', hierarchy_level_id: 'HL-08-MED', type: 'ANTI_PATTERN',
      title: 'Fasting Glucose Only for Diabetic Monitoring',
      content: 'Do NOT rely on fasting glucose alone for diabetic monitoring. Always order HbA1c every 3 months.',
      importance: 0.80, status: 'ACTIVE', superseded_by: null, department: 'medicine',
      valid_until: null, created_by: 'U-MEERA', created_at: '2025-05-10T11:00:00+05:30'
    },
    {
      id: 'N-O01', org_id: 'supra', hierarchy_level_id: 'HL-05-ORTHO', type: 'CONSTRAINT',
      title: 'DVT Prophylaxis Protocol',
      content: 'ALL ortho surgical patients: Enoxaparin 40mg SC daily. TKR 14d, THR 28d.',
      importance: 0.93, status: 'ACTIVE', superseded_by: null, department: 'ortho',
      valid_until: null, created_by: 'U-VIKRAM', created_at: '2025-04-01T10:00:00+05:30'
    },
    {
      id: 'N-O02', org_id: 'supra', hierarchy_level_id: 'HL-08-ORTHO', type: 'DECISION',
      title: 'Paracetamol First-Line Post-TKR',
      content: 'Paracetamol 650mg QDS first-line. Tramadol if VAS > 6. No NSAIDs.',
      importance: 0.88, status: 'ACTIVE', superseded_by: null, department: 'ortho',
      valid_until: null, created_by: 'U-VIKRAM', created_at: '2025-01-20T11:00:00+05:30'
    },
    {
      id: 'N-O03', org_id: 'supra', hierarchy_level_id: 'HL-08-ORTHO', type: 'DECISION',
      title: 'PT Within 24 Hours Post-TKR',
      content: 'Physiotherapy must begin within 24 hours of TKR. Day 1: ankle pumps.',
      importance: 0.90, status: 'ACTIVE', superseded_by: null, department: 'ortho',
      valid_until: null, created_by: 'U-VIKRAM', created_at: '2025-03-10T08:00:00+05:30'
    },
    {
      id: 'N-O04', org_id: 'supra', hierarchy_level_id: 'HL-10-ORTHO', type: 'FACT',
      title: 'Ortho Ward Capacity',
      content: 'Ortho Ward: 45 beds. 85-90% occupancy. Overflow to Medicine in winter.',
      importance: 0.50, status: 'ACTIVE', superseded_by: null, department: 'ortho',
      valid_until: null, created_by: 'U-VIKRAM', created_at: '2025-05-01T09:00:00+05:30'
    },
    {
      id: 'N-EXP', org_id: 'supra', hierarchy_level_id: 'HL-05-MED', type: 'FACT',
      title: 'Antibiotic Sensitivity Report Q2 2024',
      content: 'E. coli sensitivity to Pip-Tazo: 89%. K. pneumoniae: 72%. Based on 2024 Q2 data.',
      importance: 0.55, status: 'EXPIRED', superseded_by: null, department: 'medicine',
      valid_until: '2025-01-01T00:00:00+05:30', created_by: 'U-MEERA', created_at: '2024-07-01T09:00:00+05:30'
    }
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
    {
      id: 'A-INIT-1', node_id: 'N-M02', action: 'CREATE', old_value: null, new_value: 'ACTIVE',
      actor_id: 'U-MEERA', org_id: 'supra', reason: 'Initial setup of Sepsis v1',
      metadata: {}, timestamp: '2022-03-01T10:00:00+05:30'
    },
    {
      id: 'A-INIT-2', node_id: 'N-M08', action: 'SUPERSEDE', old_value: 'N-M02', new_value: 'N-M08',
      actor_id: 'U-MEERA', org_id: 'supra', reason: 'Upgrade Sepsis Protocol to v2',
      metadata: {}, timestamp: '2024-03-01T10:00:00+05:30'
    }
  ],
  pulse_alerts: [],
  health_scores: {}
};

function readDB() {
  if (!fs.existsSync(DB_FILE_PATH)) {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(INITIAL_STATE, null, 2), 'utf-8');
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }
  try {
    const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to read database, resetting to initial state', err);
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }
}

function writeDB(state) {
  // Always write to local JSON as fallback/cache
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');

  // Background sync to Supabase if configured
  if (supabase) {
    syncToSupabase(state).catch(err => console.error("Supabase sync failed:", err));
  }
}

async function syncToSupabase(state) {
  // Upsert all entities
  if (state.organizations.length > 0) await supabase.from('organizations').upsert(state.organizations);
  if (state.users.length > 0) await supabase.from('users').upsert(state.users);
  if (state.hierarchy_levels.length > 0) await supabase.from('hierarchy_levels').upsert(state.hierarchy_levels);
  if (state.knowledge_nodes.length > 0) await supabase.from('knowledge_nodes').upsert(state.knowledge_nodes);
  if (state.edges.length > 0) await supabase.from('edges').upsert(state.edges);
  
  // For append-only tables, we should ideally only insert new records.
  // For simplicity in this assessment architecture, we UPSERT by ID.
  if (state.audit_log && state.audit_log.length > 0) await supabase.from('audit_logs').upsert(state.audit_log);
  if (state.pulse_alerts && state.pulse_alerts.length > 0) await supabase.from('pulse_alerts').upsert(state.pulse_alerts);
}

// Calculate health score synchronously from the state.
// As per assessment spec, all 4 dimensions are computed ORG-WIDE using all nodes
// in the organization (org_id = 'supra'), not filtered to a single department.
// The department param is kept for the API signature / health_scores cache key only.
function calculateHealthScoreSync(state, department, pending = false) {
  // --- ORG-WIDE node and level pools (assessment formula scope) ---
  const orgId = 'supra';
  const allOrgNodes = state.knowledge_nodes.filter(n => n.org_id === orgId);
  const allOrgLevels = state.hierarchy_levels.filter(l => l.org_id === orgId);

  if (allOrgNodes.length === 0) {
    return { overall: 1.0, coverage: 1.0, freshness: 1.0, balance: 1.0, consistency: 1.0, timestamp: new Date().toISOString(), pending, department };
  }

  // 1. Coverage: % of ALL org hierarchy levels that have >= 1 populated node
  //    "Populated" = ACTIVE or REVIEW_REQUIRED (still valid knowledge at that level)
  //    Assessment expects coverage UNCHANGED after cascade: "No nodes removed, levels still populated"
  //    Only SUPERSEDED/EXPIRED truly depopulate a level
  const populatedNodes = allOrgNodes.filter(n => n.status === 'ACTIVE' || n.status === 'REVIEW_REQUIRED');
  const populatedLevelIds = new Set(populatedNodes.map(n => n.hierarchy_level_id).filter(id => id !== null));
  const totalLevelsCount = allOrgLevels.length;                         // 8
  const coverage = totalLevelsCount > 0 ? populatedLevelIds.size / totalLevelsCount : 1.0;

  // 2. Freshness: ACTIVE (and not expiring) / (ACTIVE + REVIEW_REQUIRED) org-wide
  //    EXPIRED nodes are excluded from the denominator
  const activeOrRR = allOrgNodes.filter(n => n.status === 'ACTIVE' || n.status === 'REVIEW_REQUIRED');
  const freshNodes = allOrgNodes.filter(n =>
    n.status === 'ACTIVE' &&
    (n.valid_until === null || new Date(n.valid_until).getTime() > Date.now())
  );
  const freshness = activeOrRR.length > 0 ? freshNodes.length / activeOrRR.length : 1.0;

  // 3. Balance: type distribution health (penalises homogeneity) org-wide
  //    balance = 1 - stddev(type_counts) / avg(type_counts)
  const types = ['CONSTRAINT', 'DECISION', 'ANTI_PATTERN', 'FACT'];
  const counts = types.map(t => allOrgNodes.filter(n => n.type === t).length);
  const avgCount = counts.reduce((sum, c) => sum + c, 0) / counts.length;

  let balance = 1.0;
  if (avgCount > 0) {
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - avgCount, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    balance = Math.max(0, 1.0 - (stdDev / avgCount));
  }

  // 4. Consistency: ACTIVE / (ACTIVE + REVIEW_REQUIRED) org-wide
  //    REVIEW_REQUIRED nodes = inconsistency signal
  const activeCount = allOrgNodes.filter(n => n.status === 'ACTIVE').length;
  const rrCount = allOrgNodes.filter(n => n.status === 'REVIEW_REQUIRED').length;
  const consistency = (activeCount + rrCount) > 0 ? activeCount / (activeCount + rrCount) : 1.0;

  // Weighted Overall (from org config)
  const weights = { coverage: 0.25, freshness: 0.30, balance: 0.20, consistency: 0.25 };
  const overall = (coverage * weights.coverage) + (freshness * weights.freshness) +
                  (balance * weights.balance) + (consistency * weights.consistency);

  return { overall, coverage, freshness, balance, consistency, timestamp: new Date().toISOString(), pending, department };
}

const db = {
  reset: () => {
    const state = JSON.parse(JSON.stringify(INITIAL_STATE));
    state.health_scores['medicine'] = calculateHealthScoreSync(state, 'medicine', false);
    state.health_scores['ortho'] = calculateHealthScoreSync(state, 'ortho', false);
    writeDB(state);
    return state;
  },

  getOrganizations: () => readDB().organizations,
  getHierarchyLevels: () => readDB().hierarchy_levels,
  getUsers: () => readDB().users,

  getUser: (id) => readDB().users.find(u => u.id === id),

  getNodes: (department) => {
    const nodes = readDB().knowledge_nodes;
    if (department) return nodes.filter(n => n.department === department);
    return nodes;
  },

  getNode: (id) => readDB().knowledge_nodes.find(n => n.id === id),

  insertNode: (node) => {
    const state = readDB();
    state.knowledge_nodes.push(node);
    writeDB(state);
  },

  updateNode: (id, updates) => {
    const state = readDB();
    const idx = state.knowledge_nodes.findIndex(n => n.id === id);
    if (idx !== -1) {
      state.knowledge_nodes[idx] = { ...state.knowledge_nodes[idx], ...updates };
      writeDB(state);
    }
  },

  getEdges: () => readDB().edges,

  insertEdge: (edge) => {
    const state = readDB();
    state.edges.push(edge);
    writeDB(state);
  },

  getAuditLogs: (nodeId) => {
    const logs = readDB().audit_log;
    if (nodeId) return logs.filter(l => l.node_id === nodeId);
    return [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  insertAuditLog: (log) => {
    const state = readDB();
    const newLog = {
      ...log,
      id: 'A-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      timestamp: new Date().toISOString()
    };
    state.audit_log.push(newLog);
    writeDB(state);
  },

  getAlerts: (userId) => {
    const alerts = readDB().pulse_alerts;
    const sorted = [...alerts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (userId) return sorted.filter(a => a.user_id === userId);
    return sorted;
  },

  insertAlert: (alert) => {
    const state = readDB();
    const newAlert = {
      ...alert,
      id: 'PL-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      is_read: false,
      created_at: new Date().toISOString()
    };
    state.pulse_alerts.push(newAlert);
    writeDB(state);
  },

  markAlertRead: (alertId) => {
    const state = readDB();
    const alert = state.pulse_alerts.find(a => a.id === alertId);
    if (alert) {
      alert.is_read = true;
      writeDB(state);
    }
  },

  markAllAlertsRead: (userId) => {
    const state = readDB();
    state.pulse_alerts.forEach(a => {
      if (a.user_id === userId) a.is_read = true;
    });
    writeDB(state);
  },

  getHealthScore: (department) => {
    const state = readDB();
    if (!state.health_scores[department]) {
      state.health_scores[department] = calculateHealthScoreSync(state, department, false);
      writeDB(state);
    }
    return state.health_scores[department];
  },

  setHealthScorePending: (department) => {
    const state = readDB();
    if (state.health_scores[department]) {
      state.health_scores[department].pending = true;
      writeDB(state);
    }
  },

  recomputeHealthScore: (department) => {
    const state = readDB();
    const newScore = calculateHealthScoreSync(state, department, false);

    const oldScoreObj = state.health_scores[department];
    if (oldScoreObj && !oldScoreObj.pending) {
      const oldScore = Math.round(oldScoreObj.overall * 100);
      const newScorePercent = Math.round(newScore.overall * 100);
      if (newScorePercent < oldScore && newScorePercent < 75) {
        const users = state.users.filter(u => u.department === department && (u.role === 'HOD' || u.role === 'EDITOR'));
        users.forEach(u => {
          state.pulse_alerts.push({
            id: 'PL-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
            org_id: 'supra', user_id: u.id, alert_type: 'HEALTH_DROP', severity: 'WARNING',
            title: `Health score dropped from ${oldScore}% to ${newScorePercent}%`,
            body: `Knowledge base quality for ${department} department has decreased. Freshness: ${Math.round(newScore.freshness * 100)}%, Consistency: ${Math.round(newScore.consistency * 100)}%.`,
            link: null, is_read: false, created_at: new Date().toISOString()
          });
        });
      }
    }

    state.health_scores[department] = newScore;
    writeDB(state);
    return newScore;
  },

  initDB: async () => {
    if (!supabase) {
      if (!fs.existsSync(DB_FILE_PATH)) db.reset();
      return;
    }

    try {
      console.log("Fetching state from Supabase...");
      const { data: orgs } = await supabase.from('organizations').select('*');
      
      if (!orgs || orgs.length === 0) {
        console.log("Supabase is empty. Seeding from INITIAL_STATE...");
        await syncToSupabase(INITIAL_STATE);
        fs.writeFileSync(DB_FILE_PATH, JSON.stringify(INITIAL_STATE, null, 2), 'utf-8');
        return;
      }

      const { data: users } = await supabase.from('users').select('*');
      const { data: levels } = await supabase.from('hierarchy_levels').select('*');
      const { data: nodes } = await supabase.from('knowledge_nodes').select('*');
      const { data: edges } = await supabase.from('edges').select('*');
      const { data: logs } = await supabase.from('audit_logs').select('*');
      const { data: alerts } = await supabase.from('pulse_alerts').select('*');

      const loadedState = {
        organizations: orgs || [],
        users: users || [],
        hierarchy_levels: levels || [],
        knowledge_nodes: nodes || [],
        edges: edges || [],
        audit_log: logs || [],
        pulse_alerts: alerts || [],
        health_scores: {} // Transient state, gets recomputed
      };

      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(loadedState, null, 2), 'utf-8');
      console.log("Supabase state successfully loaded into memory.");
    } catch (err) {
      console.error("Failed to init from Supabase. Falling back to local db.json.", err);
      if (!fs.existsSync(DB_FILE_PATH)) db.reset();
    }
  }
};

module.exports = { db };
