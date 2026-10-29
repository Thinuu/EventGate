const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
let count = 0;
function walk(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
  const file = path.join(dir, item.name);
  if (item.isDirectory()) walk(file);
  else if (file.endsWith('.js')) { count++; const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (result.status) { console.error(result.stderr); process.exitCode = 1; } }
} }
walk('src'); console.log(`Checked ${count} JavaScript files`);
