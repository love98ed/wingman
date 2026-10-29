/** A price in Singapore dollars: "S$120.00", or "S$120" with `whole`. */
export const sgd = (n: number, { whole = false } = {}) => `S$${n.toFixed(whole ? 0 : 2)}`;
