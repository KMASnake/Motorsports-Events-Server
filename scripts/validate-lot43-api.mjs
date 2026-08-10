const api = process.env.API_URL ?? 'http://127.0.0.1:3001';
const adminToken = process.env.ADMIN_TOKEN;
const viewerToken = process.env.VIEWER_TOKEN;
const expiredToken = process.env.EXPIRED_TOKEN;
const providerSessionId = process.env.PROVIDER_SESSION_ID;
const hiddenSessionId = process.env.HIDDEN_SESSION_ID;
if (!adminToken || !viewerToken || !expiredToken || !providerSessionId || !hiddenSessionId) throw new Error('Les jetons et identifiants de recette sont requis.');

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

const eventId = 'evt-001';
const created = [];
try {
  expect((await call(`/api/v1/admin/events/${eventId}/sessions`, {}, '')).response.status === 401, 'La liste Sessions sans jeton n’est pas rejetée en 401.');
  expect((await call(`/api/v1/admin/events/${eventId}/sessions`, {}, 'invalid')).response.status === 401, 'Le jeton invalide n’est pas rejeté en 401.');
  expect((await call(`/api/v1/admin/events/${eventId}/sessions`, {}, expiredToken)).response.status === 401, 'Le jeton expiré n’est pas rejeté en 401.');
  expect((await call(`/api/v1/admin/events/${eventId}/sessions`, {}, viewerToken)).response.status === 403, 'Le rôle viewer n’est pas rejeté en 403.');
  expect((await call('/api/v1/events', {}, '')).response.ok, 'L’API publique Événements exige désormais une authentification.');

  const types = await ok('/api/v1/admin/session-types');
  expect(types.map((type) => type.key).join(',') === 'practice,qualifying,sprint,warmup,race,other', 'Référentiel des types incorrect.');
  const initialTitles = await ok('/api/v1/admin/session-titles');
  expect(Array.isArray(initialTitles), 'Suggestions d’intitulés invalides.');
  const eventWithTitle = await ok(`/api/v1/admin/events/${eventId}`, {
    method: 'PATCH', body: JSON.stringify({ session_title: 'Superpole inédit API' })
  });
  expect(eventWithTitle.session_title === 'Superpole inédit API', 'Intitulé unique de l’Événement non enregistré.');
  const publicEventWithTitle = await ok(`/api/v1/events/${eventId}`, {}, '');
  expect(publicEventWithTitle.session_title === 'Superpole inédit API', 'Intitulé effectif absent de l’API publique Événement.');
  const eventTitles = await ok('/api/v1/admin/session-titles');
  const eventSuggestion = eventTitles.find((entry) => entry.title === 'Superpole inédit API');
  expect(eventSuggestion && !('origin' in eventSuggestion) && !('provider_key' in eventSuggestion), 'Suggestion Événement absente ou origine exposée.');
  expect((await call(`/api/v1/admin/events/${eventId}/sessions?sort=sql`)).response.status === 400, 'Tri invalide non rejeté.');
  expect((await call(`/api/v1/admin/events/missing-event/sessions`)).response.status === 404, 'Événement absent non rejeté.');
  expect((await call(`/api/v1/admin/events/${eventId}/sessions`, { method: 'POST', body: JSON.stringify({ title: 'Sans offset', starts_at: '2026-06-12T10:00:00' }) })).response.status === 400, 'Date sans offset acceptée.');
  expect((await call(`/api/v1/admin/events/${eventId}/sessions`, { method: 'POST', body: JSON.stringify({ name: 'Ancien contrat', type: 'practice', starts_at: '2026-06-12T10:00:00Z' }) })).response.status === 400, 'Le couple technique nom/type est encore exigé.');
  expect((await call(`/api/v1/admin/events/${eventId}/sessions`, { method: 'POST', body: JSON.stringify({ title: 'Période invalide', starts_at: '2026-06-12T11:00:00Z', ends_at: '2026-06-12T10:00:00Z' }) })).response.status === 400, 'Fin antérieure acceptée.');
  expect((await call(`/api/v1/admin/events/${eventId}/sessions`, { method: 'POST', body: JSON.stringify({ title: 'Technique', starts_at: '2026-06-12T10:00:00Z', origin: 'provider' }) })).response.status === 400, 'Champ technique accepté.');

  const fixtures = [
    { title: 'Alpha essais', starts_at: '2026-06-12T14:00:00+02:00', ends_at: null, status: 'scheduled', published: true },
    { title: 'Bravo minuit', starts_at: '2026-06-13T23:30:00Z', ends_at: '2026-06-14T01:00:00Z', status: 'scheduled', published: true },
    { title: 'Charlie DST', starts_at: '2026-10-25T02:30:00+02:00', ends_at: '2026-10-25T02:30:00+01:00', status: 'scheduled', published: false },
    { title: 'Delta chevauchement', starts_at: '2026-06-15T10:00:00Z', ends_at: '2026-06-15T11:00:00Z', status: 'draft', published: true },
    { title: 'Echo chevauchement', starts_at: '2026-06-15T10:30:00Z', ends_at: '2026-06-15T11:30:00Z', status: 'scheduled', published: true }
  ];
  for (const fixture of fixtures) {
    const session = await ok(`/api/v1/admin/events/${eventId}/sessions`, { method: 'POST', body: JSON.stringify(fixture) });
    created.push(session.id);
    expect(session.origin === 'manual' && session.provider_key === null && session.external_id === null, 'La création humaine contient des métadonnées fournisseur.');
  }
  const utc = await ok(`/api/v1/admin/sessions/${created[0]}`);
  expect(new Date(utc.starts_at).toISOString() === '2026-06-12T12:00:00.000Z' && utc.ends_at === null, 'Normalisation UTC ou fin facultative incorrecte.');

  const page = await ok(`/api/v1/admin/events/${eventId}/sessions?page=2&page_size=2&sort=title&direction=asc`);
  expect(page.pagination.total === 5 && page.items.map((item) => item.name).join(',') === 'Charlie DST,Delta chevauchement', 'Pagination ou tri serveur incorrect.');
  const filtered = await ok(`/api/v1/admin/events/${eventId}/sessions?title=Alpha%20essais&status=scheduled&published=true`);
  expect(filtered.pagination.total === 1 && filtered.items[0].name === 'Alpha essais', 'Filtres combinés incorrects.');

  const suggestions = await ok('/api/v1/admin/session-titles');
  expect(suggestions.some((entry) => entry.title === 'Echo chevauchement'), 'Le nouvel intitulé local n’est pas suggéré.');
  expect(suggestions.some((entry) => entry.title === 'Session fournisseur protégée'), 'L’intitulé fournisseur n’est pas suggéré.');
  expect(new Set(suggestions.map((entry) => entry.title)).size === suggestions.length, 'Les suggestions ne sont pas dédupliquées.');
  expect(suggestions.filter((entry) => entry.title.toLowerCase() === 'alpha essais').length === 1, 'La déduplication fournisseur/local est incorrecte.');
  expect(suggestions.find((entry) => entry.title.toLowerCase() === 'alpha essais')?.usage_count === 2, 'Le compteur de suggestion dédupliquée est incorrect.');
  const updated = await ok(`/api/v1/admin/sessions/${created[0]}`, { method: 'PATCH', body: JSON.stringify({ title: 'Alpha modifié', ends_at: '2026-06-12T13:30:00Z', status: 'completed' }) });
  expect(updated.title === 'Alpha modifié' && updated.status === 'completed', 'Modification Session incorrecte.');
  expect((await call(`/api/v1/admin/sessions/${providerSessionId}`, { method: 'PATCH', body: JSON.stringify({ title: 'Interdit' }) })).response.status === 409, 'Session fournisseur modifiée sans corrections.');

  const publicProvider = await ok('/api/v1/events/evt-002/sessions', {}, '');
  const providerProjection = publicProvider.find((session) => session.id === providerSessionId);
  expect(providerProjection?.title === 'Session fournisseur protégée', 'Intitulé fournisseur absent de l’API publique.');
  for (const forbidden of ['origin', 'provider_key', 'external_id', 'published', 'type', 'name', 'created_at', 'updated_at']) {
    expect(!(forbidden in providerProjection), `Champ public interdit exposé : ${forbidden}`);
  }
  const publicManual = await ok(`/api/v1/events/${eventId}/sessions`, {}, '');
  expect(publicManual.some((session) => session.title === 'Alpha modifié'), 'Session publiée absente de l’API publique.');
  expect(!publicManual.some((session) => session.title === 'Charlie DST'), 'Session non publiée exposée.');
  expect(!publicManual.some((session) => session.title === 'Delta chevauchement'), 'Session brouillon exposée.');
  expect(publicManual.every((session, index) => index === 0 || `${session.starts_at}:${session.id}` >= `${publicManual[index - 1].starts_at}:${publicManual[index - 1].id}`), 'Ordre public instable.');
  expect((await call(`/api/v1/sessions/${hiddenSessionId}`, {}, '')).response.status === 404, 'Session d’un événement non publié exposée.');
  expect((await call(`/api/v1/events/${eventId}/sessions?provider_key=hidden`, {}, '')).response.status === 400, 'Filtre public technique accepté.');

  const auditFailure = await call(`/api/v1/admin/events/${eventId}/sessions`, { method: 'POST', body: JSON.stringify({ title: 'lot43-audit-failure', starts_at: '2026-08-01T10:00:00Z' }) });
  expect(auditFailure.response.status === 500, 'L’échec d’audit n’a pas fait échouer la mutation.');
  const afterFailure = await ok(`/api/v1/admin/events/${eventId}/sessions?search=lot43-audit-failure`);
  expect(afterFailure.pagination.total === 0, 'La Session a survécu à l’échec transactionnel de l’audit.');

  await ok(`/api/v1/admin/sessions/${created[0]}`, { method: 'DELETE' });
  created.shift();
  const audit = await ok('/api/v1/admin/audit?page=1&page_size=100&resource_type=session');
  const relevant = audit.items.filter((row) => row.resource_id === utc.id);
  expect(relevant.length === 3, `Audit Session dupliqué ou incomplet (${relevant.length} lignes).`);
  expect(relevant.every((row) => row.actor === 'lot43-api-test' && row.request_id && 'old_value' in row && 'new_value' in row), 'Audit acteur/avant/après/requête incomplet.');
  expect(!JSON.stringify(relevant).includes(adminToken), 'Le jeton administrateur est exposé dans l’audit.');

  console.log('401 sans/invalide/expiré, 403 et administrateur autorisé : OK');
  console.log('Contrats, références, UTC, minuit, DST et chevauchement : OK');
  console.log('Pagination, filtres et tri avant découpage : OK');
  console.log('CRUD manuel et protection fournisseur : OK');
  console.log('Audit atomique unique et rollback sur échec : OK');
  console.log('API publique visible, ordonnée et sans métadonnée technique : OK');
} finally {
  await call(`/api/v1/admin/events/${eventId}`, { method: 'PATCH', body: JSON.stringify({ session_title: null }) }).catch(() => undefined);
  for (const id of created.reverse()) await call(`/api/v1/admin/sessions/${id}`, { method: 'DELETE' }).catch(() => undefined);
}
