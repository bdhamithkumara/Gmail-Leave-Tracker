/**
 * background.js — Service Worker for Gmail Leave Tracker
 *
 * Responsibilities:
 *   1. Set default subjects + sender filters on first install
 *   2. Authenticate with Gmail API via chrome.identity
 *   3. Search Gmail for leave-approval emails matching the configured subjects
 *   4. Update badge count on the extension icon
 *   5. Respond to messages from popup.js (refresh requests)
 */

// ─── Default Configuration ────────────────────────────────────────────────────

const DEFAULT_SUBJECTS = [
  "Leave Approved",
  "Annual Leave Granted",
  "Leave Request Approved",
  "Your leave is approved",
  "Casual Leave Approved",
  "Sick Leave Approved"
];

const DEFAULT_SENDERS = []; // e.g. ["hr@company.com", "manager@company.com"]

// ─── Install Handler ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Seed storage with defaults on very first install
    chrome.storage.local.set({
      subjects: DEFAULT_SUBJECTS,
      senders: DEFAULT_SENDERS,
      leaveCount: 0,
      lastRefreshed: null
    }, () => {
      console.log("[Leave Tracker] Defaults saved on first install.");
      // Kick off an initial scan
      fetchLeaveCount();
    });
  }
});

// ─── Message Listener (from popup) ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "refresh") {
    fetchLeaveCount()
      .then((count) => sendResponse({ success: true, count }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    // Return true to indicate we'll respond asynchronously
    return true;
  }
});

// ─── Core: Fetch Leave Count ─────────────────────────────────────────────────

/**
 * Main function that:
 *   1. Reads subjects & senders from storage
 *   2. Builds a Gmail search query
 *   3. Authenticates and calls Gmail API
 *   4. Counts results and updates storage + badge
 */
async function fetchLeaveCount() {
  // 1. Read config from storage
  const { subjects, senders } = await getFromStorage(["subjects", "senders"]);

  if (!subjects || subjects.length === 0) {
    console.warn("[Leave Tracker] No subjects configured.");
    updateBadge(0);
    return 0;
  }

  // 2. Build the Gmail search query
  const query = buildGmailQuery(subjects, senders || []);
  console.log("[Leave Tracker] Gmail query:", query);

  // 3. Get auth token
  const token = await getAuthToken();

  // 4. Fetch ALL matching message IDs (handles pagination)
  const messageIds = await fetchAllMessageIds(token, query);
  const count = messageIds.length;

  // 5. Persist results
  await setToStorage({
    leaveCount: count,
    lastRefreshed: new Date().toISOString()
  });

  // 6. Update badge
  updateBadge(count);

  console.log(`[Leave Tracker] Found ${count} leave email(s) this year.`);
  return count;
}

// ─── Gmail Query Builder ─────────────────────────────────────────────────────

/**
 * Builds a Gmail search query string.
 *
 * Example output:
 *   subject:(Leave Approved OR Annual Leave Granted) after:2026/01/01 before:2027/01/01
 *   from:(hr@company.com OR manager@company.com)
 */
function buildGmailQuery(subjects, senders) {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  // Wrap each subject in quotes so multi-word subjects match exactly
  const subjectPart = subjects
    .map((s) => `"${s}"`)
    .join(" OR ");

  let query = `subject:(${subjectPart}) after:${currentYear}/01/01 before:${nextYear}/01/01`;

  // Optional sender filter
  if (senders.length > 0) {
    const senderPart = senders.join(" OR ");
    query += ` from:(${senderPart})`;
  }

  return query;
}

// ─── Gmail API Helpers ───────────────────────────────────────────────────────

/**
 * Fetches ALL message IDs matching the query, handling Gmail's pagination.
 * Gmail returns max 100 results per page with a nextPageToken.
 */
async function fetchAllMessageIds(token, query) {
  let allMessages = [];
  let pageToken = null;

  do {
    const url = buildApiUrl(query, pageToken);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
      // Token expired — remove cached token and retry once
      console.warn("[Leave Tracker] Token expired, refreshing...");
      await removeCachedToken(token);
      const newToken = await getAuthToken();
      return fetchAllMessageIds(newToken, query);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gmail API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();

    if (data.messages) {
      allMessages = allMessages.concat(data.messages);
    }

    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return allMessages;
}

/**
 * Builds the Gmail API list URL with query and optional page token.
 */
function buildApiUrl(query, pageToken) {
  const base = "https://www.googleapis.com/gmail/v1/users/me/messages";
  const params = new URLSearchParams({
    q: query,
    maxResults: "100"
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  return `${base}?${params.toString()}`;
}

// ─── Auth Helpers ────────────────────────────────────────────────────────────

/**
 * Gets an OAuth2 token using chrome.identity.
 * Wraps the callback API in a Promise for async/await usage.
 */
function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Removes a cached token so chrome.identity fetches a fresh one next time.
 */
function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

// ─── Badge ───────────────────────────────────────────────────────────────────

/**
 * Updates the extension icon badge with the leave count.
 */
function updateBadge(count) {
  const text = count > 0 ? String(count) : "";
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: "#6366f1" }); // indigo-500
}

// ─── Storage Helpers ─────────────────────────────────────────────────────────

function getFromStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function setToStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}
