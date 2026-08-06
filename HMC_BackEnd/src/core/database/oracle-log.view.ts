/**
 * Self-contained HTML page for GET /diagnostics/oracle-logs/view. Renders the
 * Oracle call log as a filterable table by fetching the JSON list endpoint
 * (same controller, parent path). No build step / external assets.
 */
export const ORACLE_LOG_VIEW_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Oracle Call Logs</title>
<style>
  :root { font-family: system-ui, Segoe UI, Arial, sans-serif; }
  body { margin: 0; padding: 16px; background: #0f1420; color: #e6e9ef; }
  h1 { font-size: 18px; margin: 0 0 12px; }
  .filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
  .filters input, .filters select {
    background: #1a2130; color: #e6e9ef; border: 1px solid #2b3446; border-radius: 6px;
    padding: 6px 8px; font-size: 13px;
  }
  .filters button {
    background: #2d6cdf; color: #fff; border: 0; border-radius: 6px; padding: 7px 12px;
    font-size: 13px; cursor: pointer;
  }
  .filters button.ghost { background: #2b3446; }
  #meta { color: #9aa4b6; font-size: 12px; margin-left: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #222b3b; vertical-align: top; }
  th { position: sticky; top: 0; background: #161d2b; color: #9aa4b6; }
  tr.err td { background: rgba(220,60,60,0.10); }
  .pill { padding: 1px 7px; border-radius: 999px; font-size: 11px; }
  .pill.success { background: #14361f; color: #7ee2a2; }
  .pill.error { background: #3a1620; color: #ff8ea3; }
  .mono { font-family: ui-monospace, Consolas, monospace; white-space: pre-wrap; word-break: break-word; max-width: 460px; }
  .muted { color: #9aa4b6; }
</style>
</head>
<body>
  <h1>Oracle Call Logs</h1>
  <div class="filters">
    <input id="f-enum" placeholder="enum / username"/>
    <input id="f-correlationId" placeholder="correlationId"/>
    <input id="f-object" placeholder="object (e.g. PROFILE)"/>
    <input id="f-oraCode" placeholder="oraCode (e.g. 904)" style="width:130px"/>
    <select id="f-status">
      <option value="">status: all</option>
      <option value="error">error</option>
      <option value="success">success</option>
    </select>
    <input id="f-limit" type="number" placeholder="limit" value="100" style="width:80px"/>
    <button onclick="load()">Apply</button>
    <button class="ghost" onclick="reset()">Reset</button>
    <label class="muted"><input type="checkbox" id="f-auto"/> auto 5s</label>
    <button class="ghost" onclick="clearLogs()">Clear buffer</button>
    <span id="meta"></span>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>time</th><th>op</th><th>object</th><th>status</th><th>ms</th>
      <th>ORA</th><th>correlationId</th><th>request</th><th>binds</th><th>sql</th>
      <th>oracle response</th><th>error</th>
    </tr></thead>
    <tbody id="rows"></tbody>
  </table>

<script>
  var base = location.pathname.replace(/\\/view$/, "");
  var FIELDS = ["enum", "correlationId", "object", "oraCode", "status", "limit"];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function qs() {
    var p = new URLSearchParams();
    FIELDS.forEach(function (k) {
      var el = document.getElementById("f-" + k);
      if (el && el.value !== "") p.set(k, el.value.trim());
    });
    return p.toString();
  }
  function row(e) {
    var binds = Object.keys(e.binds || {}).map(function (k) { return k + "=" + e.binds[k]; }).join(", ");
    var response = "";
    try { response = e.response === undefined ? "" : JSON.stringify(e.response); } catch (ex) { response = String(e.response); }
    return "<tr class='" + (e.status === "error" ? "err" : "") + "'>"
      + "<td>" + esc(e.id) + "</td>"
      + "<td class='muted'>" + esc((e.timestamp || "").replace("T", " ").replace("Z", "")) + "</td>"
      + "<td>" + esc(e.op) + "</td>"
      + "<td>" + esc(e.object) + "</td>"
      + "<td><span class='pill " + esc(e.status) + "'>" + esc(e.status) + "</span></td>"
      + "<td>" + esc(e.durationMs) + "</td>"
      + "<td>" + esc(e.oraCode || "") + "</td>"
      + "<td class='muted'>" + esc(e.correlationId || "") + "</td>"
      + "<td class='muted'>" + esc(e.method || "") + " " + esc(e.path || "") + "</td>"
      + "<td class='mono'>" + esc(binds) + "</td>"
      + "<td class='mono'>" + esc(e.sql || "") + "</td>"
      + "<td class='mono'>" + esc(response) + "</td>"
      + "<td class='mono'>" + esc(e.error || "") + "</td>"
      + "</tr>";
  }
  function load() {
    fetch(base + "?" + qs(), { headers: { accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var d = (j && j.result) ? j.result : j;
        var items = d.items || [];
        document.getElementById("meta").textContent =
          "showing " + items.length + " of " + d.total + " matched";
        document.getElementById("rows").innerHTML =
          items.map(row).join("") || "<tr><td colspan='13' class='muted'>no matching logs</td></tr>";
      })
      .catch(function (err) {
        document.getElementById("meta").textContent = "load error: " + err;
      });
  }
  function reset() {
    FIELDS.forEach(function (k) {
      var el = document.getElementById("f-" + k);
      if (el) el.value = k === "limit" ? "100" : "";
    });
    load();
  }
  function clearLogs() {
    if (!confirm("Clear the in-memory Oracle log buffer?")) return;
    fetch(base, { method: "DELETE" }).then(function () { load(); });
  }
  var timer = null;
  document.getElementById("f-auto").addEventListener("change", function (ev) {
    if (ev.target.checked) { timer = setInterval(load, 5000); }
    else if (timer) { clearInterval(timer); timer = null; }
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Enter") load(); });
  load();
</script>
</body>
</html>`;
