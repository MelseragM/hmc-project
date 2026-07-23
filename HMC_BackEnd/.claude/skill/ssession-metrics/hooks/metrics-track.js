#!/usr/bin/env node
'use strict';
/*
 * metrics-track.js  —  bound to the PostToolUse hook event
 *                      with matcher "Write|Edit|MultiEdit|NotebookEdit".
 * Fires after each successful file-editing tool call. Computes approximate
 * added/removed lines and APPENDS one event line per edit to the turn's
 * pending events file.
 *
 * Append-only is deliberate: parallel tool calls produce parallel PostToolUse
 * hooks, and appending small (<4 KB) lines avoids the lost-update races a
 * read-modify-write JSON file would have. Prints nothing; always exits 0.
 */
const fs = require('fs');
const path = require('path');
const L = require('./_lib.js');

try {
  const data = L.readInput();
  const tn = data.tool_name;
  const ti = data.tool_input || {};

  // Normalise every supported tool into a list of {file, oldStr, newStr}.
  const edits = [];
  if (tn === 'Write') {
    // Note: on overwrite of an existing file the prior contents are not
    // available at PostToolUse, so the whole new file counts as "added".
    edits.push({ file: ti.file_path, oldStr: '', newStr: ti.content || '' });
  } else if (tn === 'Edit') {
    edits.push({ file: ti.file_path, oldStr: ti.old_string || '', newStr: ti.new_string || '' });
  } else if (tn === 'MultiEdit' && Array.isArray(ti.edits)) {
    for (const e of ti.edits) {
      edits.push({ file: ti.file_path, oldStr: e.old_string || '', newStr: e.new_string || '' });
    }
  } else if (tn === 'NotebookEdit') {
    edits.push({ file: ti.notebook_path, oldStr: '', newStr: ti.new_source || '' });
  } else {
    process.exit(0); // not a tool we measure
  }

  const dir = L.pendingDir(data);
  fs.mkdirSync(dir, { recursive: true });
  const sid = L.safeSession(data.session_id);
  const eventsFile = path.join(dir, sid + '.events.jsonl');

  let buffer = '';
  for (const e of edits) {
    const d = L.lineDelta(e.oldStr, e.newStr);
    const ev = {
      ts: L.localISO(new Date()),
      tool: tn,
      file: L.relPath(e.file, data),
      added: d.added,
      removed: d.removed
    };
    buffer += JSON.stringify(ev) + '\n';
  }
  if (buffer) fs.appendFileSync(eventsFile, buffer);
} catch (_) {
  // Never disrupt the turn.
}
process.exit(0);
