import {describe,expect,it} from 'vitest';
import {mappingConfigFromVersion,NormalizationMappingRepositoryError,parseNormalizationMappingDocument} from '../src/normalization/postgresNormalizationMappingRepository.js';

const document={championshipIds:{series:'champ'},circuitIds:{track:'circuit'},sessionTypes:{Race:'race' as const},statuses:{Done:'completed' as const}};
describe('normalization mapping reconstruction',()=>{
  it('reconstructs all dictionaries without defaults and uses UUID identity',()=>{const config=mappingConfigFromVersion({id:'57000000-0000-4000-8000-000000003001',providerChampionshipId:'owner',versionLabel:'local-v1',rulesVersion:'rules-v7',mappingDocument:document,createdAt:new Date(0).toISOString(),createdBy:'test'});expect(config).toEqual({version:'mapping:57000000-0000-4000-8000-000000003001',rulesVersion:'rules-v7',...document});expect(JSON.stringify(config)).not.toMatch(/ocblacktop|formula1|silverstone/i);});
  it.each([[{...document,circuitIds:[]}],[{...document,extra:{}}],[{...document,statuses:{Done:'unknown'}}],[{...document,circuitIds:JSON.parse('{"__proto__":"circuit"}')}]])('fails closed for malformed persisted state',value=>{expect(()=>parseNormalizationMappingDocument(value)).toThrow(NormalizationMappingRepositoryError);});
});
