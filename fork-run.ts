/**
 * Freestyle VM Fork Script
 *
 * Boots from the pre-setup snapshot, forks it 3 times, runs a different
 * data-processing script in each fork in parallel, collects results, then
 * deletes all 3 forks.
 *
 * References:
 *   - https://docs.freestyle.sh/v2/vms/lifecycle (Forking section)
 *   - https://docs.freestyle.sh/v2/vms/templates-snapshots
 */

import { freestyle } from "freestyle-sandboxes";

const SNAPSHOT_ID = "sc-384beedcbj8sbwvqh8kt";
const VENV_PYTHON = "/opt/venv/bin/python";

async function main() {
  // Boot a base VM from the snapshot
  console.log("Booting VM from snapshot...");
  const { vm: base, vmId: baseId } = await freestyle.vms.create({
    snapshotId: SNAPSHOT_ID,
  });
  console.log(`Base VM ready: ${baseId}`);

  // fork() returns { forks: [{ vmId, vm }, ...] } and supports count option
  console.log("Forking 3 times...");
  const { forks } = await base.fork({ count: 3 });
  const [{ vm: fork1, vmId: forkId1 }, { vm: fork2, vmId: forkId2 }, { vm: fork3, vmId: forkId3 }] = forks;
  console.log(`Forks ready: ${forkId1}, ${forkId2}, ${forkId3}`);

  // Run all 3 tasks in parallel
  console.log("Running tasks in parallel...");
  const [result1, result2, result3] = await Promise.all([
    // Fork 1: query the SQLite database and return row counts
    fork1.exec({
      command: `${VENV_PYTHON} -c "
import sqlite3, json
conn = sqlite3.connect('/data/app.db')
cur = conn.cursor()
users = cur.execute('SELECT COUNT(*) FROM users').fetchone()[0]
products = cur.execute('SELECT COUNT(*) FROM products').fetchone()[0]
conn.close()
print(json.dumps({'task': 'db_row_count', 'users': users, 'products': products}))
"`,
    }),

    // Fork 2: compute the mean of a numpy array
    fork2.exec({
      command: `${VENV_PYTHON} -c "
import numpy as np, json
arr = np.array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
print(json.dumps({'task': 'numpy_mean', 'array': arr.tolist(), 'mean': float(np.mean(arr))}))
"`,
    }),

    // Fork 3: fetch current Bitcoin price from CoinGecko public API
    fork3.exec({
      command: `${VENV_PYTHON} -c "
import requests, json
resp = requests.get('https://api.coingecko.com/api/v3/simple/price', params={'ids': 'bitcoin', 'vs_currencies': 'usd'}, timeout=10)
resp.raise_for_status()
usd = resp.json()['bitcoin']['usd']
print(json.dumps({'task': 'btc_price', 'usd': usd}))
"`,
    }),
  ]);

  // Parse and display results
  console.log("\n=== Results ===");
  for (const [label, res] of [["Fork 1 (DB row count)", result1], ["Fork 2 (numpy mean)", result2], ["Fork 3 (BTC price)", result3]] as const) {
    const out = res.stdout?.trim();
    if (out) {
      console.log(`${label}:`, JSON.parse(out));
    } else {
      console.error(`${label} failed:`, res.stderr);
    }
  }

  // Delete all 3 forks
  console.log("\nShutting down forks...");
  await Promise.all([
    freestyle.vms.delete({ vmId: forkId1 }),
    freestyle.vms.delete({ vmId: forkId2 }),
    freestyle.vms.delete({ vmId: forkId3 }),
  ]);
  console.log("Forks deleted.");

  // Suspend the base VM (keep the snapshot, just pause the base)
  await base.suspend();
  console.log("Base VM suspended.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
