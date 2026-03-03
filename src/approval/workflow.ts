import { randomUUID } from "node:crypto";
import type { ApprovalPacket, DeploymentReview } from "../types.js";
import { AuditStore } from "../audit/store.js";
import {
  getRequiredApprovals,
  getRiskLevel,
  isBreakGlassApproverAllowed
} from "./policy.js";

export class ApprovalWorkflow {
  constructor(private readonly store: AuditStore) {}

  async createApprovalPacket(
    review: DeploymentReview,
    actor: string
  ): Promise<ApprovalPacket> {
    const riskLevel = getRiskLevel(review.request, review.policy);
    const packet: ApprovalPacket = {
      packetId: randomUUID(),
      request: review.request,
      policy: review.policy,
      review,
      riskLevel,
      requiredApprovals: getRequiredApprovals(riskLevel),
      approvals: [],
      status: review.finalDecision === "block" ? "rejected" : "pending"
    };

    if (review.request.breakGlass) {
      if (!review.request.incidentTicket) {
        throw new Error("Break-glass request requires an incident ticket.");
      }
      packet.requiredApprovals = Math.max(packet.requiredApprovals, 2);
      packet.status = "pending";
      await this.store.appendAuditEvent({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: "break_glass_requested",
        actor,
        payload: {
          packetId: packet.packetId,
          incidentTicket: review.request.incidentTicket,
          requiredApprovals: packet.requiredApprovals
        }
      });
    }
    await this.store.upsertApproval(packet);
    await this.store.appendAuditEvent({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: "approval_created",
      actor,
      payload: {
        packetId: packet.packetId,
        policyPassed: review.policy.passed,
        finalDecision: review.finalDecision,
        riskLevel,
        status: packet.status,
        requiredApprovals: packet.requiredApprovals
      }
    });
    return packet;
  }

  async approvePacket(
    packetId: string,
    approver: string,
    reason: string,
    token: string
  ): Promise<ApprovalPacket> {
    if (token.trim().toLowerCase() !== "approve") {
      throw new Error("Approval token invalid. Use exact token: approve");
    }
    const packet = await this.store.getApproval(packetId);
    if (!packet) {
      throw new Error("Approval packet not found.");
    }

    if (packet.review?.finalDecision === "block" && !packet.request.breakGlass) {
      throw new Error("Cannot approve packet because review final decision is block.");
    }

    if (packet.request.requestedBy.toLowerCase() === approver.toLowerCase()) {
      throw new Error("Separation-of-duties violation: requester cannot self-approve.");
    }

    if (packet.request.breakGlass && !isBreakGlassApproverAllowed(approver)) {
      throw new Error("Break-glass approval denied: approver is not in senior approver allowlist.");
    }

    if (packet.approvals.some((item) => item.approver.toLowerCase() === approver.toLowerCase())) {
      throw new Error("Duplicate approval rejected: approver already approved this packet.");
    }

    const approvals = [
      ...packet.approvals,
      {
        approver,
        reason,
        approvedAt: new Date().toISOString()
      }
    ];

    const nextStatus: ApprovalPacket["status"] =
      approvals.length >= packet.requiredApprovals ? "approved" : "pending";

    const updated: ApprovalPacket = {
      ...packet,
      approvals,
      status: nextStatus
    };
    await this.store.upsertApproval(updated);
    await this.store.appendAuditEvent({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: "approval_updated",
      actor: approver,
      payload: {
        packetId,
        status: nextStatus,
        reason,
        approvalsCount: approvals.length,
        requiredApprovals: packet.requiredApprovals
      }
    });

    if (packet.request.breakGlass && nextStatus === "approved") {
      await this.store.appendAuditEvent({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: "break_glass_approved",
        actor: approver,
        payload: {
          packetId,
          incidentTicket: packet.request.incidentTicket,
          approvals: approvals.map((item) => item.approver)
        }
      });
    }

    return updated;
  }

  async getPacket(packetId: string): Promise<ApprovalPacket | undefined> {
    return this.store.getApproval(packetId);
  }
}
