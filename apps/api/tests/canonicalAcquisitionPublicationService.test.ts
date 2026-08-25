import {describe,expect,it} from 'vitest';
import {canonicalNormalizationScope} from '../src/normalization/canonicalAcquisitionPublicationService.js';
describe('canonical normalization scope',()=>{
  it('is stable and separates phase and mapping identity',()=>{const current=canonicalNormalizationScope('owner','current','map-a');expect(current).toBe(canonicalNormalizationScope('owner','current','map-a'));expect(current).not.toBe(canonicalNormalizationScope('owner','historical','map-a'));expect(current).not.toBe(canonicalNormalizationScope('owner','current','map-b'));});
});
