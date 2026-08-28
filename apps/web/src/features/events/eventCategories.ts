import type {EventCategory} from './eventTypes';

export const eventCategoryOptions:readonly {value:EventCategory;label:string}[]=[
  {value:'practice',label:'Essais'},
  {value:'qualifying',label:'Qualifications'},
  {value:'sprint',label:'Sprint'},
  {value:'race',label:'Course'},
  {value:'other',label:'Autre'}
];

const values=new Set<string>(eventCategoryOptions.map(option=>option.value));
export const isEventCategory=(value:string):value is EventCategory=>values.has(value);
