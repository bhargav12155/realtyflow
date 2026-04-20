#!/usr/bin/env node
import { spawn } from "node:child_process";

const TIMEOUT_MS = 90_000;
const MAX_PROMPTS = 20;

const proc = spawn("npm", ["run", "db:push"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: "0" },
});

let stdoutBuf = "";
let promptCount = 0;
let promptCooldown = false;

function answerPrompt() {
  if (promptCooldown) return;
  if (promptCount >= MAX_PROMPTS) {
    console.error(
      `[db-push-supervisor] Exceeded ${MAX_PROMPTS} prompts, killing.`,
    );
    proc.kill("SIGTERM");
    return;
  }
  promptCount++;
  promptCooldown = true;
  console.error(
    `[db-push-supervisor] answering prompt #${promptCount} with default (Enter)`,
  );
  proc.stdin.write("\r");
  setTimeout(() => {
    promptCooldown = false;
  }, 300);
}

proc.stdout.on("data", (chunk) => {
  const s = chunk.toString();
  process.stdout.write(s);
  stdoutBuf += s;
  if (stdoutBuf.length > 8000) stdoutBuf = stdoutBuf.slice(-4000);
  if (/Do you want to/i.test(s) || /❯/.test(s)) {
    setTimeout(answerPrompt, 200);
  }
});

proc.stderr.on("data", (chunk) => process.stderr.write(chunk));

const timer = setTimeout(() => {
  console.error("[db-push-supervisor] timeout, killing.");
  proc.kill("SIGTERM");
}, TIMEOUT_MS);

proc.on("exit", (code, signal) => {
  clearTimeout(timer);
  if (signal) {
    console.error(`[db-push-supervisor] killed by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
