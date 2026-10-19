insert into events(
  id,championship_id,circuit_id,name,slug,starts_at,timezone,status,published,origin
) values
  (
    'evt-001','f1','lemans','Grand Prix de France','lot43-ui-grand-prix-france',
    '2026-05-10T09:00:00Z','Europe/Paris','scheduled',true,'manual'
  ),
  (
    'evt-002','f1','silverstone','Grand Prix de Grande-Bretagne','lot43-ui-grand-prix-grande-bretagne',
    '2026-07-05T14:00:00Z','Europe/London','scheduled',true,'manual'
  )
on conflict (id) do update set
  championship_id=excluded.championship_id,
  circuit_id=excluded.circuit_id,
  name=excluded.name,
  slug=excluded.slug,
  starts_at=excluded.starts_at,
  timezone=excluded.timezone,
  status=excluded.status,
  published=excluded.published,
  origin=excluded.origin,
  updated_at=now();
