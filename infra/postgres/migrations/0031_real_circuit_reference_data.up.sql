do $$ begin
  if not exists(select 1 from schema_migrations where version='0030_lot57pf_normalization_mapping_persistence') then
    raise exception 'Migration 0030_lot57pf_normalization_mapping_persistence must be applied first';
  end if;
end $$;

create table migration_0031_inserted_circuits (
  circuit_id text primary key references circuits(id) on delete restrict
);

with candidates(id,name,city,country_code,timezone) as (values
  ('albert-park','Albert Park Grand Prix Circuit','Melbourne','AU','Australia/Melbourne'),
  ('monza','Autodromo Nazionale Monza','Monza','IT','Europe/Rome'),
  ('hermanos-rodriguez','Autódromo Hermanos Rodríguez','Mexico City','MX','America/Mexico_City'),
  ('interlagos','Autódromo José Carlos Pace','São Paulo','BR','America/Sao_Paulo'),
  ('bahrain-international','Bahrain International Circuit','Sakhir','BH','Asia/Bahrain'),
  ('baku-city','Baku City Circuit','Baku','AZ','Asia/Baku'),
  ('gilles-villeneuve','Circuit Gilles-Villeneuve','Montréal','CA','America/Toronto'),
  ('zandvoort','Circuit Zandvoort','Zandvoort','NL','Europe/Amsterdam'),
  ('barcelona-catalunya','Circuit de Barcelona-Catalunya','Montmeló','ES','Europe/Madrid'),
  ('monaco','Circuit de Monaco','Monte Carlo','MC','Europe/Monaco'),
  ('spa-francorchamps','Circuit de Spa-Francorchamps','Stavelot','BE','Europe/Brussels'),
  ('circuit-of-the-americas','Circuit of the Americas','Austin','US','America/Chicago'),
  ('hungaroring','Hungaroring','Mogyoród','HU','Europe/Budapest'),
  ('jeddah-corniche','Jeddah Corniche Circuit','Jeddah','SA','Asia/Riyadh'),
  ('las-vegas-strip','Las Vegas Strip Circuit','Las Vegas','US','America/Los_Angeles'),
  ('lusail','Lusail International Circuit','Lusail','QA','Asia/Qatar'),
  ('madring','Madring','Madrid','ES','Europe/Madrid'),
  ('marina-bay','Marina Bay Street Circuit','Singapore','SG','Asia/Singapore'),
  ('miami-international-autodrome','Miami International Autodrome','Miami Gardens','US','America/New_York'),
  ('red-bull-ring','Red Bull Ring','Spielberg','AT','Europe/Vienna'),
  ('shanghai-international','Shanghai International Circuit','Shanghai','CN','Asia/Shanghai'),
  ('silverstone','Silverstone Circuit','Silverstone','GB','Europe/London'),
  ('suzuka','Suzuka Circuit','Suzuka','JP','Asia/Tokyo'),
  ('yas-marina','Yas Marina Circuit','Yas Island','AE','Asia/Dubai')
), inserted as (
  insert into circuits(id,name,city,country_code,timezone)
  select * from candidates
  on conflict(id) do nothing
  returning id
)
insert into migration_0031_inserted_circuits(circuit_id)
select id from inserted;

insert into schema_migrations(version)
values('0031_real_circuit_reference_data');
