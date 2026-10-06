import {describe,expect,it} from 'vitest';
import {handoffKey,preserveHandoffEnvelope,readHandoffEnvelope} from '../src/providers/canonicalHandoffState.js';
import type {JsonObject} from '../src/providers/contracts.js';
describe('handoff JSONB namespace safety',()=>{
  it('fails closed on malformed or unsupported persisted orchestration',()=>{
    for(const value of [null,[],{version:2,traversals:{}},{version:1,traversals:{bad:{state:'DONE'}}}])expect(()=>readHandoffEnvelope({[handoffKey]:value})).toThrow('handoff_envelope_invalid');
  });
  it('preserves the authoritative envelope and rejects replacement namespace injection',()=>{
    const current:JsonObject={[handoffKey]:{version:1,traversals:{'00000000-0000-4000-8000-000000000001':{state:'HANDOFF_PENDING',attempts:0,updated_at:'2026-10-05T00:00:00Z',error_code:null}}},old:true};
    expect(preserveHandoffEnvelope(current,{new:true,[handoffKey]:{version:2}})).toEqual({new:true,[handoffKey]:current[handoffKey]});
    expect(preserveHandoffEnvelope({},{[handoffKey]:{version:1,traversals:{}}})).toEqual({});
  });
});
