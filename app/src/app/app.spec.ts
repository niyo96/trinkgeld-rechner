import { TestBed, ComponentFixture } from '@angular/core/testing';
import { App } from './app';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { StorageService } from './services/storage.service';

function createFixture(): ComponentFixture<App> {
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  return fixture;
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideAnimationsAsync(),
        // Isolate from real localStorage
        {
          provide: StorageService,
          useValue: { save: () => {}, load: () => null, clear: () => {} },
        },
      ],
    }).compileComponents();
  });

  // ─── Grundlegend ─────────────────────────────────────────────────────────────

  it('erstellt die Komponente', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('zeigt die App-Überschrift', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
    expect(h1.textContent).toContain('Trinkgeld-Rechner');
  });

  // ─── Veranstaltungsname ───────────────────────────────────────────────────────

  it('rendert das Eingabefeld für den Veranstaltungsnamen', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();
    const inputs = fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
    const labels = fixture.nativeElement.querySelectorAll('mat-label') as NodeListOf<HTMLElement>;
    const labelTexts = Array.from(labels).map(l => l.textContent?.trim());
    expect(labelTexts).toContain('Veranstaltungsname');
  });

  it('bindet den Veranstaltungsnamen an das Formular', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.form.get('eventName')!.setValue('Nachtclub Gala');
    expect(app.form.value.eventName).toBe('Nachtclub Gala');
  });

  // ─── Reset ───────────────────────────────────────────────────────────────────

  it('hat einen Reset-Button', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const buttonTexts = Array.from(buttons).map(b => b.textContent?.trim() ?? '');
    expect(buttonTexts.some(t => t.includes('Zurücksetzen'))).toBe(true);
  });

  it('reset() leert alle Formularfelder', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;

    app.form.patchValue({ eventName: 'Test Event', startDate: '2026-06-23', totalTip: 100 });
    expect(app.form.value.startDate).toBe('2026-06-23');

    app.reset();

    expect(app.form.value.eventName).toBeFalsy();
    expect(app.form.value.startDate).toBeFalsy();
    expect(app.form.value.totalTip).toBeNull();
  });

  it('reset() behält genau einen Mitarbeiter-Eintrag', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;

    app.addEmployee();
    app.addEmployee();
    expect(app.employeesArray.length).toBe(3); // 1 default + 2 added

    app.reset();

    expect(app.employeesArray.length).toBe(1);
  });

  it('reset() setzt auch den Mitarbeiternamen zurück', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;

    app.employeesArray.at(0).get('name')!.setValue('Anna');
    expect(app.employeesArray.at(0).get('name')!.value).toBe('Anna');

    app.reset();

    expect(app.employeesArray.at(0).get('name')!.value).toBeFalsy();
  });

  // ─── PDF Export / Import Buttons ─────────────────────────────────────────────

  it('hat einen "Als PDF speichern"-Button', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const buttonTexts = Array.from(buttons).map(b => b.textContent?.trim() ?? '');
    expect(buttonTexts.some(t => t.includes('Als PDF speichern'))).toBe(true);
  });

  it('hat einen "PDF importieren"-Button', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const buttonTexts = Array.from(buttons).map(b => b.textContent?.trim() ?? '');
    expect(buttonTexts.some(t => t.includes('PDF importieren'))).toBe(true);
  });

  it('"Als PDF speichern" ist deaktiviert wenn kein Startdatum gesetzt', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.form.patchValue({ startDate: '' });
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const pdfBtn = Array.from(buttons).find(b => b.textContent?.includes('Als PDF speichern'));
    expect(pdfBtn?.disabled).toBe(true);
  });

  it('"Als PDF speichern" ist aktiv wenn Startdatum gesetzt ist', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.form.patchValue({ startDate: '2026-06-23' });
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const pdfBtn = Array.from(buttons).find(b => b.textContent?.includes('Als PDF speichern'));
    expect(pdfBtn?.disabled).toBe(false);
  });

  // ─── Mitarbeiter ─────────────────────────────────────────────────────────────

  it('startet mit einem Mitarbeiter-Eintrag', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    expect(fixture.componentInstance.employeesArray.length).toBe(1);
  });

  it('addEmployee() fügt einen weiteren Mitarbeiter hinzu', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.addEmployee();
    expect(app.employeesArray.length).toBe(2);
  });

  it('removeEmployee() entfernt den richtigen Eintrag', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.addEmployee({ name: 'Anna', startTime: '16:00', endTime: '02:00', hasBreak: false, breakHours: 0 });
    app.addEmployee({ name: 'Ben', startTime: '20:00', endTime: '02:00', hasBreak: false, breakHours: 0 });
    expect(app.employeesArray.length).toBe(3);
    app.removeEmployee(1);
    expect(app.employeesArray.length).toBe(2);
    expect(app.employeesArray.at(1).get('name')!.value).toBe('Ben');
  });

  // ─── Pausenstepper ───────────────────────────────────────────────────────────

  it('incrementBreak() erhöht die Pause um 0,25', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.employeesArray.at(0).get('breakHours')!.setValue(0.5);
    app.incrementBreak(0);
    expect(app.employeesArray.at(0).get('breakHours')!.value).toBe(0.75);
  });

  it('decrementBreak() verringert die Pause um 0,25', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.employeesArray.at(0).get('breakHours')!.setValue(1.0);
    app.decrementBreak(0);
    expect(app.employeesArray.at(0).get('breakHours')!.value).toBe(0.75);
  });

  it('decrementBreak() geht nicht unter 0', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.employeesArray.at(0).get('breakHours')!.setValue(0);
    app.decrementBreak(0);
    expect(app.employeesArray.at(0).get('breakHours')!.value).toBe(0);
  });

  // ─── Mitarbeiter-Validierung ──────────────────────────────────────────────

  it('employeeRows() hat hasError=true bei negativen Stunden (Mitternacht auf Tagesveranstaltung)', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;

    // single-day event + midnight-crossing shift → negative gross hours
    app.form.patchValue({ startDate: '2026-06-24', endDate: '2026-06-24' });
    app.addEmployee({ name: 'Test', startTime: '16:00', endTime: '02:00', hasBreak: false, breakHours: 0 });
    app.form.updateValueAndValidity();
    // trigger computed update
    (app as any).formValue.set(app.form.value);

    const rows = app.employeeRows();
    const row = rows[rows.length - 1];
    expect(row.hasError).toBe(true);
    expect(row.hoursError).not.toBeNull();
    expect(row.netHours).toBe(0);
  });

  it('employeeRows() hat hasError=true bei identischen Uhrzeiten (0 Stunden)', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;

    app.form.patchValue({ startDate: '2026-06-23', endDate: '2026-06-24' });
    app.addEmployee({ name: 'Test', startTime: '16:00', endTime: '16:00', hasBreak: false, breakHours: 0 });
    (app as any).formValue.set(app.form.value);

    const rows = app.employeeRows();
    const row = rows[rows.length - 1];
    expect(row.hasError).toBe(true);
    expect(row.netHours).toBe(0);
  });

  it('employeeRows() hat hasError=false bei gültiger Schicht', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;

    app.form.patchValue({ startDate: '2026-06-23', endDate: '2026-06-24' });
    app.addEmployee({ name: 'Anna', startTime: '16:00', endTime: '02:00', hasBreak: false, breakHours: 0 });
    (app as any).formValue.set(app.form.value);

    const rows = app.employeeRows();
    const row = rows[rows.length - 1];
    expect(row.hasError).toBe(false);
    expect(row.netHours).toBe(10);
  });

  it('Fehlerhafte Mitarbeiter-Zeilen tragen 0 Stunden zur Verteilung bei', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;

    // 1 valid employee (8h), 1 invalid (0h due to same times)
    app.form.patchValue({ startDate: '2026-06-23', endDate: '2026-06-24', totalTip: 100 });
    app.addEmployee({ name: 'Anna', startTime: '16:00', endTime: '00:00', hasBreak: false, breakHours: 0 });
    app.addEmployee({ name: 'Error', startTime: '12:00', endTime: '12:00', hasBreak: false, breakHours: 0 });
    (app as any).formValue.set(app.form.value);

    const rows = app.employeeRows();
    const errorRow = rows.find(r => r.name === 'Error')!;
    expect(errorRow.hasError).toBe(true);
    expect(errorRow.tipAmount).toBe(0); // gets nothing
  });

  // ─── Event-Validierung ────────────────────────────────────────────────────

  it('eventDateError() ist null bei gültigem Zeitraum', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.form.patchValue({ startDate: '2026-06-23', endDate: '2026-06-24' });
    (app as any).formValue.set(app.form.value);
    expect(app.eventDateError()).toBeNull();
  });

  it('eventDateError() meldet Fehler wenn Enddatum vor Startdatum', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.form.patchValue({ startDate: '2026-06-25', endDate: '2026-06-23' });
    (app as any).formValue.set(app.form.value);
    expect(app.eventDateError()).not.toBeNull();
  });

  // ─── Tastaturkürzel ──────────────────────────────────────────────────────────

  it('Strg+N fügt einen neuen Mitarbeiter hinzu', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    const before = app.employeesArray.length;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }));

    expect(app.employeesArray.length).toBe(before + 1);
  });

  it('Strg+N ohne Strg fügt keinen Mitarbeiter hinzu', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    const before = app.employeesArray.length;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: false }));

    expect(app.employeesArray.length).toBe(before);
  });

  it('Trinkgeld-Formularfeld meldet Fehler bei negativem Wert', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.form.get('totalTip')!.setValue(-10);
    app.form.get('totalTip')!.markAsTouched();
    expect(app.form.get('totalTip')!.invalid).toBe(true);
  });
});
