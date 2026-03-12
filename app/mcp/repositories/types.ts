import type { DashboardSnapshot } from "@/app/lib/dashboard-types";

export interface DashboardRepository {
  getDashboardSnapshot(date: string): Promise<DashboardSnapshot>;
}
