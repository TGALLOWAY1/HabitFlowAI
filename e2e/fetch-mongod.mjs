#!/usr/bin/env node
/**
 * Provision a `mongod` binary for the e2e screenshot harness.
 *
 * Normally `e2e/serve.ts` uses mongodb-memory-server, which downloads mongod
 * from fastdl.mongodb.org. Some sandboxed environments (e.g. Claude Code on
 * the web) block that host but allow container registries. This script pulls
 * the official `library/mongo` image via the plain OCI registry HTTP API (no
 * Docker needed), extracts `usr/bin/mongod`, and caches it at
 * `e2e/.cache/mongod`, where `e2e/serve.ts` picks it up automatically.
 *
 * Requires: curl, tar (both standard on Linux). Respects HTTPS_PROXY.
 * The extracted binary targets Ubuntu 24.04 (glibc/libssl3) — matching the
 * `mongo:8.0` image base. Run only on compatible x86_64 Linux hosts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '.cache');
const MONGOD = join(CACHE_DIR, 'mongod');
const IMAGE = 'library/mongo';
const TAG = '8.0';

// Ordered by preference; all serve the same official image.
const REGISTRIES = [
  { host: 'mirror.gcr.io', tokenUrl: (repo) => `https://mirror.gcr.io/v2/token?service=mirror.gcr.io&scope=repository:${repo}:pull` },
  { host: 'registry-1.docker.io', tokenUrl: (repo) => `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull` },
];

function curlJson(url, headers = []) {
  const args = ['-fsSL', ...headers.flatMap((h) => ['-H', h]), url];
  return JSON.parse(execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
}

function main() {
  if (existsSync(MONGOD)) {
    try {
      execFileSync(MONGOD, ['--version'], { stdio: 'ignore' });
      console.log(`mongod already cached at ${MONGOD}`);
      return;
    } catch {
      console.log('Cached mongod is not runnable; re-fetching.');
      rmSync(MONGOD, { force: true });
    }
  }
  mkdirSync(CACHE_DIR, { recursive: true });

  const accept = [
    'Accept: application/vnd.oci.image.index.v1+json',
    'Accept: application/vnd.docker.distribution.manifest.list.v2+json',
    'Accept: application/vnd.oci.image.manifest.v1+json',
    'Accept: application/vnd.docker.distribution.manifest.v2+json',
  ];

  let lastErr;
  for (const reg of REGISTRIES) {
    try {
      console.log(`Trying ${reg.host} for ${IMAGE}:${TAG}…`);
      const token = curlJson(reg.tokenUrl(IMAGE)).token;
      const auth = `Authorization: Bearer ${token}`;
      const index = curlJson(`https://${reg.host}/v2/${IMAGE}/manifests/${TAG}`, [auth, ...accept]);
      const platform = (index.manifests ?? []).find(
        (m) => m.platform?.os === 'linux' && m.platform?.architecture === 'amd64'
      );
      if (!platform) throw new Error('no linux/amd64 manifest in index');
      const manifest = curlJson(`https://${reg.host}/v2/${IMAGE}/manifests/${platform.digest}`, [auth, ...accept]);
      // mongod lives in the (by far) largest layer — the mongodb-org install.
      const layer = [...manifest.layers].sort((a, b) => b.size - a.size)[0];
      console.log(`Downloading layer ${layer.digest} (${(layer.size / 1e6).toFixed(0)} MB)…`);
      const tgz = join(CACHE_DIR, 'mongo-layer.tgz');
      execFileSync('curl', ['-fsSL', '-H', auth, `https://${reg.host}/v2/${IMAGE}/blobs/${layer.digest}`, '-o', tgz], {
        stdio: 'inherit',
      });
      execFileSync('tar', ['-xzf', tgz, '-C', CACHE_DIR, 'usr/bin/mongod'], { stdio: 'inherit' });
      renameSync(join(CACHE_DIR, 'usr/bin/mongod'), MONGOD);
      rmSync(tgz, { force: true });
      rmSync(join(CACHE_DIR, 'usr'), { recursive: true, force: true });
      const version = execFileSync(MONGOD, ['--version'], { encoding: 'utf8' }).split('\n')[0];
      console.log(`OK: ${MONGOD} (${version})`);
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`${reg.host} failed: ${err.message}`);
    }
  }
  console.error('Could not provision mongod from any registry.');
  throw lastErr;
}

main();
