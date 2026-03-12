export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type GoalTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type MealEntry = {
  id: string;
  date: string;
  mealSlot: MealSlot;
  label: string;
  servingText: string;
  macros: MacroTotals;
};

export type MealGroup = {
  mealSlot: MealSlot;
  label: string;
  totals: MacroTotals;
  entries: MealEntry[];
};

export type WeeklyTrendPoint = {
  date: string;
  calories: number;
  target: number;
  protein: number;
};

export type DaySummary = {
  date: string;
  targets: GoalTargets;
  totals: MacroTotals;
  remaining: MacroTotals;
  adherenceScore: number;
  proteinRunway: number;
  calorieDelta: number;
  streak: number;
  momentumLabel: string;
  coachNote: string;
};

export type DashboardSnapshot = {
  stateVersion: number;
  date: string;
  summary: DaySummary;
  mealGroups: MealGroup[];
  suggestions: string[];
  weeklyTrend: WeeklyTrendPoint[];
};

export type DashboardPayload = {
  kind: "dashboard";
  dashboard: DashboardSnapshot;
};

export type ToolPayload = DashboardPayload;
