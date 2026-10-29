const { test } = require('node:test');
const assert = require('node:assert/strict');
const spreadsheet = require('../src/utils/spreadsheet');
test('XLSX and CSV retain text identifiers, escape formulas and preserve tabular data', async () => {
  const wb = spreadsheet.utils.book_new();
  spreadsheet.utils.book_append_sheet(wb, spreadsheet.utils.aoa_to_sheet([['rfidTag', 'name'], ['0001234567', '=DANGEROUS()']]), 'Tags');
  for (const bookType of ['xlsx', 'csv']) {
    const buffer = await spreadsheet.write(wb, { bookType });
    const parsed = await spreadsheet.read(buffer);
    const rows = spreadsheet.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]]);
    assert.equal(rows[0].rfidTag, '0001234567');
    assert.equal(rows[0].name, "'=DANGEROUS()");
  }
});
test('binary XLS and invalid uploads fail with a user error', async () => {
  await assert.rejects(() => spreadsheet.read(Buffer.from([0, 1, 0, 3])), { statusCode: 400 });
});
