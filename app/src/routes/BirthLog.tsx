import { useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { useAuth } from '../state/AuthProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, Chip, EmptyState, PageHeader } from '../components/ui';
import { longDate } from '../lib/dates';
import { startWhelping, finishWhelping } from '../lib/actions';

export default function BirthLog() {
  const { litters, activeLitterId, tasks, members, puppies } = useSpace();
  const { user } = useAuth();
  const litter = litters.find((l) => l.id === activeLitterId);
  const [busy, setBusy] = useState(false);

  if (!litter) {
    return (
      <div className="p-6">
        <EmptyState title="No litter selected" />
      </div>
    );
  }

  const litterPuppies = puppies.filter((p) => p.litter_id === litter.id);
  const bornCount = litter.whelping_log.filter((e) => e.type === 'born').length;
  const stillbornCount = litter.whelping_log.filter((e) => e.type === 'stillborn').length;

  const begin = async () => {
    setBusy(true);
    await startWhelping(litter, members, user?.id);
    setBusy(false);
  };

  const logEntry = async (type: 'born' | 'stillborn') => {
    setBusy(true);
    const ts = new Date().toISOString();
    let puppyId: string | undefined;
    if (type === 'born') {
      const n = bornCount + 1;
      const { data } = await supabase
        .from('puppies')
        .insert({
          space_id: litter.space_id,
          litter_id: litter.id,
          name: `${litter.letter ?? ''}${n}`.trim() || `Puppy ${n}`,
          litter_affix: litter.letter,
        })
        .select('id')
        .single();
      puppyId = data?.id;
    }
    const whelping_log = [...litter.whelping_log, { ts, type, puppyId }];
    await supabase.from('litters').update({ whelping_log }).eq('id', litter.id);
    setBusy(false);
  };

  const finish = async () => {
    setBusy(true);
    await finishWhelping(litter, tasks, members, user?.id);
    setBusy(false);
  };

  const started = litter.status === 'born' || litter.whelping_log.length > 0;

  return (
    <div className={`min-h-full ${started ? 'bg-[#12140f] text-white' : ''}`}>
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader title="Whelping birth log" subtitle={litter.name} />

      {!started ? (
        <Card className="p-5 text-center">
          <div className="text-[13px] font-bold text-muted mb-3">
            Opening the birth log notifies your team that whelping has started.
          </div>
          <Button onClick={begin} disabled={busy}>Start whelping</Button>
        </Card>
      ) : (
        <>
          <div className="flex gap-3 mb-4">
            <div className="flex-1 bg-white/10 rounded-[14px] p-3 text-center">
              <div className="text-[22px] font-extrabold">{bornCount}</div>
              <div className="text-[10px] font-extrabold text-white/60 tracking-wide">BORN</div>
            </div>
            <div className="flex-1 bg-white/10 rounded-[14px] p-3 text-center">
              <div className="text-[22px] font-extrabold">{stillbornCount}</div>
              <div className="text-[10px] font-extrabold text-white/60 tracking-wide">STILLBORN</div>
            </div>
          </div>

          <div className="flex gap-3 mb-5">
            <Button onClick={() => logEntry('born')} disabled={busy} className="flex-1 !min-h-14 !text-[15px]">
              ＋ Born
            </Button>
            <Button variant="danger" onClick={() => logEntry('stillborn')} disabled={busy} className="flex-1 !min-h-14 !text-[15px]">
              Stillborn
            </Button>
          </div>

          <div className="flex flex-col gap-1.5 mb-5">
            {litter.whelping_log
              .slice()
              .reverse()
              .map((e, i) => {
                const pup = litterPuppies.find((p) => p.id === e.puppyId);
                return (
                  <div key={i} className="flex items-center justify-between bg-white/5 rounded-[10px] px-3 py-2">
                    <span className="text-[12.5px] font-bold">{pup?.name || (e.type === 'born' ? 'Puppy' : 'Stillborn')}</span>
                    <span className="text-[11px] text-white/50 font-semibold">{new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                );
              })}
          </div>

          <Button onClick={finish} disabled={busy} variant="secondary" className="w-full !border-white !text-white">
            Finish — set birth date & unlock rearing tasks
          </Button>
          <div className="text-[10.5px] text-white/40 font-semibold text-center mt-2">{longDate(new Date().toISOString().slice(0, 10))}</div>
        </>
      )}

      {litter.status !== 'born' && litter.whelping_log.length === 0 && (
        <div className="mt-4">
          <Chip>Expected around whelping date on Litter info</Chip>
        </div>
      )}
    </div>
    </div>
  );
}
