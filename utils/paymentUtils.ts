export const getQuickCashOptions = (total: number): number[] => {
  const options = [
    total,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 200) * 200,
    Math.ceil(total / 500) * 500,
  ];
  // Filter out options that are less than total, and remove duplicates, and return the first 4
  return Array.from(new Set(options.filter(o => o >= total))).slice(0, 4);
};
