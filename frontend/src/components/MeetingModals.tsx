'use client';
import { useMemo, useState } from 'react';
import { post } from '@/lib/api';
import { addHours, fromLocalInput, OUTCOME_LABEL, roundUpToQuarter, toLocalInput } from '@/lib/format';
import type { GeoPoint, Meeting, Outcome, User } from '@/lib/types';
import { LocationPicker } from './LocationPicker';
import { Modal } from './Modal';
import { ErrorBox, useAction } from './ui';

interface Common { meeting: Meeting; onClose: () => void; onDone: () => void }

export function CheckInModal({ meeting, onClose, onDone }: Common) {
  const [loc, setLoc] = useState<GeoPoint | null>(null);
  const { busy, error, run } = useAction();
  const isReturn = meeting.visits.length > 0;
  return (
    <Modal title={isReturn ? 'Check in for the return visit' : 'Check in'} onClose={onClose}>
      <p className="muted">
        {meeting.account.name}. The check-in time is recorded by the server when you confirm.
      </p>
      <LocationPicker onChange={setLoc} />
      <ErrorBox message={error} />
      <div className="modal-foot">
        <button className="btn" type="button" onClick={onClose}>Not yet</button>
        <button className="btn btn-primary" disabled={!loc || busy}
          onClick={async () => { const ok = await run(async () => { await post(`/meetings/${meeting.id}/check-in`, { location: loc }); return true; }); if (ok) onDone(); }}>
          {busy ? 'Checking in…' : 'Check in now'}
        </button>
      </div>
    </Modal>
  );
}

export function CheckOutModal({ meeting, onClose, onDone, users }: Common & { users: User[] }) {
  const [mode, setMode] = useState<'complete' | 'return_later'>('complete');
  const [loc, setLoc] = useState<GeoPoint | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(meeting.status === 'in_progress' ? 'interested' : 'unable_to_meet');
  const [notes, setNotes] = useState('');
  const [wantFollowUp, setWantFollowUp] = useState(false);
  const defaultDue = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return toLocalInput(d); }, []);
  const [dueDate, setDueDate] = useState(defaultDue);
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState(meeting.assignee.id);
  const defaultReturn = useMemo(() => toLocalInput(roundUpToQuarter(addHours(new Date(), 3))), []);
  const [returnAt, setReturnAt] = useState(defaultReturn);
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();

  const mustFollowUp = outcome === 'follow_up_required';
  const withFollowUp = mustFollowUp || wantFollowUp;
  const started = meeting.status === 'in_progress';
  // Only "Unable to meet" may be recorded without the meeting having started (server rule).
  const outcomes = (Object.keys(OUTCOME_LABEL) as Outcome[]).filter((o) => started || o === 'unable_to_meet');

  // Owners the server accepts: the assigned employee, their manager, or an admin.
  const assignee = users.find((u) => u.id === meeting.assignee.id);
  const owners = users.filter((u) => u.id === meeting.assignee.id || u.role === 'admin' || (assignee?.managerId && u.id === assignee.managerId));

  const canSubmit = !!loc && (mode === 'return_later' ? !!returnAt : !withFollowUp || (description.trim().length >= 3 && !!dueDate && !!ownerId));

  async function submit() {
    const ok = await run(async () => {
      const body = mode === 'return_later'
        ? { disposition: 'return_later', location: loc, returnAt: fromLocalInput(returnAt), reason: reason.trim() || undefined }
        : {
            disposition: 'complete', location: loc, outcome, outcomeNotes: notes.trim() || undefined,
            followUp: withFollowUp ? { ownerId, dueDate: fromLocalInput(dueDate), description: description.trim() } : undefined,
          };
      await post(`/meetings/${meeting.id}/check-out`, body);
      return true;
    });
    if (ok) onDone();
  }

  return (
    <Modal title="Check out" onClose={onClose}>
      {!started && <p className="notice small">You have not started the meeting yet. You can say you are coming back later, or record that the customer could not meet.</p>}
      <div className="stack" style={{ gap: '0.5rem' }}>
        <label className="choice">
          <input type="radio" name="mode" checked={mode === 'complete'} onChange={() => { setMode('complete'); if (!started) setOutcome('unable_to_meet'); }} />
          <span><strong>The meeting is finished</strong><br /><span className="muted small">Record the outcome to complete it.</span></span>
        </label>
        <label className="choice">
          <input type="radio" name="mode" checked={mode === 'return_later'} onChange={() => setMode('return_later')} />
          <span><strong>The customer asked me to come back</strong><br /><span className="muted small">Ends this visit and keeps the meeting open for a return visit.</span></span>
        </label>
      </div>

      {mode === 'complete' ? (
        <>
          <label className="field"><span>Outcome</span>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
              {outcomes.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
            </select>
          </label>
          <label className="field"><span>Outcome notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          {!mustFollowUp && (
            <label className="row small"><input type="checkbox" style={{ width: 'auto', minHeight: 0 }} checked={wantFollowUp} onChange={(e) => setWantFollowUp(e.target.checked)} /> Also add a follow-up</label>
          )}
          {withFollowUp && (
            <fieldset style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '0.8rem' }}>
              <legend style={{ fontWeight: 600, padding: '0 0.3rem' }}>Follow-up{mustFollowUp ? ' (required)' : ''}</legend>
              <div className="form-grid">
                <label className="field full"><span>What needs to happen</span>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Send revised quote" /></label>
                <label className="field"><span>Owner</span>
                  <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                    {owners.length === 0 && <option value={meeting.assignee.id}>{meeting.assignee.name}</option>}
                    {owners.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select></label>
                <label className="field"><span>Due</span>
                  <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
              </div>
            </fieldset>
          )}
        </>
      ) : (
        <>
          <label className="field"><span>Agreed return time</span>
            <input type="datetime-local" value={returnAt} onChange={(e) => setReturnAt(e.target.value)} />
            <small>Check-in for the return visit opens 30 minutes before this time.</small></label>
          <label className="field"><span>Reason (optional)</span><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer is in another call" /></label>
        </>
      )}

      <LocationPicker onChange={setLoc} />
      <ErrorBox message={error} />
      <div className="modal-foot">
        <button className="btn" type="button" onClick={onClose}>Stay checked in</button>
        <button className="btn btn-primary" disabled={!canSubmit || busy} onClick={submit}>
          {busy ? 'Checking out…' : mode === 'complete' ? 'Complete meeting' : 'Check out and return later'}
        </button>
      </div>
    </Modal>
  );
}

export function UnableModal({ meeting, onClose, onDone }: Common) {
  const [notes, setNotes] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Modal title="Customer could not meet" onClose={onClose}>
      <p className="muted">Records &ldquo;Unable to meet&rdquo; for {meeting.account.name} without a visit. Use this when nobody was there to meet you.</p>
      <label className="field"><span>Notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} autoFocus /></label>
      <ErrorBox message={error} />
      <div className="modal-foot">
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy}
          onClick={async () => { const ok = await run(async () => { await post(`/meetings/${meeting.id}/complete`, { outcome: 'unable_to_meet', outcomeNotes: notes.trim() || undefined }); return true; }); if (ok) onDone(); }}>
          {busy ? 'Saving…' : 'Record unable to meet'}
        </button>
      </div>
    </Modal>
  );
}

export function RescheduleModal({ meeting, onClose, onDone }: Common) {
  const [start, setStart] = useState(toLocalInput(new Date(meeting.scheduledStart)));
  const [end, setEnd] = useState(toLocalInput(new Date(meeting.scheduledEnd)));
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Modal title="Reschedule meeting" onClose={onClose}>
      <p className="notice small">Moving the time clears the confirmation. The meeting returns to Scheduled and needs confirming again.</p>
      <div className="form-grid">
        <label className="field"><span>Starts</span><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field"><span>Ends</span><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} min={start} /></label>
        <label className="field full"><span>Reason (optional)</span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </div>
      <ErrorBox message={error} />
      <div className="modal-foot">
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy}
          onClick={async () => { const ok = await run(async () => { await post(`/meetings/${meeting.id}/reschedule`, { scheduledStart: fromLocalInput(start), scheduledEnd: fromLocalInput(end), reason: reason.trim() || undefined }); return true; }); if (ok) onDone(); }}>
          {busy ? 'Saving…' : 'Reschedule'}
        </button>
      </div>
    </Modal>
  );
}
