import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { Card, EmptyState, PageHeader, TextField } from '../components/ui';
import { DOC_TYPE_LABEL } from '../lib/documents';

export default function Search() {
  const { puppies, owners, tasks, documents, litters } = useSpace();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!query) return null;
    const litterName = (id: string) => litters.find((l) => l.id === id)?.name || '';
    return {
      puppies: puppies.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 10),
      owners: owners.filter((o) => o.name.toLowerCase().includes(query)).slice(0, 10),
      tasks: tasks.filter((t) => t.name.toLowerCase().includes(query)).slice(0, 10),
      documents: documents.filter((d) => DOC_TYPE_LABEL[d.type].toLowerCase().includes(query)).slice(0, 10),
      litterName,
    };
  }, [query, puppies, owners, tasks, documents, litters]);

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <PageHeader title="Search" />
      <TextField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search puppies, owners, tasks, documents…" autoFocus className="mb-4" />

      {!results ? (
        <EmptyState title="Search across your whole kennel space" subtitle="Puppies, owners, tasks, and documents — across every litter." />
      ) : (
        <div className="flex flex-col gap-5">
          <ResultGroup title="Puppies">
            {results.puppies.map((p) => (
              <Link key={p.id} to={`/puppies/${p.id}`}>
                <Card className="p-3 cursor-pointer">
                  <div className="text-[12.5px] font-extrabold">{p.name}</div>
                  <div className="text-[10.5px] text-faint font-semibold">{results.litterName(p.litter_id)}</div>
                </Card>
              </Link>
            ))}
          </ResultGroup>
          <ResultGroup title="Owners">
            {results.owners.map((o) => (
              <Link key={o.id} to={`/owners/${o.id}`}>
                <Card className="p-3 cursor-pointer">
                  <div className="text-[12.5px] font-extrabold">{o.name}</div>
                </Card>
              </Link>
            ))}
          </ResultGroup>
          <ResultGroup title="Tasks">
            {results.tasks.map((t) => (
              <Card key={t.id} className="p-3">
                <div className="text-[12.5px] font-extrabold">{t.name}</div>
                <div className="text-[10.5px] text-faint font-semibold">{results.litterName(t.litter_id)} · {t.start_date}</div>
              </Card>
            ))}
          </ResultGroup>
          <ResultGroup title="Documents">
            {results.documents.map((d) => (
              <Link key={d.id} to={`/docs/${d.id}`}>
                <Card className="p-3 cursor-pointer">
                  <div className="text-[12.5px] font-extrabold">{DOC_TYPE_LABEL[d.type]}</div>
                </Card>
              </Link>
            ))}
          </ResultGroup>
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  if (!items.length) return null;
  return (
    <div>
      <div className="text-[10.5px] font-extrabold text-faint tracking-wide mb-1.5">{title.toUpperCase()}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}
