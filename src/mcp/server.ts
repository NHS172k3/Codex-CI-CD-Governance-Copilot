import { GovernanceTools } from "./tools.js";

export function createMcpServer() {
  const tools = new GovernanceTools();
  return {
    name: "codex-cicd-governance-mcp",
    version: "0.1.0",
    tools
  };
}
