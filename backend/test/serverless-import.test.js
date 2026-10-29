const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
test('production module import exports the server without exiting or requiring configured services', () => {
  const child = spawnSync(process.execPath, ['-e', "const server=require('./src/index'); if (server.constructor.name !== 'Server') process.exit(2); console.log('server-exported');"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: '', MONGODB_URI: '', MONGO_URI: '' }, encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr); assert.match(child.stdout, /server-exported/);
});
