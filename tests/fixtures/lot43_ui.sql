delete from session_corrections where session_id like 'lot43-ui-%';
delete from sessions where id like 'lot43-ui-%';

update events set session_title=null where id in ('evt-001','evt-002');
update events set session_title='Qualifications' where id='evt-001';
update events set session_title='Warm-up' where id='evt-002';

-- Valeur historique fournisseur conservée uniquement pour prouver que la
-- combobox agrège aussi les intitulés découverts avant ADR-0013.
insert into sessions(
  id,event_id,name,type,starts_at,ends_at,status,published,description,
  origin,provider_key,external_id
) values (
  'lot43-ui-provider-title','evt-001','FP1 fournisseur','other',
  '2026-05-10T09:00:00Z',null,'scheduled',true,null,
  'provider','ui-provider','ui-fp1-title'
);
