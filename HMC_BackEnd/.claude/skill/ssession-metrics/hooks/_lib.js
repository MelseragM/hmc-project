'use strict';
/*
 * session-metrics — shared helpers for the hook scripts.
 * Pure Node built-ins only (Claude Code ships with Node, so no extra deps).
 * Nothing here is allowed to throw out to the caller: hooks must never
 * disrupt a turn, so callers wrap everything in try/catch and always exit 0.
 */
const fs = require('fs');
const path = require('path');

/** Read the full JSON payload Claude Code sends on stdin. Returns {} on failure. */
function readInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8'); // fd 0 = stdin
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

/** Project root for path placeholders / fallbacks. */
function projectDir(data) {
  return process.env.CLAUDE_PROJECT_DIR || (data && data.cwd) || process.cwd();
}

/**
 * Where the log + pending state live.
 * Set SESSION_METRICS_DIR to collect one dataset across every project;
 * otherwise each project keeps its own log under .claude/metrics.
 */
function metricsDir(data) {
  if (process.env.SESSION_METRICS_DIR) return process.env.SESSION_METRICS_DIR;
  return path.join(projectDir(data), '.claude', 'metrics');
}

function pendingDir(data) {
  return path.join(metricsDir(data), 'pending');
}

function safeSession(id) {
  return String(id || 'unknown').replace(/[^A-Za-z0-9_.-]/g, '_');
}

/** ISO 8601 timestamp using the machine's local UTC offset, e.g. 2026-06-21T09:14:03+03:00 */
function localISO(d) {
  d = d || new Date();
  const pad = (n, l) => String(Math.abs(n)).padStart(l || 2, '0');
  const off = -d.getTimezoneOffset(); // minutes east of UTC
  const sign = off >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(off) / 60));
  const om = pad(Math.abs(off) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${oh}:${om}`;
}

/** Split text into lines, ignoring a single trailing newline. */
function splitLines(s) {
  if (!s) return [];
  const a = String(s).split('\n');
  if (a.length && a[a.length - 1] === '') a.pop();
  return a;
}

/** Length of the longest common subsequence of two arrays of lines (rolling DP). */
function lcsLen(a, b) {
  const n = a.length, m = b.length;
  let prev = new Array(m + 1).fill(0);
  let curr = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1] + 1
        : Math.max(prev[j], curr[j - 1]);
    }
    const t = prev; prev = curr; curr = t;
    curr.fill(0);
  }
  return prev[m];
}

/**
 * Approximate added/removed *lines* for one edit (old -> new).
 * Uses a line-level LCS so unchanged context inside an edit is not counted.
 * This is a documented approximation, not a true VCS diff. Large inputs fall
 * back to a coarse count to stay fast.
 */
function lineDelta(oldStr, newStr) {
  const a = splitLines(oldStr);
  const b = splitLines(newStr);
  if (a.length === 0) return { added: b.length, removed: 0 };
  if (b.length === 0) return { added: 0, removed: a.length };
  if (a.length > 4000 || b.length > 4000) {
    return { added: b.length, removed: a.length }; // coarse fallback
  }
  const l = lcsLen(a, b);
  return { added: b.length - l, removed: a.length - l };
}

/** Best-effort, repo-relative path for readability; absolute if outside the project. */
function relPath(file, data) {
  if (!file) return '';
  try {
    if (path.isAbsolute(file)) {
      const rel = path.relative(projectDir(data), file);
      if (rel && !rel.startsWith('..')) return rel;
    }
  } catch (_) { /* ignore */ }
  return file;
}

/** Heuristic task label from the prompt text. Returns '' for manual tagging. */
function classifyTask(prompt) {
  const p = String(prompt || '').toLowerCase();
  if (/\b(fix|bug|broken|crash|regress|hotfix|defect|stack ?trace|exception)\b/.test(p)) return 'bugfix';
  if (/\b(refactor|clean ?up|rename|restructure|simplify|extract|deduplicate|tidy)\b/.test(p)) return 'refactor';
  if (/\b(test|spec|coverage|unit ?test|integration ?test|e2e)\b/.test(p)) return 'test';
  if (/\b(doc|docs|readme|comment|document|docstring|changelog)\b/.test(p)) return 'docs';
  if (/\b(add|implement|create|build|feature|introduce|scaffold|generate)\b/.test(p)) return 'feature';
  return '';
}

module.exports = {
  readInput, projectDir, metricsDir, pendingDir, safeSession,
  localISO, splitLines, lineDelta, relPath, classifyTask
};
