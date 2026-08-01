import { describe,expect,it } from 'vitest';
import { effectiveValue,isProviderEvent,providerConflict,shouldCreateCorrection } from '../src/lib/correctionPolicy.js';
describe('provider correction policy',()=>{
  it('never creates corrections for manual events',()=>expect(shouldCreateCorrection({origin:'manual'},'source','local')).toBe(false));
  it('creates field corrections for identified provider events',()=>expect(shouldCreateCorrection({origin:'provider',provider_key:'feed'},'source','local')).toBe(true));
  it('uses the override as effective value',()=>expect(effectiveValue('provider','local')).toBe('local'));
  it('detects provider changes below an override',()=>expect(providerConflict('old','new','local')).toBe(true));
  it('requires an identifiable provider source',()=>expect(isProviderEvent({origin:'mixed'})).toBe(false));
});
