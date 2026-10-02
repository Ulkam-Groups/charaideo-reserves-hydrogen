import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : path.endsWith('.tsx')
        ? [path]
        : [];
  });
}

test('internal navigation links prefetch their destination', () => {
  const missingPrefetch: string[] = [];

  for (const path of sourceFiles('app')) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/<(?:Link|NavLink)\b[\s\S]*?>/g)) {
      if (!/\bprefetch=/.test(match[0])) {
        const line = source.slice(0, match.index).split('\n').length;
        missingPrefetch.push(`${path}:${line}`);
      }
    }
  }

  assert.deepEqual(missingPrefetch, []);
});

test('route-only styles are loaded only by the route that uses them', () => {
  const root = readFileSync('app/root.tsx', 'utf8');
  const homepage = readFileSync('app/routes/_index.tsx', 'utf8');

  assert.doesNotMatch(root, /homepageStylesheet|brandStoryStylesheet/);
  assert.match(homepage, /rel: 'stylesheet', href: artifactStylesheet/);
  assert.match(homepage, /rel: 'stylesheet', href: brandStoryStylesheet/);
  assert.match(root, /<link rel="stylesheet" href=\{reserveListStylesheet\} \/>/);
});

test('homepage collection cards keep client-side navigation', () => {
  const homepage = readFileSync('app/routes/_index.tsx', 'utf8');

  assert.doesNotMatch(homepage, /window\.location\.(?:assign|replace)\(/);
  assert.match(homepage, /void navigate\(href\)/);
});
