import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirs = new Set(['.git', '.runs', '.wrangler', 'node_modules', 'coverage']);
const localSuites = [
  'test-production-provider-boundary.js',
  'test/test-ai-router.js',
  'test/test-sandbox-mode.js',
  'test/test-phase1.js',
  'test/test-phase2.js',
  'test/test-phase3-kb.js',
  'test/test-phase4-mafel.js',
  'test/test-wa-coex.js',
  'test-v23.js',
  'test-v22.4.js',
  'test-v22.1.2.js',
  'test-v22.1.1.js',
  'test-v22.1.js',
  'test-v22.js',
  'test-v22.2.js',
  'test-v22.2-channels.js',
  'test-v23-k.js',
  'test-v23-simulator.js',
  'test-v24-ux.js',
  'test-v24-ux-edge.js',
  'test-config-failfast.js'
];
const secretEnvNames = [
  'CHATPAY_TOKEN', 'CHATPAY_SECRETS_FILE', 'REDIS_URL', 'REDIS_TOKEN', 'RESEND_KEY',
  'TARGET_EMAIL', 'MIDAS_SECRET', 'JWT_SECRET', 'TELEGRAM_BOT_TOKEN',
  'OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'GITHUB_MODELS_TOKEN',
  'GITHUB_TOKEN', 'CEREBRAS_API_KEY', 'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY',
  'VAPI_API_KEY', 'VAPI_ASSISTANT_ID', 'BLAND_API_KEY', 'BLAND_PATH_ID'
];

function findJavaScriptFiles(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) findJavaScriptFiles(fullPath, result);
    else if (/\.(?:js|mjs)$/.test(entry.name)) result.push(fullPath);
  }
  return result;
}

function runNode(args, env) {
  return spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
}

const sourceFiles = findJavaScriptFiles(root).sort();
console.log(`Checking JavaScript syntax (${sourceFiles.length} files)...`);
let failed = false;
for (const file of sourceFiles) {
  const result = runNode(['--check', file], process.env);
  if (result.error || result.status !== 0) {
    failed = true;
    console.error(`Syntax check failed: ${path.relative(root, file)}`);
  }
}
if (failed) process.exit(1);

const testEnv = { ...process.env, BASE: 'http://127.0.0.1:8787', TOKEN: '', DOMAIN: 'offline.test' };
for (const name of secretEnvNames) delete testEnv[name];

console.log(`\nRunning ${localSuites.length} local regression suites (no production credentials/network)...`);
for (const suite of localSuites) {
  console.log(`\n>>> ${suite}`);
  const result = runNode(['--no-warnings', suite], testEnv);
  if (result.error) {
    console.error(`Could not start ${suite}: ${result.error.message}`);
    process.exitCode = 1;
    continue;
  }
  if (result.status !== 0) {
    console.error(`${suite} failed with exit code ${result.status ?? 'unknown'}.`);
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  console.error('\nLocal tests failed. Live deployment checks were not run.');
} else {
  console.log('\nLocal syntax and regression checks passed. Live deployment checks were not run.');
}
