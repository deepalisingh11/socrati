'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { handleSignOut, handleSessionExpiry, getInitials, getShortName } from '@/lib/auth';

const NAV = [
    {
        href: '/session/new',
        label: 'New session',
        icon: (
            <svg viewBox="0 0 14 14" fill="none" width={14} height={14}>
                <path d="M2 3.5A1.5 1.5 0 013.5 2H8l3.5 3.5V12a1.5 1.5 0 01-1.5 1.5H3.5A1.5 1.5 0 012 12V3.5z"
                    stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 2v3.5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        href: '/sessions',
        label: 'Sessions',
        icon: (
            <svg viewBox="0 0 14 14" fill="none" width={14} height={14}>
                <path d="M2 4h10M2 7.5h8M2 11h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        href: '/progress',
        label: 'Progress',
        icon: (
            <svg viewBox="0 0 14 14" fill="none" width={14} height={14}>
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 5v2.5l1.8 1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
        ),
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');

    useEffect(() => {
        const supabase = createClient();

        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                const name = data.user.user_metadata?.name ?? data.user.user_metadata?.full_name ?? '';
                setDisplayName(name);
                setEmail(data.user.email ?? '');
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                handleSessionExpiry({ redirect: (p) => router.push(p), log: console.log });
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

    const handleLogout = () => handleSignOut({
        signOut: () => createClient().auth.signOut(),
        redirect: (p) => router.push(p),
        log: console.log,
    });

    const initials = displayName
        ? getInitials(displayName)
        : email
            ? email.slice(0, 2).toUpperCase()
            : '??';

    const shortName = displayName ? getShortName(displayName) : email;

    return (
        <aside style={{
            width: 200,
            background: 'var(--sb)',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 12px 16px',
            flexShrink: 0,
            borderRight: '1px solid var(--sb1)',
            minHeight: '100vh',
        }}>
            {/* Logo */}
            <div style={{ padding: '0.2rem 0.75rem 0.8rem', fontSize: 20, fontWeight: 600, color: 'var(--td)', letterSpacing: '-0.3px' }}>
                Socra<em style={{ color: 'var(--acc)', fontStyle: 'italic', fontWeight: 500 }}>ti</em>
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3)', padding: '0 0.75rem', marginTop: -6, marginBottom: 18 }}>
                AI-powered Socratic tutor
            </div>

            {/* Nav */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {NAV.map(({ href, label, icon }) => {
                    const active = pathname === href || pathname.startsWith(href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 9,
                                fontSize: 13,
                                padding: '8px 10px',
                                borderRadius: 8,
                                fontWeight: active ? 500 : 400,
                                color: active ? '#eef8f2' : 'var(--t2)',
                                background: active ? 'var(--acc)' : 'transparent',
                                textDecoration: 'none',
                                transition: 'background 0.12s',
                            }}
                        >
                            <span style={{ opacity: active ? 1 : 0.75, display: 'flex' }}>{icon}</span>
                            {label}
                        </Link>
                    );
                })}
            </nav>

            <div style={{ flex: 1 }} />

            {/* Sign out */}
            <button
                onClick={handleLogout}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11,
                    color: 'var(--t2)',
                    padding: '7px 10px',
                    borderTop: '1px solid var(--sb1)',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: 'none',
                    borderRadius: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    width: '100%',
                    textAlign: 'left',
                }}
            >
                <svg viewBox="0 0 14 14" fill="none" width={13} height={13} style={{ opacity: 0.6, flexShrink: 0 }}>
                    <path d="M5 2H2.5A.5.5 0 002 2.5v9a.5.5 0 00.5.5H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M9.5 9.5L12 7l-2.5-2.5M12 7H5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Sign out
            </button>

            {/* User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px 0' }}>
                <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: 'var(--acc)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 600, color: '#eef8f2', flexShrink: 0,
                }}>
                    {initials}
                </div>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {shortName || '…'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {email || '…'}
                    </div>
                </div>
            </div>
        </aside>
    );
}