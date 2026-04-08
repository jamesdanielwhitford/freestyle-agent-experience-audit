import { Freestyle } from "freestyle-sandboxes";
import { readFileSync } from "fs";

const apiKey = readFileSync(".env", "utf-8").match(/FREESTYLE_API_KEY=(.+)/)[1].trim();
const SNAPSHOT_ID = readFileSync("snapshot-id.txt", "utf-8").trim();

const freestyle = new Freestyle({ apiKey });

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
mean = np.mean(arr)
print(f'mean:{mean}')
`.trim(),

  fork3: `
import requests
response = requests.get('https://api.kraken.com/0/public/Ticker?pair=XBTUSD', timeout=10)
data = response.json()
price = data['result']['XXBTZUSD']['c'][0]
print(f'btc_price_usd:{price}')
`.trim(),
};

async function runOnVm(vm, label, script) {
  await vm.fs.writeTextFile(`/tmp/script.py`, script);
  const result = await vm.exec({ command: "python3 /tmp/script.py", timeoutMs: 30_000 });
  return result.stdout?.trim() || result.stderr?.trim() || "(no output)";
}

async function main() {
  console.log(`Creating 3 VMs from snapshot ${SNAPSHOT_ID} in parallel...`);

  const [r1, r2, r3] = await Promise.all([
    freestyle.vms.create({ snapshotId: SNAPSHOT_ID }),
    freestyle.vms.create({ snapshotId: SNAPSHOT_ID }),
    freestyle.vms.create({ snapshotId: SNAPSHOT_ID }),
  ]);

  const forks = [
    { label: "Fork 1 (DB row count)",  vm: r1.vm, script: SCRIPTS.fork1 },
    { label: "Fork 2 (numpy mean)",    vm: r2.vm, script: SCRIPTS.fork2 },
    { label: "Fork 3 (Bitcoin price)", vm: r3.vm, script: SCRIPTS.fork3 },
  ];

  console.log("VMs ready:");
  forks.forEach(f => console.log(`  ${f.label}: ${f.vm.vmId}`));

  // Run all three scripts in parallel
  console.log("\nRunning scripts in parallel...");
  const results = await Promise.all(
    forks.map(({ label, vm, script }) =>
      runOnVm(vm, label, script)
        .then(output => ({ label, output }))
        .catch(err => ({ label, output: `ERROR: ${err.message}` }))
    )
  );

  // Print results
  console.log("\nResults:");
  for (const { label, output } of results) {
    console.log(`  ${label}: ${output}`);
  }

  // Shut down all VMs
  console.log("\nShutting down VMs...");
  await Promise.all(forks.map(({ vm }) => vm.kill().catch(() => {})));
  console.log("All VMs terminated.");
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
