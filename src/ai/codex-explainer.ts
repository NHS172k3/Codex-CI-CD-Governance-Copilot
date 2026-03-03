import { Codex } from "@openai/codex-sdk";
import type { CodexReview, DeploymentRequest, PolicyResult } from "../types.js";
import { shouldBlockByThreshold, type SeverityThreshold } from "../policy/severity.js";

function createDeterministicExplanation(
  request: DeploymentRequest,
  policy: PolicyResult,
  failOn: SeverityThreshold,
  error?: string
): CodexReview {
  const blocked = shouldBlockByThreshold(policy.violations, failOn);
  const recommendation = blocked ? "block" : "approve_with_caution";
  const violationSummary =
    policy.violations.length === 0
      ? "No policy violations detected."
      : policy.violations.map((violation) => `${violation.code} (${violation.severity})`).join(", ");

  return {
    source: "fallback",
    model: process.env.CODEX_MODEL ?? "gpt-5.3-codex",
    recommendedDecision: recommendation,
    narrative: `Deterministic risk summary for ${request.repo} on ${request.environment}: ${violationSummary} Gate threshold is ${failOn}.`,
    checklist: [
      "Confirm rollout owner and on-call contact are assigned",
      "Validate rollback command in target environment",
      "Verify required tests and change-window state",
      "Document explicit human approval reason before execution"
    ],
    error
  };
}

export async function generateCodexRiskExplanation(
  request: DeploymentRequest,
  policy: PolicyResult,
  failOn: SeverityThreshold
): Promise<CodexReview> {
  const apiKey = process.env.CODEX_API_KEY ?? process.env.OPENAI_API_KEY;
  const model = process.env.CODEX_MODEL ?? "gpt-5.3-codex";

  if (!apiKey) {
    return createDeterministicExplanation(
      request,
      policy,
      failOn,
      "CODEX_API_KEY or OPENAI_API_KEY is not set"
    );
  }

  try {
    const codex = new Codex({ apiKey });
    const thread = codex.startThread({
      model,
      sandboxMode: "read-only",
      approvalPolicy: "never",
      skipGitRepoCheck: true,
      workingDirectory: process.cwd()
    });

    const outputSchema = {
      type: "object",
      properties: {
        recommendedDecision: {
          type: "string",
          enum: ["approve_with_caution", "block"]
        },
        narrative: { type: "string" },
        checklist: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["recommendedDecision", "narrative", "checklist"],
      additionalProperties: false
    } as const;

    const prompt = [
      "You are a release governance analyst.",
      "Output JSON only based on provided schema.",
      "Do not override deterministic gate; provide human-facing explanation.",
      JSON.stringify({ request, policy, failOn })
    ].join("\n\n");

    const turn = await thread.run(prompt, {
      outputSchema
    });

    const outputText = turn.finalResponse?.trim();
    if (!outputText) {
      return createDeterministicExplanation(request, policy, failOn, "Codex returned empty output");
    }

    const parsed = JSON.parse(outputText) as {
      recommendedDecision?: "approve_with_caution" | "block";
      narrative?: string;
      checklist?: string[];
    };

    const recommendedDecision =
      parsed.recommendedDecision === "block" ? "block" : "approve_with_caution";
    const checklist = Array.isArray(parsed.checklist)
      ? parsed.checklist.map((item) => String(item)).slice(0, 5)
      : [];

    return {
      source: "codex",
      model,
      recommendedDecision,
      narrative: String(parsed.narrative ?? "No narrative provided by Codex."),
      checklist,
      threadId: thread.id
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Codex API error";
    return createDeterministicExplanation(request, policy, failOn, message);
  }
}
