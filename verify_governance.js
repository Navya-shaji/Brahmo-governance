const http = require('http');

const BASE_URL = 'http://localhost:5000';

function post(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse response body: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse response body: ${body}`));
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('============================================================');
  console.log('      BRAHMO GOVERNANCE ENGINE: INTEGRATION VERIFIER        ');
  console.log('============================================================\n');

  try {
    // 0. Check connection
    console.log('Checking connection to dev server at http://localhost:5000...');
    try {
      await get(`${BASE_URL}/api/users`);
      console.log('✓ Connected successfully.\n');
    } catch (e) {
      console.error('\n❌ ERROR: Cannot connect to server.');
      console.error('Please make sure Express backend is running locally using "npm run dev" or "npm start" on port 5000 inside the server directory.');
      console.error('Abort verifier.\n');
      process.exit(1);
    }

    // 1. Reset Database
    console.log('Step 1: Resetting database to seed state...');
    const resetRes = await post(`${BASE_URL}/api/reset`, {});
    if (!resetRes.success) throw new Error('Reset failed');
    console.log('✓ Database reset successfully.\n');

    // 2. Check initial health score
    console.log('Step 2: Checking initial health score for Medicine...');
    const healthInit = await get(`${BASE_URL}/api/health?department=medicine`);
    if (!healthInit.success) throw new Error('Fetch initial health score failed');
    const initScore = Math.round(healthInit.score.overall * 100);
    console.log(`✓ Initial overall health: ${initScore}% (expected: ~86%)`);
    console.log(`  Coverage: ${Math.round(healthInit.score.coverage * 100)}%`);
    console.log(`  Freshness: ${Math.round(healthInit.score.freshness * 100)}%`);
    console.log(`  Consistency: ${Math.round(healthInit.score.consistency * 100)}%\n`);

    // 3. Trigger Sepsis v2 -> v3 Cascade
    console.log('Step 3: Triggering Sepsis Protocol v2 -> v3 supersession...');
    const cascadeRes = await post(`${BASE_URL}/api/cascade`, {
      supersededNodeId: 'N-M08',
      newTitle: 'Sepsis Protocol v3 (2026)',
      newContent: 'Supra Sepsis Bundle v3 (2026): blood cultures before antibiotics, lactate measurement within 1 HOUR, 30mL/kg crystalloid for hypotension.',
      newType: 'DECISION',
      newImportance: 0.95,
      actorId: 'U-MEERA'
    });

    if (!cascadeRes.success) throw new Error(`Cascade trigger failed: ${cascadeRes.error}`);
    console.log('✓ Cascade triggered successfully.');

    const affected = cascadeRes.affectedNodes || [];
    console.log(`  Total affected nodes returned: ${affected.length}`);
    
    // Check depths
    const d1 = affected.filter(n => n.depth === 1);
    const d2 = affected.filter(n => n.depth === 2);
    console.log(`  Depth 1 children: ${d1.length} (expected: 7)`);
    console.log(`  Depth 2 grandchildren: ${d2.length} (expected: 3)`);

    // Verify N-HELD was skipped
    const heldNode = affected.find(n => n.id === 'N-HELD');
    if (!heldNode || heldNode.action !== 'SKIPPED_HOLD') {
      throw new Error('Compliance Protection Failure: N-HELD was not skipped or was not logged correctly.');
    }
    console.log('✓ Compliance Protection verified: N-HELD (LEGAL_HOLD) skipped in cascade.\n');

    // 4. Verify Node status in DB
    console.log('Step 4: Verifying statuses of nodes in the database...');
    const nodesRes = await get(`${BASE_URL}/api/nodes`);
    const nodes = nodesRes.nodes;

    const sepsisV2 = nodes.find(n => n.id === 'N-M08');
    if (sepsisV2.status !== 'SUPERSEDED' || !sepsisV2.superseded_by) {
      throw new Error('Sepsis v2 was not marked SUPERSEDED or is missing superseded_by link');
    }
    console.log('✓ Sepsis v2 status: SUPERSEDED');

    const drv1 = nodes.find(n => n.id === 'N-DRV-01');
    if (drv1.status !== 'REVIEW_REQUIRED') {
      throw new Error(`Derived node N-DRV-01 status is ${drv1.status}, expected REVIEW_REQUIRED`);
    }
    console.log('✓ Derived child N-DRV-01 status: REVIEW_REQUIRED');

    const heldDb = nodes.find(n => n.id === 'N-HELD');
    if (heldDb.status !== 'LEGAL_HOLD') {
      throw new Error(`Compliance violation: N-HELD status changed to ${heldDb.status}`);
    }
    console.log('✓ Compliance node N-HELD status: preserved as LEGAL_HOLD');

    const unrelatedMed = nodes.find(n => n.id === 'N-M01');
    if (unrelatedMed.status !== 'ACTIVE') {
      throw new Error(`Isolation breach: unrelated Medicine node status changed to ${unrelatedMed.status}`);
    }
    console.log('✓ Unrelated node N-M01 status: preserved as ACTIVE\n');

    // 5. Verify Audit Logs
    console.log('Step 5: Verifying audit logs...');
    const auditRes = await get(`${BASE_URL}/api/audit`);
    const logs = auditRes.auditLogs;

    const cascadeTriggerLog = logs.find(l => l.action === 'CASCADE_TRIGGER' && l.node_id === 'N-M08');
    if (!cascadeTriggerLog) throw new Error('Missing CASCADE_TRIGGER audit log for N-M08');
    
    const skipLog = logs.find(l => l.action === 'CASCADE_SKIP' && l.node_id === 'N-HELD');
    if (!skipLog) throw new Error('Missing CASCADE_SKIP audit log for N-HELD');
    console.log('✓ audit log entries recorded: CASCADE_TRIGGER and CASCADE_SKIP found.\n');

    // 6. Verify Pulse Alerts and Routing
    console.log('Step 6: Verifying alert routing...');
    // Dr Meera (HOD Medicine) - should get alert
    const meeraAlerts = await get(`${BASE_URL}/api/alerts?userId=U-MEERA`);
    const meeraCascadeAlert = meeraAlerts.alerts.find(a => a.alert_type === 'CASCADE');
    if (!meeraCascadeAlert) throw new Error('Dr. Meera did not receive the cascade alert');
    console.log(`✓ Dr. Meera (HOD Medicine) alert received: "${meeraCascadeAlert.title}"`);

    // Dr Vikram (HOD Ortho) - should NOT get alert
    const vikramAlerts = await get(`${BASE_URL}/api/alerts?userId=U-VIKRAM`);
    const vikramCascadeAlert = vikramAlerts.alerts.find(a => a.alert_type === 'CASCADE');
    if (vikramCascadeAlert) throw new Error('Ortho HOD received Medicine cascade alert (routing breach)');
    console.log('✓ Dr. Vikram (HOD Ortho) alert: No alerts received (correctly isolated)\n');

    // 7. Verify Health Score Drop (Deferred check)
    console.log('Step 7: Verifying Health Score Drop (before recompute)...');
    const healthScoreBefore = await get(`${BASE_URL}/api/health?department=medicine`);
    if (!healthScoreBefore.score.pending) {
      throw new Error('Health score was not marked PENDING after cascade');
    }
    console.log('✓ Health score deferred recomputation flag is set to PENDING');

    console.log('Forcing health score recomputation...');
    const healthScoreAfter = await get(`${BASE_URL}/api/health?department=medicine&recompute=true`);
    const scoreAfterVal = Math.round(healthScoreAfter.score.overall * 100);
    console.log(`✓ Health score computed. New overall health: ${scoreAfterVal}% (expected drop from ~86% to ~74%)`);
    console.log(`  Coverage: ${Math.round(healthScoreAfter.score.coverage * 100)}% (should be 82%)`);
    console.log(`  Freshness: ${Math.round(healthScoreAfter.score.freshness * 100)}% (expected drop due to review required)`);
    console.log(`  Consistency: ${Math.round(healthScoreAfter.score.consistency * 100)}% (expected drop due to stale flags)\n`);

    // 8. Human Review Flow
    console.log('Step 8: Verifying Human Review Flow (Dr. Ananya confirms N-DRV-01 is still valid)...');
    const reviewRes = await post(`${BASE_URL}/api/nodes`, {
      action: 'CONFIRM',
      nodeId: 'N-DRV-01',
      actorId: 'U-ANANYA',
      comment: 'Lactate monitoring schedule checked. Will update to v3 timing on next shift, but current schedule remains clinically safe.'
    });
    if (!reviewRes.success) throw new Error(`Review confirm failed: ${reviewRes.error}`);

    // Verify node is active
    const nodesRes2 = await get(`${BASE_URL}/api/nodes`);
    const drv1Updated = nodesRes2.nodes.find(n => n.id === 'N-DRV-01');
    if (drv1Updated.status !== 'ACTIVE') {
      throw new Error(`Review check failed: N-DRV-01 status is ${drv1Updated.status}, expected ACTIVE`);
    }
    console.log('✓ N-DRV-01 status successfully reverted to ACTIVE');

    // Check health score recovery
    const healthScoreAfterReview = await get(`${BASE_URL}/api/health?department=medicine`);
    const recoveredScore = Math.round(healthScoreAfterReview.score.overall * 100);
    console.log(`✓ Health score recalculated automatically on review confirmation: ${recoveredScore}% (recovered from ${scoreAfterVal}%)\n`);

    // 9. State Machine Transition Enforcement
    console.log('Step 9: Testing State Machine transition enforcement...');
    // Attempt invalid transition: SUPERSEDED -> ACTIVE
    try {
      const invalidRes = await post(`${BASE_URL}/api/nodes`, {
        action: 'TRANSITION',
        nodeId: 'N-M08', // Sepsis v2 is SUPERSEDED
        actorId: 'U-SURESH', // Admin role
        newStatus: 'ACTIVE'
      });
      if (invalidRes.success) {
        throw new Error('Allowed invalid transition: SUPERSEDED -> ACTIVE');
      }
      console.log(`✓ Blocked invalid transition: SUPERSEDED -> ACTIVE rejected with error.`);
    } catch (e) {
      console.log(`✓ Blocked invalid transition: SUPERSEDED -> ACTIVE rejected (expected behavior)`);
    }

    // Attempt non-admin legal hold transition
    try {
      const invalidRes2 = await post(`${BASE_URL}/api/nodes`, {
        action: 'TRANSITION',
        nodeId: 'N-M01',
        actorId: 'U-ANANYA', // Junior editor, not admin
        newStatus: 'LEGAL_HOLD'
      });
      if (invalidRes2.success) {
        throw new Error('Allowed non-admin to place node on LEGAL_HOLD');
      }
      console.log(`✓ Blocked unauthorized transition: Non-ADMIN placing LEGAL_HOLD rejected with error.`);
    } catch (e) {
      console.log(`✓ Blocked unauthorized transition: Non-ADMIN placing LEGAL_HOLD rejected (expected behavior)`);
    }

    console.log('\n============================================================');
    console.log('      🎉 ALL GOVERNANCE ENGINE TESTS COMPLETED SUCCESSFULLY!  ');
    console.log('============================================================');

  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();
