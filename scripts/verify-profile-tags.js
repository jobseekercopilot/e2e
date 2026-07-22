const fs = require('node:fs');
const path = require('node:path');
const { findProfileTagViolations } = require('./profile-tag-policy');

const featuresRoot = path.resolve(__dirname, '..', 'features');
function featureFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? featureFiles(entryPath) : entry.name.endsWith('.feature') ? [entryPath] : [];
  });
}

const features = featureFiles(featuresRoot).map(featurePath => ({
  path: featurePath,
  content: fs.readFileSync(featurePath, 'utf8')
}));
const violations = findProfileTagViolations(featuresRoot, features);

if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('profile-tag policy: every feature has one primary profile and all historical scenarios remain demo-only');
