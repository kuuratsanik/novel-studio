import { strict as assert } from "node:assert";
import test from "node:test";
import { SeriesState, applyPatchesTo, proposeStatePatches, statePrompt } from "../core/state";

function seriesState(): SeriesState {
  return {
    updated: "",
    characters: [
      {
        name: "Iskra",
        location: "Dock",
        status: "alive",
        inventory: [],
        relationships: {},
        facts: [],
      },
    ],
  };
}

test("proposes a location change from prose", () => {
  const patches = proposeStatePatches("Iskra walked in Harbor and picked up the lantern.", seriesState());
  assert.ok(patches.some((p) => p.field === "location" && p.to === "Harbor"));
});

test("proposes an inventory pickup from prose", () => {
  const patches = proposeStatePatches("Iskra walked in Harbor and picked up the lantern.", seriesState());
  assert.ok(patches.some((p) => p.field === "facts+" && p.to.includes("lantern")));
});

test("proposes a death only once the prose says so", () => {
  assert.equal(proposeStatePatches("Iskra smiled.", seriesState()).some((p) => p.field === "status"), false);
  assert.ok(proposeStatePatches("Iskra died at the gate.", seriesState()).some((p) => p.to === "dead"));
});

test("does not re-propose the location the character already has", () => {
  const patches = proposeStatePatches("Iskra stood at Dock.", seriesState());
  assert.equal(patches.some((p) => p.field === "location"), false);
});

test("treats a character name containing regex characters literally", () => {
  const state = seriesState();
  state.characters[0].name = "K. Vance (the Broker)";
  assert.doesNotThrow(() => proposeStatePatches("K. Vance (the Broker) waited at Harbor.", state));
});

test("applying patches mutates inventory, facts, location and status", () => {
  const state = seriesState();
  const applied = applyPatchesTo(state, [
    { name: "Iskra", field: "location", from: "Dock", to: "Harbor" },
    { name: "Iskra", field: "facts+", from: "", to: "lantern" },
    { name: "Iskra", field: "status", from: "alive", to: "dead" },
  ]);
  assert.equal(applied, 3);
  assert.equal(state.characters[0].location, "Harbor");
  assert.equal(state.characters[0].status, "dead");
  assert.deepEqual(state.characters[0].inventory, ["lantern"]);
  assert.deepEqual(state.characters[0].facts, ["acquired lantern"]);
});

test("ignores patches for characters not in state", () => {
  const state = seriesState();
  applyPatchesTo(state, [{ name: "Nobody", field: "location", from: "a", to: "b" }]);
  assert.equal(state.characters[0].location, "Dock");
});

test("summarizes state for the prompt, including the empty case", () => {
  assert.match(statePrompt({ updated: "", characters: [] }), /Series state is empty/);
  assert.match(statePrompt(seriesState()), /Iskra @ Dock \[alive\]/);
});
