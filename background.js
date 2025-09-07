const DEFAULT_FOCUS_MIN = 25;

const STORAGE_KEYS = {
  SITES: 'blockedSites',
  IS_FOCUS: 'isFocusing',
  END_TS: 'focusEndTs',
  COUNTERS: 'attemptCounters',
  SETTINGS: 'settings',
  START_TS: 'focusStartTs',
  IS_PAUSED: 'isPaused',
  REMAINING_MS: 'remainingMs'
};

// Helpers
function nowMs() { return Date.now(); }

async function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}
async function setStorage(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}
async function clearCounters() {
  await setStorage({ [STORAGE_KEYS.COUNTERS]: {} });
}

// Match url against patterns in blockedSites (supports hosts or simple substrings)
function urlMatches(url, patterns) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const href = url;
    for (const p of patterns) {
      if (!p) continue;
      const low = p.toLowerCase();
      if (host.includes(low) || href.toLowerCase().includes(low)) return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

// Register attempt (increment counter per site-key)
async function registerAttempt(matchedPattern) {
  const all = await getStorage([STORAGE_KEYS.COUNTERS]);
  const counters = all[STORAGE_KEYS.COUNTERS] || {};
  counters[matchedPattern] = (counters[matchedPattern] || 0) + 1;
  await setStorage({ [STORAGE_KEYS.COUNTERS]: counters });
  // optional: update badge
  updateBadge();
}

// Update extension badge with total attempts during current focus
async function updateBadge() {
  const all = await getStorage([STORAGE_KEYS.COUNTERS, STORAGE_KEYS.IS_FOCUS]);
  const counters = all[STORAGE_KEYS.COUNTERS] || {};
  const isFocus = all[STORAGE_KEYS.IS_FOCUS] || false;
  if (!isFocus) {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setBadgeBackgroundColor({ color: [0,0,0,0] });
    return;
  }
  const total = Object.values(counters).reduce((a,b)=>a+b,0);
  chrome.action.setBadgeText({ text: total ? String(total) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#ff4d4d' });
}

// Track tabs we've already handled to prevent duplicate counts
const handledTabs = new Set();

// Close or redirect tab if blocked
async function handlePotentialBlockedTab(tabId, changeInfoOrUrl) {
  // get current data
  const st = await getStorage([STORAGE_KEYS.SITES, STORAGE_KEYS.IS_FOCUS]);
  const sites = st[STORAGE_KEYS.SITES] || [];
  const isFocus = st[STORAGE_KEYS.IS_FOCUS] || false;
  if (!isFocus || !sites.length) return;

  // retrieve tab url
  let tab = await new Promise(resolve => chrome.tabs.get(tabId, resolve));
  const url = tab && tab.url ? tab.url : (typeof changeInfoOrUrl === 'string' ? changeInfoOrUrl : (changeInfoOrUrl && changeInfoOrUrl.url) || '');
  if (!url) return;

  // Check if we've already handled this tab recently to prevent duplicate counts
  const tabKey = `${tabId}-${url}`;
  if (handledTabs.has(tabKey)) return;

  // if matches, close or redirect
  const matched = sites.find(p => {
    try {
      const low = p.toLowerCase();
      return url.toLowerCase().includes(low) || (new URL(url).hostname || '').includes(low);
    } catch(e) { return false; }
  });
  if (matched) {
    // Mark this tab as handled
    handledTabs.add(tabKey);

    // register attempt
    await registerAttempt(matched);

    // redirect to extension's blocked page
    const blockedUrl = chrome.runtime.getURL('blocked.html') + `?site=${encodeURIComponent(matched)}&tabId=${tabId}`;
    try {
      // prefer to update to blocked page
      await chrome.tabs.update(tabId, { url: blockedUrl });
    } catch (e) {
      // if can't update (sometimes for chrome:// or extension pages), try closing tab
      try { await chrome.tabs.remove(tabId); } catch(err) {}
    }

    // Clean up the handled tab after a short delay
    setTimeout(() => handledTabs.delete(tabKey), 5000);
  }
}

// Event listeners
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // when url becomes available
  if (changeInfo.url) {
    await handlePotentialBlockedTab(tabId, changeInfo);
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  // Do nothing here; rely on onUpdated for URL changes
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up handled tabs when they're closed
  for (const key of handledTabs) {
    if (key.startsWith(`${tabId}-`)) {
      handledTabs.delete(key);
    }
  }
});

// Messages from popup or pages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === 'startFocus') {
    startFocus(msg.minutes || DEFAULT_FOCUS_MIN);
    sendResponse({status:'ok'});
    return true;
  }
  if (msg?.action === 'stopFocus') {
    stopFocus();
    sendResponse({status:'ok'});
    return true;
  }
  if (msg?.action === 'pauseFocus') {
    pauseFocus();
    sendResponse({status:'ok'});
    return true;
  }
  if (msg?.action === 'resumeFocus') {
    resumeFocus();
    sendResponse({status:'ok'});
    return true;
  }
  if (msg?.action === 'getStatus') {
    (async ()=>{
      const s = await getStorage([STORAGE_KEYS.SITES, STORAGE_KEYS.IS_FOCUS, STORAGE_KEYS.END_TS, STORAGE_KEYS.COUNTERS, STORAGE_KEYS.SETTINGS]);
      sendResponse(s);
    })();
    return true;
  }
  if (msg?.action === 'clearCounters') {
    (async ()=>{
      await clearCounters();
      sendResponse({status:'ok'});
    })();
    return true;
  }
    if (msg?.action === 'closeThisTab') {
      // prioriza sender.tab.id (quando disponível), senão usa msg.tabId
      const tabIdToClose = (sender && sender.tab && sender.tab.id) || msg.tabId;
      // segurança simples: tabId deve ser número
      if (typeof tabIdToClose === 'number') {
        chrome.tabs.remove(tabIdToClose).catch(()=>{});
        sendResponse({ status: 'closed', tabId: tabIdToClose });
      } else {
        sendResponse({ status: 'no-tab-id' });
      }
      return true;
    }
});

// Start focus session (minutes)
async function startFocus(minutes) {
  // Clear any existing alarm first
  await chrome.alarms.clear('focusEnd');

  const ms = minutes * 60 * 1000;
  const startTs = nowMs();
  const endTs = startTs + ms;
  await setStorage({
    [STORAGE_KEYS.IS_FOCUS]: true,
    [STORAGE_KEYS.END_TS]: endTs,
    [STORAGE_KEYS.START_TS]: startTs,
    [STORAGE_KEYS.IS_PAUSED]: false,
    [STORAGE_KEYS.REMAINING_MS]: 0
  });
  await setStorage({ [STORAGE_KEYS.COUNTERS]: {} });

  // set alarm
  chrome.alarms.create('focusEnd', { when: endTs });
  updateBadge();

  // optional notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/lock-48.png',
    title: 'Lock In — foco iniciado',
    message: `Sessão de ${minutes} minutos iniciada. Boa sessão!`
  });
}

// Stop focus session
async function stopFocus() {
  // Clear alarm first to prevent race conditions
  await chrome.alarms.clear('focusEnd');

  const now = new Date();
  const st = await getStorage([STORAGE_KEYS.COUNTERS, STORAGE_KEYS.END_TS]);
  const counters = st[STORAGE_KEYS.COUNTERS] || {};
  const endTs = st[STORAGE_KEYS.END_TS] || nowMs();
  const duration = Math.round((endTs - nowMs()) / 60000); // in minutes

  // Save session history
  const history = await getStorage(['sessionHistory']);
  const sessionHistory = history.sessionHistory || [];
  sessionHistory.push({
    date: now.toISOString(),
    duration: Math.max(duration, 0),
    counters,
  });
  await setStorage({ sessionHistory });

  // Clear focus state
  await setStorage({
    [STORAGE_KEYS.IS_FOCUS]: false,
    [STORAGE_KEYS.END_TS]: 0,
    [STORAGE_KEYS.START_TS]: 0,
    [STORAGE_KEYS.IS_PAUSED]: false,
    [STORAGE_KEYS.REMAINING_MS]: 0
  });
  updateBadge();

  // Show summary notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/lock-48.png',
    title: 'Lock In — session ended',
    message: 'Tap to view the summary in the popup.',
  });
}

// Pause focus session
async function pauseFocus() {
  const st = await getStorage([STORAGE_KEYS.END_TS]);
  const endTs = st[STORAGE_KEYS.END_TS] || nowMs();
  const remaining = Math.max(0, endTs - nowMs());

  await chrome.alarms.clear('focusEnd');
  await setStorage({
    [STORAGE_KEYS.IS_PAUSED]: true,
    [STORAGE_KEYS.REMAINING_MS]: remaining
  });
}

// Resume focus session
async function resumeFocus() {
  const st = await getStorage([STORAGE_KEYS.REMAINING_MS]);
  const remaining = st[STORAGE_KEYS.REMAINING_MS] || 0;
  const newEndTs = nowMs() + remaining;

  await setStorage({
    [STORAGE_KEYS.END_TS]: newEndTs,
    [STORAGE_KEYS.IS_PAUSED]: false,
    [STORAGE_KEYS.REMAINING_MS]: 0
  });
  chrome.alarms.create('focusEnd', { when: newEndTs });
  updateBadge();
}

// Alarm fired
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'focusEnd') {
    // Check if focus is still active and not paused
    const st = await getStorage([STORAGE_KEYS.IS_FOCUS, STORAGE_KEYS.IS_PAUSED]);
    if (st[STORAGE_KEYS.IS_FOCUS] && !st[STORAGE_KEYS.IS_PAUSED]) {
      await stopFocus();
      // leave counters in storage so popup can show summary
    }
  }
});

chrome.runtime.onStartup.addListener(() => updateBadge());
chrome.runtime.onInstalled.addListener(() => updateBadge());

// Periodic cleanup of handled tabs to prevent memory leaks
setInterval(() => {
  if (handledTabs.size > 100) {
    handledTabs.clear();
  }
}, 300000); // Clean up every 5 minutes if set gets too large
