// Journey ribbon (spec §3.2): the litter's life as a row of stops.
//   pre-birth:  Heat → Mating → Pregnant → Birth → Home day
//   born:       Heat → Mating → Birth → Growing → Home day
// States derive from litter.status + effective dates. Rendered on the mobile
// Home header (dark) and the desktop Home strip (light), and reused as setup
// steps on the first-run Home.

import type { Litter } from '../lib/types';
import { effectiveDate } from '../lib/scheduling';
import { todayStr } from '../lib/dates';

export type StopState = 'done' | 'current' | 'future';
export interface Stop { label: string; state: StopState }

function litterStops(litter: Litter): Stop[] {
  const today = todayStr();
  const reached = (key: 'heat' | 'mating' | 'handover') => {
    const d = effectiveDate(litter.dates, key);
    return d != null && d <= today;
  };
  const born = litter.dates.whelping?.actual != null || litter.status === 'born' || litter.status === 'closed';
  const closed = litter.status === 'closed' || litter.status === 'did_not_take';

  const mk = (label: string, state: StopState): Stop => ({ label, state });

  if (born) {
    const homeDone = closed || reached('handover');
    return [
      mk('Heat', 'done'),
      mk('Mating', 'done'),
      mk('Birth', 'done'),
      mk('Growing', homeDone ? 'done' : 'current'),
      mk('Home day', homeDone ? 'done' : 'future'),
    ];
  }

  // Pre-birth. Exactly one "current".
  const heatDone = reached('heat');
  const matingDone = reached('mating');
  const pregnant = litter.status === 'pregnant';
  let current: 'heat' | 'mating' | 'pregnant';
  if (pregnant) current = 'pregnant';
  else if (!heatDone) current = 'heat';
  else if (!matingDone) current = 'mating';
  else current = 'pregnant';

  return [
    mk('Heat', current === 'heat' ? 'current' : 'done'),
    mk('Mating', current === 'mating' ? 'current' : heatDone && current !== 'heat' ? 'done' : 'future'),
    mk('Pregnant', current === 'pregnant' ? 'current' : 'future'),
    mk('Birth', 'future'),
    mk('Home day', 'future'),
  ];
}

export default function JourneyRibbon({
  litter,
  stops: stopsProp,
  variant = 'dark',
}: {
  litter?: Litter;
  stops?: Stop[];
  variant?: 'dark' | 'light';
}) {
  const stops = stopsProp ?? (litter ? litterStops(litter) : []);
  if (!stops.length) return null;

  const dark = variant === 'dark';
  const doneFill = dark ? '#7fd4ae' : '#17805a';
  const doneText = dark ? '#123f2d' : '#ffffff';
  const futureBorder = dark ? 'rgba(255,255,255,0.4)' : 'rgba(25,28,26,0.25)';
  const currentBg = dark ? '#ffffff' : '#123f2d';
  const currentText = dark ? '#123f2d' : '#ffffff';
  const labelColor = dark ? 'rgba(255,255,255,0.85)' : '#4a514d';
  const connDone = doneFill;
  const connFuture = dark ? 'rgba(255,255,255,0.2)' : '#e0e2dc';

  return (
    <div className="flex items-start w-full">
      {stops.map((s, i) => {
        const size = s.state === 'current' ? 26 : 20;
        return (
          <div key={s.label} className="flex flex-col items-center flex-1 min-w-0">
            <div className="flex items-center w-full">
              {/* left connector */}
              <div className="h-[3px] flex-1 rounded-full" style={{ background: i === 0 ? 'transparent' : stops[i - 1].state === 'done' ? connDone : connFuture }} />
              <div
                className="flex-none grid place-items-center rounded-full font-extrabold"
                style={{
                  width: size,
                  height: size,
                  fontSize: 11,
                  background: s.state === 'done' ? doneFill : s.state === 'current' ? currentBg : 'transparent',
                  color: s.state === 'done' ? doneText : s.state === 'current' ? currentText : labelColor,
                  border: s.state === 'future' ? `2px solid ${futureBorder}` : 'none',
                  boxShadow: s.state === 'current' ? `0 0 0 5px ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(18,63,45,0.14)'}` : undefined,
                }}
              >
                {s.state === 'done' ? '✓' : ''}
              </div>
              {/* right connector */}
              <div className="h-[3px] flex-1 rounded-full" style={{ background: i === stops.length - 1 ? 'transparent' : s.state === 'done' ? connDone : connFuture }} />
            </div>
            <div className="text-[10px] font-bold mt-1.5 text-center truncate w-full" style={{ color: labelColor }}>
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
