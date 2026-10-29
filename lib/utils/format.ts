const cents = new Intl.NumberFormat("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dollars = new Intl.NumberFormat("en-SG", { maximumFractionDigits: 0 });

/** A price in Singapore dollars: "S$1,005.00", or "S$1,005" with `whole`. */
export const sgd = (n: number, { whole = false } = {}) => `S$${(whole ? dollars : cents).format(n)}`;
