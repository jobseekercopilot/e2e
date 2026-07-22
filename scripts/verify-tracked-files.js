const fs = require('node:fs');

const files = fs.readFileSync(0, 'utf8')
  .split('\0')
  .filter(Boolean);

const forbiddenDirectories = /(^|\/)(node_modules|dist|reports|screenshots|videos|\.auth|test-results|playwright-report|blob-report|demo-recordings|downloads)(\/|$)/;
const forbiddenExtensions = /\.(webm|mp4|zip)$/i;
const forbiddenEnvironment = /(^|\/)\.env(?:\..+)?$/;

const forbidden = files.filter((file) =>
  forbiddenDirectories.test(file)
  || forbiddenExtensions.test(file)
  || (forbiddenEnvironment.test(file) && !file.endsWith('.env.example'))
);

if (forbidden.length > 0) {
  console.error('Forbidden generated, authentication, or local-environment files are tracked:');
  forbidden.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log(`tracked-file policy: ${files.length} files checked; no forbidden artifact`);
