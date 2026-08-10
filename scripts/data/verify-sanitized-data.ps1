param([string]$Database="motorsports_events",[string]$ComposeProject="mse-snapshot-sanitize")
$ErrorActionPreference="Stop"
if($env:NODE_ENV -eq "production"){throw "Vérification refusée en production."}
$sql=@'
do $$ declare r record; bad bigint; begin
  for r in select table_name,column_name from information_schema.columns
    where table_schema='public' and data_type in ('text','character varying') loop
    execute format('select count(*) from %I where %I ~* %L',r.table_name,r.column_name,
      '(gho_|sk_live_|-----BEGIN|@(?!(example\.test|localhost))|https?://[^ ]*motorsports-events\.fr)') into bad;
    if bad > 0 then raise exception 'Valeur sensible possible dans %.%',r.table_name,r.column_name; end if;
  end loop;
end $$;
'@
$sql | docker compose -p $ComposeProject exec -T postgres psql -U mse -d $Database -v ON_ERROR_STOP=1
if($LASTEXITCODE -ne 0){throw "Données non conformes."}
Write-Host "Vérification d'anonymisation : OK"
