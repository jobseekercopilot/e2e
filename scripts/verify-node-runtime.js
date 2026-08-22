const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function parseVersion(value, source) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) {
    throw new Error(`${source} must contain an exact major.minor.patch Node version`);
  }
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

function verifyRuntime(runtimeVersion, pinnedVersion, engineRange) {
  const runtime = parseVersion(runtimeVersion, 'Runtime');
  const pinned = parseVersion(pinnedVersion, '.nvmrc');
  const expectedRange = `>=${pinnedVersion.trim()} <${pinned[0] + 1}`;

  if (engineRange !== expectedRange) {
    throw new Error(`package.json engines.node must be "${expectedRange}"`);
  }
  if (runtime[0] !== pinned[0] || compareVersions(runtime, pinned) < 0) {
    throw new Error(
      `Node ${pinnedVersion.trim()} or a newer Node ${pinned[0]} release is required; found ${runtimeVersion}`,
    );
  }
}

if (require.main === module) {
  try {
    const pinnedVersion = fs.readFileSync(path.join(ROOT, '.nvmrc'), 'utf8').trim();
    const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    verifyRuntime(process.versions.node, pinnedVersion, packageJson.engines?.node);
    process.stdout.write(`Supported Node runtime verified: ${process.versions.node}\n`);
  } catch (error) {
    process.stderr.write(`Node runtime policy failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { compareVersions, parseVersion, verifyRuntime };
