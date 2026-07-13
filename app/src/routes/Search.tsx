import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { Card, EmptyState, PageHeader, TextField } from '../components/ui';
import type { Task, Upload } from '../lib/types';

export default function Search() {
  const { puppies, owners, tasks, uploads, litters, setActiveLitterId } = useSpace();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!query) return null;
    const litterName = (id: string | null) => (id ? litters.find((l) => l.id === id)?.name || '' : '');
    return {
      puppies: puppies.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 10),
      owners: owners.filter((o) => o.name.toLowerCase().includes(query)).slice(0, 10),
      tasks: tasks.filter((t) => t.name.toLowerCase().includes(query)).slice(0, 10),
      // Real files live in uploads; the generated-documents table is parked (DOC-06).
      uploads: uploads.filter((u) => u.name.toLowerCase().includes(query)).slice(0, 10),
      litterName,
    };
  }, [query, puppies, owners, tasks, uploads, litters]);

  const noMatches =
    results !== null &&
    results.puppies.length === 0 &&
    results.owners.length === 0 &&
    results.tasks.length === 0 &&
    results.uploads.length === 0;

  // Cross-litter results switch the litter focus first, so the opened screen
  // (and any follow-up action) targets the right litter.
  const openTask = (t: Task) => {
    setActiveLitterId(t.litter_id);
    navigate(`/plan?task=${t.id}`);
  };
  const openUpload = (u: Upload) => {
    if (u.litter_id) setActiveLitterId(u.litter_id);
    navigate('/docs');
  };

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <PageHeader title="Search" />
      <TextField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search puppies, owners, tasks, documents…" autoFocus className="mb-4" />

      {!results ? (
        <EmptyState title="Search across your whole kennel space" subtitle="Puppies, owners, tasks, and documents — across every litter." />
      ) : noMatches ? (
        <EmptyState title={`No matches for “${q.trim()}”`} subtitle="Try a different name or keyword." />
      ) : (
        <div className="flex flex-col gap-5">
          <ResultGroup title="Puppies">
            {results.puppies.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setActiveLitterId(p.litter_id); navigate(`/puppies/${p.id}`); }}
                className="text-left w-full"
              >
                <Card className="p-3 cursor-pointer">
                  <div className="text-[12.5px] font-extrabold">{p.name}</div>
                  <div className="text-[10.5px] text-faint font-semibold">{results.litterName(p.litter_id)}</div>
                </Card>
              </button>
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
              <button key={t.id} type="button" onClick={() => openTask(t)} className="text-left w-full">
                <Card className="p-3 cursor-pointer">
                  <div className="text-[12.5px] font-extrabold">{t.name}</div>
                  <div className="text-[10.5px] text-faint font-semibold">{results.litterName(t.litter_id)} · {t.start_date}</div>
                </Card>
              </button>
            ))}
          </ResultGroup>
          <ResultGroup title="Documents">
            {results.uploads.map((u) => (
              <button key={u.id} type="button" onClick={() => openUpload(u)} className="text-left w-full">
                <Card className="p-3 cursor-pointer">
                  <div className="text-[12.5px] font-extrabold">{u.name}</div>
                  <div className="text-[10.5px] text-faint font-semibold">{results.litterName(u.litter_id)}</div>
                </Card>
              </button>
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
