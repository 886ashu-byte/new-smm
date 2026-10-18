import { 
  Platform, 
  AlgorithmicCurve, 
  AudienceRegion,
  CurvePoint,
  SpeedInterval, 
  CampaignMetrics, 
  RatioGuardrailStatus, 
  BezierControlPoints, 
  ScheduledBatch,
  AlgorithmicRiskAudit,
  ProviderRoutingConfig
} from '../types';

export const DEFAULT_ROUTING_CONFIG: ProviderRoutingConfig = {
  viewsService: {
    providerId: 'smmvault',
    providerName: 'SMMVault',
    serviceId: 11465,
    serviceName: 'Indian IG Views [High Retention / Non-Drop]',
    minQuantity: 100,
    ratePer1k: 0.12,
  },
  microLikesService: {
    providerId: 'jap',
    providerName: 'Just Another Panel (JAP)',
    serviceId: 1778,
    serviceName: 'Instagram Micro-Likes [High-Quality Slow Drip]',
    minQuantity: 5,
    maxQuantity: 9,
    ratePer1k: 0.35,
  },
  macroLikesService: {
    providerId: 'reliablesmm',
    providerName: 'ReliableSMM',
    serviceId: 7147,
    serviceName: 'Instagram Macro-Likes [Real Active Profile Drip]',
    minQuantity: 10,
    ratePer1k: 0.28,
  },
  savesService: {
    providerId: 'reliablesmm',
    providerName: 'ReliableSMM',
    serviceId: 7841,
    serviceName: 'Instagram Targeted Saves [Organic Signal]',
    minQuantity: 1,
    ratePer1k: 0.45,
  },
  repostsService: {
    providerId: 'reliablesmm',
    providerName: 'ReliableSMM',
    serviceId: 7842,
    serviceName: 'Targeted Reposts / Shares v2',
    minQuantity: 1,
    ratePer1k: 0.85,
  },
  sharesService: {
    providerId: 'reliablesmm',
    providerName: 'ReliableSMM',
    serviceId: 2060,
    serviceName: 'Viral Social Shares [DM & External Network]',
    minQuantity: 10,
    ratePer1k: 0.60,
  },
};

/**
 * Validates and extracts username handle from target link
 */
export function parseTargetUrl(url: string, platform: Platform): {
  isValid: boolean;
  handle: string;
  cleanUrl: string;
  errorMessage?: string;
} {
  const trimmed = url.trim();
  if (!trimmed) {
    return { isValid: false, handle: '', cleanUrl: '', errorMessage: 'URL cannot be empty' };
  }

  try {
    if (platform === 'instagram') {
      // Matches https://www.instagram.com/reel/C3abcXYZ/?igsh=...
      // or instagram.com/p/C3abcXYZ/ or instagram.com/reel/C3abcXYZ
      const igReelRegex = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/i;
      const igProfileMatch = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?(?:\?.*)?$/i;
      
      const reelMatch = trimmed.match(igReelRegex);
      if (reelMatch) {
        // Can also check if handle query param or infer
        const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        const userParam = urlObj.searchParams.get('igsh') || urlObj.searchParams.get('utm_source');
        return {
          isValid: true,
          handle: userParam ? `@target_creator` : `@creator_${reelMatch[1].slice(0, 5).toLowerCase()}`,
          cleanUrl: `https://www.instagram.com/reel/${reelMatch[1]}/`,
        };
      }

      const profMatch = trimmed.match(igProfileMatch);
      if (profMatch && !['reel', 'p', 'explore', 'stories'].includes(profMatch[1].toLowerCase())) {
        return {
          isValid: true,
          handle: `@${profMatch[1]}`,
          cleanUrl: `https://www.instagram.com/${profMatch[1]}/`,
        };
      }

      return {
        isValid: false,
        handle: '',
        cleanUrl: trimmed,
        errorMessage: 'Invalid Instagram URL. Expected format: https://www.instagram.com/reel/ID or https://instagram.com/p/ID',
      };
    } else {
      // TikTok regex
      // Matches https://www.tiktok.com/@username/video/7123456789012345678
      // or vm.tiktok.com/ZMxxxxxx/
      const tiktokVideoRegex = /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.-]+)\/video\/(\d+)/i;
      const tiktokShortRegex = /^(?:https?:\/\/)?vm\.tiktok\.com\/([a-zA-Z0-9]+)/i;
      const tiktokProfileRegex = /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.-]+)\/?$/i;

      const videoMatch = trimmed.match(tiktokVideoRegex);
      if (videoMatch) {
        return {
          isValid: true,
          handle: `@${videoMatch[1]}`,
          cleanUrl: `https://www.tiktok.com/@${videoMatch[1]}/video/${videoMatch[2]}`,
        };
      }

      const shortMatch = trimmed.match(tiktokShortRegex);
      if (shortMatch) {
        return {
          isValid: true,
          handle: `@viral_tiktok_creator`,
          cleanUrl: `https://vm.tiktok.com/${shortMatch[1]}/`,
        };
      }

      const profMatch = trimmed.match(tiktokProfileRegex);
      if (profMatch) {
        return {
          isValid: true,
          handle: `@${profMatch[1]}`,
          cleanUrl: `https://www.tiktok.com/@${profMatch[1]}`,
        };
      }

      return {
        isValid: false,
        handle: '',
        cleanUrl: trimmed,
        errorMessage: 'Invalid TikTok URL. Expected format: https://www.tiktok.com/@username/video/123456789 or vm.tiktok.com/...',
      };
    }
  } catch (e: any) {
    return {
      isValid: false,
      handle: '',
      cleanUrl: trimmed,
      errorMessage: 'Invalid URL structure',
    };
  }
}

/**
 * Strict ratio guardrails:
 * - Likes: 0.5% - 1.0% of views
 * - Comments: ~0.01% of views (0.008% - 0.02%)
 * - Shares: 0.5% - 0.7% of views
 * - Saves: 0.5% - 0.9% of views
 */
export function evaluateRatioGuardrails(views: number, metrics: Omit<CampaignMetrics, 'views'>): RatioGuardrailStatus[] {
  const safeViews = Math.max(views, 100);

  const calculate = (
    metric: keyof Omit<CampaignMetrics, 'views'>,
    currentValue: number,
    minPct: number,
    maxPct: number,
    recommendedPct: number
  ): RatioGuardrailStatus => {
    const currentPercent = (currentValue / safeViews) * 100;
    const isCompliant = currentPercent >= minPct * 0.95 && currentPercent <= maxPct * 1.05;
    const recommendedValue = Math.round(safeViews * (recommendedPct / 100));

    let warning: string | undefined;
    if (currentPercent < minPct) {
      warning = `Below organic threshold (${currentPercent.toFixed(3)}% < ${minPct}%). Algorithms may mark post as low-interest or bot-viewed.`;
    } else if (currentPercent > maxPct) {
      warning = `Exceeds natural threshold (${currentPercent.toFixed(3)}% > ${maxPct}%). Elevated risk of bot-farm shadowban flag.`;
    }

    return {
      metric,
      currentPercent: Number(currentPercent.toFixed(3)),
      minPercent: minPct,
      maxPercent: maxPct,
      isCompliant,
      recommendedValue,
      warning,
    };
  };

  return [
    calculate('likes', metrics.likes, 0.5, 1.0, 0.75),
    calculate('comments', metrics.comments, 0.008, 0.02, 0.01),
    calculate('shares', metrics.shares, 0.5, 0.7, 0.6),
    calculate('saves', metrics.saves, 0.5, 0.9, 0.7),
    calculate('reposts', metrics.reposts, 0.1, 0.3, 0.2),
  ];
}

/**
 * Auto-locks metrics to exact golden-ratio organic defaults based on total views
 */
export function computeGoldenRatioMetrics(views: number): CampaignMetrics {
  const safeViews = Math.max(views, 1000);
  return {
    views: safeViews,
    likes: Math.max(10, Math.round(safeViews * 0.0075)), // 0.75%
    comments: Math.max(5, Math.round(safeViews * 0.0001)), // 0.01%
    shares: Math.max(10, Math.round(safeViews * 0.006)), // 0.6%
    saves: Math.max(5, Math.round(safeViews * 0.007)), // 0.7%
    reposts: Math.max(2, Math.round(safeViews * 0.002)), // 0.2%
  };
}

/**
 * Cubic Bézier curve evaluation for t in [0, 1]
 */
export function sampleCubicBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
  const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;

  return { x, y: Math.max(0, y) };
}

export const REGION_CONFIGS: Record<AudienceRegion, {
  label: string;
  sublabel: string;
  offsetHours: number;
  offsetLabel: string;
  sleepHours: [number, number];
  peakHours: [number, number];
  flag: string;
}> = {
  us_east: {
    label: 'US East (EST)',
    sublabel: 'High CPM & Whop Bounties',
    offsetHours: -5,
    offsetLabel: 'UTC -5h',
    sleepHours: [0, 6],
    peakHours: [19, 23],
    flag: '🇺🇸',
  },
  us_west: {
    label: 'US West (PST)',
    sublabel: 'West Coast Creator Audience',
    offsetHours: -8,
    offsetLabel: 'UTC -8h',
    sleepHours: [0, 6],
    peakHours: [19, 23],
    flag: '🇺🇸',
  },
  india: {
    label: 'India (IST)',
    sublabel: 'Domestic Reels & YouTube Shorts',
    offsetHours: 5.5,
    offsetLabel: 'UTC +5.5h',
    sleepHours: [0, 6],
    peakHours: [19, 23],
    flag: '🇮🇳',
  },
  uk_europe: {
    label: 'UK & Europe (GMT)',
    sublabel: 'European Prime Hours',
    offsetHours: 0,
    offsetLabel: 'UTC +0h',
    sleepHours: [0, 6],
    peakHours: [19, 23],
    flag: '🇬🇧',
  },
  global: {
    label: 'Global (24h Flat)',
    sublabel: 'Continuous 24h Worldwide Flow',
    offsetHours: 0,
    offsetLabel: 'UTC +0h',
    sleepHours: [0, 6],
    peakHours: [19, 23],
    flag: '🌐',
  },
};

export const ADVANCED_CURVE_PRESETS: {
  id: AlgorithmicCurve;
  label: string;
  desc: string;
  icon: string;
  isRecommended: boolean;
  points: CurvePoint[];
}[] = [
  {
    id: 'explore_push',
    label: 'Explore Push',
    desc: 'Slow start → burst → decay',
    icon: '🔥',
    isRecommended: true,
    points: [
      { id: 0, x: 0, y: 0.12 },
      { id: 1, x: 0.16, y: 0.18 },
      { id: 2, x: 0.33, y: 0.35 },
      { id: 3, x: 0.52, y: 0.90 },
      { id: 4, x: 0.68, y: 0.72 },
      { id: 5, x: 0.84, y: 0.38 },
      { id: 6, x: 1, y: 0.18 },
    ],
  },
  {
    id: 'fyp_waves',
    label: 'FYP Waves',
    desc: '3 spikes — FYP re-push jaisa',
    icon: '〰️',
    isRecommended: false,
    points: [
      { id: 0, x: 0, y: 0.15 },
      { id: 1, x: 0.18, y: 0.68 },
      { id: 2, x: 0.35, y: 0.28 },
      { id: 3, x: 0.52, y: 0.85 },
      { id: 4, x: 0.68, y: 0.35 },
      { id: 5, x: 0.84, y: 0.78 },
      { id: 6, x: 1, y: 0.25 },
    ],
  },
  {
    id: 'trending_rocket',
    label: 'Trending Rocket',
    desc: 'Accelerating algorithm push',
    icon: '🚀',
    isRecommended: true,
    points: [
      { id: 0, x: 0, y: 0.08 },
      { id: 1, x: 0.16, y: 0.10 },
      { id: 2, x: 0.34, y: 0.16 },
      { id: 3, x: 0.50, y: 0.30 },
      { id: 4, x: 0.68, y: 0.56 },
      { id: 5, x: 0.84, y: 0.80 },
      { id: 6, x: 1, y: 0.96 },
    ],
  },
  {
    id: 'steady_climb',
    label: 'Steady Climb',
    desc: 'Safest — consistent growth',
    icon: '📈',
    isRecommended: true,
    points: [
      { id: 0, x: 0, y: 0.15 },
      { id: 1, x: 0.16, y: 0.28 },
      { id: 2, x: 0.33, y: 0.42 },
      { id: 3, x: 0.52, y: 0.56 },
      { id: 4, x: 0.68, y: 0.70 },
      { id: 5, x: 0.84, y: 0.82 },
      { id: 6, x: 1, y: 0.88 },
    ],
  },
  {
    id: 'evergreen',
    label: 'Evergreen',
    desc: 'Slow long build',
    icon: '⏳',
    isRecommended: false,
    points: [
      { id: 0, x: 0, y: 0.12 },
      { id: 1, x: 0.16, y: 0.20 },
      { id: 2, x: 0.33, y: 0.28 },
      { id: 3, x: 0.52, y: 0.35 },
      { id: 4, x: 0.68, y: 0.42 },
      { id: 5, x: 0.84, y: 0.48 },
      { id: 6, x: 1, y: 0.55 },
    ],
  },
];

/**
 * Smooth multi-point interpolation through a set of control points
 */
export function interpolateMultiPointCurve(points: CurvePoint[], t: number): number {
  if (!points || points.length === 0) return 1.0;
  if (points.length === 1) return points[0].y;

  const sorted = [...points].sort((a, b) => a.x - b.x);

  if (t <= sorted[0].x) return sorted[0].y;
  if (t >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;

  // Find segment [i, i+1]
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    if (t >= p1.x && t <= p2.x) {
      const segT = (p2.x - p1.x) > 0 ? (t - p1.x) / (p2.x - p1.x) : 0;
      // Smooth cosine interpolation
      const ft = (1 - Math.cos(segT * Math.PI)) * 0.5;
      return p1.y * (1 - ft) + p2.y * ft;
    }
  }

  return 1.0;
}

/**
 * Computes hourly normalized weight density based on chosen algorithmic curve,
 * region circadian cycle (12-6 AM dip, 7-11 PM peak), and multi-point nodes.
 */
export function getCurveDensityWeights(
  curve: AlgorithmicCurve, 
  totalBatches: number, 
  bezierPoints?: BezierControlPoints,
  durationHours: number = 24,
  curvePoints?: CurvePoint[],
  region: AudienceRegion = 'india'
): number[] {
  const weights: number[] = [];
  const regionConfig = REGION_CONFIGS[region] || REGION_CONFIGS.india;

  for (let i = 0; i < totalBatches; i++) {
    const t = totalBatches > 1 ? i / (totalBatches - 1) : 0;
    let weight = 1.0;

    // Check if matched in advanced presets
    const matchedPreset = ADVANCED_CURVE_PRESETS.find(p => p.id === curve);

    if (matchedPreset) {
      const pts = (curvePoints && curvePoints.length > 0) ? curvePoints : matchedPreset.points;
      weight = interpolateMultiPointCurve(pts, t) * 2.2;
    } else if (curve === 'custom_svg' && curvePoints && curvePoints.length > 0) {
      weight = interpolateMultiPointCurve(curvePoints, t) * 2.2;
    } else if (curve === 'custom_bezier' && bezierPoints) {
      const sample = sampleCubicBezier(
        bezierPoints.p0,
        bezierPoints.p1,
        bezierPoints.p2,
        bezierPoints.p3,
        t
      );
      weight = Math.max(0.05, sample.y * 2.0);
    } else if (curve === 'circadian') {
      const hourOfDay = (t * durationHours) % 24;
      if (hourOfDay >= 0 && hourOfDay <= 6) {
        weight = 0.12 + 0.08 * Math.sin((hourOfDay / 6) * Math.PI);
      } else if (hourOfDay > 6 && hourOfDay < 12) {
        weight = 0.35 + 0.5 * ((hourOfDay - 6) / 6);
      } else if (hourOfDay >= 12 && hourOfDay <= 16) {
        weight = 0.95 + 0.15 * Math.sin(((hourOfDay - 12) / 4) * Math.PI);
      } else if (hourOfDay > 16 && hourOfDay < 19) {
        weight = 0.75;
      } else {
        weight = 1.25 + 0.25 * Math.sin(((hourOfDay - 19) / 5) * Math.PI);
      }
    } else if (curve === 'viral_spike') {
      if (t < 0.25) {
        weight = 0.2 + 0.15 * (t / 0.25);
      } else {
        const progress = (t - 0.25) / 0.75;
        weight = 0.35 + Math.pow(progress, 2.5) * 2.2;
      }
    } else if (curve === 'front_loaded') {
      weight = Math.exp(-2.2 * t) * 2.4 + 0.2;
    } else {
      // steady
      weight = 1.0 + 0.05 * Math.sin(t * Math.PI * 4);
    }

    // Apply region circadian shaping if not global flat
    if (region !== 'global') {
      const localHour = (t * durationHours + (regionConfig.offsetHours || 0) + 24) % 24;
      if (localHour >= 0 && localHour <= 6) {
        // Active night dip
        const dipFactor = 0.45 + 0.25 * Math.sin((localHour / 6) * Math.PI);
        weight *= dipFactor;
      } else if (localHour >= 19 && localHour <= 23) {
        // Peak evening
        weight *= 1.22;
      }
    }

    weights.push(Math.max(0.05, weight));
  }

  // Normalize weights so they sum to totalBatches
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => (w / sum) * totalBatches);
}

/**
 * Speed interval to minutes
 */
export function getIntervalMinutes(interval: SpeedInterval): number {
  switch (interval) {
    case 'rapid_30s': return 0.5;
    case 'turbo_1m': return 1;
    case 'turbo_2m': return 2;
    case 'hourly_60m': return 60;
    default: return 60;
  }
}

/**
 * Apply deterministic yet organic jitter to eliminate robotic round numbers (e.g. 100 -> 97, 103)
 */
export function applyJitter(value: number, jitterPercent: number, seed: number): number {
  if (value <= 0) return 0;
  if (jitterPercent <= 0) return value;

  // Pseudo-random deterministic factor between -jitterPercent and +jitterPercent
  const noise = (Math.sin(seed * 9973 + 13) + Math.cos(seed * 4099 + 7)) / 2;
  const factor = 1 + (noise * (jitterPercent / 100));
  const rawJittered = Math.round(value * factor);

  // Eliminate ending with 0 or 00 if original was round, to avoid bot red flags
  let finalVal = Math.max(1, rawJittered);
  if (finalVal >= 10 && finalVal % 10 === 0) {
    const tweak = (seed % 2 === 0 ? 1 : -1) * (1 + (seed % 4));
    finalVal = Math.max(1, finalVal + tweak);
  }

  return finalVal;
}

/**
 * Generates the full scheduled batch list with:
 * - Algorithmic curve distribution
 * - Seed chunk protocol (Batch #0 and #1: views only)
 * - Micro vs Macro likes split routing tag
 * - Jitter application
 */
export function generateCampaignBatches(params: {
  metrics: CampaignMetrics;
  durationHours: number;
  intervalMinutes: number;
  curve: AlgorithmicCurve;
  bezierPoints?: BezierControlPoints;
  jitterPercent: number;
  seedChunkProtocol: boolean;
  startDate?: Date;
  routingConfig?: ProviderRoutingConfig;
  curvePoints?: CurvePoint[];
  region?: AudienceRegion;
}): ScheduledBatch[] {
  const {
    metrics,
    durationHours,
    intervalMinutes,
    curve,
    bezierPoints,
    jitterPercent,
    seedChunkProtocol,
    startDate = new Date(),
    routingConfig = DEFAULT_ROUTING_CONFIG,
    curvePoints,
    region = 'india',
  } = params;

  const totalMinutes = durationHours * 60;
  const totalBatches = Math.max(4, Math.round(totalMinutes / intervalMinutes));
  const normalizedWeights = getCurveDensityWeights(curve, totalBatches, bezierPoints, durationHours, curvePoints, region);

  // Engagement begins at batch 2 if seedChunkProtocol is enabled
  const engagementStartBatch = seedChunkProtocol ? 2 : 0;
  const engagementBatchesCount = Math.max(1, totalBatches - engagementStartBatch);

  // Compute weight sums for engagement
  let engagementWeightSum = 0;
  for (let i = engagementStartBatch; i < totalBatches; i++) {
    engagementWeightSum += normalizedWeights[i];
  }

  const batches: ScheduledBatch[] = [];
  let accumulatedViews = 0;
  let accumulatedLikes = 0;
  let accumulatedComments = 0;
  let accumulatedShares = 0;
  let accumulatedSaves = 0;
  let accumulatedReposts = 0;

  for (let i = 0; i < totalBatches; i++) {
    const isSeed = seedChunkProtocol && (i === 0 || i === 1);
    const weight = normalizedWeights[i];
    const scheduledTime = new Date(startDate.getTime() + i * intervalMinutes * 60 * 1000);

    // Views are distributed across all batches
    const rawViews = Math.round((metrics.views / totalBatches) * weight);
    let batchViews = applyJitter(rawViews, jitterPercent, i * 7 + 1);

    // Enforce minimum provider quantity for views if views > 0
    if (batchViews > 0 && batchViews < routingConfig.viewsService.minQuantity) {
      // Aggregate or bump to minimum
      batchViews = routingConfig.viewsService.minQuantity;
    }

    let batchLikes = 0;
    let batchComments = 0;
    let batchShares = 0;
    let batchSaves = 0;
    let batchReposts = 0;

    if (!isSeed && engagementWeightSum > 0) {
      const engWeightRatio = weight / (engagementWeightSum / engagementBatchesCount);

      const rawLikes = Math.round((metrics.likes / engagementBatchesCount) * engWeightRatio);
      batchLikes = applyJitter(rawLikes, jitterPercent, i * 13 + 3);

      const rawComments = Math.round((metrics.comments / engagementBatchesCount) * engWeightRatio);
      batchComments = applyJitter(rawComments, jitterPercent, i * 17 + 5);

      const rawShares = Math.round((metrics.shares / engagementBatchesCount) * engWeightRatio);
      batchShares = applyJitter(rawShares, jitterPercent, i * 23 + 7);

      const rawSaves = Math.round((metrics.saves / engagementBatchesCount) * engWeightRatio);
      batchSaves = applyJitter(rawSaves, jitterPercent, i * 31 + 11);

      const rawReposts = Math.round((metrics.reposts / engagementBatchesCount) * engWeightRatio);
      batchReposts = applyJitter(rawReposts, jitterPercent, i * 37 + 13);
    }

    // Determine likes provider routing based on micro vs macro split
    let likesProvider: 'JAP_Micro' | 'ReliableSMM_Macro' | 'None' = 'None';
    if (batchLikes > 0) {
      if (batchLikes < 10) {
        // 5-9 likes routes to JAP (min 5)
        likesProvider = 'JAP_Micro';
        if (batchLikes < routingConfig.microLikesService.minQuantity) {
          batchLikes = routingConfig.microLikesService.minQuantity;
        }
      } else {
        // 10+ likes routes to ReliableSMM (min 10)
        likesProvider = 'ReliableSMM_Macro';
      }
    }

    accumulatedViews += batchViews;
    accumulatedLikes += batchLikes;
    accumulatedComments += batchComments;
    accumulatedShares += batchShares;
    accumulatedSaves += batchSaves;
    accumulatedReposts += batchReposts;

    batches.push({
      batchIndex: i,
      scheduledAt: scheduledTime.toISOString(),
      isSeedBatch: isSeed,
      views: batchViews,
      likes: batchLikes,
      comments: batchComments,
      shares: batchShares,
      saves: batchSaves,
      reposts: batchReposts,
      likesProvider,
      status: 'pending',
    });
  }

  return batches;
}

/**
 * Computes deep Algorithmic Risk Audit Score (0 - 20)
 * 0 - 3: Ghost-Grade Organic
 * 4 - 8: Safe Drip
 * 9 - 14: Moderate Risk
 * 15 - 20: Critical Flag Risk
 */
export function computeRiskAudit(
  metrics: CampaignMetrics,
  curve: AlgorithmicCurve,
  jitterPercent: number,
  seedChunkProtocol: boolean,
  durationHours: number,
  intervalMinutes: number
): AlgorithmicRiskAudit {
  let penaltyPoints = 0;
  const redFlags: AlgorithmicRiskAudit['redFlags'] = [];
  const optimizationTips: AlgorithmicRiskAudit['optimizationTips'] = [];

  // Check 1: Seed chunk protocol
  if (!seedChunkProtocol) {
    penaltyPoints += 5;
    redFlags.push({
      id: 'missing-seed',
      severity: 'high',
      title: 'Missing Seed Chunk Warm-Up',
      description: 'Engagement (likes/comments) arriving at the exact millisecond as initial views flags anti-bot honeypots.',
    });
    optimizationTips.push({
      id: 'enable-seed',
      title: 'Enable Seed Chunk Protocol',
      actionableFix: 'Turn on Seed Chunk protocol to send views only during Batch #0 and #1.',
      autoFixable: true,
    });
  }

  // Check 2: Jitter intensity
  if (jitterPercent < 5) {
    penaltyPoints += 6;
    redFlags.push({
      id: 'zero-jitter',
      severity: 'high',
      title: 'Robotic Round-Number Detection',
      description: 'Delivering multiples of 50 or 100 creates an un-natural step graph easily detected by automated audits.',
    });
    optimizationTips.push({
      id: 'increase-jitter',
      title: 'Engage Micro-Jitter (±15% to ±25%)',
      actionableFix: 'Add at least ±15% micro-variance to randomize chunk quantities.',
      autoFixable: true,
    });
  } else if (jitterPercent < 10) {
    penaltyPoints += 2;
    redFlags.push({
      id: 'low-jitter',
      severity: 'low',
      title: 'Low Jitter Variance',
      description: '±5% to ±9% variance is borderline detectable during long campaigns.',
    });
  }

  // Check 3: Ratio guardrails
  const ratioChecks = evaluateRatioGuardrails(metrics.views, metrics);
  const failingRatios = ratioChecks.filter(r => !r.isCompliant);
  if (failingRatios.length > 0) {
    const ratioPenalty = Math.min(6, failingRatios.length * 2);
    penaltyPoints += ratioPenalty;
    failingRatios.forEach(fail => {
      redFlags.push({
        id: `ratio-${fail.metric}`,
        severity: fail.currentPercent > fail.maxPercent ? 'high' : 'medium',
        title: `Abnormal ${fail.metric.toUpperCase()} Ratio (${fail.currentPercent}%)`,
        description: fail.warning || 'Ratio deviates from platform organic distribution standards.',
      });
    });
    optimizationTips.push({
      id: 'auto-lock-ratios',
      title: 'Auto-Lock Organic Guardrails',
      actionableFix: 'Synchronize metrics to platform golden ratios (0.75% likes, 0.6% shares, 0.7% saves).',
      autoFixable: true,
    });
  }

  // Check 4: Velocity vs Duration
  const totalBatches = Math.round((durationHours * 60) / intervalMinutes);
  if (durationHours <= 6 && metrics.views >= 50000) {
    penaltyPoints += 4;
    redFlags.push({
      id: 'velocity-spike',
      severity: 'high',
      title: 'Aggressive Velocity Spike',
      description: 'Pumping 50k+ views in under 6 hours without prior profile warming triggers Instagram rate-limit filters.',
    });
    optimizationTips.push({
      id: 'extend-duration',
      title: 'Extend Delivery Window to 24h+',
      actionableFix: 'Distribute over 24h to 48h to mimic real viral discovery curve.',
      autoFixable: true,
    });
  }

  // Check 5: Algorithmic curve choice
  if (curve === 'front_loaded' && durationHours <= 6) {
    penaltyPoints += 2;
  }

  const finalScore = Math.min(20, Math.max(0, penaltyPoints));
  let riskCategory: AlgorithmicRiskAudit['riskCategory'] = 'Ghost-Grade Organic';
  let detectionProbability = '<0.05%';

  if (finalScore <= 3) {
    riskCategory = 'Ghost-Grade Organic';
    detectionProbability = '<0.08%';
  } else if (finalScore <= 8) {
    riskCategory = 'Safe Drip';
    detectionProbability = '0.8% - 2.4%';
  } else if (finalScore <= 14) {
    riskCategory = 'Moderate Risk';
    detectionProbability = '12.5% - 28.0%';
  } else {
    riskCategory = 'Critical Flag Risk';
    detectionProbability = '64.0% - 92.5%';
  }

  return {
    score: finalScore,
    riskCategory,
    detectionProbability,
    redFlags,
    optimizationTips,
    seedProtocolCompliant: seedChunkProtocol,
    jitterVarianceActive: jitterPercent >= 10,
    pacingSafetyIndex: Math.round(100 - (finalScore / 20) * 100),
  };
}
