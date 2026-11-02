export const getQuickCashOptions = (total: number): number[] => {
  if (total <= 0) return [20, 50, 100, 200];

  const roundedTotal = Math.ceil(total);
  const options = new Set<number>();

  // Always include exact amount
  options.add(roundedTotal);

  // Next multiple of $50
  const next50 = Math.ceil(roundedTotal / 50) * 50;
  if (next50 > roundedTotal) options.add(next50);

  // Next multiple of $100
  const next100 = Math.ceil(roundedTotal / 100) * 100;
  if (next100 > roundedTotal) options.add(next100);

  // Next multiple of $200
  const next200 = Math.ceil(roundedTotal / 200) * 200;
  if (next200 > roundedTotal) options.add(next200);

  // Standard Mexican bill denominations: $50, $100, $200, $500, $1000, $2000
  const bills = [50, 100, 200, 500, 1000, 2000];
  for (const bill of bills) {
    if (bill > roundedTotal) {
      options.add(bill);
    }
  }

  // Next round step above total
  const next500 = Math.ceil(roundedTotal / 500) * 500;
  if (next500 > roundedTotal) options.add(next500);

  return Array.from(options)
    .sort((a, b) => a - b)
    .slice(0, 5);
};

