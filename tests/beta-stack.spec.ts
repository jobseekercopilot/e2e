import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const compose = fs.readFileSync(path.join(root, 'compose.beta.yml'), 'utf8');
const script = fs.readFileSync(path.join(root, 'scripts/beta-stack.js'), 'utf8');
const postgresDockerfile = fs.readFileSync(path.join(root, 'containers/postgres/Dockerfile'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/beta-stack-sources.json'), 'utf8'));

const approvedServices = [
  'authentication-db',
  'authentication-service',
  'profile-db',
  'user-profile-service',
  'system-data-service',
  'postcode-io-gateway',
  'location-gateway',
  'user-management-gateway',
  'job-seeker-copilot-client'
];

test('minimum stack contains only the approved user-management path', () => {
  const serviceBlock = compose.split('\nservices:\n')[1].split('\nnetworks:\n')[0];
  const services = [...serviceBlock.matchAll(/^  ([a-z0-9-]+):$/gm)].map(match => match[1]);
  expect(services).toHaveLength(approvedServices.length);
  expect(new Set(services)).toEqual(new Set(approvedServices));
  expect(compose).not.toMatch(/job-service|payment-service:\n|document-store-service:\n|application-tracker-service:\n/);
});

test('runtime databases and downstream environment credentials are fail-closed', () => {
  expect(compose).toContain('image: jsc-user-management-beta-postgres:17-alpine-no-gosu');
  expect(postgresDockerfile).toMatch(/^FROM postgres@sha256:[a-f0-9]{64}$/m);
  expect(postgresDockerfile).toContain('RUN rm /usr/local/bin/gosu');
  expect(postgresDockerfile).toMatch(/^USER postgres$/m);
  expect(compose).toContain('SYSTEM_DATA_INTERNAL_CALLER_KEY: ${SYSTEM_DATA_INTERNAL_CALLER_KEY}');
  expect(compose).toContain('SYSTEM_DATA_DOWNSTREAM_ENVIRONMENT_DATA_TOKEN: ${ENVIRONMENT_DATA_TOKEN}');
  expect(compose).toContain('AUTH_ENVIRONMENT_DATA_TOKEN: ${ENVIRONMENT_DATA_TOKEN}');
  expect(compose).toContain('ENVIRONMENT_DATA_TOKEN: ${ENVIRONMENT_DATA_TOKEN}');
  expect(script).toContain("['ENVIRONMENT_DATA_TOKEN', randomBytes(40).toString('base64url')]");
  expect(script).toContain("['SYSTEM_DATA_INTERNAL_CALLER_KEY', randomBytes(40).toString('base64url')]");
});

test('all distinct stack images use the pinned blocking vulnerability scan', () => {
  expect(script).toContain('Expected exactly 8 distinct approved stack images');
  expect(script).toContain("'/var/run/docker.sock:/var/run/docker.sock:ro'");
  expect(script).toContain("'aquasec/trivy:0.72.0'");
  expect(script).toContain("'--severity', 'HIGH,CRITICAL'");
  expect(script).toContain("'--ignore-unfixed', '--exit-code', '1'");
});

test('source revisions, teardown and local guard are explicit', () => {
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.sources).toHaveLength(7);
  for (const source of manifest.sources) expect(source.revision).toMatch(/^[a-f0-9]{40}$/);
  expect(script).toContain("const stackGuard = 'jsc-local-user-management-beta-v1'");
  expect(script).toContain("Refusing to operate against a remote Docker context");
  expect(script).toContain("Refusing to operate against a remote DOCKER_HOST");
  expect(script).toContain("compose(['build', '--no-cache'])");
  expect(script).toContain("compose(['down', '--volumes', '--remove-orphans'])");
  expect(script).toContain("compose(['up', '--detach', '--wait'])");
  expect(script).toContain("compose(['stop', 'postcode-io-gateway'])");
});

test('all published ports are loopback-only and providers remain fixture-backed', () => {
  expect(compose.match(/"127\.0\.0\.1:[0-9]+:[0-9]+"/g)).toHaveLength(7);
  expect(compose).not.toMatch(/ports: \["(?!127\.0\.0\.1:)/);
  expect(compose).toContain('EXTERNAL_PROVIDER_MODE: FIXTURE');
  expect(compose).toContain('DEPLOYMENT_ENVIRONMENT_CLASS: TEST');
  expect(compose).not.toContain('EXTERNAL_PROVIDER_MODE: LIVE');
});
