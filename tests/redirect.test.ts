import test from 'node:test';
import assert from 'node:assert/strict';

import {safeLocalRedirect} from '../app/lib/redirect.ts';

test('safeLocalRedirect preserves internal paths, queries, and fragments', () => {
  assert.equal(
    safeLocalRedirect('/collections/tea?sort=price#results'),
    '/collections/tea?sort=price#results',
  );
  assert.equal(safeLocalRedirect('/search?q=tea%2Fcoffee'), '/search?q=tea%2Fcoffee');
});

test('safeLocalRedirect rejects external and protocol-relative destinations', () => {
  assert.equal(safeLocalRedirect('https://evil.example'), '/');
  assert.equal(safeLocalRedirect('//evil.example/path'), '/');
  assert.equal(safeLocalRedirect('/\\evil.example/path'), '/');
  assert.equal(safeLocalRedirect('/%2f%2fevil.example/path'), '/');
  assert.equal(safeLocalRedirect('/%5cevil.example/path'), '/');
  assert.equal(safeLocalRedirect('javascript:alert(1)'), '/');
});

test('safeLocalRedirect supports an empty fallback when redirect is optional', () => {
  assert.equal(safeLocalRedirect(null, ''), '');
});
