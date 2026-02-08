import { renderList, renderStats, setView } from "./ui.js";
import { apiListLogs, apiGetLog, apiCreateLog, apiUpdateLog, apiDeleteLog, apiStats } from "./api.js";

const PAGE_SIZE = 10;

let pageState = {
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    items: [],      // only the current page of logs
    query: ""
};

let pendingDeleteId = null;

const tbody = document.getElementById("logsTbody");
const searchInput = document.getElementById("searchInput");
const newBtn = document.getElementById("newBtn");

const form = document.getElementById("logForm");
const formTitle = document.getElementById("formTitle");
const cancelBtn = document.getElementById("cancelBtn");

const modalBackdrop = document.getElementById("modalBackdrop");
const deleteCancel = document.getElementById("deleteCancel");
const deleteConfirm = document.getElementById("deleteConfirm");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageIndicator = document.getElementById("pageIndicator");

// Prevent selecting future dates in the date picker
const dateInput = document.getElementById("date");
if (dateInput) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    dateInput.max = `${yyyy}-${mm}-${dd}`;
}


// Grade options (Add/Edit Log)
const climbTypeEl = document.getElementById("climbType");
const gradeSystemEl = document.getElementById("gradeSystem");
const gradeEl = document.getElementById("grade");

// Allowed grade lists per assignment requirements
const YDS_GRADES = ["5.2","5.3","5.4","5.5","5.6","5.7","5.8","5.9","5.10","5.11","5.12","5.13","5.14","5.15"];
const V_GRADES = Array.from({ length: 18 }, (_, i) => `V${i}`); // V0..V17

function setGradeOptions({ climbType, gradeSystem, selected = "" }) {
    if (!gradeEl) return;

    const isBoulder = climbType === "boulder";
    const list = gradeSystem === "V" ? V_GRADES : YDS_GRADES;

    // Reset options
    gradeEl.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "Select…";
    gradeEl.appendChild(ph);

    for (const g of list) {
        const opt = document.createElement("option");
        opt.value = g;
        opt.textContent = g;
        gradeEl.appendChild(opt);
    }

    // Keep selected if valid, otherwise clear
    if (selected && list.includes(selected)) {
        gradeEl.value = selected;
    } else {
        gradeEl.value = "";
    }
}

function refreshGradeOptions(keepSelected = false) {
    const climbType = climbTypeEl ? climbTypeEl.value : "";
    const gradeSystem = gradeSystemEl ? gradeSystemEl.value : "";
    const selected = keepSelected && gradeEl ? gradeEl.value : "";
    if (!climbType || !gradeSystem) {
        // Still ensure placeholder exists
        if (gradeEl && gradeEl.options.length === 0) {
            const ph = document.createElement("option");
            ph.value = "";
            ph.textContent = "Select…";
            gradeEl.appendChild(ph);
        }
        return;
    }
    setGradeOptions({ climbType, gradeSystem, selected });
}

// Update grade options when climb type / grade system changes
if (climbTypeEl) climbTypeEl.addEventListener("change", () => refreshGradeOptions(false));
if (gradeSystemEl) gradeSystemEl.addEventListener("change", () => refreshGradeOptions(false));



const statsEls = {
    totalEl: document.getElementById("statTotal"),
    completionEl: document.getElementById("statCompletion"),
    byTypeEl: document.getElementById("statByType"),
};

document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
});

newBtn.addEventListener("click", () => {
    form.reset();
    document.getElementById("logId").value = "";
    formTitle.textContent = "Add Log";
    refreshGradeOptions(false);

    setView("form");
});

cancelBtn.addEventListener("click", () => setView("list"));

searchInput.addEventListener("input", async () => {
    pageState.page = 1;
    await rerender();
});

async function rerender() {
    const q = searchInput.value.trim().toLowerCase();
    pageState.query = q;

    // Fetch paged items from backend
    const list = await apiListLogs({ page: pageState.page, pageSize: pageState.pageSize, q });

    // Example expected backend response:
    // { items: [...], total: 123, page: 1, pageSize: 10 }
    pageState.items = list.items;
    pageState.total = list.total;
    pageState.page = list.page;

    const totalPages = Math.max(1, Math.ceil(pageState.total / pageState.pageSize));
    if (pageIndicator) pageIndicator.textContent = `Page ${pageState.page} of ${totalPages}`;

    if (prevBtn) prevBtn.disabled = pageState.page <= 1;
    if (nextBtn) nextBtn.disabled = pageState.page >= totalPages;

    renderList(tbody, pageState.items, onEdit, onAskDelete);

    // Either compute stats from backend:
    const stats = await apiStats();
    renderStats(statsEls, stats);
}

async function onEdit(id) {
    const l = await apiGetLog(id);
    if (!l) return;

    document.getElementById("logId").value = l.id;
    document.getElementById("date").value = l.date;
    document.getElementById("environment").value = l.environment;
    document.getElementById("location").value = l.location;
    document.getElementById("routeName").value = l.routeName;
    document.getElementById("climbType").value = l.climbType;
    document.getElementById("gradeSystem").value = l.gradeSystem;
    // Populate grade options based on climb type/system, then select the grade
    setGradeOptions({ climbType: l.climbType, gradeSystem: l.gradeSystem, selected: l.grade });
    document.getElementById("progress").value = l.progress;

    formTitle.textContent = "Edit Log";
    setView("form");
}

function onAskDelete(id) {
    pendingDeleteId = id;
    modalBackdrop.classList.remove("hidden");
}

deleteCancel.addEventListener("click", () => {
    pendingDeleteId = null;
    modalBackdrop.classList.add("hidden");
});

deleteConfirm.addEventListener("click", async () => {
    if (!pendingDeleteId) return;

    await apiDeleteLog(pendingDeleteId);

    pendingDeleteId = null;
    modalBackdrop.classList.add("hidden");

    // If you deleted the last item on the last page, step back a page
    const maxPage = Math.max(1, Math.ceil((pageState.total - 1) / pageState.pageSize));
    pageState.page = Math.min(pageState.page, maxPage);

    await rerender();
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = readForm();

    // Keep client-side validation (good UX)
    const errors = validate(payload);
    showErrors(errors);
    if (Object.keys(errors).length) return;

    try {
        if (payload.id) {
            await apiUpdateLog(payload.id, payload);
        } else {
            // Backend should generate ID, or you can send one.
            // Better: let backend generate it so server is source of truth.
        await apiCreateLog(payload);
        }

        setView("list");
        await rerender();
    } catch (err) {
        // Server-side validation errors should be displayed too
        // Expect err.body.errors = { field: "message" }
        if (err.body && err.body.errors) {
            showErrors(err.body.errors);
            return;
        }
        alert(err.message || "Save failed");
    }
});

function readForm() {
    return {
        id: document.getElementById("logId").value || "",
        date: document.getElementById("date").value.trim(),
        environment: document.getElementById("environment").value,
        location: document.getElementById("location").value.trim(),
        routeName: document.getElementById("routeName").value.trim(),
        climbType: document.getElementById("climbType").value,
        gradeSystem: document.getElementById("gradeSystem").value,
        grade: document.getElementById("grade").value.trim(),
        progress: document.getElementById("progress").value,
    };
}

function validate(p) {
    const err = {};
    if (!p.date) {
        err.date = "Date is required.";
    } else {
        // Disallow future dates (today or earlier only)
        // HTML date input gives YYYY-MM-DD, so string compare works if both are YYYY-MM-DD
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const todayStr = `${yyyy}-${mm}-${dd}`;

        if (p.date > todayStr) {
            err.date = "Date cannot be in the future.";
        }
    }
    if (!p.environment) err.environment = "Environment is required.";
    if (!p.location) err.location = "Location is required.";
    if (!p.routeName) err.routeName = "Route name is required.";
    if (!p.climbType) err.climbType = "Climb type is required.";
    if (!p.gradeSystem) err.gradeSystem = "Grade system is required.";
    if (!p.grade) err.grade = "Grade is required.";
    if (!p.progress) err.progress = "Progress is required.";

    // Domain-specific rule: boulders use V scale; roped climbs use YDS
    if (p.climbType === "boulder" && p.gradeSystem && p.gradeSystem !== "V") {
        err.gradeSystem = "Bouldering should use V-Scale.";
    }
    if (p.climbType !== "boulder" && p.gradeSystem && p.gradeSystem !== "YDS") {
        err.gradeSystem = "Roped climbs should use YDS.";
    }


    // Grade range rules:
    // - Roped climbs (top-rope/sport/trad): YDS grades must be between 5.2 and 5.15 (inclusive)
    // - Bouldering: V grades must be between V0 and V17 (inclusive)
    if (p.climbType === "boulder") {
        if (p.gradeSystem === "V" && p.grade && !V_GRADES.includes(p.grade)) {
            err.grade = "Bouldering grades must be between V0 and V17.";
        }
    } else {
        if (p.gradeSystem === "YDS" && p.grade && !YDS_GRADES.includes(p.grade)) {
            err.grade = "Roped climb grades must be between 5.2 and 5.15.";
        }
    }

    return err;
}

function showErrors(errors) {
    document.querySelectorAll(".error").forEach(el => (el.textContent = ""));
    for (const [k, msg] of Object.entries(errors)) {
        const el = document.querySelector(`[data-err-for="${k}"]`);
        if (el) el.textContent = msg;
    }
}

prevBtn.addEventListener("click", async () => {
    if (pageState.page > 1) {
        pageState.page--;
        await rerender();
    }
});

nextBtn.addEventListener("click", async () => {
    const totalPages = Math.max(1, Math.ceil(pageState.total / pageState.pageSize));
    if (pageState.page < totalPages) {
        pageState.page++;
        await rerender();
    }
});

rerender();
