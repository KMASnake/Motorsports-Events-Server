const api = process.env.API_URL ?? 'http://localhost:3001';
const marker = `lot3-test-${Date.now()}`;

async function call(path, options = {}) {
  const headers = {
    ...(options.headers ?? {})
  };

  if (options.body !== undefined && options.body !== null) {
    headers['content-type'] ??= 'application/json';
  }

  const response = await fetch(`${api}${path}`, {
    ...options,
    headers
  });

  const body = response.status === 204
    ? null
    : await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `${options.method ?? 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body)}`
    );
  }

  return body;
}

console.log('=== API health ===');
console.log(await call('/health'));

console.log('\n=== CRUD championnats ===');

const created = await call('/api/v1/championships', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Championnat de validation Lot 3',
    slug: marker,
    short_name: 'L3',
    season: 2026,
    active: true,
    sync_enabled: false,
    category: null
  })
});

console.log('Création OK :', created.id);

const updated = await call(`/api/v1/championships/${created.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    active: false,
    category: 'Validation'
  })
});

if (updated.active !== false || updated.category !== 'Validation') {
  throw new Error('Mise à jour incohérente.');
}

console.log('Modification OK');

await call(`/api/v1/championships/${created.id}`, {
  method: 'DELETE'
});

console.log('Suppression OK');

const rows = await call('/api/v1/championships');

if (rows.some((row) => row.id === created.id)) {
  throw new Error('Le championnat de test existe encore.');
}

console.log('Liste finale OK');
console.log(
  '\nLot 3 techniquement accessible. Vérifier visuellement le tableau, ' +
  'le formulaire, les filtres et les actions.'
);
