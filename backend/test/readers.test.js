const { test } = require('node:test');
const assert = require('node:assert/strict');
const { decodeCredential } = require('../src/utils/readerCodec');
test('legacy readers preserve zeros and wide decimal IDs remain exact', () => {
  assert.equal(decodeCredential('0001234567\r\n'), '0001234567');
  assert.equal(decodeCredential('18446744073709551615', { format: 'decimal' }), '18446744073709551615');
});
test('hex profiles normalize separators and casing without number conversion', () => {
  assert.equal(decodeCredential('UID:aa:00:bb:11!', { format: 'hex', prefix: 'UID:', suffix: '!' }), 'AA00BB11');
});
test('invalid, oversized, malformed or numeric JSON values are rejected', () => {
  for (const value of [1234567890, {}, '', 'x'.repeat(257), '123456789']) assert.throws(() => decodeCredential(value));
  assert.throws(() => decodeCredential('ABC', { format: 'hex' }));
  assert.throws(() => decodeCredential('1234567890', { prefix: 'UID:' }));
});
test('explicit alphanumeric profiles support vendor IDs', () => assert.equal(decodeCredential('vendor_tag-1', { format: 'alphanumeric' }), 'vendor_tag-1'));
