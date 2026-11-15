'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ErrorBox, Loading, useAction } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { post } from '@/lib/api';
import { addHours, fromLocalInput, roundUpToQuarter, toLocalInput } from '@/lib/format';
import type { Account, Meeting, Page, User } from '@/lib/types';
import { useFetch } from '@/lib/useFetch';

export default function NewMeetingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const accounts = useFetch<Page<Account>>('/accounts?limit=100');
  const users = useFetch<{ items: User[] }>(user && user.role !== 'employee' ? '/users' : null);

  const start0 = useMemo(() => roundUpToQuarter(addHours(new Date(), 1)), []);
  const [accountId, setAccountId] = useState('');
  const [contactId, setContactId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [start, setStart] = useState(toLocalInput(start0));
  const [end, setEnd] = useState(toLocalInput(addHours(start0, 1)));
  const [location, setLocation] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const { busy, error, run } = useAction();

  const account = accounts.data?.items.find((a) => a.id === accountId);

  function onAccount(id: string) {
    setAccountId(id);
    const a = accounts.data?.items.find((x) => x.id === id);
    setContactId(a?.contacts[0]?.id ?? '');
    if (a?.address && !location) setLocation(a.address);
  }
  // Keep the end one hour after the start unless the person has moved it on their own.
  function onStart(v: string) {
    const prevDur = new Date(end).getTime() - new Date(start).getTime();
    setStart(v);
    if (v && prevDur > 0) setEnd(toLocalInput(new Date(new Date(v).getTime() + prevDur)));
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await post<{ meeting: Meeting }>('/meetings', {
        accountId, contactId, purpose, location, notes: notes || undefined,
        scheduledStart: fromLocalInput(start), scheduledEnd: fromLocalInput(end),
        assignedTo: assignedTo || undefined,
      });
      router.push(`/meetings/${r.meeting.id}`);
    });
  };

  if (accounts.loading && !accounts.data) return <Loading />;
  const sales = users.data?.items.filter((u) => u.role !== 'admin' && u.isActive) ?? [];

  return (
    <>
      <div className="page-head"><h1>New meeting</h1></div>
      {accounts.data?.items.length === 0 ? (
        <div className="panel empty"><strong>Add an account first</strong>
          Meetings are scheduled against a customer account and a contact. <Link href="/accounts">Go to accounts</Link></div>
      ) : (
        <form className="panel panel-pad stack" onSubmit={submit}>
          <div className="form-grid">
            <label className="field"><span>Customer account</span>
              <select value={accountId} onChange={(e) => onAccount(e.target.value)} required>
                <option value="" disabled>Choose an account</option>
                {accounts.data?.items.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Contact person</span>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} required disabled={!account}>
                <option value="" disabled>{account ? 'Choose a contact' : 'Choose an account first'}</option>
                {account?.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.designation ? `, ${c.designation}` : ''}</option>)}
              </select>
              {account && account.contacts.length === 0 && <small>This account has no contacts yet. Add one on the Accounts page.</small>}
            </label>
            <label className="field full"><span>Purpose</span>
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Product demo, contract renewal…" required minLength={3} maxLength={300} />
            </label>
            <label className="field"><span>Starts</span>
              <input type="datetime-local" value={start} onChange={(e) => onStart(e.target.value)} required />
            </label>
            <label className="field"><span>Ends</span>
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required min={start} />
            </label>
            <label className="field full"><span>Location</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Customer site, address or meeting room" required />
            </label>
            {user?.role !== 'employee' && (
              <label className="field full"><span>Assigned to</span>
                <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                  <option value="">Me ({user?.name})</option>
                  {sales.filter((u) => u.id !== user?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
            )}
            <label className="field full"><span>Notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </label>
          </div>
          <ErrorBox message={error} />
          <div className="row">
            <button className="btn btn-primary" disabled={busy || !accountId || !contactId}>{busy ? 'Scheduling…' : 'Schedule meeting'}</button>
            <Link className="btn" href="/meetings">Cancel</Link>
          </div>
        </form>
      )}
    </>
  );
}
