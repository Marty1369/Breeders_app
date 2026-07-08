import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { useAuth } from '../state/AuthProvider';
import { supabase } from '../lib/supabase';
import { buildFieldValues, DOC_TYPE_LABEL, fieldDefsFor, missingFields } from '../lib/documents';
import { generateDocumentPdf } from '../lib/pdf';
import { Button, Sheet, TextField } from './ui';
import type { DocType } from '../lib/types';

export default function DocGenerateSheet({
  type,
  puppyId,
  onClose,
}: {
  type: DocType | null;
  puppyId: string | null;
  onClose: () => void;
}) {
  const { space, litters, activeLitterId, dogs, puppies, owners } = useSpace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const litter = litters.find((l) => l.id === activeLitterId) || null;
  const dam = dogs.find((d) => d.id === litter?.dam_id) || null;
  const sire = dogs.find((d) => d.id === litter?.sire_id) || null;
  const puppy = puppies.find((p) => p.id === puppyId) || null;
  const owner = owners.find((o) => o.id === puppy?.owner_id) || null;

  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!type) return;
    setValues(buildFieldValues(type, space, litter, dam, sire, puppy, owner));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, puppyId]);

  if (!type) return null;

  const missing = missingFields(type, values);

  async function generate() {
    if (!space || !type) return;
    setBusy(true);
    setError(null);
    try {
      const { data: docRow, error: insErr } = await supabase
        .from('documents')
        .insert({
          space_id: space.id,
          litter_id: activeLitterId,
          puppy_id: puppyId,
          type,
          field_values: values,
          missing_fields: missing,
          status: missing.length ? 'draft' : 'ready',
          history: [{ ts: new Date().toISOString(), event: 'generated', byUserId: user?.id }],
        })
        .select('*')
        .single();
      if (insErr) throw insErr;

      const bytes = await generateDocumentPdf(docRow);
      const path = `${space.id}/documents/${docRow.id}.pdf`;
      const { error: upErr } = await supabase.storage.from('space-files').upload(path, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (upErr) throw upErr;

      await supabase.from('documents').update({ pdf_url: path }).eq('id', docRow.id);

      onClose();
      navigate(`/docs/${docRow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate document');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={!!type}
      onClose={onClose}
      title={`Generate — ${DOC_TYPE_LABEL[type]}`}
      subtitle={puppy?.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={generate} disabled={busy}>{busy ? 'Generating…' : 'Generate PDF'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {missing.length > 0 && (
          <div className="text-[11.5px] font-semibold text-amber bg-[#f7ecdc] rounded-[10px] px-3 py-2">
            {missing.length} required field{missing.length === 1 ? '' : 's'} missing — fill them in below or fix the record and regenerate.
          </div>
        )}
        {fieldDefsFor(type).map((f) => (
          <TextField
            key={f.key}
            label={f.label + (f.required ? ' *' : '')}
            value={values[f.key] || ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        ))}
        {error && <div className="text-[12px] font-semibold text-danger">{error}</div>}
      </div>
    </Sheet>
  );
}
