import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {EventEditorDialog} from './EventEditorDialog';
import type {EventFormState} from './eventTypes';

const value:EventFormState={championship_id:'f1',circuit_id:'silverstone',name:'British Grand Prix',starts_at:'2026-07-05T14:00',ends_at:'2026-07-05T16:00',status:'scheduled',published:true,description:'Fixture',session_title:'Race'};
const html=(meetingName:string|null=null)=>renderToStaticMarkup(<EventEditorDialog open editing saving={false} value={value} meetingName={meetingName} championships={[{id:'f1',name:'Formule 1',short_name:'F1',active:true}]} circuits={[{id:'silverstone',name:'Silverstone',city:null,country_code:'GB',timezone:'UTC'}]} sessionTitles={['Race']} error={null} onChange={vi.fn()} onNameChange={vi.fn()} onClose={vi.fn()} onSubmit={vi.fn()}/>);

describe('EventEditorDialog',()=>{
  it('rend les valeurs existantes de nom, championnat, circuit, dates et autres champs',()=>{const rendered=html();expect(rendered).toContain('value="British Grand Prix"');expect(rendered).toContain('value="f1" selected=""');expect(rendered).toContain('value="silverstone" selected=""');expect(rendered).toContain('value="2026-07-05T14:00"');expect(rendered).toContain('value="2026-07-05T16:00"');expect(rendered).toContain('value="scheduled" selected=""');expect(rendered).toContain('value="Race"');expect(rendered).toContain('Fixture');});
  it('ne rend plus Catégorie et affiche le label Circuit sans facultatif',()=>{const rendered=html();expect(rendered).not.toContain('Catégorie');expect(rendered).not.toContain('Circuit facultatif');expect(rendered).toMatch(/<label>Circuit<select/);expect(rendered).toContain('Non défini');});
  it('présente le Meeting en lecture seule et conserve la session enfant',()=>{const rendered=html('Singapore Grand Prix');expect(rendered).toContain('Épreuve');expect(rendered).toContain('value="Singapore Grand Prix"');expect(rendered).toContain('readOnly=""');expect(rendered).toContain('value="Race"');expect(rendered).not.toContain('Nom public');});
  it('conserve le nom public éditable pour un Event manuel sans Meeting',()=>{const rendered=html();expect(rendered).toContain('Nom public');expect(rendered).toContain('value="British Grand Prix"');expect(rendered).not.toContain('readOnly=""');});
});
