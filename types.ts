
export interface GlobalSettings {
  daysPerMonth: number;
  priceT1: number;
  priceT2: number;
  priceT3: number;
}

export interface TierConfig {
  threshold1: number; // 150
  threshold2: number; // 250
}

export enum CalculationMode {
  APPLIANCE = 'APPLIANCE',
  MONTHLY = 'MONTHLY'
}

export enum MonthlyInputMode {
  KWH = 'KWH',
  WATTS = 'WATTS',
  FCFA = 'FCFA'
}

export interface ApplianceRow {
  hours: number;
  kWh: number;
  costT1: number;
  costT2: number;
  costT3: number;
}

export interface MonthlyBreakdown {
  tier: string;
  kWh: number;
  price: number;
  cost: number;
}
