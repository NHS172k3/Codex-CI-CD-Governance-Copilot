import { randomUUID } from "node:crypto";
import { AuditStore } from "../audit/store.js";
import { ApprovalWorkflow } from "../approval/workflow.js";
import { DeployExecutor } from "../deploy/executor.js";
import { evaluateDeploymentPolicy } from "../policy/engine.js";
import { shouldBlockByThreshold } from "../policy/severity.js";
import { generateCodexRiskExplanation } from "../ai/codex-explainer.js";
import type { SeverityThreshold } from "../policy/severity.js";
import type { DeploymentRequest, DeploymentReview, GovernanceSummary } from "../types.js";

export class GovernanceTools {
  private readonly store = new AuditStore();
  private readonly approval = new ApprovalWorkflow(this.store);
  private readonly executor = new DeployExecutor(this.store);

  async assessDeployRisk(request: DeploymentRequest) {
    await this.store.appendAuditEvent({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: "request_received",
      actor: request.requestedBy,
      payload: { requestId: request.requestId, repo: request.repo, environment: request.environment }
    });

    const policy = evaluateDeploymentPolicy(request);
    await this.store.appendAuditEvent({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: "policy_evaluated",
      actor: request.requestedBy,
      payload: { requestId: request.requestId, passed: policy.passed, violations: policy.violations }
    });

    return policy;
  }

  async createApprovalPacket(request: DeploymentRequest, actor: string) {
    const review = await this.reviewDeployment(request, "high");
    return this.approval.createApprovalPacket(review, actor);
  }

  async approveDeploy(packetId: string, approver: string, reason: string, token: string) {
    return this.approval.approvePacket(packetId, approver, reason, token);
  }

  async executeDeploy(packetId: string) {
    const packet = await this.approval.getPacket(packetId);
    if (!packet) {
      throw new Error("Approval packet not found.");
    }
    return this.executor.execute(packet);
  }

  async getAuditTrail(limit = 50) {
    return this.store.readAuditEvents(limit);
  }

  async getApprovalPacket(packetId: string) {
    return this.approval.getPacket(packetId);
  }

  async getGovernanceSummary(): Promise<GovernanceSummary> {
    const events = await this.store.readAuditEvents(500);
    const count = (eventType: string): number =>
      events.filter((event) => event.eventType === eventType).length;

    return {
      reviewsTotal: count("policy_evaluated"),
      blockedReviews: events.filter(
        (event) =>
          event.eventType === "approval_created" &&
          (event.payload.finalDecision as string | undefined) === "block"
      ).length,
      breakGlassRequests: count("break_glass_requested"),
      approvedPackets: events.filter(
        (event) =>
          event.eventType === "approval_updated" &&
          (event.payload.status as string | undefined) === "approved"
      ).length,
      deploymentsSucceeded: events.filter(
        (event) =>
          event.eventType === "execution_completed" &&
          (event.payload.success as boolean | undefined) === true
      ).length,
      deploymentsFailed: events.filter(
        (event) =>
          event.eventType === "execution_completed" &&
          (event.payload.success as boolean | undefined) === false
      ).length
    };
  }

  async explainRiskWithCodex(
    request: DeploymentRequest,
    failOn: SeverityThreshold,
    existingPolicy?: Awaited<ReturnType<GovernanceTools["assessDeployRisk"]>>
  ) {
    const policy = existingPolicy ?? (await this.assessDeployRisk(request));
    const explanation = await generateCodexRiskExplanation(request, policy, failOn);
    await this.store.appendAuditEvent({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: "ai_explanation_generated",
      actor: request.requestedBy,
      payload: {
        requestId: request.requestId,
        source: explanation.source,
        model: explanation.model,
        recommendedDecision: explanation.recommendedDecision,
        failOn
      }
    });
    return explanation;
  }

  async reviewDeployment(request: DeploymentRequest, failOn: SeverityThreshold): Promise<DeploymentReview> {
    const policy = await this.assessDeployRisk(request);
    const codex = await this.explainRiskWithCodex(request, failOn, policy);
    const blocked = shouldBlockByThreshold(policy.violations, failOn);

    return {
      passed: !blocked,
      finalDecision: blocked ? "block" : "approve_with_human_gate",
      failOn,
      request,
      policy,
      policyPassed: policy.passed,
      highestSeverity: policy.highestSeverity ?? null,
      violations: policy.violations,
      evaluatedAt: policy.evaluatedAt,
      codex
    };
  }
}
