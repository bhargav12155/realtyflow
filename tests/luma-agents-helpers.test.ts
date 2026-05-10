import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { __testing } from "../server/services/luma-agents";

const { mapAspectRatio, enforceMangaPortrait } = __testing;

describe("luma-agents mapAspectRatio", () => {
  it("passes through the 9 supported ratios verbatim", () => {
    for (const r of ["1:1", "16:9", "9:16", "4:3", "3:4", "4:5", "5:4", "3:2", "2:3"]) {
      assert.equal(mapAspectRatio(r), r);
    }
  });
  it("maps common aliases to the closest supported ratio", () => {
    assert.equal(mapAspectRatio("square"), "1:1");
    assert.equal(mapAspectRatio("landscape"), "16:9");
    assert.equal(mapAspectRatio("portrait"), "9:16");
    assert.equal(mapAspectRatio("story"), "9:16");
  });
  it("approximates numeric ratios that aren't directly supported", () => {
    // 21:9 (~2.33) is closest to 16:9 (~1.78) among supported ratios.
    assert.equal(mapAspectRatio("21:9"), "16:9");
  });
  it("falls back to 1:1 for unparseable input", () => {
    assert.equal(mapAspectRatio(""), "1:1");
    assert.equal(mapAspectRatio(undefined), "1:1");
    assert.equal(mapAspectRatio("garbage"), "1:1");
  });
});

describe("luma-agents enforceMangaPortrait", () => {
  it("leaves non-manga styles untouched", () => {
    assert.equal(enforceMangaPortrait("16:9", "photoreal"), "16:9");
    assert.equal(enforceMangaPortrait("1:1", "illustration"), "1:1");
    assert.equal(enforceMangaPortrait("16:9"), "16:9");
  });
  it("snaps non-portrait ratios to portrait when style is manga", () => {
    assert.equal(enforceMangaPortrait("16:9", "manga"), "9:16");
    assert.equal(enforceMangaPortrait("3:2", "manga"), "2:3");
    assert.equal(enforceMangaPortrait("5:4", "manga"), "4:5");
    assert.equal(enforceMangaPortrait("4:3", "manga"), "3:4");
    assert.equal(enforceMangaPortrait("1:1", "manga"), "9:16");
  });
  it("leaves already-portrait ratios alone for manga", () => {
    assert.equal(enforceMangaPortrait("9:16", "manga"), "9:16");
    assert.equal(enforceMangaPortrait("3:4", "manga"), "3:4");
    assert.equal(enforceMangaPortrait("4:5", "manga"), "4:5");
    assert.equal(enforceMangaPortrait("2:3", "manga"), "2:3");
  });
});
