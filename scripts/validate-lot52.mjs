import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import Fastify from 'fastify';
import { registerAdminAuth, signAdminToken } from '../apps/api/dist/lib/adminAuth.js';
import { pool } from '../apps/api/dist/lib/db.js';
import { ProviderAdapterRegistry } from '../apps/api/dist/providers/registry.js';
import { ProviderMasterKeyError, ProviderSecretCipher } from '../apps/api/dist/providers/providerSecrets.js';
import { ProviderConfigurationService } from '../apps/api/dist/providers/providerService.js';
import { providerRoutes } from '../apps/api/dist/routes/providers.js';

const sentinelA = 'SUPER_SECRET_SENTINEL_5_2_A';
const sentinelB = 'SUPER_SECRET_SENTINEL_5_2_B';
const authSecret = 'lot-5-2-integration-auth-secret-at-least-32-characters';
const authorization = `Bearer ${signAdminToken({sub:'lot52-validation',role:'admin',exp:4102444800},authSecret)}`;
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

async function application(cipher) {
  const app = Fastify({logger:false});
  registerAdminAuth(app,authSecret);
  const service = new ProviderConfigurationService(registry,cipher);
  await app.register(providerRoutes,{service});
  return {app,service};
}
const request = (app,method,url,payload) => app.inject({method,url,headers:{authorization},...(payload === undefined ? {} : {payload})});
const cleanProvider = (name) => ({name,adapter_key:'fake-provider',config:{mode:'fixture'},enabled:false,max_concurrency:1,current_year_reserve_percent:30,missing_cycles_threshold:3,log_retention_days:30});
const assertNoSentinel = (value,label) => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  assert(!serialized.includes('SUPER_SECRET_SENTINEL_5_2'),`${label} expose la sentinelle`);
};

let appV1; let appV2; let appWithoutKey; let serviceV2; let serviceWithoutKey;
try {
  ({app:appV1} = await application(new ProviderSecretCipher(keys,1)));
  const createdResponse = await request(appV1,'POST','/api/v1/admin/providers',cleanProvider('Lot 5.2 HTTP fixture'));
  assert.equal(createdResponse.statusCode,201); assertNoSentinel(createdResponse.body,'POST provider');
  const providerId = createdResponse.json().id; assert(providerId);

  const firstResponse = await request(appV1,'PUT',`/api/v1/admin/providers/${providerId}/secrets/api_key`,{value:sentinelA});
  assert.equal(firstResponse.statusCode,200); assert.deepEqual(firstResponse.json(),{name:'api_key',secretConfigured:true}); assertNoSentinel(firstResponse.body,'PUT secret A');
  const stored1 = (await pool.query('select ciphertext,nonce,key_version,algorithm from provider_secrets where provider_instance_id=$1',[providerId])).rows[0];
  assert.equal(stored1.key_version,1); assert.equal(stored1.algorithm,'aes-256-gcm'); assert(stored1.nonce.length > 0); assertNoSentinel(stored1.ciphertext.toString(),'ciphertext A');
  await appV1.close(); appV1 = undefined;

  ({app:appV2,service:serviceV2} = await application(new ProviderSecretCipher(keys,2)));
  assert.equal(await serviceV2.readSecretForAdapter(providerId,'api_key'),sentinelA);
  const secondResponse = await request(appV2,'PUT',`/api/v1/admin/providers/${providerId}/secrets/api_key`,{value:sentinelB});
  assert.equal(secondResponse.statusCode,200); assert.deepEqual(secondResponse.json(),{name:'api_key',secretConfigured:true}); assertNoSentinel(secondResponse.body,'PUT secret B');
  const stored2 = (await pool.query('select ciphertext,nonce,key_version,algorithm from provider_secrets where provider_instance_id=$1',[providerId])).rows[0];
  assert.equal(stored2.key_version,2); assert.equal(stored2.algorithm,'aes-256-gcm'); assert(!stored1.nonce.equals(stored2.nonce)); assert(!stored1.ciphertext.equals(stored2.ciphertext));
  assert.equal(Number((await pool.query('select count(*) from provider_secrets where provider_instance_id=$1 and secret_name=$2',[providerId,'api_key'])).rows[0].count),1);

  const metadataResponse = await request(appV2,'GET',`/api/v1/admin/providers/${providerId}`);
  assert.equal(metadataResponse.statusCode,200); assertNoSentinel(metadataResponse.body,'GET provider');
  assert.deepEqual(metadataResponse.json().secrets.map(({name,configured})=>({name,configured})),[{name:'api_key',configured:true}]);
  await request(appV2,'PUT',`/api/v1/admin/providers/${providerId}/quota-policy`,{short_window_seconds:60,short_limit:10,monthly_limit:1000,limits_source:'configured',reset_timezone:'UTC',reset_at:null});

  const forbiddenStorage = JSON.stringify({
    config:(await pool.query('select config from provider_instances where id=$1',[providerId])).rows,
    quota:(await pool.query('select * from provider_quota_policies where provider_instance_id=$1',[providerId])).rows,
    audit:(await pool.query('select action,old_value,new_value from admin_audit_log where resource_id=$1',[providerId])).rows
  });
  assertNoSentinel(forbiddenStorage,'PostgreSQL non-secret/audit');
  const actions = (await pool.query('select action from admin_audit_log where resource_id=$1 order by id',[providerId])).rows.map(row=>row.action);
  assert(actions.includes('provider.secret_configured')); assert(actions.includes('provider.secret_replaced'));

  const tampered = Buffer.from(stored2.ciphertext); tampered[0] ^= 1;
  await pool.query('update provider_secrets set ciphertext=$1 where provider_instance_id=$2 and secret_name=$3',[tampered,providerId,'api_key']);
  await assert.rejects(()=>serviceV2.readSecretForAdapter(providerId,'api_key'),error=>{
    assert(error instanceof ProviderMasterKeyError); assertNoSentinel(error.message,'erreur tampering');
    assert(!/ciphertext|nonce|aad|key/i.test(error.message)); return true;
  });
  await pool.query('update provider_secrets set ciphertext=$1 where provider_instance_id=$2 and secret_name=$3',[stored2.ciphertext,providerId,'api_key']);
  const deleteResponse = await request(appV2,'DELETE',`/api/v1/admin/providers/${providerId}/secrets/api_key`);
  assert.equal(deleteResponse.statusCode,200); assertNoSentinel(deleteResponse.body,'DELETE secret');
  const removedAudit = (await pool.query("select old_value,new_value from admin_audit_log where resource_id=$1 and action='provider.secret_removed'",[providerId])).rows;
  assert.equal(removedAudit.length,1); assertNoSentinel(removedAudit,'audit suppression');

  ({app:appWithoutKey,service:serviceWithoutKey} = await application(null));
  const noKeyGet = await request(appWithoutKey,'GET',`/api/v1/admin/providers/${providerId}`); assert.equal(noKeyGet.statusCode,200);
  const noKeyCreate = await request(appWithoutKey,'POST','/api/v1/admin/providers',cleanProvider('Lot 5.2 no-key fixture')); assert.equal(noKeyCreate.statusCode,201);
  const noKeyId = noKeyCreate.json().id;
  const noKeyPatch = await request(appWithoutKey,'PATCH',`/api/v1/admin/providers/${noKeyId}`,{name:'Lot 5.2 no-key fixture updated'}); assert.equal(noKeyPatch.statusCode,200);
  const noKeyPut = await request(appWithoutKey,'PUT',`/api/v1/admin/providers/${noKeyId}/secrets/api_key`,{value:sentinelA});
  assert.equal(noKeyPut.statusCode,503); assertNoSentinel(noKeyPut.body,'503 sans master key');
  await assert.rejects(()=>serviceWithoutKey.readSecretForAdapter(providerId,'api_key'),ProviderMasterKeyError);
  assert.equal(Number((await pool.query('select count(*) from provider_secrets where provider_instance_id=$1',[noKeyId])).rows[0].count),0);

  await pool.query('delete from provider_instances where id=any($1::uuid[])',[[providerId,noKeyId]]);
  console.log('Intégration HTTP/service/AES-GCM/PostgreSQL et sentinelle Lot 5.2 : OK');
} finally {
  await appV1?.close(); await appV2?.close(); await appWithoutKey?.close(); await pool.end();
}
