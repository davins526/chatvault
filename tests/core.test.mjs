import test from 'node:test';
import assert from 'node:assert/strict';
import {nextWeekly,DEFAULT_SETTINGS,safeSegment} from '../dist/model.js';
import {buildZip} from '../dist/zip.js';
test('Sunday 20:00 picks nearest next Sunday',()=>{
 const d=new Date(2026,10,1,18,0);const next=new Date(nextWeekly(d,DEFAULT_SETTINGS));
 assert.equal(next.getDay(),0);assert.equal(next.getHours(),20);assert.equal(next.getDate(),1);
});
test('Sunday 20:00 already passed picks next week',()=>{
 const d=new Date(2026,10,1,21,0);const next=new Date(nextWeekly(d,DEFAULT_SETTINGS));
 assert.equal(next.getDate(),8);
});
test('paths are sanitized',()=>{assert.equal(safeSegment('foo/bar?'), 'foo_bar_');});
test('ZIP signature and entries',async()=>{
 const b=buildZip([{name:'test.txt',data:new TextEncoder().encode('hello')},{name:'кириллица.json',data:new TextEncoder().encode('{}')}]);
 const a=new Uint8Array(await b.arrayBuffer());assert.equal(a[0],0x50);assert.equal(a[1],0x4b);assert.equal(a[2],3);assert.equal(a[3],4);
 assert.equal(new DataView(a.buffer).getUint32(a.length-22,true),0x06054b50);
});
