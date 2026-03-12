import type {
  DashboardSnapshot,
  MacroTotals,
  MealGroup,
  MealSlot,
  WeeklyTrendPoint,
} from "@/app/lib/dashboard-types";
import { normalizeDate, shiftDate } from "@/app/lib/date-utils";

import type { DashboardRepository } from "./types";

const ZERO_MACROS: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
};

const TARGETS = {
  calories: 2200,
  protein: 170,
  carbs: 210,
  fat: 75,
  fiber: 30,
};

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

function hash(input: string): number {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) >>> 0;
  }
  return value;
}

function seededNumber(seed: string, min: number, max: number): number {
  const ratio = (hash(seed) % 10000) / 10000;
  return min + ratio * (max - min);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function add(left: MacroTotals, right: MacroTotals): MacroTotals {
  return {
    calories: round(left.calories + right.calories),
    protein: round(left.protein + right.protein),
    carbs: round(left.carbs + right.carbs),
    fat: round(left.fat + right.fat),
    fiber: round(left.fiber + right.fiber),
  };
}

function buildTotals(date: string): MacroTotals {
  return {
    calories: round(seededNumber(`${date}:calories`, 1550, 2650)),
    protein: round(seededNumber(`${date}:protein`, 95, 210)),
    carbs: round(seededNumber(`${date}:carbs`, 110, 295)),
    fat: round(seededNumber(`${date}:fat`, 40, 96)),
    fiber: round(seededNumber(`${date}:fiber`, 15, 43)),
  };
}

function buildMealGroups(date: string, totals: MacroTotals): MealGroup[] {
  const splits: Record<MealSlot, number> = {
    breakfast: 0.24,
    lunch: 0.31,
    dinner: 0.33,
    snack: 0.12,
  };

  return (Object.keys(splits) as MealSlot[]).map((slot) => {
    const scale = splits[slot];
    const slotTotals: MacroTotals = {
      calories: round(totals.calories * scale),
      protein: round(totals.protein * scale),
      carbs: round(totals.carbs * scale),
      fat: round(totals.fat * scale),
      fiber: round(totals.fiber * scale),
    };

    return {
      mealSlot: slot,
      label: SLOT_LABELS[slot],
      totals: slotTotals,
      entries: [
        {
          id: `${date}:${slot}:entry-1`,
          date,
          mealSlot: slot,
          label: `${SLOT_LABELS[slot]} sample meal`,
          servingText: "1 serving",
          macros: slotTotals,
        },
      ],
    };
  });
}

function buildWeeklyTrend(date: string): WeeklyTrendPoint[] {
  return Array.from({ length: 7 }, (_, idx) => {
    const pointDate = shiftDate(date, idx - 6);
    return {
      date: pointDate,
      calories: round(seededNumber(`${pointDate}:trend:calories`, 1500, 2800)),
      target: TARGETS.calories,
      protein: round(seededNumber(`${pointDate}:trend:protein`, 90, 220)),
    };
  });
}

function momentumLabel(adherence: number): string {
  if (adherence >= 88) return "Locked in";
  if (adherence >= 72) return "On pace";
  return "Needs a reset";
}

function coachNote(remaining: MacroTotals): string {
  if (remaining.calories < 0) {
    return `You are ${Math.abs(Math.round(remaining.calories))} kcal over target. Keep the next meal lighter.`;
  }
  if (remaining.protein > 35) {
    return `You still have ${Math.round(remaining.protein)}g protein runway. A lean protein meal closes the gap.`;
  }
  if (remaining.fiber > 8) {
    return "Fiber is trailing. Add fruit, oats, beans, or greens to the next entry.";
  }
  return "The day is balanced. Keep the same rhythm for the evening.";
}

function buildSuggestions(remaining: MacroTotals): string[] {
  const items: string[] = [];
  if (remaining.protein > 30) {
    items.push("Add a 25-30g protein anchor before day-end.");
  }
  if (remaining.calories > 150 && remaining.calories < 450) {
    items.push("You have room for one compact snack.");
  }
  if (remaining.calories < 0) {
    items.push("Favor produce and lean protein for your next meal.");
  }
  return items.length ? items : ["Momentum looks good. Repeat this structure tomorrow."];
}

export class MockDashboardRepository implements DashboardRepository {
  async getDashboardSnapshot(dateInput: string): Promise<DashboardSnapshot> {
    const date = normalizeDate(dateInput);
    const totals = buildTotals(date);
    const mealGroups = buildMealGroups(date, totals);

    const recomputed = mealGroups.reduce((sum, meal) => add(sum, meal.totals), {
      ...ZERO_MACROS,
    });

    const remaining: MacroTotals = {
      calories: round(TARGETS.calories - recomputed.calories),
      protein: round(TARGETS.protein - recomputed.protein),
      carbs: round(TARGETS.carbs - recomputed.carbs),
      fat: round(TARGETS.fat - recomputed.fat),
      fiber: round(TARGETS.fiber - recomputed.fiber),
    };

    const calorieDelta = round(recomputed.calories - TARGETS.calories);
    const adherenceScore = Math.max(
      50,
      Math.round(100 - Math.abs(calorieDelta) / 24 - Math.abs(remaining.protein) / 4)
    );

    return {
      stateVersion: hash(`${date}:version`) % 100000,
      date,
      summary: {
        date,
        targets: TARGETS,
        totals: recomputed,
        remaining,
        adherenceScore,
        proteinRunway: remaining.protein,
        calorieDelta,
        streak: (hash(`${date}:streak`) % 6) + 2,
        momentumLabel: momentumLabel(adherenceScore),
        coachNote: coachNote(remaining),
      },
      mealGroups,
      suggestions: buildSuggestions(remaining),
      weeklyTrend: buildWeeklyTrend(date),
    };
  }
}
