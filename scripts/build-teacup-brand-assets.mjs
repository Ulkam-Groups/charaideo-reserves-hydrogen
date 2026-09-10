import {cpSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceDir = join(projectRoot, 'river-thread-web', 'svg');
const destinationDir = join(
  projectRoot,
  'river-thread-web',
  'teacup-brand',
  'svg',
);
const brandRoot = resolve(destinationDir, '..');

const assetNames = [
  'about-heritage.svg',
  'about-map-route.svg',
  'about-source.svg',
  'about-timeline.svg',
  'badge-origin.svg',
  'badge-second-flush.svg',
  'badge-small-lot.svg',
  'cart-basket.svg',
  'cart-empty.svg',
  'cart-journey.svg',
  'cart-selection.svg',
  'contact-confluence.svg',
  'contact-hospitality.svg',
  'contact-open-current.svg',
  'contact-routes.svg',
  'header-flow.svg',
  'header-quiet.svg',
  'products-garden-flow.svg',
  'products-index.svg',
  'products-shelves.svg',
  'products-tasting-scale.svg',
];

const teacupPlacements = {
  'header-quiet.svg': {leafStart: '240.6 107.2', transform: ''},
  'header-flow.svg': {
    leafStart: '405.3 143.6',
    transform: 'translate(70.17 -5.67) scale(1.393)',
  },
  'about-source.svg': {
    leafStart: '447.3 172.6',
    transform: 'translate(26.25 -15) scale(1.75)',
  },
  'cart-empty.svg': {
    leafStart: '480.4 169.8',
    transform: 'translate(33.57 -29.29) scale(1.857142857)',
  },
  'contact-open-current.svg': {
    leafStart: '431.9 177.8',
    transform: 'translate(28.04 -2.14) scale(1.678571429)',
  },
};

const lightHeaderName = 'header-quiet-light.svg';

function cupMarkup(transform) {
  const transformAttribute = transform ? ` transform="${transform}"` : '';

  return `<g id="river-teacup"${transformAttribute}>
      <path d="M273 101 H281 C288 101 291.5 104 291.5 108.5 C291.5 113 288 116 281 116 H273"
            fill="none" stroke="#5C171C" stroke-width="1.9"
            stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="255" cy="108.5" r="19"
              fill="#B87936" stroke="#5C171C" stroke-width="1.9"/>
      <path d="M246.5 104.2 C251 100.6 259.4 99.9 265.7 102.2"
            fill="none" stroke="#FFF8EA" stroke-width="0.75"
            stroke-linecap="round" opacity="0.62"/>
    </g>`;
}

function replaceLeafWithTeacup(svg, placement, name) {
  const escapedStart = placement.leafStart.replace('.', '\\.');
  const leafPattern = new RegExp(
    `<path\\s+d="M\\s+${escapedStart}[\\s\\S]*?fill="#B87936"\\s*\\/>`,
  );

  if (!leafPattern.test(svg)) {
    throw new Error(`Could not locate the original leaf in ${name}`);
  }

  return svg.replace(leafPattern, cupMarkup(placement.transform));
}

function makeLightHeader(svg) {
  return svg
    .replaceAll('#31484A', '#FFF8EA')
    .replaceAll('#5C171C', '#FFF8EA')
    .replaceAll('#78908C', '#AFC2BD')
    .replaceAll('#B12B2D', '#D9AA62')
    .replace(
      '<title id="title">River Thread compact header</title>',
      '<title id="title">River Thread compact header, light</title>',
    )
    .replace(
      'A compact sans serif navigation lockup with the River Thread mark.',
      'A light navigation lockup with the River Thread teacup mark for dark surfaces.',
    );
}

mkdirSync(destinationDir, {recursive: true});

for (const name of assetNames) {
  const sourcePath = join(sourceDir, name);
  const destinationPath = join(destinationDir, name);
  const placement = teacupPlacements[name];

  if (!placement) {
    cpSync(sourcePath, destinationPath);
    continue;
  }

  const source = readFileSync(sourcePath, 'utf8');
  writeFileSync(
    destinationPath,
    replaceLeafWithTeacup(source, placement, name),
    'utf8',
  );
}

writeFileSync(
  join(destinationDir, lightHeaderName),
  makeLightHeader(readFileSync(join(destinationDir, 'header-quiet.svg'), 'utf8')),
  'utf8',
);

cpSync(
  join(sourceDir, 'river-thread-mark-teacup-no-saucer.svg'),
  join(destinationDir, 'river-thread-mark-teacup-no-saucer.svg'),
);

const manifest = [...assetNames, lightHeaderName].map((name) => {
  const svg = readFileSync(join(destinationDir, name), 'utf8');
  const width = Number(svg.match(/<svg[^>]*\bwidth="(\d+)"/)?.[1]);
  const height = Number(svg.match(/<svg[^>]*\bheight="(\d+)"/)?.[1]);

  return {
    family: name.split('-')[0],
    svg: `svg/${name}`,
    png: `png/${name.replace(/\.svg$/, `-${width}x${height}.png`)}`,
    width,
    height,
    embedsTeacupMark: svg.includes('id="river-teacup"'),
  };
});

writeFileSync(
  join(brandRoot, 'manifest.json'),
  `${JSON.stringify(
    {
      masterMark: 'svg/river-thread-mark-teacup-no-saucer.svg',
      masterPng:
        'png/river-thread-mark-teacup-no-saucer-2080x1488.png',
      assets: manifest,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `Built ${assetNames.length + 2} teacup-brand SVGs in ${basename(destinationDir)}`,
);
