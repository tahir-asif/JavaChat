# Measurement Harness

Latest results: [RESULTS.md](./RESULTS.md).

Two reproducible measurements for the JavaChat real-time path:

- **Load** — connection count, delivery latency, loss, duplicates, ordering, throughput.
- **History** — paginated history completeness, ordering, and both-participant consistency.

These are local synthetic measurements. They are not a capacity test of the production
Render deployment.

## Prerequisites

- Node.js 22+
- Java 17+
- Docker with Compose
- `curl`, `openssl`, and `lsof` on `PATH`

## Start and stop the local stack

From the repository root:

```bash
cd metrics
npm install

npm run stack:up
# ... run measurements ...
npm run stack:down
```

`stack:up` starts MongoDB with `mongodb://localhost:27017` and starts
`auth-service`, `chat-service`, and `api-gateway` with a per-run `JWT_SECRET`.
It uses the `authdb_metrics` and `chatdb_metrics` databases so development data
is untouched. The metrics databases are dropped on each start by default; set
`RESET_DB=0` to preserve them.

If a service fails to start, inspect the logs under `metrics/results/`.

## Load measurement

```bash
# Smoke test
npm run smoke

# Headline run: 200 clients for 3 minutes
npm run measure:load -- --clients 200 --duration 180 --warmup 10 --rate 1
```

Options: `--clients` (even), `--duration` (seconds), `--warmup` (seconds),
`--rate` (messages per client per second), `--drain-timeout` (seconds).

For 200 clients, raise the file-descriptor limit first:

```bash
ulimit -n 4096
```

The harness treats the sender's own queue echo as an acknowledgement and only
counts partner deliveries as delivered messages. Results are written to
`metrics/results/load-<runId>.json`.

## History measurement

```bash
npm run measure:history -- --total 1000 --page-size 50
```

The test sends messages from user A to user B, verifies live arrival order, then
fetches every page from both users and checks completeness, duplicates, ordering,
and that both participants see the same message set. Results are written to
`metrics/results/history-<runId>.json`.

## Caveats

- Loopback measurements are optimistic compared with real network latency.
- The chat service is a single instance with an in-memory STOMP broker and
  in-memory presence, so these results do not demonstrate horizontal scalability.
- The load generator runs on the same host as the services.
- `gitDirty` in each result records whether the working tree had uncommitted
  changes when the result was written.
- Do not load-test the production Render deployment.
