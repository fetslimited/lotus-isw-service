/**
 * Returns the current timestamp formatted in West Africa Time (WAT, UTC+1).
 */
export function getWATTimestamp(): string {
    return new Date().toLocaleString('en-GB', {
        timeZone: 'Africa/Lagos',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}
