import { str, strAr, pruneUndefined } from '@shared/utils/mapper.util';
import { EmploymentDetails, PerformanceRecord } from '../../domain/entities/employment';

/** Oracle row → employment domain (Anticorruption Layer). */
export class EmployeeMapper {
  static toEmployment(row: Record<string, any> | undefined): EmploymentDetails | undefined {
    if (!row) return undefined;
    return pruneUndefined<EmploymentDetails>({
      ...row,
      employeeNumber: str(row, 'employee_number') ?? str(row, 'employeenumber'),
      assignmentId: str(row, 'assignment_id') ?? str(row, 'assignmentid'),
      grade: str(row, 'grade'),
      department: str(row, 'department') ?? str(row, 'organization'),
      departmentAr: strAr(row, 'department_ar') ?? strAr(row, 'organization_ar'),
      supervisorName: str(row, 'supervisor_name') ?? str(row, 'supervisorname'),
    });
  }

  static toPerformance(row: Record<string, any>): PerformanceRecord {
    return pruneUndefined<PerformanceRecord>({
      ...row,
      period: str(row, 'period') ?? str(row, 'appraisal_period'),
      rating: str(row, 'rating') ?? str(row, 'overall_rating'),
    });
  }
}
