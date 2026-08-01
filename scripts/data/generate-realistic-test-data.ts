import pg from 'pg';
import { createHash } from 'node:crypto';
const seed=process.argv.find((x)=>x.startsWith('--seed='))?.split('=')[1]??'lot-4.2';
const id=(kind:string,n:number)=>createHash('sha256').update(`${seed}:${kind}:${n}`).digest('hex').slice(0,16);
const countries=['FR','GB','IT','DE','ES','US','JP','AU'];
async function main(){const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});try{
  for(let i=0;i<12;i++) await pool.query(`insert into championships(id,slug,name,short_name,season,active) values($1,$2,$3,$4,2026,true) on conflict(id) do nothing`,[id('champ',i),`test-championship-${i+1}`,`Championnat test ${i+1}`,`TC${i+1}`]);
  for(let i=0;i<40;i++) await pool.query(`insert into circuits(id,name,city,country_code,timezone) values($1,$2,$3,$4,$5) on conflict(id) do nothing`,[id('circuit',i),`Circuit test ${i+1}`,`Ville ${i+1}`,countries[i%countries.length],i%2?'Europe/Paris':'UTC']);
  for(let i=0;i<96;i++){const start=new Date(Date.UTC(2026,i%12,2+(i*3)%25,8+(i%10),0));await pool.query(`insert into events(id,championship_id,circuit_id,name,slug,starts_at,ends_at,timezone,status,published,origin,description) values($1,$2,$3,$4,$5,$6,$7,'Europe/Paris',$8,$9,'manual',$10) on conflict(id) do nothing`,[id('event',i),id('champ',i%12),id('circuit',i%40),`Événement test ${i+1}`,`event-test-${i+1}-${id('slug',i)}`,start,new Date(start.getTime()+(1+i%5)*3600000),i%13===0?'cancelled':i%17===0?'postponed':start<Date.now()?'completed':'scheduled',i%7!==0,`Données synthétiques déterministes (${seed}).`]);}
  console.log(`Données synthétiques générées avec seed=${seed}: 12 championnats, 40 circuits, 96 événements.`);
}finally{await pool.end()}}
main().catch((error)=>{console.error(error);process.exitCode=1});
