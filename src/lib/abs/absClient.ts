// src/lib/abs/absClient.ts
import { getLgaCode } from "./lgaMapper"

export type CensusTopic =
  | "population"
  | "age"
  | "housing"
  | "employment"

export async function fetchAbsCensusData(
  lgaName: string,
  topic: CensusTopic
) {
  const lgaCode = getLgaCode(lgaName)

  if (!lgaCode) {
    throw new Error(`Unknown LGA: ${lgaName}`)
  }

  // Placeholder: real ABS API wiring comes next
  return {
    lgaName,
    lgaCode,
    topic,
    source: "ABS Census 2021",
    data: []
  }
}
