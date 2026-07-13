import { useRef, useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { longDate } from '../lib/dates';
import { isLitterTerminal } from '../lib/stages';

// Documents = a simple list of files stored with the litter: upload, store,
// download, delete. (Contract auto-generation is parked; the field mapping in
// lib/documents.ts stays available for a later revival.)
export default function Docs() {
  const { space, activeLitterId, litters, uploads } = useSpace();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "This litter" (active-litter filtered) vs "All litters" (every doc in the
  // space). ?scope=all lets search results land on a kennel-level upload.
  const [scope, setScope] = useState<'litter' | 'all'>(() =>
    new URLSearchParams(window.location.search).get('scope') === 'all' ? 'all' : 'litter',
  );

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const litter = litters.find((l) => l.id === activeLitterId);
  const litterClosed = !!litter && isLitterTerminal(litter);
  // A closed litter's documents stay for the record; block new writes to it.
  const uploadLocked = (litterId: string | null) => {
    const l = litters.find((x) => x.id === litterId);
    return !!l && isLitterTerminal(l);
  };
  // No active litter → nothing to scope to, so fall back to showing everything.
  const effectiveScope = activeLitterId ? scope : 'all';
  const visibleUploads = uploads
    .filter((u) => effectiveScope === 'all' || u.litter_id === activeLitterId)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  async function uploadFile(file: File) {
    if (!space || litterClosed) return;
    setBusy(true);
    setError(null);
    const path = `${space.id}/uploads/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('space-files').upload(path, file);
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
    } else {
      const { error: rowErr } = await supabase.from('uploads').insert({
        space_id: space.id,
        litter_id: activeLitterId,
        file: path,
        name: file.name,
        mime_type: file.type,
      });
      if (rowErr) setError(`Upload failed: ${rowErr.message}`);
    }
    setBusy(false);
  }

  async function downloadUpload(pathInBucket: string) {
    // space-files is private (RLS) — open through a short-lived signed URL.
    const { data } = await supabase.storage.from('space-files').createSignedUrl(pathInBucket, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  async function deleteUpload(id: string, pathInBucket: string) {
    setConfirmDeleteId(null);
    setError(null);
    // Storage first, row second — if storage fails, keep the row so the file
    // stays reachable and the user can retry (no orphaned blobs).
    const { error: rmErr } = await supabase.storage.from('space-files').remove([pathInBucket]);
    if (rmErr) {
      setError(`Could not delete the file: ${rmErr.message}. Try again.`);
      return;
    }
    const { error: rowErr } = await supabase.from('uploads').delete().eq('id', id);
    if (rowErr) setError(`The file was removed but its record wasn't: ${rowErr.message}`);
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Documents"
        subtitle={litter?.name}
        action={
          litterClosed ? undefined : (
            <Button onClick={() => fileInput.current?.click()} disabled={busy}>
              {busy ? 'Uploading…' : '＋ Upload'}
            </Button>
          )
        }
      />
      {litterClosed && (
        <div className="mb-3 text-[11.5px] font-semibold text-amber bg-[#f7ecdc] rounded-[10px] px-3 py-2">
          {litter?.name} is closed — its documents are kept for the record and are read-only.
        </div>
      )}
      {error && <div className="text-[12px] font-bold text-danger mb-3">{error}</div>}
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

      {visibleUploads.length === 0 ? (
        <EmptyState
          title="No documents yet"
          subtitle="Upload contracts, pedigrees, or health certificates to keep them with this litter."
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {visibleUploads.map((u) => (
            <Card key={u.id} className="p-3 flex items-center justify-between gap-2">
              <button onClick={() => downloadUpload(u.file)} className="flex-1 min-w-0 text-left cursor-pointer" title="Download">
                <div className="text-[12.5px] font-bold truncate text-accent">{u.name}</div>
                <div className="text-[10.5px] text-faint font-semibold">
                  {[
                    effectiveScope === 'all' ? litters.find((l) => l.id === u.litter_id)?.name : null,
                    longDate(u.created_at.slice(0, 10)),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </button>
              {confirmDeleteId === u.id ? (
                <div className="flex items-center gap-2 flex-none">
                  <span className="text-[11px] font-bold text-danger">Delete?</span>
                  <button onClick={() => deleteUpload(u.id, u.file)} className="text-[11px] font-extrabold text-danger cursor-pointer">
                    Confirm
                  </button>
                  <button onClick={() => setConfirmDeleteId(null)} className="text-[11px] font-extrabold text-faint cursor-pointer">
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={() => downloadUpload(u.file)} className="text-[11px] font-extrabold text-accent cursor-pointer px-2 py-1">
                    Download
                  </button>
                  {!uploadLocked(u.litter_id) && (
                    <button
                      onClick={() => setConfirmDeleteId(u.id)}
                      className="text-[15px] text-faint hover:text-danger cursor-pointer px-1"
                      title="Delete"
                      aria-label={`Delete ${u.name}`}
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
