import fs from 'node:fs';

const required = [
  'package.json',
  'docker-compose.yml',
  'apps/web/package.json',
  'apps/api/package.json',
  'infra/postgres/init/001-bootstrap.sql',
  '.github/workflows/ci.yml'
];

const missing = required.filter(path => !fs.existsSync(path));
if (missing.length) {
  console.error('Missing bootstrap files:', missing);
  process.exit(1);
}
console.log('Bootstrap structure OK');
