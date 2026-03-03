import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AuditStore } from "../src/audit/store.js";
import { DeployExecutor } from "../src/deploy/executor.js";

describe("DeployExecutor", () => {
  let baseDir = "";

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), "codex-cicd-"));
  });

  afterEach(async () => {
    if (baseDir) {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  test("blocks unapproved packet", async () => {
    const store = new AuditStore(baseDir);
    const executor = new DeployExecutor(store);
    await expect(
      executor.execute({
        packetId: "p1",
        riskLevel: "high",
        requiredApprovals: 2,
        approvals: [],
        status: "pending",
        request: {
          requestId: "r1",
          repo: "repo",
          targetBranch: "main",
          environment: "prod",
          changedFiles: ["src/index.ts"],
          breakGlass: false,
          deployCommand: "npm run deploy:prod",
          rollbackCommand: "npm run rollback:prod",
          testsPassed: true,
          changeWindowApproved: true,
          requestedBy: "dev",
          requestedAt: new Date().toISOString()
        },
        policy: {
          passed: true,
          violations: [],
          evaluatedAt: new Date().toISOString()
        }
      })
    ).rejects.toThrow("not approved");
  });

  test("blocks approved packet when quorum is missing", async () => {
    const store = new AuditStore(baseDir);
    const executor = new DeployExecutor(store);
    await expect(
      executor.execute({
        packetId: "p2",
        riskLevel: "high",
        requiredApprovals: 2,
        approvals: [
          {
            approver: "lead1",
            reason: "approved",
            approvedAt: new Date().toISOString()
          }
        ],
        status: "approved",
        request: {
          requestId: "r2",
          repo: "repo",
          targetBranch: "main",
          environment: "prod",
          changedFiles: ["deploy/prod.yml"],
          breakGlass: false,
          deployCommand: "npm run deploy:prod",
          rollbackCommand: "npm run rollback:prod",
          testsPassed: true,
          changeWindowApproved: true,
          requestedBy: "dev",
          requestedAt: new Date().toISOString()
        },
        policy: {
          passed: true,
          violations: [],
          highestSeverity: null,
          evaluatedAt: new Date().toISOString()
        }
      })
    ).rejects.toThrow("quorum");
  });
});
