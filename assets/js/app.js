import { ensureSeed, saveLogs } from "./storage.js";
import { SEED_LOGS } from "./seed.js";
import { createLog, updateLog, deleteLog, getLogById } from "./data.js";
import { renderList, renderStats, setView } from "./ui.js";

let logs = ensureSeed(SEED_LOGS);
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
    setView("form");
});

cancelBtn.addEventListener("click", () => setView("list"));

searchInput.addEventListener("input", () => rerender());

function rerender() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q
        ? logs.filter(l =>
            l.routeName.toLowerCase().includes(q) ||
            l.location.toLowerCase().includes(q)
        )
        : logs;

    renderList(tbody, filtered, onEdit, onAskDelete);
    renderStats(statsEls, logs);
}

function onEdit(id) {
    const l = getLogById(logs, id);
    if (!l) return;

    document.getElementById("logId").value = l.id;
    document.getElementById("date").value = l.date;
    document.getElementById("environment").value = l.environment;
    document.getElementById("location").value = l.location;
    document.getElementById("routeName").value = l.routeName;
    document.getElementById("climbType").value = l.climbType;
    document.getElementById("gradeSystem").value = l.gradeSystem;
    document.getElementById("grade").value = l.grade;
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

deleteConfirm.addEventListener("click", () => {
    if (!pendingDeleteId) return;
    logs = deleteLog(logs, pendingDeleteId);
    saveLogs(logs);
    pendingDeleteId = null;
    modalBackdrop.classList.add("hidden");
    rerender();
});

form.addEventListener("submit", (e) => {
    e.preventDefault();

    const payload = readForm();
    const errors = validate(payload);
    showErrors(errors);
    if (Object.keys(errors).length) return;

    if (payload.id) {
        logs = updateLog(logs, payload);
    } else {
        payload.id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
        logs = createLog(logs, payload);
    }

    saveLogs(logs);
    setView("list");
    rerender();
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
    if (!p.date) err.date = "Date is required.";
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

    return err;
}

function showErrors(errors) {
    document.querySelectorAll(".error").forEach(el => (el.textContent = ""));
    for (const [k, msg] of Object.entries(errors)) {
        const el = document.querySelector(`[data-err-for="${k}"]`);
        if (el) el.textContent = msg;
    }
}

rerender();
