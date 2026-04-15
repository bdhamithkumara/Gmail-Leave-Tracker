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
    emptySubjectsEl.classList.add("visible");
    return;
  }

  emptySubjectsEl.classList.remove("visible");

  subjects.forEach((subject, index) => {
    subjectListEl.appendChild(createListItem(subject, index, "subject"));
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
  wrapper.className = "item";

  // Number badge
  const badge = document.createElement("span");
  badge.className = "item-num";
  badge.textContent = index + 1;

  // Editable input
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.className = "item-input";
  input.addEventListener("input", () => {
    if (type === "subject") subjects[index] = input.value;
    else senders[index] = input.value;
  });

  // Delete button
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "item-delete";
  deleteBtn.title = "Delete";
  deleteBtn.innerHTML = `
    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>
  `;
  deleteBtn.addEventListener("click", () => {
    if (type === "subject") { subjects.splice(index, 1); renderSubjects(); }
    else { senders.splice(index, 1); renderSenders(); }
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
    input.classList.add("shake");
    setTimeout(() => input.classList.remove("shake"), 700);
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
  const icon = document.getElementById("toast-icon");
  if (type === "warning") {
    icon.style.color = "#fbbf24";
  } else {
    icon.style.color = "#34d399";
  }

  toast.style.display = "block";
  toast.firstElementChild.classList.remove("toast-out");
  toast.firstElementChild.classList.add("toast-in");

  setTimeout(() => {
    toast.firstElementChild.classList.remove("toast-in");
    toast.firstElementChild.classList.add("toast-out");
    setTimeout(() => { toast.style.display = "none"; }, 300);
  }, 2500);
}
