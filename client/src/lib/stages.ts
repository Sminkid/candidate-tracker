import { stages, type Stage } from "../api/types";

export const stageLabels: Record<Stage, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

// For values from outside the type system, e.g. the URL or a <select>.
export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (stages as readonly string[]).includes(value);
}
