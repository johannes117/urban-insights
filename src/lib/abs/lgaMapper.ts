// src/lib/abs/lgaMapper.ts

/**
 * Maps LGA names to ABS LGA codes (ASGS 2021)
 * Source: ABS ASGS 2021 LGA classification
 */

export const LGA_NAME_TO_CODE: Record<string, string> = {
  "City of Melbourne": "LGA24600",
  "City of Port Phillip": "23060",
  "City of Yarra": "22990"
  // add more 
}

export function getLgaCode(lgaName: string): string | null {
  return LGA_NAME_TO_CODE[lgaName] ?? null
}
