import { runMatch } from "./simulator/simulator.js";
import { renderAsciiReplay } from "./replay/ascii/ascii-replay-renderer.js";
import { validateBuild } from "./validation/build-validator.js";
import { CATALOGUE_V1 } from "./catalogue/catalogue.v1.js";
import { createBulwarkBuild, BULWARK_POLICY } from "./agents/scripted/bulwark-agent.js";

const buildResult = validateBuild(
  {
    machineName: "Iron Cicada",
    chassisId: "light",
    mobilityId: "wheels",
    weaponId: "grappler",
    utilityId: "none",
    armour: { front: 5, left: 5, right: 5, rear: 5, top: 5 },
    designSummary: "A fast flanker.",
    designRationale: "Circle and attack the rear.",
  },
  CATALOGUE_V1,
);
if (!buildResult.ok) throw new Error("Invalid");

const match = runMatch({
  seed: 42,
  fighterA: {
    build: buildResult.build,
    policy: {
      opening: "flank",
      preferredRange: "close",
      aggression: 70,
      primaryTarget: "rear",
      secondaryTarget: "left",
      retreatThreshold: 20,
      heatThreshold: 80,
      fallback: "retreat",
    },
  },
  fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
  rulesetVersion: "1",
  catalogueVersion: "1",
});
const output = renderAsciiReplay(match);
const lines = output.split("\n");
for (const [i, line] of lines.entries()) {
  if (line.length > 80) console.log(`Line ${i}: [${line.length}] ${line}`);
}
