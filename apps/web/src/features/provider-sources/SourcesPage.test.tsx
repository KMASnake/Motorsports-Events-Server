import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {forbiddenSourcesActions,resolveSelectedChampionship,safeJson,SourcesPage} from './SourcesPage';
import type {ProviderChampionship} from './sourcesApi';

const association=(id:string,name:string):ProviderChampionship=>({id,championship_id:id,championship_name:name,external_championship_id:`external-${id}`,sync_state:'inactive',is_primary:false,source_config:{strategy:`strategy-${id}`},current_stream_id:null});

describe('Sources page contract',()=>{
  it('renders the existing Sources shell and a loading state without a real-run action',()=>{const html=renderToStaticMarkup(<SourcesPage/>);expect(html).toContain('SOURCES');expect(html).toContain('Chargement');expect(html).not.toMatch(/Synchroniser maintenant|Tester OCBlackTop|Run now|Importer/);});
  it('never renders a credential value in its initial state',()=>{const html=renderToStaticMarkup(<SourcesPage/>);expect(html).not.toContain('SYNTHETIC_NOT_REAL');expect(html).not.toMatch(/ciphertext|nonce|masterKey/);});
  it('selects each provider championship explicitly and preserves a still-existing selection',()=>{const links=[association('f1','Formule 1'),association('formula-e','Formula E')];expect(resolveSelectedChampionship(links,null)?.id).toBe('f1');expect(resolveSelectedChampionship(links,'formula-e')?.source_config?.strategy).toBe('strategy-formula-e');expect(resolveSelectedChampionship(links,'missing')?.id).toBe('f1');});
  it('resets naturally to the new provider first association',()=>{expect(resolveSelectedChampionship([association('moto-e','Moto E')],null)?.id).toBe('moto-e');expect(resolveSelectedChampionship([],null)).toBeNull();});
  it('handles invalid quota or mapping JSON without throwing',()=>{expect(safeJson('{invalid')).toEqual({ok:false,message:'Le JSON saisi est invalide.'});expect(safeJson('[]').ok).toBe(false);expect(safeJson('{"ok":true}')).toEqual({ok:true,value:{ok:true}});});
  it('defines no operational or real-run action in Sources',()=>{const source=SourcesPage.toString();for(const action of forbiddenSourcesActions)expect(source).not.toContain(`>${action}<`);expect(source).not.toContain('updateSyncState');});
});
