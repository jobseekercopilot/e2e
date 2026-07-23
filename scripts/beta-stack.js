const {execFileSync} = require('node:child_process');
const {generateKeyPairSync, randomBytes} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeDir = path.join(root, '.runtime');
const envFile = path.join(runtimeDir, 'beta-stack.env');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/beta-stack-sources.json'), 'utf8'));
const action = process.argv[2] || 'prepare';
const stackGuard = 'jsc-local-user-management-beta-v1';
const projectName = 'jsc-user-management-beta';

function run(command, args, options = {}) {
  execFileSync(command, args, {cwd: root, stdio: 'inherit', ...options});
}

function capture(command, args, cwd) {
  return execFileSync(command, args, {cwd, encoding: 'utf8'}).trim();
}

function repositoryPath(source, environment) {
  const configured = environment[source.environment];
  const conventional = path.resolve(root, '..', source.name);
  const candidate = configured ? path.resolve(configured) : conventional;
  if (!fs.existsSync(path.join(candidate, '.git'))) {
    throw new Error(`${source.environment} must identify a clone of jobseekercopilot/${source.name}`);
  }
  return candidate;
}

function validatedSources(environment = process.env) {
  return manifest.sources.map(source => {
    const directory = repositoryPath(source, environment);
    const origin = capture('git', ['remote', 'get-url', 'origin'], directory);
    if (!new RegExp(`github\\.com[:/]jobseekercopilot/${source.name}(?:\\.git)?$`).test(origin)) {
      throw new Error(`${source.name} has an unexpected origin`);
    }
    const revision = capture('git', ['rev-parse', 'HEAD'], directory);
    if (revision !== source.revision) throw new Error(`${source.name} must be checked out at ${source.revision}`);
    if (capture('git', ['status', '--porcelain'], directory)) throw new Error(`${source.name} working tree must be clean`);
    return {...source, directory};
  });
}

function envLine(name, value) {
  if (/\r|\n/.test(value)) throw new Error(`${name} contains a newline`);
  return `${name}=${value}`;
}

function readRuntimeEnvironment() {
  if (!fs.existsSync(envFile)) throw new Error('Run npm run stack:prepare first');
  const stat = fs.statSync(envFile);
  if ((stat.mode & 0o077) !== 0) throw new Error('Runtime configuration must not be accessible to group or other users');
  const entries = Object.fromEntries(fs.readFileSync(envFile, 'utf8').trim().split('\n').map(line => {
    const split = line.indexOf('=');
    if (split <= 0) throw new Error('Runtime configuration contains an invalid entry');
    return [line.slice(0, split), line.slice(split + 1)];
  }));
  if (entries.BETA_STACK_GUARD !== stackGuard || entries.COMPOSE_PROJECT_NAME !== projectName) {
    throw new Error('Refusing to operate without the exact local beta stack guard');
  }
  return entries;
}

function validateDockerTarget() {
  const override = process.env.DOCKER_HOST;
  if (override && !/^(unix|npipe):\/\//.test(override)) {
    throw new Error('Refusing to operate against a remote DOCKER_HOST');
  }
  const endpoint = capture('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], root);
  if (!/^(unix|npipe):\/\//.test(endpoint)) {
    throw new Error('Refusing to operate against a remote Docker context');
  }
  return endpoint;
}

function prepare() {
  const sources = validatedSources();
  const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
  const values = [
    ['BETA_STACK_GUARD', stackGuard],
    ['COMPOSE_PROJECT_NAME', projectName],
    ...sources.map(source => [source.environment, source.directory]),
    ['AUTH_DB_PASSWORD', randomBytes(32).toString('base64url')],
    ['PROFILE_DB_PASSWORD', randomBytes(32).toString('base64url')],
    ['AUTH_SERVICE_TOKEN', randomBytes(40).toString('base64url')],
    ['ENVIRONMENT_DATA_TOKEN', randomBytes(40).toString('base64url')],
    ['SYSTEM_DATA_INTERNAL_CALLER_KEY', randomBytes(40).toString('base64url')],
    ['JWT_PRIVATE_KEY_BASE64', privateKey.export({type: 'pkcs8', format: 'der'}).toString('base64')],
    ['JWT_PUBLIC_KEY_BASE64', publicKey.export({type: 'spki', format: 'der'}).toString('base64')]
  ];
  fs.mkdirSync(runtimeDir, {recursive: true, mode: 0o700});
  fs.writeFileSync(envFile, `${values.map(([name, value]) => envLine(name, value)).join('\n')}\n`, {mode: 0o600});
  fs.chmodSync(envFile, 0o600);
  process.stdout.write('Prepared isolated runtime configuration in ignored .runtime/beta-stack.env\n');
}

function compose(args) {
  readRuntimeEnvironment();
  validateDockerTarget();
  run('docker', ['compose', '--env-file', envFile, '-f', 'compose.beta.yml', ...args]);
}

function build() {
  for (const source of validatedSources(readRuntimeEnvironment()).filter(source => source.build === 'mvn')) {
    run(fs.existsSync(path.join(source.directory, 'mvnw')) ? './mvnw' : 'mvn', ['-B', 'clean', 'verify'], {cwd: source.directory, stdio: 'inherit'});
  }
  compose(['build', '--no-cache']);
}

function scanImages() {
  readRuntimeEnvironment();
  const endpoint = validateDockerTarget();
  if (endpoint !== 'unix:///var/run/docker.sock') {
    throw new Error('Image scanning requires the local Unix Docker socket');
  }
  const images = [...new Set(capture('docker', [
    'compose', '--env-file', envFile, '-f', 'compose.beta.yml', 'config', '--images'
  ], root).split('\n').filter(Boolean))].sort();
  if (images.length !== 8) {
    throw new Error(`Expected exactly 8 distinct approved stack images, found ${images.length}`);
  }
  for (const image of images) {
    capture('docker', ['image', 'inspect', image], root);
    run('docker', [
      'run', '--rm',
      '--volume', '/var/run/docker.sock:/var/run/docker.sock:ro',
      '--volume', 'jsc-e2e-trivy-cache:/root/.cache/trivy',
      'aquasec/trivy:0.72.0',
      'image', '--scanners', 'vuln', '--severity', 'HIGH,CRITICAL',
      '--ignore-unfixed', '--exit-code', '1', image
    ]);
  }
}

function smoke() {
  const entries = readRuntimeEnvironment();
  run('npm', ['run', 'test:smoke:stack'], {env: {...process.env, E2E_BASE_URL: 'http://localhost:3100', SYSTEM_DATA_SERVICE_URL: 'http://localhost:9103', SYSTEM_DATA_INTERNAL_CALLER_KEY: entries.SYSTEM_DATA_INTERNAL_CALLER_KEY}});
}

function accessibility() {
  const entries = readRuntimeEnvironment();
  run('npm', ['run', 'test:accessibility'], {env: {...process.env, E2E_BASE_URL: 'http://localhost:3100', SYSTEM_DATA_SERVICE_URL: 'http://localhost:9103', SYSTEM_DATA_INTERNAL_CALLER_KEY: entries.SYSTEM_DATA_INTERNAL_CALLER_KEY}});
}

function reset() {
  compose(['down', '--volumes', '--remove-orphans']);
  compose(['up', '--detach', '--wait']);
}

async function dependencyFailure() {
  readRuntimeEnvironment();
  compose(['stop', 'postcode-io-gateway']);
  try {
    // RG1 1AA is intentionally excluded: the positive browser journey caches it.
    const response = await fetch('http://localhost:3100/api/postcodes/B1%201AA');
    const body = await response.json();
    if (![503, 504].includes(response.status) || body?.success !== false || body?.locations?.length !== 0) {
      throw new Error(`Expected bounded postcode dependency failure, received HTTP ${response.status}`);
    }
    const serialized = JSON.stringify(body);
    if (/exception|stacktrace|system-data-service|postcode-io-gateway/i.test(serialized)) {
      throw new Error('Dependency failure response exposed implementation details');
    }
    process.stdout.write(`Postcode dependency failure returned the expected bounded HTTP ${response.status} response\n`);
  } finally {
    compose(['up', '--detach', '--wait', 'postcode-io-gateway', 'location-gateway']);
  }
}

async function verifyStack() {
  reset();
  try {
    smoke();
    // Public registration assigns a random account ID, while the named-state
    // reset targets its deterministic fixture ID. Recreate the two bounded
    // local schemas so stateful profiles cannot contaminate each other.
    reset();
    accessibility();
    await dependencyFailure();
  } catch (error) {
    try { compose(['logs', '--no-color', '--tail', '200']); } catch { /* retain original failure */ }
    throw error;
  } finally {
    compose(['down', '--volumes', '--remove-orphans']);
  }
}

async function main() {
  if (action === 'prepare') prepare();
  else if (action === 'validate') validatedSources(readRuntimeEnvironment());
  else if (action === 'config') compose(['config', '--quiet']);
  else if (action === 'build') build();
  else if (action === 'scan-images') scanImages();
  else if (action === 'up') compose(['up', '--detach', '--wait']);
  else if (action === 'reset') reset();
  else if (action === 'smoke') smoke();
  else if (action === 'accessibility') accessibility();
  else if (action === 'dependency-failure') await dependencyFailure();
  else if (action === 'verify') await verifyStack();
  else if (action === 'logs') compose(['logs', '--no-color']);
  else if (action === 'down') compose(['down', '--volumes', '--remove-orphans']);
  else throw new Error(`Unknown beta-stack action: ${action}`);
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Beta stack command failed'}\n`);
  process.exitCode = 1;
});
