import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { ApprovalPacket, AuditEvent } from "../types.js";
import { APPROVALS_FILE, AUDIT_DIR, AUDIT_LOG_FILE } from "./schema.js";

export class AuditStore {
  constructor(private readonly baseDir: string = process.cwd()) {}

  private get dataDir(): string {
    return join(this.baseDir, AUDIT_DIR);
  }

  private get auditLogPath(): string {
    return join(this.dataDir, AUDIT_LOG_FILE);
  }

  private get approvalsPath(): string {
    return join(this.dataDir, APPROVALS_FILE);
  }

  async init(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
  }

  async appendAuditEvent(event: AuditEvent): Promise<void> {
    await this.init();
    await appendFile(this.auditLogPath, `${JSON.stringify(event)}\n`, "utf-8");
  }

  async readAuditEvents(limit = 50): Promise<AuditEvent[]> {
    await this.init();
    try {
      const content = await readFile(this.auditLogPath, "utf-8");
      const lines = content
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .slice(-limit);
      return lines.map((line) => JSON.parse(line) as AuditEvent);
    } catch {
      return [];
    }
  }

  async upsertApproval(packet: ApprovalPacket): Promise<void> {
    await this.init();
    const packets = await this.readApprovals();
    const next = packets.filter((item) => item.packetId !== packet.packetId);
    next.push(packet);
    await writeFile(this.approvalsPath, JSON.stringify(next, null, 2), "utf-8");
  }

  async readApprovals(): Promise<ApprovalPacket[]> {
    await this.init();
    try {
      const content = await readFile(this.approvalsPath, "utf-8");
      return JSON.parse(content) as ApprovalPacket[];
    } catch {
      return [];
    }
  }

  async getApproval(packetId: string): Promise<ApprovalPacket | undefined> {
    const packets = await this.readApprovals();
    return packets.find((packet) => packet.packetId === packetId);
  }
}
