import type { Occasion } from "@/lib/catalog/types";

/**
 * The home page's material: real YouCam clothes try-ons of Pexels model photos
 * (fixtures/selfies/CREDITS.md) in real pieces from the catalog, rendered on 28 and 29 Oct 2026.
 * Each picture on the page shows a different man; only the hero's before and after share one.
 * Prices and links are the stores' own on that date.
 */

export type HomePiece = { name: string; store: string; price: number; url: string; thumb: string };

/** The hero's before photo, the one the date, interview and wedding renders were made from. */
export const BEFORE = "/home/before.jpg";

/** One real try-on per occasion, shown by the occasion switcher. */
export const OCCASION_LOOKS: Record<Occasion, { render: string; look: string; piece: HomePiece }> = {
  date: {
    render: "/home/date.jpg",
    look: "White linen, black trousers",
    piece: {
      name: "Napoli Linen Shirt",
      store: "Colony Clothing",
      price: 360,
      url: "https://colonyclothing.net/products/colony-clothing-napoli-linen-shirt-9401-6",
      thumb: "https://cdn.shopify.com/s/files/1/0092/1944/0718/files/20250414_174624.jpg?v=1745567947&width=600",
    },
  },
  interview: {
    render: "/home/interview.jpg",
    look: "A crisp long-sleeve shirt",
    piece: {
      name: "100% Linen Long Sleeve Shirt",
      store: "Kevin Seah",
      price: 500,
      url: "https://kevinseah.com/products/100-linen-long-sleeved-shirt-made-to-order",
      thumb: "https://cdn.shopify.com/s/files/1/0249/8576/products/pixelcut_166_c4346b1a-e23a-4743-b4a5-074fb184bebb.png?v=1675232990&width=600",
    },
  },
  wedding: {
    render: "/home/wedding.jpg",
    look: "A double-breasted shirt jacket",
    piece: {
      name: "Double Shirt Jacket",
      store: "Colony Clothing",
      price: 790,
      url: "https://colonyclothing.net/products/colony-clothing-double-shirt-jacket-cc2601-jk01w-01",
      thumb: "https://cdn.shopify.com/s/files/1/0092/1944/0718/files/DSC06928_40c102f5-e45d-4c08-98de-701b98633458.webp?v=1780040404&width=600",
    },
  },
  cny: {
    render: "/home/cny.jpg",
    look: "A bordeaux knit polo",
    piece: {
      name: "Cotton Cashmere Knit Polo",
      store: "Kevin Seah",
      price: 320,
      url: "https://kevinseah.com/products/cotton-cashmere-knit-polo-shirt",
      thumb: "https://cdn.shopify.com/s/files/1/0249/8576/products/polobordeaux_1000x_28bdc85d-8585-4101-b90c-6f62032c6fb4.jpg?v=1670912597&width=600",
    },
  },
  dnd: {
    render: "/home/dnd.jpg",
    look: "A hand-loomed navy ikat",
    piece: {
      name: "Hand Loomed Ikat Shirt, Navy",
      store: "Kevin Seah",
      price: 360,
      url: "https://kevinseah.com/products/ikat-short-sleeved-shirt-13",
      thumb: "https://cdn.shopify.com/s/files/1/0249/8576/products/pixelcut_261.png?v=1671259673&width=600",
    },
  },
  "night-out": {
    render: "/home/night-out.jpg",
    look: "An olive ikat camp collar",
    piece: {
      name: "Hand Loomed Ikat Shirt",
      store: "Kevin Seah",
      price: 320,
      url: "https://kevinseah.com/products/hand-loomed-ikat-short-sleeve-shirt-8",
      thumb: "https://cdn.shopify.com/s/files/1/0249/8576/files/pixelcut_714_50f48576-a48b-485c-96f0-0df72b2f3404.png?v=1735375455&width=600",
    },
  },
};

/**
 * The occasions the picker offers: only those whose try-on no other section shows, so no
 * picture appears twice on the page (first date, interview and wedding are used above and below).
 */
export const PICKER_OCCASIONS: Occasion[] = ["night-out", "dnd", "cny"];

/** One white linen shirt at each budget, as Price Compare matched them. */
export const BUDGETS = [
  {
    tier: "Budget",
    render: "/home/budget.jpg",
    focus: "50% 32%",
    phoneZoom: 1,
    piece: { name: "Shawl Collared Linen Shirt", store: "Pharaoh's Horses", price: 198, url: "https://pharaohshorses.co/products/shawl-collared-linen-shirt" },
  },
  {
    tier: "Mid-range",
    render: "/home/mid.jpg",
    // He stands lower in his frame: crop from the bottom on desktop, and on the narrow phone tiles
    // (cropped at the sides, not the top) zoom in slightly from his feet to lift his head into line
    focus: "50% 100%",
    phoneZoom: 1.13,
    piece: { name: "Napoli Linen Shirt", store: "Colony Clothing", price: 360, url: OCCASION_LOOKS.date.piece.url },
  },
  {
    tier: "Luxury",
    render: "/home/luxury.jpg",
    focus: "50% 32%",
    phoneZoom: 1,
    piece: { name: "100% Linen Long Sleeve Shirt", store: "Kevin Seah", price: 500, url: OCCASION_LOOKS.interview.piece.url },
  },
] as const;

/**
 * The first-date look as Wingman scores and sells it: the mid-range version in Three budgets.
 * Score and reasoning are Wingman's real Fit Check of /home/mid.jpg (first sentence); the
 * cart link holds these three variants.
 */
export const FIT_CHECK = {
  score: 7.5,
  reasoning:
    "The white linen shirt with rolled sleeves looks relaxed and sits well through the shoulders, and the crisp white works nicely against your warm olive skin and dark hair.",
  store: "Colony Clothing",
  items: [
    { name: "Napoli Linen Shirt, size S", price: 360 },
    { name: "Baker Pants in black, size 44", price: 410 },
    { name: "Paraboot Coraux in black, UK 8", price: 420 },
  ],
  cart: "https://colonyclothing.net/cart/51769506496822:1,51747203121462:1,39526063734862:1",
};

/** The stores Wingman shops (fixtures/stores.json), and what's in stock across them. */
export const STORES = [
  { name: "Colony Clothing", domain: "colonyclothing.net" },
  { name: "Kevin Seah", domain: "kevinseah.com" },
  { name: "DUXTON", domain: "duxton.com" },
  { name: "In Good Company", domain: "ingoodcompany.asia" },
  { name: "Pharaoh's Horses", domain: "pharaohshorses.co" },
  { name: "Kerbside & Co.", domain: "kerbside-co.com" },
  { name: "Senja Bali Co.", domain: "senjabalico.com" },
  { name: "White Ginger", domain: "white-ginger.com" },
  { name: "Rugged Gentlemen Shoppe", domain: "ruggedgentlemenshoppe.com" },
  { name: "Arden Teal", domain: "ardenteal.com" },
  { name: "The Jacket Maker", domain: "thejacketmaker.sg" },
  { name: "WHY&CO", domain: "whyandco.com" },
  { name: "BOLDR", domain: "boldrsupply.co" },
  { name: "Zelos", domain: "zeloswatches.com" },
  { name: "Vario", domain: "vario.sg" },
  { name: "Red Army Watches", domain: "redarmywatches.com" },
  { name: "Cufflinks.com.sg", domain: "cufflinks.com.sg" },
];
export const IN_STOCK_PIECES = 1594;
