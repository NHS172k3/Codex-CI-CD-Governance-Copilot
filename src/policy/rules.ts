import type { DeploymentRequest, PolicyViolation } from "../types.js";

const protectedBranches = new Set(["main", "master", "release"]);
const allowedDeployCommands = new Set([
  "npm run deploy:staging",
  "npm run deploy:prod",
  "pnpm deploy:staging",
  "pnpm deploy:prod"
]);

function hasSensitiveChange(changedFiles: string[]): boolean {
  return changedFiles.some((path) => {
    const normalized = path.replace(/\\/g, "/").toLowerCase();
    return normalized.startsWith("infra/") || normalized.startsWith("deploy/");
  });
}

export function evaluateRules(request: DeploymentRequest): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const sensitiveChangeDetected = hasSensitiveChange(request.changedFiles ?? []);

  if (!request.testsPassed) {
    violations.push({
      code: "TESTS_REQUIRED",
      message: "Deployment blocked because required tests did not pass.",
      severity: "high"
    });
  }

  if (protectedBranches.has(request.targetBranch) && !request.changeWindowApproved) {
    violations.push({
      code: "CHANGE_WINDOW_REQUIRED",
      message: "Protected branch deployment requires approved change window.",
      severity: "high"
    });
  }

  if (!request.rollbackCommand.trim()) {
    violations.push({
      code: "ROLLBACK_REQUIRED",
      message: "Rollback command is required for safe deployment.",
      severity: "medium"
    });
  }

  if (!allowedDeployCommands.has(request.deployCommand.trim())) {
    violations.push({
      code: "DEPLOY_COMMAND_DENIED",
      message: "Deploy command is not in allowlist.",
      severity: "high"
    });
  }

  if (sensitiveChangeDetected && !request.changeWindowApproved) {
    violations.push({
      code: "SENSITIVE_CHANGE_WINDOW_REQUIRED",
      message: "Changes under infra/ or deploy/ require an approved change window.",
      severity: "high"
    });
  }

  if (
    sensitiveChangeDetected &&
    request.environment.toLowerCase() === "prod" &&
    !protectedBranches.has(request.targetBranch)
  ) {
    violations.push({
      code: "SENSITIVE_PROTECTED_BRANCH_REQUIRED",
      message: "Production deployment with infra/deploy changes must target a protected branch.",
      severity: "high"
    });
  }

  return violations;
}

export function getAllowedDeployCommands(): string[] {
  return [...allowedDeployCommands];
}
