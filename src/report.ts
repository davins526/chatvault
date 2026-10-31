import type {Log} from './model.js';

export type DiagnosticReport = {
  version: string;
  createdAt: string;
  state: {status:string; notice:string; activeRunId:string|null; lastSuccessAt:number|null; nextDueAt:number|null; current:number; discovered:number|null; backoffUntil:number|null};
  diagnostics: {ok:boolean; code:string; message:string; at:string}|null;
  logs: Log[];
};

function redact(input:unknown):string {
  return String(input??'')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+/gi,'Bearer [REDACTED]')
    .replace(/(["']?accessToken["']?\s*[:=]\s*["']?)[^\s"',}]+/gi,'$1[REDACTED]')
    .replace(/(["']?sessionToken["']?\s*[:=]\s*["']?)[^\s"',}]+/gi,'$1[REDACTED]');
}
function stamp(ts:number|null):string {return ts?new Date(ts).toISOString():'none';}

/** Export only diagnostics and events, never conversation bodies, passwords or session tokens. */
export function formatDiagnosticReport(report:DiagnosticReport):string {
  const {version,createdAt,state,diagnostics,logs}=report;
  const output=[
    'ChatVault Diagnostic Report',
    'Version: '+redact(version),
    'Created: '+createdAt,
    'All times: ISO 8601 (UTC)',
    '',
    'Status: '+redact(state.status),
    'Notice: '+redact(state.notice),
    'Active run: '+(state.activeRunId?'yes':'no'),
    'Last successful backup: '+stamp(state.lastSuccessAt),
    'Next scheduled backup: '+stamp(state.nextDueAt),
    'Processed chats in current/last run: '+state.current,
    'Discovered chats: '+(state.discovered??'unknown'),
    'Backoff until: '+stamp(state.backoffUntil),
    '',
    'Connection diagnostics:',
    diagnostics?[
      '  Result: '+(diagnostics.ok?'ready':'unavailable'),
      '  Code: '+redact(diagnostics.code),
      '  Checked: '+redact(diagnostics.at),
      '  Details: '+redact(diagnostics.message)
    ].join('\n'):'  Not checked',
    '',
    'Event log ('+logs.length+' entries):'
  ];
  for(const entry of logs){
    output.push('['+redact(entry.time)+'] '+redact(entry.level).toUpperCase()+' '+redact(entry.message));
  }
  output.push('','Note: Report excludes conversation content and session credentials.','');
  return output.join('\n');
}
