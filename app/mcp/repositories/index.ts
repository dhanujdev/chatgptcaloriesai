import { createSupabaseServerClient } from "@/app/mcp/supabase/client";

import { MockDashboardRepository } from "./mock-dashboard-repository";
import { SupabaseDashboardRepository } from "./supabase-dashboard-repository";
import type { DashboardRepository } from "./types";

export type RepositorySelection = {
  repository: DashboardRepository;
  mode: "mock" | "supabase";
};

export function createDashboardRepository(): RepositorySelection {
  const supabase = createSupabaseServerClient();

  if (supabase) {
    return {
      repository: new SupabaseDashboardRepository(),
      mode: "supabase",
    };
  }

  return {
    repository: new MockDashboardRepository(),
    mode: "mock",
  };
}
