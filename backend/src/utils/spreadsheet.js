// Narrow compatibility layer for the application's tabular XLSX/CSV workflows.
// Legacy binary .xls is deliberately rejected. Exported user text cannot become formulas.
const ExcelJS = require('exceljs');
const { Readable } = require('node:stream');
function cellValue(cell) {
  const value = cell.value;
  if (value == null) return '';
  if (typeof value !== 'object' || value instanceof Date) return value;
  if (value.formula || value.sharedFormula) throw Object.assign(new Error('Formula cells are not accepted in uploads'), { statusCode: 400 });
  if (value.richText) return value.richText.map(x => x.text).join('');
  return value.text || '';
}
async function read(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > 10 * 1024 * 1024) throw Object.assign(new Error('Invalid or oversized spreadsheet'), { statusCode: 400 });
  const wb = new ExcelJS.Workbook();
  try {
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) await wb.xlsx.load(buffer);
    else {
      if (buffer.includes(0)) throw new Error('Binary XLS is unsupported');
      await wb.csv.read(Readable.from([buffer]), { map: value => value });
    }
  } catch (e) { throw Object.assign(new Error('Upload a valid XLSX or CSV file; legacy XLS is unsupported'), { statusCode: 400 }); }
  const Sheets = Object.create(null), SheetNames = [];
  for (const ws of wb.worksheets) {
    if (ws.rowCount > 10000 || ws.columnCount > 100) throw Object.assign(new Error('Spreadsheet exceeds 10,000 rows or 100 columns'), { statusCode: 400 });
    const rows = [];
    ws.eachRow({ includeEmpty: true }, row => {
      const values = []; for (let i = 1; i <= ws.columnCount; i++) values.push(cellValue(row.getCell(i)));
      rows.push(values);
    });
    SheetNames.push(ws.name); Sheets[ws.name] = { rows };
  }
  if (!SheetNames.length) throw Object.assign(new Error('Spreadsheet is empty'), { statusCode: 400 });
  return { Sheets, SheetNames };
}
function sheet_to_json(sheet, options = {}) {
  if (options.header === 1) return sheet.rows;
  const [headers = [], ...rows] = sheet.rows;
  return rows.filter(row => row.some(value => value !== '')).map(row => {
    const result = Object.create(null);
    headers.forEach((header, i) => { if (header && !['__proto__', 'constructor', 'prototype'].includes(String(header))) result[String(header)] = row[i] ?? options.defval ?? ''; });
    return result;
  });
}
async function write(book, options = {}) {
  const wb = new ExcelJS.Workbook();
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name]; const ws = wb.addWorksheet(name);
    for (const row of sheet.rows) ws.addRow(row.map(value => typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? "'" + value : value));
    (sheet['!cols'] || []).forEach((col, i) => { ws.getColumn(i + 1).width = col.wch || 18; });
  }
  return Buffer.from(options.bookType === 'csv' ? await wb.csv.writeBuffer({ sheetId: wb.worksheets[0].id }) : await wb.xlsx.writeBuffer());
}
module.exports = { read, write, utils: {
  book_new: () => ({ SheetNames: [], Sheets: Object.create(null) }),
  aoa_to_sheet: rows => ({ rows }),
  sheet_to_json,
  book_append_sheet: (book, sheet, name) => { book.SheetNames.push(name); book.Sheets[name] = sheet; },
} };
