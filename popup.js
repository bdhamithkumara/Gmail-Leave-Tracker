/**
 * popup.js — Controls the popup UI for Gmail Leave Tracker
 *
 * Now shows: total days + breakdown by leave type (Full / Half / Sick)
 */

// ─── DOM References ───────────────────────────────────────────────────────────

const leaveCountEl    = document.getElementById("leave-count");
const fullCountEl     = document.getElementById("full-count");
const halfCountEl     = document.getElementById("half-count");
const sickCountEl     = document.getElementById("sick-count");
const lastRefreshedEl = document.getElementById("last-refreshed");
const refreshBtn      = document.getElementById("refresh-btn");
const refreshIcon     = document.getElementById("refresh-icon");
const optionsBtn      = document.getElementById("options-btn");
const loadingState    = document.getElementById("loading-state");
const errorState      = document.getElementById("error-state");
const resultState     = document.getElementById("result-state");
const errorMessageEl  = document.getElementById("error-message");

// ─── Initialize ───────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  loadCachedData();
  refreshBtn.addEventListener("click", handleRefresh);
  optionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
});

// ─── Load Cached Data ─────────────────────────────────────────────────────────

function loadCachedData() {
  chrome.storage.local.get(
    ["totalDays", "fullCount", "halfCount", "sickCount", "lastRefreshed"],
    (data) => {
      if (data.totalDays !== undefined && data.totalDays !== null) {
        showResult(data);
      }
    }
  );
}

// ─── Refresh Handler ──────────────────────────────────────────────────────────

function handleRefresh() {
  showLoading();

  chrome.runtime.sendMessage({ action: "refresh" }, (response) => {
    if (chrome.runtime.lastError) {
      showError("Could not connect to background service.");
      return;
    }

    if (response && response.success) {
      // Re-read from storage for the freshest snapshot
      chrome.storage.local.get(
        ["totalDays", "fullCount", "halfCount", "sickCount", "lastRefreshed"],
        (data) => showResult(data)
      );
    } else {
      showError(response?.error || "Unknown error occurred.");
    }
  });
}

// ─── UI State Helpers ─────────────────────────────────────────────────────────

function showLoading() {
  loadingState.classList.add("active");
  resultState.classList.remove("active");
  errorState.classList.remove("active");
  refreshBtn.disabled = true;
  refreshIcon.classList.add("spin");
}

function showResult(data) {
  const { totalDays = 0, fullCount = 0, halfCount = 0, sickCount = 0, lastRefreshed } = data;

  loadingState.classList.remove("active");
  errorState.classList.remove("active");
  resultState.classList.add("active");
  refreshBtn.disabled = false;
  refreshIcon.classList.remove("spin");

  // Animate the main count
  // Show totalDays: if it's a whole number show as integer, else show 1 decimal
  const displayTotal = Number.isInteger(totalDays)
    ? String(totalDays)
    : totalDays.toFixed(1);

  leaveCountEl.textContent = displayTotal;
  leaveCountEl.classList.remove("count-animate");
  void leaveCountEl.offsetWidth; // force reflow
  leaveCountEl.classList.add("count-animate");

  // Breakdown counts (show number of emails/occurrences)
  fullCountEl.textContent = fullCount;
  halfCountEl.textContent = halfCount;
  sickCountEl.textContent = sickCount;

  // Last refreshed
  if (lastRefreshed) {
    const date = new Date(lastRefreshed);
    const formatted = date.toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
    lastRefreshedEl.textContent = `Last refreshed: ${formatted}`;
  } else {
    lastRefreshedEl.textContent = "Not yet refreshed";
  }
}

function showError(message) {
  loadingState.classList.remove("active");
  resultState.classList.remove("active");
  errorState.classList.add("active");
  refreshBtn.disabled = false;
  refreshIcon.classList.remove("spin");
  errorMessageEl.textContent = message;
}
