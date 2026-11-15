'use client';
import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { ErrorBox, Loading, useAction } from '@/components/ui';
import { post } from '@/lib/api';
import type { Account, Page } from '@/lib/types';
import { useFetch } from '@/lib/useFetch';

export default function AccountsPage() {
  const [search, setSearch] = useState('');
  const { data, error, loading, reload } = useFetch<Page<Account>>(`/accounts?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`);
  const [creating, setCreating] = useState(false);
  const [addTo, setAddTo] = useState<Account | null>(null);

  return (
    <>
      <div className="page-head">
        <h1>Accounts</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>New account</button>
      </div>
      <label className="field" style={{ maxWidth: 360, marginBottom: '1rem' }}>
        <span>Search by name</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Acme" />
      </label>
      <ErrorBox message={error} />
      {loading && !data && <Loading />}
      {data && data.items.length === 0 && (
        <div className="panel empty"><strong>No accounts found</strong>Add the customer you are about to visit.</div>
      )}
      <div className="stack">
        {data?.items.map((a) => (
          <section key={a.id} className="panel">
            <div className="panel-head row spread">
              <div>
                <h2 style={{ padding: 0, border: 0 }}>{a.name}</h2>
                <span className="small muted">{[a.industry, a.address].filter(Boolean).join(', ')}</span>
              </div>
              <button className="btn" onClick={() => setAddTo(a)}>Add contact</button>
            </div>
            {a.contacts.length === 0 && <p className="empty">No contacts yet.</p>}
            {a.contacts.map((c) => (
              <div key={c.id} className="frow">
                <div><strong>{c.name}</strong>{c.designation && <span className="muted">, {c.designation}</span>}</div>
                <span className="small muted">{[c.email, c.phone].filter(Boolean).join('  ')}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
      {creating && <AccountModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); }} />}
      {addTo && <ContactModal account={addTo} onClose={() => setAddTo(null)} onDone={() => { setAddTo(null); reload(); }} />}
    </>
  );
}

function AccountModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ name: '', industry: '', address: '', contactName: '', designation: '', email: '', phone: '' });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const { busy, error, run } = useAction();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await post('/accounts', {
        name: v.name, industry: v.industry || undefined, address: v.address || undefined,
        contacts: v.contactName ? [{ name: v.contactName, designation: v.designation || undefined, email: v.email || undefined, phone: v.phone || undefined }] : [],
      });
      onDone();
    });
  };
  return (
    <Modal title="New account" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <label className="field full"><span>Company name</span><input value={v.name} onChange={set('name')} required minLength={2} autoFocus /></label>
          <label className="field"><span>Industry</span><input value={v.industry} onChange={set('industry')} /></label>
          <label className="field"><span>Address</span><input value={v.address} onChange={set('address')} /></label>
          <label className="field full"><span>First contact (optional)</span><input value={v.contactName} onChange={set('contactName')} placeholder="Full name" minLength={2} /></label>
          <label className="field"><span>Designation</span><input value={v.designation} onChange={set('designation')} /></label>
          <label className="field"><span>Phone</span><input value={v.phone} onChange={set('phone')} /></label>
          <label className="field full"><span>Email</span><input type="email" value={v.email} onChange={set('email')} /></label>
        </div>
        <ErrorBox message={error} />
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create account'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ContactModal({ account, onClose, onDone }: { account: Account; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ name: '', designation: '', email: '', phone: '' });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const { busy, error, run } = useAction();
  return (
    <Modal title={`Add contact to ${account.name}`} onClose={onClose}>
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        run(async () => { await post(`/accounts/${account.id}/contacts`, { name: v.name, designation: v.designation || undefined, email: v.email || undefined, phone: v.phone || undefined }); onDone(); });
      }}>
        <div className="form-grid">
          <label className="field full"><span>Name</span><input value={v.name} onChange={set('name')} required minLength={2} autoFocus /></label>
          <label className="field"><span>Designation</span><input value={v.designation} onChange={set('designation')} /></label>
          <label className="field"><span>Phone</span><input value={v.phone} onChange={set('phone')} /></label>
          <label className="field full"><span>Email</span><input type="email" value={v.email} onChange={set('email')} /></label>
        </div>
        <ErrorBox message={error} />
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add contact'}</button>
        </div>
      </form>
    </Modal>
  );
}
