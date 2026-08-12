import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../lib/db.js';
import type { AdminPrincipal } from '../lib/adminAuth.js';
import type { JsonObject } from './contracts.js';
import type { ProviderAdapterRegistry } from './registry.js';
import { assertProviderConfigContainsNoSecrets, ProviderMasterKeyError, ProviderSecretCipher, redactProviderData } from './providerSecrets.js';

export type ProviderMutationContext = { principal: AdminPrincipal; requestId: string };
export type ProviderInput = {
  name: string;
  adapterKey: string;
  config: JsonObject;
  enabled: boolean;
  maxConcurrency: number;
  currentYearReservePercent: number;
  missingCyclesThreshold: number;
  logRetentionDays: number;
};
export type QuotaPolicyInput = {
  shortWindowSeconds: number | null;
  shortLimit: number | null;
  monthlyLimit: number | null;
  limitsSource: 'configured' | 'provider_headers' | 'hybrid';
  resetTimezone: string | null;
  resetAt: string | null;
};

async function transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('begin'); const result = await operation(client); await client.query('commit'); return result; }
  catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

async function audit(client: PoolClient, context: ProviderMutationContext, action: string, providerId: string, oldValue: unknown, newValue: unknown) {
  await client.query(
    `insert into admin_audit_log(actor,action,resource_type,resource_id,request_id,old_value,new_value)
     values($1,$2,'provider',$3,$4,$5::jsonb,$6::jsonb)`,
    [context.principal.sub, action, providerId, context.requestId,
      JSON.stringify(redactProviderData(oldValue)), JSON.stringify(redactProviderData(newValue))]
  );
}

const projection = `p.id,p.adapter_key,p.name,p.enabled,p.state,p.config,p.max_concurrency,
  p.current_year_reserve_percent::float8,p.missing_cycles_threshold,p.log_retention_days,
  p.created_at,p.updated_at,
  coalesce((select jsonb_agg(jsonb_build_object('name',s.secret_name,'configured',true,'updated_at',s.updated_at)
    order by s.secret_name) from provider_secrets s where s.provider_instance_id=p.id),'[]'::jsonb) as secrets`;

export class ProviderConfigurationService {
  constructor(readonly registry: ProviderAdapterRegistry, readonly cipher: ProviderSecretCipher | null) {}

  async list() { return (await pool.query(`select ${projection} from provider_instances p order by lower(p.name),p.id`)).rows; }
  async get(id: string, client: PoolClient | typeof pool = pool) {
    return (await client.query(`select ${projection} from provider_instances p where p.id=$1`, [id])).rows[0] ?? null;
  }

  validate(input: ProviderInput): ProviderInput {
    const adapter = this.registry.get(input.adapterKey);
    if (!adapter) throw Object.assign(new Error('Adaptateur fournisseur inconnu.'), { statusCode: 400 });
    let config: JsonObject;
    try { config = adapter.validateProviderConfig(input.config); }
    catch { throw Object.assign(new Error('Configuration fournisseur invalide.'), { statusCode: 400 }); }
    try { assertProviderConfigContainsNoSecrets(config); }
    catch { throw Object.assign(new Error('La configuration fournisseur ne doit contenir aucun credential.'), { statusCode: 400 }); }
    return { ...input, config };
  }

  async create(input: ProviderInput, context: ProviderMutationContext) {
    const value = this.validate(input); const id = randomUUID();
    return transaction(async (client) => {
      await client.query(`insert into provider_instances(id,adapter_key,name,enabled,state,config,max_concurrency,
        current_year_reserve_percent,missing_cycles_threshold,log_retention_days)
        values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`, [id,value.adapterKey,value.name,value.enabled,
        value.enabled ? 'active' : 'draft',JSON.stringify(value.config),value.maxConcurrency,value.currentYearReservePercent,
        value.missingCyclesThreshold,value.logRetentionDays]);
      const created = await this.get(id, client);
      await audit(client, context, 'provider.created', id, null, created);
      return created;
    });
  }

  async update(id: string, input: ProviderInput, context: ProviderMutationContext) {
    const value = this.validate(input);
    return transaction(async (client) => {
      const before = await this.get(id, client); if (!before) return null;
      await client.query(`update provider_instances set adapter_key=$2,name=$3,enabled=$4,state=$5,config=$6::jsonb,
        max_concurrency=$7,current_year_reserve_percent=$8,missing_cycles_threshold=$9,log_retention_days=$10,updated_at=now()
        where id=$1`, [id,value.adapterKey,value.name,value.enabled,value.enabled ? 'active' : 'paused',JSON.stringify(value.config),
        value.maxConcurrency,value.currentYearReservePercent,value.missingCyclesThreshold,value.logRetentionDays]);
      const after = await this.get(id, client); await audit(client, context, 'provider.configuration_changed', id, before, after); return after;
    });
  }

  async replaceSecret(id: string, name: string, plaintext: string, context: ProviderMutationContext) {
    if (!this.cipher) throw new ProviderMasterKeyError();
    const encrypted = this.cipher.encrypt(plaintext, id, name);
    return transaction(async (client) => {
      if (!(await client.query('select 1 from provider_instances where id=$1 for update', [id])).rowCount) return null;
      const existed = Boolean((await client.query('select 1 from provider_secrets where provider_instance_id=$1 and secret_name=$2', [id,name])).rowCount);
      await client.query(`insert into provider_secrets(id,provider_instance_id,secret_name,ciphertext,nonce,key_version,algorithm)
        values($1,$2,$3,$4,$5,$6,$7) on conflict(provider_instance_id,secret_name) do update set
        ciphertext=excluded.ciphertext,nonce=excluded.nonce,key_version=excluded.key_version,algorithm=excluded.algorithm,updated_at=now()`,
      [randomUUID(),id,name,encrypted.ciphertext,encrypted.nonce,encrypted.keyVersion,encrypted.algorithm]);
      const result = { name, secretConfigured: true };
      await audit(client, context, existed ? 'provider.secret_replaced' : 'provider.secret_configured', id,
        { name, secretConfigured: existed }, result);
      return result;
    });
  }

  async removeSecret(id: string, name: string, context: ProviderMutationContext) {
    return transaction(async (client) => {
      if (!(await client.query('select 1 from provider_instances where id=$1 for update', [id])).rowCount) return null;
      const removed = await client.query('delete from provider_secrets where provider_instance_id=$1 and secret_name=$2', [id,name]);
      await audit(client, context, 'provider.secret_removed', id, { name, secretConfigured: Boolean(removed.rowCount) }, { name, secretConfigured: false });
      return { name, secretConfigured: false };
    });
  }

  async readSecretForAdapter(id: string, name: string): Promise<string | null> {
    if (!this.cipher) throw new ProviderMasterKeyError();
    const row = (await pool.query<{ciphertext: Buffer;nonce: Buffer;key_version:number;algorithm:'aes-256-gcm'}>(
      'select ciphertext,nonce,key_version,algorithm from provider_secrets where provider_instance_id=$1 and secret_name=$2',[id,name])).rows[0];
    return row ? this.cipher.decrypt({ ciphertext: row.ciphertext, nonce: row.nonce, keyVersion: row.key_version, algorithm: row.algorithm }, id, name) : null;
  }

  async quotaPolicy(id: string) { return (await pool.query('select * from provider_quota_policies where provider_instance_id=$1',[id])).rows[0] ?? null; }
  async setQuotaPolicy(id: string, value: QuotaPolicyInput, context: ProviderMutationContext) {
    return transaction(async (client) => {
      if (!(await client.query('select 1 from provider_instances where id=$1 for update',[id])).rowCount) return null;
      const before = (await client.query('select * from provider_quota_policies where provider_instance_id=$1',[id])).rows[0] ?? null;
      const after = (await client.query(`insert into provider_quota_policies(provider_instance_id,short_window_seconds,short_limit,monthly_limit,limits_source,reset_timezone,reset_at)
        values($1,$2,$3,$4,$5,$6,$7) on conflict(provider_instance_id) do update set short_window_seconds=excluded.short_window_seconds,
        short_limit=excluded.short_limit,monthly_limit=excluded.monthly_limit,limits_source=excluded.limits_source,reset_timezone=excluded.reset_timezone,reset_at=excluded.reset_at,updated_at=now() returning *`,
      [id,value.shortWindowSeconds,value.shortLimit,value.monthlyLimit,value.limitsSource,value.resetTimezone,value.resetAt])).rows[0];
      await audit(client, context, 'provider.quota_configuration_changed', id, before, after); return after;
    });
  }
}
