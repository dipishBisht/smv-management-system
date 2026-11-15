'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Loading } from './ui';

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => { if (ready && !user) router.replace('/login'); }, [ready, user, router]);
  if (!ready || !user) return <div className="main"><Loading /></div>;

  const nav = [
    { href: '/meetings', label: 'Meetings' },
    { href: '/follow-ups', label: 'Follow-ups' },
    { href: '/accounts', label: 'Accounts' },
    ...(user.role !== 'employee' ? [{ href: '/team', label: 'Team' }] : []),
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Optronix<span> Visits</span></div>
        <nav className="nav" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path === n.href || path.startsWith(n.href + '/') ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="me small">
          <strong>{user.name}</strong>
          <span className="muted" style={{ textTransform: 'capitalize' }}>{user.role}</span>
          <div><button className="btn btn-quiet" style={{ paddingInline: 0 }} onClick={() => { logout(); router.replace('/login'); }}>Sign out</button></div>
        </div>
      </aside>
      <div>
        <div className="mobile-top">
          <strong style={{ fontFamily: 'var(--font-display)' }}>Optronix Visits</strong>
          <button className="btn btn-quiet" onClick={() => { logout(); router.replace('/login'); }}>Sign out</button>
        </div>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
