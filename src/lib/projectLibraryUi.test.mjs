import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as policy from './projectLibraryFile.ts';
import * as permissions from './projectLibrary.ts';
const require=createRequire(import.meta.url);
function renderLibrary(item){
 const source=readFileSync('src/components/ProjectLibrary.tsx','utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 let state=0;
 const deps={
  react:{...React,useEffect:()=>{},useState:initial=>{state++;return [state===1?{folders:[],items:[item]}:state===4?false:initial,()=>{}];}},
  'next/navigation':{useSearchParams:()=>new URLSearchParams(),useRouter:()=>({push:()=>{}})},
  'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  '@/lib/projectLibraryFile':policy,'@/lib/projectLibrary':permissions,
  '@/components/ui/StateViews':{EmptyState:()=>null,ErrorState:()=>null},
  '@/components/ConfirmDialog':{useConfirm:()=>async()=>true},
  '@/components/ProjectUi':{ProjectIcon:()=>null},
  '@/components/ProjectLibraryPreview':{__esModule:true,default:()=>null},
  '@/components/CameraCaptureButton':{__esModule:true,default:()=>null},
 };
 const testModule={exports:{}};new Function('require','module','exports',compiled)(name=>deps[name]??require(name),testModule,testModule.exports);
 return renderToStaticMarkup(React.createElement(testModule.exports.default,{projectId:'project',actorId:'actor',member:false,manager:false}));
}
test('library renders same-origin download anchors and Xem only for previewable file types including task files',()=>{
 for(const [mime,name,preview] of [['application/pdf','file.pdf',true],['image/png','file.png',true],['video/mp4','file.mp4',true],['text/plain','file.txt',true],['image/svg+xml','file.svg',false],['text/html','file.html',false],['application/vnd.openxmlformats-officedocument.wordprocessingml.document','file.docx',true],['application/octet-stream','file.xlsx',true],['application/msword','file.doc',false],['application/vnd.ms-excel','file.xls',false],['application/octet-stream','file.pptx',false]]){
  const html=renderLibrary({id:'item',kind:'file',title:name,file_name:name,mime_type:mime,source_task_id:'task',created_at:'2026-11-04'});
  assert.equal(html.includes('>Xem</button>'),preview);
  assert.match(html,/href="\/api\/projects\/project\/library\/file\/item\?disposition=attachment" download=""/);
  assert.ok(html.includes('/tasks/task'));assert.ok(!html.includes('/supa/'));
  if(!preview)assert.ok(html.includes('Tệp này chưa xem trực tiếp được, vui lòng tải về'));
 }
 const html=renderLibrary({id:'item',kind:'link',title:'Link',url:'https://example.test',mime_type:'application/pdf',created_at:'2026-11-04'});
 assert.ok(!html.includes('>Xem</button>'));assert.ok(!html.includes('/library/file/'));
 assert.ok(!readFileSync('src/components/ProjectLibrary.tsx','utf8').includes('window.location.assign'));
});
