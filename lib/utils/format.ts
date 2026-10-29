const cents = new Intl.NumberFormat("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dollars = new Intl.NumberFormat("en-SG", { maximumFractionDigits: 0 });

/**
 * A price in Singapore dollars, the same wherever it appears: cents only when there are any
 * ("S$1,005", "S$245.70"). `whole` rounds to dollars, for large display figures only.
 */
export const sgd = (n: number, { whole = false } = {}) => {
  const exact = Math.round(n * 100) % 100 === 0;
  return `S$${(whole || exact ? dollars : cents).format(n)}`;
};
