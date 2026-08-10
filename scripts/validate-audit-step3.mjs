const api = process.env.API_URL ?? 'http://127.0.0.1:3001';
const admin = process.env.ADMIN_TOKEN; const viewer = process.env.VIEWER_TOKEN; const expired = process.env.EXPIRED_TOKEN;
if (!admin || !viewer || !expired) throw new Error('ADMIN_TOKEN, VIEWER_TOKEN et EXPIRED_TOKEN sont requis.');
const families = ['/api/v1/admin/events', '/api/v1/admin/provider-events', '/api/v1/admin/corrections'];
async function call(path, token, options = {}) {
  const headers = new Headers(options.headers); if (token) headers.set('authorization', `Bearer ${token}`);
  if (options.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${api}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null); return { response, body };
}
const expect = (condition, message) => { if (!condition) throw new Error(message); };
let eventId;
try {
  for (const path of families) {
    expect((await call(path, null)).response.status === 401, `${path} doit répondre 401 sans jeton.`);
    expect((await call(path, 'invalide')).response.status === 401, `${path} doit répondre 401 avec un jeton invalide.`);
    expect((await call(path, expired)).response.status === 401, `${path} doit répondre 401 avec un jeton expiré.`);
    expect((await call(path, viewer)).response.status === 403, `${path} doit répondre 403 pour viewer.`);
  }
  expect((await call('/api/v1/admin/events', admin)).response.status === 200, 'Un administrateur ne peut pas lire les événements.');
  expect((await call('/api/v1/admin/corrections', admin)).response.status === 200, 'Un administrateur ne peut pas lire les corrections.');
  const championships = (await call('/api/v1/championships', null)).body;
  const circuits = (await call('/api/v1/circuits', null)).body;
  const created = await call('/api/v1/admin/provider-events', admin, { method: 'POST', body: JSON.stringify({
    championship_id: championships[0].id, circuit_id: circuits[0]?.id ?? null, name: 'Fixture sécurité étape 3',
    category: null, starts_at: '2026-12-30T10:00:00.000Z', ends_at: null, status: 'scheduled', published: true,
    description: null, provider_key: 'audit-step3', external_id: `security-${Date.now()}`
  }) });
  expect(created.response.status === 201, `Création fournisseur administrateur refusée: ${created.response.status}`); eventId = created.body.id;
  expect((await call('/api/v1/events', null)).response.status === 200, 'La route publique a été protégée par erreur.');
  expect((await call('/api/v1/championships', null)).response.status === 200, 'La lecture publique des championnats a été protégée.');
  expect((await call('/api/v1/championships', null, { method: 'POST', body: '{}' })).response.status === 401, 'La mutation championnat est publique.');
  expect((await call('/api/v1/championships', viewer, { method: 'POST', body: '{}' })).response.status === 403, 'La mutation championnat accepte viewer.');
  expect((await call('/api/v1/championships', admin, { method: 'POST', body: '{}' })).response.status === 400, 'La mutation championnat administrateur n’atteint pas sa validation métier.');
  console.log('401 sans jeton, invalide ou expiré : OK');
  console.log('403 pour le rôle viewer : OK');
  console.log('Administrateur autorisé sur événements, fournisseur et corrections : OK');
  console.log('API publique sans authentification : OK');
} finally {
  if (eventId) await call(`/api/v1/admin/events/${eventId}`, admin, { method: 'DELETE' });
}
