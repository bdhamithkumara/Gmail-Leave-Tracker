/**
 * background.js — Service Worker for Gmail Leave Tracker
 *
 * Responsibilities:
 *   1. Set default subjects (with leave types) on first install
 *   2. Authenticate with Gmail API via chrome.identity
 *   3. Search Gmail per leave type group (full / half / sick)
 *   4. Compute total days: full×1 + half×0.5 + sick×1
 *   5. Update badge count on the extension icon
 *   6. Respond to messages from popup.js (refresh requests)
 */

// ─── Default Configuration ────────────────────────────────────────────────────

/**
 * Each subject has:
 *   text — the email subject string to search for
 *   type — "full" (1 day) | "half" (0.5 day) | "sick" (1 day, tracked separately)
 */
const DEFAULT_SUBJECTS = [
  { text: "Leave Approved",          type: "full" },
  { text: "Annual Leave Granted",    type: "full" },
  { text: "Leave Request Approved",  type: "full" },
  { text: "Your leave is approved",  type: "full" },
  { text: "Casual Leave Approved",   type: "full" },
  { text: "Sick Leave Approved",     type: "sick" }
];

const DEFAULT_SENDERS = []; // e.g. ["hr@company.com"]

// Day values per type
const TYPE_DAYS = { full: 1, half: 0.5, sick: 1 };

// ─── Install Handler ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({
      subjects:      DEFAULT_SUBJECTS,
      senders:       DEFAULT_SENDERS,
      fullCount:     0,
      halfCount:     0,
      sickCount:     0,
      totalDays:     0,
      lastRefreshed: null
    }, () => {
      console.log("[Leave Tracker] Defaults saved on first install.");
      fetchLeaveCount();
    });
  }
});

// ─── Message Listener (from popup) ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "refresh") {
    fetchLeaveCount()
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err)  => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }
});

// ─── Core: Fetch Leave Count ─────────────────────────────────────────────────

/**
 * Groups subjects by type, runs one Gmail query per group,
 * then calculates total days and stores everything.
 *
 * CONFLICT RESOLUTION — Priority: sick > half > full
 *
 * Gmail's subject search is substring-based, so a broad keyword like
 * "Leave Request" would accidentally match emails that also contain
 * "Half Day Leave Request". To prevent an email being counted twice,
 * each group's query explicitly EXCLUDES subjects belonging to
 * higher-priority groups using Gmail's -subject:(...) operator.
 *
 * Example:
 *   sick  query: subject:("Sick Leave Approved")
 *   half  query: subject:("Half Day Leave Request") -subject:("Sick Leave Approved")
 *   full  query: subject:("Leave Request") -subject:("Half Day Leave Request" OR "Sick Leave Approved")
 *
 * This guarantees every email is counted in exactly ONE type.
 */
async function fetchLeaveCount() {
  const { subjects, senders } = await getFromStorage(["subjects", "senders"]);

  if (!subjects || subjects.length === 0) {
    const empty = { fullCount: 0, halfCount: 0, sickCount: 0, totalDays: 0 };
    await setToStorage({ ...empty, lastRefreshed: new Date().toISOString() });
    updateBadge(0);
    return empty;
  }

  const groups = groupSubjectsByType(subjects);
  console.log("[Leave Tracker] Subject groups:", groups);

  const token = await getAuthToken();
  const currentYear = new Date().getFullYear();
  const safeSenders = senders || [];

  let fullCount = 0, halfCount = 0, sickCount = 0;

  // ── Sick (highest priority — no exclusions needed) ──
  if (groups.sick.length > 0) {
    const q = buildGmailQuery(groups.sick, safeSenders, currentYear, []);
    console.log("[Leave Tracker] Sick-leave query:", q);
    sickCount = (await fetchAllMessageIds(token, q)).length;
  }

  // ── Half (exclude sick subjects so they don't overlap) ──
  if (groups.half.length > 0) {
    const excludes = [...groups.sick];
    const q = buildGmailQuery(groups.half, safeSenders, currentYear, excludes);
    console.log("[Leave Tracker] Half-day query:", q);
    halfCount = (await fetchAllMessageIds(token, q)).length;
  }

  // ── Full (exclude sick + half subjects — lowest priority) ──
  if (groups.full.length > 0) {
    const excludes = [...groups.sick, ...groups.half];
    const q = buildGmailQuery(groups.full, safeSenders, currentYear, excludes);
    console.log("[Leave Tracker] Full-day query:", q);
    fullCount = (await fetchAllMessageIds(token, q)).length;
  }

  const totalDays = (fullCount * TYPE_DAYS.full)
                  + (halfCount * TYPE_DAYS.half)
                  + (sickCount * TYPE_DAYS.sick);

  const result = { fullCount, halfCount, sickCount, totalDays };
  await setToStorage({ ...result, lastRefreshed: new Date().toISOString() });
  updateBadge(totalDays);

  console.log("[Leave Tracker] Result:", result);
  return result;
}

// ─── Group Helper ─────────────────────────────────────────────────────────────

/**
 * Takes the subjects array and returns { full: [], half: [], sick: [] }
 * Each value is an array of subject TEXT strings.
 */
function groupSubjectsByType(subjects) {
  const groups = { full: [], half: [], sick: [] };
  for (const s of subjects) {
    const type = s.type || "full";
    if (groups[type]) groups[type].push(s.text);
  }
  return groups;
}

// ─── Gmail Query Builder ─────────────────────────────────────────────────────

/**
 * Builds a Gmail search query for a given array of subject strings,
 * with optional exclusions to prevent double-counting across type groups.
 *
 * @param {string[]} subjectTexts  — subjects to match
 * @param {string[]} senders       — optional sender filter
 * @param {number}   year          — current calendar year
 * @param {string[]} excludeTexts  — subjects to EXCLUDE (from higher-priority groups)
 *
 * Example output:
 *   subject:("Leave Request") -subject:("Half Day Leave Request" OR "Sick Leave Approved")
 *   after:2026/01/01 before:2027/01/01
 */
function buildGmailQuery(subjectTexts, senders, year, excludeTexts = []) {
  const nextYear = year + 1;
  const subjectPart = subjectTexts.map((s) => `"${s}"`).join(" OR ");
  let query = `subject:(${subjectPart}) after:${year}/01/01 before:${nextYear}/01/01`;

  // Exclude subjects from higher-priority groups to prevent double-counting
  if (excludeTexts.length > 0) {
    const excludePart = excludeTexts.map((s) => `"${s}"`).join(" OR ");
    query += ` -subject:(${excludePart})`;
  }

  if (senders.length > 0) {
    query += ` from:(${senders.join(" OR ")})`;
  }

  return query;
}

// ─── Gmail API Helpers ────────────────────────────────────────────────────────

async function fetchAllMessageIds(token, query) {
  let allMessages = [];
  let pageToken   = null;

  do {
    const url = buildApiUrl(query, pageToken);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
      console.warn("[Leave Tracker] Token expired — refreshing...");
      await removeCachedToken(token);
      const newToken = await getAuthToken();
      return fetchAllMessageIds(newToken, query);
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gmail API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    if (data.messages) allMessages = allMessages.concat(data.messages);
    pageToken = data.nextPageToken || null;

  } while (pageToken);

  return allMessages;
}

function buildApiUrl(query, pageToken) {
  const base   = "https://www.googleapis.com/gmail/v1/users/me/messages";
  const params = new URLSearchParams({ q: query, maxResults: "500" });
  if (pageToken) params.set("pageToken", pageToken);
  return `${base}?${params.toString()}`;
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(token);
    });
  });
}

function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function updateBadge(totalDays) {
  // Show as integer if whole number, otherwise show with .5
  const text = totalDays > 0
    ? (Number.isInteger(totalDays) ? String(totalDays) : String(totalDays))
    : "";
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
}

// ─── Storage Helpers ──────────────────────────────────────────────────────────

function getFromStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function setToStorage(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}
