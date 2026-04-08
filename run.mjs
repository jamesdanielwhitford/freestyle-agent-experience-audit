import { Freestyle } from "freestyle-sandboxes";
import { readFileSync } from "fs";

const apiKey = readFileSync(".env", "utf-8").match(/FREESTYLE_API_KEY=(.+)/)[1].trim();
const freestyle = new Freestyle({ apiKey });

// ── scripts to run in each fork ──────────────────────────────────────────────

const SCRIPTS = {
  fork1: `
import sqlite3
conn = sqlite3.connect('/tmp/seed.db')
row_count = conn.execute('SELECT COUNT(*) FROM products').fetchone()[0]
conn.close()
print(f'row_count:{row_count}')
`.trim(),

  fork2: `
import numpy as np
arr = np.array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
print(f'mean:{np.mean(arr)}')
`.trim(),

  fork3: `
import requests
data = requests.get('https://api.kraken.com/0/public/Ticker?pair=XBTUSD', timeout=10).json()
print(f'btc_price_usd:{data["result"]["XXBTZUSD"]["c"][0]}')
`.trim(),
};

const DB_INIT = `
import sqlite3
conn = sqlite3.connect('/tmp/seed.db')
c = conn.cursor()
c.execute('''CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  stock INTEGER NOT NULL
)''')
c.executemany('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)', [
  ('Widget A',  9.99,  100),
  ('Widget B',  19.99, 50),
  ('Gadget X',  49.99, 25),
  ('Gadget Y',  99.99, 10),
  ('Doohickey', 4.99,  200),
])
conn.commit()
print(f'seeded:{c.execute("SELECT COUNT(*) FROM products").fetchone()[0]}')
conn.close()
`.trim();

// ── helpers ──────────────────────────────────────────────────────────────────

async function exec(vm, command, timeoutMs = 180_000) {
  const r = await vm.exec({ command, timeoutMs });
  return { stdout: r.stdout?.trim() || "", stderr: r.stderr?.trim() || "" };
}

// ── phase 1: setup ───────────────────────────────────────────────────────────

async function setup() {
  console.log("[setup] Creating VM...");
  const { vm } = await freestyle.vms.create();
  console.log(`[setup] VM: ${vm.vmId}`);

  console.log("[setup] Installing Python...");
  await exec(vm, "apt-get update -qq && apt-get install -y python3 python3-pip 2>&1 | tail -3", 300_000);

  console.log("[setup] Installing pandas, numpy, requests...");
  await exec(vm, "pip3 install pandas numpy requests --break-system-packages --root-user-action=ignore 2>&1 | tail -3", 300_000);

  console.log("[setup] Seeding database...");
  await vm.fs.writeTextFile("/tmp/init_db.py", DB_INIT);
  const { stdout } = await exec(vm, "python3 /tmp/init_db.py");
  console.log(`[setup] ${stdout}`);

  console.log("[setup] Snapshotting...");
  const { snapshotId } = await vm.snapshot();
  console.log(`[setup] Snapshot: ${snapshotId}`);

  await vm.kill();
  return snapshotId;
}

// ── phase 2: fork & run ──────────────────────────────────────────────────────

async function forkAndRun(snapshotId) {
  console.log("\n[forks] Spinning up 3 VMs from snapshot in parallel...");

  const [r1, r2, r3] = await Promise.all([
    freestyle.vms.create({ snapshotId }),
    freestyle.vms.create({ snapshotId }),
    freestyle.vms.create({ snapshotId }),
  ]);

  const forks = [
    { label: "Fork 1 (DB row count)",  vm: r1.vm, script: SCRIPTS.fork1 },
    { label: "Fork 2 (numpy mean)",    vm: r2.vm, script: SCRIPTS.fork2 },
    { label: "Fork 3 (Bitcoin price)", vm: r3.vm, script: SCRIPTS.fork3 },
  ];

  forks.forEach(f => console.log(`[forks]   ${f.label}: ${f.vm.vmId}`));

  console.log("[forks] Running scripts in parallel...");
  const results = await Promise.all(
    forks.map(({ label, vm, script }) =>
      vm.fs.writeTextFile("/tmp/script.py", script)
        .then(() => exec(vm, "python3 /tmp/script.py", 30_000))
        .then(({ stdout, stderr }) => ({ label, output: stdout || stderr || "(no output)" }))
        .catch(err => ({ label, output: `ERROR: ${err.message}` }))
    )
  );

  console.log("\n[results]");
  for (const { label, output } of results) {
    console.log(`  ${label}: ${output}`);
  }

  console.log("\n[teardown] Killing forks...");
  await Promise.all(forks.map(({ vm }) => vm.kill().catch(() => {})));
  console.log("[teardown] Done.");

  return results;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const snapshotId = await setup();
  await forkAndRun(snapshotId);
}

main().catch(err => {
  console.error("Fatal:", err.message ?? err);
  process.exit(1);
});
