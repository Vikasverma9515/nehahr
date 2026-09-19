// Shared Open Peeps options: friendly faces, no masks or eyepatches, professional looks.
// Open Peeps art by Pablo Stanley (CC0 1.0); rendered with DiceBear (MIT).
export const PEEP_OPTIONS = {
  face: ["smile", "smileBig", "calm", "cute", "smileTeethGap", "explaining"],
  head: [
    "afro", "bangs", "bangs2", "bun", "bun2", "buns", "cornrows", "flatTop", "hijab", "long", "longCurly", "medium1", "medium2", "medium3",
    "mediumBangs", "mediumStraight", "pomp", "short1", "short2", "short3", "short4", "short5", "twists", "turban", "grayShort", "shaved1", "dreads1",
  ],
  facialHair: ["chin", "full", "goatee1", "moustache1", "moustache3"],
  facialHairProbability: 22,
  accessories: ["glasses", "glasses2", "glasses3", "glasses4", "glasses5"],
  accessoriesProbability: 28,
  maskProbability: 0,
  clothingColor: ["e78276", "ffcf77", "78e185", "9ddadb", "8fa7df", "e279c7", "8b5cf6"],
};
export const BACKGROUNDS = ["ddd6fe", "fde68a", "a7f3d0", "fbcfe8", "bae6fd", "fed7aa"];

// ---- Pools used to give every person in the app a face automatically (see app/lib/avatars.ts) ----
const FRIENDLY = ["smile", "smileBig", "calm", "cute", "smileTeethGap", "explaining"];
const GLASSES = ["glasses", "glasses2", "glasses3", "glasses4", "glasses5"];
export const POOLS = {
  f: {
    count: 16,
    options: {
      face: FRIENDLY,
      head: ["bangs", "bangs2", "bun", "bun2", "buns", "hijab", "long", "longCurly", "medium1", "medium2", "medium3", "mediumBangs", "mediumStraight", "twists", "afro", "cornrows"],
      facialHairProbability: 0,
      accessories: GLASSES, accessoriesProbability: 22, maskProbability: 0,
      clothingColor: PEEP_OPTIONS.clothingColor,
    },
  },
  m: {
    count: 16,
    options: {
      face: FRIENDLY,
      head: ["flatTop", "pomp", "short1", "short2", "short3", "short4", "short5", "shaved1", "shaved2", "afro", "cornrows", "grayShort", "turban", "dreads1"],
      facialHair: ["chin", "full", "goatee1", "moustache1", "moustache3"], facialHairProbability: 35,
      accessories: GLASSES, accessoriesProbability: 22, maskProbability: 0,
      clothingColor: PEEP_OPTIONS.clothingColor,
    },
  },
  n: {
    count: 10,
    options: {
      face: FRIENDLY,
      head: ["short1", "short2", "short3", "medium1", "medium2", "afro", "bangs2", "mediumBangs", "twists"],
      facialHairProbability: 0,
      accessories: GLASSES, accessoriesProbability: 25, maskProbability: 0,
      clothingColor: PEEP_OPTIONS.clothingColor,
    },
  },
};
// Faces that did not come out well are skipped here (the pool is then renumbered).
export const SKIP = { f: [], m: [8], n: [] }; // m-8 reads as feminine, so it is left out
