# Server agent

Sends this server's status to the dashboard's Servers tab every minute: CPU, RAM, temperature, network,
the disks listed in `mounts` (with RAID state from `/proc/mdstat` and SMART per physical disk) and the
Docker containers with their published ports. Outbound HTTPS only: no open port, no VPN needed.

    cp config.example.json config.json   # id, name, order, dashboardUrl, reportToken, mounts
    sudo docker compose up -d --build
    sudo docker compose logs -f          # errors only; silent when reports go through

Check what it would send: `sudo docker compose run --rm agent node agent.mjs --once`.

| config | |
|---|---|
| `id` | lowercase letters, digits and `-`; one per server |
| `name` / `order` | title on the Servers tab and its position (lower first) |
| `dashboardUrl` | the dashboard's URL (`http://127.0.0.1:<HOST_PORT>` on the server that runs it) |
| `reportToken` | the dashboard's `REPORT_TOKEN` |
| `mounts` | mount points to show, e.g. `["/", "/mnt/raid1"]` |
| `smart` | `false` to skip SMART (e.g. on cloud VMs without real disks) |
| `ignoreContainers` | containers to leave out of the report, by name as `docker ps` or the tab shows it (compose's `-1` dropped), e.g. `["radarr", "sonarr", "server-agent-agent"]` (default `[]`) |

The container is privileged (SMART), uses the host network and PID namespace, mounts the Docker socket and
reads the host's files through `/proc/1/root`: treat it as root on the host. The `:ro` on the socket does
not limit the Docker API (anyone who can talk to it controls Docker). The agent itself only reads: it lists
containers, reads `/proc`, `/sys` and `statfs`, and runs `smartctl -n standby` (no wake-ups), with SMART
read at most every 15 minutes per disk. A sleeping disk keeps its last reading for up to 24 h; a disk that
answered before and stops answering shows as "sem resposta" (dark card). Logs are capped at 3 x 1 MB.
