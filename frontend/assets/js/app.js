import { renderList, renderStats, setView, placeholderSvg } from "./ui.js";
import {
  apiListLogs,
  apiGetLog,
  apiCreateLog,
  apiUpdateLog,
  apiCreateLogForm,
  apiUpdateLogForm,
  apiDeleteLog,
  apiStats,
  apiImageUrl
} from "./api.js";

const PAGE_SIZE = 10;
const DEFAULT_SORT = "date_desc";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/gif"]);

const PAGE_SIZE_COOKIE = "clm_page_size";
const PAGE_SIZE_OPTIONS = new Set([5, 10, 20, 50]);

let pageState = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  items: [],
  query: "",
  filters: {
    envs: [],
    types: [],
    progress: [],
  },
  sort: DEFAULT_SORT,
};

let pendingDeleteId = null;
let removeImageFlag = false;

const tbody = document.getElementById("logsTbody");
const searchInput = document.getElementById("searchInput");
const newBtn = document.getElementById("newBtn");

// Filter + Sort controls (List view)
const filterBtn = document.getElementById("filterBtn");
const filterPanel = document.getElementById("filterPanel");
const filterClearBtn = document.getElementById("filterClearBtn");
const sortSelect = document.getElementById("sortSelect");

// Pager controls
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageIndicator = document.getElementById("pageIndicator");
const pageSizeSelect = document.getElementById("pageSizeSelect");

// Image form controls
const imageFileEl = document.getElementById("imageFile");
const imagePreviewEl = document.getElementById("imagePreview");
const removeImageBtn = document.getElementById("removeImageBtn");

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

// Allowed grade lists
const YDS_GRADES = ["5.2","5.3","5.4","5.5","5.6","5.7","5.8","5.9","5.10","5.11","5.12","5.13","5.14","5.15"];
const V_GRADES = Array.from({ length: 18 }, (_, i) => `V${i}`); // V0..V17

function setGradeOptions({ climbType, gradeSystem, selected = "" }) {
  if (!gradeEl) return;
  const list = gradeSystem === "V" ? V_GRADES : YDS_GRADES;

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

  if (selected && list.includes(selected)) gradeEl.value = selected;
  else gradeEl.value = "";
}

function refreshGradeOptions(keepSelected = false) {
  const climbType = climbTypeEl ? climbTypeEl.value : "";
  const gradeSystem = gradeSystemEl ? gradeSystemEl.value : "";
  const selected = keepSelected && gradeEl ? gradeEl.value : "";

  if (!climbType || !gradeSystem) {
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

if (climbTypeEl) climbTypeEl.addEventListener("change", () => refreshGradeOptions(false));
if (gradeSystemEl) gradeSystemEl.addEventListener("change", () => refreshGradeOptions(false));

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

// ---------------------
// Cookie helpers
// ---------------------
function setCookie(name, value) {
  // Session cookie (no Expires/Max-Age). Refresh normally keeps cookies,
  // but we intentionally reset to default on load to meet the assignment rule.
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const target = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";").map(s => s.trim());
  for (const p of parts) {
    if (p.startsWith(target)) return decodeURIComponent(p.slice(target.length));
  }
  return null;
}

function applyDefaultPageSizeOnLoad() {
  // Requirement: after refresh, return to default page size.
  pageState.pageSize = PAGE_SIZE;

  if (pageSizeSelect) pageSizeSelect.value = String(PAGE_SIZE);

  // Still "stored as a cookie" — we overwrite it to the default on each load.
  setCookie(PAGE_SIZE_COOKIE, PAGE_SIZE);
}

// Tabs
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

// New
newBtn.addEventListener("click", () => {
  form.reset();
  document.getElementById("logId").value = "";
  formTitle.textContent = "Add Log";
  refreshGradeOptions(false);

  // reset image UI
  removeImageFlag = false;
  if (imageFileEl) imageFileEl.value = "";
  if (removeImageBtn) removeImageBtn.classList.add("hidden");
  setImagePreviewPlaceholder();

  setView("form");
});

cancelBtn.addEventListener("click", () => setView("list"));

searchInput.addEventListener("input", async () => {
  pageState.page = 1;
  await rerender();
});

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
}

function canGradeSortFromTypeFilters(types) {
  if (!types || types.length === 0) return false;
  const hasBoulder = types.includes("boulder");
  const hasNonBoulder = types.some(t => t !== "boulder");
  return (hasBoulder && !hasNonBoulder) || (!hasBoulder && hasNonBoulder);
}

function updateSortSelectAvailability() {
  if (!sortSelect) return;

  const types = getCheckedValues("filterType");
  const allowGradeSort = canGradeSortFromTypeFilters(types);

  const gradeAsc = sortSelect.querySelector('option[value="grade_asc"]');
  const gradeDesc = sortSelect.querySelector('option[value="grade_desc"]');
  if (gradeAsc) gradeAsc.disabled = !allowGradeSort;
  if (gradeDesc) gradeDesc.disabled = !allowGradeSort;

  if (!allowGradeSort && (sortSelect.value === "grade_asc" || sortSelect.value === "grade_desc")) {
    sortSelect.value = DEFAULT_SORT;
  }
}

function readControlsIntoState() {
  pageState.query = searchInput.value.trim().toLowerCase();
  pageState.filters.envs = getCheckedValues("filterEnv");
  pageState.filters.types = getCheckedValues("filterType");
  pageState.filters.progress = getCheckedValues("filterProgress");
  pageState.sort = (sortSelect && sortSelect.value) ? sortSelect.value : DEFAULT_SORT;

  updateSortSelectAvailability();
}

function toggleFilterPanel(open) {
  if (!filterPanel) return;
  const shouldOpen = typeof open === "boolean" ? open : filterPanel.classList.contains("hidden");
  if (shouldOpen) {
    filterPanel.classList.remove("hidden");
    filterBtn?.setAttribute("aria-expanded", "true");
  } else {
    filterPanel.classList.add("hidden");
    filterBtn?.setAttribute("aria-expanded", "false");
  }
}

if (filterBtn && filterPanel) {
  filterBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFilterPanel();
  });

  document.addEventListener("click", (e) => {
    if (filterPanel.classList.contains("hidden")) return;
    const target = e.target;
    if (target instanceof Node) {
      const clickedInside = filterPanel.contains(target) || filterBtn.contains(target);
      if (!clickedInside) toggleFilterPanel(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") toggleFilterPanel(false);
  });
}

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLInputElement)) return;
  if (!t.name) return;

  if (t.name === "filterEnv" || t.name === "filterType" || t.name === "filterProgress") {
    pageState.page = 1;
    updateSortSelectAvailability();
    await rerender();
  }
});

if (sortSelect) {
  sortSelect.addEventListener("change", async () => {
    pageState.page = 1;
    await rerender();
  });
}

if (filterClearBtn) {
  filterClearBtn.addEventListener("click", async () => {
    document.querySelectorAll('input[name="filterEnv"], input[name="filterType"], input[name="filterProgress"]').forEach(el => {
      if (el instanceof HTMLInputElement) el.checked = false;
    });
    pageState.page = 1;
    updateSortSelectAvailability();
    await rerender();
  });
}

// ---------------------
// Page size dropdown
// ---------------------
if (pageSizeSelect) {
  pageSizeSelect.addEventListener("change", async () => {
    const raw = pageSizeSelect.value;
    const n = Number(raw);

    if (!Number.isFinite(n) || !PAGE_SIZE_OPTIONS.has(n)) {
      // safety fallback
      pageState.pageSize = PAGE_SIZE;
      pageSizeSelect.value = String(PAGE_SIZE);
      setCookie(PAGE_SIZE_COOKIE, PAGE_SIZE);
    } else {
      pageState.pageSize = n;
      setCookie(PAGE_SIZE_COOKIE, n);
    }

    // UX: changing page size should return you to page 1
    pageState.page = 1;
    await rerender();
  });
}

function setImagePreviewPlaceholder() {
  if (!imagePreviewEl) return;
  imagePreviewEl.innerHTML = placeholderSvg({ title: "No image" });
}

function setImagePreviewUrl(url) {
  if (!imagePreviewEl) return;
  imagePreviewEl.innerHTML = `<img alt="Climb image preview" src="${url}" />`;
  const img = imagePreviewEl.querySelector("img");
  if (img) img.addEventListener("error", () => setImagePreviewPlaceholder());
}

function validateImageClientSide(file) {
  if (!file) return null;
  if (!ALLOWED_MIMES.has(file.type)) return "Invalid image type. Upload a JPG, PNG, or GIF.";
  if (file.size > MAX_IMAGE_BYTES) return "Image is too large. Max size is 5 MB.";
  return null;
}

function buildFormData(payload, { file, removeImage } = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(payload)) fd.append(k, v);
  if (file) fd.append("image", file);
  if (removeImage) fd.append("removeImage", "1");
  return fd;
}

async function rerender() {
  readControlsIntoState();

  const list = await apiListLogs({
    page: pageState.page,
    pageSize: pageState.pageSize,
    q: pageState.query,
    envs: pageState.filters.envs,
    types: pageState.filters.types,
    progress: pageState.filters.progress,
    sort: pageState.sort,
  });

  pageState.items = list.items;
  pageState.total = list.total;
  pageState.page = list.page;

  const totalPages = Math.max(1, Math.ceil(pageState.total / pageState.pageSize));
  if (pageIndicator) pageIndicator.textContent = `Page ${pageState.page} of ${totalPages}`;

  if (prevBtn) prevBtn.disabled = pageState.page <= 1;
  if (nextBtn) nextBtn.disabled = pageState.page >= totalPages;

  renderList(tbody, pageState.items, onEdit, onAskDelete, (id) => apiImageUrl(id));

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

  setGradeOptions({ climbType: l.climbType, gradeSystem: l.gradeSystem, selected: l.grade });

  document.getElementById("progress").value = l.progress;

  // Image edit UI
  removeImageFlag = false;
  if (imageFileEl) imageFileEl.value = "";

  if (l.hasImage) {
    setImagePreviewUrl(apiImageUrl(l.id));
    removeImageBtn?.classList.remove("hidden");
  } else {
    setImagePreviewPlaceholder();
    removeImageBtn?.classList.add("hidden");
  }

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

  const maxPage = Math.max(1, Math.ceil((pageState.total - 1) / pageState.pageSize));
  pageState.page = Math.min(pageState.page, maxPage);

  await rerender();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = readForm();
  const errors = validate(payload);

  // Client-side image validation
  const file = imageFileEl?.files && imageFileEl.files[0] ? imageFileEl.files[0] : null;
  const imgErr = validateImageClientSide(file);
  if (imgErr) errors.image = imgErr;

  showErrors(errors);
  if (Object.keys(errors).length) return;

  try {
    // Use multipart always (so optional image can be included)
    const fd = buildFormData(payload, { file, removeImage: removeImageFlag });

    if (payload.id) await apiUpdateLogForm(payload.id, fd);
    else await apiCreateLogForm(fd);

    setView("list");
    await rerender();
  } catch (err) {
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
  if (!p.date) err.date = "Date is required.";
  else {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;
    if (p.date > todayStr) err.date = "Date cannot be in the future.";
  }

  if (!p.environment) err.environment = "Environment is required.";
  if (!p.location) err.location = "Location is required.";
  if (!p.routeName) err.routeName = "Route name is required.";
  if (!p.climbType) err.climbType = "Climb type is required.";
  if (!p.gradeSystem) err.gradeSystem = "Grade system is required.";
  if (!p.grade) err.grade = "Grade is required.";
  if (!p.progress) err.progress = "Progress is required.";

  if (p.climbType === "boulder" && p.gradeSystem && p.gradeSystem !== "V") {
    err.gradeSystem = "Bouldering should use V-Scale.";
  }
  if (p.climbType !== "boulder" && p.gradeSystem && p.gradeSystem !== "YDS") {
    err.gradeSystem = "Roped climbs should use YDS.";
  }

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

// Image events
if (imageFileEl) {
  imageFileEl.addEventListener("change", () => {
    // picking a new file cancels any pending remove
    removeImageFlag = false;

    const file = imageFileEl.files && imageFileEl.files[0] ? imageFileEl.files[0] : null;
    const err = validateImageClientSide(file);
    if (err) {
      showErrors({ image: err });
      imageFileEl.value = "";
      setImagePreviewPlaceholder();
      removeImageBtn?.classList.add("hidden");
      return;
    }

    // Clear any previous image error
    const imgErrEl = document.querySelector('[data-err-for="image"]');
    if (imgErrEl) imgErrEl.textContent = "";

    if (!file) {
      setImagePreviewPlaceholder();
      removeImageBtn?.classList.add("hidden");
      return;
    }

    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
    removeImageBtn?.classList.add("hidden");
  });
}

if (removeImageBtn) {
  removeImageBtn.addEventListener("click", () => {
    removeImageFlag = true;
    if (imageFileEl) imageFileEl.value = "";
    setImagePreviewPlaceholder();
    removeImageBtn.classList.add("hidden");
  });
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

updateSortSelectAvailability();
setImagePreviewPlaceholder();

// Requirement: refresh returns to default page size
applyDefaultPageSizeOnLoad();

rerender();