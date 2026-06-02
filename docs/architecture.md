# BRAHMO Governance Engine — Architecture Notes

## Overview

BRAHMO is a clinical knowledge graph governance engine for Supra Multi-Specialty Hospital. It enforces protocol lifecycle management through three interlocking engines: **Cascade Invalidation**, **Knowledge Health Score**, and **Pulse Notification Routing**.

```
Dr. Meera supersedes Sepsis Protocol v2 → v3
        │
        ▼
  [ SUPERSEDE PATTERN ]
  INSERT new node (Sepsis v3, status: ACTIVE)
  UPDATE old node (Sepsis v2, status: SUPERSEDED, superseded_by: new_id)
  INSERT audit_log (SUPERSEDE, CREATE)
        │
        ▼
  [ CASCADE INVALIDATION ENGINE ]
  BFS walk on DERIVED_FROM edges
  Flag derived nodes → REVIEW_REQUIRED
  Skip LEGAL_HOLD nodes (log CASCADE_SKIP)
  Stop at max_depth = 3
        │
        ▼
  [ HEALTH SCORE ] ← deferred, not immediate
  Set pending = true after cascade
  Recompute when: review confirmed OR admin forces recompute
        │
        ▼
  [ PULSE NOTIFICATION ]
  Route alerts to HOD + EDITOR of affected departments only
```

---

## Engine 1: Cascade Invalidation

### How It Works

When a node is superseded, the cascade engine performs a bounded BFS traversal on `DERIVED_FROM` edges starting from the superseded node. Each reachable child node is marked `REVIEW_REQUIRED`, triggering a human review workflow.

### Three Safety Guards

**1. Depth Bound (`max_depth = 3`)**

The cascade stops at depth 3. This is configurable per organization via `organizations.config.cascade_max_depth`.

Why depth 3, not unlimited?
- Depth 1: Direct derivatives — almost certainly stale. Must flag.
- Depth 2: Indirect derivatives — likely still relevant, should review.
- Depth 3: Distant derivatives — flagging is conservative but defensible.
- Depth 4+: At this distance, the derived knowledge is tangentially related. Auto-flagging becomes too aggressive and creates review noise without clinical value. A depth-4 node may only reference the superseded parent in passing.

Without this bound, a deeply interconnected graph produces unbounded recursion that could flag hundreds of unrelated nodes.

**2. Visited Set**

A `visited` set tracks all node IDs processed during the BFS. Before processing any node, the engine checks:
```js
if (visited.has(nodeId)) continue;
visited.add(nodeId);
```

This handles **multi-parent nodes** — nodes derived from more than one parent. Without the visited set, a node shared between two cascade paths would be processed twice, potentially creating duplicate audit entries and double-alerts. On cyclic graphs, it would loop infinitely.

**3. LEGAL_HOLD Skip**

Nodes under `LEGAL_HOLD` are frozen for compliance reasons (medico-legal disputes, ongoing investigations). The cascade engine must never modify their status.

When the cascade reaches a `LEGAL_HOLD` node:
- Status is **not changed**
- A `CASCADE_SKIP` audit log entry is inserted with reason: `"Node skipped during cascade: LEGAL_HOLD status prevents status change."`
- The node's children are **not traversed** (the freeze is absolute)

This is a hard compliance requirement. Silently skipping without logging is an audit gap.

### Edge Types

The cascade **only follows `DERIVED_FROM` edges**. It does not follow:
- `SUPPORTS` — a supporting node doesn't become stale when what it supports changes
- `SUPERSEDES` — handled by the supersede pattern itself
- `CONTRADICTS`, `REQUIRES` — not cascade relationships

### What Gets Skipped

| Node Status | Action |
|---|---|
| `LEGAL_HOLD` | Skipped, logged as `CASCADE_SKIP` |
| `SUPERSEDED` | Skipped silently (already replaced) |
| `REVIEW_REQUIRED` | Skipped (idempotent, already flagged) |
| `ACTIVE` | Flagged → `REVIEW_REQUIRED` + audit entry |
| `EXPIRED` | Flagged → `REVIEW_REQUIRED` + audit entry |

---

## Engine 2: Knowledge Health Score

### Four Dimensions

All four dimensions are computed from live data using pure arithmetic — zero LLM.

| Dimension | Formula | Weight |
|---|---|---|
| Coverage | `populated_levels / total_levels` | 25% |
| Freshness | `fresh_active_nodes / (active + review_required)` | 30% |
| Balance | `1 - stddev(type_counts) / avg(type_counts)` | 20% |
| Consistency | `active / (active + review_required)` | 25% |

**Overall** = weighted sum of all four.

**Coverage** measures whether hierarchy levels have at least one active protocol node. It only drops if nodes are permanently removed (SUPERSEDED/EXPIRED leave levels empty). A cascade alone doesn't change coverage because nodes are status-changed, not deleted.

**Freshness** measures what fraction of "live" nodes (ACTIVE + REVIEW_REQUIRED) are clean ACTIVE. After a cascade flags 9 nodes to REVIEW_REQUIRED, freshness drops sharply.

**Balance** measures type distribution health. Equal distribution across CONSTRAINT, DECISION, ANTI_PATTERN, FACT = score of 1.0. Homogeneous graphs score lower. A cascade doesn't change node types, so balance is unaffected.

**Consistency** measures what fraction of live nodes are free of review flags. It drops directly with the number of REVIEW_REQUIRED nodes. It recovers as doctors confirm nodes back to ACTIVE.

### Why Recomputation Is Deferred

Immediately recomputing health score after a cascade is misleading. The scores will reflect maximum degradation (e.g., 86% → 60%) at the moment reviews are just beginning. Leadership sees an alarming number that will naturally recover within 24 hours as clinicians complete their reviews.

**The deferred approach:**
1. After cascade, set `health_scores[department].pending = true`
2. Display a "⚠️ Review Pending" indicator on the dashboard
3. Recompute when: (a) a human review is confirmed, (b) admin forces recompute, or (c) the dashboard recompute button is clicked

This prevents unnecessary alarm while keeping leadership informed that activity is in progress.

### Expected Score Changes (Sepsis v2 → v3 cascade)

| Dimension | Before | After | Why |
|---|---|---|---|
| Coverage | 75% | 75% | No levels depopulated |
| Freshness | ~94% | drops | 9 nodes now REVIEW_REQUIRED |
| Balance | ~72% | 72% | Type distribution unchanged |
| Consistency | 100% | drops | 9 REVIEW_REQUIRED nodes |
| **Overall** | **~86%** | **drops** | Freshness + Consistency both fall |

After all reviews confirmed → scores recover back toward 86%.

---

## Engine 3: Pulse Notification Routing

### Routing Logic

Notifications are routed by reading the department of each affected node, then querying users in that department with roles `HOD` or `EDITOR`. Viewers and unrelated departments receive nothing.

```
affected_nodes → departments → users WHERE department IN (affected_depts)
                                         AND role IN ('HOD', 'EDITOR')
```

This means:
- A Medicine cascade only alerts Medicine HODs and Editors
- Ortho doctors are untouched unless an Ortho node is in the cascade path
- Admin (`U-SURESH`) is never notified via Pulse (not a HOD/EDITOR)

### Severity Mapping

| Event | Severity | Icon |
|---|---|---|
| CONSTRAINT node superseded | URGENT | ⛔ |
| DECISION/FACT/ANTI_PATTERN superseded | WARNING | ⚠️ |
| Health score drops below 75% | WARNING | ⚠️ |
| Review completed (node back to ACTIVE) | INFO | ℹ️ |

---

## Status Transition State Machine

```
ACTIVE ──────────→ SUPERSEDED     (terminal, irreversible)
  │ ──────────────→ REVIEW_REQUIRED (cascade or manual)
  │ ──────────────→ EXPIRED         (decay window passed)
  │ ──────────────→ LEGAL_HOLD      (ADMIN only)

REVIEW_REQUIRED ──→ ACTIVE         (human review confirms)
                ──→ SUPERSEDED      (doctor creates replacement)
                ──→ EXPIRED         (marked no longer relevant)

LEGAL_HOLD ───────→ ACTIVE / REVIEW_REQUIRED / EXPIRED (ADMIN release only)

EXPIRED ──────────→ ACTIVE          (re-validated)

SUPERSEDED ───────→ ❌ NOTHING      (terminal — cannot be restored)
```

Enforcement happens in `governance.js → validateTransition()` before any status write.

---

## Cascade-on-Review: Preventing Unbounded Recursion

When a doctor reviews a `REVIEW_REQUIRED` node and chooses to Supersede it (create a new version), does that supersession trigger its own cascade?

**Decision: Cascade only on `CONSTRAINT` supersession, not on `DECISION` review.**

Rationale: A CONSTRAINT (clinical rule) supersession has organization-wide safety implications — its derivatives must be flagged. A DECISION node reviewed and replaced during a cascade cleanup is a downstream response, not an originating change. Auto-cascading from it would create a recursive wave through already-flagged nodes.

Implementation in `governance.js → reviewNode()`:
```js
if (newType === 'CONSTRAINT') {
  runCascade(nodeId, newId, actorId, ...);
} else {
  db.recomputeHealthScore(node.department);  // just recompute, no cascade
}
```

---

## Performance at Scale

**Question:** A hospital chain has 15 departments with 200 protocols. A compliance change affects a top-level CONSTRAINT cascading through 4 depth levels touching 85 nodes. What's the performance impact?

**Answer:** The cascade is bounded BFS — it visits exactly the nodes in the DERIVED_FROM subgraph up to `max_depth`. At 85 nodes:
- 85 status UPDATEs (single field `status`)
- 85 `audit_log` INSERTs
- 1 `CASCADE_TRIGGER` audit entry

All writes happen synchronously to `db.json` (the working store) in under 200ms for a file of this size. Health score recomputation is deferred and runs once (not per-node) when triggered. Supabase sync happens asynchronously in the background after each write — it does not block the cascade response.

For production scale, batch the UPDATE statements in a single transaction and use Supabase's bulk upsert. The cascade completes in under 2 seconds.

---

## Data Architecture

| Store | Role |
|---|---|
| `server/db.json` | Primary working store — synchronous reads/writes |
| Supabase | Optional cloud persistence — async background sync |

On startup: if Supabase is configured and has data, state is loaded from Supabase into `db.json`. If Supabase is empty, it's seeded from `INITIAL_STATE`. If Supabase is not configured, `db.json` is used standalone.

All reads are synchronous from `db.json` (fast). All writes go to `db.json` first, then Supabase asynchronously. This ensures the cascade engine never blocks on network I/O.

---

## Directory Structure

```
Brahmo-governance/
├── client/src/
│   ├── components/
│   │   ├── CascadeTree.tsx       — Tree visualization with depth labels + status badges
│   │   ├── HealthDashboard.tsx   — 4 dimension bars + animated ring chart + pending state
│   │   ├── PulseAlerts.tsx       — Severity-sorted alert list with node navigation
│   │   └── NodeDetailPanel.tsx   — Audit trail, review forms, state machine actions
│   └── App.tsx                   — Orchestrator: state, API calls, scenario triggers
├── server/
│   ├── governance.js             — Cascade BFS engine, state machine, pulse routing
│   ├── db.js                     — JSON persistence, health score formulas, Supabase sync
│   └── index.js                  — Express REST API (nodes, cascade, health, alerts, audit)
├── verify_governance.js          — Integration test runner (9 automated scenarios)
└── docs/architecture.md          — This file
```
