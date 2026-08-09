const api = process.env.API_URL ?? 'http://127.0.0.1:3001'; const token = process.env.ADMIN_TOKEN;
if (!token) throw new Error('ADMIN_TOKEN est requis.');
async function call(path, options = {}) {
  const headers = new Headers(options.headers); headers.set('authorization', `Bearer ${token}`);
  if (options.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${api}${path}`, { ...options, headers });
  const body = response.status === 204 ? null : await response.json().catch(() => null); return { response, body };
}
const expect = (condition, message) => { if (!condition) throw new Error(message); };
async function ok(path, options = {}) { const result = await call(path, options); expect(result.response.ok, `${path}: ${result.response.status} ${JSON.stringify(result.body)}`); return result.body; }
const created = []; const marker = `audit-step4-${Date.now()}`;
try {
  const championships = await ok('/api/v1/championships'); const circuits = await ok('/api/v1/circuits');
  const common = { championship_id: championships[0].id, circuit_id: circuits[0]?.id ?? null, category: null,
    starts_at: '2027-01-10T10:00:00.000Z', ends_at: null, status: 'scheduled', published: true, description: null };
  for (let index = 0; index < 27; index += 1) {
    const event = await ok('/api/v1/admin/events', { method: 'POST', body: JSON.stringify({ ...common, name: `${marker} ${String(index).padStart(2, '0')}` }) });
    created.push(event.id);
  }
  const page = await ok(`/api/v1/admin/events?search=${marker}&page=2&page_size=25&sort=name&direction=asc`);
  expect(page.pagination.total === 27 && page.items.length === 2 && page.items[0].name.endsWith('25'), 'Pagination/tri événements incorrects.');
  expect((await call('/api/v1/admin/events?page=0')).response.status === 400, 'Page événement invalide non rejetée.');
  expect((await call('/api/v1/admin/events?sort=sql')).response.status === 400, 'Tri événement invalide non rejeté.');

  const externalId = `${marker}-provider`;
  const provider = await ok('/api/v1/admin/provider-events', { method: 'POST', body: JSON.stringify({ ...common, name: 'Fournisseur audit étape 4', provider_key: 'audit-step4', external_id: externalId }) });
  created.push(provider.id);
  const duplicate = await call('/api/v1/admin/provider-events', { method: 'POST', body: JSON.stringify({ ...common, name: 'Doublon', provider_key: 'audit-step4', external_id: externalId }) });
  expect(duplicate.response.status === 409, 'L’identité fournisseur dupliquée n’est pas rejetée.');
  await ok(`/api/v1/admin/events/${provider.id}`, { method: 'PATCH', body: JSON.stringify({ name: 'Local audit', published: false, status: 'postponed', description: 'Override' }) });
  const corrections = await ok(`/api/v1/admin/corrections?event_id=${provider.id}&page=2&page_size=2&sort=field_name&direction=asc`);
  expect(corrections.pagination.total === 4 && corrections.items.length === 2, 'Pagination corrections incorrecte.');
  expect((await call('/api/v1/admin/corrections?field=timezone')).response.status === 400, 'Filtre correction invalide non rejeté.');

  const audit = await ok('/api/v1/admin/audit?page=1&page_size=100');
  const relevant = audit.items.filter((row) => row.resource_id === provider.id || created.includes(row.resource_id));
  expect(relevant.length >= 29, 'Des mutations ne sont pas journalisées.');
  expect(relevant.every((row) => row.actor && row.request_id && 'old_value' in row && 'new_value' in row), 'Journal incomplet.');
  expect(!JSON.stringify(relevant).includes(token), 'Un jeton est exposé dans le journal.');
  console.log('Pagination et tri serveur avant découpage : OK');
  console.log('Filtres invalides rejetés en 400 : OK');
  console.log('Identité fournisseur unique : OK');
  console.log('Journal acteur/avant/après/requête sans secret : OK');
} finally {
  for (const id of created.reverse()) await call(`/api/v1/admin/events/${id}`, { method: 'DELETE' }).catch(() => undefined);
}
