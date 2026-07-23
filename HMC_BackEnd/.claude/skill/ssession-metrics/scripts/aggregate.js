#!/usr/bin/env node
'use strict';
/*
 * aggregate.js — turn session-log.jsonl into metrics.
 *
 * Usage:
 *   node scripts/aggregate.js [path/to/session-log.jsonl] [--json]
 *
 * Default log path: $SESSION_METRICS_DIR/session-log.jsonl,
 * else ./.claude/metrics/session-log.jsonl
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const explicit = args.find(a => !a.startsWith('--'));
const logFile = explicit
  || (process.env.SESSION_METRICS_DIR
      ? path.join(process.env.SESSION_METRICS_DIR, 'session-log.jsonl')
      : path.join(process.cwd(), '.claude', 'metrics', 'session-log.jsonl'));

if (!fs.existsSync(logFile)) {
  console.error('No log found at ' + logFile);
  process.exit(1);
}

const rows = fs.readFileSync(logFile, 'utf8').split('\n')
  .filter(l => l.trim())
  .map(l => { try { return JSON.parse(l); } catch (_) { return null; } })
  .filter(Boolean);

if (rows.length === 0) {
  console.error('Log is empty: ' + logFile);
  process.exit(1);
}

const dayOf = r => (r.timestamp_start || '').slice(0, 10);
const isoWeek = (d) => {
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return 'unknown';
  const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};
const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sum = xs => xs.reduce((a, b) => a + b, 0);

const durations = rows.map(r => r.duration_seconds).filter(n => typeof n === 'number');
const addedTot = sum(rows.map(r => (r.loc && r.loc.added) || 0));
const removedTot = sum(rows.map(r => (r.loc && r.loc.removed) || 0));
const netTot = sum(rows.map(r => (r.loc && r.loc.net) || 0));
const sessions = new Set(rows.map(r => r.session_id));

const byKey = (keyFn) => {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    const o = m.get(k) || { responses: 0, net: 0, sessions: new Set() };
    o.responses++;
    o.net += (r.loc && r.loc.net) || 0;
    o.sessions.add(r.session_id);
    m.set(k, o);
  }
  return m;
};
const byDay = byKey(dayOf);
const byWeek = byKey(r => isoWeek(dayOf(r)));
const byLabel = byKey(r => r.task_label || '(untagged)');
const bySession = byKey(r => r.session_id);

const days = [...byDay.keys()].filter(Boolean).sort();
const summary = {
  log_file: logFile,
  date_range: days.length ? { from: days[0], to: days[days.length - 1] } : null,
  totals: {
    responses: rows.length,
    sessions: sessions.size,
    days_active: days.length,
    loc_added: addedTot,
    loc_removed: removedTot,
    loc_net: netTot
  },
  response_time_seconds: {
    average: durations.length ? Math.round(sum(durations) / durations.length) : null,
    median: durations.length ? median(durations) : null,
    max: durations.length ? Math.max(...durations) : null
  },
  averages: {
    loc_net_per_response: Math.round(netTot / rows.length),
    loc_net_per_session: Math.round(netTot / Math.max(1, sessions.size)),
    loc_net_per_active_day: days.length ? Math.round(netTot / days.length) : null
  }
};

if (asJson) {
  const obj = (m) => Object.fromEntries([...m].map(([k, v]) =>
    [k, { responses: v.responses, net: v.net, sessions: v.sessions.size }]));
  console.log(JSON.stringify({
    summary,
    by_day: obj(byDay),
    by_week: obj(byWeek),
    by_label: obj(byLabel),
    by_session: obj(bySession)
  }, null, 2));
  process.exit(0);
}

const fmt = n => (n === null || n === undefined ? 'n/a' : String(n));
const line = '─'.repeat(56);
console.log(line);
console.log(' session-metrics summary');
console.log(line);
if (summary.date_range) console.log(` range          ${summary.date_range.from} -> ${summary.date_range.to}`);
console.log(` responses      ${summary.totals.responses}`);
console.log(` sessions       ${summary.totals.sessions}`);
console.log(` active days    ${summary.totals.days_active}`);
console.log(` LOC added      ${summary.totals.loc_added}`);
console.log(` LOC removed    ${summary.totals.loc_removed}`);
console.log(` LOC net        ${summary.totals.loc_net}`);
console.log(line);
console.log(` avg resp time  ${fmt(summary.response_time_seconds.average)} s`);
console.log(` median resp    ${fmt(summary.response_time_seconds.median)} s`);
console.log(` net LOC / response  ${summary.averages.loc_net_per_response}`);
console.log(` net LOC / session   ${summary.averages.loc_net_per_session}`);
console.log(` net LOC / day       ${fmt(summary.averages.loc_net_per_active_day)}`);
console.log(line);
console.log(' by week (responses | net LOC | sessions)');
for (const w of [...byWeek.keys()].sort()) {
  const v = byWeek.get(w);
  console.log(`  ${w}   ${String(v.responses).padStart(4)} | ${String(v.net).padStart(7)} | ${v.sessions.size}`);
}
console.log(line);
console.log(' by task label (responses | net LOC)');
for (const k of [...byLabel.keys()].sort()) {
  const v = byLabel.get(k);
  console.log(`  ${k.padEnd(12)} ${String(v.responses).padStart(4)} | ${String(v.net).padStart(7)}`);
}
console.log(line);
