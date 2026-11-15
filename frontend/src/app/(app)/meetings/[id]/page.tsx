'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { CheckInModal, CheckOutModal, RescheduleModal, UnableModal } from '@/components/MeetingModals';
import { ErrorBox, Loading, ReasonModal, StatusBadge, useAction } from '@/components/ui';
import { VisitRuler } from '@/components/VisitRuler';
import { patch, post } from '@/lib/api';
import { ACTION_LABEL, fmtDateTime, fmtDuration, fmtTime, OUTCOME_LABEL } from '@/lib/format';
import type { FollowUp, Meeting, Page, User } from '@/lib/types';
import { useFetch } from '@/lib/useFetch';

type Dialog = null | 'check_in' | 'check_out' | 'unable' | 'reschedule' | 'cancel' | 'reopen';

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const meetingQ = useFetch<{ meeting: Meeting }>(`/meetings/${id}`);
  const followUps = useFetch<Page<FollowUp>>(`/follow-ups?meetingId=${id}&limit=50`);
  const usersQ = useFetch<{ items: User[] }>('/users');
  const [dialog, setDialog] = useState<Dialog>(null);
  const direct = useAction();
  const [editNotes, setEditNotes] = useState<string | null>(null);
  const notesAction = useAction();

  if (meetingQ.loading && !meetingQ.data) return <Loading />;
  if (meetingQ.error || !meetingQ.data) {
    return (
      <div className="stack">
        <ErrorBox message={meetingQ.error ?? 'Meeting not found'} />
        <Link href="/meetings">Back to meetings</Link>
      </div>
    );
  }

  const m = meetingQ.data.meeting;
  const users = usersQ.data?.items ?? [];
  const nameOf = (uid: string) => users.find((u) => u.id === uid)?.name ?? (uid === m.assignedTo ? m.assignee.name : null) ?? 'A manager or admin';
  const can = (a: string) => m.allowedActions.includes(a);
  const refresh = () => { setDialog(null); meetingQ.reload(); followUps.reload(); };
  const close = () => setDialog(null);
  const simple = (path: string) => async () => { const ok = await direct.run(async () => { await post(`/meetings/${m.id}/${path}`); return true; }); if (ok) refresh(); };

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      <div>
        <Link href="/meetings" className="small">Back to meetings</Link>
        <div className="page-head" style={{ marginTop: '0.4rem', marginBottom: 0 }}>
          <div className="stack" style={{ gap: '0.3rem' }}>
            <h1>{m.account.name}</h1>
            <p className="muted">{m.purpose}, with {m.contactName}</p>
          </div>
          <StatusBadge status={m.status} />
        </div>
      </div>

      {m.status === 'on_hold' && (
        <p className="notice">
          {m.nextVisitAt
            ? <>The customer asked you to come back at <strong>{fmtDateTime(m.nextVisitAt)}</strong>. Check-in opens 30 minutes before.</>
            : <>This meeting was reopened. Check in to start a new visit.</>}
        </p>
      )}
      {m.status === 'completed' && (
        <p className="panel panel-pad">
          <strong>{m.outcome ? OUTCOME_LABEL[m.outcome] : 'Completed'}</strong>
          {m.outcomeNotes ? <span className="muted">. {m.outcomeNotes}</span> : null}
        </p>
      )}
      {m.status === 'cancelled' && m.cancelReason && <p className="panel panel-pad muted">Cancelled: {m.cancelReason}</p>}

      <ErrorBox message={direct.error} />
      <div className="actions">
        {can('confirm') && <button className="btn btn-primary" disabled={direct.busy} onClick={simple('confirm')}>Confirm meeting</button>}
        {can('check_in') && <button className="btn btn-primary" onClick={() => setDialog('check_in')}>{m.visits.length ? 'Check in for return visit' : 'Check in'}</button>}
        {can('start') && <button className="btn btn-primary" disabled={direct.busy} onClick={simple('start')}>Start meeting</button>}
        {can('check_out') && <button className={`btn ${m.status === 'in_progress' ? 'btn-primary' : ''}`} onClick={() => setDialog('check_out')}>Check out</button>}
        {can('complete_unable_to_meet') && <button className="btn" onClick={() => setDialog('unable')}>Customer could not meet</button>}
        {can('reschedule') && <button className="btn" onClick={() => setDialog('reschedule')}>Reschedule</button>}
        {can('reopen') && <button className="btn" onClick={() => setDialog('reopen')}>Reopen meeting</button>}
        {can('cancel') && <button className="btn btn-danger" onClick={() => setDialog('cancel')}>Cancel meeting</button>}
      </div>

      <section className="panel">
        <div className="panel-head row spread">
          <h2 style={{ padding: 0, border: 0 }}>Scheduled vs. actual</h2>
          {m.totalOnSiteMinutes > 0 && <span className="muted small">Total on site: {fmtDuration(m.totalOnSiteMinutes)}</span>}
        </div>
        <VisitRuler m={m} />
      </section>

      <div className="detail-grid">
        <div className="stack" style={{ gap: '1rem' }}>
          <section className="panel">
            <h2>Details</h2>
            <div className="panel-pad">
              <dl className="facts">
                <dt>When</dt><dd>{fmtDateTime(m.scheduledStart)} to {fmtTime(m.scheduledEnd)}</dd>
                <dt>Where</dt><dd>{m.location}</dd>
                <dt>Sales employee</dt><dd>{m.assignee.name}</dd>
                <dt>Contact</dt><dd>{m.contactName}</dd>
                {m.rescheduleCount > 0 && (<><dt>Rescheduled</dt><dd>{m.rescheduleCount} time{m.rescheduleCount > 1 ? 's' : ''}</dd></>)}
                {m.reopenCount > 0 && (<><dt>Reopened</dt><dd>{m.reopenCount} time{m.reopenCount > 1 ? 's' : ''}</dd></>)}
              </dl>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head row spread">
              <h2 style={{ padding: 0, border: 0 }}>Notes</h2>
              {can('update_details') && editNotes === null && <button className="btn btn-quiet" onClick={() => setEditNotes(m.notes ?? '')}>Edit</button>}
            </div>
            <div className="panel-pad stack">
              {editNotes === null ? (
                m.notes ? <p style={{ whiteSpace: 'pre-wrap' }}>{m.notes}</p> : <p className="muted">No notes yet.</p>
              ) : (
                <>
                  <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} aria-label="Notes" />
                  <ErrorBox message={notesAction.error} />
                  <div className="row">
                    <button className="btn btn-primary" disabled={notesAction.busy}
                      onClick={async () => { const ok = await notesAction.run(async () => { await patch(`/meetings/${m.id}`, { notes: editNotes }); return true; }); if (ok) { setEditNotes(null); meetingQ.reload(); } }}>
                      Save notes
                    </button>
                    <button className="btn" onClick={() => setEditNotes(null)}>Discard</button>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>Follow-ups</h2>
            {followUps.data?.items.length ? followUps.data.items.map((f) => (
              <div key={f.id} className="frow">
                <div>
                  <strong>{f.description}</strong>
                  <div className="small muted">{nameOf(f.ownerId)} by {fmtDateTime(f.dueDate)}</div>
                </div>
                <span className={`tag ${f.status === 'done' ? 'ok' : f.status === 'cancelled' ? '' : f.overdue ? 'bad' : 'warn'}`}>
                  {f.status === 'open' ? (f.overdue ? 'Overdue' : 'Open') : f.status === 'done' ? 'Done' : 'Cancelled'}
                </span>
              </div>
            )) : <p className="empty">No follow-ups for this meeting.</p>}
            <div className="panel-pad" style={{ borderTop: '1px solid var(--line-soft)' }}>
              <Link href="/follow-ups">Manage all follow-ups</Link>
            </div>
          </section>
        </div>

        <section className="panel">
          <h2>History</h2>
          <ol className="timeline">
            {m.history.map((h, i) => (
              <li key={i}>
                <strong>{ACTION_LABEL[h.action] ?? h.action}</strong>
                <div className="small muted">{fmtDateTime(h.at)}, {nameOf(h.by)}</div>
                {h.note && <div className="small">{h.note}</div>}
                {h.action === 'reopened' && h.meta?.previousOutcome ? <div className="small muted">Earlier outcome: {OUTCOME_LABEL[h.meta.previousOutcome as keyof typeof OUTCOME_LABEL]}</div> : null}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {dialog === 'check_in' && <CheckInModal meeting={m} onClose={close} onDone={refresh} />}
      {dialog === 'check_out' && <CheckOutModal meeting={m} users={users} onClose={close} onDone={refresh} />}
      {dialog === 'unable' && <UnableModal meeting={m} onClose={close} onDone={refresh} />}
      {dialog === 'reschedule' && <RescheduleModal meeting={m} onClose={close} onDone={refresh} />}
      {dialog === 'cancel' && (
        <ReasonModal title="Cancel this meeting?" label="Reason for cancelling" confirmLabel="Cancel meeting" required danger
          onSubmit={(reason) => post(`/meetings/${m.id}/cancel`, { reason }).then(refresh)} onClose={close} />
      )}
      {dialog === 'reopen' && (
        <ReasonModal title="Reopen this meeting?" label="Why is it being reopened?" required confirmLabel="Reopen meeting"
          hint="The recorded outcome is cleared and its follow-ups are cancelled. The earlier outcome stays in the history. The employee checks in again to continue."
          onSubmit={(reason) => post(`/meetings/${m.id}/reopen`, { reason }).then(refresh)} onClose={close} />
      )}
    </div>
  );
}
