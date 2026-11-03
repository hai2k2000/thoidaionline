import { apiError, apiJson, asUuid, requireReadActor, rpcFailure } from '@/lib/serverApi';
import { projectLibraryRepository } from '@/lib/projectLibraryRepository';
import { serverSupabase } from '@/lib/serverSupabase';
type Context={params:Promise<{id:string;itemId:string}>};
export async function GET(_request:Request,{params}:Context){
 const guard=await requireReadActor();if(!guard.ok)return guard.response;
 const {id,itemId}=await params;if(!asUuid(id)||!asUuid(itemId))return apiError('invalid_request',400);
 const item=await projectLibraryRepository.file(guard.actor.id,id,itemId);
 if(!item.ok)return rpcFailure(item.error);
 if(!item.data.storage_path)return apiError('not_found',404);
 const signed=await serverSupabase.storage.from('task-private').createSignedUrl(item.data.storage_path,60,{download:item.data.file_name??true});
 return signed.error||!signed.data?.signedUrl?apiError('service_unavailable',503):apiJson({url:signed.data.signedUrl});
}
