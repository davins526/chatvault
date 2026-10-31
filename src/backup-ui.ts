import type {Snapshot} from './model.js';

/** A previous partial/complete snapshot is still downloadable even if the latest attempt saved 0 chats. */
export function latestDownloadableSnapshot(snapshots:readonly Snapshot[]):Snapshot|undefined{
  return snapshots
    .filter(snapshot=>snapshot.status!=='running' && snapshot.entries.length>0)
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
}

/** Remaining delay in seconds. Uses absolute server cooldown; never shortens it. */
export function remainingCooldownSeconds(backoffUntil:number|null|undefined,now:number):number{
  if(!backoffUntil||!Number.isFinite(backoffUntil))return 0;
  return Math.max(0,Math.ceil((backoffUntil-now)/1000));
}

/** Remaining time in the UI; output is stable and timezone-independent. */
export function formatCountdown(seconds:number):string{
  const s=Math.max(0,Math.floor(seconds));
  const hours=Math.floor(s/3600);
  const minutes=Math.floor((s%3600)/60);
  const secs=s%60;
  return [hours,minutes,secs].map(n=>String(n).padStart(2,'0')).join(':');
}
