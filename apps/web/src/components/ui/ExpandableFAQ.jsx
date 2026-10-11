import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

const FAQ_ITEMS = [
  {
    q: 'What is Non-Technical Loss (NTL) in modern smart grids?',
    a: 'Non-Technical Losses (NTL) represent unaccounted-for energy consumed that is not caused by physical transmission resistance (Joule heating). They predominantly stem from physical meter bypassing, phase shunt wiring, reverse current transformers, and firmware tampering.',
  },
  {
    q: 'How does PowerBlind+ identify Theft, Faulty Meters, and Communication Failures?',
    a: 'PowerBlind+ fuses XGBoost tree ensembles with physical constraint checking: Theft presents sustained energy drops without matching impedance shifts; Faulty Meters show stuck registers or negative current signatures; Communication Failures exhibit zero streaks or packet loss with flag indicators.',
  },
  {
    q: 'What role does the Physics-Informed Validation Engine play?',
    a: 'Before finalizing any prediction, the Physics Engine checks conservation of charge (Kirchhoff\'s Current Law) and Ohm\'s Law impedance consistency. If telemetry claims consumption is zero while line current and voltage remain active, the engine flags a definite physical shunt.',
  },
  {
    q: 'How does Explainable AI (SHAP Waterfall) assist field inspectors?',
    a: 'Field crews receive top feature contributions (e.g. baseline deviation ratio, power factor variance, zero-streak length) alongside the confidence score. This provides transparent mathematical evidence for targeted warrant dispatch.',
  },
  {
    q: 'How does the account lockout and security rate limiter work?',
    a: 'To prevent credential stuffing and brute force attacks, operator accounts lock for 15 minutes after 5 consecutive failed login attempts. Sensitive endpoints enforce per-minute rate limits.',
  },
  {
    q: 'Where is telemetry stored on the local environment?',
    a: 'Data is persistently stored in native MongoDB on localhost (mongodb://127.0.0.1:27017/powerblind) with indexed collections for consumers, readings, predictions, and audit logs. It can be visually queried in MongoDB Compass.',
  },
];

export default function ExpandableFAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (idx) => {
    setOpenIndex(current => current === idx ? null : idx);
  };

  return (
    <div className="space-y-3" aria-label="Frequently Asked Questions">
      <div className="flex items-center gap-2 mb-2">
        <HelpCircle className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-bold text-ink-primary">Grid Operations & Physics FAQ</h3>
      </div>
      {FAQ_ITEMS.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            className="border border-surface-border rounded-xl bg-surface/50 backdrop-blur-sm overflow-hidden transition-colors"
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left gap-3 hover:bg-surface-hover transition-colors"
            >
              <span className="text-xs font-semibold text-ink-primary leading-snug">
                {item.q}
              </span>
              <ChevronDown
                className={cn('w-4 h-4 text-ink-muted transition-transform duration-200 shrink-0', isOpen && 'rotate-180 text-accent')}
              />
            </button>
            {isOpen && (
              <div className="px-4 pb-3.5 pt-1 text-xs text-ink-secondary leading-relaxed border-t border-surface-border/50 animate-fade-in bg-canvas/30">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
