import { randomUUID } from 'node:crypto';
import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from '@/lib/serverApi';
import { projectLibraryRepository as library } from '@/lib/projectLibraryRepository';
import { projectRepository } from '@/lib/projectRepository';
import { serverSupabase } from '@/lib/serverSupabase';
import { taskAttachmentMetadata } from '@/lib/taskAttachmentPolicy.mjs';
type Context={params:Promise<{id:string}>};
const optionalId=(value:unknown)=>value==null||value===''?null:asUuid(value);
const invalidId=(value:unknown)=>value!=null&&value!==''&&!asUuid(value);
const validTitle=(value:unknown,max=500):value is string=>typeof value==='string'&&Boolean(value.trim())&&value.length<=max;
export async function GET(request:Request,{params}:Context){
 const guard=await requireReadActor();if(!guard.ok)return guard.response;
 const {id}=await params;const folder=new URL(request.url).searchParams.get('folder');
 if(!asUuid(id)||invalidId(folder))return apiError('invalid_request',400);
 const result=await library.list(guard.actor.id,id,optionalId(folder));
 return result.ok?apiJson(result.data):rpcFailure(result.error);
}
export async function POST(request:Request,{params}:Context){
 const guard=await requireMutationActor();if(!guard.ok)return guard.response;
 const {id}=await params;if(!asUuid(id))return apiError('invalid_request',400);
 if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
  // Check membership before storing bytes; the registration RPC rechecks it under lock.
  const members=await projectRepository.listMembers({id:guard.actor.id,roleCode:guard.actor.role_code},id);
  if(!members.ok)return rpcFailure(members.error);
  if(guard.actor.role_code!=='admin'&&!members.data.some(m=>m.user_id===guard.actor.id&&m.staff_users?.active))return apiError('forbidden',403);
  const form=await request.formData().catch(()=>null);const file=form?.get('file');const folder=form?.get('folderId');
  if(!(file instanceof File)||invalidId(folder))return apiError('invalid_request',400);
  const metadata=taskAttachmentMetadata(file);if(!metadata)return apiError('invalid_request',400);
  const storagePath=`projects/${id}/${guard.actor.id}/${randomUUID()}.${metadata.extension}`;
  const storage=serverSupabase.storage.from('task-private');
  const uploaded=await storage.upload(storagePath,await file.arrayBuffer(),{contentType:metadata.mimeType,cacheControl:'3600',upsert:false});
  if(uploaded.error)return apiError('service_unavailable',503);
  const result=await library.addItem(guard.actor.id,id,{kind:'file',folderId:optionalId(folder),title:file.name.slice(0,500),storagePath,fileName:file.name.slice(0,500),mimeType:metadata.mimeType,sizeBytes:file.size});
  if(!result.ok){await storage.remove([storagePath]);return rpcFailure(result.error);}
  return apiJson({item:result.data},201);
 }
 const body=await readJsonObject(request);if(!body)return apiError('invalid_request',400);
 if(body.kind==='folder'&&validTitle(body.name,250)&&!invalidId(body.parentId)){
  const result=await library.createFolder(guard.actor.id,id,body.name.trim(),optionalId(body.parentId));
  return result.ok?apiJson({folder:result.data},201):rpcFailure(result.error);
 }
 if(body.kind==='link'&&validTitle(body.title)&&typeof body.url==='string'&&body.url.length<=2048&&!invalidId(body.folderId)&&(body.description==null||(typeof body.description==='string'&&body.description.length<=10000))){
  try{const url=new URL(body.url);if(url.protocol!=='https:'||url.username||url.password)return apiError('invalid_request',400);}catch{return apiError('invalid_request',400);}
  const result=await library.addItem(guard.actor.id,id,{kind:'link',folderId:optionalId(body.folderId),title:body.title.trim(),url:body.url,description:body.description as string|null});
  return result.ok?apiJson({item:result.data},201):rpcFailure(result.error);
 }
 return apiError('invalid_request',400);
}
async function mutate(request:Request,context:Context,remove:boolean){
 const guard=await requireMutationActor();if(!guard.ok)return guard.response;
 const {id}=await context.params;const body=await readJsonObject(request);
 if(!asUuid(id)||!body||!asUuid(body.id)||!['folder','item'].includes(String(body.kind)))return apiError('invalid_request',400);
 const action=remove?'delete':body.action;
 if(!['rename','move','delete'].includes(String(action))||(!remove&&action==='delete')||invalidId(body.parentId)||invalidId(body.folderId))return apiError('invalid_request',400);
 if(action==='rename'&&!validTitle(body.name,body.kind==='folder'?250:500))return apiError('invalid_request',400);
 const result=body.kind==='folder'
  ?await library.mutateFolder(guard.actor.id,id,body.id as string,action as string,typeof body.name==='string'?body.name.trim():null,optionalId(body.parentId))
  :await library.mutateItem(guard.actor.id,id,body.id as string,action as string,typeof body.name==='string'?body.name.trim():null,optionalId(body.folderId));
 return result.ok?apiJson({result:result.data}):rpcFailure(result.error);
}
export const PATCH=(request:Request,context:Context)=>mutate(request,context,false);
export const DELETE=(request:Request,context:Context)=>mutate(request,context,true);
