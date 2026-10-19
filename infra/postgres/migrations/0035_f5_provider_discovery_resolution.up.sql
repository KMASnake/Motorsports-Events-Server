do $$ begin
  if not exists(select 1 from schema_migrations where version='0034_f5_canonical_venues') then
    raise exception 'Migration 0034_f5_canonical_venues must be applied first';
  end if;
end $$;

alter table provider_discovery_runs
  add constraint provider_discovery_runs_id_provider_unique unique(id,provider_instance_id);

create table provider_discovery_observations (
  id uuid primary key,
  provider_instance_id uuid not null references provider_instances(id) on delete restrict,
  provider_discovery_run_id uuid not null,
  provenance text not null check(provenance in ('provider_discovered','adapter_known_catalog','test_fixture')),
  external_championship_id text not null check(btrim(external_championship_id)<>'' and length(external_championship_id)<=256),
  external_season_id text check(external_season_id is null or (btrim(external_season_id)<>'' and length(external_season_id)<=256)),
  raw_championship_name text not null check(btrim(raw_championship_name)<>'' and length(raw_championship_name)<=500),
  raw_season_label text check(raw_season_label is null or length(raw_season_label)<=500),
  raw_start_year integer check(raw_start_year is null or raw_start_year between 1800 and 2400),
  raw_end_year integer check(raw_end_year is null or raw_end_year between 1800 and 2400),
  raw_start_date date,
  raw_end_date date,
  raw_discipline text check(raw_discipline is null or length(raw_discipline)<=128),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=65536),
  payload_checksum text not null check(payload_checksum ~ '^[0-9a-f]{64}$'),
  observation_fingerprint text not null check(observation_fingerprint ~ '^[0-9a-f]{64}$'),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint provider_discovery_observations_years_check check(raw_end_year is null or raw_start_year is null or raw_end_year>=raw_start_year),
  constraint provider_discovery_observations_dates_check check(raw_end_date is null or raw_start_date is null or raw_end_date>=raw_start_date),
  constraint provider_discovery_observations_run_scope_fk
    foreign key(provider_discovery_run_id,provider_instance_id)
    references provider_discovery_runs(id,provider_instance_id) on delete restrict,
  constraint provider_discovery_observations_run_fingerprint_unique
    unique(provider_discovery_run_id,observation_fingerprint),
  constraint provider_discovery_observations_id_provider_unique unique(id,provider_instance_id)
);
create index provider_discovery_observations_source_idx
  on provider_discovery_observations(provider_instance_id,external_championship_id,external_season_id,observed_at desc);
create index provider_discovery_observations_checksum_idx on provider_discovery_observations(payload_checksum);

create table championship_source_links (
  id uuid primary key,
  provider_instance_id uuid not null references provider_instances(id) on delete restrict,
  external_championship_id text not null check(btrim(external_championship_id)<>'' and length(external_championship_id)<=256),
  championship_id text not null references championships(id) on delete restrict,
  created_by text not null check(btrim(created_by)<>'' and length(created_by)<=256),
  created_at timestamptz not null default now(),
  constraint championship_source_links_source_unique unique(provider_instance_id,external_championship_id),
  constraint championship_source_links_scope_unique unique(id,provider_instance_id,external_championship_id,championship_id)
);
create index championship_source_links_target_idx on championship_source_links(championship_id);

create table championship_season_source_links (
  id uuid primary key,
  championship_source_link_id uuid not null,
  provider_instance_id uuid not null,
  external_championship_id text not null,
  external_season_id text not null check(btrim(external_season_id)<>'' and length(external_season_id)<=256),
  championship_id text not null,
  championship_season_id uuid not null,
  created_by text not null check(btrim(created_by)<>'' and length(created_by)<=256),
  created_at timestamptz not null default now(),
  constraint championship_season_source_links_championship_scope_fk
    foreign key(championship_source_link_id,provider_instance_id,external_championship_id,championship_id)
    references championship_source_links(id,provider_instance_id,external_championship_id,championship_id) on delete restrict,
  constraint championship_season_source_links_season_scope_fk
    foreign key(championship_season_id,championship_id)
    references championship_seasons(id,championship_id) on delete restrict,
  constraint championship_season_source_links_source_unique
    unique(provider_instance_id,external_championship_id,external_season_id)
);
create index championship_season_source_links_target_idx on championship_season_source_links(championship_season_id);

create table championship_discovery_candidates (
  id uuid primary key,
  provider_instance_id uuid not null references provider_instances(id) on delete restrict,
  source_identity_hash text not null check(source_identity_hash ~ '^[0-9a-f]{64}$'),
  normalizer_version text not null check(btrim(normalizer_version)<>'' and length(normalizer_version)<=128),
  latest_observation_id uuid not null,
  latest_observation_fingerprint text not null check(latest_observation_fingerprint ~ '^[0-9a-f]{64}$'),
  revision bigint not null default 1 check(revision>0),
  normalized_championship_name text not null check(btrim(normalized_championship_name)<>'' and length(normalized_championship_name)<=500),
  normalized_discipline text references disciplines(key) on delete restrict,
  normalized_season jsonb not null default '{}'::jsonb check(jsonb_typeof(normalized_season)='object' and octet_length(normalized_season::text)<=8192),
  proposed_championship_id text references championships(id) on delete restrict,
  proposed_championship_season_id uuid,
  match_reason text not null check(btrim(match_reason)<>'' and length(match_reason)<=256),
  match_signals jsonb not null default '[]'::jsonb check(jsonb_typeof(match_signals)='array' and octet_length(match_signals::text)<=8192),
  confidence numeric(5,4) check(confidence is null or confidence between 0 and 1),
  resolution_state text not null check(resolution_state in ('PENDING','REVIEW_REQUIRED','RESOLVED_LINKED','RESOLVED_CREATED','REJECTED')),
  review_reason text check(review_reason is null or length(review_reason)<=2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint championship_discovery_candidates_observation_scope_fk
    foreign key(latest_observation_id,provider_instance_id)
    references provider_discovery_observations(id,provider_instance_id) on delete restrict,
  constraint championship_discovery_candidates_proposed_season_scope_fk
    foreign key(proposed_championship_season_id,proposed_championship_id)
    references championship_seasons(id,championship_id) on delete restrict,
  constraint championship_discovery_candidates_source_unique
    unique(provider_instance_id,source_identity_hash,normalizer_version),
  constraint championship_discovery_candidates_id_revision_unique unique(id,revision)
);
create index championship_discovery_candidates_review_idx
  on championship_discovery_candidates(resolution_state,updated_at,id);
create index championship_discovery_candidates_observation_idx
  on championship_discovery_candidates(latest_observation_id);

create table championship_discovery_decisions (
  id uuid primary key,
  candidate_id uuid not null references championship_discovery_candidates(id) on delete restrict,
  candidate_revision bigint not null check(candidate_revision>0),
  observation_id uuid not null references provider_discovery_observations(id) on delete restrict,
  decision text not null check(decision in ('link','create','reject')),
  actor_id text not null check(btrim(actor_id)<>'' and length(actor_id)<=256),
  reason text check(reason is null or (btrim(reason)<>'' and length(reason)<=2000)),
  chosen_championship_id text references championships(id) on delete restrict,
  chosen_championship_season_id uuid,
  idempotency_key text not null check(btrim(idempotency_key)<>'' and length(idempotency_key)<=200),
  decision_fingerprint text not null check(decision_fingerprint ~ '^[0-9a-f]{64}$'),
  decided_at timestamptz not null default now(),
  constraint championship_discovery_decisions_season_scope_fk
    foreign key(chosen_championship_season_id,chosen_championship_id)
    references championship_seasons(id,championship_id) on delete restrict,
  constraint championship_discovery_decisions_target_check check(
    (decision='reject' and chosen_championship_id is null and chosen_championship_season_id is null)
    or (decision in ('link','create') and chosen_championship_id is not null)
  ),
  constraint championship_discovery_decisions_idempotency_unique unique(candidate_id,idempotency_key)
);
create index championship_discovery_decisions_candidate_idx
  on championship_discovery_decisions(candidate_id,decided_at,id);

create function f5_discovery_reject_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'F5 discovery evidence is append-only';
end $$;
create trigger provider_discovery_observations_immutable
before update or delete on provider_discovery_observations
for each row execute function f5_discovery_reject_mutation();
create trigger championship_discovery_decisions_immutable
before update or delete on championship_discovery_decisions
for each row execute function f5_discovery_reject_mutation();
create trigger championship_source_links_immutable
before update or delete on championship_source_links
for each row execute function f5_discovery_reject_mutation();
create trigger championship_season_source_links_immutable
before update or delete on championship_season_source_links
for each row execute function f5_discovery_reject_mutation();

insert into schema_migrations(version) values('0035_f5_provider_discovery_resolution');
