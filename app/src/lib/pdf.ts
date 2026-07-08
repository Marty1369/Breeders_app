import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { DOC_TYPE_LABEL, fieldDefsFor } from './documents';
import type { DocumentRecord } from './types';

const GREEN = rgb(0x17 / 255, 0x80 / 255, 0x5a / 255);
const INK = rgb(0x19 / 255, 0x1c / 255, 0x1a / 255);
const MUTED = rgb(0x6b / 255, 0x73 / 255, 0x70 / 255);

export async function generateDocumentPdf(doc: DocumentRecord): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  let y = 780;

  page.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: GREEN });
  page.drawText('LITTER PLANNER', { x: 40, y: 815, size: 11, font: bold, color: rgb(1, 1, 1) });
  page.drawText(DOC_TYPE_LABEL[doc.type], { x: 40, y: y - 10, size: 20, font: bold, color: INK });
  y -= 40;

  page.drawText(`Status: ${doc.status}`, { x: 40, y, size: 10, font: regular, color: MUTED });
  page.drawText(`Generated: ${new Date().toLocaleDateString()}`, { x: 400, y, size: 10, font: regular, color: MUTED });
  y -= 25;

  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.9, 0.9, 0.88) });
  y -= 25;

  for (const f of fieldDefsFor(doc.type)) {
    const value = doc.field_values[f.key] || '—';
    page.drawText(f.label.toUpperCase(), { x: 40, y, size: 8.5, font: bold, color: MUTED });
    page.drawText(String(value), { x: 40, y: y - 14, size: 12, font: regular, color: INK });
    y -= 38;
    if (y < 100) {
      y = 780;
      pdf.addPage([595, 842]);
    }
  }

  y -= 20;
  page.drawLine({ start: { x: 40, y }, end: { x: 250, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
  page.drawLine({ start: { x: 340, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
  page.drawText('Breeder signature', { x: 40, y: y - 14, size: 9, font: regular, color: MUTED });
  page.drawText('Owner signature', { x: 340, y: y - 14, size: 9, font: regular, color: MUTED });

  page.drawText('This is a view-only generated document. To correct data, edit the record and regenerate.', {
    x: 40,
    y: 40,
    size: 8,
    font: regular,
    color: MUTED,
  });

  return pdf.save();
}
