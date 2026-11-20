"use client";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ErrorBox, Loading, useAction } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { patch, post } from "@/lib/api";
import type { Role, User } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";

export default function TeamPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch<{ items: User[] }>(
    "/users",
  );
  const [creating, setCreating] = useState(false);
  const toggle = useAction();
  const isAdmin = user?.role === "admin";
  const users = data?.items ?? [];
  const nameOf = (id: string | null) => users.find((u) => u.id === id)?.name;

  if (user?.role === "employee")
    return <p className="error">The team page is for managers and admins.</p>;

  return (
    <>
      <div className="page-head">
        <h1>Team</h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            Add user
          </button>
        )}
      </div>
      <ErrorBox message={error ?? toggle.error} />
      {loading && !data && <Loading />}
      {data && (
        <div className="panel">
          {users.map((u) => (
            <div key={u.id} className="frow">
              <div>
                <strong>{u.name}</strong>{" "}
                <span className="tag" style={{ textTransform: "capitalize" }}>
                  {u.role}
                </span>
                {!u.isActive && (
                  <span className="tag bad" style={{ marginLeft: 6 }}>
                    Deactivated
                  </span>
                )}
                <div className="small muted">
                  {u.email}
                  {u.managerId
                    ? `, reports to ${nameOf(u.managerId) ?? "a manager"}`
                    : ""}
                </div>
              </div>
              {isAdmin && u.id !== user?.id && (
                <button
                  className="btn btn-quiet"
                  disabled={toggle.busy}
                  onClick={async () => {
                    const ok = await toggle.run(async () => {
                      await patch(`/users/${u.id}`, { isActive: !u.isActive });
                      return true;
                    });
                    if (ok) reload();
                  }}
                >
                  {u.isActive ? "Deactivate" : "Reactivate"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {creating && (
        <UserModal
          managers={users.filter((u) => u.role === "manager")}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function UserModal({
  managers,
  onClose,
  onDone,
}: {
  managers: User[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [v, setV] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee" as Role,
    managerId: "",
  });
  const { busy, error, run } = useAction();
  return (
    <Modal title="Add user" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await post("/users", {
              ...v,
              managerId:
                v.role === "employee" && v.managerId ? v.managerId : undefined,
            });
            onDone();
          });
        }}
      >
        <div className="form-grid">
          <label className="field full">
            <span>Full name</span>
            <input
              value={v.name}
              onChange={(e) => setV({ ...v, name: e.target.value })}
              required
              minLength={2}
              autoFocus
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={v.email}
              onChange={(e) => setV({ ...v, email: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Temporary password</span>
            <input
              type="password"
              value={v.password}
              onChange={(e) => setV({ ...v, password: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select
              value={v.role}
              onChange={(e) => setV({ ...v, role: e.target.value as Role })}
            >
              <option value="employee">Sales employee</option>
              <option value="manager">Sales manager</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {v.role === "employee" && (
            <label className="field">
              <span>Manager</span>
              <select
                value={v.managerId}
                onChange={(e) => setV({ ...v, managerId: e.target.value })}
              >
                <option value="">No manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <ErrorBox message={error} />
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Create user"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
