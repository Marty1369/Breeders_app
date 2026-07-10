import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { Button, Card, Chip, EmptyState, PageHeader } from '../components/ui';
import { longDate } from '../lib/dates';
import { DOC_TYPE_LABEL } from '../lib/documents';
import { AddOwnerSheet } from './People';
import type { DocStatus, ExpenseCategory } from '../lib/types';

const CAT_LABEL: Record<ExpenseCategory, string> = {
  vet_tests: 'Vet & tests', travel: 'Travel', food: 'Food', lodging: 'Lodging',
  mating: 'Mating', documents: 'Documents', supplies: 'Supplies', other: 'Other',
};
const DOC_TONE: Record<DocStatus, 'default' | 'accent' | 'amber'> = {
  draft: 'amber', ready: 'accent', sent: 'accent', signed: 'accent', submitted: 'accent', approved: 'accent',
};

// ---------------------------------------------------------------------------

export function AllDocuments() {
  const { litters, documents, puppies } = useSpace();
  const withDocs = litters.filter((l) => documents.some((d) => d.litter_id === l.id));

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader title="All documents" subtitle="Across every litter" />
      {documents.length === 0 ? (
        <EmptyState title="No documents yet" subtitle="Generate contracts from the Documents tab of a litter." />
      ) : (
        <div className="flex flex-col gap-5">
          {withDocs.map((l) => (
            <div key={l.id}>
              <div className="text-[11px] font-extrabold tracking-wide text-faint mb-1.5">{l.name.toUpperCase()}</div>
              <div className="flex flex-col gap-1.5">
                {documents.filter((d) => d.litter_id === l.id).map((d) => (
                  <Link key={d.id} to={`/docs/${d.id}`}>
                    <Card className="p-3 flex items-center justify-between cursor-pointer">
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-bold">{DOC_TYPE_LABEL[d.type]}</div>
                        <div className="text-[10.5px] text-faint font-semibold">{puppies.find((p) => p.id === d.puppy_id)?.name ?? 'Litter-level'}</div>
                      </div>
                      <Chip tone={DOC_TONE[d.status]}>{d.status}</Chip>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function AllBuyers() {
  const { owners, puppies, litters } = useSpace();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="All buyers"
        subtitle="Across every litter"
        action={<Button onClick={() => setAddOpen(true)}>＋ Add buyer</Button>}
      />
      <AddOwnerSheet open={addOpen} onClose={() => setAddOpen(false)} />
      {owners.length === 0 ? (
        <EmptyState title="No buyers yet" subtitle="Add a buyer with the button above, or from a litter's Buyers tab." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {owners.map((o) => {
            const puppy = puppies.find((p) => p.owner_id === o.id);
            const litter = puppy ? litters.find((l) => l.id === puppy.litter_id) : null;
            const paid = o.payments.reduce((s, p) => s + p.amount, 0);
            const settled = o.full_price > 0 && paid >= o.full_price;
            return (
              <Card key={o.id} onClick={() => navigate(`/owners/${o.id}`)} className="p-3 flex items-center justify-between cursor-pointer">
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold truncate">{o.name}</div>
                  <div className="text-[10.5px] text-faint font-semibold truncate">
                    {[puppy?.name, litter?.name, o.country].filter(Boolean).join(' · ') || o.phone || '—'}
                  </div>
                </div>
                {o.waiting_list_for ? (
                  <Chip tone="amber">Waiting</Chip>
                ) : o.full_price > 0 ? (
                  <Chip tone={settled ? 'accent' : 'default'}>€{paid}/{o.full_price}</Chip>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function AllExpenses() {
  const { expenses, litters, payers } = useSpace();
  const grand = expenses.reduce((s, e) => s + e.amount_eur, 0);
  const withExp = litters.filter((l) => expenses.some((e) => e.litter_id === l.id));
  const orphan = expenses.filter((e) => !e.litter_id);

  function exportCsv() {
    const rows = [['Litter', 'Date', 'Description', 'Category', 'Amount (EUR)', 'Payer']];
    for (const e of expenses) {
      rows.push([
        litters.find((l) => l.id === e.litter_id)?.name ?? '',
        e.date, e.description, CAT_LABEL[e.category], String(e.amount_eur),
        payers.find((p) => p.id === e.payer_id)?.label ?? '',
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all-expenses.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader title="All expenses" subtitle="Across every litter" action={expenses.length ? <button onClick={exportCsv} className="text-[11px] font-extrabold text-accent cursor-pointer">Export CSV</button> : undefined} />

      <Card className="p-4 mb-5">
        <div className="text-[10px] font-extrabold text-faint tracking-wide">GRAND TOTAL</div>
        <div className="text-[24px] font-extrabold mt-1">€{grand.toFixed(0)}</div>
      </Card>

      {expenses.length === 0 ? (
        <EmptyState title="No expenses yet" />
      ) : (
        <div className="flex flex-col gap-5">
          {withExp.map((l) => {
            const items = expenses.filter((e) => e.litter_id === l.id);
            const sub = items.reduce((s, e) => s + e.amount_eur, 0);
            return (
              <div key={l.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[11px] font-extrabold tracking-wide text-faint">{l.name.toUpperCase()}</div>
                  <div className="text-[11px] font-extrabold text-muted">€{sub.toFixed(0)}</div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {items.map((e) => (
                    <Card key={e.id} className="p-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-bold truncate">{e.description}</div>
                        <div className="text-[10.5px] text-faint font-semibold">{CAT_LABEL[e.category]} · {longDate(e.date)}</div>
                      </div>
                      <div className="text-[13px] font-extrabold">€{e.amount_eur.toFixed(0)}</div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
          {orphan.length > 0 && (
            <div>
              <div className="text-[11px] font-extrabold tracking-wide text-faint mb-1.5">UNASSIGNED</div>
              <div className="flex flex-col gap-1.5">
                {orphan.map((e) => (
                  <Card key={e.id} className="p-3 flex items-center justify-between">
                    <div className="text-[12.5px] font-bold truncate">{e.description}</div>
                    <div className="text-[13px] font-extrabold">€{e.amount_eur.toFixed(0)}</div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
