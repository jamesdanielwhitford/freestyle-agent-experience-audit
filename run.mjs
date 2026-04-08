import { freestyle } from "freestyle-sandboxes";
import { config } from "dotenv";

config();

const { vm } = await freestyle.vms.create();
const result = await vm.exec("echo hello world");

console.log("stdout:", result.stdout);
console.log("stderr:", result.stderr);
console.log("exit code:", result.statusCode);
