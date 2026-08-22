const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical'];

function findingNames(report, severity) {
  return Object.entries(report.vulnerabilities || {})
    .filter(([, finding]) => finding.severity === severity)
    .map(([name]) => name)
    .sort();
}

function validateException(exception, today) {
  for (const field of ['package', 'severity', 'justification', 'owner', 'expires']) {
    if (typeof exception[field] !== 'string' || exception[field].trim() === '') {
      throw new Error(`Accepted finding is missing ${field}`);
    }
  }
  if (!SEVERITIES.includes(exception.severity)) {
    throw new Error(`Accepted finding for ${exception.package} has an invalid severity`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.expires)) {
    throw new Error(`Accepted finding for ${exception.package} has an invalid expiry date`);
  }
  if (exception.expires < today) {
    throw new Error(`Accepted finding for ${exception.package} expired on ${exception.expires}`);
  }
}

function evaluatePolicy(report, policy, today = new Date().toISOString().slice(0, 10)) {
  if (policy.schemaVersion !== 1) {
    throw new Error('Unsupported dependency policy schema');
  }

  const accepted = policy.acceptedFindings || [];
  accepted.forEach((exception) => validateException(exception, today));

  const actualKeys = new Set(
    Object.entries(report.vulnerabilities || {}).map(
      ([name, finding]) => `${name}:${finding.severity}`,
    ),
  );
  for (const exception of accepted) {
    if (!actualKeys.has(`${exception.package}:${exception.severity}`)) {
      throw new Error(
        `Accepted finding ${exception.package}:${exception.severity} is stale or does not match the audit`,
      );
    }
  }

  for (const severity of policy.failOn || []) {
    if (!SEVERITIES.includes(severity)) {
      throw new Error(`Policy contains invalid fail severity: ${severity}`);
    }
    const unaccepted = findingNames(report, severity).filter(
      (name) =>
        !accepted.some(
          (exception) => exception.package === name && exception.severity === severity,
        ),
    );
    if (unaccepted.length > 0) {
      throw new Error(`Unaccepted ${severity} findings: ${unaccepted.join(', ')}`);
    }
  }

  const currentModerate = findingNames(report, 'moderate');
  const reviewedModerate = [...(policy.reviewedResidualRisk?.moderate || [])].sort();
  const unreviewedModerate = currentModerate.filter((name) => !reviewedModerate.includes(name));
  const staleModerate = reviewedModerate.filter((name) => !currentModerate.includes(name));
  if (unreviewedModerate.length > 0) {
    throw new Error(`Unreviewed Moderate findings: ${unreviewedModerate.join(', ')}`);
  }
  if (staleModerate.length > 0) {
    throw new Error(`Stale Moderate risk entries: ${staleModerate.join(', ')}`);
  }

  return Object.fromEntries(
    SEVERITIES.map((severity) => [severity, findingNames(report, severity).length]),
  );
}

function runAudit() {
  const result = spawnSync('npm', ['audit', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (!result.stdout.trim()) {
    throw new Error(`npm audit produced no JSON${result.stderr ? `: ${result.stderr.trim()}` : ''}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('npm audit returned invalid JSON');
  }
}

if (require.main === module) {
  try {
    const policy = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'config', 'dependency-policy.json'), 'utf8'),
    );
    const summary = evaluatePolicy(runAudit(), policy);
    process.stdout.write(
      `Dependency policy passed: ${SEVERITIES.map(
        (severity) => `${severity}=${summary[severity]}`,
      ).join(', ')}\n`,
    );
  } catch (error) {
    process.stderr.write(`Dependency policy failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { evaluatePolicy, findingNames, validateException };
