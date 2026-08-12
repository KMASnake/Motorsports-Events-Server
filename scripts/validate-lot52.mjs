import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { pool } from '../apps/api/dist/lib/db.js';
import { ProviderAdapterRegistry } from '../apps/api/dist/providers/registry.js';
import { ProviderSecretCipher } from '../apps/api/dist/providers/providerSecrets.js';
import { ProviderConfigurationService } from '../apps/api/dist/providers/providerService.js';

const sentinel = 'SUPER_SECRET_SENTINEL_5_2';
const keys = new Map([[1,Buffer.alloc(32,1)],[2,Buffer.alloc(32,2)]]);
const registry = new ProviderAdapterRegistry();
registry.register({
  key:'fake-provider', capabilities:{supportsChampionshipDiscovery:false,supportsSeasonDiscovery:false,supportsQuotaHeaders:false,supportsConnectionTest:false},
  providerConfigVersion:1,sourceConfigVersion:1,cursorVersion:1,providerForm:()=>[],championshipForm:()=>[],
  validateProviderConfig(value){ if (!value || typeof value !== 'object' || Array.isArray(value) || value.mode !== 'fixture') throw new Error('invalid'); return value; },
  validateSourceConfig(value){ return value; },initialCursor:()=>({page:1}),validateCursor:value=>value,serializeCursor:value=>value,restoreCursor:value=>value,
  fetchWorkUnit:async()=>({status:'end_of_cycle',items:[],nextCursor:{page:1},requestCount:0}),normalize:()=>({accepted:[],rejected:[]}),
  confirmEmptySeason:async()=>({confirmedEmpty:true,reason:'fixture'})
});
const context = { principal:{sub:'lot52-validation',role:'admin',exp:4102444800,auth_method:'technical_hmac'}, requestId:'lot52-validation' };
const base = {name:'Lot 5.2 fixture',adapterKey:'fake-provider',config:{mode:'fixture'},enabled:false,maxConcurrency:1,currentYearReservePercent:30,missingCyclesThreshold:3,logRetentionDays:30};

try {
  const v1 = new ProviderConfigurationService(registry,new ProviderSecretCipher(keys,1));
  const provider = await v1.create(base,context); assert(provider?.id);
  assert.deepEqual(await v1.replaceSecret(provider.id,'api_key',sentinel,context),{name:'api_key',secretConfigured:true});
  const stored1 = (await pool.query('select ciphertext,nonce,key_version from provider_secrets where provider_instance_id=$1',[provider.id])).rows[0];
  assert.equal(stored1.key_version,1); assert(!stored1.ciphertext.toString().includes(sentinel)); assert.equal(await v1.readSecretForAdapter(provider.id,'api_key'),sentinel);
  const v2 = new ProviderConfigurationService(registry,new ProviderSecretCipher(keys,2)); assert.equal(await v2.readSecretForAdapter(provider.id,'api_key'),sentinel);
  await v2.replaceSecret(provider.id,'api_key',sentinel,context);
  const stored2 = (await pool.query('select ciphertext,nonce,key_version from provider_secrets where provider_instance_id=$1',[provider.id])).rows[0];
  assert.equal(stored2.key_version,2); assert(!stored1.nonce.equals(stored2.nonce)); assert(!stored1.ciphertext.equals(stored2.ciphertext));
  await v2.setQuotaPolicy(provider.id,{shortWindowSeconds:60,shortLimit:10,monthlyLimit:1000,limitsSource:'configured',resetTimezone:'UTC',resetAt:null},context);
  assert.equal((await v2.quotaPolicy(provider.id)).monthly_limit,1000);
  assert(!JSON.stringify((await pool.query('select old_value,new_value from admin_audit_log where resource_id=$1',[provider.id])).rows).includes(sentinel));
  assert(!JSON.stringify(await v2.get(provider.id)).includes(sentinel));
  await v2.removeSecret(provider.id,'api_key',context); assert.equal(await v2.readSecretForAdapter(provider.id,'api_key'),null);
  await pool.query('delete from provider_instances where id=$1',[provider.id]);
  console.log('Chiffrement, rotation, configuration, audit et redaction Lot 5.2 : OK');
} finally { await pool.end(); }
