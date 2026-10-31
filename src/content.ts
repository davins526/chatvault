// Runs only on chatgpt.com in an existing signed-in tab. No tokens sent to the extension.
let collecting=false;
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function fail(status:number, headers:Headers, label:string):never {
  if(status===429){const wait=headers.get('retry-after');throw Error(`429: лимит запросов${wait?`, Retry-After: ${wait}`:''}. Повторите позже.`);}
  if(status===401||status===403)throw Error(`${status}: авторизация недоступна`);
  throw Error(`${label}: HTTP ${status}`);
}
async function getSessionToken():Promise<string> {
  const response=await fetch('/api/auth/session',{credentials:'include'});
  if(!response.ok)fail(response.status,response.headers,'Session');
  const session=await response.json();
  if(!session?.accessToken)throw Error('Нет доступной авторизованной сессии');
  return session.accessToken;
}
async function api(path:string,token:string):Promise<any> {
  const response=await fetch(path,{credentials:'include',headers:{'Authorization':`Bearer ${token}`}});
  if(!response.ok)fail(response.status,response.headers,path);
  return response.json();
}
async function collect(runId:string):Promise<void> {
  if(collecting)throw Error('Экспорт уже выполняется в этой вкладке');
  collecting=true;
  let found=0;
  try {
    const token=await getSessionToken();
    const list:any[]=[];
    for(let page=0;page<20;page++) {
      const data=await api(`/backend-api/conversations?offset=${page*50}&limit=50&order=updated`,token);
      if(!Array.isArray(data.items))throw Error('Формат списка переписок изменился');
      list.push(...data.items);
      if(data.items.length<50)break;
      if(page===19)throw Error('Достигнут лимит страниц: архив неполный');
      await pause(1500);
    }
    found=list.length;
    const scanned=await chrome.runtime.sendMessage({type:'CV_DISCOVERED',runId,count:found});
    if(!scanned?.ok)throw Error(scanned?.error||'Не удалось сохранить количество чатов');
    if(!found)throw Error('Не найдено ни одной переписки — пустой архив не создаётся');
    for (const c of list) {
      const raw=await api(`/backend-api/conversation/${encodeURIComponent(c.id)}`,token);
      const stored=await chrome.runtime.sendMessage({type:'CV_ITEM',runId,item:{id:c.id,title:c.title||'Untitled',projectId:c.gizmo_id||c.conversation_template_id||null,updatedAt:c.update_time?String(c.update_time):null,raw}});
      if(!stored?.ok)throw Error(stored?.error||'Не удалось сохранить чат в IndexedDB');
      await pause(1500);
    }
    await chrome.runtime.sendMessage({type:'CV_DONE',runId,discovered:found});
  } catch(e) {
    await chrome.runtime.sendMessage({type:'CV_FAILED',runId,discovered:found,error:e instanceof Error?e.message:String(e)});
  } finally {collecting=false;}
}
chrome.runtime.onMessage.addListener((m:any,_sender:any,respond:(v:any)=>void)=>{
  if(m?.type==='CV_COLLECT') {
    if(collecting){respond({ok:false,error:'Эта вкладка уже выполняет сбор'});return;}
    respond({ok:true});
    void collect(m.runId);
  }
});
