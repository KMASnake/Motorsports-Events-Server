import { execFileSync } from 'node:child_process';

function request(url) {
  return fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`${url} retourne HTTP ${response.status}`);
    return response;
  });
}

console.log('=== Docker Compose ===');
execFileSync('docker', ['compose', 'ps'], { stdio: 'inherit', shell: true });

const apiPort = process.env.API_HOST_PORT || '3001';
const webPort = process.env.WEB_HOST_PORT || '3000';

console.log('\n=== API health ===');
const health = await request(`http://localhost:${apiPort}/health`).then((response) => response.json());
console.log(health);
if (health.status !== 'ok' || health.checks?.database !== true) {
  throw new Error('Le healthcheck API ou base de données a échoué.');
}

console.log('\n=== Dashboard summary ===');
console.log(await request(`http://localhost:${apiPort}/api/v1/dashboard/summary`).then((response) => response.json()));

console.log('\n=== Frontend ===');
await request(`http://localhost:${webPort}`);
console.log(`Frontend accessible sur http://localhost:${webPort}`);

console.log('\nLot 2 techniquement accessible. Vérifier le shell, la navigation et les quatre pages de référence.');
