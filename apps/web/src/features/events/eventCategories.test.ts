import {describe,expect,it} from 'vitest';
import {eventSessionTitleSuggestions,sessionTitleCategory} from './eventCategories';

describe('catégories et intitulés de session Event',()=>{
  it.each([
    ['FP1','practice'],['FP2','practice'],['FP3','practice'],
    ['Qualifications','qualifying'],['Qualifications Sprint','qualifying'],['Sprint Qualifying','qualifying'],
    ['Race','race'],['Race 1','race'],['Race 2','race'],['Sprint','race']
  ])('classe %s dans la famille %s',(title,category)=>expect(sessionTitleCategory(title)).toBe(category));

  it('propose les intitulés usuels de la famille sans fermer la saisie personnalisée',()=>{
    expect(eventSessionTitleSuggestions('practice',[])).toEqual(expect.arrayContaining(['FP1','FP2','FP3']));
    expect(eventSessionTitleSuggestions('qualifying',[])).toEqual(expect.arrayContaining(['Qualifications','Qualifications Sprint']));
    expect(eventSessionTitleSuggestions('race',[])).toEqual(expect.arrayContaining(['Race','Race 1','Race 2','Sprint']));
    expect(eventSessionTitleSuggestions('other',['Superpole'])).toContain('Superpole');
  });
});
