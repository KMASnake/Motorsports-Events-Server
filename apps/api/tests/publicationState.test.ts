import {describe,expect,it} from 'vitest';
import {canonicalPublicState,changedPublicFields,granularQuality,publicationQuality,publicStateChecksum} from '../src/normalization/publicationState.js';

describe('Lot 5.7-P-C publication state',()=>{
  const ready={resourceKind:'event',name:'Race',championshipId:'f1',circuitId:'silverstone',startsAt:'1965-01-01T00:00:00.000Z',status:'scheduled',provenance:{secret:true}};
  it('C01 allows only reliable first publication',()=>{expect(publicationQuality(ready,'create')).toBe('ready');expect(publicationQuality(ready,'review')).toBe('review_required');});
  it('requires complete identity only for create while preserving linked partial updates',()=>{expect(publicationQuality({...ready,startsAt:null,status:null},'create')).toBe('review_required');expect(publicationQuality({...ready,startsAt:null,status:null},'linked')).toBe('ready');});
  it('C05 canonicalizes property order',()=>{expect(publicStateChecksum({name:'Race',championshipId:'f1'})).toBe(publicStateChecksum({championshipId:'f1',name:'Race'}));});
  it('C06 excludes internal-only provenance',()=>{expect(canonicalPublicState(ready)).not.toHaveProperty('provenance');});
  it('C07 reports changed public fields',()=>{expect(changedPublicFields({status:'scheduled'},{status:'cancelled'})).toEqual(['status']);});
  it('C12 keeps bad next candidates in review',()=>{expect(publicationQuality({...ready,circuitId:null},'linked')).toBe('review_required');});
  it('C14 blocks at Event granularity',()=>{expect(granularQuality({event:'review_required'})).toEqual({event:'review_required',meeting:'degraded',championship:'degraded'});});
  it('C15 permits critical Event to block Meeting only',()=>{expect(granularQuality({event:'blocked',criticalEvent:true})).toEqual({event:'blocked',meeting:'blocked',championship:'degraded'});});
  it('C30 preserves pre-1970 public values',()=>{expect(canonicalPublicState(ready).startsAt).toBe('1965-01-01T00:00:00.000Z');});
  it('C31 ignores internal property order and metadata',()=>{expect(publicStateChecksum(ready)).toBe(publicStateChecksum({...ready,provenance:{other:true}}));});
});
