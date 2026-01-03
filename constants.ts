
import { GlobalSettings, TierConfig } from './types';

export const DEFAULT_SETTINGS: GlobalSettings = {
  daysPerMonth: 30,
  priceT1: 82.00,
  priceT2: 136.49,
  priceT3: 159.36,
};

export const TIER_CONFIG: TierConfig = {
  threshold1: 150,
  threshold2: 250,
};

export const DEFAULT_WATTS = 175;
export const DEFAULT_TOTAL_KWH = 550;

export const APPLIANCE_HOURS = [4, 8, 12, 24];

export const formatFCFA = (val: number): string => {
  // Using 'en-US' locale to ensure commas are used as thousands separators (e.g., 73,757)
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(val) + ' FCFA';
};

export const formatKWh = (val: number): string => {
  return val.toFixed(1) + ' kWh';
};
