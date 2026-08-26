import {describe,expect,it} from 'vitest';
import {schedulerWaitReason,schedulerWorkClass} from './SchedulerPage';
import type {QuotaDiagnostics,SyncStream} from '../provider-sources/sourcesApi';

const stream=(value:Partial<SyncStream>={}):SyncStream=>({id:'s',phase:'historical',state:'ready',cursor:{work_class:'recent_catchup'},historical_state:null,last_progress_at:null,next_eligible_at:null,priority_boost_until:null,lease_owner:null,lease_expires_at:null,stream_backoff_until:null,stream_failure_count:0,last_error_code:null,season:2026,...value});
const diagnostic=(reason:string|null):QuotaDiagnostics=>({policy:null,runtime:null,windows:[],observations:[],summary:{limit:100,operational_ceiling:95,current_reserve:19,normal_budget:76,usage:10,remaining_estimated:85,distance_before_reserve:66,source:'local_counter',state:'normal',next_eligible_at:null,blocking_reason:reason}});

describe('Scheduler supervision',()=>{
  it('présente les classes canoniques sans fréquence arbitraire',()=>{expect(schedulerWorkClass(stream())).toBe('recent_catchup');expect(schedulerWorkClass(stream({phase:'current'}))).toBe('current')});
  it('explique quota, cadence et backoff',()=>{expect(schedulerWaitReason(stream(),diagnostic('dynamic_pacing'))).toBe('dynamic_pacing');expect(schedulerWaitReason(stream({stream_backoff_until:'2026-08-27T00:00:00Z'}),diagnostic(null))).toBe('Backoff du flux');expect(schedulerWaitReason(stream({next_eligible_at:'2026-08-27T00:00:00Z'}),null)).toBe('Cadence calculée')});
});
