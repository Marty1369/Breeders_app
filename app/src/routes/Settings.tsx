import { useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, PageHeader, TextField } from '../components/ui';

export default function Settings() {
  const { space, taskTemplates } = useSpace();
  const [form, setForm] = useState(() => ({
    kennelName: space?.kennel_name || '',
    affix: space?.affix || '',
    club: space?.club || '',
    vmvtNo: space?.vmvt_no || '',
    breederName: space?.breeder_name || '',
    breederAddress: space?.breeder_address || '',
    breederPhone: space?.breeder_phone || '',
    breederEmail: space?.breeder_email || '',
    dueHour: space?.notif_rules.due_hour ?? 7,
    overdueHour: space?.notif_rules.overdue_hour ?? 7,
    heatWatchDays: space?.notif_rules.heat_watch_days_before ?? 14,
  }));
  const [busy, setBusy] = useState(false);

  if (!space) return null;

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const save = async () => {
    setBusy(true);
    await supabase
      .from('spaces')
      .update({
        kennel_name: form.kennelName || null,
        affix: form.affix || null,
        club: form.club || null,
        vmvt_no: form.vmvtNo || null,
        breeder_name: form.breederName || null,
        breeder_address: form.breederAddress || null,
        breeder_phone: form.breederPhone || null,
        breeder_email: form.breederEmail || null,
        notif_rules: {
          ...space.notif_rules,
          due_hour: Number(form.dueHour),
          overdue_hour: Number(form.overdueHour),
          heat_watch_days_before: Number(form.heatWatchDays),
        },
      })
      .eq('id', space.id);
    setBusy(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <PageHeader title="Settings" subtitle={space.name} />

      <Card className="p-4 mb-4">
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-3">KENNEL</div>
        <div className="flex flex-col gap-3">
          <TextField label="Kennel name" value={form.kennelName} onChange={(e) => set('kennelName', e.target.value)} />
          <TextField label="Affix" value={form.affix} onChange={(e) => set('affix', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Club" value={form.club} onChange={(e) => set('club', e.target.value)} placeholder="VŠMB" />
            <TextField label="VMVT approval no." value={form.vmvtNo} onChange={(e) => set('vmvtNo', e.target.value)} placeholder="LT 77-13-282" />
          </div>
          <TextField label="Breeder name" value={form.breederName} onChange={(e) => set('breederName', e.target.value)} />
          <TextField label="Breeder address" value={form.breederAddress} onChange={(e) => set('breederAddress', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Phone" value={form.breederPhone} onChange={(e) => set('breederPhone', e.target.value)} />
            <TextField label="Email" value={form.breederEmail} onChange={(e) => set('breederEmail', e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-3">NOTIFICATION RULES</div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Due hour (0-23)" type="number" value={form.dueHour} onChange={(e) => set('dueHour', Number(e.target.value))} />
          <TextField label="Overdue hour" type="number" value={form.overdueHour} onChange={(e) => set('overdueHour', Number(e.target.value))} />
        </div>
        <div className="mt-3">
          <TextField label="Heat watch — days before" type="number" value={form.heatWatchDays} onChange={(e) => set('heatWatchDays', Number(e.target.value))} />
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-2">TASK TEMPLATE PLAN</div>
        <div className="text-[12px] font-semibold text-muted mb-2">{taskTemplates.length} templates generate automatically when a new litter starts.</div>
        <div className="flex flex-col gap-1">
          {taskTemplates
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((t) => (
              <div key={t.id} className="flex items-center justify-between text-[11.5px] font-semibold">
                <span>{t.name}</span>
                <span className="text-faint">{t.anchor} {t.offset_days >= 0 ? '+' : ''}{t.offset_days}d</span>
              </div>
            ))}
        </div>
      </Card>

      <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button>
    </div>
  );
}
