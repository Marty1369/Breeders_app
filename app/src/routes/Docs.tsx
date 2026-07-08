import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, Chip, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { DOC_TYPE_LABEL } from '../lib/documents';
import { longDate } from '../lib/dates';
import DocGenerateSheet from '../components/DocGenerateSheet';
import type { DocStatus, DocType } from '../lib/types';

const ALL_TYPES: DocType[] = ['sale_lt', 'sale_en', 'coown', 'export', 'mating'];

const STATUS_TONE: Record<DocStatus, 'default' | 'accent' | 'amber' | 'danger'> = {
  draft: 'amber',
  ready: 'accent',
  sent: 'accent',
  signed: 'accent',
  submitted: 'accent',
  approved: 'accent',
};

export default function Docs() {
  const { space, activeLitterId, litters, puppies, documents, uploads, owners } = useSpace();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'documents' | 'uploads'>('documents');
  const [genType, setGenType] = useState<DocType | null>(null);
  const [genPuppyId, setGenPuppyId] = useState<string | null>(params.get('puppy'));
  const fileInput = useRef<HTMLInputElement>(null);

  const litter = litters.find((l) => l.id === activeLitterId);
  const litterPuppies = puppies.filter((p) => p.litter_id === activeLitterId);
  const litterDocs = documents.filter((d) => d.litter_id === activeLitterId);
  const litterUploads = uploads.filter((u) => u.litter_id === activeLitterId);

  function docsFor(puppyId: string | null) {
    return litterDocs.filter((d) => d.puppy_id === puppyId);
  }

  async function uploadFile(file: File) {
    if (!space) return;
    const path = `${space.id}/uploads/${Date.now()}-${file.name}`;
    await supabase.storage.from('space-files').upload(path, file);
    await supabase.from('uploads').insert({
      space_id: space.id,
      litter_id: activeLitterId,
      file: path,
      name: file.name,
      mime_type: file.type,
    });
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader title="Documents" subtitle={litter?.name} />

      <div className="mb-4">
        <SegmentedControl value={tab} onChange={setTab} options={[{ value: 'documents', label: 'Documents' }, { value: 'uploads', label: 'Uploads' }]} />
      </div>

      {tab === 'documents' ? (
        <div className="flex flex-col gap-5">
          <DocGroup
            title="Mating"
            docs={docsFor(null).filter((d) => d.type === 'mating')}
            onGenerate={() => {
              setGenPuppyId(null);
              setGenType('mating');
            }}
            typeLabel={DOC_TYPE_LABEL.mating}
          />

          {litterPuppies.map((p) => (
            <div key={p.id}>
              <div className="text-[11px] font-extrabold text-faint tracking-wide mb-1.5">{p.name.toUpperCase()}</div>
              <div className="flex flex-col gap-1.5">
                {docsFor(p.id).map((d) => (
                  <DocRow key={d.id} doc={d} />
                ))}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {ALL_TYPES.filter((t) => t !== 'mating' && !docsFor(p.id).some((d) => d.type === t)).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setGenPuppyId(p.id);
                        setGenType(t);
                      }}
                      className="px-2.5 py-1 rounded-full text-[10.5px] font-extrabold bg-chip-bg text-muted cursor-pointer"
                    >
                      ＋ {DOC_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {litterPuppies.length === 0 && (
            <EmptyState title="No puppies yet" subtitle="Per-puppy contracts appear once puppies are logged." />
          )}
        </div>
      ) : (
        <div>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
            }}
          />
          <Button variant="secondary" onClick={() => fileInput.current?.click()} className="mb-3">
            ＋ Upload file
          </Button>
          {litterUploads.length === 0 ? (
            <EmptyState title="No uploads yet" />
          ) : (
            <div className="flex flex-col gap-1.5">
              {litterUploads.map((u) => (
                <Card key={u.id} className="p-3 flex items-center justify-between">
                  <span className="text-[12.5px] font-bold truncate">{u.name}</span>
                  <span className="text-[10.5px] text-faint font-semibold">{longDate(u.created_at.slice(0, 10))}</span>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <DocGenerateSheet
        type={genType}
        puppyId={genPuppyId}
        onClose={() => {
          setGenType(null);
          setGenPuppyId(null);
        }}
      />

      {owners.length === 0 && tab === 'documents' && (
        <div className="mt-5 text-[11px] text-faint font-semibold">Link owners to puppies from Puppy edit to prefill contract fields.</div>
      )}
    </div>
  );
}

function DocGroup({ title, docs, onGenerate, typeLabel }: { title: string; docs: import('../lib/types').DocumentRecord[]; onGenerate: () => void; typeLabel: string }) {
  return (
    <div>
      <div className="text-[11px] font-extrabold text-faint tracking-wide mb-1.5">{title.toUpperCase()}</div>
      <div className="flex flex-col gap-1.5">
        {docs.map((d) => (
          <DocRow key={d.id} doc={d} />
        ))}
        {docs.length === 0 && (
          <button onClick={onGenerate} className="px-2.5 py-1 rounded-full text-[10.5px] font-extrabold bg-chip-bg text-muted cursor-pointer self-start">
            ＋ {typeLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function DocRow({ doc }: { doc: import('../lib/types').DocumentRecord }) {
  return (
    <Link to={`/docs/${doc.id}`}>
      <Card className="p-3 flex items-center justify-between cursor-pointer">
        <span className="text-[12.5px] font-bold">{DOC_TYPE_LABEL[doc.type]}</span>
        <Chip tone={STATUS_TONE[doc.status]}>{doc.status}</Chip>
      </Card>
    </Link>
  );
}
