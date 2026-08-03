const api = process.env.API_URL ?? 'http://127.0.0.1:3001';

async function call(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  const response = await fetch(`${api}${path}`, { ...options, headers });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, body };
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectOk(path, options = {}) {
  const result = await call(path, options);
  expect(result.response.ok, `${options.method ?? 'GET'} ${path} -> ${result.response.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

const createdIds = [];
try {
  const championships = await expectOk('/api/v1/championships');
  const circuits = await expectOk('/api/v1/circuits');
  expect(championships.length > 0, 'Aucun championnat disponible.');
  expect(circuits.length > 0, 'Aucun circuit disponible pour vérifier le fuseau.');
  const common = {
    championship_id: championships[0].id,
    circuit_id: circuits[0].id,
    name: 'Grand Prix Étape Trois',
    category: null,
    starts_at: '2026-12-27T10:00:00.000Z',
    ends_at: '2026-12-27T12:00:00.000Z',
    status: 'scheduled',
    published: true,
    description: 'Validation des métadonnées calculées.'
  };

  const forbidden = await call('/api/v1/admin/events', {
    method: 'POST', body: JSON.stringify({ ...common, slug: 'slug-impose', origin: 'provider', timezone: 'Pacific/Auckland' })
  });
  expect(forbidden.response.status === 400, 'Les métadonnées techniques administratives auraient dû être refusées.');

  const first = await expectOk('/api/v1/admin/events', { method: 'POST', body: JSON.stringify(common) });
  createdIds.push(first.id);
  expect(first.slug === 'grand-prix-etape-trois', `Slug inattendu : ${first.slug}`);
  expect(first.origin === 'manual', `Origine inattendue : ${first.origin}`);
  expect(first.provider_key === null && first.external_id === null, 'Une création manuelle contient une identité fournisseur.');
  expect(first.timezone === 'UTC', `Le fuseau de stockage doit être UTC : ${first.timezone}`);

  const second = await expectOk('/api/v1/admin/events', { method: 'POST', body: JSON.stringify({ ...common, starts_at: '2026-12-28T10:00:00.000Z', ends_at: null }) });
  createdIds.push(second.id);
  expect(second.slug === 'grand-prix-etape-trois-2', `Le slug unique n’a pas été suffixé : ${second.slug}`);

  const withoutCircuit = await expectOk('/api/v1/admin/events', {
    method: 'POST', body: JSON.stringify({ ...common, name: 'Événement sans circuit', circuit_id: null, starts_at: '2026-12-29T10:00:00.000Z', ends_at: null })
  });
  createdIds.push(withoutCircuit.id);
  expect(withoutCircuit.timezone === 'UTC', `Le fuseau sans circuit doit être UTC : ${withoutCircuit.timezone}`);

  const patchTechnical = await call(`/api/v1/admin/events/${first.id}`, {
    method: 'PATCH', body: JSON.stringify({ origin: 'provider', timezone: 'UTC', slug: 'modification-interdite' })
  });
  expect(patchTechnical.response.status === 400, 'La modification de métadonnées techniques aurait dû être refusée.');

  const provider = await expectOk('/api/v1/admin/provider-events', {
    method: 'POST',
    body: JSON.stringify({ ...common, name: 'Événement ingéré', provider_key: 'step3-fixture', external_id: `step3-${Date.now()}` })
  });
  createdIds.push(provider.id);
  expect(provider.origin === 'provider', 'La route fournisseur ne génère pas l’origine provider.');

  const publicEvent = await expectOk(`/api/v1/events/${first.id}`);
  for (const internal of ['origin', 'provider_key', 'external_id']) {
    expect(!(internal in publicEvent), `L’API publique expose ${internal}.`);
  }

  console.log('Étape 3 API/PostgreSQL : OK');
  console.log('Slug automatique et unique : OK');
  console.log('Origine manuelle automatique : OK');
  console.log('Stockage uniforme des fuseaux en UTC : OK');
  console.log('Métadonnées techniques refusées dans les mutations admin : OK');
  console.log('Ingestion fournisseur séparée et API publique inchangée : OK');
} finally {
  for (const id of createdIds.reverse()) {
    await call(`/api/v1/admin/events/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }
}
