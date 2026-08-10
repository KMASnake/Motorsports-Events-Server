do $$
declare
  expected_types jsonb := '[
    {"key":"practice","label":"Essais","sort_order":1,"active":true},
    {"key":"qualifying","label":"Qualifications","sort_order":2,"active":true},
    {"key":"sprint","label":"Sprint","sort_order":3,"active":true},
    {"key":"warmup","label":"Warm-up","sort_order":4,"active":true},
    {"key":"race","label":"Course","sort_order":5,"active":true},
    {"key":"other","label":"Autre","sort_order":6,"active":true}
  ]'::jsonb;
  actual_types jsonb;
begin
  if exists(select 1 from sessions) then
    raise exception 'Refusing to drop sessions while session rows remain';
  end if;

  if exists(select 1 from session_corrections) then
    raise exception 'Refusing to drop session_corrections while correction rows remain';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', key,
        'label', label,
        'sort_order', sort_order,
        'active', active
      ) order by sort_order, key
    ),
    '[]'::jsonb
  )
  into actual_types
  from session_types;

  if actual_types <> expected_types then
    raise exception 'Refusing to drop customized session_types';
  end if;
end $$;

drop table session_corrections;
drop table sessions;
drop table session_types;
delete from schema_migrations where version = '0004_sessions';
