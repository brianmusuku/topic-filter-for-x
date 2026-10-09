// Background service worker.
//
// The content script can't call api.typesafe.ai directly: x.com's
// Content-Security-Policy blocks requests to other origins. The worker makes
// the call instead, and also keeps the API key out of the page's reach.

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";
const RETRYABLE = new Set([429, 502, 503, 504, 529]);
// Filtered-post counters, owned here so every X tab shares one count.
//  - session: unique posts filtered since the browser started (chrome.storage.session,
//    cleared when the browser closes or the extension reloads)
//  - total:   running count across all sessions (chrome.storage.local, kept until
//    the extension is removed). Each session adds the posts it newly filtered.
const FILTERED_SESSION_KEY = "tlf:filteredKeys";
const FILTERED_TOTAL_KEY = "tlf:filteredTotal";

let filteredKeys = new Set();
let filteredTotal = 0;
const countsReady = Promise.all([
  chrome.storage.session
    .get(FILTERED_SESSION_KEY)
    .then((saved) => {
      filteredKeys = new Set(
        Array.isArray(saved[FILTERED_SESSION_KEY])
          ? saved[FILTERED_SESSION_KEY]
          : [],
      );
    })
    .catch(() => {}),
  chrome.storage.local
    .get(FILTERED_TOTAL_KEY)
    .then((saved) => {
      const n = Math.floor(Number(saved[FILTERED_TOTAL_KEY]));
      filteredTotal = Number.isFinite(n) && n > 0 ? n : 0;
    })
    .catch(() => {}),
]).then(() => {
  // The all-time total can never be smaller than this session's count.
  filteredTotal = Math.max(filteredTotal, filteredKeys.size);
});

const counts = () => ({ count: filteredKeys.size, total: filteredTotal });

// Writes are chained so concurrent messages can't interleave; each write saves
// the latest in-memory values.
let persisting = Promise.resolve();
function persistCounts() {
  persisting = persisting.then(async () => {
    try {
      await chrome.storage.session.set({
        [FILTERED_SESSION_KEY]: [...filteredKeys],
      });
    } catch {
      /* Keep the in-memory session count if session storage is unavailable. */
    }
    try {
      await chrome.storage.local.set({ [FILTERED_TOTAL_KEY]: filteredTotal });
    } catch {
      /* Keep the in-memory total if local storage is unavailable. */
    }
  });
  return persisting;
}

async function recordFiltered(keys) {
  await countsReady;
  // No awaits between the check and the increment, so two tabs reporting the
  // same post at the same time still count it once.
  let added = 0;
  for (const key of keys) {
    const k = String(key);
    if (!filteredKeys.has(k)) {
      filteredKeys.add(k);
      added++;
    }
  }
  if (added) {
    filteredTotal += added;
    await persistCounts();
  }
  return counts();
}

/**
 * One Noul question per topic, evaluated against the post and any quoted post
 * in a single request. Jev returns the probability (0-1) that the answer is yes.
 *
 * `criteria` tells the model where the line is: a passing mention should not
 * count as a match. Tweak the wording here if you want looser or stricter
 * matching.
 */
function buildQuestions(topics) {
  const questions = {};
  topics.forEach((topic, i) => {
    questions[`topic_${i}`] = {
      type: "noul",
      instructions: `Is either the post itself or the quoted post mainly about: ${topic}?`,
      criteria: {
        true: `The main subject or a central point of either the post itself or its quoted post is: ${topic}`,
        false:
          "Neither the post nor its quoted post is about this, or they mention it only in passing",
      },
    };
  });
  return questions;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function classify({ state, topics }) {
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) return { ok: false, code: "no_key" };

  const body = JSON.stringify({
    state,
    model: MODEL,
    questions: buildQuestions(topics),
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
      });
    } catch {
      await sleep(400 * 2 ** attempt);
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const scores = {};
      topics.forEach((topic, i) => {
        const answer = data.answers?.[`topic_${i}`];
        scores[topic] = typeof answer?.noul === "number" ? answer.noul : 0;
      });
      return { ok: true, scores };
    }

    if (res.status === 401 || res.status === 403)
      return { ok: false, code: "bad_key" };

    if (RETRYABLE.has(res.status)) {
      const wait =
        Number(res.headers.get("retry-after")) * 1000 || 600 * 2 ** attempt;
      await sleep(Math.min(wait, 5000));
      continue;
    }

    return { ok: false, code: "http", status: res.status };
  }
  return { ok: false, code: "unavailable" };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "tlf:get-filtered") {
    countsReady.then(
      () => sendResponse({ ok: true, ...counts() }),
      () => sendResponse({ ok: false }),
    );
    return true;
  }
  if (msg?.type === "tlf:record-filtered") {
    recordFiltered(Array.isArray(msg.keys) ? msg.keys : []).then(
      (c) => sendResponse({ ok: true, ...c }),
      () => sendResponse({ ok: false }),
    );
    return true;
  }
  if (msg?.type !== "tlf:classify") return;
  classify(msg).then(sendResponse, () =>
    sendResponse({ ok: false, code: "unavailable" }),
  );
  return true; // keep the channel open for the async response
});
