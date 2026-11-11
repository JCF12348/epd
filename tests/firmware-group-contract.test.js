'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const hostRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(hostRoot, '..');
const html = fs.readFileSync(path.join(hostRoot, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(hostRoot, 'css', 'main.css'), 'utf8');
const main = fs.readFileSync(path.join(hostRoot, 'js', 'main.js'), 'utf8');

function readFirmware(size) {
  return fs.readFileSync(path.join(projectRoot, `${size}尺寸源码`, 'EPD', 'EPD_service.c'), 'utf8');
}

function firmwareSourcesAvailable() {
  return ['小', '中', '大'].every(size =>
    fs.existsSync(path.join(projectRoot, `${size}尺寸源码`, 'EPD', 'EPD_service.c')));
}

function loadGroupContract() {
  const groups = main.match(/const FIRMWARE_GROUP_MODELS = Object\.freeze\(\{[\s\S]*?\n\}\);/);
  const normalize = main.match(/function normalizeDriverValue\([\s\S]*?\n\}/);
  const supported = main.match(/function isDriverSupportedByFirmwareGroup\([\s\S]*?\n\}/);
  assert(groups && normalize && supported, 'firmware group contract source is incomplete');
  const sandbox = {};
  vm.runInNewContext(`${groups[0]}\n${normalize[0]}\n${supported[0]}\nresult = { FIRMWARE_GROUP_MODELS, normalizeDriverValue, isDriverSupportedByFirmwareGroup };`, sandbox);
  return sandbox.result;
}

test('firmware capability notification identifies small, medium, 4.2-only and large builds', () => {
  if (!firmwareSourcesAvailable()) return;
  const small = readFirmware('小');
  const medium = readFirmware('中');
  const large = readFirmware('大');
  assert(/clock_font=1 cf2=1 group=s/.test(small), 'small firmware group=s missing');
  assert(/#if defined\(CALENDAR_420_ONLY\)[\s\S]*gray4=1 group=c[\s\S]*#else[\s\S]*gray4=1 group=m/.test(medium),
    'medium firmware must distinguish the 4.2-only and ordinary model tables');
  assert(/layout_img=1 group=l/.test(large), 'large firmware group=l missing');
  for (const source of [small, medium, large])
    assert(/char buf\[(?:72|80)\]/.test(source), 'capability buffer must fit the group token without truncation');
});

test('host firmware groups exactly match the registered model tables', () => {
  const { FIRMWARE_GROUP_MODELS: groups, isDriverSupportedByFirmwareGroup: supports } = loadGroupContract();
  assert.deepStrictEqual(Array.from(groups.s), ['18', '19', '24', '25', '28']);
  assert.deepStrictEqual(Array.from(groups.m), ['01', '02', '03', '04', '05', '0d', '0e', '0f', '10', '11', '12', '13', '14', '16', '17', '1c', '26']);
  assert.deepStrictEqual(Array.from(groups.c), ['01', '02', '03', '04', '05', '16', '17']);
  assert.deepStrictEqual(Array.from(groups.l), ['06', '07', '08', '09', '0a', '0b', '0c', '15', '1a', '1d', '1e', '1f', '20', '21', '23', '27', '29']);
  assert.strictEqual(supports('2a', 'l'), false, 'unregistered large model 0x2A must stay hidden');
  assert.strictEqual(supports('29', 'l'), true, 'registered SSD2677 model 0x29 must remain visible');
  assert.strictEqual(supports('0x1', 'c'), true, 'wire IDs must normalize to two lowercase hex digits');
});

test('host filters after group notification, restores all options on disconnect, and reports the active group', () => {
  assert(/id="firmwareGroupHint"[^>]+role="status"[^>]+aria-live="polite"/.test(html), 'firmware group status UI missing');
  assert(/\.firmware-group-hint\[data-state="error"\]/.test(css), 'mismatch warning styling missing');
  assert(/function applyFirmwareGroup[\s\S]*filter\(option => supported\.has[\s\S]*select\.replaceChildren/.test(main),
    'group application must rebuild the driver list from supported IDs');
  assert(/function restoreDriverOptions[\s\S]*allDriverOptions\.map[\s\S]*firmwareGroup = null/.test(main),
    'disconnect must restore the complete cached driver list');
  assert(/function resetVariables[\s\S]*restoreDriverOptions\(\)/.test(main), 'disconnect reset does not restore all drivers');
  assert(/const groupPart = mtuParts\.find\(part => \/\^group=\[smcl\]\$\//.test(main) &&
    /applyFirmwareGroup\(groupPart\.substring/.test(main), 'mtu group token is not routed to filtering');
});

test('unsupported model and absent firmware capabilities lock only device operations', () => {
  const buttons = main.match(/function updateButtonStatus\([\s\S]*?\n\}/);
  assert(buttons && /driverBlocked = driverGroupMismatch/.test(buttons[0]), 'driver mismatch guard missing');
  assert(/slotDisabled = Boolean\(status\) \|\| !slotStreamSupport/.test(buttons[0]), 'slot capability lock missing');
  assert(/clockFontToggle[\s\S]*!clockFontSupport/.test(buttons[0]), 'clock-font capability lock missing');
  assert(/setDriverbutton[\s\S]*isDriverSupportedByFirmwareGroup/.test(buttons[0]),
    'supported driver recovery must remain available while other device actions are locked');
  assert(/function updateCalendarThemeAvailability[\s\S]*!driverGroupMismatch/.test(main), 'theme mismatch lock missing');
  assert(/function updateLayoutImageAvailability[\s\S]*isDeviceActionAvailable/.test(main), 'dual-image capability lock missing');
  assert(/function updateGDEYImageModeControls[\s\S]*gray4Support[\s\S]*!driverGroupMismatch/.test(main),
    'gray-mode capability lock missing');
});

test('ordinary medium firmware locks 4.2 themes while the dedicated 4.2 build keeps them', () => {
  const themeSource = main.match(/function isCalendarThemeSupported\([\s\S]*?\n\}/);
  assert(themeSource, 'calendar theme guard missing');
  const sandbox = { parseInt, firmwareGroup: 'm' };
  vm.runInNewContext(`${themeSource[0]}\nresult = isCalendarThemeSupported;`, sandbox);
  for (const id of ['01', '02', '03', '04', '05', '16', '17']) {
    sandbox.firmwareGroup = 'm';
    assert.strictEqual(sandbox.result(id), false, `ordinary medium firmware must lock 4.2 model ${id}`);
    sandbox.firmwareGroup = 'c';
    assert.strictEqual(sandbox.result(id), true, `4.2-only firmware must retain model ${id} themes`);
  }
  sandbox.firmwareGroup = 'l';
  for (const id of ['07', '15', '27', '29'])
    assert.strictEqual(sandbox.result(id), true, `large firmware theme model ${id} must remain enabled`);
  assert(/calendarTheme[^\n]*disabled = !supported|select\.disabled = !supported/.test(main),
    'theme selector must use the firmware-aware support result');
  assert(/普通中尺寸固件未编译五套主题/.test(main), 'ordinary-medium lock needs a clear operator hint');
});

