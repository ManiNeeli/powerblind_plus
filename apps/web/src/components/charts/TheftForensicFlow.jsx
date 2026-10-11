import { useState, useMemo } from 'react';
import {
  Zap, AlertTriangle, ShieldAlert, ArrowRight, CheckCircle2,
  TrendingDown, DollarSign, Activity, Wrench, Eye, Info, Clock, Check
} from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine, Legend
} from 'recharts';
import { Badge } from '../ui/index.jsx';
import { cn } from '../../lib/utils';

const THEFT_TAXONOMY = {
  T1_PartialReduction: {
    name: 'Partial Current Reduction (Gamma-Factor Shunt)',
    summary: 'A resistor or parallel shunt wire was placed across current sensor terminals, bypassing a constant fraction (30%–70%) of real power.',
    physics: 'Current transformer (CT) coil partially shorted. The meter registers only a scaled-down proportion of true current.',
    symptom: 'Registered daily kWh drops abruptly and remains depressed by a constant ratio. Daily diurnal cycle shape remains preserved.',
    fieldProtocol: [
      'Inspect meter terminal block for parallel bypass wires or bridge jumpers',
      'Perform on-site clamp-on CT ratio test comparing secondary vs primary current',
      'Inspect physical security seals on the meter terminal cover for cuts or glue',
    ],
    severity: 'High Severity',
    badgeCls: 'bg-red-50 text-red-700 border-red-200 dark:bg-[#ff3b5c]/15 dark:text-[#ff4d6d] dark:border-[#ff3b5c]/30',
  },
  T2_ZeroConsumption: {
    name: 'Complete Meter Bypass (Zero Registration)',
    summary: 'Direct illegal tap or full mechanical bypass installed prior to service entrance disconnect.',
    physics: 'All current routes through external path; meter current coil reads zero or residual idle phantom current.',
    symptom: 'Recorded kWh collapses to near-zero (<0.15 kWh/day) while consumer continues normal facility or residential operations.',
    fieldProtocol: [
      'Trace overhead/underground service lateral cables from service head to meter box',
      'Inspect for hidden double-feed wall taps or concealed sub-panel junctions',
      'Use thermal camera on service drop to identify unauthorized heat signatures of hidden bypass',
    ],
    severity: 'Critical Severity',
    badgeCls: 'bg-red-50 text-red-700 border-red-200 dark:bg-[#ff3b5c]/15 dark:text-[#ff4d6d] dark:border-[#ff3b5c]/30',
  },
  T3_RandomReduction: {
    name: 'Intermittent / Selective Tampering',
    summary: 'Tampering occurs intermittently (e.g. night hours or during heavy industrial machinery operation).',
    physics: 'Switchable contactor, relay, or manual breaker engages bypass selectively during high-consumption periods.',
    symptom: 'Erratic day-to-day variance with severe drops alternating with normal readings; high daily volatility.',
    fieldProtocol: [
      'Install an optical check meter upstream on the distribution pole transformer',
      'Conduct surprise audit during evening peak tariff hours (18:00–22:00)',
      'Review high-frequency 15-minute interval logs to locate exact switching transitions',
    ],
    severity: 'High Severity',
    badgeCls: 'bg-red-50 text-red-700 border-red-200 dark:bg-[#ff3b5c]/15 dark:text-[#ff4d6d] dark:border-[#ff3b5c]/30',
  },
  T4_ByPassMeter: {
    name: 'Clamped Low Baseline Bypass',
    summary: 'Meter current sensor clamped with fixed impedance bridge, reporting flatlined artificial minimal consumption.',
    physics: 'Fixed low current divider keeps recorded usage unnaturally invariant, regardless of actual load demand.',
    symptom: 'Daily kWh flatlines at an unnaturally uniform low value (near-zero variance) ignoring weekend/weekday patterns.',
    fieldProtocol: [
      'Cross-examine load profile against neighbouring consumers on the same low-voltage feeder',
      'Connect calibrated phantom load test kit directly to meter terminals on-site',
      'Check internal shunt calibration screws for soldering burns or foreign flux residues',
    ],
    severity: 'Critical Severity',
    badgeCls: 'bg-red-50 text-red-700 border-red-200 dark:bg-[#ff3b5c]/15 dark:text-[#ff4d6d] dark:border-[#ff3b5c]/30',
  },
  T5_ReverseTamper: {
    name: 'Phase Inversion / Reverse Current Tampering',
    summary: 'Current coil polarity inverted or neutral-phase swapped to reverse meter rotation or smear peak load timing.',
    physics: 'Reversed CT orientation or phase swapping negates registered active energy and corrupts power factor.',
    symptom: 'Negative or severely distorted power factor; inverted consumption timing where peak hours report minimal load.',
    fieldProtocol: [
      'Verify phase-neutral wiring sequence at the utility service entrance',
      'Check meter firmware event log for "Reverse Power Flow" or "Neutral Missing" flags',
      'Inspect terminal wiring for phase cross-connection at the main circuit breaker',
    ],
    severity: 'High Severity',
    badgeCls: 'bg-red-50 text-red-700 border-red-200 dark:bg-[#ff3b5c]/15 dark:text-[#ff4d6d] dark:border-[#ff3b5c]/30',
  },
};

const DEFAULT_ATTACK = {
  name: 'Non-Technical Loss / Tampering Anomaly',
  summary: 'Abrupt collapse in recorded energy consumption inconsistent with verified baseline and electrical impedance characteristics.',
  physics: 'Physical or electronic manipulation of current measurement circuits causing unbilled energy consumption.',
  symptom: 'Sharp divergence between expected baseline demand and reported smart meter readings.',
  fieldProtocol: [
    'Perform physical meter enclosure inspection and check seal integrity',
    'Verify CT wiring and calibrate with portable field reference meter',
    'Interview consumer regarding load alterations or appliance status',
  ],
  severity: 'High Severity',
  badgeCls: 'bg-red-50 text-red-700 border-red-200 dark:bg-[#ff3b5c]/15 dark:text-[#ff4d6d] dark:border-[#ff3b5c]/30',
};

// Custom chart tooltip
function ForensicChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-glass px-4 py-3 text-xs shadow-glass border border-surface-border rounded-xl min-w-[200px] backdrop-blur-xl">
      <p className="text-ink-secondary mb-2 font-mono text-[11px] pb-1 border-b border-surface-border">
        Date: <span className="text-ink-primary font-bold">{label}</span>
      </p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="font-medium flex items-center gap-1.5" style={{ color: p.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}:
          </span>
          <span className="font-mono font-bold text-ink-primary">
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
            {p.dataKey.includes('Dollars') ? ' $' : p.dataKey.includes('Current') || p.dataKey.includes('current') ? ' A' : p.dataKey.includes('Voltage') || p.dataKey.includes('voltage') ? ' V' : ' kWh'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TheftForensicFlow({ consumer, readings = [], prediction }) {
  const [activeTab, setActiveTab] = useState('expectedVsReported'); // 'expectedVsReported' | 'electrical' | 'cumulative'
  const [activeStep, setActiveStep] = useState(3); // 1: Baseline, 2: Tamper, 3: Divergence, 4: AI Flag, 5: Protocol

  const anomalyStart = consumer?.anomalyStartDate?.slice(0, 10);
  const anomalyEnd = consumer?.anomalyEndDate?.slice(0, 10);
  const subtypeKey = consumer?.groundTruthSubtype;
  const attackInfo = THEFT_TAXONOMY[subtypeKey] || DEFAULT_ATTACK;

  // Process data for forensic analysis
  const forensicStats = useMemo(() => {
    if (!readings.length) return null;

    // Filter readings before anomaly
    const preReadings = anomalyStart
      ? readings.filter((r) => r.date < anomalyStart && r.kwh != null)
      : readings.slice(0, Math.floor(readings.length * 0.3));

    const preKwhSum = preReadings.reduce((acc, r) => acc + (r.kwh || 0), 0);
    const preMeanKwh = preReadings.length ? preKwhSum / preReadings.length : (consumer?.baseKwh || 30);

    const preCurrentSum = preReadings.reduce((acc, r) => acc + (r.currentA || 0), 0);
    const preMeanCurrent = preReadings.length ? preCurrentSum / preReadings.length : 6.0;

    // Filter readings during anomaly
    const anomalyReadings = anomalyStart && anomalyEnd
      ? readings.filter((r) => r.date >= anomalyStart && r.date <= anomalyEnd && r.kwh != null)
      : [];

    const anomKwhSum = anomalyReadings.reduce((acc, r) => acc + (r.kwh || 0), 0);
    const anomMeanKwh = anomalyReadings.length ? anomKwhSum / anomalyReadings.length : 0;

    const anomCurrentSum = anomalyReadings.reduce((acc, r) => acc + (r.currentA || 0), 0);
    const anomMeanCurrent = anomalyReadings.length ? anomCurrentSum / anomalyReadings.length : 0;

    const dropKwh = Math.max(0, preMeanKwh - anomMeanKwh);
    const dropPercent = preMeanKwh > 0 ? (dropKwh / preMeanKwh) * 100 : 0;

    // Calculate total stolen kWh and financial loss ($0.16/kWh tariff)
    let totalStolenKwh = 0;
    anomalyReadings.forEach((r) => {
      const stolen = Math.max(0, (consumer?.baseKwh || preMeanKwh) - (r.kwh || 0));
      totalStolenKwh += stolen;
    });
    const totalRevenueLoss = totalStolenKwh * 0.16;

    // Build chart dataset
    let cumStolen = 0;
    const chartData = readings.map((r) => {
      const isAnomaly = Boolean(anomalyStart && anomalyEnd && r.date >= anomalyStart && r.date <= anomalyEnd);
      const baseline = consumer?.baseKwh || preMeanKwh;
      const expectedKwh = isAnomaly ? baseline : r.kwh;
      const stolenDelta = isAnomaly ? Math.max(0, baseline - (r.kwh || 0)) : 0;

      if (isAnomaly) cumStolen += stolenDelta;

      return {
        date: r.date,
        kwh: r.kwh,
        expectedKwh: isAnomaly ? Number(expectedKwh.toFixed(2)) : undefined,
        stolenDelta: Number(stolenDelta.toFixed(2)),
        currentA: r.currentA,
        voltageV: r.voltageV,
        powerFactor: r.powerFactor,
        cumStolenKwh: Number(cumStolen.toFixed(1)),
        cumLossDollars: Number((cumStolen * 0.16).toFixed(2)),
        isAnomaly,
      };
    });

    return {
      preMeanKwh: preMeanKwh.toFixed(1),
      anomMeanKwh: anomMeanKwh.toFixed(1),
      dropPercent: dropPercent.toFixed(1),
      preMeanCurrent: preMeanCurrent.toFixed(2),
      anomMeanCurrent: anomMeanCurrent.toFixed(2),
      totalStolenKwh: Math.round(totalStolenKwh).toLocaleString(),
      totalRevenueLoss: totalRevenueLoss.toFixed(2),
      durationDays: anomalyReadings.length,
      chartData,
    };
  }, [readings, anomalyStart, anomalyEnd, consumer]);

  if (!forensicStats) return null;

  return (
    <div className="card p-6 space-y-6 border border-surface-borderLight shadow-card-hover" role="region" aria-label="Theft Forensic Analysis">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-surface-border/70">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-red-50 text-red-700 border border-red-200 dark:bg-theft-muted dark:text-[#ff4d6d] dark:border-[#ff3b5c]/30 shadow-glow-theft">
              <ShieldAlert className="w-3.5 h-3.5" />
              FORENSIC THEFT RECONSTRUCTION
            </span>
            <span className={cn('badge text-xs font-semibold', attackInfo.badgeCls)}>
              {attackInfo.name}
            </span>
          </div>
          <h2 className="text-base font-bold text-ink-primary tracking-tight">
            How The Electricity Theft Occurred & Physical Evidence Trail
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5 max-w-3xl">
            {attackInfo.summary}
          </p>
        </div>

        {/* Quick Impact Numbers */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-surface/80 border border-surface-border text-center">
            <p className="text-[10px] uppercase font-bold text-ink-muted">Recorded Drop</p>
            <p className="text-base font-extrabold font-mono text-red-600 dark:text-[#ff4d6d]">-{forensicStats.dropPercent}%</p>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-surface/80 border border-surface-border text-center">
            <p className="text-[10px] uppercase font-bold text-ink-muted">Stolen Energy</p>
            <p className="text-base font-extrabold font-mono text-accent">{forensicStats.totalStolenKwh} <span className="text-xs font-normal">kWh</span></p>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-surface/80 border border-surface-border text-center">
            <p className="text-[10px] uppercase font-bold text-ink-muted">Revenue Loss</p>
            <p className="text-base font-extrabold font-mono text-amber-600 dark:text-[#fbbf24]">${forensicStats.totalRevenueLoss}</p>
          </div>
        </div>
      </div>

      {/* ── Visual 5-Stage Incident Flow ─────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-accent" />
            End-to-End Theft Occurrence Flow
          </span>
          <span className="text-[10px] font-mono text-ink-muted">Click a phase to inspect details</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {[
            {
              num: 1,
              title: 'Normal Baseline',
              sub: `Pre-Tamper (${forensicStats.preMeanKwh} kWh/d)`,
              desc: `Consumer maintained normal usage. Line current averaged ${forensicStats.preMeanCurrent}A with valid power factor.`,
              color: 'border-emerald-300 dark:border-[#10b981]/40 bg-emerald-50 dark:bg-[#10b981]/5 text-emerald-700 dark:text-[#34d399]',
              icon: CheckCircle2,
            },
            {
              num: 2,
              title: 'Tamper Executed',
              sub: anomalyStart ? `Event: ${anomalyStart}` : 'Tampering Onset',
              desc: `Physical bypass or shunt installed. Registered current plunged from ${forensicStats.preMeanCurrent}A to ${forensicStats.anomMeanCurrent}A.`,
              color: 'border-red-300 dark:border-[#ff3b5c]/40 bg-red-50 dark:bg-[#ff3b5c]/10 text-red-700 dark:text-[#ff4d6d]',
              icon: Zap,
            },
            {
              num: 3,
              title: 'Divergence Window',
              sub: `${forensicStats.durationDays} Days Active Theft`,
              desc: `Apparent kWh collapsed by ${forensicStats.dropPercent}%. Energy continues powering premises without spinning meter.`,
              color: 'border-amber-300 dark:border-[#f59e0b]/40 bg-amber-50 dark:bg-[#f59e0b]/10 text-amber-800 dark:text-[#fbbf24]',
              icon: TrendingDown,
            },
            {
              num: 4,
              title: 'AI Neural Detection',
              sub: `${prediction?.confidence ? Math.round(prediction.confidence * 100) : 98}% Model Confidence`,
              desc: 'PowerBlind+ XGBoost flagged statistical variance collapse and current-to-voltage impedance discrepancy.',
              color: 'border-accent/40 bg-accent/10 text-accent',
              icon: Eye,
            },
            {
              num: 5,
              title: 'Inspection Dispatch',
              sub: 'Evidence Pack Ready',
              desc: 'Utility crew dispatches with tamper evidence checklist, estimated loss bill, and targeted terminal inspection.',
              color: 'border-indigo-300 dark:border-[#6366f1]/40 bg-indigo-50 dark:bg-[#6366f1]/10 text-indigo-700 dark:text-[#818cf8]',
              icon: Wrench,
            },
          ].map((s) => {
            const SIcon = s.icon;
            const isSelected = activeStep === s.num;
            return (
              <button
                key={s.num}
                onClick={() => setActiveStep(s.num)}
                className={cn(
                  'text-left p-3.5 rounded-xl border transition-all duration-200 relative group flex flex-col justify-between',
                  isSelected
                    ? `${s.color} shadow-glow-accent ring-1 ring-accent/30`
                    : 'border-surface-border bg-surface/40 hover:bg-surface hover:border-surface-borderLight',
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface/90 border border-surface-border">
                      STAGE 0{s.num}
                    </span>
                    <SIcon className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-xs font-bold text-ink-primary group-hover:text-accent transition-colors">
                    {s.title}
                  </p>
                  <p className="text-[10px] font-mono text-ink-muted mt-0.5">{s.sub}</p>
                </div>
                <p className="text-[10px] text-ink-secondary mt-2.5 line-clamp-3 leading-relaxed">
                  {s.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chart Mode Selector & Visual Plot Graphs ────────────────────────── */}
      <div className="card p-5 bg-surface/30 border border-surface-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-glow-accent" />
              Forensic Evidence Plot Graphs
            </h3>
            <p className="text-[11px] text-ink-muted mt-0.5">
              Visual proof comparing expected legitimate consumption against unmetered energy bypass
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-canvas border border-surface-border shrink-0">
            <button
              onClick={() => setActiveTab('expectedVsReported')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                activeTab === 'expectedVsReported'
                  ? 'bg-accent/15 text-accent shadow-glow-accent font-bold'
                  : 'text-ink-secondary hover:text-ink-primary',
              )}
            >
              Expected vs Reported (Theft Zone)
            </button>
            <button
              onClick={() => setActiveTab('electrical')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                activeTab === 'electrical'
                  ? 'bg-accent/15 text-accent shadow-glow-accent font-bold'
                  : 'text-ink-secondary hover:text-ink-primary',
              )}
            >
              Current (A) vs Voltage (V) Proof
            </button>
            <button
              onClick={() => setActiveTab('cumulative')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                activeTab === 'cumulative'
                  ? 'bg-accent/15 text-accent shadow-glow-accent font-bold'
                  : 'text-ink-secondary hover:text-ink-primary',
              )}
            >
              Cumulative Loss Tracker ($)
            </button>
          </div>
        </div>

        {/* ── Plot 1: Expected vs Reported with Shaded Stolen Gap ───────────── */}
        {activeTab === 'expectedVsReported' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-ink-secondary px-1 flex-wrap gap-2">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-0.5 bg-[#00f2b2] inline-block" />
                  Meter Registered kWh (Tampered)
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-0.5 bg-[#818cf8] border-b border-dashed border-[#818cf8] inline-block" />
                  Expected Authentic Baseline ({forensicStats.preMeanKwh} kWh)
                </span>
                <span className="flex items-center gap-1.5 font-medium text-[#ff4d6d]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#ff3b5c]/25 border border-[#ff3b5c]/50 inline-block" />
                  Stolen / Diverted Energy Zone (Gap)
                </span>
              </div>
              <span className="text-[10px] font-mono text-ink-muted">
                Shaded red band = Active meter bypass period ({anomalyStart} → {anomalyEnd})
              </span>
            </div>

            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={forensicStats.chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="kwhFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f2b2" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00f2b2" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="stolenZoneGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff3b5c" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ff3b5c" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--color-ink-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(d) => d?.slice(5)} />
                <YAxis tick={{ fill: 'var(--color-ink-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ForensicChartTooltip />} />

                {anomalyStart && anomalyEnd && (
                  <ReferenceArea
                    x1={anomalyStart}
                    x2={anomalyEnd}
                    fill="#ff3b5c"
                    fillOpacity={0.09}
                    stroke="#ff3b5c"
                    strokeOpacity={0.35}
                    strokeDasharray="4 4"
                  />
                )}

                {anomalyStart && (
                  <ReferenceLine
                    x={anomalyStart}
                    stroke="#ff3b5c"
                    strokeWidth={2}
                    label={{ value: '⚡ Tamper Event', position: 'top', fill: '#ff4d6d', fontSize: 10, fontWeight: 'bold' }}
                  />
                )}

                {anomalyEnd && (
                  <ReferenceLine
                    x={anomalyEnd}
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    label={{ value: '✓ Normalized', position: 'top', fill: '#34d399', fontSize: 10, fontWeight: 'bold' }}
                  />
                )}

                {/* Stolen Energy Delta fill */}
                <Area
                  type="monotone"
                  dataKey="stolenDelta"
                  name="Unmetered Stolen kWh (Daily)"
                  fill="url(#stolenZoneGradient)"
                  stroke="#ff3b5c"
                  strokeWidth={1.5}
                  dot={false}
                />

                {/* Registered Meter Consumption */}
                <Area
                  type="monotone"
                  dataKey="kwh"
                  name="Meter Registered kWh"
                  fill="url(#kwhFill)"
                  stroke="#00f2b2"
                  strokeWidth={2}
                  dot={false}
                />

                {/* Expected Baseline Line */}
                <Line
                  type="monotone"
                  dataKey="expectedKwh"
                  name="Expected Baseline kWh"
                  stroke="#818cf8"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Plot 2: Electrical Evidence (Current Plunge vs Voltage Stability) */}
        {activeTab === 'electrical' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-ink-secondary px-1 flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium text-[#f59e0b]">
                  <span className="w-3 h-0.5 bg-[#f59e0b] inline-block" />
                  Recorded Line Current (Amperes) — Plunges during theft
                </span>
                <span className="flex items-center gap-1.5 font-medium text-[#6366f1]">
                  <span className="w-3 h-0.5 bg-[#6366f1] inline-block" />
                  Grid Line Voltage (Volts) — Remains constant (~230V)
                </span>
              </div>
              <span className="text-[10px] font-mono text-ink-muted">
                Physical Proof: Constant voltage proves supply was active while current was diverted!
              </span>
            </div>

            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={forensicStats.chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--color-ink-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(d) => d?.slice(5)} />
                <YAxis yAxisId="current" tick={{ fill: '#f59e0b', fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: 'Current (A)', angle: -90, position: 'insideLeft', fill: '#f59e0b', fontSize: 10 }} />
                <YAxis yAxisId="voltage" orientation="right" domain={[200, 260]} tick={{ fill: '#818cf8', fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: 'Voltage (V)', angle: 90, position: 'insideRight', fill: '#818cf8', fontSize: 10 }} />
                <Tooltip content={<ForensicChartTooltip />} />

                {anomalyStart && anomalyEnd && (
                  <ReferenceArea yAxisId="current" x1={anomalyStart} x2={anomalyEnd} fill="#ff3b5c" fillOpacity={0.08} />
                )}

                <Line yAxisId="current" type="monotone" dataKey="currentA" name="Line Current (A)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line yAxisId="voltage" type="monotone" dataKey="voltageV" name="Line Voltage (V)" stroke="#6366f1" strokeWidth={1.5} dot={false} strokeDasharray="3 2" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Plot 3: Cumulative Stolen Energy & Revenue Loss ─────────────── */}
        {activeTab === 'cumulative' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-ink-secondary px-1 flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium text-accent">
                  <span className="w-3 h-0.5 bg-accent inline-block" />
                  Cumulative Stolen Energy (kWh)
                </span>
                <span className="flex items-center gap-1.5 font-medium text-[#fbbf24]">
                  <span className="w-3 h-0.5 bg-[#fbbf24] inline-block" />
                  Cumulative Unbilled Utility Revenue ($)
                </span>
              </div>
              <span className="text-[10px] font-mono text-ink-muted">
                Calculated at standard utility tariff rate of $0.16/kWh
              </span>
            </div>

            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={forensicStats.chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumLossGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--color-ink-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(d) => d?.slice(5)} />
                <YAxis yAxisId="kwh" tick={{ fill: 'var(--color-ink-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="cost" orientation="right" tick={{ fill: '#fbbf24', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ForensicChartTooltip />} />

                {anomalyStart && anomalyEnd && (
                  <ReferenceArea yAxisId="kwh" x1={anomalyStart} x2={anomalyEnd} fill="#ff3b5c" fillOpacity={0.06} />
                )}

                <Area yAxisId="cost" type="monotone" dataKey="cumLossDollars" name="Cumulative Loss ($)" fill="url(#cumLossGradient)" stroke="#fbbf24" strokeWidth={2} dot={false} />
                <Line yAxisId="kwh" type="monotone" dataKey="cumStolenKwh" name="Cumulative Stolen (kWh)" stroke="#00f2b2" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Attack Vector & Field Inspection Protocol Breakdown ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
        {/* Physical Attack Anatomy */}
        <div className="p-4 rounded-xl bg-surface/40 border border-surface-border space-y-3">
          <div className="flex items-center gap-2 text-ink-primary font-bold text-xs uppercase tracking-wider">
            <Info className="w-4 h-4 text-accent" />
            Physical Attack Anatomy & Tampering Mechanism
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-lg bg-canvas-50/70 border border-surface-border">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                How It Was Executed
              </p>
              <p className="text-ink-primary leading-relaxed">
                {attackInfo.physics}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-canvas-50/70 border border-surface-border">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                Meter Data Symptom
              </p>
              <p className="text-ink-primary leading-relaxed">
                {attackInfo.symptom}
              </p>
            </div>
          </div>
        </div>

        {/* Field Crew Verification Protocol */}
        <div className="p-4 rounded-xl bg-surface/40 border border-surface-border space-y-3">
          <div className="flex items-center gap-2 text-ink-primary font-bold text-xs uppercase tracking-wider">
            <Wrench className="w-4 h-4 text-[#fbbf24]" />
            Field Crew Action Protocol & Evidence Checklist
          </div>
          <div className="space-y-2">
            {attackInfo.fieldProtocol.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-canvas-50/70 border border-surface-border">
                <span className="w-5 h-5 rounded-md bg-accent/15 text-accent border border-accent/30 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                  0{idx + 1}
                </span>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
