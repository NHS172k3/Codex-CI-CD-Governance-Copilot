import { describe, expect, test } from "vitest";
import { generateCodexRiskExplanation } from "../src/ai/codex-explainer.js";

describe("generateCodexRiskExplanation", () => {
  test("falls back deterministically when CODEX_API_KEY and OPENAI_API_KEY are missing", async () => {
    const previousCodexKey = process.env.CODEX_API_KEY;
    const previousOpenAiKey = process.env.OPENAI_API_KEY;
    delete process.env.CODEX_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await generateCodexRiskExplanation(
      {
        requestId: "r1",
        repo: "repo",
        targetBranch: "feature/x",
        environment: "prod",
        changedFiles: ["infra/main.tf"],
        breakGlass: false,
        deployCommand: "npm run deploy:prod",
        rollbackCommand: "npm run rollback:prod",
        testsPassed: true,
        changeWindowApproved: true,
        requestedBy: "dev",
        requestedAt: new Date().toISOString()
      },
      {
        passed: false,
        violations: [
          {
            code: "SENSITIVE_PROTECTED_BRANCH_REQUIRED",
            message: "Requires protected branch",
            severity: "high"
          }
        ],
        highestSeverity: "high",
        evaluatedAt: new Date().toISOString()
      },
      "high"
    );

    expect(result.source).toBe("fallback");
    expect(result.recommendedDecision).toBe("block");
    expect(result.narrative.length).toBeGreaterThan(0);

    if (previousCodexKey) {
      process.env.CODEX_API_KEY = previousCodexKey;
    }
    if (previousOpenAiKey) {
      process.env.OPENAI_API_KEY = previousOpenAiKey;
    }
  });
});
