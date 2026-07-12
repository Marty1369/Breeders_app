import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { longDate } from '../lib/dates';
import AddExpenseSheet from '../components/AddExpenseSheet';
import type { ExpenseCategory } from '../lib/types';

const CAT_LABEL: Record<ExpenseCategory, string> = {
  vet_tests: 'Vet & tests',
  travel: 'Travel',
  food: 'Food',
  lodging: 'Lodging',
  mating: 'Mating',
  documents: 'Documents',
  supplies: 'Supplies',
  other: 'Other',
};

const CAT_COLORS: Record<ExpenseCategory, string> = {
  vet_tests: '#17805a',
  travel: '#4a6fa5',
  food: '#b97324',
  lodging: '#7c5f8f',
  mating: '#b93a2e',
  documents: '#2f6f63',
  supplies: '#d9a05c',
  other: '#8a938e',
};

/** In-bar share of the total in/out (green vs amber), never 0/100 when both exist. */
function barPct(inAmt: number, outAmt: number): number {
  const t = inAmt + outAmt;
  return t <= 0 ? 50 : Math.round((inAmt / t) * 100);
}

export default function Expenses() {
  const { litters, activeLitterId, expenses, payers, puppies, owners } = useSpace();
  const [params, setParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(params.get('new') === '1');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // "This litter" (active-litter scoped) vs "All litters" (whole space aggregated).
  const [scope, setScope] = useState<'litter' | 'all'>('litter');
  const litter = litters.find((l) => l.id === activeLitterId);
  // No active litter → nothing to scope to, so aggregate across the whole space.
  const effectiveScope = activeLitterId ? scope : 'all';

  const scopedExpenses = useMemo(
    () => (effectiveScope === 'all' ? expenses : expenses.filter((e) => e.litter_id === activeLitterId)),
    [effectiveScope, expenses, activeLitterId],
  );

  const total = scopedExpenses.reduce((s, e) => s + e.amount_eur, 0);
  const scopedPuppies = puppies.filter(
    (p) => (effectiveScope === 'all' || p.litter_id === activeLitterId) && p.status !== 'deceased',
  );
  const puppyCount = scopedPuppies.length;
  const perPuppy = puppyCount > 0 ? total / puppyCount : 0;

  // Income = owner payments, deduped by owner (a buyer reserving two pups is
  // counted once). Litter scope: only owners tied to this litter's puppies.
  // All scope: every owner in the space, each summed once — same as Home.
  const received = useMemo(() => {
    if (effectiveScope === 'all') {
      return owners.reduce((s, o) => s + o.payments.reduce((a, pay) => a + pay.amount, 0), 0);
    }
    const litterOwnerIds = [...new Set(scopedPuppies.map((p) => p.owner_id).filter((id): id is string => !!id))];
    return litterOwnerIds.reduce((s, oid) => {
      const owner = owners.find((o) => o.id === oid);
      return s + (owner ? owner.payments.reduce((a, pay) => a + pay.amount, 0) : 0);
    }, 0);
  }, [effectiveScope, owners, scopedPuppies]);

  const byCategory = useMemo(() => {
    const m = new Map<ExpenseCategory, number>();
    for (const e of scopedExpenses) m.set(e.category, (m.get(e.category) || 0) + e.amount_eur);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [scopedExpenses]);

  const byMonth = useMemo(() => {
    const m = new Map<string, typeof scopedExpenses>();
    for (const e of scopedExpenses) {
      const key = e.date.slice(0, 7);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [scopedExpenses]);

  function exportCsv() {
    const rows = [['Date', 'Description', 'Category', 'Amount (EUR)', 'Payer']];
    for (const e of scopedExpenses) {
      rows.push([e.date, e.description, CAT_LABEL[e.category], String(e.amount_eur), payers.find((p) => p.id === e.payer_id)?.label || '']);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${effectiveScope === 'all' ? 'all-litters' : litter?.name || 'expenses'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteExpense(expenseId: string) {
    setConfirmDeleteId(null);
    await supabase.from('expenses').delete().eq('id', expenseId);
  }

  function closeSheet() {
    setAddOpen(false);
    if (params.get('new')) {
      params.delete('new');
      setParams(params, { replace: true });
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Money"
        subtitle={effectiveScope === 'all' ? 'All litters' : litter?.name}
        action={<Button onClick={() => setAddOpen(true)}>＋ Add</Button>}
      />

      {activeLitterId && (
        <div className="mb-4">
          <SegmentedControl
            value={effectiveScope}
            onChange={setScope}
            options={[
              { value: 'litter', label: 'This litter' },
              { value: 'all', label: 'All litters' },
            ]}
          />
        </div>
      )}

      <Card className="p-4 mb-5">
        <div className="text-[18px] font-extrabold">€{Math.round(received)} in · €{Math.round(total)} out</div>
        <div className="flex h-2.5 rounded-full overflow-hidden mt-2.5 bg-chip-bg">
          <div style={{ width: `${barPct(received, total)}%`, background: '#17805a' }} />
          <div style={{ width: `${100 - barPct(received, total)}%`, background: '#d9a05c' }} />
        </div>
        <div className="text-[12px] text-faint font-semibold mt-2.5">Cost €{perPuppy.toFixed(0)} / puppy</div>
      </Card>

      {byCategory.length > 0 && (
        <Card className="p-4 mb-5">
          <div className="text-[11px] font-extrabold text-faint tracking-wide mb-3">BY CATEGORY</div>
          <div className="flex h-2.5 rounded-full overflow-hidden mb-3">
            {byCategory.map(([cat, amt]) => (
              <div key={cat} style={{ width: `${(amt / total) * 100}%`, background: CAT_COLORS[cat] }} />
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            {byCategory.map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between text-[12px] font-bold">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[cat] }} />
                  {CAT_LABEL[cat]}
                </span>
                <span className="text-muted tabular-nums">€{amt.toFixed(0)} · {total > 0 ? Math.round((amt / total) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-extrabold text-faint tracking-wide">HISTORY</div>
        {scopedExpenses.length > 0 && (
          <button onClick={exportCsv} className="text-[11px] font-extrabold text-accent cursor-pointer">Export CSV</button>
        )}
      </div>

      {scopedExpenses.length === 0 ? (
        <EmptyState title="No expenses yet" />
      ) : (
        <div className="flex flex-col gap-4">
          {byMonth.map(([month, items]) => (
            <div key={month}>
              <div className="text-[10.5px] font-extrabold text-faint mb-1.5">
                {new Date(month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map((e) => (
                  <Card key={e.id} className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold truncate">{e.description}</div>
                      <div className="text-[10.5px] text-faint font-semibold">{CAT_LABEL[e.category]} · {longDate(e.date)} · {payers.find((p) => p.id === e.payer_id)?.label || 'Unassigned'}</div>
                    </div>
                    {confirmDeleteId === e.id ? (
                      <div className="flex items-center gap-2 flex-none">
                        <button onClick={() => deleteExpense(e.id)} className="text-[11px] font-extrabold text-danger cursor-pointer">Delete</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-[11px] font-extrabold text-faint cursor-pointer">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 flex-none">
                        <div className="text-[13.5px] font-extrabold">€{e.amount_eur.toFixed(0)}</div>
                        <button
                          onClick={() => setConfirmDeleteId(e.id)}
                          className="text-[15px] text-faint hover:text-danger cursor-pointer"
                          title="Delete expense"
                          aria-label={`Delete ${e.description}`}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddExpenseSheet open={addOpen} onClose={closeSheet} />
    </div>
  );
}
