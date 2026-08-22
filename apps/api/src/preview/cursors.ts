import {createHmac,timingSafeEqual} from 'node:crypto';

export type PageCursor={kind:'page';resourceType:'championship'|'event'|'meeting';snapshotSequence:number;sortKey:string;resourceId:string;filterHash:string;effectiveFrom?:string;issuedAt:number};
export type SyncCursor={kind:'sync';sequence:number;issuedAt:number};
export type PreviewCursor=PageCursor|SyncCursor;

const MAX_CURSOR_LENGTH=2048;

function signature(encoded:string,secret:string){return createHmac('sha256',secret).update(encoded).digest('base64url');}

export function encodeCursor(cursor:PreviewCursor,secret:string):string{
  const encoded=Buffer.from(JSON.stringify(cursor)).toString('base64url');
  return `${encoded}.${signature(encoded,secret)}`;
}

export function decodeCursor(value:string,kind:PreviewCursor['kind'],secret:string):PreviewCursor{
  if(!value||value.length>MAX_CURSOR_LENGTH)throw new Error('cursor_invalid');
  const [encoded,signed,...extra]=value.split('.');
  if(!encoded||!signed||extra.length)throw new Error('cursor_invalid');
  const expected=Buffer.from(signature(encoded,secret));
  const received=Buffer.from(signed);
  if(expected.length!==received.length||!timingSafeEqual(expected,received))throw new Error('cursor_invalid');
  let parsed:unknown;
  try{parsed=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));}catch{throw new Error('cursor_invalid');}
  if(!parsed||typeof parsed!=='object'||(parsed as {kind?:unknown}).kind!==kind)throw new Error('cursor_invalid');
  const cursor=parsed as Record<string,unknown>;
  if(!Number.isSafeInteger(cursor.issuedAt)||Number(cursor.issuedAt)<0)throw new Error('cursor_invalid');
  if(kind==='sync'){
    if(!Number.isSafeInteger(cursor.sequence)||Number(cursor.sequence)<0)throw new Error('cursor_invalid');
  }else if(!['event','meeting','championship'].includes(String(cursor.resourceType))||!Number.isSafeInteger(cursor.snapshotSequence)||Number(cursor.snapshotSequence)<0||typeof cursor.sortKey!=='string'||cursor.sortKey.length>256||!/^[-_A-Za-z0-9]{43}$/.test(String(cursor.filterHash))||!/^[0-9a-f-]{36}$/i.test(String(cursor.resourceId))||(cursor.effectiveFrom!==undefined&&(typeof cursor.effectiveFrom!=='string'||cursor.effectiveFrom.length>64))){
    throw new Error('cursor_invalid');
  }
  return parsed as PreviewCursor;
}
