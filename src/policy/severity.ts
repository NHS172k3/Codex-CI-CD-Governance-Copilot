import type { PolicyViolation } from "../types.js";

export type SeverityLevel = PolicyViolation["severity"];
export type SeverityThreshold = SeverityLevel | "none";

const severityOrder: Record<SeverityLevel, number> = {
  low: 1,
  medium: 2,
  high: 3
};

export function getHighestSeverity(violations: PolicyViolation[]): SeverityLevel | null {
  let highest: SeverityLevel | null = null;
  for (const violation of violations) {
    if (!highest || severityOrder[violation.severity] > severityOrder[highest]) {
      highest = violation.severity;
    }
  }
  return highest;
}

export function isSeverityBlocked(
  severity: SeverityLevel,
  threshold: SeverityThreshold
): boolean {
  if (threshold === "none") {
    return false;
  }
  return severityOrder[severity] >= severityOrder[threshold];
}

export function shouldBlockByThreshold(
  violations: PolicyViolation[],
  threshold: SeverityThreshold
): boolean {
  if (threshold === "none") {
    return false;
  }
  return violations.some((violation) => isSeverityBlocked(violation.severity, threshold));
}

export function parseSeverityThreshold(value: string | undefined): SeverityThreshold {
  const normalized = (value ?? "high").toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low" || normalized === "none") {
    return normalized;
  }
  throw new Error("Invalid --fail-on value. Use one of: high, medium, low, none");
}
