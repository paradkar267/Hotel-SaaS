// lib/server/services/pricing-engine-service.ts
// Dynamic Yield Management & RevPAR Optimization Engine

export interface DynamicPricingConfig {
  baseRatePaise: number;
  minRatePaise: number;
  maxRatePaise: number;
  occupancyAlpha?: number;   // Elasticity exponent factor (default 0.35)
  leadTimeBeta?: number;     // Surge factor for last-minute bookings (default 0.15)
  leadTimeDecayLambda?: number; // Decay constant (default 0.1)
  weekendMultiplier?: number; // Friday/Saturday multiplier (default 1.15)
}

export interface DynamicPricingContext {
  totalRooms: number;
  occupiedRooms: number;
  checkInDate: Date;
  bookingCreationDate?: Date;
  isPeakSeason?: boolean;
}

export interface DynamicPricingResult {
  recommendedRatePaise: number;
  baseRatePaise: number;
  occupancyRatePercent: number;
  appliedMultipliers: {
    occupancyMultiplier: number;
    leadTimeMultiplier: number;
    weekendMultiplier: number;
    seasonalityMultiplier: number;
  };
  explanation: string;
}

/**
 * Computes real-time dynamic room tariff to maximize Revenue Per Available Room (RevPAR).
 * 
 * Formula:
 * Price = BaseRate * M_occupancy * M_leadTime * M_weekend * M_season
 * 
 * Output is clamped between minRatePaise and maxRatePaise and rounded to integer paise.
 */
export function calculateDynamicRate(
  config: DynamicPricingConfig,
  context: DynamicPricingContext
): DynamicPricingResult {
  const alpha = config.occupancyAlpha ?? 0.35;
  const beta = config.leadTimeBeta ?? 0.15;
  const lambda = config.leadTimeDecayLambda ?? 0.1;
  const weekendFactor = config.weekendMultiplier ?? 1.15;

  // 1. Occupancy Multiplier
  const total = Math.max(1, context.totalRooms);
  const occupied = Math.min(total, Math.max(0, context.occupiedRooms));
  const occupancyRatio = occupied / total;
  const occupancyRatePercent = Math.round(occupancyRatio * 100);

  // M_occ = 1 + alpha * (occ_ratio)^2
  const occupancyMultiplier = 1 + alpha * Math.pow(occupancyRatio, 2);

  // 2. Lead Time Multiplier (Days until check-in)
  const now = context.bookingCreationDate ? context.bookingCreationDate.getTime() : Date.now();
  const checkInMs = context.checkInDate.getTime();
  const diffDays = Math.max(0, (checkInMs - now) / (1000 * 60 * 60 * 24));

  // If last-minute (0-2 days), surge price; if advance booking (>30 days), slight incentive discount
  let leadTimeMultiplier = 1;
  if (diffDays <= 2) {
    leadTimeMultiplier = 1 + beta * Math.exp(-lambda * diffDays);
  } else if (diffDays >= 30) {
    leadTimeMultiplier = 0.95; // 5% early-bird incentive
  }

  // 3. Weekend Multiplier (Friday = 5, Saturday = 6)
  const dayOfWeek = context.checkInDate.getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
  const weekendMultiplier = isWeekend ? weekendFactor : 1.0;

  // 4. Seasonality Multiplier
  const seasonalityMultiplier = context.isPeakSeason ? 1.25 : 1.0;

  // Combined Multiplier Calculation
  const combinedMultiplier =
    occupancyMultiplier *
    leadTimeMultiplier *
    weekendMultiplier *
    seasonalityMultiplier;

  const rawCalculatedPaise = Math.round(config.baseRatePaise * combinedMultiplier);

  // Apply safety guardrails
  const recommendedRatePaise = Math.max(
    config.minRatePaise,
    Math.min(config.maxRatePaise, rawCalculatedPaise)
  );

  let explanation = `Standard rate adjusted for ${occupancyRatePercent}% occupancy`;
  if (isWeekend) explanation += `, weekend demand`;
  if (diffDays <= 2) explanation += `, last-minute walk-in surge`;
  if (context.isPeakSeason) explanation += `, peak holiday season`;

  return {
    recommendedRatePaise,
    baseRatePaise: config.baseRatePaise,
    occupancyRatePercent,
    appliedMultipliers: {
      occupancyMultiplier: Number(occupancyMultiplier.toFixed(3)),
      leadTimeMultiplier: Number(leadTimeMultiplier.toFixed(3)),
      weekendMultiplier: Number(weekendMultiplier.toFixed(3)),
      seasonalityMultiplier: Number(seasonalityMultiplier.toFixed(3)),
    },
    explanation,
  };
}
