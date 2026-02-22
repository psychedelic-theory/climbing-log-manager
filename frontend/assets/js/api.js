// assets/js/api.js
// If you set window.API_BASE_URL in index.html, this will use it.
// Otherwise it falls back to the deployed Render backend.
const API_BASE_URL = (window.API_BASE_URL || "https://climbing-log-manager.onrender.com").replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const err = new Error(body?.message || "Request failed");
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function apiListLogs({ page, pageSize, q, envs = [], types = [], progress = [], sort = "date_desc" }) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (q) params.set("q", q);

  if (envs.length) params.set("env", envs.join(","));
  if (types.length) params.set("type", types.join(","));
  if (progress.length) params.set("progress", progress.join(","));
  if (sort) params.set("sort", sort);

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
