const path = require('node:path');

const primaryTags = ['@demo', '@smoke', '@e2e', '@security', '@provider-failure', '@accessibility'];

function findProfileTagViolations(featuresRoot, features) {
  const violations = [];
  for (const feature of features) {
    const featureIndex = feature.content.search(/^\s*Feature:/m);
    const header = featureIndex >= 0 ? feature.content.slice(0, featureIndex) : '';
    const selected = primaryTags.filter(tag => new RegExp(`(^|\\s)${tag.replace('-', '\\-')}(?=\\s|$)`, 'm').test(header));
    const relativePath = path.relative(featuresRoot, feature.path);
    if (selected.length !== 1) {
      violations.push(`${relativePath} must declare exactly one primary profile tag; found ${selected.join(', ') || 'none'}`);
    }
    const firstDirectory = relativePath.split(path.sep)[0];
    const expectedTag = {
      smoke: '@smoke',
      e2e: '@e2e',
      security: '@security',
      'provider-failure': '@provider-failure',
      accessibility: '@accessibility'
    }[firstDirectory] || '@demo';
    if (selected.length === 1 && selected[0] !== expectedTag) {
      violations.push(`${relativePath} belongs to ${expectedTag}, not ${selected[0]}`);
    }
  }
  return violations;
}

module.exports = { findProfileTagViolations, primaryTags };
