#!/usr/bin/env node
// Script de release tout-en-un :
//   1. Récupère le token GitHub via gh CLI
//   2. Bump la version patch (0.1.0 → 0.1.1)
//   3. Commit + push les changements en cours sur main
//   4. Build l'installer et publie sur GitHub Releases
//
// Usage : npm run release            (bump patch auto)
//         npm run release -- minor   (bump minor)
//         npm run release -- major   (bump major)

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const log = (...args) => console.log('\x1b[36m▸\x1b[0m', ...args);
const ok = (...args) => console.log('\x1b[32m✓\x1b[0m', ...args);
const fail = (msg) => {
  console.error('\x1b[31m✗\x1b[0m', msg);
  process.exit(1);
};

// ─── 1. Récupère le token GitHub ─────────────────────────────────────────
log('Récupération du token GitHub via gh CLI…');
let token;
try {
  token = execSync('gh auth token', { encoding: 'utf8' }).trim();
} catch {
  fail("Impossible de récupérer le token. Vérifie que gh est installé et que tu es connecté (`gh auth status`).");
}
if (!token) fail('Token GitHub vide.');
process.env.GH_TOKEN = token;
ok('Token GitHub OK');

// ─── 2. Bump la version ──────────────────────────────────────────────────
const bumpType = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  fail(`Type de bump invalide : "${bumpType}". Utilise patch, minor ou major.`);
}

const pkgPath = 'package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const [maj, min, patch] = pkg.version.split('.').map(Number);
let next;
if (bumpType === 'major') next = `${maj + 1}.0.0`;
else if (bumpType === 'minor') next = `${maj}.${min + 1}.0`;
else next = `${maj}.${min}.${patch + 1}`;

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
ok(`Version : ${maj}.${min}.${patch} → ${next}`);

// ─── 3. Commit & push ────────────────────────────────────────────────────
log('Commit & push des changements en cours…');
try {
  execSync('git add -A', { stdio: 'inherit' });
  // Vérifie s'il y a des changements à commit
  try {
    execSync('git diff --cached --quiet');
    log('Rien de neuf à commit (juste le bump de version)');
    execSync('git add package.json', { stdio: 'inherit' });
    execSync(`git commit -m "release: v${next}"`, { stdio: 'inherit' });
  } catch {
    execSync(`git commit -m "release: v${next}"`, { stdio: 'inherit' });
  }
  execSync('git push', { stdio: 'inherit' });
  ok('Push OK');
} catch (e) {
  console.warn('\x1b[33m!\x1b[0m Commit/push partiel — on continue avec le release');
}

// ─── 4. Build + publish ──────────────────────────────────────────────────
log('Build de l\'installer Windows (3-5 min)…');
try {
  execSync('vite build', { stdio: 'inherit' });
  execSync('electron-builder --publish always', { stdio: 'inherit', env: process.env });
} catch (e) {
  fail("Le build a échoué. Voir l'erreur ci-dessus.");
}

ok(`Release v${next} publiée sur https://github.com/${pkg.build.publish.owner}/${pkg.build.publish.repo}/releases/tag/v${next}`);
console.log('\nLe testeur recevra la maj automatiquement au prochain lancement de l\'app.');
