'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'js', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'main.css'), 'utf8');

test('host offers five firmware calendar themes for 4.2-inch, UC8179 7.5-inch, 9.7-inch and JD79665 10.2-inch drivers', () => {
  assert(/id="calendarTheme"/.test(html), 'calendar theme selector missing');
  for (let theme = 1; theme <= 5; theme++)
    assert(new RegExp(`<option value="${theme}"`).test(html), `calendar theme ${theme} missing`);
  assert(/SET_THEME:\s*0x22/.test(main), 'theme command 0x22 missing');
  assert(/function isCalendarThemeSupported/.test(main), 'theme availability guard missing');
  assert(/\[0x01,\s*0x02,\s*0x03,\s*0x04,\s*0x05,\s*0x07,\s*0x15,\s*0x16,\s*0x17,\s*0x27,\s*0x29,\s*0x2A\]/.test(main),
    'theme support must include 4.2-inch IDs plus 7.5, 9.7 and both 10.2-inch drivers');
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
  assert(/src="js\/main\.js\?v=20261111-clear-busy-log-v14"/.test(html),
    'main.js cache key must change so browsers load the theme and battery implementation');
  assert(/href="css\/main\.css\?v=20261105-970-themes-v8"/.test(html),
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

test('connecting sends only INIT and battery status without refreshing the display', () => {
  const connection = main.match(/async function connect\(\)[\s\S]*?\n}/);
  assert(connection && /await write\(EpdCmd\.INIT\)/.test(connection[0]) &&
    /await write\(EpdCmd\.GET_STATUS\)/.test(connection[0]),
    'connection must initialize and read status');
  assert(!/sendTimeCommand|syncTime|SET_TIME|refreshSlots/.test(connection[0]),
    'connection must not refresh, synchronize time, or query slots automatically');
  const writes = [...connection[0].matchAll(/await write\(EpdCmd\.([A-Z_]+)/g)].map(match => match[1]);
  assert.deepStrictEqual(writes, ['INIT', 'GET_STATUS'], 'connection emitted extra commands');
  const notification = main.match(/function handleNotify\([\s\S]*?\n}/);
  assert(notification && !/queryClockFont|queryLayoutImages/.test(notification[0]),
    'INIT capability notification must not trigger extra automatic queries');
});

test('image packets stream continuously with adaptive backpressure and an optional confirmation interval', () => {
  const gatt = main.match(/async function writeGattPayload\([\s\S]*?\n}/);
  const image = main.match(/async function writeImage\([\s\S]*?\n}/);
  assert(gatt && /writeValueWithoutResponse/.test(gatt[0]) && !/sleep\(4\)/.test(gatt[0]),
    'no-response image packets must not carry a fixed delay');
  assert(/isGattBusyError[\s\S]*?await sleep/.test(gatt[0]),
    'controller backpressure must still retry instead of dropping packets');
  assert(image && /confirmationInterval\s*>\s*0/.test(image[0]) &&
    /confirmationInterval\s*===\s*0/.test(image[0]),
    'zero must select continuous mode while nonzero intervals retain optional acknowledgement barriers');
  assert(/id="interleavedcount" value="0"/.test(html), 'continuous image transfer must be the default');
});

test('image send timing ends only after the refresh command starts the panel refresh', () => {
  const send = main.match(/async function sendimg\([\s\S]*?\n}/);
  assert(send, 'sendimg function missing');
  const completionCommand = send[0].indexOf('const completionSent');
  const completionAccepted = send[0].indexOf('if (!completionSent)', completionCommand);
  const sendTime = send[0].indexOf('const sendTime', completionAccepted);
  assert(completionCommand >= 0 && completionAccepted > completionCommand && sendTime > completionAccepted,
    'send timing must be calculated only after REFRESH or display submission succeeds');
  assert(/屏幕已开始刷新/.test(send[0]), 'send completion log must identify the actual refresh start');
});

test('clear screen stays locked during BLE data and interrupts the panel BUSY refresh', () => {
  const buttons = main.match(/function updateButtonStatus\([\s\S]*?\n}/);
  const clear = main.match(/async function clearScreen\([\s\S]*?\n}/);
  const send = main.match(/async function sendimg\([\s\S]*?\n}/);
  assert(buttons && /clearDisabled[\s\S]*?imageTransferActive\s*&&\s*!imageRefreshPending/.test(buttons[0]),
    'clear must remain locked during data transfer and unlock only after REFRESH starts');
  assert(/clearscreenbutton[\s\S]*?clearDisabled/.test(buttons[0]), 'clear button must use its BUSY-aware lock');
  assert(clear && /imageRefreshPending[\s\S]*?EpdCmd\.CLEAR[\s\S]*?cancelImageRefreshWait\(\)[\s\S]*?imageTransferActive\s*=\s*false/.test(clear[0]),
    'clear must take ownership from the interrupted image refresh');
  assert(send && /const completionSent[\s\S]*?if \(!completionSent\)[\s\S]*?updateButtonStatus\(\)/.test(send[0]),
    'clear availability must be recomputed after the refresh command enters BUSY');
});

test('log history is retained until manual clear and can be copied', () => {
  assert(/onclick="copyLog\(\)"[^>]*>复制日志<\/button>/.test(html), 'copy-log button missing');
  const add = main.match(/function addLog\([\s\S]*?\n}/);
  const copy = main.match(/async function copyLog\([\s\S]*?\n}/);
  assert(add && !/childNodes\.length\s*>\s*20|removeChild\(log\.firstChild\)/.test(add[0]),
    'log entries must not be discarded after 20 lines');
  assert(copy && /log\.innerText\.trim\(\)/.test(copy[0]) && /navigator\.clipboard/.test(copy[0]) &&
    /document\.execCommand\('copy'\)/.test(copy[0]), 'copy-log action must support secure and fallback clipboard paths');
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

test('host exposes six themes and dual-image editing to 7.5 UC8179 three-color, 9.7 and 10.2', () => {
  const themeSource = main.match(/function isCalendarThemeSupported\(driverValue\)\s*\{[\s\S]*?\n}/);
  assert(themeSource, 'theme support function missing');
  const themeSupported = vm.runInNewContext(`(${themeSource[0]})`);
  assert.strictEqual(themeSupported('07'), true, 'ID 7 must expose all six calendar layouts');
  assert.strictEqual(themeSupported('15'), true, 'ID 21 must expose all six calendar layouts');
  assert.strictEqual(themeSupported('27'), true, 'ID 39 must retain all six calendar layouts');
  for (const id of ['06', '08', '09', '0a', '0b', '0c'])
    assert.strictEqual(themeSupported(id), false, `other 7.5-inch ID ${id} must remain unchanged`);

  const layoutSource = main.match(/function isLayoutImageSupported\(driverValue\)\s*\{[\s\S]*?\n}/);
  assert(layoutSource, 'dual-image model guard missing');
  const layoutSupported = vm.runInNewContext(`(${layoutSource[0]})`);
  assert.strictEqual(layoutSupported('07'), true, 'ID 7 must expose the dual-image editor');
  assert.strictEqual(layoutSupported('15'), true, 'ID 21 must expose the dual-image editor');
  assert.strictEqual(layoutSupported('27'), true, 'ID 39 must retain the dual-image editor');
  assert.strictEqual(layoutSupported('06'), false, '7.5-inch black-white must not expose dual images');
  assert.strictEqual(layoutSupported('0c'), false, '7.5-inch four-color must not expose dual images');
});

test('SSD2677 exposes matching driver and canvas options plus theme and dual-image support', () => {
  const driverBlock = html.match(/<select id="epddriver"[^>]*>([\s\S]*?)<\/select>/)[1];
  const sizesBlock = html.match(/<select id="canvasSize"[^>]*>([\s\S]*?)<\/select>/)[1];
  const driver = [...driverBlock.matchAll(/<option value="([^"]+)"([^>]*)>([^<]+)<\/option>/g)]
    .find(m=>m[1]==='29');
  assert(driver && driver[3]==='9.7寸（四色，SSD2677,LUT）');
  assert(/data-color="fourColor"/.test(driver[2]));
  assert(/data-size="9.7_960_672"/.test(driver[2]));
  assert(/value="9.7_960_672"/.test(sizesBlock), 'missing canvas option aborts onchange before INIT');
  const sandbox = { parseInt };
  const functions = ['isCalendarThemeSupported','isLayoutImageSupported'];
  for(const name of functions) vm.runInNewContext(main.match(new RegExp(`function ${name}\\([^]*?\\n}`))[0],sandbox);
  for(const id of ['29','15','27','07']) {
    assert.strictEqual(sandbox.isCalendarThemeSupported(id),true);
    assert.strictEqual(sandbox.isLayoutImageSupported(id),true);
  }
  assert.strictEqual(sandbox.isCalendarThemeSupported('28'),false,'existing 2.9 ID must remain unrelated');
  assert.strictEqual(sandbox.isLayoutImageSupported('28'),false);
});

test('legacy 9.7 option is named JD79665 LUT while retaining ID 0x15 and 960x680', () => {
  assert(/<option value="15" data-color="fourColor" data-size="9.7_960_680">9.7寸（四色，JD79665,LUT）<\/option>/.test(html));
  assert(!/GDEY133F91/.test(html));
});

test('10.2 SSD2677 uses new ID 0x2a with the shared 960x640 four-color canvas', () => {
  assert(/<option value="2a" data-color="fourColor" data-size="10\.2_960_640">10\.2寸\(四色,SSD2677\)<\/option>/.test(html));
  const sandbox = { parseInt };
  for (const name of ['isCalendarThemeSupported', 'isLayoutImageSupported'])
    vm.runInNewContext(main.match(new RegExp(`function ${name}\\([^]*?\\n}`))[0], sandbox);
  assert.strictEqual(sandbox.isCalendarThemeSupported('2a'), true);
  assert.strictEqual(sandbox.isLayoutImageSupported('2a'), true);
});
