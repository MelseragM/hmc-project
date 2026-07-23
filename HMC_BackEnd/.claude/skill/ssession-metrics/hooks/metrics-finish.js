#!/usr/bin/env node
'use strict';
/*
 * metrics-finish.js  —  bound to the Stop hook event.
 * Fires once per turn when Claude finishes responding (not on user interrupt).
 * Aggregates the turn's start time + LOC events into a single log entry and
 * appends it to session-log.jsonl, then clears the turn's pending state.
 *
 * CRITICAL: this hook must never block. Exit 2 on a Stop hook forces Claude to
 * keep going, so we swallow every error and ALWAYS exit 0. We also print
 * nothing (no additionalContext) so the response is never extended.
 */
const fs = require('fs');
const path = require('path');
const L = require('./_lib.js');

try {
  const data = L.readInput();
  const dir = L.pendingDir(data);
  const sid = L.safeSession(data.session_id);
  const startFile = path.join(dir, sid + '.start.json');
  const eventsFile = path.join(dir, sid + '.events.jsonl');

  // No start record => nothing to log (e.g. logging enabled mid-turn).
  if (!fs.existsSync(startFile)) process.exit(0);
  const start = JSON.parse(fs.readFileSync(startFile, 'utf8'));

  // Aggregate per-file and total LOC from the appended events.
  const perFile = new Map();
  let added = 0, removed = 0, toolEdits = 0;
  if (fs.existsSync(eventsFile)) {
    const lines = fs.readFileSync(eventsFile, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch (_) { continue; }
      toolEdits++;
      added += ev.added || 0;
      removed += ev.removed || 0;
      const key = ev.file || '(unknown)';
      const f = perFile.get(key) || { path: key, added: 0, removed: 0 };
      f.added += ev.added || 0;
      f.removed += ev.removed || 0;
      perFile.set(key, f);
    }
  }

  const end = new Date();
  let durationSeconds = null;
  if (typeof start.start_ms === 'number') {
    durationSeconds = Math.max(0, Math.round((end.getTime() - start.start_ms) / 1000));
  }

  const files = Array.from(perFile.values());
  const entry = {
    schema_version: 1,
    timestamp_start: start.start_iso || null,
    timestamp_end: L.localISO(end),
    duration_seconds: durationSeconds,
    session_id: start.session_id || data.session_id || 'unknown',
    task_label: L.classifyTask(start.prompt),
    loc: { added, removed, net: added - removed, changed: added + removed },
    files,
    file_count: files.length,
    tool_edits: toolEdits,
    cwd: start.cwd || L.projectDir(data)
  };

  const logFile = path.join(L.metricsDir(data), 'session-log.jsonl');
  fs.mkdirSync(L.metricsDir(data), { recursive: true });
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');

  // Clean up the turn's pending state.
  try { fs.unlinkSync(startFile); } catch (_) {}
  try { fs.unlinkSync(eventsFile); } catch (_) {}
} catch (_) {
  // Never block the stop.
}
process.exit(0);
