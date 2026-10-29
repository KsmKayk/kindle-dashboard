# Claude reporter

Sends Claude usage to the dashboard's Work tab every 5 minutes: the **5-hour session** and **weekly**
limits (from the endpoint Claude Code uses for `/usage`) and **tokens per day** from Claude Code's logs
(`~/.claude/projects/**/*.jsonl`). Runs on the Windows PC that uses Claude Code; plain Node, no packages.

1. `copy config.example.json config.json` and fill in the dashboard URL and the server's `REPORT_TOKEN`.
2. Try it once: `node report.mjs` (prints `sent N days, limits ok`).
3. Install the scheduled task: `powershell -ExecutionPolicy Bypass -File install.ps1`.

Notes
- It reads the login token Claude Code keeps in `~/.claude/.credentials.json` and never refreshes it. When
  that token has expired (PC woke up with Claude Code closed), the report goes out without limits and the
  dashboard keeps the last ones, labelled with their time.
- The `/usage` endpoint is undocumented and may change; tokens keep working if it does.
- `state.json` remembers how far each log was read; delete it to recount the last 35 days.
