// Builds the .xlsx in the browser. Imported dynamically (exceljs is large).
import ExcelJS from 'exceljs';
import type { Cell } from './build';

export type SheetSpec = { name: string; header: string[]; rows: Cell[][]; widths?: number[] };

function autoWidths(header: string[], rows: Cell[][]): number[] {
  return header.map((h, i) => {
    let max = h.length;
    for (const r of rows.slice(0, 500)) max = Math.max(max, String(r[i] ?? '').length);
    return Math.min(60, Math.max(8, max + 2));
  });
}

export async function buildWorkbook(sheets: SheetSpec[]): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  for (const spec of sheets) {
    const ws = wb.addWorksheet(spec.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(spec.header);
    for (const r of spec.rows) ws.addRow(r);
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.alignment = { vertical: 'middle' };
    const widths = spec.widths ?? autoWidths(spec.header, spec.rows);
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: spec.header.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
