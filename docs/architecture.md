# Architecture (MVP)

## Flow

1. Client sends deployment request.
2. Policy engine evaluates risk and hard rules.
3. Approval packet is generated.
4. Human approver must submit exact token `approve` and reason.
5. Executor runs only allowlisted commands for approved packets.
6. Every step is appended to JSONL audit log.

## Safety controls

- Protected branch + change-window gate
- Tests-passed gate
- Rollback command required
- Deploy command allowlist
- Human-in-the-loop approval with explicit intent token
- Auditable event trail
