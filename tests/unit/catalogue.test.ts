import { describe, it, expect } from "vitest";
import { getCatalogue, latestCatalogueVersion } from "../../src/catalogue/catalogue.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";

describe("catalogue", () => {
  it("has version 1", () => {
    expect(CATALOGUE_V1.version).toBe("1");
  });

  it("has budget of 100", () => {
    expect(CATALOGUE_V1.budget).toBe(100);
  });

  it("latestCatalogueVersion returns 1", () => {
    expect(latestCatalogueVersion()).toBe("1");
  });

  it("getCatalogue returns v1", () => {
    expect(getCatalogue("1")).toBe(CATALOGUE_V1);
  });

  it("getCatalogue returns undefined for unknown version", () => {
    expect(getCatalogue("999")).toBeUndefined();
  });
});

describe("chassis", () => {
  const chassis = CATALOGUE_V1.chassis;

  it("has 3 chassis", () => {
    expect(chassis).toHaveLength(3);
  });

  it("has unique IDs", () => {
    const ids = chassis.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("light chassis has correct values", () => {
    const light = chassis.find((c) => c.id === "light")!;
    expect(light.cost).toBe(15);
    expect(light.integrity).toBe(60);
    expect(light.baseMass).toBe(10);
    expect(light.agility).toBe(9);
    expect(light.stability).toBe(4);
  });

  it("medium chassis has correct values", () => {
    const medium = chassis.find((c) => c.id === "medium")!;
    expect(medium.cost).toBe(25);
    expect(medium.integrity).toBe(100);
    expect(medium.baseMass).toBe(20);
    expect(medium.agility).toBe(6);
    expect(medium.stability).toBe(6);
  });

  it("heavy chassis has correct values", () => {
    const heavy = chassis.find((c) => c.id === "heavy")!;
    expect(heavy.cost).toBe(40);
    expect(heavy.integrity).toBe(150);
    expect(heavy.baseMass).toBe(35);
    expect(heavy.agility).toBe(3);
    expect(heavy.stability).toBe(9);
  });
});

describe("mobility", () => {
  const mobility = CATALOGUE_V1.mobility;

  it("has 3 mobility options", () => {
    expect(mobility).toHaveLength(3);
  });

  it("has unique IDs", () => {
    const ids = mobility.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("wheels has correct values", () => {
    const w = mobility.find((m) => m.id === "wheels")!;
    expect(w.cost).toBe(12);
    expect(w.speed).toBe(9);
    expect(w.traction).toBe(6);
    expect(w.turning).toBe(9);
    expect(w.stabilityModifier).toBe(0);
  });

  it("tracks has correct values", () => {
    const t = mobility.find((m) => m.id === "tracks")!;
    expect(t.cost).toBe(20);
    expect(t.speed).toBe(5);
    expect(t.traction).toBe(9);
    expect(t.turning).toBe(5);
    expect(t.stabilityModifier).toBe(2);
  });

  it("legs has correct values", () => {
    const l = mobility.find((m) => m.id === "legs")!;
    expect(l.cost).toBe(25);
    expect(l.speed).toBe(6);
    expect(l.traction).toBe(7);
    expect(l.turning).toBe(7);
    expect(l.stabilityModifier).toBe(1);
  });
});

describe("weapons", () => {
  const weapons = CATALOGUE_V1.weapons;

  it("has 5 weapons", () => {
    expect(weapons).toHaveLength(5);
  });

  it("has unique IDs", () => {
    const ids = weapons.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ram has correct values", () => {
    const r = weapons.find((w) => w.id === "ram")!;
    expect(r.cost).toBe(10);
    expect(r.baseDamage).toBe(20);
    expect(r.accuracy).toBe(80);
    expect(r.cooldown).toBe(1);
  });

  it("hammer has correct values", () => {
    const h = weapons.find((w) => w.id === "hammer")!;
    expect(h.cost).toBe(20);
    expect(h.baseDamage).toBe(35);
    expect(h.accuracy).toBe(65);
    expect(h.cooldown).toBe(2);
  });

  it("horizontal_spinner has correct values", () => {
    const hs = weapons.find((w) => w.id === "horizontal_spinner")!;
    expect(hs.cost).toBe(30);
    expect(hs.baseDamage).toBe(50);
    expect(hs.accuracy).toBe(55);
    expect(hs.cooldown).toBe(3);
  });

  it("grappler has correct values", () => {
    const g = weapons.find((w) => w.id === "grappler")!;
    expect(g.cost).toBe(20);
    expect(g.baseDamage).toBe(10);
    expect(g.accuracy).toBe(80);
    expect(g.cooldown).toBe(2);
  });

  it("flipper has correct values", () => {
    const f = weapons.find((w) => w.id === "flipper")!;
    expect(f.cost).toBe(25);
    expect(f.baseDamage).toBe(25);
    expect(f.accuracy).toBe(65);
    expect(f.cooldown).toBe(3);
  });
});

describe("utilities", () => {
  const utilities = CATALOGUE_V1.utilities;

  it("has 4 utilities", () => {
    expect(utilities).toHaveLength(4);
  });

  it("has unique IDs", () => {
    const ids = utilities.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("none has zero cost", () => {
    expect(utilities.find((u) => u.id === "none")!.cost).toBe(0);
  });

  it("cooling has correct cost", () => {
    expect(utilities.find((u) => u.id === "cooling")!.cost).toBe(10);
  });

  it("traction_boost has correct cost", () => {
    expect(utilities.find((u) => u.id === "traction_boost")!.cost).toBe(10);
  });

  it("reinforced_drive has correct cost", () => {
    expect(utilities.find((u) => u.id === "reinforced_drive")!.cost).toBe(15);
  });
});

describe("armour rules", () => {
  it("cost per ten points is 1", () => {
    expect(CATALOGUE_V1.armour.costPerTenPoints).toBe(1);
  });

  it("max per zone is 60", () => {
    expect(CATALOGUE_V1.armour.maxPerZone).toBe(60);
  });

  it("max total is 120", () => {
    expect(CATALOGUE_V1.armour.maxTotal).toBe(120);
  });
});

describe("catalogue immutability", () => {
  it("catalogue is frozen", () => {
    expect(Object.isFrozen(CATALOGUE_V1)).toBe(true);
  });

  it("chassis array is frozen", () => {
    expect(Object.isFrozen(CATALOGUE_V1.chassis)).toBe(true);
  });

  it("individual chassis is frozen", () => {
    expect(Object.isFrozen(CATALOGUE_V1.chassis[0])).toBe(true);
  });

  it("mobility array is frozen", () => {
    expect(Object.isFrozen(CATALOGUE_V1.mobility)).toBe(true);
  });

  it("weapons array is frozen", () => {
    expect(Object.isFrozen(CATALOGUE_V1.weapons)).toBe(true);
  });

  it("utilities array is frozen", () => {
    expect(Object.isFrozen(CATALOGUE_V1.utilities)).toBe(true);
  });

  it("armour rules are frozen", () => {
    expect(Object.isFrozen(CATALOGUE_V1.armour)).toBe(true);
  });
});
