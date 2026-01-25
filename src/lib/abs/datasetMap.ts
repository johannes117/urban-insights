// src/lib/abs/datasetMap.ts
// NOTE: 2021 is the latest available ABS Census.
// Update this when 2026 Census data is released.

export type CensusTopic =
  | "population"
  | "age"
  | "housing"
  | "employment"

export const DATASET_MAP: Record<CensusTopic, string> = {
  population: "ABS_CENSUS_2021_POPULATION",
  age: "ABS_CENSUS_2021_AGE",
  housing: "ABS_CENSUS_2021_HOUSING",
  employment: "ABS_CENSUS_2021_EMPLOYMENT"
}
