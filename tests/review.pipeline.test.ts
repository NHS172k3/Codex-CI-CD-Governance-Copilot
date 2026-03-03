import { describe, expect, test } from "vitest";
import { GovernanceTools } from "../src/mcp/tools.js";

describe("reviewDeployment", () => {
  test("returns blocked final decision for high severity violation", async () => {
    const previousCodexKey = process.env.CODEX_API_KEY;
    const previousOpenAiKey = process.env.OPENAI_API_KEY;
    delete process.env.CODEX_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const tools = new GovernanceTools();
    const review = await tools.reviewDeployment(
      {
        requestId: "r1",
        repo: "payments",
        targetBranch: "feature/infra-change",
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
      "high"
    );

    expect(review.passed).toBe(false);
    expect(review.finalDecision).toBe("block");
    expect(review.codex.source).toBe("fallback");
    expect(review.violations.some((item) => item.severity === "high")).toBe(true);

    const packet = await tools.createApprovalPacket(review.request, review.request.requestedBy);
    expect(packet.riskLevel).toBe("critical");
    expect(packet.requiredApprovals).toBe(2);

    if (previousCodexKey) {
      process.env.CODEX_API_KEY = previousCodexKey;
    }
    if (previousOpenAiKey) {
      process.env.OPENAI_API_KEY = previousOpenAiKey;
    }
  });
});
