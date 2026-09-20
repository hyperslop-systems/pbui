import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyMetadata } from './verify-published-package.mjs';

const local = { name: '@test/widget', version: '0.4.1', dependencies: { '@test/core': 'workspace:^' } };
const workspace = new Map([['@test/core', '0.12.1']]);
const published = { version: '0.4.1', 'dist-tags': { latest: '0.4.1' }, dependencies: { '@test/core': '^0.12.1' } };
test('accepts version, tag and rewritten dependency', () => assert.doesNotThrow(() => verifyMetadata(local, published, 'latest', workspace)));
test('rejects wrong immutable version', () => assert.throws(() => verifyMetadata(local, { ...published, version: '0.4.0' }, 'latest', workspace)));
test('rejects a stale dist-tag', () => assert.throws(() => verifyMetadata(local, { ...published, 'dist-tags': { latest: '0.4.0' } }, 'latest', workspace)));
test('rejects a stale workspace dependency', () => assert.throws(() => verifyMetadata(local, { ...published, dependencies: { '@test/core': '^0.12.0' } }, 'latest', workspace)));
test('rejects missing workspace metadata', () => assert.throws(() => verifyMetadata(local, published, 'latest', new Map())));
