//add census API handler
import { getLgaCode } from "../lib/abs/lgaMapper"
import { DATASET_MAP } from "../lib/abs/datasetMap"
import { fetchCensusData } from "../lib/abs/absClient"

export async function getCensusSummary(lgaName: string, topic: "population") {
  const lgaCode = getLgaCode(lgaName)
  if (!lgaCode) throw new Error("Unknown LGA")

  const dataset = DATASET_MAP[topic]
  return fetchCensusData(lgaCode, dataset)
}
