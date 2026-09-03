import type {EventCategory} from './eventTypes';

export const eventCategoryOptions:readonly {value:EventCategory;label:string}[]=[
  {value:'practice',label:'Essais'},
  {value:'qualifying',label:'Qualifications'},
  {value:'race',label:'Course'},
  {value:'other',label:'Autre'}
];

const values=new Set<string>(eventCategoryOptions.map(option=>option.value));
export const isEventCategory=(value:string):value is EventCategory=>values.has(value);

export function eventCategoryForForm(value:string|null):string {
  if(value==='sprint_qualifying')return 'qualifying';
  if(value==='sprint')return 'race';
  return value??'';
}

const defaultSessionTitles:Readonly<Record<EventCategory,readonly string[]>>={
  practice:['FP1','FP2','FP3','Free Practice','Essais libres'],
  qualifying:['Qualifications','Qualifications Sprint','Sprint Qualifying'],
  race:['Race','Course','Race 1','Race 2','Sprint'],
  other:[]
};

export function sessionTitleCategory(title:string):EventCategory {
  const normalized=title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('fr-FR');
  if(/\b(sprint (?:q|qualifying)|qualifications? sprint|sprint shootout|qualifying|qualifications?)\b/.test(normalized))return 'qualifying';
  if(/^(fp\s*\d+|free practice\b|practice\b|essais? libres?\b)/.test(normalized))return 'practice';
  if(/\b(race|course|sprint)\b/.test(normalized))return 'race';
  return 'other';
}

export function eventSessionTitleSuggestions(category:string,titles:readonly string[]):string[] {
  if(!isEventCategory(category))return [...titles];
  const suggestions=[...defaultSessionTitles[category],...titles.filter(title=>sessionTitleCategory(title)===category)];
  return [...new Map(suggestions.map(title=>[title.toLocaleLowerCase('fr-FR'),title])).values()];
}
