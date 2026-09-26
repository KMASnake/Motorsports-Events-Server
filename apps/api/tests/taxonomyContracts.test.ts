import {describe,expect,it} from 'vitest';
import {championshipBody,disciplineBody,disciplineFamilyBody} from '../src/routes/championships.js';
import {sessionTypeBody} from '../src/routes/sessions.js';
import {canonicalTaxonomyKey,INITIAL_SESSION_TYPE_KEYS} from '../src/lib/taxonomy.js';

describe('F5-1 canonical taxonomy contracts',()=>{
  it('keeps machine keys stable, bounded and extensible',()=>{
    expect(canonicalTaxonomyKey.safeParse('special_stage').success).toBe(true);
    expect(canonicalTaxonomyKey.safeParse('future_session_4').success).toBe(true);
    for(const invalid of ['Special Stage','special-stage','../stage','',`a${'b'.repeat(64)}`])expect(canonicalTaxonomyKey.safeParse(invalid).success).toBe(false);
  });
  it('contains every required initial session classification without closing the contract',()=>{
    expect(INITIAL_SESSION_TYPE_KEYS).toEqual(['practice','practice_1','practice_2','practice_3','qualifying','sprint_qualifying','sprint','warmup','race','test','stage','special_stage','other']);
    expect(sessionTypeBody.safeParse({key:'future_session',label:'Future session',sort_order:90,active:true}).success).toBe(true);
  });
  it('validates discipline data and preserves free historical championship category',()=>{
    expect(disciplineBody.safeParse({key:'karting',label:'Karting',family_key:'circuit_racing',active:true}).success).toBe(true);
    expect(disciplineFamilyBody.safeParse({key:'off_road',label:'Tout-terrain',active:true}).success).toBe(true);
    const championship=championshipBody.parse({name:'Historic Series',slug:'historic-series',category:'Legacy free label',discipline_key:null,season:2026,active:true,sync_enabled:false});
    expect(championship).toMatchObject({category:'Legacy free label',discipline_key:null});
  });
});
