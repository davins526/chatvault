// Project-aware collector. Uses the user's authorized ChatGPT tab.
// The endpoints are undocumented; support may change without notice.
let collecting=false;
const PAGE_SIZE=100,MAX_LIST_PAGES=20,MAX_PROJECT_PAGES=100,DELAY_MS=1500;
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function error(stage:string,message:string):Error{return Error('['+stage+'] '+message);}
function fail(response:Response,stage:string):never{
 if(response.status===429)throw error(stage,'429: сервер ограничил запросы. Retry-After: '+(response.headers.get('retry-after')||'не указан')+'. Сбор остановлен');
 if(response.status===401||response.status===403)throw error(stage,'Авторизация ChatGPT недоступна: HTTP '+response.status);
 throw error(stage,'HTTP '+response.status);
}
let token:string|null=null;
async function session():Promise<string>{
 if(token)return token;
 const r=await fetch('/api/auth/session',{credentials:'include'});
 if(!r.ok)fail(r,'auth');
 const data=await r.json();
 if(typeof data?.accessToken!=='string'||!data.accessToken)throw error('auth','В сессии нет токена');
 token=data.accessToken;return data.accessToken;
}
async function api(path:string,stage:string):Promise<any>{
 let t=await session();
 let r=await fetch(path,{credentials:'include',headers:{Authorization:'Bearer '+t}});
 if(r.status===401){
   token=null;t=await session();
   r=await fetch(path,{credentials:'include',headers:{Authorization:'Bearer '+t}});
 }
 if(!r.ok)fail(r,stage);
 try{return await r.json();}catch{throw error(stage,'Ответ сервера не содержит корректный JSON');}
}
type Item={id:string;title?:string;gizmo_id?:string;conversation_template_id?:string;update_time?:string|number;_projectId?:string|null};
function projects():string[]{
 const found=new Set<string>();
 const current=location.pathname.match(/\/g\/(g-p-[a-zA-Z0-9]+)/);
 if(current)found.add(current[1]);
 for(const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('nav a[href*="/g/g-p-"]'))){
   const m=(a.getAttribute('href')||'').match(/\/g\/(g-p-[a-zA-Z0-9]+)/);
   if(m)found.add(m[1]);
 }
 return [...found];
}
function items(data:any,stage:string):Item[]{
 if(!Array.isArray(data?.items))throw error(stage,'Формат API изменился: отсутствует массив items');
 return data.items.filter((x:any)=>x&&typeof x.id==='string'&&x.id);
}
function merge(out:Map<string,Item>,page:Item[],project:string|null):void{
 for(const item of page){
   const prev=out.get(item.id);
   const projectId=item.gizmo_id||item.conversation_template_id||project||prev?._projectId||null;
   out.set(item.id,{...prev,...item,_projectId:projectId});
 }
}
async function scanProject(id:string,out:Map<string,Item>):Promise<void>{
 let cursor='0';const seen=new Set<string>();const stage='project '+id;
 for(let i=0;i<MAX_PROJECT_PAGES;i++){
   if(seen.has(cursor))throw error(stage,'Повторяющийся курсор списка');
   seen.add(cursor);
   const data=await api('/backend-api/gizmos/'+encodeURIComponent(id)+'/conversations?cursor='+encodeURIComponent(cursor),stage);
   const page=items(data,stage);merge(out,page,id);
   if(!page.length||!data.cursor)return;
   cursor=String(data.cursor);await pause(DELAY_MS);
 }
 throw error(stage,'Лимит страниц проекта достигнут');
}
async function scanAll(out:Map<string,Item>):Promise<void>{
 let offset=0;const stage='general list';
 for(let i=0;i<MAX_LIST_PAGES;i++){
   const data=await api('/backend-api/conversations?offset='+offset+'&limit='+PAGE_SIZE+'&order=updated',stage);
   const page=items(data,stage);merge(out,page,null);
   offset+=page.length;
   if(!page.length||page.length<PAGE_SIZE||(typeof data.total==='number'&&offset>=data.total))return;
   if(i<MAX_LIST_PAGES-1)await pause(DELAY_MS);
 }
 throw error(stage,'Лимит страниц общего списка достигнут');
}
async function send(runId:string,type:string,fields:any={}):Promise<void>{
 const result=await chrome.runtime.sendMessage({type,runId,...fields});
 if(!result?.ok)throw error('extension',result?.error||'Ответ расширения не получен');
}
async function collect(runId:string):Promise<void>{
 collecting=true;
 const found=new Map<string,Item>();
 try{
   await session();
   // The working MIT exporter retrieves project chats using this cursor API.
   for(const id of projects()){await scanProject(id,found);await pause(DELAY_MS);}
   await scanAll(found);
   await send(runId,'CV_DISCOVERED',{count:found.size});
   if(!found.size)throw error('scan','Найдено 0 чатов: пустой бэкап не создаётся');
   for(const item of found.values()){
     const raw=await api('/backend-api/conversation/'+encodeURIComponent(item.id),'detail '+item.id);
     await send(runId,'CV_ITEM',{item:{id:item.id,title:item.title||raw?.title||'Untitled',projectId:item._projectId||null,updatedAt:item.update_time?String(item.update_time):null,raw}});
     await pause(DELAY_MS);
   }
   await send(runId,'CV_DONE',{discovered:found.size});
 }catch(e){
   const message=e instanceof Error?e.message:String(e);
   try{await chrome.runtime.sendMessage({type:'CV_FAILED',runId,discovered:found.size,error:message});}
   catch{console.error('[ChatVault] Collector error: '+message);}
 }finally{collecting=false;}
}
chrome.runtime.onMessage.addListener((m:any,_sender:any,respond:(v:any)=>void)=>{
 if(m?.type==='CV_PING'){respond({ok:true,ready:true,collecting});return;}
 if(m?.type==='CV_COLLECT'){
   if(collecting){respond({ok:false,error:'Сбор уже выполняется'});return;}
   respond({ok:true});void collect(String(m.runId));
 }
});
