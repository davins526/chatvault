import test from 'node:test';
import assert from 'node:assert/strict';
import {latestDownloadableSnapshot,remainingCooldownSeconds,formatCountdown} from '../dist/backup-ui.js';
const snapshot=(id,createdAt,count,status)=>({id,createdAt,entries:Array.from({length:count},(_,i)=>({chatId:String(i),hash:'h'})),status});

test('HTTP 429 cooldown blocks until the server backoff expires',()=>{
 assert.equal(remainingCooldownSeconds(3601000,1000),3600);
 assert.equal(formatCountdown(3600),'01:00:00');
 assert.equal(remainingCooldownSeconds(3601000,3601000),0);
 assert.equal(remainingCooldownSeconds(null,1000),0);
});
test('a failed empty latest snapshot does not hide a previous partial ZIP',()=>{
 const previous=snapshot('partial','2026-11-01T00:00:00Z',2,'partial');
 const recent=snapshot('failed','2026-11-01T01:00:00Z',0,'partial');
 assert.equal(latestDownloadableSnapshot([previous,recent])?.id,'partial');
});
test('latest downloadable snapshot wins, never a currently running one',()=>{
 const a=snapshot('older','2026-11-01T00:00:00Z',1,'complete');
 const b=snapshot('newer','2026-11-01T01:00:00Z',3,'partial');
 const running=snapshot('running','2026-11-01T02:00:00Z',5,'running');
 assert.equal(latestDownloadableSnapshot([a,b,running])?.id,'newer');
 assert.equal(latestDownloadableSnapshot([running,snapshot('empty','2026-11-01T03:00:00Z',0,'failed')]),undefined);
});
