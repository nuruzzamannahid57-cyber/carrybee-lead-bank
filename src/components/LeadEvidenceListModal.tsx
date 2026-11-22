'use client';

import { useEffect, useState } from 'react';
import { Download, FileAudio2, FileImage, Plus, X } from 'lucide-react';
import type { Lead } from '@/lib/types';

interface EvidenceItem {
  id: string;
  stage: 'connected' | 'followup';
  original_name: string;
  mime_type: string;
  original_size_bytes: number;
  stored_size_bytes: number;
  created_at: string;
  download_url: string;
}

export default function LeadEvidenceListModal({ lead, accessToken, onAddEvidence, onClose }: { lead: Lead; accessToken: string; onAddEvidence: () => void; onClose: () => void }) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/leads/${lead.id}/evidence`, { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load evidence.');
        if (active) setItems(data.evidence || []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load evidence.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [accessToken, lead.id]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="evidence-list-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="evidence-list-title" className="text-base font-bold text-slate-900">Lead evidence</h3>
            <p className="mt-1 text-sm text-slate-600">Private files for <strong>{lead.business_name}</strong>.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading evidence…</p> : error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : items.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No evidence has been uploaded for this lead yet.</p> : (
          <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                {item.mime_type.startsWith('image/') ? <FileImage className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" /> : <FileAudio2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900" title={item.original_name}>{item.original_name}</div>
                  <div className="text-xs text-slate-500">{item.stage === 'connected' ? 'Connected' : item.stage === 'followup' ? 'Follow-Up' : 'Onboarded'} · {new Date(item.created_at).toLocaleString()} · {(item.stored_size_bytes / (1024 * 1024)).toFixed(2)} MB</div>
                </div>
                <a href={item.download_url} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700" target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" aria-hidden="true" />Download</a>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-between border-t border-slate-200 pt-4"><button type="button" onClick={onAddEvidence} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add evidence</button><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Close</button></div>
      </div>
    </div>
  );
}
