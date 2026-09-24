import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { pool, withTransaction } from '../lib/db.js';
import { writeAdminAudit } from '../lib/adminAudit.js';

export type VenueInput = {
  key: string; name: string; kind_key: string; city: string | null; region: string | null;
  country_code: string | null; timezone: string | null; latitude: number | null; longitude: number | null;
};
export type VenueLayoutInput = { key: string; name: string };
export type CircuitVenueLinkInput = { venue_id: string; venue_layout_id: string | null };

export class VenueNotFoundError extends Error {}
export class VenueLayoutNotFoundError extends Error {}
export class CircuitNotFoundError extends Error {}
export class VenueKindNotFoundError extends Error {}
export class VenueLayoutScopeError extends Error {}

const venueColumns = `id,key,name,kind_key,city,region,country_code,timezone,
  latitude::double precision as latitude,longitude::double precision as longitude,created_at,updated_at`;

export class VenueService {
  async listKinds() { return (await pool.query('select * from venue_kinds order by key')).rows; }
  async listVenues() { return (await pool.query(`select ${venueColumns} from venues order by name,key,id`)).rows; }
  async getVenue(id: string) { return (await pool.query(`select ${venueColumns} from venues where id=$1`, [id])).rows[0] ?? null; }

  async createVenue(input: VenueInput, request: FastifyRequest) {
    return withTransaction(async client => {
      if (!(await client.query('select key from venue_kinds where key=$1 for key share', [input.kind_key])).rowCount) {
        throw new VenueKindNotFoundError('Type de lieu inconnu.');
      }
      const id = randomUUID();
      const created = (await client.query(
        `insert into venues(id,key,name,kind_key,city,region,country_code,timezone,latitude,longitude)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning ${venueColumns}`,
        [id,input.key,input.name,input.kind_key,input.city,input.region,input.country_code,input.timezone,input.latitude,input.longitude]
      )).rows[0];
      await writeAdminAudit(client,{request,resourceType:'venue',resourceId:id,oldValue:null,newValue:created});
      return created;
    });
  }

  async updateVenue(id: string, patch: Partial<Omit<VenueInput,'key'>>, validate: (value: unknown) => VenueInput, request: FastifyRequest) {
    return withTransaction(async client => {
      const current = (await client.query(`select ${venueColumns} from venues where id=$1 for update`,[id])).rows[0];
      if (!current) return null;
      const input = validate({
        key:current.key,name:current.name,kind_key:current.kind_key,city:current.city,region:current.region,
        country_code:current.country_code,timezone:current.timezone,latitude:current.latitude,longitude:current.longitude,
        ...patch
      });
      if (!(await client.query('select key from venue_kinds where key=$1 for key share',[input.kind_key])).rowCount) {
        throw new VenueKindNotFoundError('Type de lieu inconnu.');
      }
      const updated = (await client.query(
        `update venues set name=$2,kind_key=$3,city=$4,region=$5,country_code=$6,timezone=$7,
          latitude=$8,longitude=$9,updated_at=now() where id=$1 returning ${venueColumns}`,
        [id,input.name,input.kind_key,input.city,input.region,input.country_code,input.timezone,input.latitude,input.longitude]
      )).rows[0];
      await writeAdminAudit(client,{request,resourceType:'venue',resourceId:id,oldValue:current,newValue:updated});
      return updated;
    });
  }

  async listLayouts(venueId: string) {
    if (!(await pool.query('select id from venues where id=$1',[venueId])).rowCount) throw new VenueNotFoundError('Lieu introuvable.');
    return (await pool.query('select * from venue_layouts where venue_id=$1 order by name,key,id',[venueId])).rows;
  }
  async getLayout(id: string) { return (await pool.query('select * from venue_layouts where id=$1',[id])).rows[0] ?? null; }
  async createLayout(venueId: string,input: VenueLayoutInput,request: FastifyRequest) {
    return withTransaction(async client => {
      if (!(await client.query('select id from venues where id=$1 for key share',[venueId])).rowCount) throw new VenueNotFoundError('Lieu introuvable.');
      const id=randomUUID();
      const created=(await client.query(
        'insert into venue_layouts(id,venue_id,key,name) values($1,$2,$3,$4) returning *',[id,venueId,input.key,input.name]
      )).rows[0];
      await writeAdminAudit(client,{request,resourceType:'venue-layout',resourceId:id,oldValue:null,newValue:created});
      return created;
    });
  }
  async updateLayout(id:string,patch:Partial<Omit<VenueLayoutInput,'key'>>,validate:(value:unknown)=>VenueLayoutInput,request:FastifyRequest) {
    return withTransaction(async client => {
      const current=(await client.query('select * from venue_layouts where id=$1 for update',[id])).rows[0];
      if(!current) return null;
      const input=validate({key:current.key,name:current.name,...patch});
      const updated=(await client.query('update venue_layouts set name=$2,updated_at=now() where id=$1 returning *',[id,input.name])).rows[0];
      await writeAdminAudit(client,{request,resourceType:'venue-layout',resourceId:id,oldValue:current,newValue:updated});
      return updated;
    });
  }

  async listCircuitLinks() {
    return (await pool.query('select * from circuit_venue_links order by circuit_id')).rows;
  }
  async upsertCircuitLink(circuitId:string,input:CircuitVenueLinkInput,request:FastifyRequest) {
    return withTransaction(async client => {
      if (!(await client.query('select id from circuits where id=$1 for key share',[circuitId])).rowCount) throw new CircuitNotFoundError('Circuit introuvable.');
      if (!(await client.query('select id from venues where id=$1 for key share',[input.venue_id])).rowCount) throw new VenueNotFoundError('Lieu introuvable.');
      if (input.venue_layout_id !== null) {
        const layout=await client.query('select id from venue_layouts where id=$1 and venue_id=$2 for key share',[input.venue_layout_id,input.venue_id]);
        if (!layout.rowCount) {
          if ((await client.query('select id from venue_layouts where id=$1',[input.venue_layout_id])).rowCount) throw new VenueLayoutScopeError('La configuration n’appartient pas à ce lieu.');
          throw new VenueLayoutNotFoundError('Configuration de lieu introuvable.');
        }
      }
      const previous=(await client.query('select * from circuit_venue_links where circuit_id=$1 for update',[circuitId])).rows[0] ?? null;
      const updated=(await client.query(
        `insert into circuit_venue_links(circuit_id,venue_id,venue_layout_id) values($1,$2,$3)
         on conflict(circuit_id) do update set venue_id=excluded.venue_id,venue_layout_id=excluded.venue_layout_id,updated_at=now()
         returning *`,[circuitId,input.venue_id,input.venue_layout_id]
      )).rows[0];
      await writeAdminAudit(client,{request,resourceType:'circuit-venue-link',resourceId:circuitId,oldValue:previous,newValue:updated});
      return updated;
    });
  }
}
