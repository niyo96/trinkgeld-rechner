import { Component, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { StorageService } from './services/storage.service';
import { PdfService, ImportedState } from './services/pdf.service';
import {
  calculateGrossHours,
  calculateNetHours,
  distributeTips,
  validateBreak,
  validateEventDates,
  validateGrossHours,
  validateShiftEndDate,
  resolveShiftEndDateTime,
} from './domain/tip-calculator';

interface PersistedState {
  event: {
    eventName: string;
    startDate: string;
    endDate: string;
    totalTip: number | null;
  };
  employees: {
    name: string;
    startTime: string;
    endTime: string;
    hasBreak: boolean;
    breakHours: number;
  }[];
}

export interface EmployeeRow {
  name: string;
  grossHours: number;
  netHours: number;        // always >= 0; clamped when there is an error
  tipAmount: number | null;
  // errors block the row from contributing to the distribution
  hoursError: string | null;    // negative / zero / missing time
  shiftDateError: string | null; // shift resolves past event end date
  // warnings still allow distribution with reduced hours
  breakWarning: string | null;
  hasError: boolean;
}

function endDateValidator(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  const start = parent.get('startDate')?.value as string;
  const end = control.value as string;
  if (start && end && end < start) return { endBeforeStart: true };
  return null;
}

function nonNegativeNumber(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v !== null && v !== '' && Number(v) < 0) return { negative: true };
  return null;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatDividerModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private fb = inject(FormBuilder);
  private storage = inject(StorageService);
  private pdfService = inject(PdfService);
  private snackBar = inject(MatSnackBar);

  @ViewChild('importInput') importInput!: ElementRef<HTMLInputElement>;

  form = this.fb.group({
    eventName: [''],
    startDate: ['', Validators.required],
    endDate: ['', [Validators.required, endDateValidator]],
    totalTip: [null as number | null, [Validators.required, Validators.min(0), nonNegativeNumber]],
    employees: this.fb.array<FormGroup>([]),
  });

  private formValue = signal<typeof this.form.value>(this.form.value);
  isExporting = signal(false);

  eventDateError = computed<string | null>(() => {
    const v = this.formValue();
    return validateEventDates(v.startDate ?? '', v.endDate ?? '');
  });

  employeeRows = computed<EmployeeRow[]>(() => {
    const val = this.formValue();
    const startDate = val.startDate ?? '';
    const endDate = val.endDate ?? '';
    const totalTip = val.totalTip ?? 0;
    const employees = (val.employees ?? []) as PersistedState['employees'];

    if (!startDate || !endDate || employees.length === 0) return [];

    // Build rows with full validation first
    const rows = employees.map((emp): EmployeeRow => {
      const gross = (startDate && endDate && emp.startTime && emp.endTime)
        ? calculateGrossHours(emp.startTime, emp.endTime, startDate, endDate)
        : 0;

      const hoursError = validateGrossHours(emp.startTime, emp.endTime, gross);

      let shiftDateError: string | null = null;
      if (!hoursError && emp.startTime && emp.endTime && startDate && endDate) {
        try {
          const shiftEnd = resolveShiftEndDateTime(emp.startTime, emp.endTime, startDate, endDate);
          shiftDateError = validateShiftEndDate(shiftEnd, endDate);
        } catch {
          // ignore parse errors during incomplete input
        }
      }

      const hasError = hoursError !== null || shiftDateError !== null;

      // Use 0 net hours when the row has an error so it doesn't skew the distribution
      const grossForCalc = hasError ? 0 : gross;
      const breakWarning = (!hasError && emp.hasBreak) ? validateBreak(grossForCalc, emp.breakHours) : null;
      const netHours = hasError
        ? 0
        : emp.hasBreak
          ? calculateNetHours(grossForCalc, emp.breakHours)
          : grossForCalc;

      return { name: emp.name, grossHours: gross, netHours, tipAmount: null, hoursError, shiftDateError, breakWarning, hasError };
    });

    // Distribute tips only over valid rows
    const netHoursList = rows.map(r => r.netHours);
    const tips = totalTip > 0 ? distributeTips(netHoursList, totalTip) : null;

    return rows.map((row, i) => ({ ...row, tipAmount: tips ? tips[i] : null }));
  });

  totalNetHours = computed(() => this.employeeRows().reduce((s, r) => s + r.netHours, 0));

  totalDistributed = computed(() => {
    const rows = this.employeeRows();
    if (rows.some(r => r.tipAmount === null)) return null;
    return rows.reduce((s, r) => s + r.tipAmount!, 0);
  });

  hasZeroHoursWarning = computed(() => {
    const val = this.formValue();
    const employees = (val.employees ?? []) as PersistedState['employees'];
    return employees.length > 0 && this.totalNetHours() === 0;
  });

  get employeesArray(): FormArray {
    return this.form.get('employees') as FormArray;
  }

  ngOnInit(): void {
    const saved = this.storage.load<PersistedState>();
    if (saved) {
      this.form.patchValue({
        eventName: saved.event.eventName ?? '',
        startDate: saved.event.startDate,
        endDate: saved.event.endDate,
        totalTip: saved.event.totalTip,
      });
      saved.employees.forEach(emp => this.addEmployee(emp));
    } else {
      this.addEmployee();
    }
    this.formValue.set(this.form.value);

    this.form.valueChanges.subscribe(val => {
      this.formValue.set(val);
      this.saveToStorage();
      // Re-validate endDate when startDate changes
      this.form.get('endDate')?.updateValueAndValidity({ emitEvent: false });
    });
  }

  private saveToStorage(): void {
    const val = this.form.value;
    const state: PersistedState = {
      event: {
        eventName: val.eventName ?? '',
        startDate: val.startDate ?? '',
        endDate: val.endDate ?? '',
        totalTip: val.totalTip ?? null,
      },
      employees: ((val.employees ?? []) as PersistedState['employees']).map(e => ({
        name: e.name ?? '',
        startTime: e.startTime ?? '',
        endTime: e.endTime ?? '',
        hasBreak: e.hasBreak ?? false,
        breakHours: e.breakHours ?? 0,
      })),
    };
    this.storage.save(state);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'n') {
      event.preventDefault();
      this.addEmployee();
    }
  }

  addEmployee(defaults?: PersistedState['employees'][0]): void {
    const group = this.fb.group({
      name: [defaults?.name ?? ''],
      startTime: [defaults?.startTime ?? ''],
      endTime: [defaults?.endTime ?? ''],
      hasBreak: [defaults?.hasBreak ?? false],
      breakHours: [defaults?.breakHours ?? 0],
    });
    this.employeesArray.push(group);
  }

  removeEmployee(index: number): void {
    this.employeesArray.removeAt(index);
  }

  incrementBreak(index: number): void {
    const ctrl = this.employeesArray.at(index).get('breakHours');
    if (ctrl) ctrl.setValue(Math.round((ctrl.value + 0.25) * 100) / 100);
  }

  decrementBreak(index: number): void {
    const ctrl = this.employeesArray.at(index).get('breakHours');
    if (ctrl) ctrl.setValue(Math.max(0, Math.round((ctrl.value - 0.25) * 100) / 100));
  }

  reset(): void {
    this.storage.clear();
    while (this.employeesArray.length > 0) {
      this.employeesArray.removeAt(0);
    }
    this.form.reset({ eventName: '', startDate: '', endDate: '', totalTip: null });
    this.addEmployee();
    this.formValue.set(this.form.value);
  }

  async exportPdf(): Promise<void> {
    const val = this.form.value;
    const rows = this.employeeRows();
    const employees = (val.employees ?? []) as PersistedState['employees'];

    this.isExporting.set(true);
    try {
      await this.pdfService.exportPdf({
        eventName: val.eventName ?? '',
        startDate: val.startDate ?? '',
        endDate: val.endDate ?? '',
        totalTip: val.totalTip ?? 0,
        employees: employees.map((e, i) => ({
          name: e.name,
          startTime: e.startTime,
          endTime: e.endTime,
          hasBreak: e.hasBreak,
          breakHours: e.breakHours,
          netHours: rows[i]?.netHours ?? 0,
          tipAmount: rows[i]?.tipAmount ?? null,
        })),
        totalNetHours: this.totalNetHours(),
      });
    } finally {
      this.isExporting.set(false);
    }
  }

  triggerImport(): void {
    this.importInput.nativeElement.value = '';
    this.importInput.nativeElement.click();
  }

  async onImportFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const state = await this.pdfService.importFromPdf(file);
    if (!state) {
      this.snackBar.open('Import fehlgeschlagen — keine gültigen Daten in der PDF gefunden.', 'OK', { duration: 4000 });
      return;
    }
    this.applyImportedState(state);
    this.snackBar.open('Daten erfolgreich importiert.', 'OK', { duration: 3000 });
  }

  private applyImportedState(state: ImportedState): void {
    while (this.employeesArray.length > 0) {
      this.employeesArray.removeAt(0);
    }
    this.form.patchValue({
      eventName: state.eventName,
      startDate: state.startDate,
      endDate: state.endDate,
      totalTip: state.totalTip,
    });
    state.employees.forEach(emp => this.addEmployee(emp));
    this.formValue.set(this.form.value);
    this.saveToStorage();
  }

  formatHours(h: number): string {
    return h.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatEuro(amount: number): string {
    return (
      amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
    );
  }
}
