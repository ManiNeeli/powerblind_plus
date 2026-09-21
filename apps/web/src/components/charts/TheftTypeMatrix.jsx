import React, { useState } from 'react';
import {
  Zap, AlertTriangle, Radio, CheckCircle2, ShieldAlert, Cpu,
  Activity, ArrowRight, Gauge, Layers, Info, Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';

const ANOMALY_CLASSES = [
  {
    id: 'Theft',
    label: 'Electricity Theft',
    code: 'T-SERIES',
    color: '#ff3b5c',
    bg: 'rgba(255, 59, 92, 0.12)',
    border: 'rgba(255, 59, 92, 0.3)',
    shadow: 'shadow-glow-theft',
    icon: Zap,
    desc: 'Unmetered load diverts around measurement shunt or register is suppressed.',
    subtypes: [
      { id: 'T1_PartialReduction', name: 'T1 — Partial Reduction (Gamma Attack)', formula: 'kWh_rep = γ · kWh_actual (γ ∈ [0.3, 0.7])', desc: 'Mechanical tamper, magnetic saturation of CT, or hidden resistive shunt dividing load.' },
      { id: 'T2_ZeroConsumption',  name: 'T2 — Zero Consumption (Complete Bypass)', formula: 'kWh_rep ≈ 0 while V_line ≈ 230V', desc: 'Direct bridge jumper cable installed across meter line & load terminals.' },
      { id: 'T3_RandomReduction',  name: 'T3 — Dynamic Tamper (Variable Shunt)', formula: 'kWh_rep = γ(t) · kWh_actual (varying γ)', desc: 'Microcontroller-controlled electronic switch varying suppression ratio to evade detection.' },
      { id: 'T4_ByPassMeter',      name: 'T4 — Flatline Low (Bypass Shunt)', formula: 'kWh_rep = const ≈ 0.2 · Base (CV < 0.05)', desc: 'Permanent fixed-resistance shunt clamped across meter terminals, flatlining consumption.' },
      { id: 'T5_ReverseTamper',    name: 'T5 — Reverse Tamper / Peak Smear', formula: 'Peak load inverted & temporally smeared', desc: 'Current transformer polarity reversed or secondary winding reversed during peak hours.' },
    ]
  },
  {
    id: 'FaultyMeter',
    label: 'Hardware Fault',
    code: 'F-SERIES',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
    shadow: 'shadow-glow-fault',
    icon: AlertTriangle,
    desc: 'Internal register failure, ADC drift, or physical sensor breakdown.',
    subtypes: [
      { id: 'F1_StuckAt',       name: 'F1 — Stuck Meter Register', formula: 'kWh(t) = kWh(t-1) for consecutive days', desc: 'Digital memory corruption or mechanical gear jamming keeps reported reading constant.' },
      { id: 'F2_Drift',         name: 'F2 — Calibration Decay Drift', formula: 'kWh_rep(t) = kWh(t) ± m·t (decay slope)', desc: 'Analog resistor aging or capacitor dielectric decay causing gradual calibration drift.' },
      { id: 'F3_NoiseSpike',    name: 'F3 — Sensor Noise Spikes', formula: 'Spikes > 3.0× baseline without voltage drop', desc: 'Intermittent current transformer secondary open-circuit or loose terminal arcing.' },
      { id: 'F4_UnderRegister', name: 'F4 — CT Under-Registration', formula: 'Fixed 15%–35% scaling across all seasons', desc: 'CT saturation or burden resistor value mismatch resulting in consistent under-recording.' },
    ]
  },
  {
    id: 'CommFailure',
    label: 'Telecom Dropout',
    code: 'C-SERIES',
    color: '#6366f1',
    bg: 'rgba(99, 102, 241, 0.12)',
    border: 'rgba(99, 102, 241, 0.3)',
    shadow: 'shadow-glow-comm',
    icon: Radio,
    desc: 'AMI wireless network packet loss, gateway retransmissions, or timestamp desync.',
    subtypes: [
      { id: 'C1_MissingData',           name: 'C1 — Missing Packet Drop', formula: 'Packet loss > 5% null values with comm flags', desc: 'RF mesh interference or cellular tower handover failure causing missing AMI packets.' },
      { id: 'C2_DuplicateTransmission', name: 'C2 — Stale Packet Resend', formula: 'Repeated cached daily packet with comm flag', desc: 'Gateway buffer timeout resending previous cached reading instead of new telemetry.' },
      { id: 'C3_ClockSkew',             name: 'C3 — RTC Clock Skew', formula: 'Timestamp interval shifted across dates', desc: 'Real-time clock oscillator crystal drift misaligning daily billing intervals.' },
    ]
  },
  {
    id: 'Normal',
    label: 'Normal Operation',
    code: 'NOMINAL',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
    shadow: 'shadow-glow-normal',
    icon: CheckCircle2,
    desc: 'Fully compliant consumption adhering to seasonal baseline and electrical laws.',
    subtypes: [
      { id: 'Normal', name: 'Standard Tariff Baseline', formula: 'P = V · I · cos(φ) verified within ±5%', desc: 'Balanced circuit where metered energy matches theoretical power equation without bypass.' },
    ]
  },
];

export default function TheftTypeMatrix({ consumer, prediction, readings = [] }) {
  const activeLabel = prediction?.predictedLabel || consumer?.groundTruthLabel || 'Normal';
  const activeSubtype = prediction?.predictedSubtype || consumer?.groundTruthSubtype;
  const probabilities = prediction?.classProbabilities || { [activeLabel]: 0.95 };
  const proof = prediction?.physicsProof || {};

  const [selectedClassId, setSelectedClassId] = useState(activeLabel);

  const selectedCategory = ANOMALY_CLASSES.find(c => c.id === selectedClassId) || ANOMALY_CLASSES[0];
  const activeCategory = ANOMALY_CLASSES.find(c => c.id === activeLabel) || ANOMALY_CLASSES[0];

  const isTheft = activeLabel === 'Theft';
  const isFault = activeLabel === 'FaultyMeter';
  const isNormal = activeLabel === 'Normal';

  return (
    <div className="card p-5 space-y-6 relative overflow-hidden border border-surface-border">
      {/* Background ambient lighting pulse */}
      <div
        className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700 animate-pulse"
        style={{ background: activeCategory.color }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-accent" />
            <h2 className="text-xs font-bold text-ink-primary uppercase tracking-wider">
              Forensic Anomaly & Theft Type Matrix
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-accent/30 bg-accent/10 text-accent font-bold">
              Physics-Verified
            </span>
          </div>
          <p className="text-xs text-ink-secondary">
            Multi-class anomaly categorization evaluated against electrical power conservation laws and telemetry dynamics.
          </p>
        </div>

        {/* Live Status Pill */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold font-mono tracking-tight"
          style={{ background: activeCategory.bg, borderColor: activeCategory.border, color: activeCategory.color }}
        >
          <span className="w-2 h-2 rounded-full bg-current animate-ping" />
          <span>CLASSIFICATION: {activeCategory.label.toUpperCase()}</span>
          {activeSubtype && (
            <span className="bg-black/30 px-1.5 py-0.5 rounded text-[10px] text-white">
              {activeSubtype}
            </span>
          )}
        </div>
      </div>

      {/* 4 Category Selector Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ANOMALY_CLASSES.map(cls => {
          const Icon = cls.icon;
          const isCurrentActive = cls.id === activeLabel;
          const isSelected = cls.id === selectedClassId;
          const prob = probabilities[cls.id] != null ? probabilities[cls.id] : 0;
          const pct = Math.round(prob * 100);

          return (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={cn(
                'relative p-3.5 rounded-xl border text-left transition-all duration-300 flex flex-col justify-between group overflow-hidden',
                isSelected
                  ? 'bg-surface/80 border-surface-borderLight shadow-md scale-[1.01]'
                  : 'bg-surface/30 border-surface-border hover:bg-surface/50 hover:border-surface-borderLight'
              )}
              style={{
                borderColor: isSelected ? cls.color : undefined,
                boxShadow: isSelected ? `0 0 16px ${cls.color}25` : undefined,
              }}
            >
              {/* Active neon highlight ribbon */}
              {isCurrentActive && (
                <div
                  className="absolute top-0 right-0 px-2 py-0.5 rounded-bl-lg text-[9px] font-mono font-extrabold uppercase tracking-wider text-canvas"
                  style={{ background: cls.color }}
                >
                  Detected
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="p-1.5 rounded-lg shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: cls.bg, color: cls.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-ink-primary leading-tight">{cls.label}</h3>
                    <p className="text-[10px] font-mono text-ink-muted">{cls.code}</p>
                  </div>
                </div>
                <p className="text-[11px] text-ink-secondary leading-snug line-clamp-2 mb-3">
                  {cls.desc}
                </p>
              </div>

              <div>
                {/* Probability Bar */}
                <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                  <span className="text-ink-muted text-[10px]">Probability</span>
                  <span className="font-bold" style={{ color: cls.color }}>{pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-surface-border/70 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: cls.color }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Subtype Breakdown & Electrical Circuit Proof Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Subtype Explorer Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-accent" />
              <span>{selectedCategory.label} Subtypes ({selectedCategory.subtypes.length})</span>
            </h3>
            <span className="text-[10px] font-mono text-ink-muted">Click to inspect physics formula</span>
          </div>

          <div className="space-y-2">
            {selectedCategory.subtypes.map(sub => {
              const isDetectedSubtype = sub.id === activeSubtype || (selectedClassId === activeLabel && selectedCategory.subtypes.length === 1);
              return (
                <div
                  key={sub.id}
                  className={cn(
                    'p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden',
                    isDetectedSubtype
                      ? 'bg-surface/90 border-surface-borderLight shadow-sm'
                      : 'bg-surface/20 border-surface-border/70 hover:bg-surface/40'
                  )}
                  style={{
                    borderColor: isDetectedSubtype ? selectedCategory.color : undefined,
                  }}
                >
                  {isDetectedSubtype && (
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ background: selectedCategory.color }}
                    />
                  )}

                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink-primary">{sub.name}</span>
                      {isDetectedSubtype && (
                        <span
                          className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded border uppercase animate-pulse"
                          style={{
                            background: selectedCategory.bg,
                            borderColor: selectedCategory.border,
                            color: selectedCategory.color,
                          }}
                        >
                          Active Match
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Math Formula Badge */}
                  <div className="bg-canvas/60 border border-surface-border rounded px-2 py-1 mb-1.5 inline-block">
                    <code className="text-[10px] font-mono text-accent font-semibold">
                      {sub.formula}
                    </code>
                  </div>

                  <p className="text-[11px] text-ink-secondary leading-relaxed">
                    {sub.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Animated Physical Circuit Schematic & Law Proof (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-accent" />
              <span>Physical Circuit Proof & KCL</span>
            </h3>
            <span className="text-[10px] font-mono text-accent font-bold">Live Model</span>
          </div>

          {/* Animated Circuit SVG */}
          <div className="bg-canvas-50 rounded-xl border border-surface-border p-4 relative overflow-hidden flex flex-col justify-between h-full">
            <div className="relative w-full h-36">
              <svg className="w-full h-full" viewBox="0 0 340 140" fill="none">
                {/* Feeder Line */}
                <path d="M 20 70 L 100 70" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                <circle cx="20" cy="70" r="4" fill="#3b82f6" />
                <text x="18" y="55" fill="var(--color-ink-muted)" fontSize="9" fontFamily="monospace">GRID 230V</text>

                {/* Meter Register Box */}
                <rect
                  x="100" y="45" width="130" height="50" rx="6"
                  fill="#161b22"
                  stroke={isTheft ? '#ff3b5c' : isFault ? '#f59e0b' : '#10b981'}
                  strokeWidth="1.5"
                  className={isTheft ? 'shadow-glow-theft' : ''}
                />
                <text x="112" y="65" fill="#f0f6fc" fontSize="10" fontWeight="bold" fontFamily="monospace">SMART METER</text>
                <text x="112" y="82" fill="var(--color-ink-muted)" fontSize="8.5" fontFamily="monospace">
                  {proof.meanKwh ? `${proof.meanKwh.toFixed(1)} kWh/d` : 'METER CT'}
                </text>

                {/* Metered Current Flow through Register */}
                <path
                  d="M 100 70 L 230 70"
                  stroke={isTheft ? '#8b949e' : '#10b981'}
                  strokeWidth="2.5"
                  strokeDasharray={isTheft ? '4 3' : undefined}
                />

                {/* Load Side */}
                <path d="M 230 70 L 310 70" stroke="#00f2b2" strokeWidth="3" strokeLinecap="round" />
                <circle cx="310" cy="70" r="4" fill="#00f2b2" />
                <text x="280" y="55" fill="var(--color-ink-muted)" fontSize="9" fontFamily="monospace">LOAD</text>

                {/* Unmetered Bypass Shunt Circuit (Active only if Theft) */}
                {isTheft ? (
                  <>
                    <path
                      d="M 80 70 L 80 18 L 250 18 L 250 70"
                      stroke="#ff3b5c"
                      strokeWidth="2.5"
                      strokeDasharray="5 3"
                      className="animate-pulse"
                    />
                    <circle cx="80" cy="70" r="3.5" fill="#ff3b5c" />
                    <circle cx="250" cy="70" r="3.5" fill="#ff3b5c" />
                    <rect x="135" y="8" width="60" height="18" rx="3" fill="#ff3b5c" />
                    <text x="142" y="21" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      BYPASS TAP
                    </text>
                  </>
                ) : (
                  <path
                    d="M 80 70 L 80 25 L 250 25 L 250 70"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                  />
                )}
              </svg>
            </div>

            {/* Circuit State Status */}
            <div className="pt-2 border-t border-surface-border/60">
              <div className="flex items-center justify-between text-[11px] font-mono mb-2">
                <span className="text-ink-muted">KCL Circuit State</span>
                <span
                  className="font-bold text-[10px] px-2 py-0.5 rounded border"
                  style={{
                    background: isTheft ? 'rgba(255,59,92,0.15)' : 'rgba(16,185,129,0.15)',
                    borderColor: isTheft ? 'rgba(255,59,92,0.3)' : 'rgba(16,185,129,0.3)',
                    color: isTheft ? '#ff4d6d' : '#34d399',
                  }}
                >
                  {proof.kclCircuitState ?? (isTheft ? 'VIOLATION_SHUNT_FLOW' : 'VERIFIED_BALANCED')}
                </span>
              </div>

              {/* Physical Energy Discrepancy Box */}
              <div className="space-y-1.5 text-[11px] font-mono bg-canvas/80 p-2.5 rounded-lg border border-surface-border">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Expected Baseline:</span>
                  <span className="text-ink-primary font-bold">{proof.baseKwh ? `${proof.baseKwh.toFixed(1)} kWh/d` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Reported Metered:</span>
                  <span className="text-ink-primary font-bold">{proof.meanKwh ? `${proof.meanKwh.toFixed(1)} kWh/d` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Active Feeder Voltage:</span>
                  <span className="text-[#3b82f6] font-bold">{proof.meanVoltage ? `${proof.meanVoltage.toFixed(1)} V (OK)` : '230.0 V'}</span>
                </div>
                {isTheft && (
                  <div className="flex justify-between pt-1 border-t border-surface-border/70 text-[#ff4d6d] font-bold">
                    <span>Unmetered Shunt Flow:</span>
                    <span>~{proof.unmeteredDailyKwh?.toFixed(1) ?? '—'} kWh/d</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
