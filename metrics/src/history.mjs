#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { registerUsers } from './lib/auth.mjs';
import { StompClient } from './lib/stomp.mjs';
import { makeResult, writeResult, makeRunId } from './lib/results.mjs';
import { sleep } from './lib/stats.mjs';

const { values } = parseArgs({
  options: {
    total: { type: 'string', default: '1000' },
    'page-size': { type: 'string', default: '50' },
    'receive-timeout': { type: 'string', default: '60000' }
  }
});

const total = Number(values.total);
const pageSize = Number(values['page-size']);
const receiveTimeoutMs = Number(values['receive-timeout']);
const gatewayUrl = process.env.GATEWAY_URL ?? 'http://localhost:8080';
const wsUrl = process.env.WS_URL ?? 'ws://localhost:8080/ws';

if (!Number.isInteger(total) || total < 1) throw new Error('--total must be a positive integer');
if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('--page-size must be a positive integer');

const runId = `${makeRunId()}H`;

function parseInstantMs(value) {
  const match = String(value).match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/
  );
  if (!match) return Date.parse(value);
  const fraction = (match[2] ?? '').padEnd(3, '0').slice(0, 3);
  return Date.parse(`${match[1]}.${fraction}${match[3]}`);
}

function duplicateCount(items) {
  const seen = new Set();
  let duplicates = 0;
  for (const item of items) {
    if (seen.has(item.id)) duplicates += 1;
    else seen.add(item.id);
  }
  return duplicates;
}

function analyzeHistory(items) {
  let timestampOrderViolations = 0;
  let seqOrderViolations = 0;
  let tiePairs = 0;
  let previousTimestamp = -Infinity;
  let previousSeq = -Infinity;

  for (const item of items) {
    const timestamp = parseInstantMs(item.timestamp);
    if (Number.isFinite(timestamp)) {
      if (timestamp < previousTimestamp) timestampOrderViolations += 1;
      if (timestamp === previousTimestamp) tiePairs += 1;
      previousTimestamp = timestamp;
    }

    let payload;
    try {
      payload = JSON.parse(item.content);
    } catch {
      continue;
    }

    if (typeof payload.seq === 'number') {
      if (payload.seq <= previousSeq) seqOrderViolations += 1;
      previousSeq = payload.seq;
    }
  }

  return {
    count: items.length,
    duplicateCount: duplicateCount(items),
    timestampOrderViolations,
    seqOrderViolations,
    tiePairs
  };
}

async function fetchAll(token, otherUser) {
  const items = [];
  const maxPages = Math.ceil(total / pageSize) + 10;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetch(
      `${gatewayUrl}/api/messages/${encodeURIComponent(otherUser)}?size=${pageSize}&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      throw new Error(`history fetch failed: HTTP ${response.status}`);
    }

    const batch = await response.json();
    items.push(...batch);
    if (batch.length < pageSize) break;
  }

  return items;
}

let aClient;
let bClient;

try {
  console.log(`[history] run ${runId}: ${total} messages, page size ${pageSize}`);

  const [a, b] = await registerUsers(2, runId);

  const received = [];
  const seenIds = new Set();
  let liveDuplicates = 0;
  let liveOrderViolations = 0;
  let lastSeq = 0;
  let aEchoes = 0;
  let aEchoDuplicates = 0;
  const aSeenEchoIds = new Set();

  aClient = new StompClient({
    url: wsUrl,
    token: a.token,
    onMessage: (body) => {
      if (body.senderId !== a.username) return;

      let payload;
      try {
        payload = JSON.parse(body.content);
      } catch {
        return;
      }
      if (payload.runId !== runId) return;

      aEchoes += 1;
      if (aSeenEchoIds.has(body.id)) aEchoDuplicates += 1;
      else aSeenEchoIds.add(body.id);
    }
  });

  bClient = new StompClient({
    url: wsUrl,
    token: b.token,
    onMessage: (body) => {
      if (body.senderId !== a.username) return;

      let payload;
      try {
        payload = JSON.parse(body.content);
      } catch {
        return;
      }
      if (payload.runId !== runId) return;

      if (seenIds.has(body.id)) {
        liveDuplicates += 1;
        return;
      }
      seenIds.add(body.id);

      if (payload.seq <= lastSeq) liveOrderViolations += 1;
      else lastSeq = payload.seq;

      received.push({
        id: body.id,
        seq: payload.seq,
        timestamp: body.timestamp,
        receivedAt: Date.now()
      });
    }
  });

  await Promise.all([aClient.connect(), bClient.connect()]);
  console.log('[history] connected both users');

  for (let start = 0; start < total; start += 50) {
    const end = Math.min(start + 50, total);
    for (let index = start; index < end; index += 1) {
      const seq = index + 1;
      aClient.send(
        b.username,
        JSON.stringify({ runId, sender: a.username, seq, sentAt: Date.now() })
      );
    }

    if (aClient.bufferedAmount > 512_000) {
      const deadline = Date.now() + 5000;
      while (aClient.bufferedAmount > 128_000 && Date.now() < deadline) {
        await sleep(10);
      }
    }

    await sleep(2);
  }

  console.log(`[history] sent ${total} messages; waiting for delivery`);

  const receiveDeadline = Date.now() + receiveTimeoutMs;
  while (Date.now() < receiveDeadline) {
    if (received.length >= total && aEchoes >= total) break;
    await sleep(100);
  }

  const receiveTimedOut = received.length < total || aEchoes < total;
  console.log(
    `[history] received=${received.length} echoes=${aEchoes}` +
      (receiveTimedOut ? ' (timed out)' : '')
  );

  const aHistoryNewestFirst = await fetchAll(a.token, b.username);
  const bHistoryNewestFirst = await fetchAll(b.token, a.username);
  const aHistory = [...aHistoryNewestFirst].reverse();
  const bHistory = [...bHistoryNewestFirst].reverse();

  const aAnalysis = analyzeHistory(aHistory);
  const bAnalysis = analyzeHistory(bHistory);
  const aIds = new Set(aHistory.map((item) => item.id));
  const bIds = new Set(bHistory.map((item) => item.id));
  const bothSidesMatch =
    aIds.size === bIds.size && [...aIds].every((id) => bIds.has(id));

  const missingA = Math.max(0, total - aHistory.length);
  const missingB = Math.max(0, total - bHistory.length);
  const extraA = Math.max(0, aHistory.length - total);
  const extraB = Math.max(0, bHistory.length - total);
  const liveMissing = Math.max(0, total - received.length);
  const echoMissing = Math.max(0, total - aEchoes);

  const pass =
    aHistory.length === total &&
    bHistory.length === total &&
    aAnalysis.duplicateCount === 0 &&
    bAnalysis.duplicateCount === 0 &&
    bothSidesMatch &&
    aAnalysis.timestampOrderViolations === 0 &&
    aAnalysis.seqOrderViolations === 0 &&
    bAnalysis.timestampOrderViolations === 0 &&
    bAnalysis.seqOrderViolations === 0 &&
    liveOrderViolations === 0 &&
    liveDuplicates === 0 &&
    aEchoDuplicates === 0 &&
    received.length === total &&
    aEchoes === total &&
    !receiveTimedOut;

  const result = makeResult({
    scenario: 'history',
    runId,
    parameters: {
      sent: total,
      pageSize,
      receiveTimeoutMs
    },
    metrics: {
      sent: total,
      fetchedA: aHistory.length,
      fetchedB: bHistory.length,
      missingA,
      missingB,
      extraA,
      extraB,
      duplicatesA: aAnalysis.duplicateCount,
      duplicatesB: bAnalysis.duplicateCount,
      bothSidesMatch,
      liveDeliveredB: received.length,
      liveMissingB: liveMissing,
      liveDuplicatesB: liveDuplicates,
      liveOrderViolationsB: liveOrderViolations,
      echoCountA: aEchoes,
      echoMissingA: echoMissing,
      echoDuplicatesA: aEchoDuplicates,
      timestampOrderViolationsA: aAnalysis.timestampOrderViolations,
      timestampOrderViolationsB: bAnalysis.timestampOrderViolations,
      seqOrderViolationsA: aAnalysis.seqOrderViolations,
      seqOrderViolationsB: bAnalysis.seqOrderViolations,
      tiePairsA: aAnalysis.tiePairs,
      tiePairsB: bAnalysis.tiePairs,
      receiveTimedOut
    },
    pass
  });

  const file = writeResult(result);

  console.log(
    `[history] fetchedA=${aHistory.length} fetchedB=${bHistory.length} ` +
      `missing=${missingA}/${missingB} duplicates=${aAnalysis.duplicateCount}/${bAnalysis.duplicateCount}`
  );
  console.log(
    `[history] bothSidesMatch=${bothSidesMatch} ` +
      `orderViolations(ts)=${aAnalysis.timestampOrderViolations}/${bAnalysis.timestampOrderViolations} ` +
      `orderViolations(seq)=${aAnalysis.seqOrderViolations}/${bAnalysis.seqOrderViolations} ` +
      `tiePairs=${aAnalysis.tiePairs}`
  );
  console.log(`[history] ${pass ? 'PASS' : 'FAIL'} -> ${file}`);

  if (!pass) process.exitCode = 1;
} catch (error) {
  console.error('[history] failed:', error);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([aClient?.disconnect(), bClient?.disconnect()]);
}
