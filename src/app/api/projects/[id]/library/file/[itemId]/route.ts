import { apiError, asUuid, requireReadActor, rpcFailure } from '@/lib/serverApi';
import { projectLibraryRepository } from '@/lib/projectLibraryRepository';
import { serverSupabase } from '@/lib/serverSupabase';
import { libraryFileHeaders } from '@/lib/projectLibraryFile';

type Context = { params: Promise<{ id: string; itemId: string }> };
async function handle(request: Request, { params }: Context) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const { id, itemId } = await params;
  if (!asUuid(id) || !asUuid(itemId)) return apiError('invalid_request', 400);
  const item = await projectLibraryRepository.file(guard.actor.id, id, itemId);
  if (!item.ok) return rpcFailure(item.error);
  if (!item.data || item.data.kind !== 'file' || !item.data.storage_path) return apiError('not_found', 404);

  try {
    // The signed URL stays server-side; browsers only receive this authorized byte stream.
    const signed = await serverSupabase.storage.from('task-private').createSignedUrl(item.data.storage_path, 60);
    if (signed.error || !signed.data?.signedUrl) return apiError('service_unavailable', 503);
    const headers = new Headers({ 'Accept-Encoding': 'identity' });
    const range = request.headers.get('range');
    if (range) headers.set('Range', range);
    const upstream = await fetch(signed.data.signedUrl, {
      method: request.method, headers, cache: 'no-store', signal: request.signal, redirect: 'error',
    });
    if (![200, 206, 416].includes(upstream.status)) {
      await upstream.body?.cancel();
      return apiError('service_unavailable', 503);
    }
    const responseHeaders = libraryFileHeaders(item.data, new URL(request.url).searchParams.get('disposition') || 'attachment');
    for (const name of ['content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(name);
      if (value !== null) responseHeaders.set(name, value);
    }
    if (upstream.status === 416) {
      await upstream.body?.cancel();
      responseHeaders.delete('content-length');
      return new Response(null, { status: 416, headers: responseHeaders });
    }
    if (request.method === 'HEAD') await upstream.body?.cancel();
    return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return apiError('service_unavailable', 503);
  }
}
export const GET = (request: Request, context: Context) => handle(request, context);
export const HEAD = (request: Request, context: Context) => handle(request, context);
