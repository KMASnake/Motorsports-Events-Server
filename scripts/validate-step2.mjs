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

const marker = `step2-${Date.now().toString(36)}`;
const createdIds = [];

try {
  const championships = await expectOk('/api/v1/championships');
  const circuits = await expectOk('/api/v1/circuits');
  const common = {
    championship_id: championships[0].id,
    circuit_id: circuits[0]?.id ?? null,
    category: null,
    starts_at: '2026-12-23T10:00:00.000Z',
    ends_at: '2026-12-23T12:00:00.000Z',
    status: 'scheduled',
    published: true,
    description: 'Validation transactionnelle Lot 4.2 étape 2.'
  };

  const manual = await expectOk('/api/v1/admin/events', {
    method: 'POST',
    body: JSON.stringify({ ...common, name: `Événement manuel étape 2 ${marker}` })
  });
  createdIds.push(manual.id);
  await expectOk(`/api/v1/admin/events/${manual.id}`, {
    method: 'PATCH', body: JSON.stringify({ name: 'Événement manuel modifié' })
  });
  let corrections = await expectOk(`/api/v1/admin/corrections?event_id=${manual.id}`);
  expect(corrections.length === 0, 'Un événement manuel a créé une correction fournisseur.');
  const rejectedManualSync = await call(`/api/v1/admin/events/${manual.id}/provider-sync`, {
    method: 'POST', body: JSON.stringify({ name: 'Synchronisation interdite' })
  });
  expect(rejectedManualSync.response.status === 409, 'La synchronisation d’un événement manuel aurait dû être refusée.');

  const originalProviderName = 'Valeur fournisseur initiale';
  const provider = await expectOk('/api/v1/admin/provider-events', {
    method: 'POST',
    body: JSON.stringify({
      ...common,
      name: originalProviderName,
      provider_key: 'step2-fixture',
      external_id: marker
    })
  });
  createdIds.push(provider.id);

  await expectOk(`/api/v1/admin/events/${provider.id}`, {
    method: 'PATCH', body: JSON.stringify({ name: 'Première valeur locale' })
  });
  await expectOk(`/api/v1/admin/events/${provider.id}`, {
    method: 'PATCH', body: JSON.stringify({ name: 'Deuxième valeur locale' })
  });
  corrections = await expectOk(`/api/v1/admin/corrections?event_id=${provider.id}`);
  let nameCorrection = corrections.find((row) => row.field_name === 'name');
  expect(nameCorrection?.provider_value === originalProviderName, 'La deuxième édition locale a altéré la valeur fournisseur.');
  expect(nameCorrection?.override_value === 'Deuxième valeur locale', 'La deuxième valeur locale n’est pas effective.');

  const synchronized = await expectOk(`/api/v1/admin/events/${provider.id}/provider-sync`, {
    method: 'POST', body: JSON.stringify({ name: 'Nouvelle valeur fournisseur' })
  });
  expect(synchronized.name === 'Deuxième valeur locale', 'La synchronisation a écrasé l’override local.');
  corrections = await expectOk(`/api/v1/admin/corrections?event_id=${provider.id}`);
  nameCorrection = corrections.find((row) => row.field_name === 'name');
  expect(nameCorrection?.status === 'conflict', 'Le changement fournisseur sous override n’a pas créé de conflit.');
  expect(nameCorrection?.provider_value === 'Nouvelle valeur fournisseur', 'La nouvelle valeur fournisseur n’a pas été mémorisée.');

  await expectOk(`/api/v1/admin/corrections/${nameCorrection.id}/keep-override`, { method: 'POST' });
  corrections = await expectOk(`/api/v1/admin/corrections?event_id=${provider.id}`);
  nameCorrection = corrections.find((row) => row.field_name === 'name');
  expect(nameCorrection?.status === 'active', 'Conserver local n’a pas résolu le conflit.');

  await expectOk(`/api/v1/admin/events/${provider.id}/provider-sync`, {
    method: 'POST', body: JSON.stringify({ name: 'Valeur fournisseur acceptée' })
  });
  corrections = await expectOk(`/api/v1/admin/corrections?event_id=${provider.id}`);
  nameCorrection = corrections.find((row) => row.field_name === 'name');
  const accepted = await call(`/api/v1/admin/corrections/${nameCorrection.id}/accept-provider`, { method: 'POST' });
  expect(accepted.response.status === 204, 'Accepter fournisseur doit supprimer l’override actif.');

  const adminEvent = await expectOk(`/api/v1/admin/events/${provider.id}`);
  expect(adminEvent.name === 'Valeur fournisseur acceptée', 'La valeur fournisseur acceptée n’est pas effective.');
  corrections = await expectOk(`/api/v1/admin/corrections?event_id=${provider.id}`);
  expect(corrections.length === 0, 'Une correction acceptée reste active.');

  const publicEvent = await expectOk(`/api/v1/events/${provider.id}`);
  expect(publicEvent.name === 'Valeur fournisseur acceptée', 'L’API publique ne retourne pas la valeur effective.');
  for (const internal of ['provider_key', 'external_id', 'provider_value', 'override_value', 'created_by', 'conflict_detected_at']) {
    expect(!(internal in publicEvent), `L’API publique expose ${internal}.`);
  }

  await expectOk(`/api/v1/admin/events/${provider.id}`, {
    method: 'PATCH', body: JSON.stringify({ name: 'Override temporaire' })
  });
  await expectOk(`/api/v1/admin/events/${provider.id}`, {
    method: 'PATCH', body: JSON.stringify({ name: 'Valeur fournisseur acceptée' })
  });
  corrections = await expectOk(`/api/v1/admin/corrections?event_id=${provider.id}`);
  expect(corrections.length === 0, 'Le retour à la valeur fournisseur n’a pas supprimé la correction.');

  console.log('Étape 2 API/PostgreSQL : OK');
  console.log('Événement manuel sans correction : OK');
  console.log('Override protégé et conflit fournisseur : OK');
  console.log('Résolutions locale/fournisseur : OK');
  console.log('API publique effective et nettoyée : OK');
} finally {
  for (const id of createdIds.reverse()) {
    await call(`/api/v1/admin/events/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }
}
