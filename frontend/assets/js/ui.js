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
        <td><span class="pill ${l.progress === "complete" ? "ok" : "warn"}">${escapeHtml(l.progress)}</span></td>
        <td class="right">
            <button class="btn small" data-edit="${l.id}">Edit</button>
            <button class="btn small danger" data-del="${l.id}">Delete</button>
        </td>
        `;
        tbody.appendChild(tr);
    }

    tbody.querySelectorAll("[data-edit]").forEach(btn =>
        btn.addEventListener("click", () => onEdit(btn.dataset.edit))
    );
    tbody.querySelectorAll("[data-del]").forEach(btn =>
        btn.addEventListener("click", () => onDelete(btn.dataset.del))
    );
    }

    export function renderStats({ totalEl, completionEl, byTypeEl }, logs) {
    const total = logs.length;
    const complete = logs.filter(l => l.progress === "complete").length;
    const rate = total === 0 ? 0 : Math.round((complete / total) * 100);

    totalEl.textContent = String(total);
    completionEl.textContent = `${rate}%`;

    const counts = logs.reduce((acc, l) => {
        acc[l.climbType] = (acc[l.climbType] || 0) + 1;
        return acc;
    }, {});

    byTypeEl.innerHTML = "";
    for (const [type, n] of Object.entries(counts)) {
        const li = document.createElement("li");
        li.textContent = `${type}: ${n}`;
        byTypeEl.appendChild(li);
    }
    }

    export function setView(viewName) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.querySelector(`#view-${viewName}`).classList.add("active");

    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelector(`.tab[data-view="${viewName}"]`).classList.add("active");
    }

    function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[c]));
    }
