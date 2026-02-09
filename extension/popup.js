const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const messageEl = document.getElementById("message");
const pageTitleEl = document.getElementById("page-title");
const pageUrlEl = document.getElementById("page-url");
const settingsToggle = document.getElementById("settings-toggle");
const settingsBack = document.getElementById("settings-back");
const viewHome = document.getElementById("view-home");
const viewSettings = document.getElementById("view-settings");
const apiUrlInput = document.getElementById("api-url");
const accessTokenInput = document.getElementById("access-token");
const saveSettingsBtn = document.getElementById("save-settings");
const savePageBtn = document.getElementById("save-page");

let currentTab = null;

function showView(name) {
  if (name === "settings") {
    viewHome.classList.add("is-hidden");
    viewSettings.classList.remove("is-hidden");
    viewSettings.setAttribute("aria-hidden", "false");
    return;
  }
  viewHome.classList.remove("is-hidden");
  viewSettings.classList.add("is-hidden");
  viewSettings.setAttribute("aria-hidden", "true");
}

function setMessage(text, isError = false) {
  messageEl.textContent = text || "";
  messageEl.style.color = isError ? "#ef4444" : "#10b981";
}

function setStatus(status) {
  const map = {
    idle: "Idle",
    ready: "Ready",
    saving: "Saving...",
    success: "Saved",
    error: "Failed"
  };
  statusDot.className = `dot ${status === "idle" ? "" : status}`.trim();
  statusText.textContent = map[status] || "Idle";
  chrome.runtime.sendMessage({ type: "setStatus", status });
}

function normalizeApiUrl(value) {
  return value.trim().replace(/\/$/, "");
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

async function loadSettings() {
  const result = await chrome.storage.local.get(["apiUrl", "accessToken"]);
  apiUrlInput.value = result.apiUrl || "";
  accessTokenInput.value = result.accessToken || "";
  if (result.apiUrl && result.accessToken) {
    setStatus("ready");
  } else {
    setStatus("idle");
  }
}

async function saveSettings() {
  const apiUrl = normalizeApiUrl(apiUrlInput.value);
  const accessToken = accessTokenInput.value.trim();
  await chrome.storage.local.set({ apiUrl, accessToken });
  setMessage("Settings saved.", false);
  if (apiUrl && accessToken) {
    setStatus("ready");
  } else {
    setStatus("idle");
  }
  chrome.runtime.sendMessage({ type: "refreshStatus" });
}

async function savePage() {
  if (!currentTab || !currentTab.url) {
    setMessage("No active tab.", true);
    setStatus("error");
    return;
  }
  const apiUrl = normalizeApiUrl(apiUrlInput.value);
  const accessToken = accessTokenInput.value.trim();
  if (!apiUrl || !accessToken) {
    setMessage("Please configure API URL and Access Token.", true);
    setStatus("error");
    return;
  }
  if (!isHttpUrl(currentTab.url)) {
    setMessage("This page URL is not supported.", true);
    setStatus("error");
    return;
  }

  setMessage("");
  setStatus("saving");
  savePageBtn.disabled = true;

  try {
    const response = await fetch(`${apiUrl}/items/ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: currentTab.url
      })
    });

    if (response.status === 202) {
      setStatus("success");
      setMessage("Saved to queue.", false);
    } else if (response.status === 409) {
      setStatus("success");
      setMessage("Already processing.", false);
    } else if (response.status === 401) {
      setStatus("error");
      setMessage("Unauthorized token.", true);
    } else {
      setStatus("error");
      setMessage(`Failed (${response.status}).`, true);
    }
  } catch (error) {
    setStatus("error");
    setMessage("Network error.", true);
  } finally {
    savePageBtn.disabled = false;
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  currentTab = tabs[0] || null;
  pageTitleEl.textContent = currentTab?.title || "(No title)";
  pageUrlEl.textContent = currentTab?.url || "(No URL)";
});

saveSettingsBtn.addEventListener("click", () => {
  saveSettings().catch(() => {
    setMessage("Failed to save settings.", true);
  });
});

savePageBtn.addEventListener("click", () => {
  savePage().catch(() => {
    setStatus("error");
    setMessage("Save failed.", true);
  });
});

settingsToggle.addEventListener("click", () => {
  showView("settings");
});

settingsBack.addEventListener("click", () => {
  showView("home");
});

loadSettings().catch(() => {
  setMessage("Failed to load settings.", true);
});
