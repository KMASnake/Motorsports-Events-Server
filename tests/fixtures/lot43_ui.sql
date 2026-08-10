delete from session_corrections where session_id like 'lot43-ui-%';
delete from sessions where id like 'lot43-ui-%';

insert into sessions(id,event_id,name,type,starts_at,ends_at,status,published,description,origin,provider_key,external_id) values
  ('lot43-ui-manual-early','evt-001','Q1','other','2026-05-10T08:00:00Z','2026-05-10T08:30:00Z','scheduled',true,'Session manuelle matinale.','manual',null,null),
  ('lot43-ui-manual-dst','evt-001','Main Event','other','2026-10-25T00:30:00Z','2026-10-25T02:30:00Z','scheduled',false,'Traverse le changement d’heure.','manual',null,null),
  ('lot43-ui-provider','evt-001','FP1 locale','other','2026-05-10T09:00:00Z',null,'scheduled',true,'Valeur effective locale.','mixed','ui-provider','ui-fp1'),
  ('lot43-ui-provider-protected','evt-001','Warm-up fournisseur','other','2026-05-10T10:00:00Z','2026-05-10T10:20:00Z','scheduled',true,null,'provider','ui-provider','ui-warmup');

insert into session_corrections(id,session_id,provider_key,external_id,field_name,provider_value,override_value,status,created_by,last_provider_seen_at,conflict_detected_at) values
  ('lot43-ui-correction-title','lot43-ui-provider','ui-provider','ui-fp1','title','"FP1 fournisseur"'::jsonb,'"FP1 locale"'::jsonb,'conflict','ui-fixture',now(),now());
