export const ALLOWED_DOMAINS = [
    'umass.edu',
    // 'smith.edu',
    // 'hampshire.edu',
    // 'mtholyoke.edu',
    // 'amherst.edu',
] as const;

export function isAllowedDomain(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    return ALLOWED_DOMAINS.some(d => domain === d);
}