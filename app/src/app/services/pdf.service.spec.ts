import { TestBed } from '@angular/core/testing';
import { PdfService, PdfExportData, ImportedState } from './pdf.service';

// Subclass that exposes protected methods under test-friendly names
class TestablePdfService extends PdfService {
  testBuildXml(data: PdfExportData): string {
    return this.buildXml(data);
  }
  testParseXml(xml: string): ImportedState | null {
    return this.parseXml(xml);
  }
  testBuildFilename(name: string, date: string): string {
    return this.buildFilename(name, date);
  }
  testFallbackExtract(buf: ArrayBuffer): Uint8Array | null {
    return this.fallbackExtract(buf);
  }
}

const SAMPLE_EXPORT_DATA: PdfExportData = {
  eventName: 'Club Night Juni',
  startDate: '2026-06-23',
  endDate: '2026-06-24',
  totalTip: 500,
  totalNetHours: 17,
  employees: [
    {
      name: 'Anna',
      startTime: '16:00',
      endTime: '02:00',
      hasBreak: true,
      breakHours: 0.5,
      netHours: 9.5,
      tipAmount: 279.41,
    },
    {
      name: 'Ben',
      startTime: '20:00',
      endTime: '02:00',
      hasBreak: false,
      breakHours: 0,
      netHours: 6,
      tipAmount: 176.47,
    },
    {
      name: 'Clara',
      startTime: '22:00',
      endTime: '02:00',
      hasBreak: false,
      breakHours: 0,
      netHours: 4,
      tipAmount: 44.12,
    },
  ],
};

function makeBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

describe('PdfService', () => {
  let service: TestablePdfService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: PdfService, useClass: TestablePdfService }] });
    service = new TestablePdfService();
  });

  // ─── buildXml ────────────────────────────────────────────────────────────────

  describe('buildXml', () => {
    it('produces a valid XML declaration', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    });

    it('contains the event name', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      expect(xml).toContain('<veranstaltungsname>Club Night Juni</veranstaltungsname>');
    });

    it('contains start and end date', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      expect(xml).toContain('<startDatum>2026-06-23</startDatum>');
      expect(xml).toContain('<endDatum>2026-06-24</endDatum>');
    });

    it('contains total tip', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      expect(xml).toContain('<gesamtTrinkgeld>500</gesamtTrinkgeld>');
    });

    it('contains all employee names', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      expect(xml).toContain('<name>Anna</name>');
      expect(xml).toContain('<name>Ben</name>');
      expect(xml).toContain('<name>Clara</name>');
    });

    it('serializes hasBreak=true as "true"', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      expect(xml).toContain('<pause>true</pause>');
    });

    it('serializes hasBreak=false as "false"', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      expect(xml).toContain('<pause>false</pause>');
    });

    it('serializes break hours', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      expect(xml).toContain('<pauseStunden>0.5</pauseStunden>');
    });

    it('escapes & in event name', () => {
      const data = { ...SAMPLE_EXPORT_DATA, eventName: 'Rock & Roll Night' };
      const xml = service.testBuildXml(data);
      expect(xml).toContain('Rock &amp; Roll Night');
      expect(xml).not.toContain('Rock & Roll');
    });

    it('escapes < and > in names', () => {
      const data: PdfExportData = {
        ...SAMPLE_EXPORT_DATA,
        employees: [{ ...SAMPLE_EXPORT_DATA.employees[0], name: 'A<B>C' }],
      };
      const xml = service.testBuildXml(data);
      expect(xml).toContain('A&lt;B&gt;C');
    });

    it('escapes " in names', () => {
      const data: PdfExportData = {
        ...SAMPLE_EXPORT_DATA,
        employees: [{ ...SAMPLE_EXPORT_DATA.employees[0], name: 'Anna "die Schnelle"' }],
      };
      const xml = service.testBuildXml(data);
      expect(xml).toContain('Anna &quot;die Schnelle&quot;');
    });

    it('wraps employees in <mitarbeiterListe>', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      expect(xml).toContain('<mitarbeiterListe>');
      expect(xml).toContain('</mitarbeiterListe>');
    });
  });

  // ─── parseXml ────────────────────────────────────────────────────────────────

  describe('parseXml', () => {
    it('parses a valid XML string into ImportedState', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const result = service.testParseXml(xml);
      expect(result).not.toBeNull();
      expect(result!.eventName).toBe('Club Night Juni');
      expect(result!.startDate).toBe('2026-06-23');
      expect(result!.endDate).toBe('2026-06-24');
      expect(result!.totalTip).toBe(500);
    });

    it('parses all employees', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const result = service.testParseXml(xml);
      expect(result!.employees.length).toBe(3);
      expect(result!.employees[0].name).toBe('Anna');
      expect(result!.employees[1].name).toBe('Ben');
    });

    it('parses employee shift times correctly', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const result = service.testParseXml(xml);
      expect(result!.employees[0].startTime).toBe('16:00');
      expect(result!.employees[0].endTime).toBe('02:00');
    });

    it('parses hasBreak=true correctly', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const result = service.testParseXml(xml);
      expect(result!.employees[0].hasBreak).toBe(true);
    });

    it('parses hasBreak=false correctly', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const result = service.testParseXml(xml);
      expect(result!.employees[1].hasBreak).toBe(false);
    });

    it('parses breakHours as number', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const result = service.testParseXml(xml);
      expect(result!.employees[0].breakHours).toBe(0.5);
    });

    it('returns null for malformed XML', () => {
      const result = service.testParseXml('<not valid xml>><<');
      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      const result = service.testParseXml('');
      expect(result).toBeNull();
    });

    it('handles XML with no employees (empty list)', () => {
      const data: PdfExportData = { ...SAMPLE_EXPORT_DATA, employees: [] };
      const xml = service.testBuildXml(data);
      const result = service.testParseXml(xml);
      expect(result).not.toBeNull();
      expect(result!.employees).toEqual([]);
    });
  });

  // ─── Round-trip ──────────────────────────────────────────────────────────────

  describe('XML round-trip (buildXml → parseXml)', () => {
    it('preserves all event fields', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const state = service.testParseXml(xml)!;
      expect(state.eventName).toBe(SAMPLE_EXPORT_DATA.eventName);
      expect(state.startDate).toBe(SAMPLE_EXPORT_DATA.startDate);
      expect(state.endDate).toBe(SAMPLE_EXPORT_DATA.endDate);
      expect(state.totalTip).toBe(SAMPLE_EXPORT_DATA.totalTip);
    });

    it('preserves all employee fields for each employee', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const state = service.testParseXml(xml)!;
      SAMPLE_EXPORT_DATA.employees.forEach((orig, i) => {
        expect(state.employees[i].name).toBe(orig.name);
        expect(state.employees[i].startTime).toBe(orig.startTime);
        expect(state.employees[i].endTime).toBe(orig.endTime);
        expect(state.employees[i].hasBreak).toBe(orig.hasBreak);
        expect(state.employees[i].breakHours).toBe(orig.breakHours);
      });
    });

    it('round-trips XML special chars in event name correctly', () => {
      const data = { ...SAMPLE_EXPORT_DATA, eventName: 'Rock & Roll <Night>' };
      const xml = service.testBuildXml(data);
      const state = service.testParseXml(xml)!;
      expect(state.eventName).toBe('Rock & Roll <Night>');
    });
  });

  // ─── buildFilename ────────────────────────────────────────────────────────────

  describe('buildFilename', () => {
    it('combines event name and date', () => {
      expect(service.testBuildFilename('Club Night', '2026-06-23')).toBe('Club_Night_20260623.pdf');
    });

    it('replaces spaces with underscores', () => {
      expect(service.testBuildFilename('My Event', '2026-01-15')).toBe('My_Event_20260115.pdf');
    });

    it('removes illegal filename characters', () => {
      const filename = service.testBuildFilename('Event/2026!Test', '2026-06-23');
      expect(filename).not.toContain('/');
      expect(filename).not.toContain('!');
      expect(filename).toContain('.pdf');
    });

    it('falls back to "Veranstaltung" for empty name', () => {
      expect(service.testBuildFilename('', '2026-06-23')).toBe('Veranstaltung_20260623.pdf');
    });

    it('preserves German umlauts', () => {
      const filename = service.testBuildFilename('Sommernächte', '2026-06-23');
      expect(filename).toContain('Sommernächte');
    });

    it('always ends with .pdf', () => {
      expect(service.testBuildFilename('Test', '2026-06-23')).toMatch(/\.pdf$/);
    });
  });

  // ─── fallbackExtract ─────────────────────────────────────────────────────────
  // The extractor looks for %%BeginTrinkgeldData / %%EndTrinkgeldData markers
  // that are appended after %%EOF in the exported PDFs.

  const START = '%%BeginTrinkgeldData\n';
  const END = '\n%%EndTrinkgeldData';

  function wrapWithMarkers(xml: string): string {
    return `%PDF-1.4 fake bytes\n%%EOF\n\n${START}${xml}${END}\n`;
  }

  describe('fallbackExtract', () => {
    it('extracts XML between the markers', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const buf = makeBuffer(wrapWithMarkers(xml));
      const extracted = service.testFallbackExtract(buf);
      expect(extracted).not.toBeNull();
      const text = new TextDecoder().decode(extracted!);
      expect(text).toContain('<?xml version="1.0"');
      expect(text).toContain('</trinkgeld-event>');
    });

    it('returns null when start marker is absent', () => {
      const buf = makeBuffer('%PDF-1.4 fake content %%EOF');
      expect(service.testFallbackExtract(buf)).toBeNull();
    });

    it('returns null when end marker is absent', () => {
      const buf = makeBuffer(`%PDF bytes %%EOF\n${START}incomplete XML without end marker`);
      expect(service.testFallbackExtract(buf)).toBeNull();
    });

    it('extracted content is parseable as valid XML', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const buf = makeBuffer(wrapWithMarkers(xml));
      const extracted = service.testFallbackExtract(buf);
      const parsed = service.testParseXml(new TextDecoder().decode(extracted!));
      expect(parsed).not.toBeNull();
      expect(parsed!.eventName).toBe('Club Night Juni');
    });

    it('handles markers embedded anywhere in the buffer (not just at the end)', () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const buf = makeBuffer(`junk before\n${START}${xml}${END}\njunk after`);
      const extracted = service.testFallbackExtract(buf);
      expect(extracted).not.toBeNull();
    });
  });

  // ─── importFromPdf ────────────────────────────────────────────────────────────
  // jsdom does not implement File.arrayBuffer() — we stub it with a mock object
  // that returns an ArrayBuffer directly, matching the real File API contract.

  function mockFile(content: string): File {
    const buf = makeBuffer(content);
    return { arrayBuffer: async () => buf } as unknown as File;
  }

  describe('importFromPdf', () => {
    it('imports state from an exported PDF buffer', async () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const result = await service.importFromPdf(mockFile(wrapWithMarkers(xml)));
      expect(result).not.toBeNull();
      expect(result!.eventName).toBe('Club Night Juni');
      expect(result!.startDate).toBe('2026-06-23');
      expect(result!.employees.length).toBe(3);
    });

    it('returns null for a PDF without embedded data', async () => {
      const result = await service.importFromPdf(mockFile('%PDF-1.4 fake content %%EOF'));
      expect(result).toBeNull();
    });

    it('returns null for an empty file', async () => {
      const result = await service.importFromPdf(mockFile(''));
      expect(result).toBeNull();
    });

    it('preserves all employee data through full import', async () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const result = await service.importFromPdf(mockFile(wrapWithMarkers(xml)));
      expect(result!.employees[0].hasBreak).toBe(true);
      expect(result!.employees[0].breakHours).toBe(0.5);
      expect(result!.employees[1].hasBreak).toBe(false);
    });

    it('preserves total tip as number', async () => {
      const xml = service.testBuildXml(SAMPLE_EXPORT_DATA);
      const result = await service.importFromPdf(mockFile(wrapWithMarkers(xml)));
      expect(result!.totalTip).toBe(500);
    });
  });
});
