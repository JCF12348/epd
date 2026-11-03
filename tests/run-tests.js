'use strict';

const tests = [];
global.test = (name, fn) => tests.push({ name, fn });

require('./ssd1619-213-orientation.test');
require('./calendar-status-collage.test');

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

console.log(`${passed}/${tests.length} tests passed`);
