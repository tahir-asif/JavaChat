#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { registerUsers } from './lib/auth.mjs';
import { StompClient } from './lib/stomp.mjs';
import { makeResult, writeResult, makeRunId } from './lib/results.mjs';
import { sleep, summarize } from './lib/stats.mjs';

const { values } = parseArgs({
  options: {
    clients: { type: 'string', default: '200' },
    duration: { type: 'string', default: '180' },
    warmup: { type: 'string', default: '10' },
    rate: { type: 'string', default: '1' },
    'drain-timeout': { type: 'string', default: '30' }
  }
});

const clients = Number(values.clients);
const durationSec = Number(values.duration);
const warmupSec = Number(values.warmup);
const ratePerClientPerSec = Number(values.rate);
const drainTimeoutSec = Number(values['drain-timeout']);
const wsUrl = process.env.WS_URL ?? 'ws://localhost:8080/ws';

if (!Number.isInteger(clients) || clients < 2 || clients % 2 !== 0) {
  throw new Error('--clients must be an even integer >= 2');
}
if (!(durationSec > 0) || !(warmupSec >= 0) || !(ratePerClientPerSec > 0)) {
  throw new Error('--duration, --warmup, and --rate must be positive numbers');
}

const runId = `${makeRunId()}L`;

function aggregateStates(states) {
  return states.reduce(
    (total, state) => {
      total.sent += state.sent;
      total.accepted += state.accepted;
      total.deliveredTotal += state.delivered;
      total.uniqueDelivered += state.uniqueDelivered;
      total.duplicates += state.duplicates;
      total.orderViolations += state.orderViolations;
      total.publishErrors += state.publishErrors;
      total.missingIds += state.missingIds;
      return total;
    },
    {
      sent: 0,
      accepted: 0,
      deliveredTotal: 0,
      uniqueDelivered: 0,
      duplicates: 0,
      orderViolations: 0,
      publishErrors: 0,
      missingIds: 0
    }
  );
}

function handleMessage(state, body) {
  let payload;
  try {
    payload = JSON.parse(body.content);
  } catch {
    return;
  }

  if (payload.runId !== runId || payload.warmup) return;

  if (body.senderId === state.username) {
    state.accepted += 1;
    return;
  }

  if (body.senderId !== state.partner) return;

  state.delivered += 1;

  if (!body.id) {
    state.missingIds += 1;
    return;
  }

  if (state.seenPartnerIds.has(body.id)) {
    state.duplicates += 1;
    return;
  }

  state.seenPartnerIds.add(body.id);
  state.uniqueDelivered += 1;

  if (payload.seq <= state.lastPartnerSeq) {
    state.orderViolations += 1;
  } else {
    state.lastPartnerSeq = payload.seq;
  }

  if (Number.isFinite(payload.sentAt)) {
    state.latencies.push(Date.now() - payload.sentAt);
  }
}

let states = [];

try {
  console.log(
    `[load] run ${runId}: ${clients} clients, ${durationSec}s measurement, ` +
      `${warmupSec}s warmup, ${ratePerClientPerSec} msg/client/s`
  );

  const seedStarted = Date.now();
  const users = await registerUsers(clients, runId);
  console.log(`[load] registered ${users.length} users in ${((Date.now() - seedStarted) / 1000).toFixed(1)}s`);

  states = users.map((user, index) => {
    const partnerIndex = index % 2 === 0 ? index + 1 : index - 1;
    const state = {
      index,
      username: user.username,
      token: user.token,
      partner: users[partnerIndex].username,
      client: null,
      seq: 0,
      sent: 0,
      accepted: 0,
      delivered: 0,
      uniqueDelivered: 0,
      duplicates: 0,
      missingIds: 0,
      orderViolations: 0,
      lastPartnerSeq: 0,
      seenPartnerIds: new Set(),
      latencies: [],
      publishErrors: 0,
      nextSendAt: 0
    };
    state.client = new StompClient({
      url: wsUrl,
      token: state.token,
      onMessage: (body) => handleMessage(state, body)
    });
    return state;
  });

  const connectStarted = Date.now();
  let connected = 0;

  for (let index = 0; index < states.length; index += 20) {
    await Promise.all(
      states.slice(index, index + 20).map(async (state) => {
        await state.client.connect();
        connected += 1;
      })
    );
  }

  console.log(`[load] connected ${connected} clients in ${((Date.now() - connectStarted) / 1000).toFixed(1)}s`);

  const measureStart = Date.now();
  const warmupEnd = measureStart + warmupSec * 1000;
  const measureEnd = warmupEnd + durationSec * 1000;
  const intervalMs = 1000 / ratePerClientPerSec;

  states.forEach((state, index) => {
    state.nextSendAt = measureStart + (index * 1000) / clients;
  });

  let lastProgressAt = Date.now();

  while (Date.now() < measureEnd) {
    const now = Date.now();

    for (const state of states) {
      // Do not let a slow tick turn into a large catch-up burst.
      if (state.nextSendAt < now - intervalMs * 5) state.nextSendAt = now;

      while (state.nextSendAt <= now && state.nextSendAt < measureEnd) {
        const warmup = state.nextSendAt < warmupEnd;
        state.seq += 1;

        const payload = {
          runId,
          sender: state.username,
          seq: state.seq,
          sentAt: Date.now(),
          warmup
        };

        try {
          state.client.send(state.partner, JSON.stringify(payload));
          if (!warmup) state.sent += 1;
        } catch {
          state.publishErrors += 1;
        }

        state.nextSendAt += intervalMs;
      }
    }

    if (Date.now() - lastProgressAt >= 10000) {
      lastProgressAt = Date.now();
      const totals = aggregateStates(states);
      const latency = summarize(states.flatMap((state) => state.latencies));
      console.log(
        `[load] +${Math.round((Date.now() - measureStart) / 1000)}s ` +
          `sent=${totals.sent} delivered=${totals.uniqueDelivered} p95=${latency.p95 ?? 'n/a'}ms`
      );
    }

    await sleep(20);
  }

  const drainDeadline = Date.now() + drainTimeoutSec * 1000;
  let lastDrainProgress = -1;
  let lastDrainProgressAt = Date.now();

  while (Date.now() < drainDeadline) {
    const totals = aggregateStates(states);
    const progress = totals.uniqueDelivered + totals.accepted;

    if (progress !== lastDrainProgress) {
      lastDrainProgress = progress;
      lastDrainProgressAt = Date.now();
    }

    const settled = totals.uniqueDelivered >= totals.sent && totals.accepted >= totals.sent;
    if (settled && Date.now() - lastDrainProgressAt >= 1000) break;
    if (Date.now() - lastDrainProgressAt >= 5000) break;

    await sleep(200);
  }
} catch (error) {
  console.error('[load] failed:', error);
  await Promise.allSettled(states.map((state) => state.client?.disconnect()));
  process.exitCode = 1;
}

if (states.length > 0) {
  await Promise.allSettled(states.map((state) => state.client.disconnect()));

  const totals = aggregateStates(states);
  const latencies = states.flatMap((state) => state.latencies);
  const latencyMs = summarize(latencies);
  const lost = totals.sent - totals.uniqueDelivered;
  const acceptedGap = totals.sent - totals.accepted;
  const errorRatePct = totals.sent > 0 ? (lost / totals.sent) * 100 : 0;
  const throughputMsgPerSec = totals.uniqueDelivered / durationSec;
  const pass =
    totals.sent > 0 &&
    lost === 0 &&
    totals.duplicates === 0 &&
    totals.orderViolations === 0 &&
    totals.publishErrors === 0 &&
    acceptedGap === 0 &&
    totals.missingIds === 0;

  const result = makeResult({
    scenario: 'load',
    runId,
    parameters: {
      clients,
      pairs: clients / 2,
      durationSec,
      warmupSec,
      messagesPerClientPerSec: ratePerClientPerSec,
      burst: false
    },
    metrics: {
      sent: totals.sent,
      accepted: totals.accepted,
      delivered: totals.uniqueDelivered,
      deliveredTotal: totals.deliveredTotal,
      lost,
      duplicates: totals.duplicates,
      acceptedGap,
      perSenderOrderViolations: totals.orderViolations,
      publishErrors: totals.publishErrors,
      missingIds: totals.missingIds,
      errorRatePct: Math.round(errorRatePct * 100) / 100,
      throughputMsgPerSec: Math.round(throughputMsgPerSec * 100) / 100,
      latencyMs
    },
    pass
  });

  const file = writeResult(result);

  console.log(
    `[load] sent=${totals.sent} delivered=${totals.uniqueDelivered} lost=${lost} ` +
      `duplicates=${totals.duplicates} orderViolations=${totals.orderViolations}`
  );
  console.log(
    `[load] p50=${latencyMs.p50}ms p95=${latencyMs.p95}ms p99=${latencyMs.p99}ms ` +
      `max=${latencyMs.max}ms throughput=${throughputMsgPerSec.toFixed(2)} msg/s`
  );
  console.log(`[load] ${pass ? 'PASS' : 'FAIL'} -> ${file}`);

  if (!pass) process.exitCode = 1;
}
