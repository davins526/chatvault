import type { ChatRecord, Revision, Snapshot, Log } from './model.js';
const DB_NAME = 'chatvault-local';
const DB_VERSION = 1;
export const STORE = {chats:'chats', revisions:'revisions', snapshots:'snapshots', logs:'logs'} as const;
export async function openVault(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE.chats)) db.createObjectStore(STORE.chats, {keyPath:'id'});
      if (!db.objectStoreNames.contains(STORE.revisions)) db.createObjectStore(STORE.revisions, {keyPath:'key'});
      if (!db.objectStoreNames.contains(STORE.snapshots)) db.createObjectStore(STORE.snapshots, {keyPath:'id'});
      if (!db.objectStoreNames.contains(STORE.logs)) db.createObjectStore(STORE.logs, {autoIncrement:true});
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {req.onsuccess = () => resolve(req.result);req.onerror = () => reject(req.error);});
}
function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Transaction aborted'));});
}
export async function readOne<T>(store: string, key: IDBValidKey): Promise<T|undefined> {
  const db=await openVault();const tx=db.transaction(store,'readonly');const p=request<T|undefined>(tx.objectStore(store).get(key));const value=await p;db.close();return value;
}
export async function readAll<T>(store: string): Promise<T[]> {
  const db=await openVault();const tx=db.transaction(store,'readonly');const values=await request<T[]>(tx.objectStore(store).getAll());db.close();return values;
}
export async function putOne(store: string, value: unknown): Promise<void> {
  const db=await openVault();const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);await finished(tx);db.close();
}
export async function addLog(level: Log['level'], message: string): Promise<void> {
  const db=await openVault();const tx=db.transaction(STORE.logs,'readwrite');tx.objectStore(STORE.logs).add({time:new Date().toISOString(),level,message} satisfies Log);await finished(tx);db.close();
}
export async function startSnapshot(id: string): Promise<void> {
  await putOne(STORE.snapshots, {id,createdAt:new Date().toISOString(),status:'running',scope:'all',entries:[],discovered:null,added:0,changed:0,unchanged:0,errors:[],missingAttachments:0,source:'experimental ChatGPT internal API'} satisfies Snapshot);
}
function attachmentRefs(data:any): number {
  if (!data?.mapping || typeof data.mapping!=='object') return 0;
  let count=0;
  for (const node of Object.values<any>(data.mapping)) {
    count+=(node?.message?.metadata?.attachments || []).length;
    count+=(node?.message?.content?.parts||[]).filter((p:any)=>p?.content_type==='image_asset_pointer').length;
  }
  return count;
}
export async function appendChat(runId: string, input: {id:string,title:string,projectId:string|null,updatedAt:string|null,raw:unknown}):Promise<void> {
  // Keep the entire accessible conversation graph, not just the selected message branch.
  const serialized=JSON.stringify(input.raw);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized));
  const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  const now=new Date().toISOString();
  const db=await openVault();const tx=db.transaction([STORE.chats,STORE.revisions,STORE.snapshots],'readwrite');
  const chats=tx.objectStore(STORE.chats), revisions=tx.objectStore(STORE.revisions), snapshots=tx.objectStore(STORE.snapshots);
  const old=await request<ChatRecord|undefined>(chats.get(input.id));
  const snapshot=await request<Snapshot|undefined>(snapshots.get(runId));
  if(!snapshot || snapshot.status!=='running') {tx.abort();db.close();throw Error('Backup run was interrupted');}
  const exists=snapshot.entries.some(e=>e.chatId===input.id);
  if(!exists) {
    const key=`${input.id}:${hash}`;
    if(!old || old.hash!==hash) revisions.put({key,chatId:input.id,hash,savedAt:now,raw:input.raw} satisfies Revision);
    chats.put({id:input.id,title:input.title,projectId:input.projectId,updatedAt:input.updatedAt,hash,lastSeenAt:now} satisfies ChatRecord);
    snapshot.entries.push({chatId:input.id,hash});
    if(!old) snapshot.added++;
    else if(old.hash===hash) snapshot.unchanged++;
    else snapshot.changed++;
    snapshot.missingAttachments+=attachmentRefs(input.raw);
    snapshots.put(snapshot);
  }
  await finished(tx);db.close();
}
export async function finalizeSnapshot(runId: string, discovered: number|null, errors: string[]): Promise<Snapshot> {
  const db=await openVault();const tx=db.transaction(STORE.snapshots,'readwrite');const os=tx.objectStore(STORE.snapshots);
  const s=await request<Snapshot|undefined>(os.get(runId));if(!s){tx.abort();db.close();throw Error('Unknown run');}
  s.finishedAt=new Date().toISOString();s.discovered=discovered;s.errors=errors;
  s.status=errors.length?'partial':'complete';
  os.put(s);await finished(tx);db.close();return s;
}
export async function recentSnapshot(): Promise<Snapshot|undefined> {
  const a=await readAll<Snapshot>(STORE.snapshots);return a.sort((x,y)=>y.createdAt.localeCompare(x.createdAt))[0];
}
