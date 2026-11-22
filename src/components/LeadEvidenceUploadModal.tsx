'use client';

import { useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { FileUp, X } from 'lucide-react';
import type { Lead, LeadStage } from '@/lib/types';
import { compressEvidenceFile, MAX_EVIDENCE_BYTES } from '@/lib/evidence-compression';

interface Props {
  lead: Lead;
  stage: LeadStage;
  mode: 'stage-change' | 'attach-only';
  accessToken: string;
  memberId: string;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
}

export default function LeadEvidenceUploadModal({ lead, stage, mode, accessToken, memberId, onClose, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Upload a screenshot or call recording before changing the stage.');
      return;
    }
    setBusy(true);
    setError('');
    let storageClient: ReturnType<typeof createClient> | null = null;
    let uploadedPath = '';
    try {
      setStatus('Compressing evidence…');
      const compressed = await compressEvidenceFile(file);
      if (compressed.blob.size > MAX_EVIDENCE_BYTES) throw new Error('Compressed file exceeds the 20 MB limit.');

      const ext = compressed.extension;
      uploadedPath = `${memberId}/${lead.id}/${crypto.randomUUID()}.${ext}`;
      storageClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { autoRefreshToken: false, persistSession: false } }
      );
      setStatus('Uploading securely…');
      const { error: uploadError } = await storageClient.storage.from('lead-evidence').upload(uploadedPath, compressed.blob, {
        contentType: compressed.mimeType,
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);

      setStatus('Saving evidence and updating the stage…');
      const response = await fetch(`/api/leads/${lead.id}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          stage,
          attach_only: mode === 'attach-only',
          file_path: uploadedPath,
          original_name: file.name,
          mime_type: compressed.mimeType,
          original_size_bytes: file.size,
          stored_size_bytes: compressed.blob.size,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save evidence.');
      onSuccess(data.lead as Lead);
    } catch (err) {
      if (uploadedPath && storageClient) {
        await storageClient.storage.from('lead-evidence').remove([uploadedPath]).catch(() => undefined);
      }
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.');
      setStatus('');
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="evidence-upload-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="evidence-upload-title" className="text-base font-bold text-slate-900">Evidence required</h3>
            <p className="mt-1 text-sm text-slate-600">{mode === 'attach-only' ? <>Attach a file to onboarded lead <strong>{lead.business_name}</strong>. This will not change its pipeline stage.</> : <>Upload proof before marking <strong>{lead.business_name}</strong> as {stage === 'connected' ? 'Connected' : 'Follow-Up'}.</>}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-blue-400 hover:bg-blue-50/40">
            <FileUp className="mb-2 h-6 w-6 text-blue-600" aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-800">{file ? file.name : 'Choose screenshot or call recording'}</span>
            <span className="mt-1 text-xs text-slate-500">JPG, PNG, WebP · MP3, M4A, WebM, OGG, WAV · up to 20 MB</span>
            {file && <span className="mt-1 text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB · compressed before secure upload</span>}
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,audio/x-m4a,audio/webm,audio/ogg,audio/wav,audio/x-wav" className="sr-only" disabled={busy} onChange={(e) => { setFile(e.target.files?.[0] || null); setError(''); }} />
          </label>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {status && <p role="status" aria-live="polite" className="text-sm font-medium text-blue-700">{status}</p>}
          <p className="text-xs text-slate-500">Files are compressed where applicable and stored privately. Only you can view or download evidence attached to your leads. Upload call recordings only when required consent has been obtained.</p>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy || !file} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : mode === 'attach-only' ? 'Upload evidence' : 'Upload & update stage'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
