export interface SeedSource {
  nextSeed(): number;
}

export class RandomSeedSource implements SeedSource {
  nextSeed(): number {
    return Math.floor(Math.random() * 1_000_000_000);
  }
}

export class DeterministicSeedSource implements SeedSource {
  private readonly seeds: readonly number[];
  private index = 0;

  constructor(seeds: readonly number[]) {
    if (seeds.length === 0) {
      throw new Error("DeterministicSeedSource requires at least one seed");
    }
    this.seeds = seeds;
  }

  nextSeed(): number {
    const seed = this.seeds[this.index % this.seeds.length]!;
    this.index++;
    return seed;
  }

  get remaining(): number {
    return this.seeds.length - this.index;
  }
}
