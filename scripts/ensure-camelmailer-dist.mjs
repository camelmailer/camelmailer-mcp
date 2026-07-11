#!/usr/bin/env node
/**
 * Temporary install shim — delete once `camelmailer` is published to npm.
 *
 * This package depends on the SDK straight from GitHub
 * (`github:camelmailer/camelmailer-node`). That repository publishes only
 * its `dist/` build output via the package `files` field, and git installs
 * do not run a build, so the installed package arrives without any code.
 * This script rebuilds the SDK from source once, right after install.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY = 'https://github.com/camelmailer/camelmailer-node.git';

function findSdkDir(startDir) {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', 'camelmailer');
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sdkDir = findSdkDir(packageRoot);
if (!sdkDir || existsSync(join(sdkDir, 'dist', 'index.js'))) {
  process.exit(0); // not installed here, or already built (e.g. npm registry version)
}

const sdkPackage = JSON.parse(readFileSync(join(sdkDir, 'package.json'), 'utf8'));
const ref = sdkPackage.gitHead;

const tmp = mkdtempSync(join(tmpdir(), 'camelmailer-sdk-'));
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

try {
  if (ref) {
    run('git', ['init', '--quiet'], tmp);
    run('git', ['remote', 'add', 'origin', REPOSITORY], tmp);
    run('git', ['fetch', '--quiet', '--depth', '1', 'origin', ref], tmp);
    run('git', ['checkout', '--quiet', 'FETCH_HEAD'], tmp);
  } else {
    run('git', ['clone', '--quiet', '--depth', '1', REPOSITORY, '.'], tmp);
  }
  run('npm', ['ci', '--no-audit', '--no-fund', '--ignore-scripts'], tmp);
  run('npm', ['run', 'build'], tmp);
  cpSync(join(tmp, 'dist'), join(sdkDir, 'dist'), { recursive: true });
  console.log('[camelmailer-mcp] built the camelmailer SDK from source (pre-npm-release shim)');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
