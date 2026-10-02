import {describe,expect,it} from 'vitest';
import {assertBoundedProtectionJson,validateObservationKey,validateSourceFieldPath} from '../src/providers/sourceProtectionService.js';

describe('protection source 5.6-F',()=>{
  it('accepte des chemins et clés bornés',()=>{expect(validateSourceFieldPath('schedule.starts_at')).toBe('schedule.starts_at');expect(validateObservationKey('review:timing-1')).toBe('review:timing-1');});
  it('refuse les chemins dynamiques dangereux',()=>{for(const value of ['','a[0]','../status','status;drop'])expect(()=>validateSourceFieldPath(value)).toThrow('field_path_invalid');});
  it('refuse les clés d’observation dangereuses',()=>{for(const value of ['','../note','note/child'])expect(()=>validateObservationKey(value)).toThrow('observation_key_invalid');});
  it('borne les payloads JSON protégés',()=>{expect(assertBoundedProtectionJson({note:'ok'})).toEqual({note:'ok'});expect(()=>assertBoundedProtectionJson({note:'x'.repeat(70000)})).toThrow('protection_payload_too_large');});
});
