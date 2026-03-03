export type DeploymentRequest = {
  requestId: string;
  repo: string;
  targetBranch: string;
  environment: string;
  changedFiles: string[];
  breakGlass: boolean;
  incidentTicket?: string;
  deployCommand: string;
  rollbackCommand: string;
  testsPassed: boolean;
  changeWindowApproved: boolean;
  requestedBy: string;
  requestedAt: string;
};

export type PolicyViolation = {
  code: string;
  message: string;
  severity: "high" | "medium" | "low";
};

export type PolicyResult = {
  passed: boolean;
  violations: PolicyViolation[];
  highestSeverity?: PolicyViolation["severity"] | null;
  evaluatedAt: string;
};

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ApprovalRecord = {
  approver: string;
  reason: string;
  approvedAt: string;
};

export type ApprovalPacket = {
  packetId: string;
  request: DeploymentRequest;
  policy: PolicyResult;
  review?: DeploymentReview;
  riskLevel: RiskLevel;
  requiredApprovals: number;
  approvals: ApprovalRecord[];
  status: "pending" | "approved" | "rejected";
};

export type ExecutionRecord = {
  packetId: string;
  attemptedAt: string;
  command: string;
  success: boolean;
  output: string;
};

export type AuditEvent = {
  id: string;
  timestamp: string;
  eventType:
    | "request_received"
    | "policy_evaluated"
    | "ai_explanation_generated"
    | "break_glass_requested"
    | "break_glass_approved"
    | "approval_created"
    | "approval_updated"
    | "execution_attempted"
    | "execution_completed";
  actor: string;
  payload: Record<string, unknown>;
};

export type GovernanceSummary = {
  reviewsTotal: number;
  blockedReviews: number;
  breakGlassRequests: number;
  approvedPackets: number;
  deploymentsSucceeded: number;
  deploymentsFailed: number;
};

export type CodexReview = {
  source: "codex" | "fallback";
  model: string;
  recommendedDecision: "approve_with_caution" | "block";
  narrative: string;
  checklist: string[];
  threadId?: string | null;
  error?: string;
};

export type DeploymentReview = {
  passed: boolean;
  finalDecision: "approve_with_human_gate" | "block";
  failOn: "high" | "medium" | "low" | "none";
  request: DeploymentRequest;
  policy: PolicyResult;
  policyPassed: boolean;
  highestSeverity: PolicyViolation["severity"] | null;
  violations: PolicyViolation[];
  evaluatedAt: string;
  codex: CodexReview;
};
