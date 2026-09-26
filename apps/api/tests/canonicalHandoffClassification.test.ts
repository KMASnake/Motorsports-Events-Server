import {describe,expect,it} from 'vitest';
import {finalCandidateClassification,finalHandoffStatus} from '../src/normalization/canonicalAcquisitionPublicationService.js';

describe('canonical handoff final classification',()=>{
  it('counts normalization review as review',()=>expect(finalCandidateClassification('review')).toBe('review'));
  it('counts publication review as review instead of ready',()=>expect(finalCandidateClassification('create','review_required')).toBe('review'));
  it.each(['created','updated','unchanged'])('counts successful publication %s as ready',outcome=>expect(finalCandidateClassification('create',outcome)).toBe('ready'));
  it('does not claim deferred publication is ready',()=>expect(finalCandidateClassification('create','kill_switch')).toBe('deferred'));
  it('reports review_required when effective publication leaves one review',()=>expect(finalHandoffStatus(6,1,5,0,5)).toBe('review_required'));
});
