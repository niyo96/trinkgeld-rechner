import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Markers that bracket the XML data appended after the PDF %%EOF.
// PDF readers stop at %%EOF and ignore everything after it, so the file
// remains a valid PDF while we can reliably scan for these markers on import.
const XML_START_MARKER = '%%BeginTrinkgeldData\n';
const XML_END_MARKER = '\n%%EndTrinkgeldData';

export interface PdfExportData {
  eventName: string;
  startDate: string;
  endDate: string;
  totalTip: number;
  employees: {
    name: string;
    startTime: string;
    endTime: string;
    hasBreak: boolean;
    breakHours: number;
    netHours: number;
    tipAmount: number | null;
  }[];
  totalNetHours: number;
}

export interface ImportedState {
  eventName: string;
  startDate: string;
  endDate: string;
  totalTip: number | null;
  employees: {
    name: string;
    startTime: string;
    endTime: string;
    hasBreak: boolean;
    breakHours: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class PdfService {
  async exportPdf(data: PdfExportData): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Trinkgeld-Abrechnung', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(data.eventName || 'Veranstaltung', pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    const dateRange =
      data.startDate === data.endDate
        ? this.formatDate(data.startDate)
        : `${this.formatDate(data.startDate)} – ${this.formatDate(data.endDate)}`;
    doc.text(dateRange, pageWidth / 2, 38, { align: 'center' });

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Gesamttrinkgeld: ${this.formatEuro(data.totalTip)}`, pageWidth / 2, 48, {
      align: 'center',
    });

    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
      startY: 56,
      head: [['Name', 'Von', 'Bis', 'Pause', 'Netto-h', 'Betrag']],
      body: data.employees.map(e => [
        e.name || '–',
        e.startTime,
        e.endTime,
        e.hasBreak ? `${e.breakHours.toFixed(2)} h` : '–',
        e.netHours.toFixed(2),
        e.tipAmount !== null ? this.formatEuro(e.tipAmount) : '–',
      ]),
      foot: [
        ['Gesamt', '', '', '', data.totalNetHours.toFixed(2), this.formatEuro(data.totalTip)],
      ],
      headStyles: { fillColor: [25, 118, 210], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      styles: { fontSize: 10 },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 6;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Diese PDF enthält eingebettete Daten zum Reimport in den Trinkgeld-Rechner.', 14, finalY);

    // Append XML as plain text after %%EOF — PDF readers ignore content past %%EOF,
    // but our marker-based scanner reliably finds it without compression issues.
    const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
    const xmlString = this.buildXml(data);
    const appendText = `\n${XML_START_MARKER}${xmlString}${XML_END_MARKER}\n`;
    const appendBytes = new TextEncoder().encode(appendText);

    const combined = new Uint8Array(pdfBytes.length + appendBytes.length);
    combined.set(pdfBytes);
    combined.set(appendBytes, pdfBytes.length);

    this.download(combined, this.buildFilename(data.eventName, data.startDate), 'application/pdf');
  }

  async importFromPdf(file: File): Promise<ImportedState | null> {
    const arrayBuffer = await file.arrayBuffer();
    try {
      const xmlBytes = this.fallbackExtract(arrayBuffer);
      if (!xmlBytes) return null;
      return this.parseXml(new TextDecoder().decode(xmlBytes));
    } catch {
      return null;
    }
  }

  protected fallbackExtract(rawBytes: ArrayBuffer): Uint8Array | null {
    const text = new TextDecoder('latin1').decode(new Uint8Array(rawBytes));
    const startIdx = text.indexOf(XML_START_MARKER);
    if (startIdx === -1) return null;
    const endIdx = text.indexOf(XML_END_MARKER, startIdx);
    if (endIdx === -1) return null;
    const xml = text.slice(startIdx + XML_START_MARKER.length, endIdx);
    return new TextEncoder().encode(xml);
  }

  protected buildXml(data: PdfExportData): string {
    const employees = data.employees
      .map(
        e => `    <mitarbeiter>
      <name>${this.escXml(e.name)}</name>
      <von>${this.escXml(e.startTime)}</von>
      <bis>${this.escXml(e.endTime)}</bis>
      <pause>${e.hasBreak}</pause>
      <pauseStunden>${e.breakHours}</pauseStunden>
    </mitarbeiter>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<trinkgeld-event>
  <veranstaltungsname>${this.escXml(data.eventName)}</veranstaltungsname>
  <startDatum>${this.escXml(data.startDate)}</startDatum>
  <endDatum>${this.escXml(data.endDate)}</endDatum>
  <gesamtTrinkgeld>${data.totalTip}</gesamtTrinkgeld>
  <mitarbeiterListe>
${employees}
  </mitarbeiterListe>
</trinkgeld-event>`;
  }

  protected parseXml(xml: string): ImportedState | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      if (doc.querySelector('parsererror')) return null;

      const get = (tag: string) => doc.querySelector(tag)?.textContent?.trim() ?? '';

      const employees = Array.from(doc.querySelectorAll('mitarbeiter')).map(node => ({
        name: node.querySelector('name')?.textContent?.trim() ?? '',
        startTime: node.querySelector('von')?.textContent?.trim() ?? '',
        endTime: node.querySelector('bis')?.textContent?.trim() ?? '',
        hasBreak: node.querySelector('pause')?.textContent?.trim() === 'true',
        breakHours: parseFloat(node.querySelector('pauseStunden')?.textContent ?? '0') || 0,
      }));

      return {
        eventName: get('veranstaltungsname'),
        startDate: get('startDatum'),
        endDate: get('endDatum'),
        totalTip: parseFloat(get('gesamtTrinkgeld')) || null,
        employees,
      };
    } catch {
      return null;
    }
  }

  protected buildFilename(eventName: string, startDate: string): string {
    const safeName = (eventName || 'Veranstaltung')
      .replace(/[^a-zA-Z0-9äöüÄÖÜß\-_ ]/g, '')
      .trim()
      .replace(/ /g, '_');
    const safeDate = (startDate || '').replace(/-/g, '');
    return `${safeName}_${safeDate}.pdf`;
  }

  private escXml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  private formatEuro(amount: number): string {
    return (
      amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
    );
  }

  private download(bytes: Uint8Array, filename: string, mimeType: string): void {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
