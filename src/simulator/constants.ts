export const SIMULATOR_VERSION = "0.2.0" as const;
export const RULESET_VERSION = "0.2.0" as const;

// 0.2B component qualification candidate set A (benchmark-tuned, not permanent)
export const CRITICAL_COMPONENT_DAMAGE_THRESHOLD = 10 as const;
export const HIGH_DAMAGE_COMPONENT_THRESHOLD = 35 as const;
// Proportion of base damage when weapon component is damaged
export const DAMAGED_WEAPON_MULTIPLIER = 0.75 as const;
// Speed penalty when mobility component is damaged
export const DAMAGED_MOBILITY_SPEED_PENALTY = 2 as const;
// Reduced cooling bonus when cooling utility is damaged
export const DAMAGED_COOLING_BONUS = 2 as const;
export const MAX_ROUNDS = 20 as const;

export const STARTING_ENERGY = 100 as const;
export const STARTING_HEAT = 0 as const;
export const MAX_HEAT = 100 as const;

export const ENERGY_REGEN_PER_ROUND = 10 as const;
export const HEAT_DISSIPATION_PER_ROUND = 15 as const;
export const ATTACK_ENERGY_COST = 15 as const;
export const ATTACK_HEAT_GAIN = 20 as const;
export const DEFEND_HEAT_GAIN = 5 as const;
export const COOLING_BONUS = 5 as const;
export const OVERHEAT_RECOVERY_AMOUNT = 30 as const;

export const BASE_HIT_CHANCE = 0.5 as const;
export const DAMAGE_VARIANCE = 0.2 as const;
export const ARMOUR_ABSORPTION_FACTOR = 0.5 as const;
export const MINIMUM_DAMAGE = 1 as const;
export const CRITICAL_HIT_THRESHOLD = 0.7 as const;

export const RAM_MOMENTUM_DIVISOR = 20 as const;
export const RAM_MAX_MULTIPLIER = 1.5 as const;

export const HAMMER_TOP_ACCURACY_BONUS = 0.2 as const;
export const HAMMER_TOP_DAMAGE_BONUS = 0.15 as const;

export const SPINNER_KNOCKBACK_CHANCE = 0.5 as const;

export const GRAPPLER_BASE_DAMAGE = 10 as const;
export const GRAPPLER_PULL_CHANCE = 0.5 as const;

export const FLIPPER_BASE_CHANCE = 0.4 as const;
export const MAX_OVERTURN_CHANCE = 0.8 as const;
export const OVERTURNED_DEFENCE_PENALTY = 0.5 as const;

export const COMPONENT_DAMAGE_CHANCE = 0.25 as const;

export const JUDGE_DAMAGE_WEIGHT = 3 as const;
export const JUDGE_MOBILITY_WEIGHT = 2 as const;
export const JUDGE_WEAPON_WEIGHT = 2 as const;
export const JUDGE_AGGRESSION_WEIGHT = 1 as const;
export const JUDGE_INTEGRITY_WEIGHT = 2 as const;
export const MAX_EXPECTED_DAMAGE = 200 as const;

export const OVERCLOCKED_DEFEND_HEAT_REDUCTION = 10 as const;
