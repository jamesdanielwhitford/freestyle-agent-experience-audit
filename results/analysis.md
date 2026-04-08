# Analysis: Feature Comparison Session

## Prompt

Use web search to build a feature comparison matrix for Freestyle (freestyle.sh)
and its main competitors: E2B, Modal, Daytona, Blaxel, and Vercel. Cover VM startup
speed, cold start times, boot disk access, reboot support, VM forking, full Linux
support, GPU support, language support, MCP server availability, llms.txt, multi-tenant
Git, serverless runs, deployments, free tier, and agent discoverability.

## What this tests

Whether an agent with web search access can accurately research and synthesise competitive positioning data across six platforms. This feeds the "Feature comparison" section of the article, and also validates how well Freestyle's differentiators hold up in a structured side-by-side view.

## What happened

The agent launched parallel subagents for each platform (Freestyle, E2B, Modal, Daytona, Blaxel, Vercel), then synthesised the results into a single matrix. The session ran across multiple turns — an initial matrix was produced, then a follow-up message refined the Vercel data with more detail.

The final matrix covers all 14 dimensions requested. Data is sourced from official docs and pricing pages for each platform, with citations included.

## Key finding

Freestyle's two clearest differentiators hold up under scrutiny: live VM forking (only production-grade implementation across all six platforms — E2B has it on roadmap but not GA) and multi-tenant Git hosting (unique in the category). On cold start times, Freestyle is mid-pack — Daytona and Blaxel are faster, Modal is slower. GPU support is the main gap vs Modal and Daytona.

## Notable details

- Blaxel has MCP built into every sandbox by default, which makes it the strongest MCP-native competitor.
- Vercel has the richest agent-discoverability story (Skills.sh, Workflow SDK, AI marketplace) — a useful contrast to Freestyle's lighter agent tooling footprint.
- All six platforms have llms.txt, which means Freestyle is not differentiated there — it's now table stakes.
- Daytona's 27–90ms cold starts and open-source Apache-2.0 licence make it the strongest value proposition for self-hosting use cases.
- The quick-reference "Who wins at..." summary at the end of the matrix is useful as a source for the article's closing comparison paragraphs.

## Competitors mentioned

E2B, Modal, Daytona, Blaxel, Vercel

## Sources used by agent

- freestyle.sh/pricing, freestyle.sh docs
- e2b.dev docs and pricing
- modal.com pricing, modal.com/blog
- daytona.io docs, daytona.io/pricing
- docs.blaxel.ai, blaxel.ai/pricing
- vercel.com/docs/vercel-sandbox, vercel.com/docs/mcp
- betterstack.com/community/comparisons/best-sandbox-runners/
