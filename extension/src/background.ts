// Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "save-to-deepsave",
        title: "Save to DeepSave",
        contexts: ["page", "selection", "image", "link"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "save-to-deepsave" && tab && tab.id) {
        // Logic to send to backend or open popup will go here
        console.log("Saving...", info.pageUrl);

        // We can inject a script to toast notify the user
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => alert("Sent to DeepSave! (Mock)")
        });
    }
});
