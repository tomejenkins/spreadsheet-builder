export type PackageId = 'quick_fix' | 'spreadsheet_repair' | 'custom_dashboard_deposit' | 'automation_deposit';

export type PackageConfig = {
  id: PackageId;
  name: string;
  priceLabel: string;
  amount: number;
  type: 'repair' | 'build_deposit' | 'automation_deposit';
  stripePriceEnv: string;
};

export const PACKAGES: Record<PackageId, PackageConfig> = {
  quick_fix: {
    id: 'quick_fix',
    name: 'Quick Fix',
    priceLabel: '$99',
    amount: 9900,
    type: 'repair',
    stripePriceEnv: 'STRIPE_PRICE_QUICK_FIX',
  },
  spreadsheet_repair: {
    id: 'spreadsheet_repair',
    name: 'Spreadsheet Repair',
    priceLabel: '$249',
    amount: 24900,
    type: 'repair',
    stripePriceEnv: 'STRIPE_PRICE_SPREADSHEET_REPAIR',
  },
  custom_dashboard_deposit: {
    id: 'custom_dashboard_deposit',
    name: 'Custom Tracker / Dashboard Build Deposit',
    priceLabel: '$149 deposit',
    amount: 14900,
    type: 'build_deposit',
    stripePriceEnv: 'STRIPE_PRICE_CUSTOM_DEPOSIT',
  },
  automation_deposit: {
    id: 'automation_deposit',
    name: 'Automation / Connected Data Diagnostic Deposit',
    priceLabel: '$149 diagnostic deposit',
    amount: 14900,
    type: 'automation_deposit',
    stripePriceEnv: 'STRIPE_PRICE_AUTOMATION_DEPOSIT',
  },
};

export const getPackage = (packageId: string | undefined) => {
  if (!packageId || !(packageId in PACKAGES)) return undefined;
  return PACKAGES[packageId as PackageId];
};
