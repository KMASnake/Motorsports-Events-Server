import { describe,expect,it } from 'vitest';
import { weightedSequence } from '../src/providers/schedulerService.js';

describe('Lot 5.4 scheduler policy',()=>{
  it('uses the default 3/2/1 weighted cycle without starvation',()=>{expect(weightedSequence()).toEqual(['current','current','current','recent_catchup','recent_catchup','deep_history']);});
  it('redistributes naturally because empty classes do not reserve a physical slot',()=>{const available=new Set(['current','deep_history']);expect(weightedSequence().filter(value=>available.has(value))).toEqual(['current','current','current','deep_history']);});
  it('accepts positive configurable global weights',()=>{expect(weightedSequence({current:1,recent:1,deep:2})).toEqual(['current','recent_catchup','deep_history','deep_history']);});
});
