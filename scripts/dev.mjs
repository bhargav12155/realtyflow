import { spawn } from "node:child_process";
import { createRequire } from "node:module";

import dotenv from "dotenv";

dotenv.config();

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");

const env = {
  ...process.env,
  PORT: process.env.PORT || "5001",
  NODE_ENV: process.env.NODE_ENV || "development",
  NODE_TLS_REJECT_UNAUTHORIZED:
    process.env.NODE_TLS_REJECT_UNAUTHORIZED || "0",
};

const child = spawn(process.execPath, [tsxCli, "external/server/index.ts"], {
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});