import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { GovernanceTools } from "./mcp/tools.js";
import { parseSeverityThreshold } from "./policy/severity.js";
import type { DeploymentRequest, DeploymentReview, PolicyResult } from "./types.js";

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0 || index === process.argv.length - 1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function getBoolArg(name: string, fallback = false): boolean {
  const value = getArg(name);
  if (!value) {
    return fallback;
  }
  return value.toLowerCase() === "true";
}

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  npm run dev -- plan --repo <name> --branch <branch> --env <env> --deploy <command> --rollback <command> --tests <true|false> --change-window <true|false> --by <user> --changed-files <csv> [--break-glass <true|false>] [--incident-ticket <id>]",
      "  npm run dev -- approve --packet <packetId> --approver <name> --reason <text> --token approve",
      "  npm run dev -- deploy --packet <packetId>",
      "  npm run dev -- packet --packet <packetId>",
      "  npm run dev -- summary",
      "  npm run dev -- audit --limit <number>",
      "  npm run policy:review -- --repo <name> --branch <branch> --env <env> --deploy <command> --rollback <command> --tests <true|false> --change-window <true|false> --by <user> --changed-files <csv> [--break-glass <true|false>] [--incident-ticket <id>] --fail-on <high|medium|low|none>",
      "  npm run policy:check -- --repo <name> --branch <branch> --env <env> --deploy <command> --rollback <command> --tests <true|false> --change-window <true|false> --by <user> --changed-files <csv> [--break-glass <true|false>] [--incident-ticket <id>] --fail-on <high|medium|low|none>",
      "  npm run policy:explain -- --repo <name> --branch <branch> --env <env> --deploy <command> --rollback <command> --tests <true|false> --change-window <true|false> --by <user> --changed-files <csv> [--break-glass <true|false>] [--incident-ticket <id>] --fail-on <high|medium|low|none> [--policy-file <path>]"
    ].join("\n") + "\n"
  );
}

function parseCsvArg(name: string): string[] {
  const value = getArg(name);
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildRequestFromArgs(): DeploymentRequest {
  return {
    requestId: randomUUID(),
    repo: getArg("--repo") ?? "unknown-repo",
    targetBranch: getArg("--branch") ?? "main",
    environment: getArg("--env") ?? "staging",
    changedFiles: parseCsvArg("--changed-files"),
    breakGlass: getBoolArg("--break-glass", false),
    incidentTicket: getArg("--incident-ticket"),
    deployCommand: getArg("--deploy") ?? "npm run deploy:staging",
    rollbackCommand: getArg("--rollback") ?? "npm run rollback:staging",
    testsPassed: getBoolArg("--tests", false),
    changeWindowApproved: getBoolArg("--change-window", false),
    requestedBy: getArg("--by") ?? "developer",
    requestedAt: new Date().toISOString()
  };
}

async function loadPolicyFromFile(filePath: string): Promise<PolicyResult> {
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<PolicyResult>;
  const violations = Array.isArray(parsed.violations) ? parsed.violations : [];
  return {
    passed: Boolean(parsed.passed),
    violations,
    highestSeverity: parsed.highestSeverity ?? null,
    evaluatedAt: String(parsed.evaluatedAt ?? new Date().toISOString())
  };
}

function toLegacyPolicyCheck(review: DeploymentReview) {
  return {
    passed: review.passed,
    failOn: review.failOn,
    policyPassed: review.policyPassed,
    highestSeverity: review.highestSeverity,
    violations: review.violations,
    evaluatedAt: review.evaluatedAt
  };
}

async function run() {
  const command = process.argv[2];
  const tools = new GovernanceTools();

  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === "plan") {
    const request = buildRequestFromArgs();
    const packet = await tools.createApprovalPacket(request, request.requestedBy);
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
    return;
  }

  if (command === "policy-review") {
    const request = buildRequestFromArgs();
    const failOn = parseSeverityThreshold(getArg("--fail-on"));
    const review = await tools.reviewDeployment(request, failOn);
    process.stdout.write(`${JSON.stringify(review, null, 2)}\n`);
    if (!review.passed) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "policy-check") {
    const request = buildRequestFromArgs();
    const failOn = parseSeverityThreshold(getArg("--fail-on"));
    const review = await tools.reviewDeployment(request, failOn);
    const result = toLegacyPolicyCheck(review);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!review.passed) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "policy-explain") {
    const request = buildRequestFromArgs();
    const failOn = parseSeverityThreshold(getArg("--fail-on"));
    const policyFile = getArg("--policy-file");
    const existingPolicy = policyFile ? await loadPolicyFromFile(policyFile) : undefined;
    if (existingPolicy) {
      const explanation = await tools.explainRiskWithCodex(request, failOn, existingPolicy);
      process.stdout.write(`${JSON.stringify(explanation, null, 2)}\n`);
      return;
    }

    const review = await tools.reviewDeployment(request, failOn);
    process.stdout.write(`${JSON.stringify(review.codex, null, 2)}\n`);
    return;
  }

  if (command === "approve") {
    const packetId = getArg("--packet");
    if (!packetId) {
      throw new Error("--packet is required");
    }
    const result = await tools.approveDeploy(
      packetId,
      getArg("--approver") ?? "tech-lead",
      getArg("--reason") ?? "Approved after policy review",
      getArg("--token") ?? ""
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== "approved") {
      process.stdout.write(
        `Approval progress: ${result.approvals.length}/${result.requiredApprovals}. Additional approver required.\n`
      );
    }
    return;
  }

  if (command === "packet") {
    const packetId = getArg("--packet");
    if (!packetId) {
      throw new Error("--packet is required");
    }
    const packet = await tools.getApprovalPacket(packetId);
    if (!packet) {
      throw new Error("Approval packet not found.");
    }
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
    return;
  }

  if (command === "deploy") {
    const packetId = getArg("--packet");
    if (!packetId) {
      throw new Error("--packet is required");
    }
    const result = await tools.executeDeploy(packetId);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === "audit") {
    const limit = Number(getArg("--limit") ?? "20");
    const events = await tools.getAuditTrail(Number.isNaN(limit) ? 20 : limit);
    process.stdout.write(`${JSON.stringify(events, null, 2)}\n`);
    return;
  }

  if (command === "summary") {
    const summary = await tools.getGovernanceSummary();
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  printUsage();
  process.exitCode = 1;
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
