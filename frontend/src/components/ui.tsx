'use client';
import { useState } from 'react';
import { Modal } from './Modal';
import { STATUS_LABEL } from '@/lib/format';
import type { MeetingStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: MeetingStatus }) {
  return <span className={`status s-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function ErrorBox({ message }: { message?: string | null }) {
  return message ? <p role="alert" className="error">{message}</p> : null;
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <p className="muted" role="status" style={{ padding: '1.5rem 0' }}>{label}…</p>;
}

/** Runs an async action, exposing busy/error state so every dialog handles failures the same way. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true); setError(null);
    try { return await fn(); }
    catch (e: any) { setError(e.message ?? 'Something went wrong'); }
    finally { setBusy(false); }
  }
  return { busy, error, run, setError };
}

/** Small dialog that asks for a text reason/note, then runs onSubmit. */
export function ReasonModal(props: {
  title: string; label: string; confirmLabel: string; required?: boolean; danger?: boolean; hint?: string;
  onSubmit: (text: string) => Promise<unknown>; onClose: () => void;
}) {
  const [text, setText] = useState('');
  const { busy, error, run } = useAction();
  const tooShort = props.required && text.trim().length < 3;
  return (
    <Modal title={props.title} onClose={props.onClose}>
      {props.hint && <p className="muted">{props.hint}</p>}
      <label className="field">
        <span>{props.label}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </label>
      <ErrorBox message={error} />
      <div className="modal-foot">
        <button className="btn" onClick={props.onClose} type="button">Keep as is</button>
        <button
          className={`btn ${props.danger ? 'btn-danger' : 'btn-primary'}`}
          disabled={busy || tooShort}
          onClick={async () => { const ok = await run(async () => { await props.onSubmit(text.trim()); return true; }); if (ok) props.onClose(); }}
        >
          {busy ? 'Working…' : props.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
