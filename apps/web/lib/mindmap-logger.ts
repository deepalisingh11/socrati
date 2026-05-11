type LogFields = Record<string, unknown>;

function sanitize(fields?: LogFields) {
    if (!fields) return undefined;

    return Object.fromEntries(
        Object.entries(fields).map(([key, value]) => {
            if (/token|key|secret|password/i.test(key)) {
                return [key, '[redacted]'];
            }

            return [key, value];
        }),
    );
}

export function logMindMapEvent(
    scope: string,
    message: string,
    fields?: LogFields,
) {
    const payload = sanitize(fields);
    if (payload) {
        console.log(`[mindmap:${scope}] ${message}`, payload);
        return;
    }

    console.log(`[mindmap:${scope}] ${message}`);
}

export function logMindMapError(
    scope: string,
    message: string,
    error: unknown,
    fields?: LogFields,
) {
    const errorFields =
        error instanceof Error
            ? { errorName: error.name, errorMessage: error.message, errorStack: error.stack }
            : { error };

    console.error(`[mindmap:${scope}] ${message}`, {
        ...sanitize(fields),
        ...errorFields,
    });
}
