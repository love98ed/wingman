import { describe, expect, it } from "vitest";
import { displayName } from "@/lib/catalog/names";

describe("displayName", () => {
  it("drops store prefixes and stock codes, and calms all-caps titles", () => {
    expect(displayName("COLONY CLOTHING / NAPOLI LINEN SHIRT / 9404/1", "Colony Clothing")).toBe("Napoli Linen Shirt");
    expect(displayName("COLONY CLOTHING / RELAX EASY TROUSERS / CC2601-PT02-02")).toBe("Relax Easy Trousers");
    expect(displayName('COLONY CLOTHING / SINGLE SHIRT JACKET "BLACK OLIVE" / CC2602-JK01S-01')).toBe('Single Shirt Jacket "Black Olive"');
    expect(displayName("BEAMS PLUS / 2P CHINO DK NAVY / B+2P Twill")).toBe("2p Chino Dk Navy");
  });

  it("leaves ordinary titles alone", () => {
    expect(displayName("The Nantucket Linen Pants - Midnight", "Senja Bali Co.")).toBe("The Nantucket Linen Pants - Midnight");
    expect(displayName("Neil Suede Midnight")).toBe("Neil Suede Midnight");
  });
});
