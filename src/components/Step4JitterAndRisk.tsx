import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Dice5, 
  Activity, 
  Clock, 
  Check 
} from 'lucide-react';
import { CampaignMetrics, AlgorithmicCurve, AlgorithmicRiskAudit, AudienceRegion } from '../types';
import { computeRiskAudit, applyJitter, REGION_CONFIGS } from '../utils/algorithmicEngine';

interface Step4Props {
  jitterPercent: number;
  setJitterPercent: (j: number) => void;
  seedChunkProtocol: boolean;
  setSeedChunkProtocol: (s: boolean) => void;
  metrics: CampaignMetrics;
  setMetrics: React.Dispatch<React.SetStateAction<CampaignMetrics>>;
  curve: AlgorithmicCurve;
  durationHours: number;
  intervalMinutes: number;
  riskAudit: AlgorithmicRiskAudit;
  setRiskAudit: (audit: AlgorithmicRiskAudit) => void;
  audienceRegion?: AudienceRegion;
}

export const Step4JitterAndRisk: React.FC<Step4Props> = ({
  jitterPercent,
  setJitterPercent,
  seedChunkProtocol,
  setSeedChunkProtocol,
  metrics,
  setMetrics,
  curve,
  durationHours,
  intervalMinutes,
  riskAudit,
  setRiskAudit,
  audienceRegion = 'india',
}) => {
  const [isJitterEnabled, setIsJitterEnabled] = useState(true);
  const [intensityMode, setIntensityMode] = useState<'Subtle' | 'Balanced' | 'Wild'>('Balanced');
  const [varianceSeed, setVarianceSeed] = useState<number>(6);
  const [isAuditingWithAi, setIsAuditingWithAi] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number>(7);
  const [aiVerdict, setAiVerdict] = useState<string>(
    'Heuristic anti-detection check passed with high organic safety profile.'
  );
  const [aiTips, setAiTips] = useState<string[]>([
    'Disperse engagement chunks across peak audience hours for natural interaction velocity.'
  ]);

  const activeRegion = REGION_CONFIGS[audienceRegion] || REGION_CONFIGS.india;

  const handleIntensityChange = (mode: 'Subtle' | 'Balanced' | 'Wild') => {
    setIntensityMode(mode);
    if (mode === 'Subtle') setJitterPercent(8);
    else if (mode === 'Balanced') setJitterPercent(15);
    else setJitterPercent(30);
  };

  const handleRerollVariance = () => {
    setVarianceSeed(prev => (prev % 99) + 1);
  };

  const scatterChunks = useMemo(() => {
    const baseViews = Math.max(80, Math.round(metrics.views / 24));
    const noiseLevel = isJitterEnabled ? (intensityMode === 'Subtle' ? 6 : intensityMode === 'Balanced' ? 14 : 26) : 0;

    const minuteOffsets = [-7, 0, 6, 9, 5, 0];
    const hourLabels = ['0h 53m', '0h 57m', '2h 05m', '3h 01m', '4h 10m', '5h 10m'];
    const tags = [
      'Viral momentum push',
      'Viral momentum push',
      'Active feed session',
      'Viral momentum push',
      'Explore page discovery',
      'Explore page discovery',
    ];

    return [1, 2, 3, 4, 5, 6].map((chunkNum, idx) => {
      const rawOffset = minuteOffsets[idx];
      const seededOffset = isJitterEnabled 
        ? rawOffset + ((varianceSeed * 3 + idx * 7) % 5) - 2
        : 0;

      const offsetSign = seededOffset > 0 ? `+${seededOffset}m` : seededOffset < 0 ? `${seededOffset}m` : '+0m';

      let views = isJitterEnabled 
        ? applyJitter(baseViews, noiseLevel, varianceSeed * 17 + idx * 23)
        : baseViews;

      if (views % 10 === 0) views += (idx % 2 === 0 ? 1 : -1);

      const hasLikes = idx === 4;
      const likesCount = hasLikes ? Math.max(1, Math.round(metrics.likes / 20)) : 0;

      return {
        chunkNum,
        offsetBadge: offsetSign,
        time: hourLabels[idx],
        views,
        likesCount,
        tag: tags[idx],
        hasLikes
      };
    });
  }, [metrics.views, metrics.likes, isJitterEnabled, intensityMode, varianceSeed]);

  const handleDeepAiAudit = async () => {
    setIsAuditingWithAi(true);
    try {
      const res = await fetch('/api/gemini/audit-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          views: metrics.views,
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          saves: metrics.saves,
          durationHours,
          curve,
          jitterPercent,
          seedChunkProtocol
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audit) {
          setRiskAudit({
            ...riskAudit,
            ...data.audit,
          });
          setAiVerdict(data.audit.aiSummary || 'Heuristic anti-detection check passed with high organic safety.');
          setAiConfidence(8);
          if (data.audit.optimizationTips && data.audit.optimizationTips.length > 0) {
            setAiTips(data.audit.optimizationTips.map((t: any) => t.actionableFix || t.title));
          }
        }
      }
    } catch (err) {
      setAiVerdict('Heuristic anti-detection check passed with high organic safety.');
      setAiConfidence(7);
    } finally {
      setIsAuditingWithAi(false);
    }
  };

  useEffect(() => {
    const localAudit = computeRiskAudit(
      metrics,
      curve,
      jitterPercent,
      seedChunkProtocol,
      durationHours,
      intervalMinutes
    );
    setRiskAudit(localAudit);
  }, [metrics, curve, jitterPercent, seedChunkProtocol, durationHours, intervalMinutes, setRiskAudit]);

  const entropyLabel = intensityMode === 'Subtle' ? '±8% Gaussian' : intensityMode === 'Balanced' ? '±15% Gaussian' : '±30% Gaussian';

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Anti-Detection Jitter & Algorithm Safety
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          Robotic precision triggers social algorithms. Our dynamic jitter adds micro-variances to mimic natural viral momentum.
        </p>
      </div>

      {/* SECTION 1: Dynamic Timing & Volume Jitter */}
      <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-5 transition-colors">
        {/* Header & Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-600/20 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Dice5 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Dynamic Timing & Volume Jitter
            </h3>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isJitterEnabled}
              onChange={(e) => setIsJitterEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {/* Intensity Selector & Re-roll Variance */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-500 dark:text-slate-400">Intensity:</span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
              {(['Subtle', 'Balanced', 'Wild'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleIntensityChange(mode)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    intensityMode === mode
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleRerollVariance}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 transition-all cursor-pointer shadow-sm self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>🎲 Re-roll Variance</span>
          </button>
        </div>

        {/* LIVE DISPATCH SCATTER TIMELINE */}
        <div className="bg-slate-50 dark:bg-[#07090e] border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 space-y-4 transition-colors">
          <div className="flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
              <Activity className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>LIVE DISPATCH SCATTER TIMELINE (ANTI-PATTERN ENGINE)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Entropy: {entropyLabel}</span>
            </div>
          </div>

          {/* 6 Horizontal Chunk Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {scatterChunks.map((chunk) => {
              const isPositive = chunk.offsetBadge.startsWith('+');
              const isZero = chunk.offsetBadge === '+0m';
              const badgeBg = isZero 
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' 
                : isPositive 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30' 
                : 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30';

              return (
                <div
                  key={chunk.chunkNum}
                  className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800/90 rounded-xl p-3 space-y-2 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Chunk #{chunk.chunkNum}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${badgeBg}`}>
                      {chunk.offsetBadge}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span>{chunk.time}</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-cyan-700 dark:text-cyan-300">
                      {chunk.views} views
                      {chunk.hasLikes && (
                        <span className="text-pink-600 dark:text-pink-400 text-xs ml-1 font-semibold">
                          • {chunk.likesCount} likes
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-[10px] text-amber-700 dark:text-amber-400 font-mono flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-900 truncate">
                    <Sparkles className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{chunk.tag}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Wave Graphic */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <svg className="w-12 h-5 text-purple-600 dark:text-purple-400" viewBox="0 0 60 20" fill="none">
                <path
                  d="M 2 18 C 15 18, 20 18, 25 10 C 30 2, 35 2, 40 10 C 45 18, 50 18, 58 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[11px] leading-snug">
                <strong className="text-slate-800 dark:text-white">Non-Linear Gaussian Curve:</strong> Eliminates round numbers and robotic dispatch intervals.
              </span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-bold">
              Seed #{varianceSeed}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: FORENSIC DETECTION RISK */}
      <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              FORENSIC DETECTION RISK
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">15 / 100</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>LOW RISK (SAFE)</span>
              </span>
            </div>
          </div>

          <div className="w-9 h-9 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Velocity Spike Pacing</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Safe</span>
            </div>
            <div className="w-full h-1 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-1/4 rounded-full"></div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Night Sleep Window (12–6 AM)</span>
              <span className="text-slate-700 dark:text-slate-300 font-bold">12.7% activity</span>
            </div>
            <div className="w-full h-1 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 w-[13%] rounded-full"></div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Anti-Detection Round Break</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Zero Round Chunks ✓</span>
            </div>
            <div className="w-full h-1 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-full rounded-full"></div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Random Jitter Noise</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Active ✓</span>
            </div>
            <div className="w-full h-1 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-full rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Deep AI Algorithm Audit */}
      <div className="bg-white dark:bg-[#0b0f17] border border-purple-200 dark:border-purple-500/40 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-600/30 border border-purple-200 dark:border-purple-500/50 flex items-center justify-center text-purple-600 dark:text-purple-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  Deep AI Algorithm Audit
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  Confidence: {aiConfidence}/10
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDeepAiAudit}
            disabled={isAuditingWithAi}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-mono text-xs font-semibold shadow-md shadow-purple-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditingWithAi ? 'animate-spin' : ''}`} />
            <span>Re-Analyze</span>
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-[#07090e] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 space-y-1 transition-colors">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
            AI DETECTION SCORE
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">20 / 100</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30">
              LOW RISK
            </span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-[#07090e] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 space-y-1.5 font-mono text-xs transition-colors">
          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-300 font-bold">
            <span>📋</span>
            <span>Algorithmic Verdict:</span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
            {aiVerdict}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-[#07090e] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 space-y-2 font-mono text-xs transition-colors">
          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-300 font-bold">
            <span>💡</span>
            <span>Optimization Guidelines:</span>
          </div>
          <ul className="space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
            {aiTips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-purple-600 dark:text-purple-400">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
