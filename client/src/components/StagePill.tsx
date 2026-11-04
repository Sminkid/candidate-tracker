import type { Stage } from "../api/types";
import { stageLabels } from "../lib/stages";

// The label text is always shown; the colour only repeats it.
export function StagePill({ stage }: { stage: Stage }) {
  return <span className={`pill pill--${stage}`}>{stageLabels[stage]}</span>;
}
