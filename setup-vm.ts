/**
 * Freestyle VM Setup Script
 *
 * Spins up a VM with Python (via uv), installs pandas/numpy/requests into a
 * venv at /opt/venv, initialises a SQLite database with seed data, then
 * snapshots the VM for reuse.
 *
 * References:
 *   - https://docs.freestyle.sh/v2/vms
 *   - https://docs.freestyle.sh/v2/vms/integrations/python/uv
 *   - https://docs.freestyle.sh/v2/vms/templates-snapshots
 */

import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmUv } from "@freestyle-sh/with-uv";

async function main() {
  console.log("Creating VM with Python (uv)...");

  const { vm, vmId } = await freestyle.vms.create(
    new VmSpec().with("uv", new VmUv({ pythonVersion: "3.12" }))
  );

  console.log(`VM created: ${vmId}`);

  // Create a venv and install packages into it.
  // uv's managed Python install is externally managed so we use a venv.
  console.log("Creating venv and installing pandas, numpy, requests...");
  const install = await vm.exec({
    command:
      "/opt/uv/bin/uv venv /opt/venv && /opt/uv/bin/uv pip install --python /opt/venv pandas numpy requests",
  });
  // uv logs to stderr even on success; check for "Installed" confirmation
  if (!install.stderr?.includes("Installed")) {
    throw new Error(`Package install failed:\n${install.stderr}`);
  }
  console.log("Packages installed.");

  // Seed the SQLite database and verify package versions using the venv Python.
  console.log("Seeding database and verifying packages...");
  const setup = await vm.exec({
    command: `/opt/venv/bin/python -c "
import os, sqlite3, json
import pandas as pd
import numpy as np
import requests

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

print(json.dumps({'db_path': db_path, 'users': users, 'products': products, 'pandas': pd.__version__, 'numpy': np.__version__, 'requests': requests.__version__}))
"`,
  });

  if (!setup.stdout?.trim()) {
    throw new Error(`Setup failed:\n${setup.stderr}`);
  }
  console.log("Setup complete:", JSON.parse(setup.stdout.trim()));

  // Snapshot the VM so the setup doesn't need to be repeated.
  console.log("Snapshotting VM...");
  const { snapshotId } = await vm.snapshot();
  console.log(`Snapshot created: ${snapshotId}`);
  console.log("\nVM is ready. Use these IDs for the next step:");
  console.log(`  snapshotId: ${snapshotId}`);
  console.log(`  vmId:       ${vmId}`);
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
