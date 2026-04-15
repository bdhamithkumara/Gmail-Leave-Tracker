/**
 * options.js — Controls the Settings page for Gmail Leave Tracker
 *
 * subjects is now an array of objects: { text: string, type: "full"|"half"|"sick" }
 * senders is still an array of plain strings.
 */

// ─── DOM References ───────────────────────────────────────────────────────────

const subjectListEl    = document.getElementById("subject-list");
const senderListEl     = document.getElementById("sender-list");
const emptySubjectsEl  = document.getElementById("empty-subjects");
const emptySendersEl   = document.getElementById("empty-senders");
const newSubjectInput  = document.getElementById("new-subject-input");
const newSubjectType   = document.getElementById("new-subject-type");
const newSenderInput   = document.getElementById("new-sender-input");
const addSubjectBtn    = document.getElementById("add-subject-btn");
const addSenderBtn     = document.getElementById("add-sender-btn");
const saveBtn          = document.getElementById("save-btn");
const toast            = document.getElementById("toast");
const toastMessage     = document.getElementById("toast-message");

// ─── In-Memory State ─────────────────────────────────────────────────────────

let subjects = []; // [{text, type}]
let senders  = []; // [string]

// ─── Initialize ───────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  addSubjectBtn.addEventListener("click", () => addSubject());
  addSenderBtn.addEventListener("click",  () => addSender());

  newSubjectInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addSubject(); });
  newSenderInput.addEventListener("keydown",  (e) => { if (e.key === "Enter") addSender(); });

  saveBtn.addEventListener("click", saveSettings);
});

// ─── Load ─────────────────────────────────────────────────────────────────────

function loadSettings() {
  chrome.storage.local.get(["subjects", "senders"], (data) => {
    // Migrate old string[] subjects to object[] format if needed
    const raw = data.subjects || [];
    subjects = raw.map((s) =>
      typeof s === "string" ? { text: s, type: "full" } : s
    );
    senders = data.senders || [];
    renderSubjects();
    renderSenders();
  });
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderSubjects() {
  subjectListEl.innerHTML = "";
  if (subjects.length === 0) {
    emptySubjectsEl.classList.add("visible");
    return;
  }
  emptySubjectsEl.classList.remove("visible");
  subjects.forEach((subject, index) => {
    subjectListEl.appendChild(createSubjectItem(subject, index));
  });
}

function renderSenders() {
  senderListEl.innerHTML = "";
  if (senders.length === 0) {
    emptySendersEl.classList.add("visible");
    return;
  }
  emptySendersEl.classList.remove("visible");
  senders.forEach((sender, index) => {
    senderListEl.appendChild(createSenderItem(sender, index));
  });
}

// ─── Create Subject Item (with type dropdown) ─────────────────────────────────

function createSubjectItem(subject, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "item";

  // Number badge
  const badge = document.createElement("span");
  badge.className = "item-num";
  badge.textContent = index + 1;

  // Text input
  const input = document.createElement("input");
  input.type  = "text";
  input.value = subject.text;
  input.className = "item-input";
  input.addEventListener("input", () => {
    subjects[index] = { ...subjects[index], text: input.value };
  });

  // Type dropdown
  const typeSelect = document.createElement("select");
  typeSelect.className = `type-select-item ${subject.type || "full"}`;
  [
    { value: "full", label: "📅 Full Day"  },
    { value: "half", label: "🌤 Half Day"  },
    { value: "sick", label: "🤒 Sick Leave" }
  ].forEach(({ value, label }) => {
    const opt = document.createElement("option");
    opt.value    = value;
    opt.textContent = label;
    if (value === (subject.type || "full")) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.addEventListener("change", () => {
    subjects[index] = { ...subjects[index], type: typeSelect.value };
    // Update colour class
    typeSelect.className = `type-select-item ${typeSelect.value}`;
  });

  // Delete button
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "item-delete";
  deleteBtn.title = "Delete";
  deleteBtn.innerHTML = `
    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>`;
  deleteBtn.addEventListener("click", () => {
    subjects.splice(index, 1);
    renderSubjects();
  });

  wrapper.appendChild(badge);
  wrapper.appendChild(input);
  wrapper.appendChild(typeSelect);
  wrapper.appendChild(deleteBtn);
  return wrapper;
}

// ─── Create Sender Item ───────────────────────────────────────────────────────

function createSenderItem(sender, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "item";

  const badge = document.createElement("span");
  badge.className = "item-num";
  badge.textContent = index + 1;

  const input = document.createElement("input");
  input.type  = "text";
  input.value = sender;
  input.className = "item-input";
  input.addEventListener("input", () => { senders[index] = input.value; });

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "item-delete";
  deleteBtn.title = "Delete";
  deleteBtn.innerHTML = `
    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>`;
  deleteBtn.addEventListener("click", () => {
    senders.splice(index, 1);
    renderSenders();
  });

  wrapper.appendChild(badge);
  wrapper.appendChild(input);
  wrapper.appendChild(deleteBtn);
  return wrapper;
}

// ─── Add Helpers ──────────────────────────────────────────────────────────────

function addSubject() {
  const text = newSubjectInput.value.trim();
  const type = newSubjectType.value;

  if (!text) {
    newSubjectInput.classList.add("shake");
    newSubjectInput.focus();
    setTimeout(() => newSubjectInput.classList.remove("shake"), 700);
    return;
  }

  // Duplicate check (by text, case-insensitive)
  if (subjects.some((s) => s.text.toLowerCase() === text.toLowerCase())) {
    showToast("This keyword already exists!", "warning");
    newSubjectInput.focus();
    return;
  }

  subjects.push({ text, type });
  renderSubjects();
  newSubjectInput.value = "";
  newSubjectInput.focus();
}

function addSender() {
  const value = newSenderInput.value.trim();

  if (!value) {
    newSenderInput.classList.add("shake");
    newSenderInput.focus();
    setTimeout(() => newSenderInput.classList.remove("shake"), 700);
    return;
  }

  if (senders.some((s) => s.toLowerCase() === value.toLowerCase())) {
    showToast("This sender already exists!", "warning");
    newSenderInput.focus();
    return;
  }

  senders.push(value);
  renderSenders();
  newSenderInput.value = "";
  newSenderInput.focus();
}

// ─── Save ─────────────────────────────────────────────────────────────────────

function saveSettings() {
  const cleanSubjects = subjects
    .map((s) => ({ text: s.text.trim(), type: s.type || "full" }))
    .filter((s) => s.text.length > 0);

  const cleanSenders = senders.map((s) => s.trim()).filter(Boolean);

  chrome.storage.local.set({ subjects: cleanSubjects, senders: cleanSenders }, () => {
    subjects = cleanSubjects;
    senders  = cleanSenders;
    renderSubjects();
    renderSenders();
    showToast("Settings saved successfully!");
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message, type = "success") {
  toastMessage.textContent = message;

  const icon = document.getElementById("toast-icon");
  icon.style.color = type === "warning" ? "#fbbf24" : "#34d399";

  toast.style.display = "block";
  toast.firstElementChild.classList.remove("toast-out");
  toast.firstElementChild.classList.add("toast-in");

  setTimeout(() => {
    toast.firstElementChild.classList.remove("toast-in");
    toast.firstElementChild.classList.add("toast-out");
    setTimeout(() => { toast.style.display = "none"; }, 280);
  }, 2500);
}
