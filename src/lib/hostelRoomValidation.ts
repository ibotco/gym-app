/** Existing room capacity remains the canonical number of beds. */
export function hostelRoomNumberError(capacity: string, costPerBed: string): string | null {
  const beds=capacity.trim(), cost=costPerBed.trim()
  if (!/^\d+$/.test(beds) || !Number.isSafeInteger(Number(beds)) || Number(beds)<1 || Number(beds)>2147483647) return 'No Of Beds must be a positive whole number.'
  if (!/^\d+(?:\.\d{1,2})?$/.test(cost) || !Number.isFinite(Number(cost))) return 'Cost Per Bed must be a non-negative amount with up to two decimal places.'
  return null
}
