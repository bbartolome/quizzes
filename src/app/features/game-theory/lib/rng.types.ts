// Type-only. Copied verbatim from docs/specs/game-theory.md §4.1.
// Implementations (hashSeed, mulberry32) land in G2.

export type Rng = () => number; // [0, 1)
