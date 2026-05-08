export const ALLOWED_DOMAINS = [
    'umass.edu',
] as const;

export function isAllowedDomain(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    return ALLOWED_DOMAINS.some(d => domain === d);
}
