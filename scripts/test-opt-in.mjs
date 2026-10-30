const OPT_IN_FLAGS = {
  provider: 'ALLOW_REAL_PROVIDER_TESTS',
  live: 'ALLOW_LIVE_API_TESTS'
};

export function requireExternalTestOptIn(kind) {
  const flag = OPT_IN_FLAGS[kind];
  if (!flag) throw new Error(`Unknown external test type: ${kind}`);
  if (process.env[flag] === '1') return;

  console.log(`SKIP: this ${kind} test can contact an external service or incur charges.`);
  console.log(`Set ${flag}=1 only when you explicitly intend to run it against a safe target.`);
  process.exit(2);
}
