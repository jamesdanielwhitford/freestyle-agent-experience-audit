# Onboarding + Hello World Session Analysis

## Prompts
1. "I want to get started with Freestyle (freestyle.sh) to run some sandboxed VMs. Get me set up with an account and an API key I can use."
2. "Before I sign up manually, is there a CLI tool, MCP server, or any other programmatic way to create a Freestyle account and get API credentials without going through the web UI?"
3. "I added an api key to the .env file. Use the Freestyle API to create a new VM and run 'echo hello world' in it. Show me the output."

## What this tests
Stage 2 onboarding — given a named product, can an AI agent find and follow the getting-started path accurately, then successfully execute a real API call to create a VM and run a command?

## What happened

**Prompt 1 (account setup):** The agent used web search (via a subagent) to research the signup flow. It returned accurate instructions: sign up at dash.freestyle.sh, no credit card required, generate an API key from the dashboard, install the SDK (Node or Python), and set the key as an environment variable. Links provided were all correct. The response was concise and actionable.

**Prompt 2 (programmatic signup):** The agent again used web search to investigate whether there was a CLI, MCP server, or OAuth flow for account creation. The research was thorough — it checked the npm package, GitHub org, and MCP server docs. The answer was accurate: account creation requires the web UI, the initial API key must also come from the dashboard, and the MCP server (`freestyle-docs`) is read-only documentation only. It correctly noted that once an initial key is in hand, sub-identities and scoped tokens can be generated programmatically.

**Prompt 3 (hello world VM):** After the user added a `.env` file with the API key, the agent researched the Freestyle SDK API, found the correct `freestyle.vms.create()` + `vm.exec()` pattern, created a `run.mjs` script, installed `freestyle-sandboxes` and `dotenv`, and ran the script. It succeeded on the first attempt:
```
stdout: hello world
exit code: 0
```
The entire flow from empty folder to working VM output took a single session with no errors or retries.

## Key finding
The onboarding experience is smooth for a named-product task. The agent navigated signup, SDK installation, and a live API call without friction. The only limitation is the hard requirement for manual signup — there is no programmatic bootstrap path. The agent correctly identified this and explained it clearly, which means the lack of a CLI/OAuth path is a discoverable fact rather than a hidden gap.

## Notable details
- The agent relied on web search for all three prompts rather than using training data alone — suggesting Freestyle docs are findable and up-to-date enough for agents to pull accurate information.
- The `freestyle-sandboxes` SDK includes a `dotenv` integration that injects the API key automatically, which the agent picked up without needing special guidance.
- Session context at end of run: 25.4k/200k tokens (13%) — a lightweight session.
- No screenshots or context files from the user were meaningful to the session outcome; the agent worked entirely from the .env key and web search.

## Onboarding score
**Pass** — Account setup instructions were accurate, SDK usage was correct, and the hello world VM ran successfully on the first attempt.
