import { DEFAULT_SETTINGS, nextWeekly, type Settings } from './model.js';
import {addLog, appendChat, finalizeSnapshot, recentSnapshot, startSnapshot, readAll, STORE, putOne} from './db.js';
import type {Snapshot} from './model.js';
const WEEKLY='chatvault-weekly', RETRY='chatvault-catchup';
let runTabId:number|null=null;
let creatingOffscreen:Promise<void>|null=null;
let starting=false;

type State = {nextDueAt:number|null;lastSuccessAt:number|null;lastSnapshotId:string|null;activeRunId:string|null;pendingManual:boolean;lastAttemptAt:number|null; backoffUntil:number|null; status:string; notice:string; current:number; discovered:number|null};
const INITIAL:State = {nextDueAt:null,lastSuccessAt:null,lastSnapshotId:null,activeRunId:null,pendingManual:false,lastAttemptAt:null,backoffUntil:null,status:'idle',notice:'Расписание включено. Ожидание первого резервирования.',current:0,discovered:null};
async function getSettings():Promise<Settings>{const v=await chrome.storage.local.get('settings');return {...DEFAULT_SETTINGS,...v.settings};}
async function getState():Promise<State>{const v=await chrome.storage.local.get('state');return {...INITIAL,...v.state};}
async function updateState(delta:Partial<State>):Promise<State>{const next={...await getState(),...delta};await chrome.storage.local.set({state:next});return next;}
async function reschedule():Promise<void>{
  await chrome.alarms.clear(WEEKLY);
  const cfg=await getSettings();if(!cfg.enabled)return;
  const s=await getState();
  let due=s.nextDueAt;
  if(due==null)due=nextWeekly(new Date(),cfg);
  await updateState({nextDueAt:due});
  await chrome.alarms.create(WEEKLY,{when:Math.max(Date.now()+60000,due)});
}
async function initialize():Promise<void>{
  const item=await chrome.storage.local.get(['settings','state']);
  if(!item.settings)await chrome.storage.local.set({settings:DEFAULT_SETTINGS});
  if(!item.state)await chrome.storage.local.set({state:INITIAL});
  const state=await getState();
  if(state.activeRunId){
    const all=await readAll<Snapshot>(STORE.snapshots);
    const old=all.find(x=>x.id===state.activeRunId);
    if(old?.status==='running'){
      old.status='partial';old.errors.push('Прервано при закрытии вкладки/перезапуске браузера');old.finishedAt=new Date().toISOString();await putOne(STORE.snapshots,old);
    }
    await updateState({activeRunId:null,status:'interrupted',pendingManual:false,notice:'Предыдущая копия прервана; сохранённые ревизии остались локально.'});
  }
  await reschedule();await checkDue();
}
async function findTab():Promise<any|null>{
  const tabs=await chrome.tabs.query({url:['https://chatgpt.com/*','https://chat.openai.com/*']});
  return tabs.find((t:any)=>t.status==='complete' && typeof t.id==='number')||null;
}
async function checkDue():Promise<void>{
  const cfg=await getSettings(), s=await getState();
  if(s.activeRunId)return;
  if(!s.pendingManual && (!cfg.enabled||s.nextDueAt==null||Date.now()<s.nextDueAt))return;
  if(s.backoffUntil&&Date.now()<s.backoffUntil)return;
  await runBackup(s.pendingManual);
}
async function runBackup(manual:boolean):Promise<{ok:boolean,message:string}>{
  if(starting)return {ok:false,message:'Запуск уже выполняется'};
  starting=true;
  try {
    const old=await getState();if(old.activeRunId)return {ok:false,message:'Резервное копирование уже идёт'};
    if(old.backoffUntil&&Date.now()<old.backoffUntil)return {ok:false,message:'После ошибки сервер ограничил запросы. Повторите позже.'};
    const tab=await findTab();
    if(!tab){await updateState({pendingManual:manual||old.pendingManual,status:'waiting-tab',notice:'Откройте ChatGPT в этом профиле Brave: копия запустится при доступной вкладке.'});return {ok:false,message:'Нет открытой авторизованной вкладки ChatGPT'};}
    const runId=crypto.randomUUID();await startSnapshot(runId);
    runTabId=tab.id;
    await updateState({activeRunId:runId,pendingManual:false,lastAttemptAt:Date.now(),status:'running',notice:manual?'Ручное копирование…':'Недельное копирование…',current:0,discovered:null});
    try {
      const reply=await chrome.tabs.sendMessage(tab.id,{type:'CV_COLLECT',runId});
      if(!reply?.ok)throw Error(reply?.error||'Вкладка не ответила');
    } catch(e) {
      await finish(runId,0,[`Не удалось запустить сбор: ${String(e)}`]);
      return {ok:false,message:'Нет доступа к сборщику во вкладке. Обновите ChatGPT и попробуйте снова.'};
    }
    await addLog('info',manual?'Ручное копирование запущено':'Запущено по недельному расписанию');
    return {ok:true,message:'Сбор данных запущен'};
  } finally {starting=false;}
}
async function finish(runId:string,discovered:number|null,errors:string[]):Promise<void>{
  const state=await getState();if(state.activeRunId!==runId)return;
  runTabId=null;
  const snapshot=await finalizeSnapshot(runId,discovered,errors);
  const cfg=await getSettings();
  const complete=snapshot.status==='complete' && snapshot.entries.length>0;
  if(!complete){
    const retryMatch=errors.join(' ').match(/Retry-After:\s*(\d+)/i);
    const cooldown=Math.max(60*60*1000,retryMatch?Number(retryMatch[1])*1000:0);
    const backoff=Date.now()+Math.min(cooldown,24*60*60*1000);
    await updateState({activeRunId:null,status:snapshot.entries.length?'partial':'failed',pendingManual:false,notice:`Копия неполная: ${errors[0]||'неизвестная ошибка'}`,backoffUntil:backoff,current:snapshot.entries.length,discovered});
    await chrome.alarms.create(RETRY,{when:backoff+60000});
    await addLog('error',errors.join('; ')||'Неполная копия');
  } else {
    const next=nextWeekly(new Date(),cfg);
    await updateState({activeRunId:null,lastSuccessAt:Date.now(),lastSnapshotId:runId,nextDueAt:next,backoffUntil:null,status:'complete',pendingManual:false,notice:`Сохранено ${snapshot.entries.length} чатов. Ссылки на вложения без содержимого.`,current:snapshot.entries.length,discovered});
    await reschedule();await addLog('info',`Снимок ${runId}: ${snapshot.entries.length} чатов, новых ${snapshot.added}, изменено ${snapshot.changed}`);
  }
  if(cfg.autoDownload && snapshot.entries.length>0){
    try {await downloadSnapshot(runId);}catch(e){await addLog('error',`Автоматическое скачивание ZIP не удалось: ${String(e)}`);}
  }
}
async function ensureOffscreen():Promise<void>{
  const url=chrome.runtime.getURL('offscreen.html');
  const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[url]});
  if(contexts.length)return;
  if(!creatingOffscreen){
    creatingOffscreen=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['BLOBS'],justification:'Создать локальный ZIP и Blob URL для скачивания резервной копии'}).finally(()=>creatingOffscreen=null);
  }
  await creatingOffscreen;
}
async function downloadSnapshot(snapshotId:string):Promise<void>{
  await ensureOffscreen();
  const reply=await chrome.runtime.sendMessage({target:'offscreen',type:'CV_BUILD_ZIP',snapshotId});
  if(!reply?.ok)throw Error(reply?.error||'Ошибка генерации ZIP');
  const downloadId=await chrome.downloads.download({url:reply.url,filename:reply.filename,saveAs:false,conflictAction:'uniquify'});
  await chrome.storage.local.set({[`download_${downloadId}`]:reply.url});
  await addLog('info',`Скачивание ZIP начато (${snapshotId})`);
}
chrome.downloads.onChanged.addListener((d:any)=>{
  if(!d.state?.current || !['complete','interrupted'].includes(d.state.current))return;
  void (async()=>{
    const key=`download_${d.id}`,stored=await chrome.storage.local.get(key);
    if(stored[key]){await chrome.runtime.sendMessage({target:'offscreen',type:'CV_REVOKE_URL',url:stored[key]});await chrome.storage.local.remove(key);}
  })();
});
chrome.alarms.onAlarm.addListener((a:any)=>{if(a.name===WEEKLY||a.name===RETRY)void checkDue();});
chrome.runtime.onInstalled.addListener(()=>{void initialize();});
chrome.runtime.onStartup.addListener(()=>{void initialize();});
chrome.tabs.onUpdated.addListener((_tabId:number,change:any,tab:any)=>{if(change.status==='complete'&&/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url||''))void checkDue();});
chrome.tabs.onRemoved.addListener((id:number)=>{if(runTabId===id)void(async()=>{const s=await getState();if(s.activeRunId)await finish(s.activeRunId,s.discovered,['Вкладка ChatGPT закрыта во время экспорта']);})();});
chrome.runtime.onMessage.addListener((m:any,sender:any,send:(response:any)=>void)=>{
  if(m?.target==='offscreen')return false;
  if(m?.type==='CV_GET_STATUS'){
    void(async()=>{const [settings,state,snapshot,logs,allSnapshots]=await Promise.all([getSettings(),getState(),recentSnapshot(),readAll(STORE.logs),readAll(STORE.snapshots)]);send({ok:true,settings,state,snapshot,snapshotCount:allSnapshots.length,logs:logs.slice(-12).reverse()});})().catch((e)=>send({ok:false,error:String(e)}));return true;
  }
  if(m?.type==='CV_SAVE_SETTINGS'){
    void(async()=>{
      const settings:{[key:string]:unknown}={...DEFAULT_SETTINGS,...m.settings};
      if(settings.dayOfWeek!==0||settings.hour!==20||settings.minute!==0)throw Error('В этой версии фиксировано: воскресенье, 20:00');
      await chrome.storage.local.set({settings});await updateState({nextDueAt:nextWeekly(new Date(),settings as Settings)});await reschedule();send({ok:true});
    })().catch((e)=>send({ok:false,error:String(e)}));return true;
  }
  if(m?.type==='CV_BACKUP_NOW'){
    void runBackup(true).then(send).catch(e=>send({ok:false,message:String(e)}));return true;
  }
  if(m?.type==='CV_EXPORT'){
    void(async()=>{const s=await getState();const id=m.snapshotId||s.lastSnapshotId||(await recentSnapshot())?.id;if(!id)throw Error('Нет сохранённых снимков');await downloadSnapshot(id);send({ok:true});})().catch((e)=>send({ok:false,error:String(e)}));return true;
  }
  const items=new Set(['CV_DISCOVERED','CV_ITEM','CV_DONE','CV_FAILED']);
  if(items.has(m?.type)){
    void(async()=>{
      const s=await getState();
      if(!sender.tab?.id||sender.tab.id!==runTabId||s.activeRunId!==m.runId)throw Error('Неавторизованный или устаревший сеанс резервирования');
      if(m.type==='CV_DISCOVERED'){await updateState({discovered:m.count});send({ok:true});}
      else if(m.type==='CV_ITEM'){
        if(!m.item?.id||!m.item.raw)throw Error('Неполные данные чата');
        await appendChat(m.runId,m.item);await updateState({current:s.current+1});send({ok:true});
      } else {
        await finish(m.runId,m.discovered??s.discovered,m.type==='CV_FAILED'?[String(m.error||'Ошибка экспорта')]:[]);
        send({ok:true});
      }
    })().catch(e=>send({ok:false,error:String(e)}));return true;
  }
  return false;
});
// Re-create a lost alarm after a worker restart without resetting existing due dates.
void (async()=>{const a=await chrome.alarms.get(WEEKLY);if(!a)await reschedule();})().catch(()=>{});
