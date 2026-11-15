'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ErrorBox, Loading, StatusBadge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { dayKey, fmtDay, fmtTime, OUTCOME_LABEL, startOfToday } from '@/lib/format';
import type { Meeting, MeetingStatus, Page, User } from '@/lib/types';
import { useFetch } from '@/lib/useFetch';

type Range = 'upcoming' | 'today' | 'earlier' | 'all';
const RANGES: { id: Range; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' }, { id: 'today', label: 'Today' },
  { id: 'earlier', label: 'Earlier' }, { id: 'all', label: 'All' },
];
const STATUSES: MeetingStatus[] = ['scheduled', 'confirmed', 'checked_in', 'in_progress', 'on_hold', 'completed', 'cancelled'];
const LABELS: Record<string, string> = {
  scheduled: 'Scheduled', confirmed: 'Confirmed', checked_in: 'Checked in', in_progress: 'In progress',
  on_hold: 'Awaiting return', completed: 'Completed', cancelled: 'Cancelled',
};

export default function MeetingsPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>('upcoming');
  const [status, setStatus] = useState('');
  const [assignee, setAssignee] = useState('');

  const query = useMemo(() => {
    const p = new URLSearchParams({ limit: '100' });
    const today = startOfToday();
    const tomorrow = new Date(today.getTime() + 86_400_000);
    if (range === 'upcoming') p.set('from', today.toISOString());
    if (range === 'today') { p.set('from', today.toISOString()); p.set('to', new Date(tomorrow.getTime() - 1).toISOString()); }
    if (range === 'earlier') p.set('to', new Date(today.getTime() - 1).toISOString());
    if (status) p.set('status', status);
    if (assignee) p.set('assignedTo', assignee);
    return `/meetings?${p}`;
  }, [range, status, assignee]);

  const { data, error, loading } = useFetch<Page<Meeting>>(query);
  const users = useFetch<{ items: User[] }>(user && user.role !== 'employee' ? '/users' : null);

  const groups = useMemo(() => {
    const items = [...(data?.items ?? [])];
    items.sort((a, b) => +new Date(a.scheduledStart) - +new Date(b.scheduledStart));
    if (range === 'earlier' || range === 'all') items.reverse();
    const map = new Map<string, Meeting[]>();
    items.forEach((m) => { const k = dayKey(m.scheduledStart); map.set(k, [...(map.get(k) ?? []), m]); });
    return [...map.entries()];
  }, [data, range]);

  const onSite = data?.items.find((m) => (m.status === 'checked_in' || m.status === 'in_progress') && m.assignee.id === user?.id);
  const showAssignee = user?.role !== 'employee';

  return (
    <>
      <div className="page-head">
        <h1>Meetings</h1>
        <Link href="/meetings/new" className="btn btn-primary">New meeting</Link>
      </div>

      {onSite && (
        <div className="banner">
          <span>You are on site at <strong>{onSite.account.name}</strong>.</span>
          <Link href={`/meetings/${onSite.id}`} className="btn">Open meeting</Link>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Date range">
        {RANGES.map((r) => (
          <button key={r.id} role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>
        ))}
      </div>

      <div className="row" style={{ marginBottom: '0.5rem' }}>
        <label className="field" style={{ minWidth: 180 }}>
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{LABELS[s]}</option>)}
          </select>
        </label>
        {showAssignee && (
          <label className="field" style={{ minWidth: 200 }}>
            <span>Sales employee</span>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">{user?.role === 'manager' ? 'Me and my team' : 'Everyone'}</option>
              {users.data?.items.filter((u) => u.role !== 'admin').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <ErrorBox message={error} />
      {loading && !data && <Loading />}
      {data && groups.length === 0 && (
        <div className="panel empty" style={{ marginTop: '1rem' }}>
          <strong>No meetings here</strong>
          Try another date range or status, or schedule a new meeting.
        </div>
      )}
      {groups.map(([day, items]) => (
        <section key={day}>
          <h2 className="day-label">{fmtDay(items[0].scheduledStart)}</h2>
          <div className="panel">
            {items.map((m) => (
              <Link key={m.id} href={`/meetings/${m.id}`} className="mrow">
                <span className="time">{fmtTime(m.scheduledStart)} to {fmtTime(m.scheduledEnd)}</span>
                <span className="main-col">
                  <strong>{m.account.name}</strong>
                  <span className="who">{m.purpose}, with {m.contactName}</span>
                </span>
                <span>
                  <StatusBadge status={m.status} />
                  {m.outcome && <span className="who" style={{ display: 'block' }}>{OUTCOME_LABEL[m.outcome]}</span>}
                </span>
                <span className="who assignee">{showAssignee ? m.assignee.name : m.location}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
