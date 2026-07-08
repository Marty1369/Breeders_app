import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Chip, EmptyState, PageHeader, Spinner } from '../components/ui';
import { DOC_TYPE_LABEL } from '../lib/documents';

export default function PdfViewer() {
  const { id } = useParams<{ id: string }>();
  const { documents, puppies } = useSpace();
  const navigate = useNavigate();
  const doc = documents.find((d) => d.id === id);
  const puppy = puppies.find((p) => p.id === doc?.puppy_id);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!doc?.pdf_url) {
      setUrl(null);
      return;
    }
    let active = true;
    supabase.storage
      .from('space-files')
      .createSignedUrl(doc.pdf_url, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [doc?.pdf_url]);

  if (!doc) {
    return (
      <div className="p-6">
        <EmptyState title="Document not found" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto h-full flex flex-col">
      <PageHeader
        title={DOC_TYPE_LABEL[doc.type]}
        subtitle={puppy?.name}
        action={<Chip tone="accent">{doc.status}</Chip>}
      />

      <div className="flex gap-2 mb-4">
        {url && (
          <>
            <a href={url} download target="_blank" rel="noreferrer">
              <Button variant="secondary">Download</Button>
            </a>
            <a href={url} target="_blank" rel="noreferrer">
              <Button variant="secondary">Print / open</Button>
            </a>
          </>
        )}
        <Button variant="ghost" onClick={() => navigate('/docs')}>Back to docs</Button>
      </div>

      {doc.missing_fields.length > 0 && (
        <div className="mb-4 text-[11.5px] font-semibold text-amber bg-[#f7ecdc] rounded-[10px] px-3 py-2">
          Missing: {doc.missing_fields.join(', ')} — fix in the record, then regenerate from the Docs tab.
        </div>
      )}

      <div className="flex-1 min-h-[60vh] rounded-[14px] overflow-hidden border border-card-border bg-white">
        {url ? (
          <iframe title="document" src={url} className="w-full h-full min-h-[70vh]" />
        ) : (
          <div className="h-full grid place-items-center">
            <Spinner />
          </div>
        )}
      </div>

      <div className="text-[10.5px] text-faint font-semibold mt-3 text-center">
        This document is view-only. To change any data, fix it in the record and generate a new one.
      </div>
    </div>
  );
}
