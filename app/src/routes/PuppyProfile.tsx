import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { Button, Card, Chip, EmptyState, PageHeader } from '../components/ui';
import { longDate } from '../lib/dates';
import HandoverChecklistSheet from '../components/HandoverChecklistSheet';

function WeightChart({ weighLog }: { weighLog: Record<string, { am?: number; pm?: number }> }) {
  const days = Object.keys(weighLog).sort();
  const points: { d: string; v: number }[] = [];
  for (const d of days) {
    if (weighLog[d].am != null) points.push({ d, v: weighLog[d].am! });
    if (weighLog[d].pm != null) points.push({ d, v: weighLog[d].pm! });
  }
  if (points.length < 2) return <div className="text-[12px] text-faint font-semibold py-6 text-center">Not enough weigh-ins yet</div>;
  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const range = max - min || 1;
  const w = 300;
  const h = 90;
  const step = w / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - ((p.v - min) / range) * (h - 10) - 5}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24">
      <path d={path} fill="none" stroke="#17805a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={i * step} cy={h - ((p.v - min) / range) * (h - 10) - 5} r={2.2} fill="#17805a" />
      ))}
    </svg>
  );
}

export default function PuppyProfile() {
  const { id } = useParams<{ id: string }>();
  const { puppies, owners } = useSpace();
  const navigate = useNavigate();
  const puppy = puppies.find((p) => p.id === id);
  const [handoverOpen, setHandoverOpen] = useState(false);

  if (!puppy) {
    return (
      <div className="p-6">
        <EmptyState title="Puppy not found" />
      </div>
    );
  }

  const owner = owners.find((o) => o.id === puppy.owner_id);
  const gateOk = puppy.handover.contractSigned && puppy.handover.paymentComplete && puppy.handover.chipRegistered && puppy.handover.passportGiven;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader
        title={puppy.name}
        subtitle={[puppy.color, puppy.sex].filter(Boolean).join(' · ')}
        action={<Button variant="secondary" onClick={() => navigate(`/puppies/${puppy.id}/edit`)}>Edit</Button>}
      />

      <div className="flex flex-wrap gap-1.5 mb-4">
        <Chip tone="accent">{puppy.status}</Chip>
        {puppy.handover.handedOverAt && <Chip>Handed over {longDate(puppy.handover.handedOverAt.slice(0, 10))}</Chip>}
        {owner && <Chip tone="amber">{owner.name}</Chip>}
      </div>

      <Card className="p-4 mb-4">
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-3">WEIGHT</div>
        <WeightChart weighLog={puppy.weigh_log} />
      </Card>

      <Card className="p-4 mb-4">
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-3">IDENTITY</div>
        <div className="grid grid-cols-2 gap-y-2 text-[12.5px]">
          <Field label="Birth weight" value={puppy.birth_weight ? `${puppy.birth_weight} g` : '—'} />
          <Field label="Chip no." value={puppy.chip_no || '—'} />
          <Field label="Reg. no." value={puppy.reg_no || '—'} />
          <Field label="Litter affix" value={puppy.litter_affix || '—'} />
        </div>
      </Card>

      {puppy.genetics.length > 0 && (
        <Card className="p-4 mb-4">
          <div className="text-[11px] font-extrabold text-faint tracking-wide mb-2">GENETICS</div>
          <div className="flex flex-wrap gap-1.5">
            {puppy.genetics.map((g, i) => (
              <Chip key={i}>{g.test}: {g.result}</Chip>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setHandoverOpen(true)}>
          {gateOk ? 'Handover checklist ✓' : 'Handover checklist'}
        </Button>
        <Button variant="secondary" onClick={() => navigate(`/docs?puppy=${puppy.id}`)}>Generate contract</Button>
      </div>

      <HandoverChecklistSheet puppy={handoverOpen ? puppy : null} onClose={() => setHandoverOpen(false)} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-faint font-bold text-[10px] tracking-wide">{label.toUpperCase()}</div>
      <div className="font-extrabold mt-0.5">{value}</div>
    </div>
  );
}
