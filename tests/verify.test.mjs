import test from 'node:test';
import assert from 'node:assert/strict';
import {hashRaw,verifyLocalSnapshot} from '../dist/verify.js';
const entry=(chatId,hash)=>({chatId,hash});
const snapshot=(entries,status='complete',discovered=entries.length)=>({id:'snapshot',status,entries,discovered});
const revision=async(chatId,raw)=>{
 const hash=await hashRaw(raw);
 return {key:chatId+':'+hash,chatId,hash,raw,savedAt:'2026-11-01T12:00:00Z'};
};
test('valid graph passes full SHA-256 verification',async()=>{
 const rev=await revision('id1',{mapping:{node:{message:{author:{role:'user'},content:{parts:['hello']}}}}});
 let calls=0;
 const result=await verifyLocalSnapshot(snapshot([entry('id1',rev.hash)]),async()=>{calls++;return rev;});
 assert.equal(result.ok,true);assert.equal(result.verified,1);assert.equal(calls,1);
});
test('missing revisions and duplicate entries are reported',async()=>{
 const rev=await revision('id1',{mapping:{}});
 const result=await verifyLocalSnapshot(snapshot([entry('id1',rev.hash),entry('id1',rev.hash),entry('id2','foo')]),async e=>e.chatId==='id1'?rev:undefined);
 assert.equal(result.ok,false);assert.equal(result.duplicated,1);assert.equal(result.missing,1);
});
test('payload modifications invalidate the saved hash',async()=>{
 const rev=await revision('id1',{mapping:{}});
 const result=await verifyLocalSnapshot(snapshot([entry('id1',rev.hash)]),async()=>({...rev,raw:{mapping:{changed:true}}}));
 assert.equal(result.ok,false);assert.equal(result.mismatched,1);
});
test('missing mapping is reported separately from a damaged checksum',async()=>{
 const rev=await revision('id1',{title:'No message graph'});
 const result=await verifyLocalSnapshot(snapshot([entry('id1',rev.hash)]),async()=>rev);
 assert.equal(result.ok,false);assert.equal(result.missingGraph,1);
});
test('partial but locally intact snapshots retain partial status',async()=>{
 const rev=await revision('id1',{mapping:{}});
 const result=await verifyLocalSnapshot(snapshot([entry('id1',rev.hash)],'partial',7),async()=>rev);
 assert.equal(result.ok,true);assert.equal(result.status,'partial');assert.equal(result.discovered,7);
});
