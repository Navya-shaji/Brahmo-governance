const { db } = require('./db');

// 1. Status Transition State Machine Validation
function validateTransition(oldStatus, newStatus, userRole) {
  // SUPERSEDED is terminal
  if (oldStatus === 'SUPERSEDED') {
    return { valid: false, error: 'Cannot transition from SUPERSEDED. It is a terminal state.' };
  }

  // LEGAL_HOLD is frozen - only ADMIN can release
  if (oldStatus === 'LEGAL_HOLD' && userRole !== 'ADMIN') {
    return { valid: false, error: 'Node is under LEGAL_HOLD. Only ADMIN can release it.' };
  }

  // Only ADMIN can put a node on LEGAL_HOLD
  if (newStatus === 'LEGAL_HOLD' && userRole !== 'ADMIN') {
    return { valid: false, error: 'Only ADMIN can place a node on LEGAL_HOLD.' };
  }

  // Check valid paths
  switch (oldStatus) {
    case 'ACTIVE':
      if (['SUPERSEDED', 'REVIEW_REQUIRED', 'EXPIRED', 'LEGAL_HOLD'].includes(newStatus)) return { valid: true };
      break;
    case 'REVIEW_REQUIRED':
      if (['ACTIVE', 'SUPERSEDED', 'EXPIRED', 'LEGAL_HOLD'].includes(newStatus)) return { valid: true };
      break;
    case 'EXPIRED':
      if (['ACTIVE', 'SUPERSEDED', 'LEGAL_HOLD'].includes(newStatus)) return { valid: true };
      break;
    case 'LEGAL_HOLD':
      if (['ACTIVE', 'REVIEW_REQUIRED', 'EXPIRED', 'SUPERSEDED'].includes(newStatus)) return { valid: true };
      break;
  }

  return { valid: false, error: `Invalid transition from ${oldStatus} to ${newStatus}.` };
}

// 2. Cascade Invalidation Engine (Bounded BFS on DERIVED_FROM edges)
function runCascade(supersededNodeId, newNodeId, actorId, reason = 'Protocol update supersession') {
  const actor = db.getUser(actorId);
  if (!actor) throw new Error(`Actor ${actorId} not found`);

  const supersededNode = db.getNode(supersededNodeId);
  if (!supersededNode) throw new Error(`Superseded node ${supersededNodeId} not found`);

  // Configure depth bound
  const orgs = db.getOrganizations();
  const org = orgs.find(o => o.id === supersededNode.org_id);
  const maxDepth = org?.config?.cascade_max_depth ?? 3;

  // Track state
  const queue = [];
  const visited = new Set();
  const affectedResults = [];

  visited.add(supersededNodeId);

  // Find direct children via DERIVED_FROM edges
  const allEdges = db.getEdges();
  const directEdges = allEdges.filter(e => e.target_id === supersededNodeId && e.edge_type === 'DERIVED_FROM');

  directEdges.forEach(e => {
    queue.push({ nodeId: e.source_id, depth: 1 });
  });

  // Log the cascade trigger
  db.insertAuditLog({
    node_id: supersededNodeId,
    action: 'CASCADE_TRIGGER',
    old_value: supersededNode.status,
    new_value: 'SUPERSEDED',
    actor_id: actorId,
    org_id: supersededNode.org_id,
    reason: `Cascade invalidation triggered by superseding ${supersededNodeId} with ${newNodeId}`,
    metadata: { new_node_id: newNodeId }
  });

  // Walk graph (BFS)
  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift();

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    if (depth > maxDepth) continue;

    const node = db.getNode(nodeId);
    if (!node) continue;

    const oldStatus = node.status;
    let newStatus = oldStatus;
    let action = 'UPDATED';

    if (oldStatus === 'LEGAL_HOLD') {
      action = 'SKIPPED_HOLD';
      db.insertAuditLog({
        node_id: nodeId,
        action: 'CASCADE_SKIP',
        old_value: oldStatus,
        new_value: oldStatus,
        actor_id: 'SYSTEM',
        org_id: node.org_id,
        reason: `Node ${nodeId} skipped during cascade: LEGAL_HOLD status prevents status change.`,
        metadata: { depth, trigger_node_id: supersededNodeId }
      });
    } else if (oldStatus === 'SUPERSEDED') {
      action = 'SKIPPED_SUPERSEDED';
    } else if (oldStatus === 'REVIEW_REQUIRED') {
      action = 'UPDATED';
    } else {
      newStatus = 'REVIEW_REQUIRED';
      db.updateNode(nodeId, { status: newStatus });
      db.insertAuditLog({
        node_id: nodeId,
        action: 'STATUS_CHANGE',
        old_value: oldStatus,
        new_value: newStatus,
        actor_id: actorId,
        org_id: node.org_id,
        reason: `Cascade invalidation: derived from superseded node ${supersededNodeId}`,
        metadata: { depth, trigger_node_id: supersededNodeId }
      });
    }

    affectedResults.push({
      id: nodeId, title: node.title, type: node.type,
      department: node.department, oldStatus, newStatus, depth, action
    });

    // Find children for next depth level
    if (depth < maxDepth) {
      const childEdges = allEdges.filter(e => e.target_id === nodeId && e.edge_type === 'DERIVED_FROM');
      childEdges.forEach(e => {
        queue.push({ nodeId: e.source_id, depth: depth + 1 });
      });
    }
  }

  // Defer Health Score Recomputation
  const affectedDepts = new Set();
  if (supersededNode.department) affectedDepts.add(supersededNode.department);
  affectedResults.forEach(r => {
    if (r.department) affectedDepts.add(r.department);
  });

  affectedDepts.forEach(dept => {
    db.setHealthScorePending(dept);
  });

  // Trigger Pulse Notifications
  routePulseAlerts(supersededNode, affectedResults, actorId);

  return affectedResults;
}

// 3. Pulse Notification Routing
function routePulseAlerts(supersededNode, cascadeResults, actorId) {
  const depts = new Set();
  if (supersededNode.department) depts.add(supersededNode.department);
  cascadeResults.forEach(r => {
    if (r.department) depts.add(r.department);
  });

  const updatedNodes = cascadeResults.filter(r => r.action === 'UPDATED');
  if (updatedNodes.length === 0) return;

  const countByDept = {};
  updatedNodes.forEach(n => {
    if (n.department) {
      countByDept[n.department] = (countByDept[n.department] || 0) + 1;
    }
  });

  const allUsers = db.getUsers();

  depts.forEach(dept => {
    const deptCount = countByDept[dept] || 0;
    if (deptCount === 0) return;

    const targetUsers = allUsers.filter(u => u.department === dept && (u.role === 'HOD' || u.role === 'EDITOR'));

    const severity = (supersededNode.type === 'CONSTRAINT' || supersededNode.importance >= 0.90) ? 'URGENT' : 'WARNING';
    const severityIcon = severity === 'URGENT' ? '⛔' : '⚠️';

    targetUsers.forEach(user => {
      db.insertAlert({
        org_id: supersededNode.org_id,
        user_id: user.id,
        alert_type: 'CASCADE',
        severity,
        title: `${supersededNode.title} superseded. ${deptCount} decisions need review.`,
        body: `${severityIcon} ${supersededNode.title} was updated by ${actorId}. This change has cascaded down the knowledge graph, placing ${deptCount} related items in ${dept} department into REVIEW_REQUIRED status.`,
        link: `/nodes/${supersededNode.id}`
      });
    });
  });
}

// 4. Human Review Flow Handler
function reviewNode(nodeId, action, actorId, metadata = {}) {
  const actor = db.getUser(actorId);
  if (!actor) return { success: false, error: 'User not found' };

  const node = db.getNode(nodeId);
  if (!node) return { success: false, error: 'Node not found' };

  const currentStatus = node.status;

  if (action === 'CONFIRM') {
    const check = validateTransition(currentStatus, 'ACTIVE', actor.role);
    if (!check.valid) return { success: false, error: check.error };

    db.updateNode(nodeId, { status: 'ACTIVE' });
    db.insertAuditLog({
      node_id: nodeId, action: 'REVIEW_CONFIRMED',
      old_value: currentStatus, new_value: 'ACTIVE',
      actor_id: actorId, org_id: node.org_id,
      reason: metadata.comment || 'Confirmed as still valid after review.',
      metadata: {}
    });

    if (node.department) db.recomputeHealthScore(node.department);

    const hodUsers = db.getUsers().filter(u => u.department === node.department && u.role === 'HOD' && u.id !== actorId);
    hodUsers.forEach(hod => {
      db.insertAlert({
        org_id: node.org_id, user_id: hod.id,
        alert_type: 'REVIEW_COMPLETED', severity: 'INFO',
        title: `${node.id} confirmed valid by ${actor.name}`,
        body: `ℹ️ Junior reviewer checked ${node.title} and marked it ACTIVE. Reason: ${metadata.comment || 'No comment'}`,
        link: `/nodes/${node.id}`
      });
    });

    return { success: true };
  }

  if (action === 'SUPERSEDE') {
    const check = validateTransition(currentStatus, 'SUPERSEDED', actor.role);
    if (!check.valid) return { success: false, error: check.error };

    const newId = 'N-M' + Math.floor(10 + Math.random() * 90);
    const newTitle = metadata.newTitle || `${node.title} (Updated)`;
    const newContent = metadata.newContent || `Updated content replacing ${node.title}`;
    const newType = metadata.newType || node.type;
    const newImportance = metadata.newImportance !== undefined ? metadata.newImportance : node.importance;

    const newNode = {
      id: newId, org_id: node.org_id, hierarchy_level_id: node.hierarchy_level_id,
      type: newType, title: newTitle, content: newContent,
      importance: newImportance, status: 'ACTIVE', superseded_by: null,
      department: node.department, valid_until: metadata.validUntil || null,
      created_by: actorId, created_at: new Date().toISOString()
    };

    db.insertNode(newNode);
    db.updateNode(nodeId, { status: 'SUPERSEDED', superseded_by: newId });

    db.insertEdge({
      id: 'E-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      source_id: newId, target_id: nodeId,
      edge_type: 'SUPERSEDES', created_at: new Date().toISOString()
    });

    const existingParentEdges = db.getEdges().filter(e => e.source_id === nodeId && e.edge_type === 'DERIVED_FROM');
    existingParentEdges.forEach(pe => {
      db.insertEdge({
        id: 'E-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        source_id: newId, target_id: pe.target_id,
        edge_type: 'DERIVED_FROM', created_at: new Date().toISOString()
      });
    });

    db.insertAuditLog({
      node_id: nodeId, action: 'SUPERSEDE',
      old_value: currentStatus, new_value: 'SUPERSEDED',
      actor_id: actorId, org_id: node.org_id,
      reason: metadata.comment || `Superseded by new node ${newId}`,
      metadata: { new_node_id: newId }
    });

    db.insertAuditLog({
      node_id: newId, action: 'CREATE',
      old_value: null, new_value: 'ACTIVE',
      actor_id: actorId, org_id: node.org_id,
      reason: `Created to supersede ${nodeId}`,
      metadata: { supersedes_node_id: nodeId }
    });

    if (newType === 'CONSTRAINT') {
      runCascade(nodeId, newId, actorId, `Constraint supersession: ${newTitle}`);
    } else {
      if (node.department) db.recomputeHealthScore(node.department);
    }

    return { success: true, newNodeId: newId };
  }

  if (action === 'EXPIRE') {
    const check = validateTransition(currentStatus, 'EXPIRED', actor.role);
    if (!check.valid) return { success: false, error: check.error };

    db.updateNode(nodeId, { status: 'EXPIRED', valid_until: new Date().toISOString() });
    db.insertAuditLog({
      node_id: nodeId, action: 'STATUS_CHANGE',
      old_value: currentStatus, new_value: 'EXPIRED',
      actor_id: actorId, org_id: node.org_id,
      reason: metadata.comment || 'Marked as expired and no longer relevant.',
      metadata: {}
    });

    if (node.department) db.recomputeHealthScore(node.department);
    return { success: true };
  }

  return { success: false, error: 'Unknown action' };
}

module.exports = { validateTransition, runCascade, reviewNode };
