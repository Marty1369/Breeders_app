import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';
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

export default function Expenses() {
  const { litters, activeLitterId, expenses, payers, puppies } = useSpace();
  const [params, setParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(params.get('new') === '1');
  const litter = litters.find((l) => l.id === activeLitterId);
  const litterExpenses = expenses.filter((e) => e.litter_id === activeLitterId);

  const total = litterExpenses.reduce((s, e) => s + e.amount_eur, 0);
  const puppyCount = puppies.filter((p) => p.litter_id === activeLitterId && p.status !== 'deceased').length;
  const perPuppy = puppyCount > 0 ? total / puppyCount : 0;

  const byCategory = useMemo(() => {
    const m = new Map<ExpenseCategory, number>();
    for (const e of litterExpenses) m.set(e.category, (m.get(e.category) || 0) + e.amount_eur);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [litterExpenses]);

  const byMonth = useMemo(() => {
    const m = new Map<string, typeof litterExpenses>();
    for (const e of litterExpenses) {
      const key = e.date.slice(0, 7);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [litterExpenses]);

  function exportCsv() {
    const rows = [['Date', 'Description', 'Category', 'Amount (EUR)', 'Payer']];
    for (const e of litterExpenses) {
      rows.push([e.date, e.description, CAT_LABEL[e.category], String(e.amount_eur), payers.find((p) => p.id === e.payer_id)?.label || '']);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${litter?.name || 'expenses'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        title="Expenses"
        subtitle={litter?.name}
        action={<Button onClick={() => setAddOpen(true)}>＋ Add</Button>}
      />

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card className="p-4">
          <div className="text-[10px] font-extrabold text-faint tracking-wide">TOTAL SPENT</div>
          <div className="text-[22px] font-extrabold mt-1">€{total.toFixed(0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-extrabold text-faint tracking-wide">COST PER PUPPY</div>
          <div className="text-[22px] font-extrabold mt-1">€{perPuppy.toFixed(0)}</div>
        </Card>
      </div>

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
                <span className="text-muted">€{amt.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-extrabold text-faint tracking-wide">HISTORY</div>
        {litterExpenses.length > 0 && (
          <button onClick={exportCsv} className="text-[11px] font-extrabold text-accent cursor-pointer">Export CSV</button>
        )}
      </div>

      {litterExpenses.length === 0 ? (
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
                  <Card key={e.id} className="p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold truncate">{e.description}</div>
                      <div className="text-[10.5px] text-faint font-semibold">{CAT_LABEL[e.category]} · {longDate(e.date)} · {payers.find((p) => p.id === e.payer_id)?.label || 'Unassigned'}</div>
                    </div>
                    <div className="text-[13.5px] font-extrabold flex-none">€{e.amount_eur.toFixed(0)}</div>
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
