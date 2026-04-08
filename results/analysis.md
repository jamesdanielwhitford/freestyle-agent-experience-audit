# Integration Session Analysis

## Prompts
1. "I want to use Freestyle to spin up a VM with Python and run a script inside it that does some expensive setup — install a few packages (pandas, numpy, requests) and initialise a small SQLite database with some seed data. Once the setup is done, snapshot the VM so I don't have to repeat the setup. The VM should be ready for the next step."
2. "Now fork that snapshotted VM 3 times and run a different data-processing script in each fork simultaneously. Fork 1 should query the database and return the row count. Fork 2 should compute the mean of a numpy array. Fork 3 should fetch the current Bitcoin price from a public API using requests. Collect all three results and shut down the forks when done."
3. "Now write a standalone script that automates this whole flow end-to-end: setup VM, install dependencies, snapshot, fork 3 times, run the three scripts in parallel, collect results, and tear everything down."

## What this tests
Stage 3 integration — can an AI agent use the Freestyle API to execute a realistic, multi-step workflow: VM creation, environment setup, snapshotting, parallel forking, and teardown. This tests both SDK knowledge and resilience to environment surprises.

## What happened

**Prompt 1 (setup + snapshot):** The agent started by using web search to research the Freestyle SDK API, finding `freestyle.vms.create()`, `vm.exec()`, `vm.snapshot()`, and the `snapshotId` pattern for creating from a snapshot. It then wrote a `setup.mjs` script and ran it. The first attempt failed immediately: `pip: not found`. The agent corrected to `python3 -m pip`, but then hit `python3: not found` — the Freestyle base VM image does not include Python.

The agent ran additional diagnostic VMs to discover the environment: Debian 13 (trixie) with apt-get available. It used a third throwaway VM to confirm that `apt-get install python3 python3-pip` followed by `pip3 install pandas numpy requests --break-system-packages` worked (Debian 13 requires the `--break-system-packages` flag). After this exploration phase it wrote the final working script, which ran cleanly:
- Python 3.13.5 installed via apt-get
- pandas, numpy, requests installed via pip3
- SQLite DB seeded with 5 rows, verified
- Snapshot `sc-8y4ueg9ozrcg7y6bpp43` saved, setup VM suspended

During this process the agent spun up 2-3 exploratory VMs that were left running. It later cleaned these up when prompted. Final result was correct.

**Prompt 2 (parallel forks):** The agent read the snapshot ID from `snapshot-id.txt`, wrote a `forks.mjs` script using `freestyle.vms.create({ snapshotId })` to spin up 3 VMs, and ran all 3 Python scripts in parallel using `Promise.all`. All three succeeded on the first attempt:
- Fork 1 (DB row count): `5`
- Fork 2 (numpy mean): `55.0`
- Fork 3 (Bitcoin price): `$71,850.00` (live from Kraken API)

One obstacle: the agent's initial script used coindesk.com for the Bitcoin price, which was inaccessible from Freestyle VMs. It self-corrected to the Kraken public API without user intervention.

**Prompt 3 (end-to-end script):** The agent combined both phases into a single `run.mjs` script that goes setup → snapshot → fork → parallel run → teardown. It ran on the first attempt and produced identical results, confirming full reproducibility.

## Key finding
The integration task succeeded end-to-end, but required meaningful exploration to discover environment details — specifically that Python is not pre-installed on the base VM and that Debian 13's pip requires `--break-system-packages`. An experienced developer would know to check the base image before writing setup scripts, but the agent worked it out through trial and error across 3-4 iterations. The forking and parallel execution primitives (`vms.create({ snapshotId })` + `Promise.all`) worked cleanly once the environment was understood.

## Notable details
- The base Freestyle VM image is Debian 13 (trixie), with no Python pre-installed. This is a notable gotcha for Python users.
- The Freestyle SDK's `--break-system-packages` requirement is specific to Debian 13's pip isolation policy, not a Freestyle limitation. The agent discovered this through testing.
- coindesk.com is inaccessible from Freestyle VMs. Kraken's public API (`api.kraken.com`) worked fine, suggesting standard HTTPS outbound networking is unrestricted.
- The agent created stray VMs during the exploration phase and did not clean them up immediately. It later deleted them when it became aware of the accumulation.
- The `vm.snapshot()` API returns a `snapshotId` directly. `vms.create({ snapshotId })` resumes from it. This pattern was correctly used without issue.
- The end-to-end `run.mjs` script (prompt 3) ran in approximately 2 minutes wall time.

## Integration score
**Pass with friction** — All three tasks completed successfully and the final script runs end-to-end. The friction was in the environment discovery phase (Python not installed, pip flags), not in the Freestyle API itself. The API surface was used correctly throughout once the agent understood the base image.
