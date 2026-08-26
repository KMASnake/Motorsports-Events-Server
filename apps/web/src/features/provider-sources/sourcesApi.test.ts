import {beforeEach,describe,expect,it,vi} from 'vitest';
import {listProviders,preflight,replaceCredential} from './sourcesApi';
const response=(body:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}}));
describe('Sources admin API',()=>{beforeEach(()=>{vi.stubGlobal('fetch',vi.fn(()=>response([])));vi.stubGlobal('document',{cookie:'mse_admin_csrf=test-csrf'});vi.stubGlobal('window',{dispatchEvent:vi.fn()});});
  it('lists safe provider DTOs through the canonical admin route',async()=>{vi.mocked(fetch).mockImplementationOnce(()=>response([{name:'legacy-unresolved',secrets:[]} ]));expect((await listProviders())[0]?.name).toBe('legacy-unresolved');});
  it('replaces a credential without expecting its plaintext back',async()=>{vi.mocked(fetch).mockImplementationOnce(()=>response({name:'api_key',secretConfigured:true}));const result=await replaceCredential('provider','SYNTHETIC_NOT_REAL');expect(result).toEqual({name:'api_key',secretConfigured:true});expect(JSON.stringify(result)).not.toContain('SYNTHETIC_NOT_REAL');});
  it('calls only the zero-credit preflight endpoint',async()=>{vi.mocked(fetch).mockImplementationOnce(()=>response({status:'preflight_ok',PROVIDER_CALLS:0}));expect(await preflight('link')).toMatchObject({PROVIDER_CALLS:0});expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/preflight$/),expect.objectContaining({method:'POST'}));});
});
