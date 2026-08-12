import { describe,expect,it } from 'vitest';
import { safeDiscoveryBudget } from '../src/providers/discoveryService.js';

describe('Lot 5.3 conservative discovery quota guard',()=>{
  it('blocks unknown quota before any request',()=>expect(safeDiscoveryBudget(null,0,30)).toEqual({allowed:false,reason:'quota_unknown'}));
  it('allows the last safe request before the current-year monthly reserve',()=>expect(safeDiscoveryBudget(100,69,30)).toEqual({allowed:true,remaining:1}));
  it('blocks at the current-year monthly reserve boundary',()=>expect(safeDiscoveryBudget(100,70,30)).toEqual({allowed:false,reason:'current_year_monthly_reserve_protected'}));
});
