import "server-only";
import { serverSupabase } from "@/lib/serverSupabase";
import type { LibraryData, LibraryItem, LibraryFolder } from "@/lib/projectLibrary";
type Result<T> = { ok: true; data: T } | { ok: false; error: { code?: string | null } };
async function rpc<T>(name: string,args: Record<string,unknown>): Promise<Result<T>> { const {data,error}=await serverSupabase.rpc(name,args); return error?{ok:false,error:{code:error.code}}:{ok:true,data:data as T}; }
const scope=(actorId:string,projectId:string)=>({p_actor_id:actorId,p_project_id:projectId});
export const projectLibraryRepository = {
 list:(actorId:string,projectId:string,folderId:string|null=null)=>rpc<LibraryData>('api_list_project_library',{...scope(actorId,projectId),p_folder_id:folderId}),
 createFolder:(actorId:string,projectId:string,name:string,parentId:string|null)=>rpc<LibraryFolder>('api_create_project_library_folder',{...scope(actorId,projectId),p_name:name,p_parent_id:parentId}),
 mutateFolder:(actorId:string,projectId:string,folderId:string,action:string,name:string|null,parentId:string|null)=>rpc<LibraryFolder>('api_mutate_project_library_folder',{...scope(actorId,projectId),p_folder_id:folderId,p_action:action,p_name:name,p_parent_id:parentId}),
 addItem:(actorId:string,projectId:string,input:{folderId:string|null;kind:'file'|'link';title:string;description?:string|null;url?:string|null;storagePath?:string;fileName?:string;mimeType?:string;sizeBytes?:number})=>rpc<LibraryItem>('api_add_project_library_item',{...scope(actorId,projectId),p_folder_id:input.folderId,p_kind:input.kind,p_title:input.title,p_description:input.description??null,p_url:input.url??null,p_storage_path:input.storagePath??null,p_file_name:input.fileName??null,p_mime_type:input.mimeType??null,p_size_bytes:input.sizeBytes??null}),
 mutateItem:(actorId:string,projectId:string,itemId:string,action:string,title:string|null,folderId:string|null)=>rpc<LibraryItem>('api_mutate_project_library_item',{...scope(actorId,projectId),p_item_id:itemId,p_action:action,p_title:title,p_folder_id:folderId}),
 file:(actorId:string,projectId:string,itemId:string)=>rpc<LibraryItem>('api_get_project_library_file',{...scope(actorId,projectId),p_item_id:itemId}),
};
