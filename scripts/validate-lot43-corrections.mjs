const api = process.env.API_URL ?? 'http://127.0.0.1:3001';
const adminToken = process.env.ADMIN_TOKEN;
const viewerToken = process.env.VIEWER_TOKEN;
const sessionId = process.env.PROVIDER_SESSION_ID;
if (!adminToken || !viewerToken || !sessionId) throw new Error('ADMIN_TOKEN, VIEWER_TOKEN et PROVIDER_SESSION_ID sont requis.');

const expect = (condition, message) => { if (!condition) throw new Error(message); };
async function call(path, options = {}, token = adminToken) {
  const headers = new Headers(options.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (options.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${api}${path}`, { ...options, headers });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, body };
}
async function ok(path, options = {}, token = adminToken) {
  const result = await call(path, options, token);
  expect(result.response.ok, `${path}: ${result.response.status} ${JSON.stringify(result.body)}`);
  return result.body;
}
const json = (value) => JSON.stringify(value);
const override = (field_name, override_value) => ok(`/api/v1/admin/sessions/${sessionId}/override`, {
  method: 'PATCH', body: json({ field_name, override_value })
});
const sync = (patch) => ok(`/api/v1/admin/provider-sessions/${sessionId}/sync`, {
  method: 'POST', body: json(patch)
});
async function adminSession() { return ok(`/api/v1/admin/sessions/${sessionId}`); }
async function corrections(query = '') { return ok(`/api/v1/admin/session-corrections${query}`); }

expect((await call('/api/v1/admin/session-corrections', {}, '')).response.status === 401, '401 sans jeton absent.');
expect((await call('/api/v1/admin/session-corrections', {}, viewerToken)).response.status === 403, '403 viewer absent.');
expect((await call('/api/v1/admin/session-corrections')).response.status === 200, 'Administrateur refusé.');
expect((await call(`/api/v1/admin/sessions/${sessionId}`, { method: 'PATCH', body: json({ title: 'Direct interdit' }) })).response.status === 409, 'CRUD direct fournisseur autorisé.');
expect((await call(`/api/v1/admin/sessions/${sessionId}/override`, { method: 'PATCH', body: json({ field_name: 'published', override_value: 'false' }) })).response.status === 400, 'Type invalide accepté.');
expect((await call(`/api/v1/admin/sessions/${sessionId}/override`, { method: 'PATCH', body: json({ field_name: 'type', override_value: 'race' }) })).response.status === 400, 'Champ technique accepté.');

await sync({ title: 'Provider Title A' });
expect((await adminSession()).title === 'Provider Title A', 'Modification fournisseur sans override non appliquée.');
expect((await corrections(`?session_id=${sessionId}`)).pagination.total === 0, 'Correction créée sans override.');

let titleCorrection = await override('title', 'Local Superpole');
expect(titleCorrection.field_name === 'title', 'Correction title non créée.');
await sync({ title: 'Provider Title B' });
titleCorrection = await ok(`/api/v1/admin/session-corrections/${titleCorrection.id}`);
expect(titleCorrection.status === 'conflict' && titleCorrection.provider_value === 'Provider Title B', 'Conflit fournisseur/local non détecté.');
expect((await adminSession()).title === 'Local Superpole', 'Override title non conservé.');
const publicSession = await ok(`/api/v1/sessions/${sessionId}`, {}, '');
expect(publicSession.title === 'Local Superpole', 'API publique différente de la valeur effective.');
for (const key of ['provider_value', 'override_value', 'provider_key', 'external_id', 'origin', 'type', 'name']) {
  expect(!(key in publicSession), `Champ technique public exposé : ${key}`);
}
const titles = await ok('/api/v1/admin/session-titles');
for (const title of ['Provider Title B', 'Local Superpole']) expect(titles.some((row) => row.title === title), `Suggestion absente : ${title}`);
expect(new Set(titles.map((row) => row.title.toLowerCase())).size === titles.length, 'Suggestions non dédupliquées sans tenir compte de la casse.');

await ok(`/api/v1/admin/session-corrections/${titleCorrection.id}/keep-override`, { method: 'POST' });
expect((await ok(`/api/v1/admin/session-corrections/${titleCorrection.id}`)).status === 'active', 'Conserver override incorrect.');
await ok(`/api/v1/admin/session-corrections/${titleCorrection.id}/accept-provider`, { method: 'POST' });
expect((await adminSession()).title === 'Provider Title B', 'Accept provider incorrect.');

const typed = [
  ['ends_at', null], ['starts_at', '2026-10-25T02:30:00+02:00'],
  ['status', 'postponed'], ['published', false], ['description', 'Description locale']
];
const typedIds = [];
for (const [field, value] of typed) typedIds.push((await override(field, value)).id);
const typedSession = await adminSession();
expect(new Date(typedSession.starts_at).toISOString() === '2026-10-25T00:30:00.000Z', 'Override date non normalisé UTC.');
expect(typedSession.ends_at === null && typedSession.status === 'postponed' && typedSession.published === false && typedSession.description === 'Description locale', 'Overrides typés incorrects.');
const filtered = await corrections(`?event_id=evt-002&session_id=${sessionId}&provider=lot43-corrections&status=active&conflict=false&sort=field_name&direction=asc&page=1&page_size=2`);
expect(filtered.pagination.total === 5 && filtered.items.length === 2, 'Filtres combinés ou pagination incorrects.');
expect((await call('/api/v1/admin/session-corrections?sort=sql')).response.status === 400, 'Tri non sécurisé accepté.');
for (const id of typedIds.reverse()) await ok(`/api/v1/admin/session-corrections/${id}`, { method: 'DELETE' });

let convergence = await override('title', 'Converged Title');
await sync({ title: 'Converged Title' });
expect((await call(`/api/v1/admin/session-corrections/${convergence.id}`)).response.status === 404, 'Convergence fournisseur/local conserve la correction.');

let restore = await override('description', 'Override à restaurer');
await ok(`/api/v1/admin/session-corrections/${restore.id}`, { method: 'DELETE' });
expect((await adminSession()).description === null, 'Restauration fournisseur incorrecte.');

let concurrent = await override('title', 'Concurrent base');
const concurrentOverrides = await Promise.all([
  call(`/api/v1/admin/session-corrections/${concurrent.id}`, { method: 'PATCH', body: json({ field_name: 'title', override_value: 'Concurrent A' }) }),
  call(`/api/v1/admin/session-corrections/${concurrent.id}`, { method: 'PATCH', body: json({ field_name: 'title', override_value: 'Concurrent B' }) })
]);
expect(concurrentOverrides.every(({ response }) => response.status === 200), 'Deux overrides concurrents non sérialisés.');
expect(['Concurrent A', 'Concurrent B'].includes((await adminSession()).title), 'État concurrent corrompu.');
expect((await corrections(`?session_id=${sessionId}&field=title`)).pagination.total === 1, 'Deux corrections concurrentes créées.');

const race = await Promise.all([
  call(`/api/v1/admin/provider-sessions/${sessionId}/sync`, { method: 'POST', body: json({ title: 'Provider concurrent' }) }),
  call(`/api/v1/admin/session-corrections/${concurrent.id}`, { method: 'PATCH', body: json({ field_name: 'title', override_value: 'Local concurrent' }) })
]);
expect(race.every(({ response }) => response.status === 200), 'Synchro/override concurrent refusé.');
const afterRace = await ok(`/api/v1/admin/session-corrections/${concurrent.id}`);
expect(afterRace.provider_value === 'Provider concurrent' && afterRace.override_value === 'Local concurrent', 'Synchro/override concurrent corrompu.');
expect((await adminSession()).title === 'Local concurrent', 'Valeur effective concurrente incorrecte.');

const resolutions = await Promise.all([
  call(`/api/v1/admin/session-corrections/${concurrent.id}/accept-provider`, { method: 'POST' }),
  call(`/api/v1/admin/session-corrections/${concurrent.id}/accept-provider`, { method: 'POST' })
]);
expect(resolutions.map(({ response }) => response.status).sort().join(',') === '204,404', 'Deux résolutions simultanées non sérialisées.');

const beforeRollback = await adminSession();
const rollback = await call(`/api/v1/admin/sessions/${sessionId}/override`, {
  method: 'PATCH', body: json({ field_name: 'title', override_value: 'lot43-correction-audit-failure' })
});
expect(rollback.response.status === 500, 'Échec audit synthétique non propagé.');
expect((await adminSession()).title === beforeRollback.title, 'Mutation conservée après échec audit.');
expect((await corrections(`?session_id=${sessionId}&field=title`)).pagination.total === 0, 'Correction conservée après rollback audit.');
const remainingCorrections = await corrections(`?session_id=${sessionId}`);
expect(remainingCorrections.pagination.total === 0, `Corrections résiduelles : ${json(remainingCorrections.items.map((row) => row.field_name))}`);

const audit = await ok('/api/v1/admin/audit?page=1&page_size=100&resource_type=session-correction');
expect(audit.items.length > 0 && audit.items.every((row) => row.actor === 'lot43-corrections-test' && row.request_id), 'Audit correction incomplet.');
expect(!json(audit).includes(adminToken), 'Jeton exposé dans l’audit.');

console.log('Sécurité, CRUD fournisseur protégé et validation typée : OK');
console.log('Valeurs fournisseur, overrides, conflits et convergence : OK');
console.log('Pagination, filtres, tri et suggestions : OK');
console.log('API publique limitée à la valeur effective : OK');
console.log('Concurrence résolutions/synchronisation/overrides : OK');
console.log('Audit atomique et rollback complet : OK');
