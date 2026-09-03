\set ON_ERROR_STOP on

-- Audit en lecture seule. Ce fichier ne contient volontairement aucun DELETE.
begin transaction read only;

with known_demo(id,expected_name,reason) as (values
  ('evt-001','Grand Prix de France','fixture explicite du bootstrap historique'),
  ('evt-002','Grand Prix de Grande-Bretagne','fixture explicite du bootstrap historique')
), dependency_counts as (
  select e.id,
    (select count(*) from sessions s where s.event_id=e.id) sessions,
    (select count(*) from meeting_events me where me.event_id=e.id) meeting_events,
    (select count(*) from event_corrections c where c.event_id=e.id) event_corrections,
    (select count(*) from archived_event_corrections c where c.event_id=e.id) archived_event_corrections,
    (select count(*) from event_source_links l where l.event_id=e.id) source_links,
    (select count(*) from event_source_links l join public_resource_states p on p.resource_type='event' and p.resource_id=l.normalized_event_uuid where l.event_id=e.id) public_states,
    (select count(*) from event_source_links l join public_resource_versions p on p.resource_type='event' and p.resource_id=l.normalized_event_uuid where l.event_id=e.id) public_versions
  from events e join known_demo d on d.id=e.id
)
select 'FAKE' classification,'events' table_name,e.id primary_key,e.origin,e.name,
  d.reason,
  jsonb_build_object('sessions',x.sessions,'meeting_events',x.meeting_events,
    'event_corrections',x.event_corrections,'archived_event_corrections',x.archived_event_corrections,
    'source_links',x.source_links,'public_states',x.public_states,'public_versions',x.public_versions) dependencies,
  case when e.name=d.expected_name and x.source_links=0 then 'REVIEW_FOR_MANUAL_DELETION'
       else 'UNCERTAIN_DO_NOT_DELETE' end proposed_action
from known_demo d join events e on e.id=d.id join dependency_counts x on x.id=e.id
order by e.id;

select 'REAL' classification,'championships' table_name,id primary_key,name,
  'référentiel métier canonique' reason,'KEEP' proposed_action
from championships where id in('f1','motogp','wrc') order by id;

select 'REAL' classification,'circuits' table_name,id primary_key,name,
  'référentiel métier canonique' reason,'KEEP' proposed_action
from circuits order by id;

select 'REAL' classification,'provider_source_entities' table_name,count(*) object_count,
  'observations fournisseur acquises au runtime, jamais assimilées aux fixtures' reason,
  'KEEP' proposed_action from provider_source_entities;

select 'REAL' classification,'normalized_candidates' table_name,count(*) object_count,
  'candidats issus des observations fournisseur, y compris review_required' reason,
  'KEEP' proposed_action from normalized_candidates;

select 'TECHNICAL' classification,'provider_instances/scheduler/mappings' scope,
  'configuration nécessaire au runtime; audit séparé avant toute mutation' reason,
  'KEEP' proposed_action;

rollback;
