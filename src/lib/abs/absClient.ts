// src/lib/abs/absClient.ts

export async function fetchCensusData(
  lgaCode: string,
  datasetId: string
) {
  // TEMP: replace with real ABS API later
  return {
    lgaCode,
    datasetId,
    value: 178000,
    year: 2021,
    source: "Australian Bureau of Statistics"
  }
}
