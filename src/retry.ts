/** Before v0.1.2, transient transport failures could set a one-hour cooldown. */
export function isRateLimitError(message:string|null|undefined):boolean {
  return /\b429\b|лимит запросов|rate.limit(?:ed|ing)?/i.test(message||'');
}
export function shouldClearLegacyCooldown(until:number|null,now:number,latestError:string|null|undefined):boolean {
  if(until===null)return false;
  return until<=now || !isRateLimitError(latestError);
}
