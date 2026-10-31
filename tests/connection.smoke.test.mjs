import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
test('content script registers a ping receiver without using API',()=>{
  const code=readFileSync(resolve(root,'dist/content.js'),'utf8');
  let handler;
  let calledFetch=false;
  const context=createContext({
    chrome:{runtime:{onMessage:{addListener(fn){handler=fn;}}}},
    fetch(){calledFetch=true;throw Error('Unexpected API call')},
    setTimeout,
    Headers,
    Error
  });
  new Script(code,{filename:'dist/content.js'}).runInContext(context);
  assert.equal(typeof handler,'function');
  let result;
  handler({type:'CV_PING'},null,x=>result=x);
  assert.equal(result.ok,true);
  assert.equal(result.ready,true);
  assert.equal(calledFetch,false);
});
test('manifest declares all three icon assets and scripting permission',()=>{
  const manifest=JSON.parse(readFileSync(resolve(root,'dist/manifest.json'),'utf8'));
  assert.ok(manifest.permissions.includes('scripting'));
  for(const size of [16,48,128]){
    const path=resolve(root,'dist',manifest.icons[String(size)]);
    const png=readFileSync(path);
    assert.equal(png.readUInt32BE(16),size);
    assert.equal(png.readUInt32BE(20),size);
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  }
});
test('diagnostics and status have dedicated message handlers',()=>{
  const background=readFileSync(resolve(root,'dist/background.js'),'utf8');
  const popup=readFileSync(resolve(root,'dist/popup.html'),'utf8');
  assert.match(background,/CV_DIAGNOSE/);
  assert.match(background,/COLLECTOR_READY/);
  assert.match(popup,/id="diagnose"/);
  assert.match(popup,/id="diagnosticResult"/);
});
