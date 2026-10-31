const $=(id:string)=>document.getElementById(id) as HTMLElement;
const time=(value:number|null|undefined)=>value?new Date(value).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'нет';
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleString('ru-RU'):'нет';
const message=async(type:string,args:any={})=>chrome.runtime.sendMessage({type,...args});
function text(id:string,value:string){$(id).textContent=value;}
let currentView='home';
function showView(view:string){
  if(!['home','journal','settings'].includes(view))return;
  currentView=view;
  for(const name of ['home','journal','settings'])$('view-'+name).hidden=view!==name;
  for(const node of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-view]'))){
    node.setAttribute('aria-pressed',String(node.dataset.view===view));
  }
  window.scrollTo(0,0);
}
function applyTheme(theme:'dark'|'light'){
  document.documentElement.dataset.theme=theme;
  ($('themeDark') as HTMLInputElement).checked=theme==='dark';
  ($('themeLight') as HTMLInputElement).checked=theme==='light';
}
function shortStatus(status:string,notice:string):string {
  if(status==='complete')return 'Копия создана. Подробности в журнале.';
  if(status==='running')return notice||'Сбор переписок…';
  if(status==='waiting-tab')return 'Откройте ChatGPT, чтобы начать резервирование.';
  if(status==='interrupted')return 'Копирование прервано. Данные предыдущих копий сохранены.';
  if(status==='failed'||status==='partial')return 'Последняя попытка не удалась. Откройте журнал.';
  return 'Готово к резервному копированию.';
}
async function refresh():Promise<void>{
  try{
    const res=await message('CV_GET_STATUS');
    if(!res?.ok)throw Error(res?.error||'Не удалось получить состояние');
    const {settings,state,snapshot,logs,snapshotCount,diagnostics}=res;
    if(document.activeElement!==$('enabled'))($('enabled') as HTMLInputElement).checked=!!settings.enabled;
    if(document.activeElement!==$('autoDownload'))($('autoDownload') as HTMLInputElement).checked=!!settings.autoDownload;
    const input=$('startDate') as HTMLInputElement;
    if(document.activeElement!==input)input.value=settings.startDate||'';
    applyTheme(settings.theme==='light'?'light':'dark');
    text('scheduleInfo',settings.startDate?'Каждые 7 дней от выбранной даты · 20:00':'По умолчанию: воскресенье, 20:00');
    text('notice',shortStatus(state.status,state.notice));
    text('count',String(snapshot?.entries?.length||0));
    text('versions',String(snapshotCount||0));
    text('changes',String(snapshot?.changed||0));
    text('last',time(state.lastSuccessAt));
    text('next',settings.enabled?time(state.nextDueAt):'Выключено');
    const badge=$('badge');
    badge.className='pill '+(state.status==='complete'?'ok':/failed|partial|interrupted/.test(state.status)?'bad':'');
    badge.textContent=({complete:'Сохранено',running:'Сбор…',partial:'Неполная',failed:'Ошибка','waiting-tab':'Ждёт вкладку',interrupted:'Прервано',idle:'Готово'} as Record<string,string>)[state.status]||state.status;
    ($('backup') as HTMLButtonElement).disabled=state.status==='running';
    ($('download') as HTMLButtonElement).disabled=!snapshot?.entries?.length;
    text('connectionSummary',diagnostics?(diagnostics.ok?'Связь с ChatGPT: есть':'Связь с ChatGPT: ошибка'):'Связь не проверена');
    text('diagnosticCode',diagnostics?diagnostics.code:'Не проверено');
    text('diagnosticResult',diagnostics?(date(diagnostics.at)+' · '+diagnostics.message):'Диагностика не запускалась.');
    const items=logs?.length?logs.map((l:any)=>{
      const div=document.createElement('div');
      div.className='log';
      const meta=document.createElement('div');
      meta.className='logtime';
      meta.textContent=date(l.time)+' · '+String(l.level||'info');
      const body=document.createElement('div');
      body.textContent=String(l.message||'');
      div.append(meta,body);
      return div;
    }):[document.createTextNode('Пока нет событий')];
    $('logs').replaceChildren(...items);
  }catch(e){text('notice','Не удалось обновить состояние: '+String(e));}
}
async function updateOptions():Promise<void>{
  const enabled=($('enabled') as HTMLInputElement).checked;
  const autoDownload=($('autoDownload') as HTMLInputElement).checked;
  const startDate=($('startDate') as HTMLInputElement).value||null;
  const theme=($('themeLight') as HTMLInputElement).checked?'light':'dark';
  const r=await message('CV_SAVE_SETTINGS',{settings:{enabled,autoDownload,startDate,theme}});
  text('settingsMessage',r?.ok?'Настройки сохранены':r?.error||'Не удалось сохранить настройки');
  await refresh();
}
for(const node of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-view]')))
  node.addEventListener('click',()=>showView(node.dataset.view||'home'));
for(const node of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-back]')))
  node.addEventListener('click',()=>showView(node.dataset.back||'home'));
$('showJournal').addEventListener('click',()=>showView('journal'));
$('enabled').addEventListener('change',()=>void updateOptions());
$('autoDownload').addEventListener('change',()=>void updateOptions());
$('startDate').addEventListener('change',()=>void updateOptions());
$('themeDark').addEventListener('change',()=>{applyTheme('dark');void updateOptions();});
$('themeLight').addEventListener('change',()=>{applyTheme('light');void updateOptions();});
$('diagnose').addEventListener('click',()=>void(async()=>{
  ($('diagnose') as HTMLButtonElement).disabled=true;
  text('diagnosticResult','Проверка связи…');
  try{const r=await message('CV_DIAGNOSE');text('diagnosticResult',r?.message||r?.error||'Нет ответа');}
  catch(e){text('diagnosticResult',String(e));}
  finally{($('diagnose') as HTMLButtonElement).disabled=false;await refresh();}
})());
$('backup').addEventListener('click',()=>void(async()=>{
  ($('backup') as HTMLButtonElement).disabled=true;
  try{
    const r=await message('CV_BACKUP_NOW');
    if(!r?.ok)text('notice',r?.message||r?.error||'Ошибка запуска');
  }catch(e){text('notice','Ошибка запуска: '+String(e));}
  finally{await refresh();}
})());
$('download').addEventListener('click',()=>void(async()=>{
  try{
    const r=await message('CV_EXPORT');
    text('notice',r?.ok?'ZIP передан в загрузки браузера':r?.error||'Ошибка скачивания');
  }catch(e){text('notice',String(e));}
})());
showView(currentView);
void refresh();
setInterval(()=>void refresh(),5000);
