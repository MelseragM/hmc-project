---
name: session-metrics
description: >-
  Install, verify, repair, and report on automatic coding-session metrics for
  Claude Code — per-response wall-clock time and lines of code, written one
  record per response to .claude/metrics/session-log.jsonl by Claude Code hooks
  this skill manages (the model does not self-log). Use this skill whenever the
  user wants to set up or fix logging of their own Claude Code response time and
  LOC, asks how much code they wrote or how long their Claude responses took
  today/this week, wants LOC-per-session, LOC-per-day, average Claude response
  time, or weekly coding trends from their session log, mentions session-metrics,
  or asks to aggregate or analyze session-log.jsonl. Do NOT use for application
  or API performance, production endpoint latency, test or build timing, git
  commit counts, code-coverage, or static line-counting tools like cloc or tokei
  — those are unrelated to Claude Code session logging.
---

# session-metrics

Build a usage dataset over time — one record per Claude response — capturing how
long each response took and how many lines of code it produced, so metrics like
average response time, LOC/day, LOC/session, and weekly trends can be computed
later.

## The one thing to understand first

A **skill cannot reliably log after every response, and the model cannot measure
its own wall-clock time or exact LOC.** Skills are *model-invoked* — Claude
consults a skill only when a task benefits from it — so they are the wrong tool
for "run on every turn, silently." The reliable mechanism in Claude Code is
**hooks**: shell commands Claude Code runs deterministically at fixed lifecycle
points. This skill therefore splits responsibilities:

- **Hooks do the capture** (deterministic, every turn). Three scripts in
  `hooks/` are wired into `.claude/settings.json`.
- **This skill is the control surface** (model-invoked, on demand). When the user
  asks to set up, verify, repair, or report on metrics, follow the instructions
  below.

Do **not** put these hooks in skill frontmatter: a skill's `Stop` hook is
converted to `SubagentStop` and only runs while the skill is active, so it would
miss normal turns. They must live in settings.

## How automatic logging works (the hooks)

| Hook event | Script | Role |
| :-- | :-- | :-- |
| `UserPromptSubmit` | `hooks/metrics-start.js` | Records the turn's start time (machine clock) and resets the per-turn accumulator. |
| `PostToolUse` (matcher `Write\|Edit\|MultiEdit\|NotebookEdit`) | `hooks/metrics-track.js` | After each file edit, appends one event line with approximate added/removed lines for that file. |
| `Stop` | `hooks/metrics-finish.js` | When the response finishes, computes duration, aggregates LOC, classifies the task, and appends one entry to `session-log.jsonl`. Clears the turn's pending state. |

The accumulator is **append-only** (`pending/<session>.events.jsonl`): parallel
tool calls trigger parallel `PostToolUse` hooks, and appending small lines avoids
the lost-update races a read-modify-write file would have. The scripts print
nothing and always exit 0, so they never block, interrupt, or extend a response.

## Honest limitations — state these, do not hide them

- **Timing is wall-clock, not model compute time.** `duration_seconds` is the
  gap between `UserPromptSubmit` and `Stop` on the user's machine clock. It is
  the most reliable signal available, but it **includes** time the turn spent
  waiting on permission prompts or user approvals. It is not "tokens" or pure
  inference time.
- **LOC is an approximation, not a VCS diff.** Added/removed lines come from the
  `Write`/`Edit` tool inputs via a line-level LCS (so unchanged context inside an
  edit is not counted). It does **not** run `git diff`.
- **Overwriting an existing file with `Write`** counts the whole new file as
  "added" (the prior contents are not available at `PostToolUse`).
- **`Edit` with `replace_all`** is counted as a single occurrence.
- **Code not written through the edit tools is not counted** — e.g. files created
  by a `Bash` heredoc, code generated then discarded, or edits made outside
  Claude Code.
- **Interrupted turns are not logged.** `Stop` fires on natural completion, not
  on user interrupt.
- **Scope.** By default each project keeps its own log under
  `.claude/metrics/`. To collect one dataset across all projects, set the env var
  `SESSION_METRICS_DIR` to a fixed path before launching Claude Code.

When asked for a true line-by-line diff, suggest a `git`-based cross-check rather
than implying these numbers are exact.

## Storage format

**Format: JSON Lines (`.jsonl`), one record per response.** Chosen over a single
JSON array because each turn is a single atomic `>>` append — no need to read,
parse, and rewrite the whole file every time — and a corrupt final line never
breaks earlier records. Aggregation streams the file line by line.

Path: `.claude/metrics/session-log.jsonl` (or `$SESSION_METRICS_DIR/session-log.jsonl`).

### Schema (one object per line)

| Field | Type | Notes |
| :-- | :-- | :-- |
| `schema_version` | number | Currently `1`. |
| `timestamp_start` | string | ISO 8601 with timezone offset; captured at `UserPromptSubmit`. |
| `timestamp_end` | string | ISO 8601 with timezone offset; captured at `Stop`. |
| `duration_seconds` | number\|null | Wall-clock response time. `null` if start time was unavailable. |
| `session_id` | string | Claude Code session id; groups responses into a session. |
| `task_label` | string | Auto-classified: `feature`, `bugfix`, `refactor`, `test`, `docs`, or `""` (blank for manual tagging). |
| `loc` | object | `{ added, removed, net, changed }` (numbers). `net = added - removed`, `changed = added + removed`. |
| `files` | array | Per-file breakdown: `[{ path, added, removed }]`. Paths are repo-relative where possible. |
| `file_count` | number | Distinct files touched. |
| `tool_edits` | number | Count of Write/Edit operations in the response. |
| `cwd` | string | Working directory of the turn. |

`task_label` is a keyword heuristic on the prompt and is meant to be corrected by
hand when wrong — edit the field, or leave classification off and tag manually.

### Example entry (one line, pretty-printed here for readability)

```json
{
  "schema_version": 1,
  "timestamp_start": "2026-06-21T09:14:03+03:00",
  "timestamp_end": "2026-06-21T09:15:48+03:00",
  "duration_seconds": 105,
  "session_id": "a4d2c8f1e0b3a297",
  "task_label": "feature",
  "loc": { "added": 142, "removed": 17, "net": 125, "changed": 159 },
  "files": [
    { "path": "src/api/auth.js", "added": 120, "removed": 5 },
    { "path": "src/routes.js", "added": 22, "removed": 12 }
  ],
  "file_count": 2,
  "tool_edits": 5,
  "cwd": "/Users/you/projects/middleware"
}
```

## Setup (run when the user asks to install/enable metrics)

Editing `settings.json` is a configuration change — confirm with the user before
writing, then:

1. Place this skill folder at `.claude/skills/session-metrics/` (project, shared
   with the repo) or `~/.claude/skills/session-metrics/` (personal, all projects).
2. Run the installer from the skill folder:
   ```bash
   node scripts/install.js           # project scope  -> .claude/settings.json
   node scripts/install.js --global  # user scope      -> ~/.claude/settings.json
   ```
   It merges the three hooks (preserving any existing hooks), creates
   `.claude/metrics/` with a starter `session-log.jsonl`, and is idempotent.
3. Tell the user to **restart Claude Code** (or run `/hooks`) so the hooks load,
   then verify with `/hooks` that `UserPromptSubmit`, `PostToolUse`, and `Stop`
   each list a `metrics-*` handler.

Manual alternative: merge the `hooks` block from `settings.hooks.json` into
`.claude/settings.json` yourself.

To verify it is recording, after a coding turn check that
`.claude/metrics/session-log.jsonl` gained a line and `.claude/metrics/pending/`
is empty.

## Reporting (run when the user asks about their metrics)

Run the aggregator and present the result:

```bash
node scripts/aggregate.js                         # default log path
node scripts/aggregate.js path/to/session-log.jsonl
node scripts/aggregate.js --json                  # machine-readable
```

It reports totals (responses, sessions, active days, LOC added/removed/net),
average and median response time, net LOC per response / per session / per active
day, a weekly trend table, and a per-task-label breakdown.

Quick one-liners (no script needed), if `jq` is available:

```bash
# total net lines of code logged
jq -s 'map(.loc.net) | add' .claude/metrics/session-log.jsonl

# average response time in seconds
jq -s 'map(.duration_seconds) | add/length' .claude/metrics/session-log.jsonl

# responses per day
jq -r '.timestamp_start[0:10]' .claude/metrics/session-log.jsonl | sort | uniq -c
```

## Runtime routing for Claude

When this skill triggers, identify intent and act:

- **"set up / enable / install / start tracking"** → run the Setup steps (ask
  before editing settings.json; remind to restart Claude Code).
- **"is it working / verify / why no data"** → read `.claude/settings.json` hooks,
  check the log and `pending/` dir, and report what is or isn't wired. Common
  cause of no data: Claude Code was not restarted after install.
- **"how much / report / trends / average"** → run `scripts/aggregate.js` and
  summarize; offer `--json` for raw figures.
- **"is this exact / can I trust the LOC"** → explain the limitations above and
  offer a `git`-based cross-check.

Keep the metrics themselves accurate and never overstate precision.
