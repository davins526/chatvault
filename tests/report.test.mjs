import test from 'node:test';
import assert from 'node:assert/strict';
import {formatDiagnosticReport} from '../dist/report.js';
test('diagnostic report contains saved events and state without chat payloads',()=>{
 const r=formatDiagnosticReport({
  version:'0.1.6',createdAt:'2026-11-01T00:00:00.000Z',
  state:{status:'failed',notice:'Not connected',activeRunId:null,lastSuccessAt:null,nextDueAt:null,current:0,discovered:null,backoffUntil:null},
  diagnostics:{ok:false,code:'NO_CHATGPT_TAB',message:'No tab',at:'2026-11-01T00:00:00.000Z'},
  logs:[{time:'2026-11-01T00:01:00.000Z',level:'error',message:'Unable to collect'}]
 });
 assert.match(r,/0\.1\.6/);
 assert.match(r,/NO_CHATGPT_TAB/);
 assert.match(r,/Unable to collect/);
 assert.match(r,/Event log \(1 entries\)/);
 assert.doesNotMatch(r,/conversation\.raw\.json/);
});
test('report redacts bearer and access tokens',()=>{
 const r=formatDiagnosticReport({
  version:'0.1.6',createdAt:'2026-11-01T00:00:00.000Z',
  state:{status:'failed',notice:'Bearer secret.token',activeRunId:null,lastSuccessAt:null,nextDueAt:null,current:0,discovered:null,backoffUntil:null},
  diagnostics:null,
  logs:[{time:'2026-11-01T00:01:00.000Z',level:'error',message:'accessToken:abc123; Bearer another.token'}]
 });
 assert.doesNotMatch(r,/secret\.token|another\.token|abc123/);
 assert.match(r,/\[REDACTED\]/);
});
