const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { db } = require('./db');
const { validateTransition, runCascade, reviewNode } = require('./governance');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://brahmo-governance.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 1. Nodes API
app.get('/api/nodes', async (req, res) => {
  try {
    const dept = req.query.department || undefined;
    const nodes = await db.getNodes(dept);
    res.json({ success: true, nodes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/nodes', async (req, res) => {
  try {
    const { action, nodeId, actorId, ...metadata } = req.body;
    if (!nodeId || !actorId) return res.status(400).json({ success: false, error: 'Missing nodeId or actorId' });

    const node = await db.getNode(nodeId);
    if (!node) return res.status(404).json({ success: false, error: 'Node not found' });

    const user = await db.getUser(actorId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    if (action === 'TRANSITION') {
      const { newStatus, comment } = metadata;
      if (!newStatus) return res.status(400).json({ success: false, error: 'Missing newStatus for transition' });

      const check = validateTransition(node.status, newStatus, user.role);
      if (!check.valid) return res.status(400).json({ success: false, error: check.error });

      const oldStatus = node.status;
      await db.updateNode(nodeId, { status: newStatus });

      let logAction = 'STATUS_CHANGE';
      if (newStatus === 'LEGAL_HOLD') logAction = 'LEGAL_HOLD';
      else if (oldStatus === 'LEGAL_HOLD') logAction = 'LEGAL_RELEASE';

      await db.insertAuditLog({ node_id: nodeId, action: logAction, old_value: oldStatus, new_value: newStatus, actor_id: actorId, org_id: node.org_id, reason: comment || `Status transition from ${oldStatus} to ${newStatus}`, metadata: {} });
      if (node.department) await db.recomputeHealthScore(node.department);
      return res.json({ success: true, oldStatus, newStatus });
    }

    const result = await reviewNode(nodeId, action, actorId, metadata);
    if (!result.success) return res.status(400).json({ success: false, error: result.error });
    return res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Health API
app.get('/api/health', async (req, res) => {
  try {
    const department = req.query.department;
    if (!department) return res.status(400).json({ success: false, error: 'Missing department parameter' });
    const recompute = req.query.recompute === 'true';
    const score = recompute ? await db.recomputeHealthScore(department) : await db.getHealthScore(department);
    return res.json({ success: true, score });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/health', async (req, res) => {
  try {
    const { department } = req.body;
    if (!department) return res.status(400).json({ success: false, error: 'Missing department parameter' });
    const score = await db.recomputeHealthScore(department);
    return res.json({ success: true, score });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Alerts API
app.get('/api/alerts', async (req, res) => {
  try {
    const userId = req.query.userId || undefined;
    const alerts = await db.getAlerts(userId);
    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/alerts', async (req, res) => {
  try {
    const { alertId, userId, markAll = false } = req.body;
    if (markAll && userId) {
      await db.markAllAlertsRead(userId);
      return res.json({ success: true, message: 'All alerts marked read' });
    }
    if (!alertId) return res.status(400).json({ success: false, error: 'Missing alertId' });
    await db.markAlertRead(alertId);
    return res.json({ success: true, message: 'Alert marked read' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Audit API
app.get('/api/audit', async (req, res) => {
  try {
    const nodeId = req.query.nodeId || undefined;
    const auditLogs = await db.getAuditLogs(nodeId);
    res.json({ success: true, auditLogs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Cascade API
app.post('/api/cascade', async (req, res) => {
  try {
    const { supersededNodeId, newTitle, newContent, newType, newImportance, validUntil, actorId, triggerCascade = true } = req.body;
    if (!supersededNodeId || !newTitle || !newContent || !actorId) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    const oldNode = await db.getNode(supersededNodeId);
    if (!oldNode) return res.status(404).json({ success: false, error: 'Superseded node not found' });

    const actor = await db.getUser(actorId);
    if (!actor) return res.status(404).json({ success: false, error: 'Actor not found' });

    const check = validateTransition(oldNode.status, 'SUPERSEDED', actor.role);
    if (!check.valid) return res.status(400).json({ success: false, error: check.error });

    const newId = 'N-M' + Math.floor(100 + Math.random() * 900);
    const newNode = {
      id: newId, org_id: oldNode.org_id, hierarchy_level_id: oldNode.hierarchy_level_id,
      type: newType || oldNode.type, title: newTitle, content: newContent,
      importance: newImportance !== undefined ? newImportance : oldNode.importance,
      status: 'ACTIVE', superseded_by: null, department: oldNode.department,
      valid_until: validUntil || null, created_by: actorId, created_at: new Date().toISOString()
    };

    await db.insertNode(newNode);
    await db.updateNode(supersededNodeId, { status: 'SUPERSEDED', superseded_by: newId });

    await db.insertEdge({ id: 'E-' + Math.random().toString(36).substring(2, 9).toUpperCase(), source_id: newId, target_id: supersededNodeId, edge_type: 'SUPERSEDES', created_at: new Date().toISOString() });

    const allEdges = await db.getEdges();
    const existingParentEdges = allEdges.filter(e => e.source_id === supersededNodeId && e.edge_type === 'DERIVED_FROM');
    for (const pe of existingParentEdges) {
      await db.insertEdge({ id: 'E-' + Math.random().toString(36).substring(2, 9).toUpperCase(), source_id: newId, target_id: pe.target_id, edge_type: 'DERIVED_FROM', created_at: new Date().toISOString() });
    }

    await db.insertAuditLog({ node_id: supersededNodeId, action: 'SUPERSEDE', old_value: oldNode.status, new_value: 'SUPERSEDED', actor_id: actorId, org_id: oldNode.org_id, reason: `Superseded by new node ${newId}`, metadata: { new_node_id: newId } });
    await db.insertAuditLog({ node_id: newId, action: 'CREATE', old_value: null, new_value: 'ACTIVE', actor_id: actorId, org_id: oldNode.org_id, reason: `Created to supersede ${supersededNodeId}`, metadata: { supersedes_node_id: supersededNodeId } });

    let affectedNodes = [];
    if (triggerCascade) {
      affectedNodes = await runCascade(supersededNodeId, newId, actorId, `Cascade triggered from superseding ${supersededNodeId}`);
    } else {
      if (oldNode.department) await db.recomputeHealthScore(oldNode.department);
    }

    res.json({ success: true, newNode, affectedNodes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Users API
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.getUsers();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Edges API
app.get('/api/edges', async (req, res) => {
  try {
    const edges = await db.getEdges();
    res.json({ success: true, edges });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Reset API
app.post('/api/reset', async (req, res) => {
  try {
    const state = await db.reset();
    res.json({ success: true, message: 'Database reset successfully', state });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve React client static assets in production
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }
  const indexPath = path.join(clientBuildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('BRAHMO Governance Server is running. Client assets not yet built.');
  }
});

// Start Express App
db.initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`BRAHMO Governance Express Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to initialize database", err);
});
