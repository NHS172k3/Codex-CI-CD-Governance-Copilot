# Demo Script

## Super quick run

1. Run `npm run demo:safe` (expect pass).
2. Run `npm run demo:unsafe` (expect failure + high severity violation).
3. Run `npm run demo:ai` (Codex-first review output, fallback narrative if key unavailable).
4. Run `npm run demo:breakglass` (creates emergency approval packet with incident ticket).
5. Run `npm run governance:summary` (visible governance metrics).

## Main demo for judges

1. Execute `npm run policy:review -- ...` with realistic changed files.
2. Show output fields: `finalDecision`, `violations`, and `codex` narrative/checklist.
3. Show break-glass call with `--break-glass true --incident-ticket ...`.
4. Show `npm run governance:summary` to prove outcomes are measurable and auditable.
5. Explain that deterministic gate decides pass/fail, Codex improves reviewer clarity and speed.

## Safe deploy path

1. Run `plan` with tests=true and change-window=true.
2. Copy packet id.
3. Run `approve` with `--token approve`.
4. Run `deploy` and show execution record.
5. Run `audit` and show event chain.

## App server path

1. Start app server: `npm run start:app`.
2. Send `POST /plan` with deployment payload.
3. Send `POST /approve` with `token=approve`.
4. Send `POST /deploy` with packet id.
5. Query `GET /audit?limit=20`.

## MCP path

1. Start MCP stdio server with `npm run start:mcp`.
2. Connect via Codex/client MCP configuration.
3. Invoke tools: `policy_review`, `assess_deploy_risk`, `create_approval_packet`, `approve_deploy`, `execute_deploy`, `get_audit_trail`, `explain_risk_with_codex`.

## Unsafe path

1. Run `plan` with tests=false.
2. Attempt approval and show rejection due to failed policy.
3. Run `policy:check` with `--changed-files "infra/main.tf"` and `--branch feature/x --env prod`.
4. Show `SENSITIVE_PROTECTED_BRANCH_REQUIRED` violation.

## PR comment bot path

1. Open a PR to `main`.
2. Let `Policy Gate` workflow run.
3. Show generated PR comment with `PASSED`/`FAILED` status and violations.
4. Push another commit and show the same comment being updated in place.
