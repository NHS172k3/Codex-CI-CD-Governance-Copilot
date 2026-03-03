import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type { ApprovalPacket, ExecutionRecord } from "../types.js";
import { AuditStore } from "../audit/store.js";
import { getAllowedDeployCommands } from "../policy/rules.js";

const execAsync = promisify(exec);

export class DeployExecutor {
  constructor(private readonly store: AuditStore) {}

  async execute(packet: ApprovalPacket): Promise<ExecutionRecord> {
    if (packet.status !== "approved") {
      throw new Error("Deployment blocked: packet is not approved.");
    }
    if (packet.approvals.length < packet.requiredApprovals) {
      throw new Error("Deployment blocked: approval quorum not satisfied.");
    }
    if (packet.request.breakGlass && !packet.request.incidentTicket) {
      throw new Error("Deployment blocked: break-glass packet requires incident ticket.");
    }
    const command = packet.request.deployCommand.trim();
    if (!getAllowedDeployCommands().includes(command)) {
      throw new Error("Deployment blocked: command not allowed.");
    }

    const attemptedAt = new Date().toISOString();
    await this.store.appendAuditEvent({
      id: randomUUID(),
      timestamp: attemptedAt,
      eventType: "execution_attempted",
      actor: packet.approvals[packet.approvals.length - 1]?.approver ?? "unknown",
      payload: {
        packetId: packet.packetId,
        command,
        approvals: packet.approvals.map((item) => item.approver)
      }
    });

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 60_000 });
      const output = `${stdout}${stderr}`.trim();
      const record: ExecutionRecord = {
        packetId: packet.packetId,
        attemptedAt,
        command,
        success: true,
        output
      };
      await this.store.appendAuditEvent({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: "execution_completed",
        actor: packet.approvals[packet.approvals.length - 1]?.approver ?? "unknown",
        payload: record
      });
      return record;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown execution error";
      const record: ExecutionRecord = {
        packetId: packet.packetId,
        attemptedAt,
        command,
        success: false,
        output: message
      };
      await this.store.appendAuditEvent({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: "execution_completed",
        actor: packet.approvals[packet.approvals.length - 1]?.approver ?? "unknown",
        payload: record
      });
      return record;
    }
  }
}
