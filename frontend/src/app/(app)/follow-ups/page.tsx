"use client";
import Link from "next/link";
import { useState } from "react";
import { ErrorBox, Loading, ReasonModal } from "@/components/ui";
import { post } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { FollowUp, Page, User } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";
import { useAuth } from "@/lib/auth";

type Tab = "open" | "overdue" | "done";
const TABS: { id: Tab; label: string; query: string }[] = [
  { id: "open", label: "Open", query: "status=open" },
  { id: "overdue", label: "Overdue", query: "overdue=true" },
  { id: "done", label: "Done", query: "status=done" },
];

export default function FollowUpsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("open");
  const q = TABS.find((t) => t.id === tab)!.query;
  const { data, error, loading, reload } = useFetch<Page<FollowUp>>(
    `/follow-ups?${q}&limit=100`,
  );
  const users = useFetch<{ items: User[] }>("/users");
  const [action, setAction] = useState<{
    kind: "done" | "cancel";
    fu: FollowUp;
  } | null>(null);
  const nameOf = (id: string) =>
    users.data?.items.find((u) => u.id === id)?.name ?? "Unknown";

  return (
    <>
      <div className="page-head">
        <h1>Follow-ups</h1>
      </div>
      <div className="tabs" role="tablist" aria-label="Follow-up status">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ErrorBox message={error} />
      {loading && !data && <Loading />}
      {data && data.items.length === 0 && (
        <div className="panel empty">
          <strong>
            {tab === "open"
              ? "Nothing waiting on you"
              : tab === "overdue"
                ? "Nothing overdue"
                : "No completed follow-ups yet"}
          </strong>
          Follow-ups are created when a meeting ends with &ldquo;Follow-up
          required&rdquo;.
        </div>
      )}
      {data && data.items.length > 0 && (
        <div className="panel">
          {data.items.map((f) => {
            const canAct =
              f.status === "open" &&
              (f.ownerId === user?.id || user?.role !== "employee");
            return (
              <div key={f.id} className="frow">
                <div>
                  <strong>{f.description}</strong>
                  <div className="small muted">
                    {nameOf(f.ownerId)}, due {fmtDateTime(f.dueDate)}
                    {f.overdue && (
                      <span className="tag bad" style={{ marginLeft: 8 }}>
                        Overdue
                      </span>
                    )}
                  </div>
                  {f.completionNote && (
                    <div className="small">Note: {f.completionNote}</div>
                  )}
                  <Link className="small" href={`/meetings/${f.meetingId}`}>
                    View meeting
                  </Link>
                </div>
                {canAct && (
                  <div className="row">
                    <button
                      className="btn btn-primary"
                      onClick={() => setAction({ kind: "done", fu: f })}
                    >
                      Mark done
                    </button>
                    <button
                      className="btn btn-quiet"
                      onClick={() => setAction({ kind: "cancel", fu: f })}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {action?.kind === "done" && (
        <ReasonModal
          title="Mark follow-up done"
          label="Note (optional)"
          confirmLabel="Mark done"
          onSubmit={(note) =>
            post(`/follow-ups/${action.fu.id}/complete`, {
              note: note || undefined,
            }).then(reload)
          }
          onClose={() => setAction(null)}
        />
      )}
      {action?.kind === "cancel" && (
        <ReasonModal
          title="Cancel follow-up"
          label="Reason"
          confirmLabel="Cancel follow-up"
          required
          danger
          onSubmit={(reason) =>
            post(`/follow-ups/${action.fu.id}/cancel`, { reason }).then(reload)
          }
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
