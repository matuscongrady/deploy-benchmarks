// Scheduled job: the previous day's sales report as PDF, Excel and Word documents, stored for the finance team.
import { Document, Packer, Paragraph, Table, TableCell, TableRow } from 'docx';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Decimal, exportFile, listProducts, ordersPlacedBetween, scheduledJob } from '@shop/service';
import { isoDay, plusDays } from '@shop/util';
import { revision } from './sales-report.revision';

function pdf(lines: string[]): Promise<Buffer> {
  const doc = new PDFDocument({ info: { Title: 'Daily sales', CreationDate: new Date('2025-01-16T00:00:00Z') } });
  const parts: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => parts.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(parts)));
    doc.on('error', reject);
  });
  for (const line of lines) doc.text(line);
  doc.end();
  return done;
}

export const handler = scheduledJob({ name: 'sales-report' }, async (now) => {
  const day = new Date(`${isoDay(plusDays(now, -1))}T00:00:00Z`);
  const [orders, products] = await Promise.all([ordersPlacedBetween(day, plusDays(day, 1)), listProducts()]);
  const rows = orders.flatMap((o) => o.lines.map((l) => ({ order: o.id, product: products.find((p) => p.id === l.productId)!.name, quantity: l.quantity, amount: l.unitPrice.times(l.quantity) })));
  const total = rows.reduce((sum, r) => sum.plus(r.amount), new Decimal(0)).toFixed(2);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sales');
  sheet.addRow(['Order', 'Product', 'Quantity', 'Amount']);
  for (const r of rows) sheet.addRow([r.order, r.product, r.quantity, r.amount.toNumber()]);

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph(`Sales ${isoDay(day)}: ${total} USD`),
          new Table({ rows: rows.map((r) => new TableRow({ children: [r.order, r.product, String(r.quantity)].map((text) => new TableCell({ children: [new Paragraph(text)] })) })) })
        ]
      }
    ]
  });

  const [pdfBytes, xlsx, docx] = await Promise.all([
    pdf([`Sales report ${isoDay(day)}`, ...rows.map((r) => `${r.order} ${r.product} × ${r.quantity}`), `Total: ${total} USD`]),
    workbook.xlsx.writeBuffer(),
    Packer.toBuffer(document)
  ]);
  const stored = exportFile(`reports/${isoDay(day)}/sales.pdf`, pdfBytes.toString('base64'), 'application/pdf');
  const files = [
    { type: 'pdf', bytes: pdfBytes.length, prefix: pdfBytes.subarray(0, 4).toString() },
    { type: 'xlsx', bytes: xlsx.byteLength, prefix: Buffer.from(xlsx).subarray(0, 2).toString() },
    { type: 'docx', bytes: docx.length, prefix: docx.subarray(0, 2).toString() }
  ];
  return { revision, day: isoDay(day), orders: orders.length, total, files, key: stored.input.Key };
});
