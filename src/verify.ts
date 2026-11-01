import type {Entry, Revision, Snapshot} from './model.js';

export type LocalVerification={
  snapshotId:string;status:Snapshot['status'];entries:number;discovered:number|null;
  verified:number;missing:number;mismatched:number;missingGraph:number;duplicated:number;ok:boolean;
};

/** Local-only SHA-256 verification. Does not check a downloaded ZIP or contact ChatGPT. */
export async function hashRaw(raw:unknown):Promise<string>{
  const serialized=JSON.stringify(raw);
  if(typeof serialized!=='string')throw Error('Unserializable conversation JSON');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function verifyLocalSnapshot(
  snapshot:Snapshot, loadRevision:(entry:Entry)=>Promise<Revision|undefined>
):Promise<LocalVerification>{
  const result:LocalVerification={snapshotId:snapshot.id,status:snapshot.status,
    entries:snapshot.entries.length,discovered:snapshot.discovered,
    verified:0,missing:0,mismatched:0,missingGraph:0,duplicated:0,ok:false};
  const seen=new Set<string>();
  for(const entry of snapshot.entries){
    if(!entry?.chatId || !entry.hash || seen.has(entry.chatId)){result.duplicated++;continue;}
    seen.add(entry.chatId);
    let rev:Revision|undefined;
    try{rev=await loadRevision(entry);}catch{result.missing++;continue;}
    if(!rev){result.missing++;continue;}
    if(rev.chatId!==entry.chatId||rev.hash!==entry.hash){result.mismatched++;continue;}
    try{
      if(await hashRaw(rev.raw)!==entry.hash){result.mismatched++;continue;}
    }catch{result.mismatched++;continue;}
    const raw=rev.raw as any;
    if(!raw||typeof raw!=='object'||!raw.mapping||typeof raw.mapping!=='object'||Array.isArray(raw.mapping)){
      result.missingGraph++;continue;
    }
    result.verified++;
  }
  result.ok=result.entries>0&&result.verified===result.entries&&
    result.missing===0&&result.mismatched===0&&result.missingGraph===0&&result.duplicated===0;
  return result;
}
