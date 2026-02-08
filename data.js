export function createLog(logs, newLog) {
    return [newLog, ...logs];
}

export function updateLog(logs, updated) {
    return logs.map(l => (l.id === updated.id ? updated : l));
}

export function deleteLog(logs, id) {
    return logs.filter(l => l.id !== id);
}

export function getLogById(logs, id) {
    return logs.find(l => l.id === id) || null;
}
