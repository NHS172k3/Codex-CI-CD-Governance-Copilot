import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AuditStore } from "../src/audit/store.js";
import { ApprovalWorkflow } from "../src/approval/workflow.js";
import type { DeploymentReview } from "../src/types.js";

function createReview(overrides?: Partial<DeploymentReview>): DeploymentReview {
  return {
    passed: true,
    finalDecision: "approve_with_human_gate",
    failOn: "high",
    policyPassed: true,
    highestSeverity: null,
    violations: [],
    evaluatedAt: new Date().toISOString(),
    request: {
      requestId: "req-1",
      repo: "repo",
      targetBranch: "main",
      environment: "prod",
      changedFiles: ["deploy/prod.yml"],
      breakGlass: false,
      deployCommand: "npm run deploy:prod",
      rollbackCommand: "npm run rollback:prod",
      testsPassed: true,
      changeWindowApproved: true,
      requestedBy: "alice",
      requestedAt: new Date().toISOString()
    },
    policy: {
      passed: true,
      violations: [],
      highestSeverity: null,
      evaluatedAt: new Date().toISOString()
    },
    codex: {
      source: "fallback",
      model: "gpt-5.3-codex",
      recommendedDecision: "approve_with_caution",
      narrative: "safe",
      checklist: []
    },
    ...overrides
  };
}

describe("ApprovalWorkflow", () => {
  let baseDir = "";

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), "codex-cicd-"));
  });

  afterEach(async () => {
    if (baseDir) {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  test("requires exact approve token", async () => {
    const store = new AuditStore(baseDir);
    const workflow = new ApprovalWorkflow(store);
    const packet = await workflow.createApprovalPacket(createReview(), "alice");

    await expect(
      workflow.approvePacket(packet.packetId, "lead", "looks good", "yes")
    ).rejects.toThrow("Approval token invalid");
  });

  test("enforces separation of duties and quorum approvals", async () => {
    const store = new AuditStore(baseDir);
    const workflow = new ApprovalWorkflow(store);
    const packet = await workflow.createApprovalPacket(createReview(), "alice");

    expect(packet.requiredApprovals).toBe(2);

    await expect(
      workflow.approvePacket(packet.packetId, "alice", "self approve", "approve")
    ).rejects.toThrow("Separation-of-duties");

    const firstApproval = await workflow.approvePacket(
      packet.packetId,
      "lead1",
      "first approval",
      "approve"
    );
    expect(firstApproval.status).toBe("pending");
    expect(firstApproval.approvals.length).toBe(1);

    const secondApproval = await workflow.approvePacket(
      packet.packetId,
      "lead2",
      "second approval",
      "approve"
    );
    expect(secondApproval.status).toBe("approved");
    expect(secondApproval.approvals.length).toBe(2);
  });

  test("creates rejected packet when review is blocked", async () => {
    const store = new AuditStore(baseDir);
    const workflow = new ApprovalWorkflow(store);
    const blockedReview = createReview({
      passed: false,
      finalDecision: "block",
      policyPassed: false,
      highestSeverity: "high",
      violations: [
        {
          code: "SENSITIVE_PROTECTED_BRANCH_REQUIRED",
          message: "blocked",
          severity: "high"
        }
      ]
    });

    const packet = await workflow.createApprovalPacket(blockedReview, "alice");
    expect(packet.status).toBe("rejected");
  });

  test("break-glass requires allowlisted senior approvers", async () => {
    const previousAllowlist = process.env.BREAK_GLASS_APPROVERS;
    process.env.BREAK_GLASS_APPROVERS = "sre-lead,platform-lead";

    const store = new AuditStore(baseDir);
    const workflow = new ApprovalWorkflow(store);
    const breakGlassReview = createReview({
      passed: false,
      finalDecision: "block",
      policyPassed: false,
      highestSeverity: "high",
      request: {
        ...createReview().request,
        breakGlass: true,
        incidentTicket: "INC-1234"
      },
      violations: [
        {
          code: "SENSITIVE_PROTECTED_BRANCH_REQUIRED",
          message: "blocked",
          severity: "high"
        }
      ]
    });

    const packet = await workflow.createApprovalPacket(breakGlassReview, "alice");
    expect(packet.status).toBe("pending");
    expect(packet.requiredApprovals).toBe(2);

    await expect(
      workflow.approvePacket(packet.packetId, "random-dev", "not senior", "approve")
    ).rejects.toThrow("senior approver allowlist");

    const first = await workflow.approvePacket(packet.packetId, "sre-lead", "incident approved", "approve");
    expect(first.status).toBe("pending");

    const second = await workflow.approvePacket(
      packet.packetId,
      "platform-lead",
      "incident approved 2",
      "approve"
    );
    expect(second.status).toBe("approved");

    if (previousAllowlist) {
      process.env.BREAK_GLASS_APPROVERS = previousAllowlist;
    } else {
      delete process.env.BREAK_GLASS_APPROVERS;
    }
  });
});
