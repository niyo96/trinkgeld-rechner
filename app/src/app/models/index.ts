export interface Employee {
  id: string;
  name: string;
  startTime: string;   // "HH:mm"
  endTime: string;     // "HH:mm"
  hasBreak: boolean;
  breakHours: number;  // multiple of 0.25
}

export interface TipEvent {
  id: string;
  eventName: string;
  startDate: string;   // "YYYY-MM-DD"
  endDate: string;     // "YYYY-MM-DD"
  totalTip: number;    // Euro
  employees: Employee[];
}

export interface EmployeeResult {
  employee: Employee;
  netHours: number;
  tipAmount: number;
  warning?: string;
}

export interface TipCalculationResult {
  employeeResults: EmployeeResult[];
  totalNetHours: number;
  totalTipDistributed: number;
  hasZeroHoursWarning: boolean;
}
