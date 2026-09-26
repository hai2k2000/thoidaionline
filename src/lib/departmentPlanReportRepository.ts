import "server-only";

import {
  departmentPlanRepository,
  type DepartmentPlanItemRow,
} from "@/lib/departmentPlanRepository";
import type { DepartmentPlanPeriod } from "@/lib/departmentPlanPeriod";
import {
  calculateDepartmentPlanReportMetrics,
  filterDepartmentPlanReportItems,
  type DepartmentPlanReportFilters,
  type DepartmentPlanReportItem,
  type DepartmentPlanReportMetrics,
} from "@/lib/departmentPlanReport";

export type DepartmentPlanReportResult = {
  period: DepartmentPlanPeriod;
  plan: Awaited<ReturnType<typeof departmentPlanRepository.getPeriod>>["data"];
  employees: Array<{ id: string; full_name: string; department_id: string }>;
  items: DepartmentPlanReportItem[];
  metrics: DepartmentPlanReportMetrics;
};

export const departmentPlanReportRepository = {
  async getReport(
    departmentId: string,
    period: DepartmentPlanPeriod,
    filters: DepartmentPlanReportFilters,
    effectiveNow = new Date(),
  ): Promise<
    | { data: DepartmentPlanReportResult; error: null }
    | { data: null; error: { code?: string | null; message?: string | null } }
  > {
    const [planResult, employeesResult] = await Promise.all([
      departmentPlanRepository.getPeriod(departmentId, period.periodType, period.periodStart),
      departmentPlanRepository.listActiveEmployees(departmentId),
    ]);
    if (planResult.error) return { data: null, error: planResult.error };
    if (employeesResult.error) return { data: null, error: employeesResult.error };

    const employees = employeesResult.data ?? [];
    if (filters.employeeId && !employees.some((employee) => employee.id === filters.employeeId)) {
      return {
        data: null,
        error: { code: "42501", message: "employee outside department scope" },
      };
    }

    let sourceItems: DepartmentPlanItemRow[] = [];
    if (planResult.data) {
      const itemsResult = await departmentPlanRepository.listPlanItems(planResult.data.id);
      if (itemsResult.error) return { data: null, error: itemsResult.error };
      sourceItems = itemsResult.data ?? [];
    }

    const filteredItems = filterDepartmentPlanReportItems(sourceItems, filters);
    const employeeNames = new Map(employees.map((employee) => [employee.id, employee.full_name]));
    const items = filteredItems.map((item) => ({
      ...item,
      assignee_name: item.assignee_id ? employeeNames.get(item.assignee_id) ?? null : null,
    }));

    return {
      data: {
        period,
        plan: planResult.data,
        employees,
        items,
        metrics: calculateDepartmentPlanReportMetrics(filteredItems, effectiveNow),
      },
      error: null,
    };
  },
};
