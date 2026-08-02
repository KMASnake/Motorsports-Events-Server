import { describe,expect,it } from 'vitest';
import {
  decideLocalOverride,
  decideProviderSync,
  effectiveValue,
  isProviderEvent,
  providerConflict,
  shouldCreateCorrection
} from '../src/lib/correctionPolicy.js';
describe('provider correction policy',()=>{
  it('never creates corrections for manual events',()=>expect(shouldCreateCorrection({origin:'manual'},'source','local')).toBe(false));
  it('creates field corrections for identified provider events',()=>expect(shouldCreateCorrection({origin:'provider',provider_key:'feed'},'source','local')).toBe(true));
  it('uses the override as effective value',()=>expect(effectiveValue('provider','local')).toBe('local'));
  it('detects provider changes below an override',()=>expect(providerConflict('old','new','local')).toBe(true));
  it('requires an identifiable provider source',()=>expect(isProviderEvent({origin:'mixed'})).toBe(false));
  it('keeps the original provider value across successive local edits',()=>{
    const decision=decideLocalOverride(
      {origin:'provider',provider_key:'feed'},
      'first local value',
      'second local value',
      {provider_value:'provider value',status:'active'}
    );
    expect(decision).toMatchObject({action:'update',providerValue:'provider value',overrideValue:'second local value'});
  });
  it('removes an override when the local value returns to the provider value',()=>{
    expect(decideLocalOverride(
      {origin:'provider',provider_key:'feed'},
      'local value',
      'provider value',
      {provider_value:'provider value',status:'active'}
    )).toEqual({action:'remove'});
  });
  it('never creates an override for a manual event',()=>{
    expect(decideLocalOverride({origin:'manual'},'old','new')).toEqual({action:'none'});
  });
  it('keeps the override and reports a provider conflict',()=>{
    expect(decideProviderSync('new provider value',{
      provider_value:'old provider value',override_value:'local value',status:'active'
    })).toEqual({effectiveValue:'local value',correctionAction:'update',conflict:true});
  });
  it('removes an override made obsolete by the provider',()=>{
    expect(decideProviderSync('local value',{
      provider_value:'old provider value',override_value:'local value',status:'active'
    })).toEqual({effectiveValue:'local value',correctionAction:'remove',conflict:false});
  });
});
