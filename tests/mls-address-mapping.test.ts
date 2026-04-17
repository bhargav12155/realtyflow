import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapAddressLookupToProperty,
  pickListingMlsNumber,
  pickBathrooms,
} from "../shared/mlsAddressMapping";

describe("pickListingMlsNumber", () => {
  it("never returns the agent's MLS member ID when ListingId is present", () => {
    const result = pickListingMlsNumber({
      ListingId: "22019876",
      MLSNumber: null,
      ListAgentMlsId: "AGENT-12345",
    });
    assert.equal(result, "22019876");
    assert.notEqual(result, "AGENT-12345");
  });

  it("falls back to MLSNumber when ListingId is missing", () => {
    const result = pickListingMlsNumber({
      MLSNumber: "22019876",
      ListAgentMlsId: "AGENT-12345",
    });
    assert.equal(result, "22019876");
  });

  it("falls back to ListingKeyNumeric / ListingKey before ever using ListAgentMlsId", () => {
    const result = pickListingMlsNumber({
      ListingKeyNumeric: 999111,
      ListAgentMlsId: "AGENT-12345",
    });
    assert.equal(result, "999111");
  });

  it("returns empty string when no listing identifier is present (does not fall back to agent ID)", () => {
    const result = pickListingMlsNumber({
      ListAgentMlsId: "AGENT-12345",
    });
    assert.equal(result, "");
  });
});

describe("pickBathrooms", () => {
  it("prefers BathroomsTotalDecimal (e.g., 2.5)", () => {
    assert.equal(
      pickBathrooms({
        BathroomsTotalDecimal: 2.5,
        BathroomsTotalInteger: 3,
        BathroomsFull: 2,
        BathroomsHalf: 1,
        BathroomsTotal: 99,
      }),
      2.5,
    );
  });

  it("falls back to BathroomsTotalInteger", () => {
    assert.equal(
      pickBathrooms({
        BathroomsTotalInteger: 3,
        BathroomsFull: 1,
      }),
      3,
    );
  });

  it("computes BathroomsFull + 0.5 * BathroomsHalf when totals are missing", () => {
    assert.equal(
      pickBathrooms({
        BathroomsFull: 2,
        BathroomsHalf: 1,
      }),
      2.5,
    );
  });

  it("handles only BathroomsHalf (treats missing full as 0)", () => {
    assert.equal(pickBathrooms({ BathroomsHalf: 1 }), 0.5);
  });

  it("falls back to BathroomsTotal as last resort", () => {
    assert.equal(pickBathrooms({ BathroomsTotal: 4 }), 4);
  });

  it("returns null when no bathroom data is present (instead of 0)", () => {
    assert.equal(pickBathrooms({}), null);
  });

  it("returns null for non-numeric / undefined values (no silent 0)", () => {
    assert.equal(
      pickBathrooms({
        BathroomsTotalDecimal: undefined,
        BathroomsTotal: "" as any,
      }),
      null,
    );
  });

  it("parses string numerics from the upstream payload", () => {
    assert.equal(
      pickBathrooms({ BathroomsTotalDecimal: "3.5" as any }),
      3.5,
    );
  });
});

describe("mapAddressLookupToProperty", () => {
  it("maps a typical GBCMA payload correctly", () => {
    const result = mapAddressLookupToProperty({
      ListingKey: "OMA12345",
      ListingId: "22019876",
      ListAgentMlsId: "AGENT-12345",
      ListAgentFullName: "Jane Agent",
      UnparsedAddress: "123 Main St, Omaha, NE 68102",
      City: "Omaha",
      PostalCode: "68102",
      ListPrice: 425000,
      BedroomsTotal: 4,
      BathroomsTotalDecimal: 2.5,
      LivingArea: 2400,
      MlsStatus: "Active",
      ListingContractDate: "2025-01-15",
      PublicRemarks: "Beautiful home",
      SubdivisionName: "Old Market",
      Media: [{ MediaURL: "https://img.example.com/a.jpg" }],
    });

    assert.equal(result.mlsId, "22019876");
    assert.notEqual(result.mlsId, "AGENT-12345");
    assert.equal(result.bathrooms, 2.5);
    assert.equal(result.bedrooms, 4);
    assert.equal(result.listPrice, 425000);
    assert.equal(result.squareFootage, 2400);
    assert.equal(result.agentName, "Jane Agent");
    assert.equal(result.neighborhood, "Old Market");
    assert.equal(result.city, "Omaha");
    assert.deepEqual(result.photoUrls, ["https://img.example.com/a.jpg"]);
  });

  it("leaves missing numeric fields as null instead of collapsing to 0", () => {
    const result = mapAddressLookupToProperty({
      ListingId: "22019876",
      UnparsedAddress: "456 Elm St",
      // No price, beds, baths, sqft
    });

    assert.equal(result.listPrice, null);
    assert.equal(result.bedrooms, null);
    assert.equal(result.bathrooms, null);
    assert.equal(result.squareFootage, null);
    assert.equal(result.mlsId, "22019876");
  });

  it("uses fallback address when payload omits UnparsedAddress", () => {
    const result = mapAddressLookupToProperty(
      { ListingId: "1" },
      "789 Oak Ave",
    );
    assert.equal(result.address, "789 Oak Ave");
  });

  it("computes 2.5 baths from BathroomsFull=2 + BathroomsHalf=1 when totals are missing", () => {
    const result = mapAddressLookupToProperty({
      ListingId: "1",
      BathroomsFull: 2,
      BathroomsHalf: 1,
    });
    assert.equal(result.bathrooms, 2.5);
  });

  it("safely handles missing Media array", () => {
    const result = mapAddressLookupToProperty({ ListingId: "1" });
    assert.deepEqual(result.photoUrls, []);
  });
});
