/** Employment domain entities (framework-free). See Docs_Ai/Domains (Employee). */
export interface EmploymentDetails {
  employeeNumber?: string;
  assignmentId?: string;
  grade?: string;
  department?: string;
  departmentAr?: string;
  supervisorName?: string;
  [extra: string]: unknown;
}

export interface PerformanceRecord {
  period?: string;
  rating?: string;
  [extra: string]: unknown;
}

export interface SupervisorView {
  [field: string]: unknown;
}
