#!/usr/bin/env node
'use strict';

/**
 * Interactive launcher for the compiled build.
 *
 * Two entry points exist in this repo and the launcher drives the live one:
 *   browser-batch.js  — the current, working path: a real browser signs the
 *                       account up (Baseten's AuthKit send action only accepts a
 *                       browser-executed request), then Node mints the API key
 *                       through the GraphQL mutation and verifies it with a chat
 *                       completion.
 *   cli.js            — the pure-HTTP variant kept for reference; Baseten's
 *                       signup action rejected every HTTP-only replay we tried,
 *                       so it is not the recommended path.
 *
 * The launcher asks for the handful of settings that matter, remembers them in
 * `launcher.config.json`, and runs the batch with the right flags.
 *
 * Usage: node src/launcher.js            (menu)
 *        node src/launcher.js --help
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..'); // data root (the repo root)
const readline = require('readline');
const { spawnSync } = require('child_process');

const CONFIG = path.join(ROOT, 'launcher.config.json');
const BATCH = path.join(__dirname, 'browser-batch.js');

// Leftovers of a crashed browser run (a profile is 40-90 MB each) go after 12 h.
require('./chrome-flags.js').sweepProfiles('.bt-chrome-');

const defaults = {
  target: 30,
  out: 'keys.txt',
  accounts: 'accounts.json',
  poolBrowser: 'proxies.txt',
  maxFailures: 5,
  codeTimeout: 180000,
  perRun: 5,
};

function loadConfig() {
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(CONFIG, 'utf8')) };
  } catch (e) {
    return { ...defaults };
  }
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n');
  } catch (e) {
    console.error(`  ! could not write ${path.basename(CONFIG)}: ${e.message}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question, fallback) =>
  new Promise((resolve) => {
    const hint = fallback ? ` [${String(fallback).slice(0, 30)}${String(fallback).length > 30 ? '…' : ''}]` : '';
    rl.question(`  ${question}${hint}: `, (answer) => resolve(answer.trim() || fallback || ''));
  });

function run(args) {
  console.log('');
  const res = spawnSync(process.execPath, [BATCH, ...args], { windowsHide: true, cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) console.log(`  ! exited with code ${res.status}`);
}

const BANNER_LOGO = String.raw`
██████╗   █████╗  ███████╗ ███████╗ ████████╗ ███████╗ ███╗   ██╗
██╔══██╗ ██╔══██╗ ██╔════╝ ██╔════╝ ╚══██╔══╝ ██╔════╝ ████╗  ██║
██████╔╝ ███████║ ███████╗ █████╗      ██║    █████╗   ██╔██╗ ██║
██╔══██╗ ██╔══██║ ╚════██║ ██╔══╝      ██║    ██╔══╝   ██║╚██╗██║
██████╔╝ ██║  ██║ ███████║ ███████╗    ██║    ███████╗ ██║ ╚████║
╚═════╝  ╚═╝  ╚═╝ ╚══════╝ ╚══════╝    ╚═╝    ╚══════╝ ╚═╝  ╚══╝
`;

function banner() {
  const cyan = '\x1b[36m';
  const dim = '\x1b[2m';
  const bold = '\x1b[1m';
  const reset = '\x1b[0m';
  const lines = BANNER_LOGO.replace(/^\n/, '').replace(/\n$/, '').split('\n');
  const width = Math.max(...lines.map((l) => [...l].length));
  const pad = (s) => s + ' '.repeat(width - [...s].length);
  const inner = width + 4;
  console.log('');
  console.log(`${cyan}╔${'═'.repeat(inner)}╗${reset}`);
  console.log(`${cyan}║${' '.repeat(inner)}║${reset}`);
  for (const line of lines) console.log(`${cyan}║${reset}  ${bold}${pad(line)}${reset}  ${cyan}║${reset}`);
  console.log(`${cyan}║${' '.repeat(inner)}║${reset}`);
  console.log(`${cyan}║${reset}  ${pad('baseten-bulk-apikey')}  ${cyan}║${reset}`);
  console.log(`${cyan}║${reset}  ${dim}${pad('one account → one key, browser signup + Node mint')}${reset}  ${cyan}║${reset}`);
  console.log(`${cyan}║${' '.repeat(inner)}║${reset}`);
  console.log(`${cyan}╚${'═'.repeat(inner)}╝${reset}`);
  console.log(`  ${dim}baseten-bulk-apikey contributors · MIT${reset}`);
  console.log('');
}

async function mintFlow(cfg) {
  cfg.target = parseInt(await ask('How many keys in the list (any number)', cfg.target), 10) || cfg.target;
  cfg.out = await ask('Key list file (one key per line)', cfg.out);
  cfg.accounts = await ask('Account records file', cfg.accounts);
  cfg.poolBrowser = await ask('Proxy list for the browser egress (one per line)', cfg.poolBrowser);
  cfg.perRun = parseInt(await ask('Accounts per run before re-screening', cfg.perRun), 10) || cfg.perRun;
  cfg.maxFailures = parseInt(await ask('Stop after this many consecutive failures', cfg.maxFailures), 10) || cfg.maxFailures;
  saveConfig(cfg);

  const args = [
    '--target', String(cfg.target),
    '--out', cfg.out,
    '--accounts', cfg.accounts,
    '--per-run', String(cfg.perRun),
    '--max-failures', String(cfg.maxFailures),
  ];
  const poolPath = path.resolve(ROOT, cfg.poolBrowser);
  if (fs.existsSync(poolPath)) args.push('--pool-browser', poolPath);
  else console.log(`  ! ${cfg.poolBrowser} not found — the run will use the shared WARP SOCKS only`);
  run(args);
}

async function verifyFlow(cfg) {
  cfg.out = await ask('Key list to verify', cfg.out);
  saveConfig(cfg);
  run(['--verify-only', '--out', cfg.out]);
}

async function nineRouter(cfg) {
  console.log('\n9Router — register the keys in the key list as one connection each');
  cfg.nineRouter = cfg.nineRouter || {};
  cfg.nineRouter.base = await ask('9Router base URL', cfg.nineRouter.base || 'http://localhost:20128');
  cfg.nineRouter.password = await ask('9Router password', cfg.nineRouter.password || '123456');
  cfg.nineRouter.out = await ask('Key list to register (one key per line)', cfg.out);
  cfg.nineRouter.model = await ask('Default model for the connection', cfg.nineRouter.model || 'openai/gpt-oss-120b');
  saveConfig(cfg);
  console.log(`\n▶ node src/connect-9router.js --base ${cfg.nineRouter.base} --keys-file ${cfg.nineRouter.out} --model ${cfg.nineRouter.model}\n`);
  const res = spawnSync(
    process.execPath,
    [path.join(__dirname, 'connect-9router.js'), '--base', cfg.nineRouter.base, '--password', cfg.nineRouter.password, '--keys-file', cfg.nineRouter.out, '--model', cfg.nineRouter.model],
    { windowsHide: true, cwd: ROOT, stdio: 'inherit' }
  );
  if (res.status !== 0) console.log(`  ! exited with code ${res.status}`);
}

async function main() {
  const cfg = loadConfig();
  if (process.argv.includes('--connect-9router')) {
    await nineRouter(cfg);
    rl.close();
    return;
  }
  banner();
  console.log('  1) Mint keys    — real-browser signup, Node key mint, live chat verification');
  console.log('  2) Verify keys  — re-check every key with GET /v1/models and a chat call');
  console.log('  3) Settings     — show what this launcher remembers');
  console.log('  4) Help         — batch flags and notes');
  console.log('  5) 9Router      — register the keys in keys.txt with a 9Router instance');
  console.log('  q) Quit\n');
  const choice = (await ask('Choose', '1')).toLowerCase();

  if (choice === '1') await mintFlow(cfg);
  else if (choice === '2') await verifyFlow(cfg);
  else if (choice === '3') console.log('\n' + JSON.stringify(cfg, null, 2));
  else if (choice === '4') run(['--help']);
  else if (choice === '5') await nineRouter(cfg);
  rl.close();
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Interactive launcher: run `node src/launcher.js` and pick a menu item.');
  process.exit(0);
}

main().catch((e) => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
