import {beforeEach,describe,expect,it,vi} from 'vitest';

const database=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('../src/lib/db.js',()=>({pool:database}));

import {AcquisitionAdminService} from '../src/providers/acquisitionAdminService.js';

const providerChampionshipId='57000000-0000-4000-8000-000000000001';

describe('AcquisitionAdminService',()=>{
  beforeEach(()=>database.query.mockReset());

  it('reads cadence eligibility from the current quota runtime schema',async()=>{
    const nextEligibleAt=new Date('2026-08-28T10:06:00Z');
    database.query
      .mockResolvedValueOnce({rows:[{
        id:providerChampionshipId,
        sync_state:'active',
        acquisition_current_hot_days:30,
        acquisition_finalization_grace_days:30,
        provider_name:'Controlled provider',
        adapter_key:'fixture',
        championship_name:'Formula 1',
        quota_next_eligible_at:nextEligibleAt,
        bootstrap_state:'complete',
        recent_catchup_state:'complete',
        deep_history_state:'complete',
        deep_history_season:null,
        consecutive_empty_seasons:5
      }]})
      .mockResolvedValueOnce({rows:[{current_hot_count:2,current_future_count:4,last_known_future_at:null,in_finalization_grace_count:1}]})
      .mockResolvedValueOnce({rows:[{active_count:0,finalization_overdue_count:0}]})
      .mockResolvedValueOnce({rows:[]});

    const overview=await new AcquisitionAdminService().overview(providerChampionshipId);

    expect(overview?.provider_championship).toMatchObject({
      id:providerChampionshipId,
      quota_next_eligible_at:nextEligibleAt
    });
    expect(overview?.current).toMatchObject({current_hot_count:2,current_future_count:4});
    const overviewSql=String(database.query.mock.calls[0]?.[0]);
    expect(overviewSql).toContain('left join provider_quota_runtime q');
    expect(overviewSql).not.toContain('provider_quota_state');
    expect(overviewSql).not.toContain('quota_request_count');
  });
});
