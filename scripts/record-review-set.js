const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const e2eRoot = path.resolve(__dirname, '..');
const repoRoot = e2eRoot;
const parentWorkspace = process.env.JSC_WORKSPACE_ROOT
  ? path.resolve(process.env.JSC_WORKSPACE_ROOT)
  : path.resolve(e2eRoot, '..');
const reviewSet = process.env.REVIEW_SET || 'final';
const requestedClip = process.argv[2] || process.env.PROMO_CLIP;
const reviewDir = path.resolve(repoRoot, 'demo-recordings', reviewSet);
const webmDir = path.join(reviewDir, 'webm');
const downloadDir = path.join(reviewDir, 'downloads');
const reportPath = path.join(reviewDir, 'recording-report.json');
const readmePath = path.join(reviewDir, 'README.md');

const baseEnv = {
  ...process.env,
  E2E_BASE_URL: process.env.E2E_BASE_URL || 'http://localhost:3100',
  HEADLESS: process.env.HEADLESS || 'true',
  SLOW_MO: process.env.SLOW_MO || '0',
  RECORD_VIDEO: 'true',
  DEMO_MODE: 'true',
  DEMO_RECORDING: 'true',
  ALLOW_AI_GENERATION: process.env.ALLOW_AI_GENERATION || 'true',
  DEMO_DOWNLOAD_DIR: downloadDir,
  DEMO_BUFFER_MS: process.env.DEMO_BUFFER_MS || '2000',
  DEMO_SCROLL_MS: process.env.DEMO_SCROLL_MS || '650',
  TYPING_DELAY_MS: process.env.TYPING_DELAY_MS || '45',
  VIDEO_DIR: webmDir
};

const journeys = [
  { title: 'REGISTER', featurePath: 'features/chapters/REGISTER.feature' },
  { title: 'DISCOVER', featurePath: 'features/chapters/DISCOVER.feature' },
  { title: 'APPLY', featurePath: 'features/chapters/APPLY.feature' },
  { title: 'REPORT', featurePath: 'features/chapters/REPORT.feature' },
  { title: 'TRACK', featurePath: 'features/chapters/TRACK.feature' },
  { title: 'ORGANISE', featurePath: 'features/chapters/ORGANISE.feature' },
  { title: 'SUCCEED', featurePath: 'features/chapters/SUCCEED.feature' }
];

const selectedJourneys = requestedClip
  ? journeys.filter(journey => journey.title === requestedClip.toUpperCase())
  : journeys;
if (selectedJourneys.length === 0) {
  throw new Error(`Unknown promo clip ${requestedClip}. Choose: ${journeys.map(journey => journey.title).join(', ')}`);
}

function run(command, args, options) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return {
    command: [command, ...args].join(' '),
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode: result.status,
    signal: result.signal,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function latestWebm(prefix, sinceMs) {
  const safePrefix = `${prefix.toLowerCase()}-`;
  const files = fs.readdirSync(webmDir)
    .filter((file) => file.toLowerCase().startsWith(safePrefix) && file.endsWith('.webm'))
    .map((file) => {
      const fullPath = path.join(webmDir, file);
      return { file, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .filter((entry) => entry.mtimeMs >= sinceMs - 1000)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files[0] || null;
}

function convertToMp4(inputPath, outputPath) {
  return run('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '19',
    '-movflags',
    '+faststart',
    '-pix_fmt',
    'yuv420p',
    outputPath
  ], { cwd: repoRoot, env: process.env });
}

function probeMedia(filePath) {
  const result = spawnSync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height,duration',
    '-of',
    'json',
    filePath
  ], {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  if (result.status !== 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(result.stdout || '{}');
    const stream = parsed.streams?.[0];
    if (!stream) return null;
    return {
      width: Number(stream.width),
      height: Number(stream.height),
      durationSeconds: Number(stream.duration)
    };
  } catch {
    return null;
  }
}

function pruneUntitledWebms() {
  const expectedPrefixes = journeys.map((journey) => `${journey.title.toLowerCase()}-`);
  const removed = [];

  for (const file of fs.readdirSync(webmDir)) {
    if (!file.endsWith('.webm')) continue;
    if (expectedPrefixes.some((prefix) => file.toLowerCase().startsWith(prefix))) continue;

    fs.rmSync(path.join(webmDir, file), { force: true });
    removed.push(file);
  }

  return removed;
}

fs.rmSync(reviewDir, { recursive: true, force: true });
fs.mkdirSync(webmDir, { recursive: true });
fs.mkdirSync(downloadDir, { recursive: true });

const report = {
  reviewSet,
  createdAt: new Date().toISOString(),
  baseUrl: baseEnv.E2E_BASE_URL,
  downloadsDir: path.relative(repoRoot, downloadDir),
  cursor: {
    enabled: baseEnv.DEMO_RECORDING === 'true',
    colour: '#111827',
    outlineColour: '#f8fafc',
    sizePx: 28,
    clickAnimationEnabled: true
  },
  combinedGeneration: {
    featurePath: 'features/chapters/APPLY.feature',
    status: 'pending'
  },
  fixturePreparation: null,
  clips: []
};

if (process.env.SKIP_DEMO_PREP !== 'true') {
  report.fixturePreparation = run('python3', ['-m', 'scripts.demo.prepare_demo'], {
    cwd: parentWorkspace,
    env: process.env
  });

  if (report.fixturePreparation.exitCode !== 0) {
    report.finishedAt = new Date().toISOString();
    report.summary = {
      total: selectedJourneys.length,
      recorded: 0,
      failed: selectedJourneys.length,
      blocker: 'fixture_preparation_failed'
    };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.exit(1);
  }
}

for (const journey of selectedJourneys) {
  const startedMs = Date.now();
  const env = {
    ...baseEnv,
    VIDEO_NAME: journey.title,
    USE_SAVED_SESSION: 'false'
  };
  const runResult = run('npx', ['cucumber-js', journey.featurePath], { cwd: e2eRoot, env });
  const clip = {
    name: journey.title,
    featurePath: journey.featurePath,
    cucumber: runResult,
    webm: null,
    mp4: null,
    media: null,
    conversion: null,
    status: runResult.exitCode === 0 ? 'recorded' : 'failed'
  };

  const webm = latestWebm(journey.title, startedMs);
  if (webm) {
    clip.webm = path.relative(repoRoot, webm.fullPath);
    const mp4Path = path.join(reviewDir, `${journey.title}.mp4`);
    clip.conversion = convertToMp4(webm.fullPath, mp4Path);
    if (clip.conversion.exitCode === 0) {
      clip.mp4 = path.relative(repoRoot, mp4Path);
      clip.media = probeMedia(mp4Path);
    } else {
      clip.status = 'conversion_failed';
    }
  } else if (clip.status === 'recorded') {
    clip.status = 'missing_webm';
  }

  report.clips.push(clip);
  if (clip.name === 'APPLY') {
    report.combinedGeneration.status = clip.status;
  }
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

report.prunedUntitledWebms = pruneUntitledWebms();
report.finishedAt = new Date().toISOString();
report.summary = {
  total: report.clips.length,
  recorded: report.clips.filter((clip) => clip.status === 'recorded').length,
  failed: report.clips.filter((clip) => clip.status !== 'recorded').length
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(readmePath, [
  `# ${reviewSet} promotional recordings`,
  '',
  `Created: ${report.createdAt}`,
  `Base URL: ${report.baseUrl}`,
  `Downloads: ${path.relative(repoRoot, downloadDir)}`,
  '',
  '## Clips',
  '',
  ...report.clips.map((clip) => {
    const media = clip.media ? `, ${clip.media.width}x${clip.media.height}, ${clip.media.durationSeconds.toFixed(1)}s` : '';
    return `- ${clip.name}: ${clip.status}${clip.mp4 ? ` (${clip.mp4}${media})` : ''}`;
  }),
  '',
  'Raw WebM files are stored in `webm/`. MP4 files are H.264, yuv420p, CRF 19, with faststart enabled.',
  ''
].join('\n'));

if (report.summary.failed > 0) {
  process.exitCode = 1;
}
