const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const e2eRoot = path.resolve(__dirname, '..');
const workspace = path.resolve(e2eRoot, '..');
const infrastructure = path.join(workspace, 'infrastructure');
const outputDir = path.join(e2eRoot, 'demo-recordings', 'final');
const webmDir = path.join(outputDir, 'webm');
const downloadDir = path.join(outputDir, 'downloads');
const timelinePath = path.join(outputDir, 'showcase-timeline.json');
const reportPath = path.join(outputDir, 'recording-report.json');
const requestedClip = (process.argv[2] || process.env.PROMO_CLIP || '').toUpperCase();
const chapters = ['ONBOARDING', 'PROFILE', 'DISCOVER', 'GENERATE', 'DOCUMENTS', 'TRACKING', 'REPORTING'];

const envFile = path.join(infrastructure, '.env.e2e');
if (!fs.existsSync(envFile)) throw new Error(`Missing required local fixture configuration: ${envFile}`);
const localFixtureEnv = dotenv.parse(fs.readFileSync(envFile));
const systemDataPort = localFixtureEnv.E2E_SYSTEM_DATA_SERVICE_PORT || '8103';
const env = {
  ...process.env,
  SYSTEM_DATA_SERVICE_URL: process.env.SYSTEM_DATA_SERVICE_URL || `http://localhost:${systemDataPort}`,
  SYSTEM_DATA_INTERNAL_CALLER_KEY: process.env.SYSTEM_DATA_INTERNAL_CALLER_KEY
    || localFixtureEnv.SYSTEM_DATA_INTERNAL_CALLER_KEY,
  E2E_PROFILE: 'demo',
  E2E_BASE_URL: process.env.E2E_BASE_URL || 'http://localhost:3100',
  HEADLESS: process.env.HEADLESS || 'true',
  SLOW_MO: '0',
  RECORD_VIDEO: 'true',
  DEMO_MODE: 'true',
  DEMO_RECORDING: 'true',
  ALLOW_AI_GENERATION: 'true',
  ALLOW_REAL_PROVIDER_E2E: 'false',
  USE_SAVED_SESSION: 'false',
  SAVE_DEMO_SESSION: 'false',
  VIDEO_NAME: 'JOB-SEEKER-COPILOT-SHOWCASE',
  VIDEO_DIR: webmDir,
  DEMO_DOWNLOAD_DIR: downloadDir,
  SHOWCASE_TIMELINE_PATH: path.relative(e2eRoot, timelinePath),
  DEMO_BUFFER_MS: process.env.DEMO_BUFFER_MS || '1700',
  DEMO_SCROLL_MS: process.env.DEMO_SCROLL_MS || '620',
  TYPING_DELAY_MS: process.env.TYPING_DELAY_MS || '28'
};

if (!env.SYSTEM_DATA_INTERNAL_CALLER_KEY) throw new Error('The fixture System Data key is not configured.');
if (requestedClip && !chapters.includes(requestedClip)) {
  throw new Error(`Unknown clip ${requestedClip}. Choose one of: ${chapters.join(', ')}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || e2eRoot,
    env: options.env || env,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { command: [command, ...args].join(' '), exitCode: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function requireSuccess(result, label) {
  if (result.exitCode !== 0) throw new Error(`${label} failed with exit code ${result.exitCode}.`);
}

function probe(file) {
  const result = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration', '-of', 'json', file], { env: process.env });
  requireSuccess(result, `Media probe for ${path.basename(file)}`);
  const stream = JSON.parse(result.stdout).streams[0];
  return { width: Number(stream.width), height: Number(stream.height), durationSeconds: Number(stream.duration) };
}

fs.mkdirSync(webmDir, { recursive: true });
fs.mkdirSync(downloadDir, { recursive: true });
for (const name of ['JOB-SEEKER-COPILOT-SHOWCASE.mp4', ...chapters.map(chapter => `${chapter}.mp4`)]) {
  fs.rmSync(path.join(outputDir, name), { force: true });
}
fs.rmSync(timelinePath, { force: true });
for (const file of fs.readdirSync(webmDir)) {
  if (file.startsWith('job-seeker-copilot-showcase-') && file.endsWith('.webm')) {
    fs.rmSync(path.join(webmDir, file), { force: true });
  }
}

const preflight = run('python3', ['-m', 'scripts.demo.check_fixture_modes'], { cwd: infrastructure, env: process.env });
requireSuccess(preflight, 'Fixture-provider preflight');
const scenario = run('npx', ['cucumber-js', 'features/showcase/PRODUCT-SHOWCASE.feature'], { cwd: e2eRoot, env });

const rawVideos = fs.readdirSync(webmDir)
  .filter(file => file.startsWith('job-seeker-copilot-showcase-') && file.endsWith('.webm'))
  .map(file => ({ file, mtime: fs.statSync(path.join(webmDir, file)).mtimeMs }))
  .sort((left, right) => right.mtime - left.mtime);
if (scenario.exitCode !== 0 || rawVideos.length === 0 || !fs.existsSync(timelinePath)) {
  fs.writeFileSync(reportPath, `${JSON.stringify({ fixtureMode: true, preflight, scenario, rawVideos }, null, 2)}\n`);
  throw new Error('The showcase scenario failed; recording evidence was retained for diagnosis.');
}

const rawVideo = path.join(webmDir, rawVideos[0].file);
const master = path.join(outputDir, 'JOB-SEEKER-COPILOT-SHOWCASE.mp4');
requireSuccess(run('ffmpeg', ['-y', '-i', rawVideo, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-movflags', '+faststart', '-pix_fmt', 'yuv420p', master], { env: process.env }), 'Master conversion');

const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
const markers = new Map(timeline.markers.map(marker => [marker.section, marker.seconds]));
const clips = [];
for (const chapter of chapters) {
  const index = timeline.markers.findIndex(marker => marker.section === chapter);
  const next = timeline.markers[index + 1];
  if (index < 0 || !next) throw new Error(`Timeline is missing a boundary for ${chapter}.`);
  const output = path.join(outputDir, `${chapter}.mp4`);
  const start = Math.max(0, markers.get(chapter) - 0.15);
  const duration = Math.max(0.5, next.seconds - start);
  requireSuccess(run('ffmpeg', ['-y', '-ss', start.toFixed(3), '-i', master, '-t', duration.toFixed(3), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-movflags', '+faststart', '-pix_fmt', 'yuv420p', output], { env: process.env }), `${chapter} clip`);
  clips.push({ chapter, file: path.relative(e2eRoot, output), ...probe(output) });
}

const report = {
  createdAt: new Date().toISOString(),
  fixtureMode: true,
  realProvidersAllowed: false,
  sourceFeature: 'features/showcase/PRODUCT-SHOWCASE.feature',
  master: { file: path.relative(e2eRoot, master), ...probe(master) },
  clips,
  downloads: fs.readdirSync(downloadDir).sort(),
  timeline,
  preflight: { exitCode: preflight.exitCode },
  scenario: { exitCode: scenario.exitCode }
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'README.md'), [
  '# Job Seeker Copilot product showcase', '',
  'The master and all seven chapter clips are generated from one deterministic, fixture-backed real UI journey.', '',
  `- Master: \`${report.master.file}\` (${report.master.width}x${report.master.height}, ${report.master.durationSeconds.toFixed(1)}s)`,
  ...clips.map(clip => `- ${clip.chapter}: \`${clip.file}\` (${clip.durationSeconds.toFixed(1)}s)`),
  '', 'Paid/live providers are disabled. Generated-document downloads are retained in `downloads/`.', ''
].join('\n'));

if (requestedClip) process.stdout.write(`Requested clip: ${path.join(outputDir, `${requestedClip}.mp4`)}\n`);
process.stdout.write(`Master showcase: ${master}\n`);
