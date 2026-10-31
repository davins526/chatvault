const $=(id:string)=>document.getElementById(id) as HTMLElement;
const time=(value:number|null|undefined)=>value?new Date(value).toLocaleString('ru-RU'):'нет';
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleString('ru-RU'):'нет';
const message=async(type:string,args:any={})=>chrome.runtime.sendMessage({type,...args});
function text(id:string,value:string){$(id).textContent=value;}
async function refresh():Promise<void>{
  try {
    const res=await message('CV_GET_STATUS');if(!res?.ok)throw Error(res?.error||'Не удалось получить состояние');
    const {settings,state,snapshot,logs,snapshotCount}=res;
    (document.getElementById('enabled') as HTMLInputElement).checked=settings.enabled;
    (document.getElementById('autoDownload') as HTMLInputElement).checked=settings.autoDownload;
    text('notice',state.notice||'Ожидание');
    text('count',String(snapshot?.entries?.length||0));
    text('versions',String(snapshotCount||0));
    text('changes',String(snapshot?.changed||0));
    text('last',time(state.lastSuccessAt));
    text('next',settings.enabled?time(state.nextDueAt):'выключено');
    const badge=$('badge');badge.className='pill '+(state.status==='complete'?'ok':/failed|partial|interrupted/.test(state.status)?'bad':'');
    badge.textContent=({'complete':'Сохранено','running':'Сбор…','partial':'Неполная','failed':'Ошибка','waiting-tab':'Ждёт вкладку','interrupted':'Прервано','idle':'Готово'} as any)[state.status]||state.status;
    ($('backup') as HTMLButtonElement).disabled=state.status==='running';
    ($('download') as HTMLButtonElement).disabled=!snapshot?.entries?.length;
    $('logs').replaceChildren(...(logs?.length?logs.map((l:any)=>{const div=document.createElement('div');div.textContent=`${date(l.time)} · ${l.level}: ${l.message}`;return div;}):[document.createTextNode('Пока нет событий')]));
  } catch(e){text('notice',String(e));}
}
async function updateOptions(){
  const enabled=(document.getElementById('enabled') as HTMLInputElement).checked;
  const autoDownload=(document.getElementById('autoDownload') as HTMLInputElement).checked;
  const response=await message('CV_SAVE_SETTINGS',{settings:{enabled,autoDownload,dayOfWeek:0,hour:20,minute:0}});
  if(!response?.ok)text('notice',response?.error||'Ошибка сохранения');await refresh();
}
$('enabled').addEventListener('change',()=>void updateOptions());
$('autoDownload').addEventListener('change',()=>void updateOptions());
$('backup').addEventListener('click',()=>void(async()=>{($('backup') as HTMLButtonElement).disabled=true;const r=await message('CV_BACKUP_NOW');text('notice',r.message||r.error||'Запрос отправлен');await refresh();})());
$('download').addEventListener('click',()=>void(async()=>{const r=await message('CV_EXPORT');text('notice',r?.ok?'ZIP передан браузеру для скачивания':r?.error||'Ошибка скачивания');})());
void refresh();setInterval(()=>void refresh(),4000);
