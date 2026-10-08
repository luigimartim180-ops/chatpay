import fs from 'node:fs';
import path from 'node:path';

const SECRET_NAMES = [
  'OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'GITHUB_MODELS_TOKEN', 'GITHUB_TOKEN', 'CEREBRAS_API_KEY', 'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY',
  'OPENROUTER_MODEL', 'GEMINI_MODEL', 'GROQ_MODEL', 'GITHUB_MODEL', 'CEREBRAS_MODEL', 'DEEPSEEK_MODEL', 'DEEPSEEK_MODEL_REASONER', 'MISTRAL_MODEL',
  'VAPI_API_KEY', 'VAPI_ASSISTANT_ID', 'BLAND_API_KEY', 'BLAND_PATH_ID'
];

function parseSecretFile(filePath) {
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

export function loadLabSecrets(env = process.env) {
  const loaded = {};
  for (const name of SECRET_NAMES) {
    if (env[name]) loaded[name] = env[name];
  }
  const externalPath = env.CHATPAY_SECRETS_FILE;
  if (externalPath) {
    if (!path.isAbsolute(externalPath)) throw new Error('CHATPAY_SECRETS_FILE must be absolute');
    const resolved = path.resolve(externalPath);
    Object.assign(loaded, parseSecretFile(resolved));
  }
  return loaded;
}
