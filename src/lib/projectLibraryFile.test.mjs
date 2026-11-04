import assert from 'node:assert/strict';
import test from 'node:test';
import {libraryFileHeaders,libraryPreviewMime,readLibraryText} from './projectLibraryFile.ts';
const item=(mime,name='report.pdf')=>({mime_type:mime,file_name:name,title:name});
for(const [mime,inline,type] of [
 ['application/pdf',true,'application/pdf'],['image/png',true,'image/png'],['video/mp4',true,'video/mp4'],
 ['image/svg+xml',false,'application/octet-stream'],['text/html',false,'application/octet-stream'],
 ['text/javascript',false,'application/octet-stream'],['application/xml',false,'application/octet-stream'],
 ['application/vnd.openxmlformats-officedocument.wordprocessingml.document',false,'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
 ['application/octet-stream',false,'application/octet-stream'],
])test(`inline safety: ${mime}`,()=>{
 const h=libraryFileHeaders(item(mime),'inline');assert.equal(h.get('content-type'),type);
 assert.equal(h.get('content-disposition').startsWith('inline;'),inline);
 assert.equal(Boolean(libraryPreviewMime(item(mime))),inline || mime.includes('wordprocessingml'));
 assert.equal(h.get('x-content-type-options'),'nosniff');assert.equal(h.get('cache-control'),'private, no-store');
 assert.equal(h.has('content-security-policy'),inline && mime !== 'application/pdf');
 if(inline && mime !== 'application/pdf')assert.equal(h.get('content-security-policy'),"default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
});
test('UTF-8 Vietnamese filenames retain RFC 5987 name and ASCII fallback in both modes',()=>{
 const name='31.10.26 BI\u00caN B\u1ea2N.docx';
 for(const mode of ['inline','attachment']){
 const h=libraryFileHeaders(item('application/pdf',name),mode);const disposition=h.get('content-disposition');
 assert.match(disposition,/filename="31.10.26 BI_N B_N.docx"/);
 assert.ok(disposition.endsWith("filename*=UTF-8''31.10.26%20BI%C3%8AN%20B%E1%BA%A2N.docx"));
 }
 const h=libraryFileHeaders(item('application/pdf',`a'()*\r\n.pdf`),'attachment');
 assert.match(h.get('content-disposition'),/%27%28%29%2A%0D%0A/);
});
test('extension fallback only applies when MIME is absent; attachment is default',()=>{
 assert.equal(libraryPreviewMime(item(null,'clip.MP4')),'video/mp4');
 assert.equal(libraryPreviewMime(item('text/html','clip.mp4')),null);
 assert.equal(libraryPreviewMime(item(null,'report.docx')),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
 assert.equal(libraryPreviewMime(item(null,'unknown.bin')),null);
 assert.match(libraryFileHeaders(item('image/png'),'invalid').get('content-disposition'),/^attachment;/);
});
test('text preview caps bytes at 2 MiB, cancels the reader, and preserves escaped text',async()=>{
 let cancelled=false;let reads=0;
 const stream=new ReadableStream({pull(c){reads++;c.enqueue(new Uint8Array(1024*1024).fill(65));},cancel(){cancelled=true;}});
 const text=await readLibraryText(new Response(stream));assert.equal(text.length,2097152);assert.equal(cancelled,true);assert.ok(reads<=3);
 assert.equal(await readLibraryText(new Response('<script>alert(1)</script>')),'<script>alert(1)</script>');
 await assert.rejects(readLibraryText(new Response('denied',{status:403})));
});
