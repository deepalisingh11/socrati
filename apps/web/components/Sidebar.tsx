'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

            {/* Settings */}
            <div style={{ fontSize: 11, color: 'var(--t2)', padding: '7px 10px 4px', borderTop: '1px solid var(--sb1)' }}>
                Settings
            </div>

            {/* User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px 0' }}>
                <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: 'var(--acc)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 600, color: '#eef8f2', flexShrink: 0,
                }}>
                    DS
                </div>
                <div>
                    <div style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500 }}>Deepali S.</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>deepali@umass.edu</div>
                </div>
            </div>
        </aside>
    );
}