/* Background script - Ultra-fast updates & concise responses */

// Use Vercel server instead of direct Gemini API
const GEMINI_ENDPOINT = 'https://project-server-gules.vercel.app/ask-gemini';

let tabData = { tabs: [], lastUpdated: 0 };
let sidePanelPorts = new Set();
let summarizerSession = null;

// Ultra-short summarizer
async function initializeSummarizer() {
  try {
    if (!window.ai?.summarizer) return null;
    const canSummarize = await window.ai.summarizer.capabilities();
    if (canSummarize.available === 'no') return null;
    
    summarizerSession = await window.ai.summarizer.create({
      type: 'tl;dr',
      format: 'plain-text',
      length: 'short'
    });
    
    console.log('✅ Summarizer ready');
    return summarizerSession;
  } catch (error) {
    console.log('⚠️ Summarizer unavailable');
    return null;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  initializeSummarizer();
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;
  const url = new URL(tab.url);
  
  if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
    await chrome.sidePanel.setOptions({ tabId, enabled: false });
  } else {
    await chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true });
  }
  
  // INSTANT refresh when tab loads
  if (changeInfo.status === 'complete' && sidePanelPorts.size > 0) {
    setTimeout(() => refreshAllTabs().catch(() => {}), 500);
  }
});

// INSTANT refresh when new tab created
chrome.tabs.onCreated.addListener(() => {
  if (sidePanelPorts.size > 0) {
    setTimeout(() => refreshAllTabs().catch(() => {}), 500);
  }
});

// INSTANT refresh when tab removed
chrome.tabs.onRemoved.addListener(() => {
  if (sidePanelPorts.size > 0) {
    refreshAllTabs().catch(() => {});
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "side-panel") {
    sidePanelPorts.add(port);
    port.postMessage({ type: 'TAB_DATA_UPDATE', data: tabData });
    port.onDisconnect.addListener(() => sidePanelPorts.delete(port));
  }
});

function broadcastTabDataUpdate() {
  const message = { type: 'TAB_DATA_UPDATE', data: tabData };
  sidePanelPorts.forEach(port => {
    try {
      port.postMessage(message);
    } catch (error) {
      sidePanelPorts.delete(port);
    }
  });
}

function extractPageContent() {
  try {
    if (document.readyState === 'loading') {
      return { text: "Loading...", error: "loading" };
    }

    let allText = '';
    const selectors = ['main', 'article', '[role="main"]', '.content', 'body'];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const clone = element.cloneNode(true);
        clone.querySelectorAll('script, style, nav, header, footer, aside, .ad').forEach(el => el.remove());
        const text = clone.innerText || clone.textContent || '';
        if (text.length > allText.length) {
          allText = text;
          break;
        }
      }
    }

    if (allText.length < 100) {
      allText = Array.from(document.querySelectorAll('p, h1, h2, h3'))
        .map(p => (p.innerText || '').trim())
        .filter(t => t.length > 20)
        .join(' ');
    }

    const cleaned = allText.replace(/\s+/g, ' ').trim();
    return { text: cleaned, length: cleaned.length, title: document.title || '' };
  } catch (error) {
    return { text: '', error: error.message };
  }
}

// Ultra-short summaries with 2s timeout
async function summarizeContent(text, title) {
  try {
    if (!summarizerSession || !text || text.length < 200) return null;
    
    const contentToSummarize = `${title}\n\n${text.slice(0, 3000)}`;
    
    const summaryPromise = summarizerSession.summarize(contentToSummarize);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 2000)
    );
    
    const summary = await Promise.race([summaryPromise, timeoutPromise]);
    const sentences = summary.split(/[.!?]+/).filter(s => s.trim());
    return sentences.slice(0, 2).join('. ') + '.';
  } catch (error) {
    return null;
  }
}

async function extractTabContent(tab) {
  if (!tab.id || !tab.url) return null;
  
  const restrictedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'file:', 'about:'];
  if (restrictedProtocols.some(proto => tab.url.startsWith(proto))) {
    return {
      id: tab.id,
      url: tab.url,
      title: tab.title || 'Untitled',
      favicon: tab.favIconUrl || '',
      text: 'Restricted page',
      hasContent: false,
      error: 'restricted'
    };
  }
  
  const base = {
    id: tab.id,
    url: tab.url,
    title: tab.title || 'Untitled',
    favicon: tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=32`,
  };

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
      world: 'MAIN'
    });
    
    const extractionResult = results[0]?.result || { text: '' };
    const extractedText = extractionResult.text || '';
    
    if (extractedText && extractedText.length > 50) {
      let summary = null;
      if (extractedText.length > 200) {
        summary = await summarizeContent(extractedText, tab.title);
      }
      
      return {
        ...base,
        text: extractedText.slice(0, 10000),
        summary: summary,
        hasContent: true
      };
    }
    
    return {
      ...base,
      text: extractedText || "No content",
      summary: null,
      hasContent: false
    };
  } catch (error) {
    return {
      ...base,
      text: "Extraction failed",
      summary: null,
      hasContent: false,
      error: error.message
    };
  }
}

async function refreshAllTabs() {
  try {
    console.log('🔄 Fast refresh...');
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    if (!summarizerSession) {
      await initializeSummarizer();
    }
    
    const promises = tabs.map(tab => extractTabContent(tab));
    const results = await Promise.all(promises);
    
    const successCount = results.filter(r => r?.hasContent).length;
    const summarizedCount = results.filter(r => r?.summary).length;
    
    tabData = {
      tabs: results.filter(r => r !== null),
      lastUpdated: Date.now(),
      stats: {
        total: tabs.length,
        successful: successCount,
        summarized: summarizedCount,
        failed: tabs.length - successCount
      }
    };
    
    console.log(`✅ Fast refresh: ${successCount} tabs, ${summarizedCount} summaries`);
    broadcastTabDataUpdate();
    return tabData;
  } catch (error) {
    console.error('❌ Refresh error:', error);
    throw error;
  }
}

function extractReferencedTabs(answer, tabs) {
  const tabRefs = [];
  if (!answer || !tabs.length) return tabRefs;
  
  tabs.forEach(tab => {
    if (tab.title && tab.title.length > 5) {
      const escapedTitle = tab.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`"${escapedTitle}"`, 'gi').test(answer)) {
        tabRefs.push({
          title: tab.title,
          url: tab.url,
          favicon: tab.favicon,
          tabId: tab.id
        });
      }
    }
  });
  
  return tabRefs;
}

// Check if question is about tabs
function isTabRelatedQuestion(question) {
  const q = question.toLowerCase();
  const tabKeywords = ['tab', 'page', 'open', 'website', 'site', 'url', 'link', 'article', 'reading', 'browsing'];
  const genericKeywords = ['what is', 'who is', 'how to', 'why', 'when', 'define', 'explain', 'tell me about'];
  
  if (tabKeywords.some(kw => q.includes(kw))) return true;
  if (genericKeywords.some(kw => q.includes(kw))) return false;
  
  return true;
}

function keywordFallback(question, tabs) {
  const q = question.toLowerCase();
  const words = q.split(/[^a-z0-9]+/i).filter(w => w.length > 2);
  const contentTabs = tabs.filter(tab => tab.hasContent);

  if (contentTabs.length === 0) {
    return {
      answer: `No readable content found in ${tabs.length} tabs. Please refresh.`,
      referencedTabs: [],
      timestamp: Date.now()
    };
  }

  const scored = contentTabs.map(t => {
    const searchContent = `${t.title}\n${t.text}\n${t.summary || ''}`.toLowerCase();
    const score = words.reduce((s, w) => s + (searchContent.includes(w) ? 1 : 0), 0);
    return { tab: t, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, 2);

  if (scored.length === 0) {
    return {
      answer: `No matches found for "${question}" in ${contentTabs.length} tabs.`,
      referencedTabs: [],
      timestamp: Date.now()
    };
  }

  let answer = `Found in:\n\n`;
  scored.forEach(item => {
    const snippet = item.tab.summary || 
                   (item.tab.text || "").slice(0, 100).replace(/\s+/g, ' ').trim() + '...';
    answer += `**"${item.tab.title}"**\n${snippet}\n\n`;
  });

  return {
    answer: answer,
    referencedTabs: scored.map(item => ({
      title: item.tab.title,
      url: item.tab.url,
      favicon: item.tab.favicon,
      tabId: item.tab.id
    })),
    timestamp: Date.now()
  };
}

async function askGemini(question, tabs) {
if (!isTabRelatedQuestion(question)) {
  return {
    answer: "Ask about tabs.",
    referencedTabs: [],
    timestamp: Date.now()
  };
}

  const meaningfulTabs = tabs.filter(tab => tab.hasContent);
  if (meaningfulTabs.length === 0) {
    return {
      answer: `No content in ${tabs.length} tabs. Refresh and try again.`,
      referencedTabs: [],
      timestamp: Date.now()
    };
  }

  const topTabs = meaningfulTabs.slice(0, 5);
  const tabsContext = topTabs.map((tab, i) =>
    `TAB ${i + 1}: "${tab.title}"\nSummary: ${tab.summary || ''}\nContent: ${tab.text.slice(0, 1500)}...\n`
  ).join('\n');
const requestBody = {
  question: `5 WORDS MAX. Tab name only: ${question}`,
  tabsContext,
  maxTokens: 10, // Very short
  temperature: 0.1
};
  try {
    const res = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();

    let answer = data?.answer || "No response generated.";

    // 🚫 Kill all list/brand/product fluff
    answer = answer
      .replace(/[-*•]\s*/g, '')
      .replace(/\b(apple|samsung|iqoo|oneplus|redmi|deal|offer|discount|festival|product|brand|item|electronics?|appliance|furniture|clothing|fashion|phone|mobile|recommendation|sponsored)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // ✅ Keep just 1 sentence
    const sentence = answer.split(/[.!?]/).filter(s => s.trim())[0];
    answer = sentence ? sentence.trim() + '.' : "No short answer available.";

    const referencedTabs = extractReferencedTabs(answer, tabs);
    return { answer, referencedTabs, timestamp: Date.now() };
  } catch (error) {
    console.error('❌ Gemini error:', error);
    return keywordFallback(question, tabs);
  }
}


async function navigateToTab(url, tabId) {
  try {
    const existingTabs = await chrome.tabs.query({ url: url });
    if (existingTabs.length > 0) {
      await chrome.tabs.update(existingTabs[0].id, { active: true });
      return { success: true };
    }
    if (tabId) {
      await chrome.tabs.update(tabId, { active: true });
      return { success: true };
    }
    await chrome.tabs.create({ url: url, active: true });
    return { success: true };
  } catch (error) {
    throw error;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'REFRESH_TABS':
      refreshAllTabs()
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'ASK_GEMINI':
      askGemini(request.question, tabData.tabs)
        .then(response => sendResponse({ success: true, answer: response }))
        .catch(error => {
          const fallbackResponse = keywordFallback(request.question, tabData.tabs);
          sendResponse({ success: true, answer: fallbackResponse });
        });
      return true;
      
    case 'GET_TAB_DATA':
      sendResponse({ success: true, data: tabData });
      return false;
      
    case 'NAVIGATE_TO_TAB':
      navigateToTab(request.url, request.tabId)
        .then(result => sendResponse({ success: true, ...result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown type' });
      return false;
  }
});

// FASTER auto-refresh - every 10 seconds
setInterval(() => {
  if (sidePanelPorts.size > 0) {
    refreshAllTabs().catch(() => {});
  }
}, 10000);

// Quick refresh on window focus
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE && sidePanelPorts.size > 0) {
    refreshAllTabs().catch(() => {});
  }
});

console.log('🚀 Extension started - Vercel backend');
refreshAllTabs().catch(() => {});