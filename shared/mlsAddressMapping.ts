export interface AddressLookupResponse {
  ListingKey?: string | number | null;
  ListingKeyNumeric?: string | number | null;
  ListingId?: string | number | null;
  MLSNumber?: string | number | null;
  ListAgentMlsId?: string | null;
  ListAgentFullName?: string | null;
  ListingAgent?: string | null;
  UnparsedAddress?: string | null;
  City?: string | null;
  PostalCode?: string | null;
  SubdivisionName?: string | null;
  Neighborhood?: string | null;
  ListPrice?: number | string | null;
  BedroomsTotal?: number | string | null;
  BathroomsTotal?: number | string | null;
  BathroomsTotalDecimal?: number | string | null;
  BathroomsTotalInteger?: number | string | null;
  BathroomsFull?: number | string | null;
  BathroomsHalf?: number | string | null;
  LivingArea?: number | string | null;
  MlsStatus?: string | null;
  ListingContractDate?: string | null;
  OnMarketDate?: string | null;
  PublicRemarks?: string | null;
  Media?: Array<{ MediaURL?: string | null }> | null;
  mlsNumber?: string | null;
  [key: string]: unknown;
}

export interface MappedAddressProperty {
  id: string;
  mlsId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  listPrice: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  propertyType: string;
  listingStatus: string;
  listingDate: string;
  description: string;
  features: string[];
  photoUrls: string[];
  neighborhood: string | null;
  agentName: string | null;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstString(...values: Array<unknown>): string {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return "";
}

/**
 * Picks the listing's own MLS number from a GBCMA / Simple-CMA / Paragon
 * address-lookup payload. NEVER returns the listing agent's MLS member ID
 * (`ListAgentMlsId`) — that is the agent's identifier, not the listing's.
 */
export function pickListingMlsNumber(p: AddressLookupResponse): string {
  return firstString(
    p.ListingId,
    p.MLSNumber,
    p.mlsNumber,
    p.ListingKeyNumeric,
    p.ListingKey,
  );
}

/**
 * Picks the bathroom count using the standard RESO field order:
 *   BathroomsTotalDecimal → BathroomsTotalInteger → BathroomsFull + 0.5 * BathroomsHalf → BathroomsTotal
 * Returns null when no value is available so callers can show "blank"
 * instead of a misleading 0.
 */
export function pickBathrooms(p: AddressLookupResponse): number | null {
  const decimal = toFiniteNumber(p.BathroomsTotalDecimal);
  if (decimal !== null) return decimal;

  const integer = toFiniteNumber(p.BathroomsTotalInteger);
  if (integer !== null) return integer;

  const full = toFiniteNumber(p.BathroomsFull);
  const half = toFiniteNumber(p.BathroomsHalf);
  if (full !== null || half !== null) {
    return (full ?? 0) + 0.5 * (half ?? 0);
  }

  return toFiniteNumber(p.BathroomsTotal);
}

/**
 * Maps an address-lookup response into the Property shape used by the
 * property selector. Numeric fields fall through to null (instead of 0)
 * when the upstream service does not provide a value, so missing data
 * is visible rather than silently looking like a real "0".
 */
export function mapAddressLookupToProperty(
  p: AddressLookupResponse,
  fallbackAddress = "",
): MappedAddressProperty {
  const photoUrls = Array.isArray(p.Media)
    ? p.Media.map((m) => m?.MediaURL).filter(
        (u): u is string => typeof u === "string" && u.length > 0,
      )
    : [];

  return {
    id: firstString(p.ListingKey, p.ListingId, p.MLSNumber) || "auto-found",
    mlsId: pickListingMlsNumber(p),
    address: firstString(p.UnparsedAddress) || fallbackAddress,
    city: firstString(p.City),
    state: "NE",
    zipCode: firstString(p.PostalCode),
    listPrice: toFiniteNumber(p.ListPrice),
    bedrooms: toFiniteNumber(p.BedroomsTotal),
    bathrooms: pickBathrooms(p),
    squareFootage: toFiniteNumber(p.LivingArea),
    propertyType: "Residential",
    listingStatus: firstString(p.MlsStatus),
    listingDate: firstString(p.ListingContractDate, p.OnMarketDate),
    description: firstString(p.PublicRemarks),
    features: [],
    photoUrls,
    neighborhood: firstString(p.SubdivisionName, p.Neighborhood) || null,
    agentName: firstString(p.ListAgentFullName) || null,
  };
}
