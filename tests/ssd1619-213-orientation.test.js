'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'js', 'main.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function functionSource(name) {
  const start = mainSource.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `${name} is missing`);
  const brace = mainSource.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < mainSource.length; i++) {
    if (mainSource[i] === '{') depth++;
    else if (mainSource[i] === '}' && --depth === 0) return mainSource.slice(start, i + 1);
  }
  assert.fail(`${name} is incomplete`);
}

const sandbox = { Uint8Array };
vm.runInNewContext([
  functionSource('get1bppPixel'),
  functionSource('set1bppPixel'),
  functionSource('isSSD1619_213LandscapeDriver'),
  functionSource('convertSSD1619_213LandscapePlane'),
  functionSource('restoreSSD1619_213LandscapePlane'),
  functionSource('isSSD1619_213_212x104Driver'),
  functionSource('convertSSD1619_213_212x104Plane'),
  functionSource('restoreSSD1619_213_212x104Plane'),
].join('\n'), sandbox);

function whitePlane(width, height) {
  return new Uint8Array(Math.ceil(width / 8) * height).fill(0xFF);
}

function setBlack(data, width, x, y) {
  const byteIndex = y * Math.ceil(width / 8) + Math.floor(x / 8);
  data[byteIndex] &= ~(0x80 >> (x & 7));
}

function pixel(data, width, x, y) {
  const byteIndex = y * Math.ceil(width / 8) + Math.floor(x / 8);
  return (data[byteIndex] >> (7 - (x & 7))) & 1;
}

function selectValue(value) {
  return { value };
}

test('both SSD1619 2.13 drivers use the same landscape-to-native orientation path', () => {
  assert.strictEqual(sandbox.isSSD1619_213LandscapeDriver(selectValue('18')), true);
  assert.strictEqual(sandbox.isSSD1619_213LandscapeDriver(selectValue('19')), true);
  assert.strictEqual(sandbox.isSSD1619_213LandscapeDriver(selectValue('17')), false);
});

test('SSD1619 2.9 driver uses the shared landscape-to-native orientation path', () => {
  assert.strictEqual(sandbox.isSSD1619_213LandscapeDriver(selectValue('28')), true);
});

test('standard 250x128 image rotates into the full native 128x250 plane', () => {
  const source = whitePlane(250, 128);
  setBlack(source, 250, 0, 0);
  setBlack(source, 250, 249, 127);

  const output = sandbox.convertSSD1619_213LandscapePlane(source, 250, 128);

  assert.strictEqual(output.length, 4000);
  assert.strictEqual(pixel(output, 128, 0, 249), 0);
  assert.strictEqual(pixel(output, 128, 127, 0), 0);
  assert.strictEqual(pixel(output, 128, 0, 0), 1);
});

test('low-resolution 250x122 keeps its working mapping and six white padding columns', () => {
  const source = whitePlane(250, 122);
  setBlack(source, 250, 0, 0);
  setBlack(source, 250, 249, 121);

  const output = sandbox.convertSSD1619_213LandscapePlane(source, 250, 122);

  assert.strictEqual(output.length, 4000);
  assert.strictEqual(pixel(output, 128, 0, 249), 0);
  assert.strictEqual(pixel(output, 128, 121, 0), 0);
  for (let x = 122; x < 128; x++) {
    assert.strictEqual(pixel(output, 128, x, 0), 1, `padding column ${x} changed`);
  }
});

test('standard and low-resolution slot planes restore to their landscape previews', () => {
  for (const height of [128, 122]) {
    const source = whitePlane(250, height);
    setBlack(source, 250, 13, 7);
    setBlack(source, 250, 231, height - 4);
    const native = sandbox.convertSSD1619_213LandscapePlane(source, 250, height);
    const restored = sandbox.restoreSSD1619_213LandscapePlane(native, height);
    assert.deepStrictEqual(Array.from(restored), Array.from(source), `${height}px preview changed direction`);
  }
});

test('296x128 image rotates into 128x296 and restores without losing either color-plane geometry', () => {
  const source = whitePlane(296, 128);
  setBlack(source, 296, 0, 0);
  setBlack(source, 296, 295, 127);
  setBlack(source, 296, 47, 83);

  const native = sandbox.convertSSD1619_213LandscapePlane(source, 296, 128);
  assert.strictEqual(native.length, 4736);
  assert.strictEqual(pixel(native, 128, 0, 295), 0);
  assert.strictEqual(pixel(native, 128, 127, 0), 0);
  assert.strictEqual(pixel(native, 128, 83, 248), 0);

  const restored = sandbox.restoreSSD1619_213LandscapePlane(native, 128, 296);
  assert.strictEqual(restored.length, 4736);
  assert.deepStrictEqual(Array.from(restored), Array.from(source));
});

test('212x104 black-white image rotates into a 104x212 native frame and restores exactly', () => {
  assert.strictEqual(sandbox.isSSD1619_213_212x104Driver(selectValue('24')), true);
  assert.strictEqual(sandbox.isSSD1619_213_212x104Driver(selectValue('25')), true);
  assert.strictEqual(sandbox.isSSD1619_213_212x104Driver(selectValue('18')), false);

  const source = whitePlane(212, 104);
  setBlack(source, 212, 0, 0);
  setBlack(source, 212, 211, 103);
  setBlack(source, 212, 37, 61);

  const native = sandbox.convertSSD1619_213_212x104Plane(source, 212, 104);
  assert.strictEqual(native.length, 2756);
  assert.strictEqual(pixel(native, 104, 0, 211), 0);
  assert.strictEqual(pixel(native, 104, 103, 0), 0);
  assert.strictEqual(pixel(native, 104, 61, 174), 0);

  const restored = sandbox.restoreSSD1619_213_212x104Plane(native);
  assert.strictEqual(restored.length, 2808);
  assert.deepStrictEqual(Array.from(restored), Array.from(source));
});

test('driver options expose landscape canvases matching each physical panel', () => {
  const standard = html.match(/<option value="18"[^>]*data-size="([^"]+)"/);
  const low = html.match(/<option value="19"[^>]*data-size="([^"]+)"/);
  const compact = html.match(/<option value="24"[^>]*data-color="([^"]+)"[^>]*data-size="([^"]+)"/);
  const compactOffset = html.match(/<option value="25"[^>]*data-color="([^"]+)"[^>]*data-size="([^"]+)"/);
  const panel290 = html.match(/<option value="28"[^>]*data-color="([^"]+)"[^>]*data-size="([^"]+)"[^>]*>([^<]+)<\/option>/);
  assert(standard && low && compact && compactOffset && panel290, 'SSD1619 small-panel driver options are missing');
  assert.strictEqual(standard[1], '2.13_250_128');
  assert.strictEqual(low[1], '2.13_250_122');
  assert.deepStrictEqual(Array.from(compact).slice(1), ['blackWhiteColor', '2.13_212_104']);
  assert.deepStrictEqual(Array.from(compactOffset).slice(1), ['blackWhiteColor', '2.13_212_104']);
  assert.deepStrictEqual(Array.from(panel290).slice(1),
    ['threeColor', '2.9_296_128', '2.9寸(三色,296*128,SSD1619)']);
  assert(mainSource.includes("{ name: '2.13_250_128', width: 250, height: 128 }"));
  assert(mainSource.includes("{ name: '2.9_296_128', width: 296, height: 128 }"));
});
