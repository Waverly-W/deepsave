const STATUS_CONFIG = {
  idle: {
    icon: {
      16: "icons/brand-16.png",
      32: "icons/brand-32.png"
    },
    badge: "",
    color: "#9ca3af"
  },
  ready: {
    icon: {
      16: "icons/brand-16.png",
      32: "icons/brand-32.png"
    },
    badge: "",
    color: "#3b82f6"
  },
  saving: {
    icon: {
      16: "icons/brand-16.png",
      32: "icons/brand-32.png"
    },
    badge: "...",
    color: "#3b82f6"
  },
  success: {
    icon: {
      16: "icons/brand-16.png",
      32: "icons/brand-32.png"
    },
    badge: "OK",
    color: "#10b981"
  },
  error: {
    icon: {
      16: "icons/brand-16.png",
      32: "icons/brand-32.png"
    },
    badge: "ERR",
    color: "#ef4444"
  }
};

async function setStatus(status) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  await chrome.action.setIcon({ path: config.icon });
  await chrome.action.setBadgeText({ text: config.badge });
  await chrome.action.setBadgeBackgroundColor({ color: config.color });
}

async function loadConfig() {
  const result = await chrome.storage.local.get(["apiUrl", "accessToken"]);
  const apiUrl = (result.apiUrl || "").replace(/\/$/, "");
  const accessToken = result.accessToken || "";
  return { apiUrl, accessToken };
}

async function setStatusFromConfig() {
  const { apiUrl, accessToken } = await loadConfig();
  if (apiUrl && accessToken) {
    await setStatus("ready");
  } else {
    await setStatus("idle");
  }
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

async function ingestNote({ apiUrl, accessToken, url, title, content }) {
  if (!apiUrl || !accessToken) {
    await setStatus("idle");
    return;
  }
  if (!isHttpUrl(url)) {
    await setStatus("idle");
    return;
  }

  await setStatus("saving");
  try {
    const response = await fetch(`${apiUrl}/items/ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url,
        source_type: "note",
        title,
        content_text: content
      })
    });

    if (response.status === 202) {
      await setStatus("success");
      setTimeout(() => {
        setStatusFromConfig().catch(() => {});
      }, 1500);
      return;
    }
  } catch (error) {
    await setStatus("error");
    return;
  }
  await setStatus("error");
  setTimeout(() => {
    setStatusFromConfig().catch(() => {});
  }, 1500);
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: "deepsave-save-note",
    title: "Save to DeepSave as Note",
    contexts: ["selection"]
  });
  await setStatusFromConfig();
});

chrome.runtime.onStartup.addListener(async () => {
  await setStatusFromConfig();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "deepsave-save-note") {
    return;
  }
  const content = (info.selectionText || "").trim();
  const url = tab?.url || "";
  const title = tab?.title || "Note";
  if (!content) {
    await setStatus("error");
    return;
  }
  const config = await loadConfig();
  await ingestNote({
    apiUrl: config.apiUrl,
    accessToken: config.accessToken,
    url,
    title,
    content
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "setStatus") {
    setStatus(message.status).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message && message.type === "refreshStatus") {
    setStatusFromConfig().then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
  return false;
});
