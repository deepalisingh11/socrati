'use client';

import { useState } from 'react';

export default function AuthPage() {
    const [tab, setTab] = useState<'login' | 'signup'>('login');

    // TODO: wire to Supabase
    // import { createClient } from '@/lib/supabase/client'
    // const supabase = createClient()
    // await supabase.auth.signInWithPassword({ email, password })
    // await supabase.auth.signUp({ email, password })
    // await supabase.auth.signInWithOAuth({ provider: 'google' })

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
        }}>
            <div style={{
                display: 'flex',
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid var(--b1)',
                boxShadow: '0 1px 8px rgba(30,40,32,.06)',
                width: '100%',
                maxWidth: 780,
            }}>
                {/* Left panel */}
                <div style={{
                    width: 230,
                    background: 'var(--sb)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '28px 24px',
                    borderRight: '1px solid var(--sb1)',
                    flexShrink: 0,
                }}>
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--td)', letterSpacing: '-0.3px' }}>
                            Socra<em style={{ color: 'var(--acc)', fontStyle: 'italic', fontWeight: 500 }}>ti</em>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                            AI-powered Socratic tutor
                        </div>
                    </div>
                    <div>
                        <div style={{
                            fontSize: 14, fontStyle: 'italic', fontWeight: 400,
                            color: 'var(--t1)', lineHeight: 1.75,
                        }}>
                            "Tell me and I forget. Teach me and I remember. Involve me and I learn."
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 9 }}>
                            — Benjamin Franklin
                        </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                        UMass · Five College Community
                    </div>
                </div>

                {/* Right panel */}
                <div style={{
                    flex: 1,
                    background: 'var(--main)',
                    padding: '32px 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--b1)', marginBottom: 24 }}>
                        {(['login', 'signup'] as const).map((t, i) => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                style={{
                                    fontSize: 13,
                                    padding: '7px 16px 10px',
                                    cursor: 'pointer',
                                    color: tab === t ? 'var(--acc)' : 'var(--t3)',
                                    borderBottom: tab === t ? '2px solid var(--acc)' : '2px solid transparent',
                                    marginBottom: -1,
                                    fontFamily: 'inherit',
                                    fontWeight: tab === t ? 500 : 400,
                                    background: 'transparent',
                                    border: 'none',
                                }}
                            >
                                {i === 0 ? 'Sign in' : 'Create account'}
                            </button>
                        ))}
                    </div>

                    {tab === 'login' ? (
                        <LoginForm />
                    ) : (
                        <SignupForm />
                    )}
                </div>
            </div>
        </div>
    );
}

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // TODO: await supabase.auth.signInWithPassword({ email, password })
        console.log('sign in', { email, password });
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--td)', marginBottom: 4, letterSpacing: '-0.2px' }}>
                Welcome back
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 20 }}>
                Sign in with your institutional email
            </div>
            <Field label="Email">
                <input type="email" placeholder="you@umass.edu" value={email} onChange={e => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
                <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </Field>
            <SubmitBtn loading={loading}>Sign in</SubmitBtn>
            <Divider />
            <GoogleBtn />
        </form>
    );
}

function SignupForm() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // TODO: await supabase.auth.signUp({ email, password, options: { data: { name } } })
        console.log('sign up', { name, email, password });
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--td)', marginBottom: 4, letterSpacing: '-0.2px' }}>
                Create account
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 20 }}>
                Join with your institutional email
            </div>
            <Field label="Full name">
                <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required />
            </Field>
            <Field label="Email" note="Must be a @umass.edu or Five College address">
                <input type="email" placeholder="you@umass.edu" value={email} onChange={e => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
                <input type="password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            </Field>
            <SubmitBtn loading={loading}>Create account</SubmitBtn>
            <Divider />
            <GoogleBtn />
        </form>
    );
}

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 13 }}>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                {label}
            </label>
            <style>{`
        .auth-input {
          width: 100%; height: 38px; padding: 0 12px;
          border: 1px solid var(--b1); border-radius: 8px;
          font-family: inherit; font-size: 13px;
          background: var(--card); color: var(--td); outline: none;
        }
        .auth-input:focus { border-color: var(--acc); }
      `}</style>
            {/* Clone input with className */}
            <div style={{ display: 'contents' }}>
                {children && React.cloneElement(children as React.ReactElement<any>, { className: 'auth-input' })}
            </div>
            {note && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3 }}>{note}</div>}
        </div>
    );
}

function SubmitBtn({ loading, children }: { loading: boolean; children: React.ReactNode }) {
    return (
        <button
            type="submit"
            disabled={loading}
            style={{
                width: '100%', height: 40, background: loading ? 'var(--acc1)' : 'var(--acc)',
                color: '#eef8f2', border: 'none', borderRadius: 9,
                fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4, transition: 'background 0.15s',
            }}
        >
            {loading ? 'Loading...' : children}
        </button>
    );
}

function Divider() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--b1)' }} />
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>or</div>
            <div style={{ flex: 1, height: 1, background: 'var(--b1)' }} />
        </div>
    );
}

function GoogleBtn() {
    return (
        <button
            type="button"
            onClick={() => {
                // TODO: await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '/session/new' } })
                console.log('google oauth');
            }}
            style={{
                width: '100%', height: 38, background: 'var(--card)',
                border: '1px solid var(--b1)', borderRadius: 9,
                fontFamily: 'inherit', fontSize: 12, color: 'var(--t1)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
        >
            <svg width="14" height="14" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
        </button>
    );
}

// Need React import for cloneElement
import React from 'react';