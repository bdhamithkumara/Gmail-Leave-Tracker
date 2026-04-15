/**
 * popup.js — Controls the popup UI for Gmail Leave Tracker
 *
 * Responsibilities:
 *   1. Load cached leave count + last refreshed time from storage
 *   2. Handle "Refresh" button clicks
 *   3. Open Options page when settings button is clicked
 *   4. Display loading / error / result states
 */

// ─── DOM References ──────────────────────────────────────────────────────────

const leaveCountEl     = document.getElementById("leave-count");
const lastRefreshedEl  = document.getElementById("last-refreshed");
const refreshBtn       = document.getElementById("refresh-btn");
const refreshIcon      = document.getElementById("refresh-icon");
const optionsBtn       = document.getElementById("options-btn");
const loadingState     = document.getElementById("loading-state");
const errorState       = document.getElementById("error-state");
const resultState      = document.getElementById("result-state");
const errorMessageEl   = document.getElementById("error-message");

// ─── Initialize ──────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  loadCachedData();

  refreshBtn.addEventListener("click", handleRefresh);
  optionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});

// ─── Load Cached Data ────────────────────────────────────────────────────────

/**
 * Reads the last known count and refresh time from chrome.storage.local
 * and renders it immediately (so the popup never feels empty).
 */
function loadCachedData() {
  chrome.storage.local.get(["leaveCount", "lastRefreshed"], (data) => {
    if (data.leaveCount !== undefined && data.leaveCount !== null) {
      showResult(data.leaveCount, data.lastRefreshed);
    }
  });
}

// ─── Refresh Handler ─────────────────────────────────────────────────────────

async function handleRefresh() {
  showLoading();

  chrome.runtime.sendMessage({ action: "refresh" }, (response) => {
    if (chrome.runtime.lastError) {
      showError("Could not connect to background service.");
      return;
    }

    if (response && response.success) {
      // Reload from storage to get the freshest data
      chrome.storage.local.get(["leaveCount", "lastRefreshed"], (data) => {
        showResult(data.leaveCount, data.lastRefreshed);
      });
    } else {
      const msg = response?.error || "Unknown error occurred.";
      showError(msg);
    }
  });
}

// ─── UI State Helpers ────────────────────────────────────────────────────────

function showLoading() {
  loadingState.classList.add("active");
  resultState.classList.remove("active");
  errorState.classList.remove("active");
  refreshBtn.disabled = true;
  refreshIcon.classList.add("spin");
}

function showResult(count, lastRefreshed) {
  loadingState.classList.remove("active");
  errorState.classList.remove("active");
  resultState.classList.add("active");
  refreshBtn.disabled = false;
  refreshIcon.classList.remove("spin");

  leaveCountEl.textContent = count;
  leaveCountEl.classList.remove("count-animate");
  void leaveCountEl.offsetWidth;
  leaveCountEl.classList.add("count-animate");

  if (lastRefreshed) {
    const date = new Date(lastRefreshed);
    const formatted = date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
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
