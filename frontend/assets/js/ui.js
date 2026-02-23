/**
 * Inline SVG placeholder (mountain + "no image")
 */
export function placeholderSvg({ title = "No image" } = {}) {
  return `
    <svg class="noimg" viewBox="0 0 64 64" role="img" aria-label="${escapeHtml(title)}" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="62" height="62" rx="12" ry="12" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)"/>
      <path d="M14 44l12-16 10 12 6-8 8 12H14z" fill="rgba(94,161,255,0.35)"/>
      <path d="M22 28l4-6 4 6" fill="rgba(232,238,252,0.35)"/>
      <circle cx="46" cy="22" r="5" fill="rgba(255,204,102,0.35)"/>
      <path d="M18 52h28" stroke="rgba(168,179,207,0.45)" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

/**
 * Render the list table body with ONLY the current page of logs
 * Now includes an Image thumbnail column between Date and Environment.
 */
export function renderList(tbody, logs, onEdit, onDelete, imageUrlForId) {
  tbody.innerHTML = "";

  for (const l of logs) {
    const tr = document.createElement("tr");

    const imgCell = l.hasImage
      ? `
        <div class="thumb" data-imgwrap>
          <img class="thumb-img" alt="Climb photo" loading="lazy" src="${escapeHtml(imageUrlForId(l.id))}" />
        </div>
      `
      : `
        <div class="thumb" data-imgwrap>
          ${placeholderSvg({ title: "No image" })}
        </div>
      `;

    tr.innerHTML = `
      <td>${escapeHtml(l.date)}</td>
      <td>${imgCell}</td>
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

    // If image fails to load, swap to placeholder (no broken UI)
    const img = tr.querySelector("img.thumb-img");
    if (img) {
      img.addEventListener("error", () => {
        const wrap = tr.querySelector('[data-imgwrap]');
        if (wrap) wrap.innerHTML = placeholderSvg({ title: "No image" });
      });
    }
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