import {readOne,STORE} from './db.js';
import type {Revision,Snapshot} from './model.js';
import {safeSegment} from './model.js';
import {buildZip,type ZipEntry} from './zip.js';
const urls=new Set<string>();
const encode=(text:string)=>new TextEncoder().encode(text);
function toMarkdown(raw:any):string{
  const mapping=raw?.mapping||{};const sequence:any[]=[];let id=raw?.current_node;const visited=new Set();
  while(id && !visited.has(id)){
    visited.add(id);const node=mapping[id];if(!node)break;
    const msg=node.message;if(msg && ['user','assistant'].includes(msg.author?.role)) sequence.push(msg);
    id=node.parent;
  }
  sequence.reverse();
  return '# '+(raw?.title||'ChatGPT conversation')+'\n\n'+sequence.map(m=>{
    const parts=(m.content?.parts||[]).filter((x:any)=>typeof x==='string');
    return '## '+(m.author.role==='user'?'Пользователь':'Ассистент')+'\n\n'+parts.join('\n');
  }).join('\n\n---\n\n');
}
async function create(snapshotId:string):Promise<{url:string,filename:string}>{
  const snapshot=await readOne<Snapshot>(STORE.snapshots,snapshotId);if(!snapshot)throw Error('Снимок отсутствует');
  const files:ZipEntry[]=[];const manifest:any={format:'chatvault-0.1',snapshotId,createdAt:snapshot.createdAt,status:snapshot.status,discovered:snapshot.discovered,exported:snapshot.entries.length,added:snapshot.added,changed:snapshot.changed,unchanged:snapshot.unchanged,missingAttachments:snapshot.missingAttachments,errors:snapshot.errors,limitations:['Вложения: только ссылки в исходном JSON, без файлов','Инструкции проектов и память аккаунта не выгружаются','Только доступные авторизованной сессии беседы']};
  files.push({name:'manifest.json',data:encode(JSON.stringify(manifest,null,2))});
  files.push({name:'README.txt',data:encode('ChatVault v0.1 — локальный архив. conversation.raw.json хранит полный полученный граф сообщений. conversation.md — только основная ветка для чтения. Вложения в этой версии НЕ скачиваются.\n')});
  for(const entry of snapshot.entries){
    const rev=await readOne<Revision>(STORE.revisions,`${entry.chatId}:${entry.hash}`);
    if(!rev)throw Error(`Не найдена ревизия ${entry.chatId}`);
    const raw:any=rev.raw;
    const folder=`chats/${safeSegment(raw?.title||entry.chatId)}_${entry.chatId.slice(0,8)}`;
    files.push({name:`${folder}/conversation.raw.json`,data:encode(JSON.stringify(raw,null,2))});
    files.push({name:`${folder}/conversation.md`,data:encode(toMarkdown(raw))});
  }
  const blob=buildZip(files);const url=URL.createObjectURL(blob);urls.add(url);
  return {url,filename:`ChatVault-${snapshot.createdAt.slice(0,10)}-${snapshot.entries.length}-chats.zip`};
}
chrome.runtime.onMessage.addListener((m:any,_sender:any,reply:(v:any)=>void)=>{
  if(m?.target!=='offscreen')return false;
  if(m.type==='CV_BUILD_ZIP'){void create(m.snapshotId).then(x=>reply({ok:true,...x})).catch(e=>reply({ok:false,error:String(e)}));return true;}
  if(m.type==='CV_REVOKE_URL'){if(urls.has(m.url)){URL.revokeObjectURL(m.url);urls.delete(m.url);}reply({ok:true});return false;}
  return false;
});
