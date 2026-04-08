# Response

Yes, Freestyle has solid agent tooling:

- **MCP server** at `https://docs.freestyle.sh/api/mcp/mcp` — add it to Claude Code with:
  ```
  claude mcp add --transport http https://docs.freestyle.sh/api/mcp/mcp
  ```
- **llms.txt** at `docs.freestyle.sh/llms.txt` (plus `/llms-full.txt`), with all docs pages available as markdown via `.md` suffix
- **SDKs**: `freestyle-sandboxes` (npm) and `freestyle` (pip)
- **Agent framework integrations**: Vercel AI SDK, Mastra, LangGraph (JS + Python), OpenAI SDK, Gemini SDK, PipeCat

No OpenAPI spec was found, but the MCP server and llms.txt cover most agent-consumption needs.

# Response 2

Done. The Freestyle MCP server is now configured locally for this project. You'll need to restart Claude Code for the new MCP server to load.
