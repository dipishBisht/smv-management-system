'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErrorBox, useAction } from '@/components/ui';
import { useAuth } from '@/lib/auth';

const DEMO = [
  ['Ravi (sales)', 'ravi@optronix.test'],
  ['Meera (manager)', 'manager1@optronix.test'],
  ['Asha (admin)', 'admin@optronix.test'],
];

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();

  useEffect(() => { if (ready && user) router.replace('/meetings'); }, [ready, user, router]);

  return (
    <div className="login">
      <section className="login-art">
        <div className="brand" style={{ color: '#fff', padding: 0 }}>Optronix Visits</div>
        <div className="stack">
          <h1>Every visit, on the record.</h1>
          <p>Schedule customer meetings, check in on site, come back when the customer asks, and finish with an outcome and a follow-up.</p>
        </div>
        <p className="small">Check-in and check-out times come from the server clock, so the record is the same for everyone.</p>
      </section>
      <section className="login-form">
        <h2>Sign in</h2>
        <form onSubmit={(e) => { e.preventDefault(); run(() => login(email, password)); }}>
          <label className="field"><span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </label>
          <label className="field"><span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          <ErrorBox message={error} />
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="demo">
          Demo accounts (password <code>Password@123</code>):{' '}
          {DEMO.map(([label, mail], i) => (
            <span key={mail}>
              <button type="button" onClick={() => { setEmail(mail); setPassword('Password@123'); }}>{label}</button>
              {i < DEMO.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      </section>
    </div>
  );
}
