import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('Hydrogen analytics state updates do not interrupt hydration', async () => {
  const [development, production] = await Promise.all([
    readFile('node_modules/@shopify/hydrogen/dist/development/index.js', 'utf8'),
    readFile('node_modules/@shopify/hydrogen/dist/production/index.js', 'utf8'),
  ]);

  assert.match(
    development,
    /Promise\.resolve\(shopProp\)\.then\(\(shop2\) => startTransition/,
  );
  assert.match(development, /startTransition\(\(\) => \{\s+setCarts/);
  assert.match(development, /onReady: \(\) => \{\s+startTransition/);
  assert.match(production, /Promise\.resolve\(e\)\.then\(e=>startTransition/);
  assert.match(production, /startTransition\(\(\)=>t\(\(\{cart:d,prevCart:y\}/);
  assert.match(production, /onReady:\(\)=>\{startTransition/);
});
