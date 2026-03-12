import { MockDashboardRepository } from "./mock-dashboard-repository";
import type { DashboardRepository } from "./types";

/**
 * Phase 2 placeholder: swap this class to real Supabase-backed queries.
 * For now it intentionally falls back to the mock repository so tool
 * contracts and UI can ship before DB wiring.
 */
export class SupabaseDashboardRepository implements DashboardRepository {
  private readonly fallback = new MockDashboardRepository();

  async getDashboardSnapshot(date: string) {
    return this.fallback.getDashboardSnapshot(date);
  }
}
