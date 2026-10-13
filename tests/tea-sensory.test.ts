import assert from 'node:assert/strict';
import test from 'node:test';
import {parseSensoryTea, rankSensoryTeas} from '../app/lib/tea-sensory.ts';

const product = {
  id: 'gid://shopify/Product/1', title: 'Golden Reserve', handle: 'golden-reserve',
  productType: 'Black tea', vendor: 'Charaideo', image: null, availableForSale: true,
  priceRange: {minVariantPrice: {amount: '1200', currencyCode: 'INR'}},
};

test('parses a valid versioned tea sensory metafield', () => {
  const tea = parseSensoryTea({...product, sensoryProfile: {type: 'json', value: JSON.stringify({
    schemaVersion: 1, flavours: ['Malty', 'Brisk'], moods: ['comfort'], intensities: ['bold'], styles: ['hot'],
    brew: {temperatureC: 95, seconds: 210, ratio: '2 g / 200 ml'},
  })}});
  assert.equal(tea?.profile.flavours[0], 'malty');
  assert.equal(tea?.profile.brew.seconds, 210);
});

test('rejects malformed and incomplete profiles', () => {
  assert.equal(parseSensoryTea({...product, sensoryProfile: {type: 'json', value: '{'}}), null);
  assert.equal(parseSensoryTea({...product, sensoryProfile: {type: 'json', value: '{"flavours":["malty"]}'}}), null);
});

test('ranks the closest flavour, intensity, style, and mood match first', () => {
  const malty = parseSensoryTea({...product, sensoryProfile: {type: 'json', value: JSON.stringify({flavours:['malty'], moods:['comfort'], intensities:['bold'], styles:['hot']})}})!;
  const floral = parseSensoryTea({...product, id: '2', title: 'Floral Tea', sensoryProfile: {type: 'json', value: JSON.stringify({flavours:['floral'], moods:['calm'], intensities:['light'], styles:['iced']})}})!;
  const ranked = rankSensoryTeas([floral, malty], {mood:'comfort', flavour:'malty', intensity:'bold', style:'hot'});
  assert.equal(ranked[0].tea.title, 'Golden Reserve');
});
