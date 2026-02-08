// assets/js/api.js
const API_BASE_URL = (window.API_BASE_URL || "").replace(/\/$/, ""); 
// or hardcode temporarily: const API_BASE_URL = "https://your-backend-host.com";

async function request(path, options = {}) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
            ...options,
    });

    const contentType = res.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await res.json() : await res.text();

    if (!res.ok) {
        // Expect backend to return { errors: {field: "msg"} } or { message: "..." }
        const err = new Error(body?.message || "Request failed");
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body;
}

export async function apiListLogs({ page, pageSize, q }) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (q) params.set("q", q);
    return request(`/api/logs?${params.toString()}`);
}

export async function apiGetLog(id) {
    return request(`/api/logs/${encodeURIComponent(id)}`);
}

export async function apiCreateLog(payload) {
    return request(`/api/logs`, { method: "POST", body: JSON.stringify(payload) });
}

export async function apiUpdateLog(id, payload) {
    return request(`/api/logs/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function apiDeleteLog(id) {
    return request(`/api/logs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function apiStats() {
    return request(`/api/stats`);
}
