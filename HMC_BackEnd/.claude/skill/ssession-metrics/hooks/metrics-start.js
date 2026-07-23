#!/usr/bin/env node
'use strict';
/*
 * metrics-start.js  —  bound to the UserPromptSubmit hook event.
 * Fires once per turn, the moment the user submits a prompt.
 * Records the wall-clock start time and starts a fresh accumulator for the turn.
 *
 * MUST print nothing to stdout: UserPromptSubmit stdout is injected into Claude's
 * context. We exit 0 silently so the turn is never altered.
 */
const fs = require('fs');
const path = require('path');
const L = require('./_lib.js');

try {
  const data = L.readInput();
  const dir = L.pendingDir(data);
  fs.mkdirSync(dir, { recursive: true });

  const sid = L.safeSession(data.session_id);

  // Clear any stale events from an interrupted previous turn so LOC is
  // attributed only to the turn that is starting now.
  try { fs.unlinkSync(path.join(dir, sid + '.events.jsonl')); } catch (_) {}

  const now = new Date();
  const rec = {
    start_iso: L.localISO(now),
    start_ms: now.getTime(),
    session_id: data.session_id || 'unknown',
    cwd: data.cwd || L.projectDir(data),
    prompt: typeof data.prompt === 'string' ? data.prompt.slice(0, 2000) : ''
  };
  fs.writeFileSync(path.join(dir, sid + '.start.json'), JSON.stringify(rec));
} catch (_) {
  // Never disrupt the turn.
}
process.exit(0);
