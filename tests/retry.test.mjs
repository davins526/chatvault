import test from 'node:test';
import assert from 'node:assert/strict';
import {isRateLimitError,shouldClearLegacyCooldown} from '../dist/retry.js';
test('connection failure is not rate limit',()=>{
 const error='Не удалось запустить сбор: Error: Could not establish connection. Receiving end does not exist.';
 assert.equal(isRateLimitError(error),false);
 assert.equal(shouldClearLegacyCooldown(2000,1000,error),true);
});
test('HTTP 429 is preserved until its retry time',()=>{
 const error='[general list] 429: сервер ограничил запросы. Retry-After: 60';
 assert.equal(isRateLimitError(error),true);
 assert.equal(shouldClearLegacyCooldown(2000,1000,error),false);
});
test('expired cooldown is cleared regardless of cause',()=>{
 assert.equal(shouldClearLegacyCooldown(1000,2000,'429: rate limited'),true);
});
test('null cooldown needs no migration',()=>{
 assert.equal(shouldClearLegacyCooldown(null,2000,null),false);
});
