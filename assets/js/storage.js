const KEY = "climbLogs_v1";

export function loadLogs() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function saveLogs(logs) {
    localStorage.setItem(KEY, JSON.stringify(logs));
}

export function ensureSeed(seedLogs) {
    const existing = loadLogs();
    if (existing && existing.length > 0) return existing;
    saveLogs(seedLogs);
    return seedLogs;
}
