const api = process.env.API_URL ?? 'http://127.0.0.1:3001';

async function call(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  const response = await fetch(`${api}${path}`, { ...options, headers });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, body };
}
function expect(condition, message) { if (!condition) throw new Error(message); }
async function ok(path, options = {}) {
  const result = await call(path, options);
  expect(result.response.ok, `${options.method ?? 'GET'} ${path}: ${result.response.status} ${JSON.stringify(result.body)}`);
  return result.body;
}

let eventId;
try {
  const championships = await ok('/api/v1/championships');
  const circuits = await ok('/api/v1/circuits');
  expect(championships.length > 1 && circuits.length > 0, 'Le jeu de données doit contenir deux championnats et un circuit.');
  const event = await ok('/api/v1/admin/provider-events', { method: 'POST', body: JSON.stringify({
    championship_id: championships[0].id, circuit_id: circuits[0].id,
    name: 'Fixture audit étape 2', category: null,
    starts_at: '2026-12-20T10:00:00.000Z', ends_at: '2026-12-20T12:00:00.000Z',
    status: 'scheduled', published: true, description: null,
    provider_key: 'audit-step2', external_id: `typed-${Date.now()}`
  }) });
  eventId = event.id;
  await ok(`/api/v1/admin/events/${eventId}`, { method: 'PATCH', body: JSON.stringify({
    name: 'Valeur locale', published: false, championship_id: championships[1].id,
    starts_at: '2026-12-20T11:00:00.000Z'
  }) });
  const corrections = await ok(`/api/v1/admin/corrections?event_id=${eventId}`);
  const byField = Object.fromEntries(corrections.map((row) => [row.field_name, row]));

  for (const [field_name, override_value] of [['name', false], ['published', 'false'], ['starts_at', 'date-invalide']]) {
    const rejected = await call(`/api/v1/admin/corrections/${byField[field_name].id}`, {
      method: 'PATCH', body: JSON.stringify({ field_name, override_value })
    });
    expect(rejected.response.status === 400, `${field_name} incompatible n'a pas été rejeté.`);
  }
  const missingReference = await call(`/api/v1/admin/corrections/${byField.championship_id.id}`, {
    method: 'PATCH', body: JSON.stringify({ field_name: 'championship_id', override_value: 'championnat-inexistant' })
  });
  expect(missingReference.response.status === 400, 'La référence championnat inexistante n’a pas été rejetée.');

  await ok(`/api/v1/admin/corrections/${byField.name.id}`, {
    method: 'PATCH', body: JSON.stringify({ field_name: 'name', override_value: 'Valeur locale typée' })
  });
  await ok(`/api/v1/admin/corrections/${byField.starts_at.id}`, {
    method: 'PATCH', body: JSON.stringify({ field_name: 'starts_at', override_value: '2026-12-20T13:00:00+02:00' })
  });
  const updated = await ok(`/api/v1/admin/events/${eventId}`);
  expect(updated.name === 'Valeur locale typée', 'La chaîne valide n’est pas appliquée.');
  expect(new Date(updated.starts_at).toISOString() === '2026-12-20T11:00:00.000Z', 'La date n’est pas normalisée en UTC.');

  console.log('Validation typée des corrections : OK');
  console.log('Types incompatibles rejetés en 400 : OK');
  console.log('Référence inexistante rejetée en 400 : OK');
  console.log('Date avec offset normalisée en UTC : OK');
} finally {
  if (eventId) await call(`/api/v1/admin/events/${eventId}`, { method: 'DELETE' });
}
