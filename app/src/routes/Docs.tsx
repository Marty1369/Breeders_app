import { useRef, useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';
import { longDate } from '../lib/dates';

// Documents = a simple list of files stored with the litter: upload, store,
// download, delete. (Contract auto-generation is parked; the field mapping in
// lib/documents.ts stays available for a later revival.)
export default function Docs() {
  const { space, activeLitterId, litters, uploads } = useSpace();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const litter = litters.find((l) => l.id === activeLitterId);
  const litterUploads = uploads
    .filter((u) => u.litter_id === activeLitterId)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  async function uploadFile(file: File) {
    if (!space) return;
    setBusy(true);
    const path = `${space.id}/uploads/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('space-files').upload(path, file);
    if (!upErr) {
      await supabase.from('uploads').insert({
        space_id: space.id,
        litter_id: activeLitterId,
        file: path,
        name: file.name,
        mime_type: file.type,
      });
    }
    setBusy(false);
  }

  async function downloadUpload(pathInBucket: string) {
    // space-files is private (RLS) — open through a short-lived signed URL.
    const { data } = await supabase.storage.from('space-files').createSignedUrl(pathInBucket, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  async function deleteUpload(id: string, pathInBucket: string) {
    await supabase.storage.from('space-files').remove([pathInBucket]);
    await supabase.from('uploads').delete().eq('id', id);
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Documents"
        subtitle={litter?.name}
        action={
          <Button onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? 'Uploading…' : '＋ Upload'}
          </Button>
        }
      />
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadFile(f);
          e.target.value = '';
        }}
      />

      {litterUploads.length === 0 ? (
        <EmptyState
          title="No documents yet"
          subtitle="Upload contracts, pedigrees, or health certificates to keep them with this litter."
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {litterUploads.map((u) => (
            <Card key={u.id} className="p-3 flex items-center justify-between gap-2">
              <button onClick={() => downloadUpload(u.file)} className="flex-1 min-w-0 text-left cursor-pointer" title="Download">
                <div className="text-[12.5px] font-bold truncate text-accent">{u.name}</div>
                <div className="text-[10.5px] text-faint font-semibold">{longDate(u.created_at.slice(0, 10))}</div>
              </button>
              <button onClick={() => downloadUpload(u.file)} className="text-[11px] font-extrabold text-accent cursor-pointer px-2 py-1">
                Download
              </button>
              <button
                onClick={() => { if (confirm(`Delete "${u.name}"?`)) deleteUpload(u.id, u.file); }}
                className="text-[15px] text-faint hover:text-danger cursor-pointer px-1"
                title="Delete"
                aria-label={`Delete ${u.name}`}
              >
                ×
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
