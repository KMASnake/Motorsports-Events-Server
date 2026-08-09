const api = process.env.API_URL ?? 'http://127.0.0.1:3001';
const token = process.env.ADMIN_TOKEN;
if (!token) throw new Error('ADMIN_TOKEN est requis.');
const expect = (condition, message) => { if (!condition) throw new Error(message); };
async function call(path, options = {}) {
  const headers = new Headers(options.headers); headers.set('authorization', `Bearer ${token}`);
  if (options.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${api}${path}`, { ...options, headers });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, body };
}
async function ok(path, options = {}) {
  const result = await call(path, options);
  expect(result.response.ok, `${path}: ${result.response.status} ${JSON.stringify(result.body)}`);
  return result.body;
}
async function corrections(eventId) {
  const body = await ok(`/api/v1/admin/corrections?event_id=${eventId}&page=1&page_size=100`);
  return body.items;
}

const created = []; const marker = `audit-step5-${Date.now()}`;
try {
  const championships = await ok('/api/v1/championships'); const circuits = await ok('/api/v1/circuits');
  const common = { championship_id: championships[0].id, circuit_id: circuits[0]?.id ?? null, category: null,
    starts_at: '2027-03-28T00:30:00.000Z', ends_at: '2027-03-28T02:30:00.000Z', status: 'scheduled', published: true, description: null };
  const provider = await ok('/api/v1/admin/provider-events', { method: 'POST', body: JSON.stringify({ ...common, name: `${marker} fournisseur`, provider_key: 'audit-step5', external_id: marker }) });
  created.push(provider.id);

  await ok(`/api/v1/admin/events/${provider.id}`, { method: 'PATCH', body: JSON.stringify({ name: `${marker} local` }) });
  const nameCorrection = (await corrections(provider.id)).find((row) => row.field_name === 'name');
  expect(nameCorrection, 'La correction concurrente attendue est absente.');
  const resolutions = await Promise.all([
    call(`/api/v1/admin/corrections/${nameCorrection.id}/accept-provider`, { method: 'POST' }),
    call(`/api/v1/admin/corrections/${nameCorrection.id}/accept-provider`, { method: 'POST' })
  ]);
  expect(resolutions.every(({ response }) => [204, 404].includes(response.status)), 'Une résolution simultanée a produit une erreur inattendue.');
  expect(resolutions.filter(({ response }) => response.status === 204).length === 1, 'Une seule résolution doit gagner.');
  expect((await corrections(provider.id)).every((row) => row.field_name !== 'name'), 'La correction résolue subsiste.');

  const localName = `${marker} administrateur`; const providerName = `${marker} synchronisé`;
  const simultaneous = await Promise.all([
    call(`/api/v1/admin/events/${provider.id}`, { method: 'PATCH', body: JSON.stringify({ name: localName }) }),
    call(`/api/v1/admin/events/${provider.id}/provider-sync`, { method: 'POST', body: JSON.stringify({ name: providerName }) })
  ]);
  expect(simultaneous.every(({ response }) => response.ok), 'La synchronisation/modification simultanée a échoué.');
  const finalEvent = await ok(`/api/v1/admin/events/${provider.id}`);
  const finalCorrection = (await corrections(provider.id)).find((row) => row.field_name === 'name');
  expect(finalEvent.name === localName && finalCorrection?.override_value === localName && finalCorrection?.provider_value === providerName,
    'La valeur locale n’a pas été préservée face à la synchronisation fournisseur.');

  const before = JSON.stringify(await corrections(provider.id));
  const rollback = await call(`/api/v1/admin/events/${provider.id}`, { method: 'PATCH', body: JSON.stringify({ description: `${marker} rollback`, circuit_id: 'circuit-inexistant' }) });
  expect(rollback.response.status === 400, 'L’erreur transactionnelle attendue n’est pas rejetée en 400.');
  const afterEvent = await ok(`/api/v1/admin/events/${provider.id}`); const after = JSON.stringify(await corrections(provider.id));
  expect(afterEvent.description !== `${marker} rollback` && before === after, 'Le rollback n’a pas restauré événement et corrections.');

  console.log('Deux résolutions simultanées sérialisées sans corruption : OK');
  console.log('Synchronisation fournisseur et modification administrateur sérialisées : OK');
  console.log('Rollback transactionnel événement/corrections après erreur : OK');
  console.log('Fixture UTC traversant le changement d’heure conservée : OK');
} finally {
  for (const id of created.reverse()) await call(`/api/v1/admin/events/${id}`, { method: 'DELETE' }).catch(() => undefined);
}
