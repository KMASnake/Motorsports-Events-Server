import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {AUTH_REQUIRED_EVENT} from '../../lib/adminAuth';
import {candidateData,CandidateReadError,getCandidate,listCandidates} from './candidatesApi';
import {CandidateContent,display} from './CandidatesPage';
import {candidateId,fixtureDetail,fixtureRows,incompleteDetail,syntheticScenario} from './candidates.fixtures';

describe('ADM-01 GET contracts and rendering',()=>{
 beforeEach(()=>{vi.stubGlobal('document',{cookie:'mse_admin_csrf=synthetic-csrf'});vi.stubGlobal('window',{dispatchEvent:vi.fn()});vi.stubGlobal('fetch',vi.fn());});
 afterEach(()=>vi.unstubAllGlobals());
 it('uses only the real list filters, credentials and existing CSRF convention',async()=>{
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(fixtureRows)));
  expect(await listCandidates('REVIEW_REQUIRED',25)).toHaveLength(25);
  const[path,init]=vi.mocked(fetch).mock.calls[0];expect(String(path)).toContain('/api/v1/admin/meeting-event-resolution-candidates?state=REVIEW_REQUIRED&limit=25&offset=25');
  expect(init).toMatchObject({method:'GET',credentials:'include',headers:{'X-CSRF-Token':'synthetic-csrf'}});
 });
 it('reads the existing detail DTO without any provider enrichment',async()=>{const detail=fixtureDetail(1,'meeting');vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(detail)));expect(await getCandidate(candidateId(1))).toEqual(detail);expect(fetch).toHaveBeenCalledTimes(1);expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe('GET');});
 it.each([401,403,404,500])('handles GET %s without exposing backend payloads',async status=>{vi.mocked(fetch).mockResolvedValue(new Response('private error',{status}));await expect(getCandidate(candidateId(1))).rejects.toBeInstanceOf(CandidateReadError);expect(window.dispatchEvent).toHaveBeenCalledTimes(status===401?1:0);if(status===401)expect(vi.mocked(window.dispatchEvent).mock.calls[0][0].type).toBe(AUTH_REQUIRED_EVENT);});
 it('rejects unsupported states and invalid offsets without a request',async()=>{await expect(listCandidates('BAD' as never,0)).rejects.toThrow();await expect(listCandidates('PENDING',-1)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();});
 it('rejects malformed list/detail data and mismatched IDs',async()=>{vi.mocked(fetch).mockResolvedValue(new Response('{}'));await expect(listCandidates('PENDING',0)).rejects.toThrow('inexploitable');vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(fixtureDetail(2))));await expect(getCandidate(candidateId(1))).rejects.toThrow('inexploitable');});
 it('renders normalized provenance, historical decisions and raw ambiguous dates without publication claims',()=>{
  const html=renderToStaticMarkup(createElement(CandidateContent,{detail:fixtureDetail(1,'meeting')}));expect(html).toContain('Meeting synthétique');expect(html).toContain('synthetic-hash-1');expect(html).toContain('synthetic-normalizer');expect(html).toContain('2026-10-25T02:30:00');expect(html).toContain('Non renseigné');expect(html).toContain('ne prouve pas une publication');expect(html).not.toContain('synthetic-provider-a');
 });
 it('renders incomplete candidates without inventing values or decision history',()=>{const html=renderToStaticMarkup(createElement(CandidateContent,{detail:incompleteDetail}));expect(html).toContain('partielles ou absentes');expect(html).toContain('Aucune décision enregistrée');expect(html).toContain('Event');expect(html).not.toContain('undefined');});
 it('tolerates nullable, JSON-encoded and unusable candidate payloads',()=>{expect(candidateData('{"normalized":{}}')).toEqual({normalized:{}});expect(candidateData('{bad')).toEqual({});expect(candidateData(null)).toEqual({});expect(display(null)).toBe('Non renseigné');expect(display(0)).toBe('0');});
 it('keeps two synthetic provider origins and parentage out of the limited API DTO',()=>{expect(syntheticScenario.providers).toHaveLength(2);expect(syntheticScenario.meeting.eventCandidateIds).toHaveLength(2);expect(fixtureDetail(2).candidate.candidate_data).not.toHaveProperty('provider');});
});
