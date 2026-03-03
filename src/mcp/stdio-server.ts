import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { GovernanceTools } from "./tools.js";
import type { DeploymentRequest } from "../types.js";
import {
  deploymentRequestMcpInputSchema,
  deploymentRequestSchema
} from "../request/deployment-request.js";

function asText(data: unknown): { content: { type: "text"; text: string }[] } {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
  };
}

async function main() {
  const tools = new GovernanceTools();
  const server = new Server(
    {
      name: "codex-cicd-governance-mcp",
      version: "0.2.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const toolDescriptors = [
    {
      name: "assess_deploy_risk",
      description: "Evaluate deployment request against governance policy rules.",
      inputSchema: deploymentRequestMcpInputSchema
    },
    {
      name: "create_approval_packet",
      description: "Create a governance approval packet for deployment.",
      inputSchema: {
        type: "object",
        properties: {
          actor: { type: "string" },
          request: deploymentRequestMcpInputSchema
        },
        required: ["actor", "request"]
      }
    },
    {
      name: "approve_deploy",
      description: "Approve a deployment packet with explicit token and reason.",
      inputSchema: {
        type: "object",
        properties: {
          packetId: { type: "string" },
          approver: { type: "string" },
          reason: { type: "string" },
          token: { type: "string" }
        },
        required: ["packetId", "approver", "reason", "token"]
      }
    },
    {
      name: "execute_deploy",
      description: "Execute an approved deployment packet.",
      inputSchema: {
        type: "object",
        properties: {
          packetId: { type: "string" }
        },
        required: ["packetId"]
      }
    },
    {
      name: "get_approval_packet",
      description: "Get approval packet details including approval progress and required quorum.",
      inputSchema: {
        type: "object",
        properties: {
          packetId: { type: "string" }
        },
        required: ["packetId"]
      }
    },
    {
      name: "get_audit_trail",
      description: "Return recent audit events.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number" }
        },
        required: []
      }
    },
    {
      name: "get_governance_summary",
      description: "Return high-level governance metrics for presentation and operations.",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "explain_risk_with_codex",
      description: "Generate Codex risk narrative while preserving deterministic policy gates.",
      inputSchema: {
        type: "object",
        properties: {
          request: deploymentRequestMcpInputSchema,
          failOn: { type: "string", enum: ["high", "medium", "low", "none"] }
        },
        required: ["request", "failOn"]
      }
    },
    {
      name: "policy_review",
      description: "Run Codex-first deployment review with deterministic policy gate and human-governed final decision.",
      inputSchema: {
        type: "object",
        properties: {
          request: deploymentRequestMcpInputSchema,
          failOn: { type: "string", enum: ["high", "medium", "low", "none"] }
        },
        required: ["request", "failOn"]
      }
    }
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDescriptors
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    if (toolName === "assess_deploy_risk") {
      const deployRequest = deploymentRequestSchema.parse(args) as DeploymentRequest;
      return asText(await tools.assessDeployRisk(deployRequest));
    }

    if (toolName === "create_approval_packet") {
      const actor = z.string().parse(args.actor);
      const deployRequest = deploymentRequestSchema.parse(args.request) as DeploymentRequest;
      return asText(await tools.createApprovalPacket(deployRequest, actor));
    }

    if (toolName === "approve_deploy") {
      const packetId = z.string().parse(args.packetId);
      const approver = z.string().parse(args.approver);
      const reason = z.string().parse(args.reason);
      const token = z.string().parse(args.token);
      return asText(await tools.approveDeploy(packetId, approver, reason, token));
    }

    if (toolName === "execute_deploy") {
      const packetId = z.string().parse(args.packetId);
      return asText(await tools.executeDeploy(packetId));
    }

    if (toolName === "get_approval_packet") {
      const packetId = z.string().parse(args.packetId);
      return asText(await tools.getApprovalPacket(packetId));
    }

    if (toolName === "get_audit_trail") {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      return asText(await tools.getAuditTrail(limit));
    }

    if (toolName === "get_governance_summary") {
      return asText(await tools.getGovernanceSummary());
    }

    if (toolName === "explain_risk_with_codex") {
      const deployRequest = deploymentRequestSchema.parse(args.request) as DeploymentRequest;
      const failOn = z.enum(["high", "medium", "low", "none"]).parse(args.failOn);
      return asText(await tools.explainRiskWithCodex(deployRequest, failOn));
    }

    if (toolName === "policy_review") {
      const deployRequest = deploymentRequestSchema.parse(args.request) as DeploymentRequest;
      const failOn = z.enum(["high", "medium", "low", "none"]).parse(args.failOn);
      return asText(await tools.reviewDeployment(deployRequest, failOn));
    }

    throw new Error(`Unknown tool: ${toolName}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`MCP server error: ${message}\n`);
  process.exit(1);
});
