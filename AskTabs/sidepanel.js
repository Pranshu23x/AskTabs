const state = {
  tabs: [],
  messages: [],
  asking: false,
  connected: false,
  port: null,
  lastTabUpdate: 0
};

const el = {
  chatLog: () => document.getElementById("chat-log"),
  question: () => document.getElementById("question"),
  ask: () => document.getElementById("ask"),
  reloadIcon: () => document.querySelector(".reload-icon"),
  clearChat: () => document.getElementById("clear-chat"),
  tabStatus: () => document.getElementById("tab-status"),
  statusDot: () => document.querySelector(".status-dot"),
  statusText: () => document.querySelector(".status-text")
};

// Smooth scroll to bottom function
function scrollToBottom(smooth = true) {
  const log = el.chatLog();
  if (!log) return;
  
  if (smooth) {
    // Smooth scroll
    log.scrollTo({
      top: log.scrollHeight,
      behavior: 'smooth'
    });
  } else {
    // Instant scroll
    log.scrollTop = log.scrollHeight;
  }
}

async function saveState() {
  try {
    await chrome.storage.local.set({
      sidePanelState: {
        messages: state.messages,
        lastTabUpdate: state.lastTabUpdate,
        tabs: state.tabs
      }
    });
    console.log('✅ State saved:', state.messages.length, 'messages,', state.tabs.length, 'tabs');
  } catch (error) {
    console.error('❌ Error saving state:', error);
  }
}

async function loadState() {
  try {
    const result = await chrome.storage.local.get(['sidePanelState']);
    if (result.sidePanelState) {
      state.messages = result.sidePanelState.messages || [];
      state.tabs = result.sidePanelState.tabs || [];
      state.lastTabUpdate = result.sidePanelState.lastTabUpdate || 0;
      console.log('✅ Loaded saved state:', state.messages.length, 'messages,', state.tabs.length, 'tabs');
    } else {
      console.log('ℹ️ No saved state found');
    }
  } catch (error) {
    console.error('❌ Error loading state:', error);
  }
}

function showLoading(show) {
  const askBtn = el.ask();
  if (askBtn) {
    if (show) {
      askBtn.innerHTML = '<span class="loading-spinner"></span>';
      askBtn.disabled = true;
    } else {
      askBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      askBtn.disabled = false;
    }
  }
}

function showReloadLoading(show) {
  const reloadIcon = el.reloadIcon();
  if (reloadIcon) {
    if (show) {
      reloadIcon.style.opacity = '0.5';
      reloadIcon.innerHTML = '<span class="loading-spinner"></span>';
    } else {
      reloadIcon.style.opacity = '1';
      reloadIcon.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 4V9H4.58152M19.9381 11C19.446 7.05369 16.0796 4 12 4C8.64262 4 5.76829 6.06817 4.58152 9M4.58152 9H9M20 20V15H19.4185M19.4185 15C18.2317 17.9318 15.3574 20 12 20C7.92038 20 4.55399 16.9463 4.06189 13M19.4185 15H15" 
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    }
  }
}

function updateTabStatus(tabCount, isUpdating = false, stats = null) {
  const statusDot = el.statusDot();
  const statusText = el.statusText();
  const tabStatus = el.tabStatus();

  if (!statusDot || !statusText || !tabStatus) return;

  if (isUpdating) {
    statusDot.className = 'status-dot updating';
    statusText.innerHTML = '<span class="loading-spinner"></span> Extracting...';
    tabStatus.style.opacity = '1';
  } else if (tabCount > 0) {
    statusDot.className = 'status-dot online';
    
    if (stats && stats.summarized > 0) {
      statusText.innerHTML = `${tabCount} tabs • <span style="color: #25d366;">${stats.summarized} summaries</span>`;
    } else {
      statusText.textContent = `${tabCount} tabs available`;
    }
    
    tabStatus.style.opacity = '1';
  } else {
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'No tabs available';
    tabStatus.style.opacity = '0.7';
  }
}

function addMessage(content, role, referencedTabs = []) {
  const message = {
    content,
    role,
    referencedTabs,
    timestamp: Date.now()
  };

  state.messages.push(message);
  renderMessages();
  saveState();
  
  // Smooth scroll to bottom after adding message
  setTimeout(() => scrollToBottom(true), 100);
}

function clearChat() {
  state.messages = [];
  renderMessages();
  saveState();
  addMessage("Ask anything about your opened tabs", "assistant");
}

function renderMessages() {
  const log = el.chatLog();
  if (!log) return;

  log.innerHTML = "";

  if (!state.messages.length) {
    const empty = document.createElement("div");
    empty.className = "no-messages";
    empty.innerHTML = `
      <div class="welcome-message">
        <h3>🚀 Tab AI Search</h3>
        <p style="color: rgba(37, 211, 102, 0.9); font-weight: 600;">
          AI-powered answers from your open tabs
        </p>
        <p>Ask me anything:</p>
        <ul>
          <li>"Summarize my tabs"</li>
          <li>"Where did I see X?"</li>
          <li>"What's on page Y?"</li>
        </ul>
      </div>
    `;
    log.appendChild(empty);
    return;
  }

  state.messages.forEach((message, index) => {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${message.role}-message`;

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";

    if (message.role === "user") {
      messageContent.textContent = message.content;
    } else {
      messageContent.innerHTML = processMessageContent(message.content, message.referencedTabs);
    }

    messageDiv.appendChild(messageContent);

    if (message.referencedTabs && message.referencedTabs.length > 0) {
      const tabsSection = document.createElement("div");
      tabsSection.className = "referenced-tabs";

      const tabsTitle = document.createElement("div");
      tabsTitle.className = "tabs-title";
      tabsTitle.innerHTML = '📑 Referenced tabs:';
      tabsSection.appendChild(tabsTitle);

      message.referencedTabs.forEach(tab => {
        const tabItem = document.createElement("div");
        tabItem.className = "tab-item";
        tabItem.innerHTML = `
          <img src="${tab.favicon}" class="tab-favicon" onerror="this.style.display='none'">
          <a href="#" class="tab-link" data-url="${tab.url}" data-tabid="${tab.tabId}">${tab.title}</a>
        `;
        tabsSection.appendChild(tabItem);
      });

      messageDiv.appendChild(tabsSection);
    }

    log.appendChild(messageDiv);
  });

  log.querySelectorAll('.tab-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const url = this.getAttribute('data-url');
      const tabId = this.getAttribute('data-tabid');
      navigateToTab(url, tabId);
    });
  });

  // Instant scroll on initial render, then smooth
  if (state.messages.length <= 2) {
    scrollToBottom(false);
  } else {
    scrollToBottom(true);
  }
}

function processMessageContent(text, referencedTabs = []) {
  if (!text) return '';

  let processedText = text;

  processedText = processedText.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g, 
    '<a href="$2" class="content-link" target="_blank">$1</a>'
  );

  referencedTabs.forEach(tab => {
    if (tab.title) {
      const escapedTitle = tab.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`"(${escapedTitle})"`, 'gi');
      processedText = processedText.replace(regex, 
        `<a href="#" class="tab-link" data-url="${tab.url}" data-tabid="${tab.tabId}">"$1"</a>`
      );
    }
  });

  processedText = processedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  processedText = processedText.replace(/\n\n/g, '<br><br>');
  processedText = processedText.replace(/\n/g, '<br>');

  return processedText;
}

async function navigateToTab(url, tabId) {
  try {
    const response = await sendMessageToBackground({ 
      type: 'NAVIGATE_TO_TAB', 
      url: url, 
      tabId: tabId ? parseInt(tabId) : null 
    });

    if (response.success) {
      console.log('✅ Navigation successful');
    } else {
      console.error('❌ Navigation failed:', response.error);
    }
  } catch (error) {
    console.error('❌ Error navigating to tab:', error);
  }
}

async function sendMessageToBackground(message, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Request timeout after ' + timeout + 'ms'));
    }, timeout);

    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

async function refreshTabs() {
  showReloadLoading(true);
  updateTabStatus(state.tabs.length, true);

  try {
    console.log('🔄 Refreshing tabs...');
    const response = await sendMessageToBackground({ type: 'REFRESH_TABS' }, 60000);
    console.log('✅ Tabs refreshed:', response.data.tabs.length);
    
    state.tabs = response.data.tabs;
    state.lastTabUpdate = Date.now();
    
    const tabsWithContent = state.tabs.filter(t => t.hasContent);
    const tabsWithSummaries = state.tabs.filter(t => t.summary);
    
    console.log(`📊 ${tabsWithContent.length} tabs, ${tabsWithSummaries.length} summaries`);
    
    updateTabStatus(state.tabs.length, false, response.data.stats);
    await saveState();

    const reloadIcon = el.reloadIcon();
    if (reloadIcon) {
      reloadIcon.style.color = '#25d366';
      setTimeout(() => {
        reloadIcon.style.color = '';
      }, 1500);
    }
    
    if (tabsWithSummaries.length > 0) {
      const tempMessage = document.createElement('div');
      tempMessage.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        background: rgba(37, 211, 102, 0.95);
        color: white;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      `;
      tempMessage.textContent = `✨ ${tabsWithSummaries.length} summaries ready!`;
      document.body.appendChild(tempMessage);
      
      setTimeout(() => {
        tempMessage.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => tempMessage.remove(), 300);
      }, 2500);
    }
    
  } catch (error) {
    console.error('❌ Error refreshing tabs:', error);
    updateTabStatus(state.tabs.length, false);

    const reloadIcon = el.reloadIcon();
    if (reloadIcon) {
      reloadIcon.style.color = '#ea4335';
      setTimeout(() => {
        reloadIcon.style.color = '';
      }, 1500);
    }
  } finally {
    showReloadLoading(false);
  }
}

// Replace the existing onAsk function in sidepanel.js with this:

async function onAsk() {
  const input = el.question();
  if (!input) return;

  const q = input.value.trim();
  if (!q) return;

  input.value = "";
  addMessage(q, "user");

  showLoading(true);
  state.asking = true;

  try {
    // REFRESH TABS FIRST before asking (if data is old)
    const isStale = Date.now() - state.lastTabUpdate > 5000; // 5 seconds
    if (isStale || state.tabs.length === 0) {
      console.log('🔄 Refreshing tabs before asking...');
      await refreshTabs();
    }

    const tabsWithContent = state.tabs.filter(t => t.hasContent);
    const tabsWithSummaries = state.tabs.filter(t => t.summary);

    console.log(`📊 ${state.tabs.length} tabs: ${tabsWithContent.length} content, ${tabsWithSummaries.length} summaries`);

    console.log('🤔 Sending question...');
    const response = await sendMessageToBackground({ 
      type: 'ASK_GEMINI', 
      question: q 
    }, 60000);

    console.log('✅ Response received');

    addMessage(
      response.answer.answer, 
      "assistant", 
      response.answer.referencedTabs || []
    );

  } catch (error) {
    console.error('❌ Error:', error);
    let errorMessage = `Error: ${error.message}.`;
    
    const tabsWithContent = state.tabs.filter(t => t.hasContent);
    if (tabsWithContent.length === 0) {
      errorMessage += ' No content found. Try refreshing tabs.';
    }
    
    addMessage(errorMessage, "assistant");
  } finally {
    showLoading(false);
    state.asking = false;
  }
}

function wireEvents() {
  const askBtn = el.ask();
  if (askBtn) {
    askBtn.addEventListener("click", onAsk);
  }

  const inputEl = el.question();
  if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !state.asking) {
        onAsk();
      }
    });

    inputEl.addEventListener("input", () => {
      const askBtn = el.ask();
      if (askBtn) {
        askBtn.disabled = !inputEl.value.trim() || state.asking;
      }
    });
  }

  const reloadIconEl = el.reloadIcon();
  if (reloadIconEl) {
    reloadIconEl.addEventListener("click", refreshTabs);
  }

  const clearChatBtn = el.clearChat();
  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", clearChat); 
  }
}

function setupPortConnection() {
  try {
    state.port = chrome.runtime.connect({ name: "side-panel" });
    console.log('🔌 Connecting...');

    state.port.onMessage.addListener((message) => {
      console.log('📨 Message:', message.type);
      switch (message.type) {
        case 'TAB_DATA_UPDATE':
          state.tabs = message.data.tabs;
          state.lastTabUpdate = Date.now();
          
          const tabsWithContent = state.tabs.filter(t => t.hasContent);
          const tabsWithSummaries = state.tabs.filter(t => t.summary);
          
          console.log(`✅ ${state.tabs.length} tabs, ${tabsWithSummaries.length} summaries`);
          updateTabStatus(state.tabs.length, false, message.data.stats);
          saveState();
          break;
        case 'CONNECTION_STATUS':
          state.connected = message.connected;
          break;
      }
    });

    state.port.onDisconnect.addListener(() => {
      console.log('❌ Disconnected');
      state.connected = false;
      updateTabStatus(0, false);
      setTimeout(setupPortConnection, 5000);
    });

    state.connected = true;
    console.log('✅ Connected');

  } catch (error) {
    console.error('❌ Connection failed:', error);
    updateTabStatus(0, false);
    setTimeout(setupPortConnection, 3000);
  }
}

async function loadInitialData() {
  try {
    console.log('📥 Loading data...');
    
    const response = await sendMessageToBackground({ type: 'GET_TAB_DATA' }, 10000);
    if (response.success && response.data.tabs.length > 0) {
      state.tabs = response.data.tabs;
      state.lastTabUpdate = Date.now();
      
      const tabsWithSummaries = state.tabs.filter(t => t.summary);
      
      console.log(`✅ ${state.tabs.length} tabs loaded`);
      updateTabStatus(state.tabs.length, false, response.data.stats);
      await saveState();
      return;
    }
    
    console.log('⏳ Refreshing...');
    await refreshTabs();
    
  } catch (error) {
    console.error('❌ Load failed:', error);
    updateTabStatus(0, false);
    
    try {
      await refreshTabs();
    } catch (refreshError) {
      console.error('❌ Refresh failed:', refreshError);
    }
  }
}

async function init() {
  console.log('🚀 Initializing...');

  try {
    await loadState();
    wireEvents();
    setupPortConnection();
    
    const needsRefresh = state.tabs.length === 0 || 
                        Date.now() - state.lastTabUpdate > 60000;
    
    if (needsRefresh) {
      console.log('🔄 Fresh load...');
      await loadInitialData();
    } else {
      console.log(`✅ Cached: ${state.tabs.length} tabs`);
      const tabsWithSummaries = state.tabs.filter(t => t.summary).length;
      updateTabStatus(state.tabs.length, false, { summarized: tabsWithSummaries });
    }

    renderMessages();

    if (state.messages.length === 0) {
      addMessage("Ready! Ask about your tabs 🚀", "assistant");
    }

    console.log('✅ Ready');
  } catch (error) {
    console.error('❌ Init error:', error);
  }
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

window.addEventListener('error', (event) => {
  console.error('💥 Error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('💥 Promise rejection:', event.reason);
});

document.addEventListener("DOMContentLoaded", init);
