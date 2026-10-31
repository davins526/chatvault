import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../dist/content.js',import.meta.url),'utf8');
const respond=(data,status=200,headers={})=>({ok:status>=200&&status<300,status,headers:{get:k=>headers[k]||null},json:async()=>data});
async function run({links=[],path='/c/test',routes={}}={}){
 const messages=[],requests=[],handlers=[];let finish;
 const completed=new Promise(resolve=>finish=resolve);
 const chrome={runtime:{onMessage:{addListener(fn){handlers.push(fn)}},async sendMessage(msg){messages.push(msg);if(['CV_DONE','CV_FAILED'].includes(msg.type))finish(msg);return {ok:true}}}};
 const env={chrome,console,location:{pathname:path},document:{querySelectorAll(){return links.map(href=>({getAttribute:()=>href}))}},setTimeout(fn){fn()},fetch:async url=>{requests.push(url);if(url==='/api/auth/session')return respond({accessToken:'test-only'});if(!routes[url])throw Error('Unexpected '+url);return routes[url]}};
 vm.runInNewContext(script,env);
 handlers[0]({type:'CV_COLLECT',runId:'test'},null,()=>{});
 const result=await Promise.race([completed,new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),1500))]);
 return {result,messages,requests};
}
test('project and general lists are merged and deduplicated',async()=>{
 const routes={
  '/backend-api/gizmos/g-p-abc/conversations?cursor=0':respond({items:[{id:'A'},{id:'B'}]}),
  '/backend-api/conversations?offset=0&limit=100&order=updated':respond({items:[{id:'A'},{id:'C'}],total:2}),
  '/backend-api/conversation/A':respond({mapping:{}}),
  '/backend-api/conversation/B':respond({mapping:{}}),
  '/backend-api/conversation/C':respond({mapping:{}})
 };
 const r=await run({links:['/g/g-p-abc/example'],routes});
 assert.equal(r.result.type,'CV_DONE');
 assert.equal(r.result.discovered,3);
 assert.equal(r.messages.filter(x=>x.type==='CV_ITEM').length,3);
 assert.equal(r.messages.find(x=>x.type==='CV_ITEM'&&x.item.id==='B').item.projectId,'g-p-abc');
});
test('project cursor pagination handles multiple pages',async()=>{
 const routes={
  '/backend-api/gizmos/g-p-abc/conversations?cursor=0':respond({items:[{id:'A'}],cursor:'next/1'}),
  '/backend-api/gizmos/g-p-abc/conversations?cursor=next%2F1':respond({items:[{id:'B'}]}),
  '/backend-api/conversations?offset=0&limit=100&order=updated':respond({items:[],total:0}),
  '/backend-api/conversation/A':respond({mapping:{}}),
  '/backend-api/conversation/B':respond({mapping:{}})
 };
 const r=await run({path:'/g/g-p-abc/conversation',routes});
 assert.equal(r.result.type,'CV_DONE');assert.equal(r.result.discovered,2);
});
test('429 stops without retrying',async()=>{
 const url='/backend-api/conversations?offset=0&limit=100&order=updated';
 const r=await run({routes:{[url]:respond({},429,{'retry-after':'60'})}});
 assert.equal(r.result.type,'CV_FAILED');assert.match(r.result.error,/429/);
 assert.equal(r.requests.filter(x=>x===url).length,1);
});
test('zero chat result cannot be treated as success',async()=>{
 const url='/backend-api/conversations?offset=0&limit=100&order=updated';
 const r=await run({routes:{[url]:respond({items:[],total:0})}});
 assert.equal(r.result.type,'CV_FAILED');assert.match(r.result.error,/Найдено 0/);
});
