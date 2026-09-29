import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const hydrogenRoot = fileURLToPath(
  new URL('../node_modules/@shopify/hydrogen/', import.meta.url),
);
const hydrogenPackage = JSON.parse(
  await readFile(
    new URL('package.json', `file:///${hydrogenRoot.replaceAll('\\', '/')}/`),
    'utf8',
  ),
);

if (hydrogenPackage.version !== '2026.4.5') {
  throw new Error(
    `The Hydrogen analytics hydration patch targets 2026.4.5, but ${hydrogenPackage.version} is installed. ` +
      'Review the upstream fix before changing the pinned version.',
  );
}

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first === -1 || source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`Could not safely apply Hydrogen analytics patch: ${label}`);
  }
  return source.replace(before, after);
}

async function patchBundle(relativePath, replacements) {
  const bundleUrl = new URL(
    relativePath,
    `file:///${hydrogenRoot.replaceAll('\\', '/')}/`,
  );
  let source = await readFile(bundleUrl, 'utf8');
  for (const [before, after, label] of replacements) {
    source = replaceOnce(source, before, after, `${relativePath}: ${label}`);
  }
  await writeFile(bundleUrl, source);
}

const developmentReplacements = [
  [
    "import { createContext, forwardRef, lazy, useContext, useMemo, useEffect, useRef, useState, createElement, Fragment as Fragment$1, Suspense } from 'react';",
    "import { createContext, forwardRef, lazy, startTransition, useContext, useMemo, useEffect, useRef, useState, createElement, Fragment as Fragment$1, Suspense } from 'react';",
    'import startTransition',
  ],
  [
    `      setCarts(({ cart: cart2, prevCart: prevCart2 }) => {
        return updatedCart?.updatedAt !== cart2?.updatedAt ? { cart: updatedCart, prevCart: cart2 } : { cart: cart2, prevCart: prevCart2 };
      });`,
    `      startTransition(() => {
        setCarts(({ cart: cart2, prevCart: prevCart2 }) => {
          return updatedCart?.updatedAt !== cart2?.updatedAt ? { cart: updatedCart, prevCart: cart2 } : { cart: cart2, prevCart: prevCart2 };
        });
      });`,
    'defer cart state update',
  ],
  [
    `        onReady: () => {
          setAnalyticsLoaded(true);
          setCanTrack(
            customCanTrack ? () => customCanTrack : () => shopifyCanTrack
          );
          setConsentCollected(true);
        },`,
    `        onReady: () => {
          startTransition(() => {
            setAnalyticsLoaded(true);
            setCanTrack(
              customCanTrack ? () => customCanTrack : () => shopifyCanTrack
            );
            setConsentCollected(true);
          });
        },`,
    'defer analytics ready state updates',
  ],
  [
    '    Promise.resolve(shopProp).then(setShop);',
    '    Promise.resolve(shopProp).then((shop2) => startTransition(() => setShop(shop2)));',
    'defer shop state update',
  ],
];

const developmentCjsReplacements = developmentReplacements
  .slice(1)
  .map(([before, after, label]) => [
    before,
    after.replaceAll('startTransition(', 'react.startTransition('),
    label,
  ]);

await patchBundle('dist/development/index.js', developmentReplacements);
await patchBundle('dist/development/index.cjs', developmentCjsReplacements);

await patchBundle('dist/production/index.js', [
  [
    "import {createContext,forwardRef,lazy,useContext,useMemo,useEffect,useRef,useState,createElement,Fragment as Fragment$1,Suspense}from'react';",
    "import {createContext,forwardRef,lazy,startTransition,useContext,useMemo,useEffect,useRef,useState,createElement,Fragment as Fragment$1,Suspense}from'react';",
    'import startTransition',
  ],
  [
    't(({cart:d,prevCart:y})=>u?.updatedAt!==d?.updatedAt?{cart:u,prevCart:d}:{cart:d,prevCart:y});',
    'startTransition(()=>t(({cart:d,prevCart:y})=>u?.updatedAt!==d?.updatedAt?{cart:u,prevCart:d}:{cart:d,prevCart:y}));',
    'defer cart state update',
  ],
  [
    'onReady:()=>{u(true),l(e?()=>e:()=>eo),y(true);}',
    'onReady:()=>{startTransition(()=>{u(true),l(e?()=>e:()=>eo),y(true);});}',
    'defer analytics ready state updates',
  ],
  [
    'Promise.resolve(e).then(r),()=>{}),[r,e]),{shop:t}',
    'Promise.resolve(e).then(e=>startTransition(()=>r(e))),()=>{}),[r,e]),{shop:t}',
    'defer shop state update',
  ],
]);

await patchBundle('dist/production/index.cjs', [
  [
    't(({cart:d,prevCart:y})=>u?.updatedAt!==d?.updatedAt?{cart:u,prevCart:d}:{cart:d,prevCart:y});',
    'react.startTransition(()=>t(({cart:d,prevCart:y})=>u?.updatedAt!==d?.updatedAt?{cart:u,prevCart:d}:{cart:d,prevCart:y}));',
    'defer cart state update',
  ],
  [
    'onReady:()=>{u(true),l(e?()=>e:()=>so),y(true);}',
    'onReady:()=>{react.startTransition(()=>{u(true),l(e?()=>e:()=>so),y(true);});}',
    'defer analytics ready state updates',
  ],
  [
    'Promise.resolve(e).then(r),()=>{}),[r,e]),{shop:t}',
    'Promise.resolve(e).then(e=>react.startTransition(()=>r(e))),()=>{}),[r,e]),{shop:t}',
    'defer shop state update',
  ],
]);

console.log('Applied Hydrogen 2026.4.5 analytics hydration patch.');
