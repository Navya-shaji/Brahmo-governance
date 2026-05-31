# BRAHMO Governance Engine

BRAHMO is a real-time clinical knowledge graph governance engine designed to enforce guidelines, validate clinical decision workflows, and prevent medical errors. It leverages a modern, highly decoupled architecture featuring a **React (Vite) frontend** and a **Node.js (Express) backend**.

## Architecture & Core Features

1. **Vitals Health Dashboard**: Tracks organizational knowledge hygiene in real-time across four key dimensions:
   - **Coverage**: The percentage of hierarchy levels with at least one active protocol node.
   - **Freshness**: The ratio of active nodes to review-required and expired nodes.
   - **Balance**: Standard deviation across node type categories (`FACT`, `DECISION`, `CONSTRAINT`, `ANTI_PATTERN`).
   - **Consistency**: High-quality ratio verifying nodes not currently flagged for active review.
2. **Cascade Invalidation Engine**: Executes a bounded-BFS traversal through clinical guideline linkages (`DERIVED_FROM` edges). When a parent clinical protocol is superseded, all derived downstream nodes are automatically marked `REVIEW_REQUIRED`, immediately triggering workflow reviews.
3. **Compliance Protection (Legal Holds)**: Preserves clinical safety under medico-legal disputes. Any node under `LEGAL_HOLD` is completely frozen. The cascade invalidation skips over these nodes, logging a `CASCADE_SKIP` event in the audit trail, and prevents status changes by anyone except an `ADMIN`.
4. **Pulse Alert Routing**: Intelligently routes notifications by role (`HOD`, `EDITOR`) and department context (`medicine`, `ortho`). When a cascade invalidation flags nodes in medicine, ortho HODs are untouched, and medicine HODs receive warnings immediately.
5. **State Machine Verification**: An immutable state validation transition machine preventing illegal transitions (e.g. attempting to restore a permanently retired `SUPERSEDED` node).

---

## Directory Structure

```text
Brahmo-governance/
├── client/                 # React (Vite + TypeScript) Frontend
│   ├── src/
│   │   ├── components/     # Interactive, rich HSL styling components
│   │   │   ├── HealthDashboard.tsx
│   │   │   ├── CascadeTree.tsx
│   │   │   ├── PulseAlerts.tsx
│   │   │   └── NodeDetailPanel.tsx
│   │   ├── App.tsx         # Dashboard hub, coordinator of state & proxy API
│   │   ├── index.css       # Tailwind CSS v4 base configuration
│   │   ├── types.ts        # Common TS Interfaces
│   │   └── main.tsx
│   ├── vite.config.ts      # API proxy (port 5000) & Tailwind plugin
│   └── package.json
│
├── server/                 # Node.js Express Backend
│   ├── db.js               # Synchronous JSON file persistence with health score formulas
│   ├── db.json             # Seed and runtime data store (auto-generated)
│   ├── governance.js       # BFS Cascade Engine, State validation, and Alert Routing
│   ├── index.js            # Express server route mapping
│   └── package.json
│
├── verify_governance.js    # Automated integration test runner
├── package.json            # Monorepo controller scripts
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### Setup & Installation
Run the monorepo installation helper script from the root directory:
```bash
npm run install:all
```
This will automatically install dependencies in both the `server/` and `client/` projects, as well as root orchestrator tools like `concurrently`.

### Running the App Locally
Start both the Express backend (port 5000) and the Vite frontend (port 5173) concurrently using:
```bash
npm start
```
Open your browser and navigate to `http://localhost:5173`.

---

## Integration Testing & Verification

You can run the end-to-end integration test verifier which executes a full automated test run of all the governance scenarios, validations, and protections.

1. Make sure the servers are running: `npm start`
2. In a separate terminal run the integration verifier:
   ```bash
   npm run test:integration
   ```

The test runner will automatically:
- Reset the database state.
- Check initial health stats.
- Trigger the Sepsis Protocol v2 -> v3 cascade.
- Verify that downstream derived nodes become `REVIEW_REQUIRED`.
- Verify that `N-HELD` remains `LEGAL_HOLD` (skipping invalidation).
- Check that audit logs record `CASCADE_TRIGGER` and `CASCADE_SKIP` correctly.
- Verify that HOD Medicine receives a `CASCADE` alert while HOD Ortho is kept isolated.
- Recalculate health vitals and verify automatic recovery during human review confirmations.
- Test strict boundary check rejections of the state transition machine.
