import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {decodeCursor,encodeCursor,type PageCursor,type SyncCursor} from '../preview/cursors.js';
import {PostgresPreviewRepository,type PreviewRepository,type ResourceRow,type ResourceType} from '../preview/repository.js';
import type {ApiClientPrincipal} from '../preview/clientSecurity.js';

const uuid=z.string().uuid(),instant=z.string().datetime({offset:true});
const resourceQuery=z.object({limit:z.coerce.number().int().min(1).max(100).default(50),cursor:z.string().max(2048).optional(),championship:z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),championship_id:uuid.optional(),from:instant.optional(),to:instant.optional(),status:z.enum(['scheduled','completed','cancelled','postponed']).optional(),session_type:z.enum(['practice','practice_1','practice_2','practice_3','qualifying','sprint_qualifying','sprint','warmup','race','test','other']).optional()}).strict().refine(value=>!(value.championship&&value.championship_id),{message:'championship and championship_id are mutually exclusive'}).refine(value=>!(value.from&&value.to&&new Date(value.from)>new Date(value.to)),{message:'from must precede to'});
const basicQuery=z.object({limit:z.coerce.number().int().min(1).max(100).default(50),cursor:z.string().max(2048).optional()}).strict();
const changesQuery=z.object({limit:z.coerce.number().int().min(1).max(500).default(100),cursor:z.string().max(2048).optional(),include:z.enum(['data']).optional()}).strict();

function error(reply:FastifyReply,request:FastifyRequest,status:number,code:string,message:string){return reply.code(status).send({error:{code,message,request_id:request.id}});}
function filterHash(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('base64url');}
function publicState(row:ResourceRow){const state=row.state??{};const common={id:row.resourceId,revision:row.revision,name:state.name??null,starts_at:state.startsAt??null,ends_at:state.endsAt??null,timezone:state.timezone??null,last_updated_at:row.promotedAt};if(row.resourceType==='championship')return {...common,slug:state.slug??null,short_name:state.shortName??null,official_name:state.officialName??null,category:state.category??null,season:state.season??null,logo_url:state.logoUrl??null,description:state.description??null,availability:state.availability??'preview'};if(row.resourceType==='meeting')return {...common,championship:{id:state.championshipId??null},season:state.season??null,round:state.round??null,venue:state.circuitId?{id:state.circuitId}:null,data_quality:{freshness:state.presence??'unknown'},sessions:Array.isArray(state.sessions)?state.sessions:[]};return {...common,championship:{id:state.championshipId??null},session:{type:state.sessionType??'other',name:state.sessionLabel??state.name??null},status:state.status??null,venue:state.circuitId?{id:state.circuitId}:null,data_quality:{freshness:state.presence??'unknown'}};}

export interface PreviewReadOptions{repository?:PreviewRepository;cursorSecret:string;retentionDays?:number;now?:()=>Date;principal?:(request:FastifyRequest)=>ApiClientPrincipal|undefined}
export async function previewReadRoutes(app:FastifyInstance,options:PreviewReadOptions){
  if(options.cursorSecret.length<32)throw new Error('PREVIEW_CURSOR_SECRET must contain at least 32 characters');
  const repository=options.repository??new PostgresPreviewRepository(),now=options.now??(()=>new Date());
  const list=async(type:ResourceType,request:FastifyRequest,reply:FastifyReply)=>{
    const schema=type==='event'?resourceQuery:basicQuery,parsed=schema.safeParse(request.query);if(!parsed.success)return error(reply,request,400,'invalid_request','Invalid or unsupported query parameters.');
    const query=parsed.data as z.infer<typeof resourceQuery>,principal=options.principal?.(request);let cursor:PageCursor|undefined;
    const effectiveLimit=Math.min(query.limit,type==='event'||type==='meeting'||type==='championship'?(principal?.pageLimit??100):100);
    try{if(query.cursor)cursor=decodeCursor(query.cursor,'page',options.cursorSecret) as PageCursor;}catch{return error(reply,request,400,'invalid_request','Invalid page cursor.');}
    if(cursor&&cursor.resourceType!==type)return error(reply,request,400,'invalid_request','Cursor does not match this resource.');
    if(cursor&&principal&&cursor.clientId!==principal.clientId)return error(reply,request,400,'invalid_request','Cursor does not match this client.');
    if(principal&&query.championship_id&&!principal.championshipIds.has(query.championship_id))return error(reply,request,403,'dataset_forbidden','Championship dataset is not authorized.');
    if(principal&&query.championship){const championshipId=await repository.resolveChampionship(query.championship);if(championshipId&&!principal.championshipIds.has(championshipId))return error(reply,request,403,'dataset_forbidden','Championship dataset is not authorized.');}
    const snapshotSequence=cursor?.snapshotSequence??await repository.snapshotBoundary();
    if(cursor&&snapshotSequence<await repository.oldestSnapshotSequence())return error(reply,request,410,'snapshot_cursor_expired','Snapshot cursor expired; restart pagination.');
    const from=type==='event'?(query.from??cursor?.effectiveFrom??now().toISOString()):undefined;
    const fingerprint=filterHash({type,championship:query.championship??null,championshipId:query.championship_id??null,from:from??null,to:query.to??null,status:query.status??null,sessionType:query.session_type??null});
    if(cursor&&cursor.filterHash!==fingerprint)return error(reply,request,400,'invalid_request','Cursor does not match these filters.');
    const rows=await repository.list({resourceType:type,limit:effectiveLimit,snapshotSequence,after:cursor?{sortKey:cursor.sortKey,resourceId:cursor.resourceId}:undefined,championshipId:query.championship_id,championshipSlug:query.championship,allowedChampionshipIds:principal?[...principal.championshipIds]:undefined,from,to:query.to,status:query.status,sessionType:query.session_type});
    const hasMore=rows.length>effectiveLimit,visible=rows.slice(0,effectiveLimit),last=visible.at(-1),issuedAt=Math.floor(now().valueOf()/1000);
    const nextCursor=hasMore&&last?encodeCursor({kind:'page',resourceType:type,snapshotSequence,sortKey:last.sortKey,resourceId:last.resourceId,filterHash:fingerprint,...(from?{effectiveFrom:from}:{}),...(principal?{clientId:principal.clientId}:{}),issuedAt},options.cursorSecret):null;
    const syncCursor=encodeCursor({kind:'sync',sequence:snapshotSequence,...(principal?{clientId:principal.clientId}:{}),issuedAt},options.cursorSecret);
    return {data:visible.map(publicState),pagination:{next_cursor:nextCursor,has_more:hasMore,sync_cursor:syncCursor}};
  };
  for(const type of ['championship','event','meeting'] as const){const plural=`${type}s`;app.get(`/api/v1/${plural}`,async(request,reply)=>list(type,request,reply));app.get(`/api/v1/${plural}/:id`,async(request,reply)=>{const parsed=uuid.safeParse((request.params as {id?:unknown}).id);if(!parsed.success)return error(reply,request,400,'invalid_request','Invalid resource identifier.');const found=await repository.detail(type,parsed.data),principal=options.principal?.(request);const championshipId=type==='championship'?parsed.data:String(found?.state?.championshipId??'');if(!found||(principal&&!principal.championshipIds.has(championshipId)))return error(reply,request,404,'not_found','Resource not found.');return publicState(found);});}
  app.get('/api/v1/changes',async(request,reply)=>{const parsed=changesQuery.safeParse(request.query);if(!parsed.success)return error(reply,request,400,'invalid_request','Invalid or unsupported query parameters.');let cursor:SyncCursor={kind:'sync',sequence:0,issuedAt:Math.floor(now().valueOf()/1000)};try{if(parsed.data.cursor)cursor=decodeCursor(parsed.data.cursor,'sync',options.cursorSecret) as SyncCursor;}catch{return error(reply,request,400,'invalid_sync_cursor','Invalid sync cursor.');}
    const principal=options.principal?.(request);if(principal&&cursor.clientId!==undefined&&cursor.clientId!==principal.clientId)return error(reply,request,400,'invalid_sync_cursor','Invalid sync cursor.');
    const [oldestSequence,latestSequence]=await Promise.all([repository.oldestChangeSequence(),repository.snapshotBoundary()]);
    if(cursor.sequence>latestSequence)return error(reply,request,400,'invalid_sync_cursor','Invalid sync cursor.');
    if(parsed.data.cursor&&oldestSequence!==null&&cursor.sequence<oldestSequence)return error(reply,request,410,'sync_cursor_expired','Sync cursor expired; perform a full resync.');
    const limit=Math.min(parsed.data.limit,principal?.changesPageLimit??500),rows=await repository.changes(cursor.sequence,limit,parsed.data.include==='data',principal?[...principal.championshipIds]:undefined),hasMore=rows.length>limit,visible=rows.slice(0,limit),sequence=visible.at(-1)?.sequence??cursor.sequence;
    return {data:visible.map(change=>({sequence:change.sequence,resource_type:change.resourceType,resource_id:change.resourceId,revision:change.revision,operation:change.operation,changed_fields:change.changedFields,occurred_at:change.occurredAt,...(parsed.data.include==='data'?{current:change.current?publicState(change.current):null}:{})})),pagination:{next_cursor:encodeCursor({kind:'sync',sequence,...(principal?{clientId:principal.clientId}:{}),issuedAt:Math.floor(now().valueOf()/1000)},options.cursorSecret),has_more:hasMore}};
  });
  app.setErrorHandler((_failure,request,reply)=>{request.log.error({code:'preview_read_failed',requestId:request.id},'Preview read request failed');return error(reply,request,500,'internal_error','The service could not complete the request.');});
}
