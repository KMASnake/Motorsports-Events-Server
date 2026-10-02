import { describe,expect,it } from 'vitest';
import { reconcile,type Contribution,type Policy } from '../src/reconciliation/deterministicReconciliation.js';
import {legacyEventFieldToReconciliationField,legacyReconcilableEventFieldEntries} from '../src/reconciliation/legacyEventFieldMapping.js';
import {normalizeFieldValue,reconciliationFieldContract,validatePolicyField} from '../src/reconciliation/reconciliationFieldContract.js';

const policy:Policy={id:'p',version:1,resourceKind:'event',rules:[
  {field:'startsAt',class:'SCHEDULE',providerPriority:[['a','b']],scheduleToleranceSeconds:60},
  {field:'name',class:'DISPLAY',providerPriority:[['a'],['b']]},
  {field:'status',class:'STATUS',providerPriority:[['a','b']],compatibleStatusTransitions:{scheduled:['cancelled'],cancelled:[]}}
]};
const contribution=(id:string,providerKey:string,values:Record<string,unknown>):Contribution=>({id,providerKey,values,structuralReferences:{meeting_id:'m'},eligible:true,withdrawn:false});

describe('deterministic reconciliation',()=>{
  it('defines one complete strict Meeting/Event field contract',()=>{
    expect(Object.keys(reconciliationFieldContract.meeting)).toEqual(['name','round','startsAt','endsAt','venueId','venueLayoutId']);
    expect(Object.keys(reconciliationFieldContract.event)).toEqual(['name','sessionLabel','sessionType','startsAt','endsAt','status','venueId','venueLayoutId']);
    const valid:{kind:'meeting'|'event';field:string;value:unknown;normalized?:unknown}[]=[
      {kind:'meeting',field:'name',value:'Grand Prix'},{kind:'meeting',field:'round',value:'3'},{kind:'meeting',field:'startsAt',value:'2026-01-01T10:00:00Z',normalized:'2026-01-01T10:00:00.000Z'},{kind:'meeting',field:'endsAt',value:null},{kind:'meeting',field:'venueId',value:null},{kind:'meeting',field:'venueLayoutId',value:null},
      {kind:'event',field:'name',value:'Race'},{kind:'event',field:'sessionLabel',value:null},{kind:'event',field:'sessionType',value:'race'},{kind:'event',field:'startsAt',value:'2026-01-01T10:00:00Z',normalized:'2026-01-01T10:00:00.000Z'},{kind:'event',field:'endsAt',value:null},{kind:'event',field:'status',value:'scheduled'},{kind:'event',field:'venueId',value:null},{kind:'event',field:'venueLayoutId',value:null}
    ];
    for(const item of valid)expect(normalizeFieldValue(item.kind,item.field,item.value)).toEqual(item.normalized??item.value);
    const invalid:{kind:'meeting'|'event';field:string;value:unknown}[]=[
      {kind:'meeting',field:'name',value:null},{kind:'meeting',field:'round',value:3},{kind:'meeting',field:'startsAt',value:'invalid'},{kind:'meeting',field:'endsAt',value:false},{kind:'meeting',field:'venueId',value:'invalid'},{kind:'meeting',field:'venueLayoutId',value:42},
      {kind:'event',field:'name',value:42},{kind:'event',field:'sessionLabel',value:{}},{kind:'event',field:'sessionType',value:null},{kind:'event',field:'startsAt',value:null},{kind:'event',field:'endsAt',value:false},{kind:'event',field:'status',value:'unknown'},{kind:'event',field:'venueId',value:'invalid'},{kind:'event',field:'venueLayoutId',value:42}
    ];
    for(const item of invalid)expect(()=>normalizeFieldValue(item.kind,item.field,item.value)).toThrow();
    expect(()=>normalizeFieldValue('meeting','status','scheduled')).toThrow('field_not_reconcilable');
    expect(()=>normalizeFieldValue('event','meetingId','x')).toThrow('field_not_reconcilable');
    expect(()=>validatePolicyField('event','status','DISPLAY')).toThrow('field_class_mismatch');
  });
  it('maps every overlapping legacy Event correction field through one explicit contract',()=>{
    expect(Object.fromEntries(legacyReconcilableEventFieldEntries)).toEqual({name:'name',starts_at:'startsAt',ends_at:'endsAt',status:'status',session_title:'sessionLabel'});
    expect(['category','circuit_id','championship_id','slug','published','description'].map(legacyEventFieldToReconciliationField)).toEqual([null,null,null,null,null,null]);
  });
  it('is independent from arrival order and uses field-specific priority',()=>{
    const a=contribution('1','a',{name:'A',startsAt:'2026-01-01T10:00:00Z',status:'scheduled'});
    const b=contribution('2','b',{name:'B',startsAt:'2026-01-01T10:00:30Z',status:'cancelled'});
    const first=reconcile({resourceKind:'event',currentState:{id:'stable'},contributions:[a,b],policy,overrides:[],evaluationAt:'2026-01-01T00:00:00Z'});
    const second=reconcile({resourceKind:'event',currentState:{id:'stable'},contributions:[b,a],policy,overrides:[],evaluationAt:'2026-01-01T00:00:00Z'});
    expect(second).toEqual(first); expect(first.effectiveState).toMatchObject({name:'A',status:'cancelled'}); expect(first.materializationEligible).toBe(true);
  });
  it('keeps current state atomically on a critical conflict',()=>{
    const a=contribution('1','a',{startsAt:'2026-01-01T10:00:00Z'}),b=contribution('2','b',{startsAt:'2026-01-01T11:00:00Z'});
    const result=reconcile({resourceKind:'event',currentState:{startsAt:'old'},contributions:[a,b],policy,overrides:[],evaluationAt:'2026-01-01T00:00:00Z'});
    expect(result.materializationEligible).toBe(false); expect(result.effectiveState).toEqual({startsAt:'old'});
  });
  it('gives a canonical override precedence without mutating contributions',()=>{
    const input=contribution('1','a',{name:'provider'});
    const result=reconcile({resourceKind:'event',currentState:{},contributions:[input],policy,overrides:[{field:'name',value:'admin',revision:2}],evaluationAt:'2026-01-01T00:00:00Z'});
    expect(result.effectiveState.name).toBe('admin'); expect(input.values.name).toBe('provider');
  });
  it('rejects identity and structural identity fields',()=>{
    expect(()=>reconcile({resourceKind:'event',currentState:{},contributions:[],policy:{...policy,rules:[{field:'meeting_id',class:'STRUCTURAL',providerPriority:[['a']]}]},overrides:[],evaluationAt:'2026-01-01T00:00:00Z'})).toThrow('non_reconcilable_field');
  });
  it('rejects unsupported mutable fields instead of silently carrying them',()=>{
    expect(()=>reconcile({resourceKind:'event',currentState:{},contributions:[],policy:{...policy,rules:[{field:'unsupported',class:'DISPLAY',providerPriority:[['a']]}]},overrides:[],evaluationAt:'2026-01-01T00:00:00Z'})).toThrow('non_reconcilable_field:unsupported');
  });
});
