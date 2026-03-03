import { describe, expect, test } from "vitest";
import { evaluateDeploymentPolicy } from "../src/policy/engine.js";
import { shouldBlockByThreshold } from "../src/policy/severity.js";

describe("evaluateDeploymentPolicy", () => {
  test("fails when tests did not pass", () => {
    const result = evaluateDeploymentPolicy({
      requestId: "r1",
      repo: "sample",
      targetBranch: "main",
      environment: "prod",
      changedFiles: ["src/index.ts"],
      breakGlass: false,
      deployCommand: "npm run deploy:prod",
      rollbackCommand: "npm run rollback:prod",
      testsPassed: false,
      changeWindowApproved: true,
      requestedBy: "dev",
      requestedAt: new Date().toISOString()
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.code === "TESTS_REQUIRED")).toBe(true);
  });

  test("passes for valid request", () => {
    const result = evaluateDeploymentPolicy({
      requestId: "r2",
      repo: "sample",
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
    });
    expect(result.passed).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  test("fails for prod infra change on non-protected branch", () => {
    const result = evaluateDeploymentPolicy({
      requestId: "r3",
      repo: "sample",
      targetBranch: "feature/infra-change",
      environment: "prod",
      changedFiles: ["infra/terraform/main.tf"],
      breakGlass: false,
      deployCommand: "npm run deploy:prod",
      rollbackCommand: "npm run rollback:prod",
      testsPassed: true,
      changeWindowApproved: true,
      requestedBy: "dev",
      requestedAt: new Date().toISOString()
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.code === "SENSITIVE_PROTECTED_BRANCH_REQUIRED")).toBe(true);
  });

  test("threshold gate blocks only at configured severity", () => {
    const result = evaluateDeploymentPolicy({
      requestId: "r4",
      repo: "sample",
      targetBranch: "main",
      environment: "prod",
      changedFiles: ["src/index.ts"],
      breakGlass: false,
      deployCommand: "npm run deploy:prod",
      rollbackCommand: "",
      testsPassed: true,
      changeWindowApproved: true,
      requestedBy: "dev",
      requestedAt: new Date().toISOString()
    });

    expect(result.violations.some((v) => v.severity === "medium")).toBe(true);
    expect(shouldBlockByThreshold(result.violations, "high")).toBe(false);
    expect(shouldBlockByThreshold(result.violations, "medium")).toBe(true);
  });
});
