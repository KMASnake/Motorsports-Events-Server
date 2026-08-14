delete from schema_migrations where version='0013_provider_quota_cadence';
alter table sync_streams drop column if exists stream_failure_count, drop column if exists stream_backoff_until;
drop table if exists provider_request_charges;
drop table if exists provider_quota_observations;
drop table if exists provider_quota_runtime;
drop table if exists provider_quota_windows;
alter table provider_quota_policies
  drop constraint if exists provider_quota_reserve_value_check,
  drop column if exists provider_timezone,
  drop column if exists current_reserve_value,
  drop column if exists current_reserve_mode,
  drop column if exists safety_margin_percent,
  drop column if exists minimum_interval_seconds,
  drop column if exists daily_limit,
  drop column if exists hourly_limit,
  drop column if exists minute_limit;
alter table provider_instances
  drop constraint if exists provider_instances_current_year_reserve_percent_check,
  alter column current_year_reserve_percent set default 30,
  add constraint provider_instances_current_year_reserve_percent_check check(current_year_reserve_percent between 0 and 100);
