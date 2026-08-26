export const REVISION_MODES = {
  structure: "Revise for scene structure only: goal, turn, exit. Do not line-edit diction.",
  causality: "Revise only to fix cause-and-effect holes. Keep voice and length close to the original.",
  dialogue: "Revise dialogue only. Attribution and action beats may change; narration stays.",
  sensory: "Increase sensory density. No new plot facts. Cut abstract summary.",
  cut10: "Cut about 10% of words. Prefer verbs over adjectives. Keep meaning.",
} as const;

export type RevisionMode = keyof typeof REVISION_MODES;
