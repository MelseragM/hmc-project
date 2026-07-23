#!/usr/bin/env node
'use strict';
/*
 * install.js — wire the session-metrics hooks into Claude Code settings.
 *
 * Usage:
 *   node scripts/install.js            # project scope  -> .claude/settings.json
 *   node scripts/install.js --global   # user scope     -> ~/.claude/settings.json
 *
 * What it does (idempotent):
 *   1. Adds/updates UserPromptSubmit, PostToolUse, Stop hook handlers that call
 *      this skill's hook scripts. Existing unrelated hooks are preserved.
 *   2. Creates .claude/metrics/ with a starter session-log.jsonl and a
 *      pending/.gitignore.
 *
 * NOTE: editing settings.json is a configuration change. Review the diff and
 * restart Claude Code (or run /hooks) afterwards to load the hooks.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const skillRoot = path.resolve(__dirname, '..');
const hooksDir = path.join(skillRoot, 'hooks');
const global = process.argv.includes('--global');

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const settingsPath = global
  ? path.join(os.homedir(), '.claude', 'settings.json')
  : path.join(projectDir, '.claude', 'settings.json');

// Reference the scripts with the ${CLAUDE_PROJECT_DIR} placeholder when the
// skill lives inside the project (portable across machines/checkouts);
// otherwise fall back to an absolute path (personal/global skill install).
function scriptArg(name) {
  const abs = path.join(hooksDir, name);
  const rel = path.relative(projectDir, abs);
  if (!global && !rel.startsWith('..')) {
    return '${CLAUDE_PROJECT_DIR}/' + rel.split(path.sep).join('/');
  }
  return abs;
}

const handler = (name) => ({ type: 'command', command: 'node', args: [scriptArg(name)] });
const isOurs = (h) => h && h.type === 'command' && Array.isArray(h.args) &&
  h.args.some(a => typeof a === 'string' && a.includes('hooks/metrics-'));

// Load existing settings (preserve everything we don't own).
let settings = {};
if (fs.existsSync(settingsPath)) {
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
  catch (e) { console.error('Could not parse ' + settingsPath + ': ' + e.message); process.exit(1); }
}
settings.hooks = settings.hooks || {};

// Merge one event, stripping any prior session-metrics handlers first.
function mergeEvent(event, group) {
  const existing = (settings.hooks[event] || []).filter(g =>
    !(g.hooks || []).some(isOurs));
  settings.hooks[event] = existing.concat([group]);
}

mergeEvent('UserPromptSubmit', { hooks: [handler('metrics-start.js')] });
mergeEvent('PostToolUse', { matcher: 'Write|Edit|MultiEdit|NotebookEdit', hooks: [handler('metrics-track.js')] });
mergeEvent('Stop', { hooks: [handler('metrics-finish.js')] });

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

// Set up the metrics directory (always project-local unless overridden by env).
const metricsDir = process.env.SESSION_METRICS_DIR || path.join(projectDir, '.claude', 'metrics');
fs.mkdirSync(path.join(metricsDir, 'pending'), { recursive: true });
const logFile = path.join(metricsDir, 'session-log.jsonl');
if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, '');
const gi = path.join(metricsDir, 'pending', '.gitignore');
if (!fs.existsSync(gi)) fs.writeFileSync(gi, '*\n');

console.log('Installed session-metrics hooks into ' + settingsPath);
console.log('Metrics directory: ' + metricsDir);
console.log('Hook scripts:       ' + hooksDir);
console.log('\nNext: restart Claude Code (or run /hooks to verify), then start coding.');
