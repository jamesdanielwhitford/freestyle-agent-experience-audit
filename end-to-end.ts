/**
 * Freestyle End-to-End Script
 *
 * Automates the full flow:
 *   1. Spin up a VM with Python (uv)
 *   2. Install pandas, numpy, requests into a venv
 *   3. Seed a SQLite database
 *   4. Snapshot the VM
 *   5. Boot a fresh VM from the snapshot
 *   6. Fork it 3 times
 *   7. Run 3 data-processing scripts in parallel across the forks
 *   8. Collect and print results
 *   9. Tear everything down
 *
 * References:
 *   - https://docs.freestyle.sh/v2/vms
 *   - https://docs.freestyle.sh/v2/vms/integrations/python/uv
 *   - https://docs.freestyle.sh/v2/vms/templates-snapshots
 *   - https://docs.freestyle.sh/v2/vms/lifecycle (Forking, Snapshots)
 */

import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmUv } from "@freestyle-sh/with-uv";

const VENV_PYTHON = "/opt/venv/bin/python";

// ─── Step 1: Setup VM ────────────────────────────────────────────────────────

async function setupVm() {
  console.log("[setup] Creating VM with Python (uv)...");
  const { vm, vmId } = await freestyle.vms.create(
    new VmSpec().with("uv", new VmUv({ pythonVersion: "3.12" }))
  );
  console.log(`[setup] VM created: ${vmId}`);

  // Create a venv and install packages
  console.log("[setup] Creating venv and installing pandas, numpy, requests...");
  const install = await vm.exec({
    command:
      "/opt/uv/bin/uv venv /opt/venv && /opt/uv/bin/uv pip install --python /opt/venv pandas numpy requests",
  });
  // uv logs progress to stderr even on success; confirm with "Installed"
  if (!install.stderr?.includes("Installed")) {
    throw new Error(`Package install failed:\n${install.stderr}`);
  }
  console.log("[setup] Packages installed.");

  // Seed SQLite database and verify package versions in one call
  console.log("[setup] Seeding database...");
  const seed = await vm.exec({
    command: `${VENV_PYTHON} -c "
import os, sqlite3, json
import pandas as pd, numpy as np, requests

db_path = '/data/app.db'
os.makedirs('/data', exist_ok=True)
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE)')
cur.execute('CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL)')
cur.executemany('INSERT OR IGNORE INTO users (name, email) VALUES (?, ?)', [('Alice','alice@example.com'),('Bob','bob@example.com'),('Charlie','charlie@example.com')])
cur.executemany('INSERT OR IGNORE INTO products (name, price) VALUES (?, ?)', [('Widget',9.99),('Gadget',24.99),('Doohickey',4.99)])
conn.commit()
users = cur.execute('SELECT COUNT(*) FROM users').fetchone()[0]
products = cur.execute('SELECT COUNT(*) FROM products').fetchone()[0]
conn.close()
print(json.dumps({'db': db_path, 'users': users, 'products': products, 'pandas': pd.__version__, 'numpy': np.__version__, 'requests': requests.__version__}))
"`,
  });
  if (!seed.stdout?.trim()) {
    throw new Error(`DB seed failed:\n${seed.stderr}`);
  }
  console.log("[setup] Seed complete:", JSON.parse(seed.stdout.trim()));

  // Snapshot
  console.log("[setup] Snapshotting VM...");
  const { snapshotId } = await vm.snapshot();
  console.log(`[setup] Snapshot created: ${snapshotId}`);

  // Delete the setup VM — we only need the snapshot from here
  await freestyle.vms.delete({ vmId });
  console.log(`[setup] Setup VM deleted.`);

  return snapshotId;
}

// ─── Step 2: Fork and run ────────────────────────────────────────────────────

async function forkAndRun(snapshotId: string) {
  console.log("\n[run] Booting VM from snapshot...");
  const { vm: base, vmId: baseId } = await freestyle.vms.create({ snapshotId });
  console.log(`[run] Base VM ready: ${baseId}`);

  // Fork 3 times in one call
  console.log("[run] Forking 3 times...");
  const { forks } = await base.fork({ count: 3 });
  const [{ vm: fork1, vmId: id1 }, { vm: fork2, vmId: id2 }, { vm: fork3, vmId: id3 }] = forks;
  console.log(`[run] Forks: ${id1}, ${id2}, ${id3}`);

  // Run all 3 tasks in parallel
  console.log("[run] Running tasks in parallel...");
  const [r1, r2, r3] = await Promise.all([
    // Fork 1: DB row counts
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

    // Fork 2: numpy mean
    fork2.exec({
      command: `${VENV_PYTHON} -c "
import numpy as np, json
arr = np.array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
print(json.dumps({'task': 'numpy_mean', 'array': arr.tolist(), 'mean': float(np.mean(arr))}))
"`,
    }),

    // Fork 3: Bitcoin price via CoinGecko public API
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

  // Collect results
  const results = {
    fork1_db_row_count: r1.stdout?.trim() ? JSON.parse(r1.stdout.trim()) : { error: r1.stderr },
    fork2_numpy_mean:   r2.stdout?.trim() ? JSON.parse(r2.stdout.trim()) : { error: r2.stderr },
    fork3_btc_price:    r3.stdout?.trim() ? JSON.parse(r3.stdout.trim()) : { error: r3.stderr },
  };

  // Tear down: delete forks and base VM
  console.log("\n[run] Tearing down...");
  await Promise.all([
    freestyle.vms.delete({ vmId: id1 }),
    freestyle.vms.delete({ vmId: id2 }),
    freestyle.vms.delete({ vmId: id3 }),
    freestyle.vms.delete({ vmId: baseId }),
  ]);
  console.log("[run] All VMs deleted.");

  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const snapshotId = await setupVm();
  const results = await forkAndRun(snapshotId);

  console.log("\n=== Final Results ===");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
