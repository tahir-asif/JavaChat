# Measurement Results

Measured on 2026-11-06 against commit `b015cbc` with `servicesDirty: false`.
The harness ran on the same host as the services over loopback. The working tree
also contained uncommitted README/plan files; the measured service code was clean.

## Environment

- **Host:** macOS Darwin 24.6.0, x86_64, Intel Core i9-9880H, 16 vCPU, 16 GB RAM
- **Runtime:** Node.js v22.23.4, OpenJDK 21.0.11, MongoDB 7.0 in Docker
- **Topology:** Node harness -> gateway `:8080` -> auth `:8081` / chat `:8082` -> MongoDB `:27017`
- **Services:** one instance of each; in-memory STOMP broker and in-memory presence
- **Frontend:** not involved in these measurements

## Load: 200 concurrent WebSocket clients

Parameters: 100 one-to-one pairs, 180-second measurement, 10-second warmup,
1 message per client per second. The sender's own queue echo is counted as
`accepted`, not `delivered`; only partner deliveries count as delivered.

| Run | Sent | Delivered | Lost | Duplicates | Order violations | p50 | p95 | p99 | Max | Throughput |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `20261106T211720ZL` | 35,998 | 35,998 | 0 | 0 | 0 | 4 ms | 5 ms | 5 ms | 13 ms | 199.99 msg/s |
| `20261106T212047ZL` | 36,000 | 36,000 | 0 | 0 | 0 | 4 ms | 5 ms | 5 ms | 13 ms | 200.00 msg/s |

Both runs also had `accepted == sent`, `publishErrors == 0`, `missingIds == 0`,
and 0% error rate. The two headline runs agree on p95.

## History: 1,000-message burst

Parameters: 1,000 messages from A to B, page size 50, 60-second receive timeout.

### Before the inbound-order fix

The first run (commit `12c8927`, with outbound publish order and the `_id`
tiebreaker already enabled) exposed that Spring's outbound ordering alone does
not order inbound handling:

- **732 live ordering violations**
- **181 persisted history ordering violations** on both sides
- 0 missing and 0 duplicate messages
- 812 adjacent pairs with equal-millisecond timestamps

### After enabling inbound receive order

With `StompEndpointRegistry.setPreserveReceiveOrder(true)` added (commit
`b015cbc`):

| Metric | A | B |
|---|---:|---:|
| Sent | 1,000 | 1,000 |
| Fetched | 1,000 | 1,000 |
| Missing | 0 | 0 |
| Duplicates | 0 | 0 |
| Timestamp order violations | 0 | 0 |
| Per-sender sequence order violations | 0 | 0 |
| Adjacent equal-millisecond pairs | 273 | 273 |

`bothSidesMatch = true`. Live delivery was 1,000/1,000 with 0 live duplicates
and 0 live ordering violations.

## What the measurements changed

- `WebSocketConfig` now enables both `MessageBrokerRegistry.setPreservePublishOrder(true)`
  and `StompEndpointRegistry.setPreserveReceiveOrder(true)`.
- `MessageRepository` now sorts by `timestamp DESC, _id DESC`, so page boundaries
  remain deterministic when timestamps tie.

## Reproduce

```bash
cd metrics
npm install
npm run stack:up

ulimit -n 4096
node src/history.mjs --total 1000 --page-size 50
node src/load.mjs --clients 200 --duration 180 --warmup 10 --rate 1
node src/load.mjs --clients 200 --duration 180 --warmup 10 --rate 1

npm run stack:down
```

`stack:up` resets the `authdb_metrics` and `chatdb_metrics` databases by default.
Set `RESET_DB=0` to preserve them. Raw result JSON is written under
`metrics/results/` (gitignored).

## Caveats

- Loopback latency is optimistic compared with a real network path.
- This is a single service instance with an in-memory broker and presence tracker;
  the results do not demonstrate horizontal scalability.
- The load generator runs on the same host as the services.
- These are synthetic clients, not production users or production capacity.
- Do not run the load test against the Render deployment.

## Candidate resume bullets

- Sustained **200 concurrent WebSocket clients** (100 one-to-one conversations)
  for **3 minutes** at **p95 5 ms** and **~200 msg/s**, with **0 lost, duplicated,
  or out-of-order messages** across 36,000 messages in two consecutive local runs.
- Burst-tested a **1,000-message conversation** and found **732 live and 181
  persisted ordering inversions** caused by concurrent STOMP handling; fixed with
  receive/publish order preservation and a deterministic `_id` pagination
  tiebreaker, then verified **0 missing, 0 duplicates, 0 ordering inversions** and
  identical histories for both participants.
