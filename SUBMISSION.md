# Codex CI/CD Governance Copilot

## 1) Project Summary

Codex CI/CD Governance Copilot is a Codex-first, human-governed release control system for enterprise software teams.

It solves a high-impact SDLC pain point: teams can ship faster with AI, but unsafe automation can cause severe incidents (bad deploys, broken environments, production instability, missing accountability).

This system keeps Codex as the primary intelligence layer while ensuring deterministic policy controls and human approval remain the final authority before deployment.

## 2) Problem Statement

Modern teams increasingly use AI to accelerate engineering workflows, but fully automated release decisions can introduce security, reliability, and governance risk.

The core problem addressed:

- How do we maximize Codex leverage in SDLC automation
- while preserving human oversight and accountability
- with explainable, auditable, and enforceable guardrails

## 3) Why this matters

Without governance, AI-assisted release workflows can:

- deploy from unsafe branches
- bypass change windows
- ship infra changes without rollback confidence
- hide decision context in opaque model output
- fail compliance audits due to weak traceability

This project converts those failure modes into explicit controls.

## 4) What this project does

Given a deployment request, it runs one unified workflow:

1. Deterministic policy evaluation (risk and violations)
2. Codex SDK review (narrative + checklist + recommendation)
3. Severity threshold decision (`finalDecision`)
4. Human approval packet with required quorum
5. Safe execution only after governance checks pass
6. Immutable audit trail and summary metrics

## 5) Codex is the core feature

This project is Codex-first by design:

- Uses `@openai/codex-sdk` as the primary reasoning engine
- Uses Codex output in the main review artifact (`policy:review`)
- Surfaces Codex reasoning in CLI, MCP, App Server, and CI PR comments

Deterministic policy remains authoritative for final allow/block behavior.

That split is intentional:

- Codex = intelligent analysis and communication acceleration
- Policy + approvals = hard enterprise safety boundary

## 6) Technical Architecture

### Core modules

- Policy rules and severity gate: [src/policy/rules.ts](src/policy/rules.ts), [src/policy/engine.ts](src/policy/engine.ts), [src/policy/severity.ts](src/policy/severity.ts)
- Codex integration: [src/ai/codex-explainer.ts](src/ai/codex-explainer.ts)
- Orchestration layer: [src/mcp/tools.ts](src/mcp/tools.ts)
- Approval workflow: [src/approval/workflow.ts](src/approval/workflow.ts), [src/approval/policy.ts](src/approval/policy.ts)
- Safe deployment executor: [src/deploy/executor.ts](src/deploy/executor.ts)
- Audit store: [src/audit/store.ts](src/audit/store.ts)

### Interfaces

- CLI: [src/cli.ts](src/cli.ts)
- MCP Server: [src/mcp/stdio-server.ts](src/mcp/stdio-server.ts)
- App Server: [src/app-server.ts](src/app-server.ts)
- CI workflow: [.github/workflows/policy-gate.yml](.github/workflows/policy-gate.yml)

## 7) Human-in-the-loop and safety controls

### Deterministic controls

- Deny-by-default release rules
- Sensitive change detection for `infra/` and `deploy/`
- Protected-branch requirement for risky production changes
- Strict deploy command allowlist

### Human governance

- Explicit approval token required (`approve`)
- Separation-of-duties: requester cannot self-approve
- Adaptive quorum approvals:
  - low/medium risk: 1 approver
  - high/critical risk: 2 approvers

### Break-glass emergency mode

- Requires incident ticket
- Requires senior approver allowlist (`BREAK_GLASS_APPROVERS`)
- Requires quorum approvals
- Emits dedicated break-glass audit events

### Fail-safe behavior

- If Codex key/API is unavailable, deterministic fallback explanation is generated
- Safety controls still enforce block/allow without model dependency

## 8) Explainability and auditability

Every meaningful step is logged as auditable events:

- request received
- policy evaluated
- Codex explanation generated
- approval created/updated
- break-glass requested/approved
- execution attempted/completed

The system also provides a visible governance summary for demos and operations:

- reviews total
- blocked reviews
- break-glass requests
- approved packets
- deploy success/failure counts

## 9) End-to-end user workflows

### A) Standard release flow

1. Run review (`policy:review`)
2. Create packet (`plan`)
3. Collect required approvals (`approve`)
4. Verify packet (`packet`)
5. Execute deploy (`deploy`)
6. View summary (`governance:summary`)

### B) Break-glass incident flow

1. Run review with `--break-glass true --incident-ticket ...`
2. Create packet with emergency metadata
3. Collect senior allowlisted approvals
4. Execute deploy only after quorum

### C) CI PR governance flow

1. Workflow collects changed files
2. Runs Codex-first review
3. Posts/updates PR governance comment
4. Fails only after posting clear decision context

## 10) Demo plan (2–5 minutes)

Use these commands:

- `npm run demo:safe`
- `npm run demo:unsafe`
- `npm run demo:ai`
- `npm run demo:breakglass`
- `npm run governance:summary`

What judges see:

- deterministic gate behavior
- Codex explanation quality
- human governance controls
- operational metrics visibility

## 11) OpenAI Track alignment

### Clarity of idea

- Clear objective: safe, human-governed Codex-assisted CI/CD decisions

### Track alignment

- Built around Codex SDK
- Includes MCP Server, App Server, CLI harness workflow, and CI integration

### Technical execution

- End-to-end implementation with tested behavior and runtime paths

### Completeness

- CLI + MCP + HTTP + CI + docs + demos + tests

### Impact and insight

- Solves real enterprise need: speed with accountability and risk control

### Human-in-the-loop & explainability

- Human approvals are mandatory and structured
- Codex output is visible and reviewable

### Risk awareness

- Deterministic safety gate is final authority
- break-glass controls are constrained and auditable

## 12) Local setup and run

1. Install:

`npm install`

2. Configure environment in `.env`:

`CODEX_API_KEY=...`

`CODEX_MODEL=gpt-5.3-codex`

`BREAK_GLASS_APPROVERS=sre-lead,platform-lead,incident-manager`

3. Validate:

`npm run typecheck`

`npm test`

4. Demo:

`npm run demo:ai`

`npm run governance:summary`

## 13) Repository status and quality

- Codex-first architecture implemented
- Governance controls hardened (quorum + SoD + break-glass)
- Presentation visibility added (summary + packet inspection)
- Automated tests passing
- Production-safe defaults retained

## 14) Future roadmap

- Integrate repo-specific ownership policy (CODEOWNERS-aware approver enforcement)
- Add signed approval attestations
- Add rollback dry-run verification step
- Add historical risk trend dashboard (time series)
- Add incident channel integration (Slack/Teams) for break-glass lifecycle
