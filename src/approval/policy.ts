import type { DeploymentRequest, PolicyResult, RiskLevel } from "../types.js";

function containsSensitiveChange(changedFiles: string[]): boolean {
  return changedFiles.some((path) => {
    const normalized = path.replace(/\\/g, "/").toLowerCase();
    return normalized.startsWith("infra/") || normalized.startsWith("deploy/");
  });
}

export function getRiskLevel(request: DeploymentRequest, policy: PolicyResult): RiskLevel {
  const highViolations = policy.violations.filter((violation) => violation.severity === "high").length;
  const sensitiveChange = containsSensitiveChange(request.changedFiles);

  if (highViolations >= 2 || (request.environment.toLowerCase() === "prod" && sensitiveChange)) {
    return "critical";
  }
  if (highViolations > 0 || request.environment.toLowerCase() === "prod") {
    return "high";
  }
  if (!policy.passed || sensitiveChange) {
    return "medium";
  }
  return "low";
}

export function getRequiredApprovals(riskLevel: RiskLevel): number {
  if (riskLevel === "critical" || riskLevel === "high") {
    return 2;
  }
  return 1;
}

export function getBreakGlassApproverAllowlist(): string[] {
  const raw = process.env.BREAK_GLASS_APPROVERS ?? "";
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

export function isBreakGlassApproverAllowed(approver: string): boolean {
  const allowlist = getBreakGlassApproverAllowlist();
  if (allowlist.length === 0) {
    return true;
  }
  return allowlist.includes(approver.toLowerCase());
}
