import { Freestyle } from "freestyle-sandboxes";
import { readFileSync, writeFileSync } from "fs";

// Load API key from .env
const envContent = readFileSync(".env", "utf-8");
const apiKey = envContent.match(/FREESTYLE_API_KEY=(.+)/)[1].trim();

const freestyle = new Freestyle({ apiKey });

const DB_SCRIPT = `
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
row_count = c.execute('SELECT COUNT(*) FROM products').fetchone()[0]
print(f'Seeded {row_count} rows into products table')
conn.close()
`.trim();

async function exec(vm, label, command, timeoutMs = 120_000) {
  const result = await vm.exec({ command, timeoutMs });
  const out = result.stdout?.trim() || "";
  const err = result.stderr?.trim() || "";
  if (out) console.log(`[${label}] ${out.slice(-800)}`);
  if (err && !err.includes("WARNING:")) console.error(`[${label} stderr] ${err.slice(-400)}`);
  return result;
}

async function main() {
  console.log("Creating VM...");
  const { vm } = await freestyle.vms.create();
  console.log(`VM created: ${vm.vmId}`);

  // Install Python and pip
  console.log("Installing Python...");
  await exec(vm, "apt", "apt-get update -qq && apt-get install -y python3 python3-pip 2>&1 | tail -5", 180_000);

  // Install Python packages
  console.log("Installing pandas, numpy, requests...");
  await exec(
    vm,
    "pip",
    "pip3 install pandas numpy requests --break-system-packages --root-user-action=ignore 2>&1 | tail -5",
    300_000
  );

  // Write and run DB init script
  console.log("Writing DB init script...");
  await vm.fs.writeTextFile("/tmp/init_db.py", DB_SCRIPT);

  console.log("Initialising SQLite database with seed data...");
  await exec(vm, "db-init", "python3 /tmp/init_db.py");

  // Verify everything is in place
  console.log("Verifying setup...");
  await exec(
    vm,
    "verify",
    `python3 -c "import pandas, numpy, requests, sqlite3; conn = sqlite3.connect('/tmp/seed.db'); print('packages ok | rows:', conn.execute('SELECT COUNT(*) FROM products').fetchone()[0]); conn.close()"`
  );

  // Snapshot the VM
  console.log("Snapshotting VM...");
  const { snapshotId } = await vm.snapshot();
  console.log(`Snapshot created: ${snapshotId}`);

  writeFileSync("snapshot-id.txt", snapshotId);
  console.log("Snapshot ID saved to snapshot-id.txt");

  // Suspend the base VM
  await vm.suspend();
  console.log("VM suspended. Setup complete.");
  console.log("\nSnapshot ID:", snapshotId);
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
