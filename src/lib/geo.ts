/** Countries and state/region lists for company & branch location settings. */

export const COUNTRIES = [
  'Ghana', 'Nigeria', 'Côte d\'Ivoire', 'Togo', 'Benin', 'Burkina Faso', 'Senegal', 'Mali',
  'Liberia', 'Sierra Leone', 'Guinea', 'The Gambia', 'Niger', 'Cameroon', 'South Africa',
  'Kenya', 'Ethiopia', 'Tanzania', 'Uganda', 'Rwanda', 'Zambia', 'Zimbabwe', 'Botswana',
  'Namibia', 'Egypt', 'Morocco', 'Algeria', 'Tunisia', 'Democratic Republic of the Congo',
  'Angola', 'Mozambique', 'United Kingdom', 'United States', 'Canada', 'France', 'Germany',
  'Netherlands', 'Belgium', 'Spain', 'Portugal', 'Italy', 'Switzerland', 'Ireland', 'Sweden',
  'Norway', 'Denmark', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Turkey', 'India',
  'China', 'Japan', 'Singapore', 'Malaysia', 'Australia', 'New Zealand', 'Brazil', 'Mexico',
] as const

/** The 16 administrative regions of Ghana. */
export const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra',
  'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta',
  'Western', 'Western North',
] as const

/** State/region options per country. Countries not listed fall back to free text. */
export const REGIONS_BY_COUNTRY: Record<string, readonly string[]> = {
  Ghana: GHANA_REGIONS,
  Nigeria: [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT Abuja', 'Gombe', 'Imo',
    'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
    'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
    'Yobe', 'Zamfara',
  ],
}

/** Region options for a country, or null when the country uses free-text input. */
export function regionsFor(country?: string): readonly string[] | null {
  if (!country) return null
  return REGIONS_BY_COUNTRY[country] ?? null
}
