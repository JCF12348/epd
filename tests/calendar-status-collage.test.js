'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'js', 'main.js'), 'utf8');

test('host offers five firmware calendar themes only for the seven 4.2-inch drivers', () => {
  assert(/id="calendarTheme"/.test(html), 'calendar theme selector missing');
  for (let theme = 1; theme <= 5; theme++)
    assert(new RegExp(`<option value="${theme}"`).test(html), `calendar theme ${theme} missing`);
  assert(/SET_THEME:\s*0x22/.test(main), 'theme command 0x22 missing');
  assert(/function isCalendarThemeSupported/.test(main), '4.2 theme availability guard missing');
  assert(/\[0x01,\s*0x02,\s*0x03,\s*0x04,\s*0x05,\s*0x16,\s*0x17\]/.test(main),
    'theme support must be limited to the seven 4.2-inch model IDs');
  assert(/return fourInchModels\.includes/.test(main), 'non-4.2 drivers must remain on their original calendar');
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
  assert(/src="js\/main\.js\?v=20261029-ssd1619-290-v1"/.test(html),
    'main.js cache key must change so browsers load the theme and battery implementation');
  assert(/href="css\/main\.css\?v=20261028-theme-battery-v3"/.test(html),
    'battery UI stylesheet cache key must change with the implementation');
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
