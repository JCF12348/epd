'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'js', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'main.css'), 'utf8');

test('host offers five firmware calendar themes for 4.2-inch, UC8179 7.5-inch and HS-E10.2SE drivers', () => {
  assert(/id="calendarTheme"/.test(html), 'calendar theme selector missing');
  for (let theme = 1; theme <= 5; theme++)
    assert(new RegExp(`<option value="${theme}"`).test(html), `calendar theme ${theme} missing`);
  assert(/SET_THEME:\s*0x22/.test(main), 'theme command 0x22 missing');
  assert(/function isCalendarThemeSupported/.test(main), 'theme availability guard missing');
  assert(/\[0x01,\s*0x02,\s*0x03,\s*0x04,\s*0x05,\s*0x07,\s*0x16,\s*0x17,\s*0x27\]/.test(main),
    'theme support must include only the 4.2-inch IDs, 7.5-inch ID 0x07 and 10.2-inch ID 0x27');
  assert(/return themeModels\.includes/.test(main), 'unsupported drivers must remain on their original calendar');
});

test('host parses firmware battery status and exposes click-to-refresh UI', () => {
  assert(/id="batteryStatus"/.test(html), 'battery status control missing');
  assert(/GET_STATUS:\s*0x2B/.test(main), 'status command 0x2B missing');
  assert(/function parseDeviceStatus/.test(main), 'status parser missing');
  assert(/\^status=\(\\d\+\),\(\\d\+\)\$/.test(main), 'compact firmware voltage and battery response is not parsed');
  assert(/status voltage=/.test(main), 'status notification is not routed');
  assert(/\^status voltage=\(\\d\+\)\(\?: battery=\(\\d\+\)\(\?: temperature=\(-\?\\d\+\)\)\?\)\?\$/.test(main),
    'host parser must accept voltage, battery percent, and optional temperature');
  assert(/电量 \$\{pct\}% · \$\{volts\}V/.test(main), 'parsed battery status is not rendered');
  assert(/refreshBatteryStatus/.test(main), 'manual battery refresh missing');
  assert(/src="js\/main\.js\?v=20261102-750-themes-v7"/.test(html),
    'main.js cache key must change so browsers load the theme and battery implementation');
  assert(/href="css\/main\.css\?v=20261102-750-themes-v7"/.test(html),
    'battery UI stylesheet cache key must change with the implementation');
});

test('10.2-inch standard layout supports two persistent independently resettable images', () => {
  assert(/id="layoutImagePanel"/.test(html), '10.2 standard-layout image panel missing');
  assert(/layoutImageCanvas0[^>]+width="384"[^>]+height="272"/.test(html), 'upper 384x272 preview missing');
  assert(/layoutImageCanvas1[^>]+width="384"[^>]+height="272"/.test(html), 'lower 384x272 preview missing');
  assert(/SET_LAYOUT_IMAGE:\s*0x38/.test(main), 'layout-image command 0x38 missing');
  assert(/mtuParts\.includes\('layout_img=1'\)/.test(main), 'firmware capability guard missing');
  assert(/async function uploadLayoutImage/.test(main) && /async function eraseLayoutImage/.test(main),
    'independent upload and restore-default operations missing');
  assert(/function captureLayoutImageEdit[\s\S]*processCanvasImageData\(\)[\s\S]*decodeProcessedData\(editor\.payload, 384, 272, 'fourColor'\)/.test(main),
    'layout image must reuse the normal transfer editor and four-color preview');
  assert(/new Uint8Array\(\[0, index\]\)/.test(main) &&
    /new Uint8Array\(\[1, index, deferRefresh \? 1 : 0\]\)/.test(main),
    'upload must use begin and commit actions');
  assert(/new Uint8Array\(\[2, index, 0\]\)/.test(main), 'each frame must support independent restore-default');
});

test('10.2-inch dual image editor reuses the normal transfer editor and supports batch actions', () => {
  assert(/id="layoutImagePanelToggle"[^>]+aria-expanded="false"[^>]+hidden/.test(html),
    'dual-image editor must start behind a dedicated collapsed button');
  assert(/function toggleLayoutImagePanel/.test(main) && /panel\.hidden = !expanded/.test(main),
    'dual-image button must expand and collapse the editor');
  assert(!/id="layoutImageZoom[01]"/.test(html) && !/function setLayoutImageZoom/.test(main),
    'standalone slider zoom controls must be removed');
  for (const index of [0, 1])
    assert(new RegExp(`id="layoutImageFile${index}"[\\s\\S]*data-layout-edit="${index}"`).test(html),
      `image ${index} must keep advance file selection and open the transfer editor`);
  assert(/function beginLayoutImageEdit[\s\S]*canvas\.width = 384[\s\S]*canvas\.height = 272[\s\S]*updateImage\(file\)/.test(main),
    'frame editing must open the existing 384x272 transfer canvas');
  assert(/async function sendimg\(options = \{\}\) \{[\s\S]*layoutImageEditingIndex >= 0[\s\S]*captureLayoutImageEdit\(\)/.test(main),
    'the normal send button must save the current frame edit while frame editing is active');
  assert(/async function loadLayoutImagePreview[\s\S]*URL\.createObjectURL\(file\)[\s\S]*editor\.source = image[\s\S]*renderLayoutImageEditor\(index\)/.test(main) &&
    /if \(editor\.source\)[\s\S]*context\.drawImage\(editor\.source/.test(main),
    'selected frame image must decode and render immediately');
  assert(/body\.dark-mode \.layout-image-card/.test(css) &&
    /body\.dark-mode \.layout-image-preview/.test(css),
    'dual-image cards and empty preview must follow dark mode');
  assert(/function zoomLayoutImage[\s\S]*Math\.max\(0\.2, Math\.min\(5,[\s\S]*event\.deltaY < 0 \? 1\.1 : 1 \/ 1\.1[\s\S]*editor\.offsetX[\s\S]*editor\.offsetY/.test(main) &&
    /addEventListener\('wheel',[\s\S]*passive: false/.test(main),
    'each preview must freely zoom from 20% to 500% around the mouse pointer');
  assert(/function initLayoutImageInteraction[\s\S]*pointerdown[\s\S]*setPointerCapture[\s\S]*pointermove[\s\S]*editor\.offsetX \+=[\s\S]*editor\.offsetY \+=/.test(main),
    'each preview must support captured mouse and pointer dragging');
  assert(!/editor\.offsetX = Math\.max\(-maxX/.test(main) && !/editor\.offsetY = Math\.max\(-maxY/.test(main),
    'preview dragging must remain free instead of clamping the image to the frame');
  assert(/context\.fillStyle = editor\.source \|\| editor\.preview \? '#fff'/.test(main),
    'exposed areas from free transforms must encode as the display white background');
  assert(/function encodeLayoutImage[\s\S]*renderLayoutImageEditor\(index\)[\s\S]*getImageData\(0, 0, canvas\.width, canvas\.height\)[\s\S]*'fourColor'/.test(main) &&
    /layoutImageEditors\.every\(isLayoutImageReady\)/.test(main),
    'the directly zoomed and dragged preview must be uploadable without entering the advanced editor');
  assert(/\.layout-image-preview canvas\.is-adjustable[\s\S]*cursor: grab/.test(css) && /touch-action: none/.test(css),
    'adjustable previews must expose the correct drag cursor and pointer behavior');
  assert(/@media \(max-width: 760px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)[\s\S]*\.layout-image-file input\[type=file\][\s\S]*min-width: 0/.test(css),
    'mobile dual-image cards must not be widened by the native file control');
  assert(/async function uploadBothLayoutImages/.test(main) &&
    /transferLayoutImage\(0, true\)/.test(main) && /transferLayoutImage\(1, false\)/.test(main),
    'batch upload must defer the first refresh and refresh after the second image');
  assert(/async function eraseAllLayoutImages/.test(main) &&
    /new Uint8Array\(\[2, 0, 1\]\)/.test(main) && /new Uint8Array\(\[2, 1, 0\]\)/.test(main),
    'restore-all must erase both images with one final refresh');
  assert(/\.layout-image-grid/.test(css) && /\.layout-image-preview canvas/.test(css),
    'dual-image editor layout styles missing');
});

test('10.2-inch direct dual-image preview and upload reuse the normal four-color dither pipeline', () => {
  const processor = main.match(/function processLayoutFourColorImage[\s\S]*?\n}/);
  const renderer = main.match(/function renderLayoutImageEditor[\s\S]*?\n}/);
  const encoder = main.match(/function encodeLayoutImage[\s\S]*?\n}/);
  assert(processor && /getDitherSettings\(\)/.test(processor[0]) &&
    /mode:\s*'fourColor'/.test(processor[0]) && /applyTgzFilter/.test(processor[0]) &&
    /ditherImage/.test(processor[0]) && /processImageData/.test(processor[0]) &&
    /decodeProcessedData/.test(processor[0]),
    'direct frame images must use the same filter, dither, encode and decode stages as normal transfer');
  assert(renderer && /context\.getImageData/.test(renderer[0]) &&
    /processLayoutFourColorImage/.test(renderer[0]) && /context\.putImageData/.test(renderer[0]) &&
    /editor\.payload\s*=\s*processed\.payload/.test(renderer[0]),
    'visible frame preview and upload payload must come from one processed four-color result');
  assert(encoder && /renderLayoutImageEditor\(index\)/.test(encoder[0]) &&
    /new Uint8Array\(editor\.payload\)/.test(encoder[0]) && !/processImageData/.test(encoder[0]),
    'direct upload must reuse the exact visible preview payload instead of re-encoding a different image');
});

test('connecting the host synchronizes current time before leaving the SYNC TIME screen', () => {
  const connection = main.match(/async function connect\(\)[\s\S]*?\n}/);
  assert(connection && /await write\(EpdCmd\.INIT\)/.test(connection[0]) &&
    /await sendTimeCommand\(1,\s*'日历模式'\)/.test(connection[0]),
    'a completed connection must immediately synchronize and refresh the calendar with current time');
});

test('GDEY037T03 image mode uses a compact segmented switch', () => {
  assert(/id="gdeyGrayMode" class="gdey-mode-switch"/.test(html), 'compact image-mode switch missing');
  assert(!/<fieldset id="gdeyGrayMode"/.test(html), 'oversized GDEY fieldset must be removed');
  assert(/\.gdey-mode-switch/.test(css) && /\.gdey-mode-option input:checked \+ span/.test(css),
    'segmented switch styling missing');
});

test('collage module provides eight real layouts and stays isolated from single-image upload', () => {
  const collagePath = path.join(root, 'js', 'collage.js');
  assert(fs.existsSync(collagePath), 'collage module missing');
  const collage = require(collagePath);
  const names = ['left-right', 'top-bottom', 'four-grid', 'diagonal', 'three-horizontal',
    'three-vertical', 'six-grid', 'nine-grid'];
  for (const name of names) {
    const rects = collage.buildLayoutRects(name, 900, 600);
    assert(rects.length >= 2, `${name} must create multiple image regions`);
    for (const rect of rects) {
      assert(rect.w > 0 && rect.h > 0, `${name} contains an empty region`);
      assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= 900 && rect.y + rect.h <= 600,
        `${name} region exceeds the canvas`);
    }
  }
  assert(/src="js\/collage\.js/.test(html), 'collage module is not loaded');
  assert(/dataset\.collageEditing/.test(main), 'single-image upload does not clear collage editing state');
});

test('host exposes six themes and dual-image editing only to 7.5 UC8179 three-color and 10.2', () => {
  const themeSource = main.match(/function isCalendarThemeSupported\(driverValue\)\s*\{[\s\S]*?\n}/);
  assert(themeSource, 'theme support function missing');
  const themeSupported = vm.runInNewContext(`(${themeSource[0]})`);
  assert.strictEqual(themeSupported('07'), true, 'ID 7 must expose all six calendar layouts');
  assert.strictEqual(themeSupported('27'), true, 'ID 39 must retain all six calendar layouts');
  for (const id of ['06', '08', '09', '0a', '0b', '0c'])
    assert.strictEqual(themeSupported(id), false, `other 7.5-inch ID ${id} must remain unchanged`);

  const layoutSource = main.match(/function isLayoutImageSupported\(driverValue\)\s*\{[\s\S]*?\n}/);
  assert(layoutSource, 'dual-image model guard missing');
  const layoutSupported = vm.runInNewContext(`(${layoutSource[0]})`);
  assert.strictEqual(layoutSupported('07'), true, 'ID 7 must expose the dual-image editor');
  assert.strictEqual(layoutSupported('27'), true, 'ID 39 must retain the dual-image editor');
  assert.strictEqual(layoutSupported('06'), false, '7.5-inch black-white must not expose dual images');
  assert.strictEqual(layoutSupported('0c'), false, '7.5-inch four-color must not expose dual images');
});
