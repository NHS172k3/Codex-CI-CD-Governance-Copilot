import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { DeploymentRequest } from "../types.js";

export const deploymentRequestSchema = z.object({
  requestId: z.string(),
  repo: z.string(),
  targetBranch: z.string(),
  environment: z.string(),
  changedFiles: z.array(z.string()),
  breakGlass: z.boolean().default(false),
  incidentTicket: z.string().optional(),
  deployCommand: z.string(),
  rollbackCommand: z.string(),
  testsPassed: z.boolean(),
  changeWindowApproved: z.boolean(),
  requestedBy: z.string(),
  requestedAt: z.string()
});

export const deploymentRequestMcpInputSchema = {
  type: "object",
  properties: {
    requestId: { type: "string" },
    repo: { type: "string" },
    targetBranch: { type: "string" },
    environment: { type: "string" },
    changedFiles: { type: "array", items: { type: "string" } },
    breakGlass: { type: "boolean" },
    incidentTicket: { type: "string" },
    deployCommand: { type: "string" },
    rollbackCommand: { type: "string" },
    testsPassed: { type: "boolean" },
    changeWindowApproved: { type: "boolean" },
    requestedBy: { type: "string" },
    requestedAt: { type: "string" }
  },
  required: [
    "requestId",
    "repo",
    "targetBranch",
    "environment",
    "changedFiles",
    "deployCommand",
    "rollbackCommand",
    "testsPassed",
    "changeWindowApproved",
    "requestedBy",
    "requestedAt"
  ]
} as const;

export function toDeploymentRequest(payload: Record<string, unknown>): DeploymentRequest {
  const changedFiles = Array.isArray(payload.changedFiles)
    ? payload.changedFiles.map((item) => String(item))
    : [];

  return {
    requestId: String(payload.requestId ?? randomUUID()),
    repo: String(payload.repo ?? "unknown-repo"),
    targetBranch: String(payload.targetBranch ?? "main"),
    environment: String(payload.environment ?? "staging"),
    changedFiles,
    breakGlass: Boolean(payload.breakGlass),
    incidentTicket:
      typeof payload.incidentTicket === "string" && payload.incidentTicket.trim().length > 0
        ? payload.incidentTicket.trim()
        : undefined,
    deployCommand: String(payload.deployCommand ?? "npm run deploy:staging"),
    rollbackCommand: String(payload.rollbackCommand ?? "npm run rollback:staging"),
    testsPassed: Boolean(payload.testsPassed),
    changeWindowApproved: Boolean(payload.changeWindowApproved),
    requestedBy: String(payload.requestedBy ?? "developer"),
    requestedAt: String(payload.requestedAt ?? new Date().toISOString())
  };
}
