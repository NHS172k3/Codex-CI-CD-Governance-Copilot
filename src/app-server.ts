import "dotenv/config";
import { createServer } from "node:http";
import { GovernanceTools } from "./mcp/tools.js";
import { toDeploymentRequest } from "./request/deployment-request.js";
import { parseSeverityThreshold } from "./policy/severity.js";

const tools = new GovernanceTools();
const port = Number(process.env.PORT ?? "8787");

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
}

async function readJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

const server = createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      json(res, 404, { error: "Not found" });
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      json(res, 200, { status: "ok", service: "codex-cicd-governance-app" });
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/audit")) {
      const url = new URL(req.url, `http://localhost:${port}`);
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const events = await tools.getAuditTrail(Number.isNaN(limit) ? 20 : limit);
      json(res, 200, events);
      return;
    }

    if (req.method === "GET" && req.url === "/summary") {
      const summary = await tools.getGovernanceSummary();
      json(res, 200, summary);
      return;
    }

    if (req.method === "POST" && req.url === "/plan") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const request = toDeploymentRequest(body);
      const packet = await tools.createApprovalPacket(request, request.requestedBy);
      json(res, 200, packet);
      return;
    }

    if (req.method === "POST" && req.url === "/approve") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const packetId = String(body.packetId ?? "");
      if (!packetId) {
        json(res, 400, { error: "packetId is required" });
        return;
      }
      const result = await tools.approveDeploy(
        packetId,
        String(body.approver ?? "tech-lead"),
        String(body.reason ?? "Approved after review"),
        String(body.token ?? "")
      );
      json(res, 200, result);
      return;
    }

    if (req.method === "POST" && req.url === "/deploy") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const packetId = String(body.packetId ?? "");
      if (!packetId) {
        json(res, 400, { error: "packetId is required" });
        return;
      }
      const result = await tools.executeDeploy(packetId);
      json(res, 200, result);
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/packet")) {
      const url = new URL(req.url, `http://localhost:${port}`);
      const packetId = url.searchParams.get("id") ?? "";
      if (!packetId) {
        json(res, 400, { error: "packet id is required via /packet?id=<packetId>" });
        return;
      }
      const packet = await tools.getApprovalPacket(packetId);
      if (!packet) {
        json(res, 404, { error: "Approval packet not found" });
        return;
      }
      json(res, 200, packet);
      return;
    }

    if (req.method === "POST" && req.url === "/explain") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const request = toDeploymentRequest(body);
      const failOn = parseSeverityThreshold(
        typeof body.failOn === "string" ? body.failOn : undefined
      );
      const explanation = await tools.explainRiskWithCodex(request, failOn);
      json(res, 200, explanation);
      return;
    }

    if (req.method === "POST" && req.url === "/review") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const request = toDeploymentRequest(body);
      const failOn = parseSeverityThreshold(
        typeof body.failOn === "string" ? body.failOn : undefined
      );
      const review = await tools.reviewDeployment(request, failOn);
      json(res, 200, review);
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown app server error";
    json(res, 500, { error: message });
  }
});

server.listen(port, () => {
  process.stdout.write(`Governance App Server listening on http://localhost:${port}\n`);
});
