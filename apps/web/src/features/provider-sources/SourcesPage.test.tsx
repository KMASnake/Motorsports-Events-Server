import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {SourcesPage} from './SourcesPage';

describe('Sources page contract',()=>{
  it('renders the existing Sources shell and a loading state without a real-run action',()=>{const html=renderToStaticMarkup(<SourcesPage/>);expect(html).toContain('SOURCES');expect(html).toContain('Chargement');expect(html).not.toMatch(/Synchroniser maintenant|Tester OCBlackTop|Run now|Importer/);});
  it('never renders a credential value in its initial state',()=>{const html=renderToStaticMarkup(<SourcesPage/>);expect(html).not.toContain('SYNTHETIC_NOT_REAL');expect(html).not.toMatch(/ciphertext|nonce|masterKey/);});
});
