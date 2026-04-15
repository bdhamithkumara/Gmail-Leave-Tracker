/**
 * options.js — Controls the Options (Settings) page for Gmail Leave Tracker
 *
 * Responsibilities:
 *   1. Load saved subjects & senders from chrome.storage.local
 *   2. Render editable lists for both
 *   3. Handle add / edit / delete for each list
 *   4. Save changes back to storage on "Save" click
 */

// ─── DOM References ──────────────────────────────────────────────────────────

const subjectListEl     = document.getElementById("subject-list");
const senderListEl      = document.getElementById("sender-list");
const emptySubjectsEl   = document.getElementById("empty-subjects");
const emptySendersEl    = document.getElementById("empty-senders");
const newSubjectInput   = document.getElementById("new-subject-input");
const newSenderInput    = document.getElementById("new-sender-input");
const addSubjectBtn     = document.getElementById("add-subject-btn");
const addSenderBtn      = document.getElementById("add-sender-btn");
const saveBtn           = document.getElementById("save-btn");
const toast             = document.getElementById("toast");
const toastMessage      = document.getElementById("toast-message");

// ─── In-Memory State ─────────────────────────────────────────────────────────
// We keep the lists in memory and only persist on "Save".

let subjects = [];
let senders  = [];

// ─── Initialize ──────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  addSubjectBtn.addEventListener("click", () => addItem("subject"));
  addSenderBtn.addEventListener("click",  () => addItem("sender"));

  // Allow Enter key to add items
  newSubjectInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addItem("subject");
  });
  newSenderInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addItem("sender");
  });

  saveBtn.addEventListener("click", saveSettings);
});

// ─── Load Settings ───────────────────────────────────────────────────────────

function loadSettings() {
  chrome.storage.local.get(["subjects", "senders"], (data) => {
    subjects = data.subjects || [];
    senders  = data.senders  || [];
    renderSubjects();
    renderSenders();
  });
}

// ─── Render Lists ────────────────────────────────────────────────────────────

function renderSubjects() {
  subjectListEl.innerHTML = "";

  if (subjects.length === 0) {
    emptySubjectsEl.classList.remove("hidden");
    return;
  }

  emptySubjectsEl.classList.add("hidden");

  subjects.forEach((subject, index) => {
    subjectListEl.appendChild(createListItem(subject, index, "subject"));
  });
}

function renderSenders() {
  senderListEl.innerHTML = "";

  if (senders.length === 0) {
    emptySendersEl.classList.remove("hidden");
    return;
  }

  emptySendersEl.classList.add("hidden");

  senders.forEach((sender, index) => {
    senderListEl.appendChild(createListItem(sender, index, "sender"));
  });
}

// ─── Create List Item ────────────────────────────────────────────────────────

/**
 * Creates a styled list item with an inline-editable input, and delete button.
 *
 * @param {string} value   - The current text value
 * @param {number} index   - Position in the array
 * @param {string} type    - "subject" or "sender"
 * @returns {HTMLElement}
 */
function createListItem(value, index, type) {
  const wrapper = document.createElement("div");
  wrapper.className = "flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 fade-in group hover:border-slate-300 transition-all";

  // Drag handle / number indicator
  const badge = document.createElement("span");
  badge.className = "flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold shrink-0";
  badge.textContent = index + 1;

  // Editable input
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.className = "flex-1 bg-transparent text-sm text-slate-700 focus:outline-none focus:text-slate-900 transition-colors";
  input.addEventListener("input", () => {
    if (type === "subject") {
      subjects[index] = input.value;
    } else {
      senders[index] = input.value;
    }
  });

  // Delete button
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all duration-200 shrink-0 focus:outline-none";
  deleteBtn.innerHTML = `
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>
  `;
  deleteBtn.title = "Delete";
  deleteBtn.addEventListener("click", () => {
    if (type === "subject") {
      subjects.splice(index, 1);
      renderSubjects();
    } else {
      senders.splice(index, 1);
      renderSenders();
    }
  });

  wrapper.appendChild(badge);
  wrapper.appendChild(input);
  wrapper.appendChild(deleteBtn);

  return wrapper;
}

// ─── Add Item ────────────────────────────────────────────────────────────────

function addItem(type) {
  const input = type === "subject" ? newSubjectInput : newSenderInput;
  const value = input.value.trim();

  if (!value) {
    input.focus();
    // Brief shake animation
    input.classList.add("ring-2", "ring-red-300");
    setTimeout(() => input.classList.remove("ring-2", "ring-red-300"), 600);
    return;
  }

  // Check for duplicates
  const list = type === "subject" ? subjects : senders;
  if (list.some((item) => item.toLowerCase() === value.toLowerCase())) {
    showToast("This item already exists!", "warning");
    input.focus();
    return;
  }

  if (type === "subject") {
    subjects.push(value);
    renderSubjects();
  } else {
    senders.push(value);
    renderSenders();
  }

  input.value = "";
  input.focus();
}

// ─── Save Settings ───────────────────────────────────────────────────────────

function saveSettings() {
  // Filter out empty strings
  const cleanSubjects = subjects.map((s) => s.trim()).filter(Boolean);
  const cleanSenders  = senders.map((s) => s.trim()).filter(Boolean);

  chrome.storage.local.set(
    { subjects: cleanSubjects, senders: cleanSenders },
    () => {
      subjects = cleanSubjects;
      senders  = cleanSenders;
      renderSubjects();
      renderSenders();
      showToast("Settings saved successfully!");
    }
  );
}

// ─── Toast Notification ──────────────────────────────────────────────────────

function showToast(message, type = "success") {
  toastMessage.textContent = message;

  // Swap icon color based on type
  const icon = toast.querySelector("svg");
  if (type === "warning") {
    icon.classList.remove("text-emerald-400");
    icon.classList.add("text-amber-400");
  } else {
    icon.classList.remove("text-amber-400");
    icon.classList.add("text-emerald-400");
  }

  toast.classList.remove("hidden");
  toast.firstElementChild.classList.remove("toast-out");
  toast.firstElementChild.classList.add("toast-in");

  // Auto-hide after 2.5 seconds
  setTimeout(() => {
    toast.firstElementChild.classList.remove("toast-in");
    toast.firstElementChild.classList.add("toast-out");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 2500);
}
