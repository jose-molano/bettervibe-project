export const CATEGORIES = [
  'utilities',
  'banking',
  'insurance',
  'taxes',
  'medical',
  'contracts',
  'receipts',
  'government',
  'unsorted',
] as const;

export type Category = (typeof CATEGORIES)[number];
