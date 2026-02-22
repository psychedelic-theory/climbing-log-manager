/**
 * Render the list table body with ONLY the current page of logs
 */
export function renderList(tbody, logs, onEdit, onDelete) {
  tbody.innerHTML = "";

  for (const l of logs) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(l.date)}</td>
      <td>${escapeHtml(l.environment)}</td>
      <td>${escapeHtml(l.location)}</td>
      <td>${escapeHtml(l.routeName)}</td>
      <td>${escapeHtml(l.climbType)}</td>
      <td>${escapeHtml(`${l.gradeSystem} ${l.grade}`)}</td>
      <td>
        <span class="pill ${l.progress === "complete" ? "ok" : "warn"}">
          ${escapeHtml(l.progress)}
        </span>
      </td>
      <td class="right">
        <button class="btn small" data-edit="${l.id}">Edit</button>
        <button class="btn small danger" data-del="${l.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Wire edit buttons
  tbody.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => onEdit(btn.dataset.edit))
  );

  // Wire delete buttons
  tbody.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", () => onDelete(btn.dataset.del))
  );
}

/**
 * Render statistics returned by backend
 *
 * Expected stats object:
 * {
 *   total: number,
 *   completionRate: number,
 *   byType: { [type]: number }
 * }
 */
export function renderStats({ totalEl, completionEl, byTypeEl }, stats) {
  const total = Number(stats?.total ?? 0);
  const completionRate = Number(stats?.completionRate ?? 0);
  const byType =
    stats?.byType && typeof stats.byType === "object" ? stats.byType : {};

  totalEl.textContent = String(total);
  completionEl.textContent = `${Math.round(completionRate)}%`;

  // byTypeEl is a <div> in your HTML, so render text lines (not <li>)
  const entries = Object.entries(byType);
  byTypeEl.textContent =
    entries.length === 0
      ? "—"
      : entries.map(([type, count]) => `${type}: ${count}`).join(" • ");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[c]));
}

/**
 * Switch views based on your HTML ids:
 * viewList, viewStats, viewForm
 * and toggle tab active state
 */
export function setView(viewName) {
  const map = {
    list: "viewList",
    stats: "viewStats",
    form: "viewForm",
  };

  const showId = map[viewName];
  if (!showId) return;

  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  document.getElementById(showId)?.classList.remove("hidden");

  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document
    .querySelector(`.tab[data-view="${viewName}"]`)
    ?.classList.add("active");
}
