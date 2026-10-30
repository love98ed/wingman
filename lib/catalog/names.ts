/**
 * A readable product name for cards. Store titles often look like
 * "COLONY CLOTHING / NAPOLI LINEN SHIRT / 9404/1": keep the part that names the product
 * and drop the store or brand prefix and stock codes.
 */
export function displayName(name: string, storeName?: string): string {
  const parts = name
    .split(" / ")
    .map((p) => p.trim())
    .filter((p) => p && p.toLowerCase() !== storeName?.toLowerCase());
  const words = (p: string) => p.split(/\s+/).filter((w) => /^[A-Za-z][A-Za-z'&-]{2,}$/.test(w)).length;
  // Most real words wins; on a tie the later part, since brands come first
  const best = parts.reduce((a, b) => (words(b) >= words(a) ? b : a), parts[0] ?? name);
  const shouting = best === best.toUpperCase() && /[A-Z]{3}/.test(best);
  return shouting ? best.toLowerCase().replace(/(^|[\s("-])([a-z])/g, (_, pre, c) => pre + c.toUpperCase()) : best;
}
