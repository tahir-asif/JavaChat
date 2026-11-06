import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../..');
export const RESULTS_DIR = path.join(ROOT, 'metrics', 'results');

function commandOutput(command, args, fallback = 'unknown') {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.error || result.status !== 0) return fallback;
  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
}

export function makeRunId() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function gitInfo() {
  return {
    sha: commandOutput('git', ['rev-parse', 'HEAD'], 'unknown'),
    dirty: commandOutput('git', ['status', '--porcelain'], '') !== '',
    servicesDirty:
      commandOutput(
        'git',
        ['status', '--porcelain', '--untracked-files=no', '--', 'auth-service', 'chat-service', 'api-gateway'],
        ''
      ) !== ''
  };
}

export function environment() {
  const java = commandOutput('java', ['-version'], 'unknown').split('\n')[0];
  const mongo = commandOutput('docker', ['inspect', 'mongodb', '--format', '{{.Config.Image}}'], 'unknown');
  return {
    os: `${os.platform()} ${os.arch()} ${os.release()}`,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    cpuCount: os.cpus().length,
    totalMemGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    node: process.version,
    java,
    mongo,
    serviceInstances: 1
  };
}

export function makeResult({ scenario, runId, parameters, metrics, pass, extra = {} }) {
  const git = gitInfo();
  return {
    runId,
    gitSha: git.sha,
    gitDirty: git.dirty,
    servicesDirty: git.servicesDirty,
    timestamp: new Date().toISOString(),
    environment: environment(),
    scenario,
    parameters,
    metrics,
    pass,
    ...extra
  };
}

export function writeResult(result) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `${result.scenario}-${result.runId}.json`);
  fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  return file;
}
