// src/lib/abs/lgaMapper.ts

export type LgaInfo = {
  name: string
  code: string
}

const LGA_LOOKUP: LgaInfo[] = [
  { name: "City of Melbourne", code: "LGA24600" },
  
  // Add more LGAs 
]

/**
 * Convert a human-readable LGA name into an official ABS LGA code.
 * Returns null if the LGA is not recognised.
 */
export function getLgaCode(lgaName: string): string | null {
  if (!lgaName) return null

  const match = LGA_LOOKUP.find(
    lga => lga.name.toLowerCase() === lgaName.toLowerCase()
  )

  return match ? match.code : null
}
