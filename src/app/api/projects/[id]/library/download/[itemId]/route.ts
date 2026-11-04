import { apiError, apiJson, asUuid, requireReadActor, rpcFailure } from '@/lib/serverApi';
import { projectLibraryRepository } from '@/lib/projectLibraryRepository';
type Context={params:Promise<{id:string;itemId:string}>};
export async function GET(_request:Request,{params}:Context){
 const guard=await requireReadActor();if(!guard.ok)return guard.response;
 const {id,itemId}=await params;if(!asUuid(id)||!asUuid(itemId))return apiError('invalid_request',400);
 const item=await projectLibraryRepository.file(guard.actor.id,id,itemId);
 if(!item.ok)return rpcFailure(item.error);
 if(!item.data||item.data.kind!=='file'||!item.data.storage_path)return apiError('not_found',404);
 return apiJson({url:`/api/projects/${id}/library/file/${itemId}?disposition=attachment`});
}
