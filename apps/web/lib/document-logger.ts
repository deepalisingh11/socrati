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

export function logDocumentEvent(
    scope: string,
    message: string,
    fields?: LogFields,
) {
    const payload = sanitize(fields);
    if (payload) {
        console.log(`[documents:${scope}] ${message}`, payload);
        return;
    }

    console.log(`[documents:${scope}] ${message}`);
}

export function logDocumentError(
    scope: string,
    message: string,
    error: unknown,
    fields?: LogFields,
) {
    const errorFields =
        error instanceof Error
            ? { errorName: error.name, errorMessage: error.message, errorStack: error.stack }
            : { error };

    console.error(`[documents:${scope}] ${message}`, {
        ...sanitize(fields),
        ...errorFields,
    });
}
