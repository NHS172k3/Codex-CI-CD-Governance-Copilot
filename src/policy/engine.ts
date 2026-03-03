import type { DeploymentRequest, PolicyResult } from "../types.js";
import { evaluateRules } from "./rules.js";
import { getHighestSeverity } from "./severity.js";

export function evaluateDeploymentPolicy(request: DeploymentRequest): PolicyResult {
  const violations = evaluateRules(request);
  return {
    passed: violations.length === 0,
    violations,
    highestSeverity: getHighestSeverity(violations),
    evaluatedAt: new Date().toISOString()
  };
}
