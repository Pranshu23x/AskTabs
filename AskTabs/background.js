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
    // Give pages more time to load
    if (document.readyState === 'loading') {
      return { text: "Page still loading...", success: false };
    }

    // Strategy 1: Try main content areas first
    const mainSelectors = [
      'main', 'article', '[role="main"]', 
      '.content', '.main-content', '#main-content',
      '.post-content', '.entry-content', '.story-content',
      '#content', '.body', '.text'
    ];

    let bestText = '';
    
    for (const selector of mainSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const clone = element.cloneNode(true);
        // Clean up
        clone.querySelectorAll('script, style, nav, header, footer, aside, .ad, .ads, .navigation, .menu, .sidebar, .comments, .social-share').forEach(el => el.remove());
        
        const text = clone.textContent || '';
        const cleanText = text.replace(/\s+/g, ' ').trim();
        
        if (cleanText.length > bestText.length && cleanText.length > 200) {
          bestText = cleanText;
        }
      }
    }

    // Strategy 2: If no good content found, try body with smart filtering
    if (bestText.length < 300) {
      const body = document.body.cloneNode(true);
      // Remove common non-content elements
      body.querySelectorAll(`
        script, style, nav, header, footer, aside, 
        .ad, .ads, .advertisement, .navigation, .menu, .sidebar,
        .comments, .social-share, .share-buttons, .newsletter,
        .popup, .modal, .cookie-consent, .newsletter-signup
      `).forEach(el => el.remove());
      
      const text = body.textContent || '';
      bestText = text.replace(/\s+/g, ' ').trim();
    }

    // Strategy 3: Extract paragraphs and headings
    if (bestText.length < 200) {
      const contentElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div');
      const texts = [];
      
      for (const el of contentElements) {
        const text = el.textContent || '';
        const cleanText = text.replace(/\s+/g, ' ').trim();
        // Only include substantial content
        if (cleanText.length > 30 && cleanText.length < 1000) {
          texts.push(cleanText);
        }
      }
      
      bestText = texts.join(' ').slice(0, 8000);
    }

    const success = bestText.length >= 100;
    
    return { 
      text: bestText.slice(0, 10000), 
      length: bestText.length, 
      title: document.title || '',
      success: success
    };
  } catch (error) {
    return { text: '', error: error.message, success: false };
  }
}

// Ultra-short summaries with 2s timeout
async function summarizeContent(text, title) {
  try {
 if (!summarizerSession || !text || text.length < 200) {
  // fallback summary
  return text.slice(0, 150).replace(/\s+/g, ' ') + '...';
}

    
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
  
  const base = {
    id: tab.id,
    url: tab.url,
    title: tab.title || 'Untitled',
    favicon: tab.favIconUrl || '',
  };

  // Check for restricted protocols that we cannot access
  const restrictedProtocols = ['chrome:', 'edge:', 'about:', 'data:'];
  if (restrictedProtocols.some(proto => tab.url.startsWith(proto))) {
    return {
      ...base,
      text: 'Restricted page',
      hasContent: false,
      error: 'restricted'
    };
  }

  // Special handling for chrome-extension:// URLs
  if (tab.url.startsWith('chrome-extension://')) {
    console.log(`📄 Extension page detected: ${tab.title}`);
    
    // For extension pages, we can use the visible tab info
    // but cannot inject scripts, so we create a basic summary from the title
    const extensionSummary = `Extension page: ${tab.title}. ${tab.url.includes('claude.ai') ? 'Claude AI conversation interface.' : 'Browser extension interface.'}`;
    
    return {
      ...base,
      text: extensionSummary,
      summary: `Extension: ${tab.title}`,
      hasContent: true,
      isExtension: true,
      length: extensionSummary.length
    };
  }

  // For file:// URLs, check if we have permission
  if (tab.url.startsWith('file://')) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => true,
      });
    } catch (error) {
      return {
        ...base,
        text: 'File URL - Enable "Allow access to file URLs" in extension settings',
        hasContent: false,
        error: 'file_permission'
      };
    }
  }

  // For regular web pages (http://, https://, file:// with permission)
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
      world: 'MAIN'
    });
    
    const extractionResult = results[0]?.result || { text: '', success: false };
    
    if (extractionResult.success && extractionResult.text && extractionResult.text.length > 100) {
      return {
        ...base,
        text: extractionResult.text.slice(0, 10000),
        summary: null,
        hasContent: true,
        length: extractionResult.text.length
      };
    }
    
    return {
      ...base,
      text: extractionResult.text || "No extractable content",
      summary: null,
      hasContent: false,
      error: extractionResult.error
    };
  } catch (error) {
    console.log(`❌ Tab ${tab.id} extraction failed:`, error.message);
    return {
      ...base,
      text: "Extraction failed - no permission",
      summary: null,
      hasContent: false,
      error: error.message
    };
  }
}

async function refreshAllTabs() {
  try {
    console.log('🔄 Fast refresh started...');
    
    // Get all tabs from all windows (not just current window)
    const allTabs = await chrome.tabs.query({});
    
    console.log(`📑 Total tabs across all windows: ${allTabs.length}`);
    
    // Filter out only Chrome internal system pages (keep extension pages)
    const tabs = allTabs.filter(tab => {
      const url = tab.url || '';
      // Keep everything except chrome:// system pages
      return !url.startsWith('chrome://') && 
             !url.startsWith('about:') && 
             !url.startsWith('edge://') &&
             url.length > 0;
    });
    
    console.log(`📑 Found ${tabs.length} accessible tabs (including ${tabs.filter(t => t.url.startsWith('chrome-extension://')).length} extension pages)`);
    console.log(`📝 Tab URLs:`, tabs.map(t => t.url));
    
    if (tabs.length === 0) {
      console.log('⚠️ No accessible tabs found');
      tabData = {
        tabs: [],
        lastUpdated: Date.now(),
        stats: { total: 0, successful: 0, summarized: 0, failed: 0 }
      };
      broadcastTabDataUpdate();
      return tabData;
    }
    
    const promises = tabs.map(tab => extractTabContent(tab));
    const results = await Promise.all(promises);
    
    const successCount = results.filter(r => r?.hasContent).length;
    const failedTabs = results.filter(r => !r?.hasContent);
    const extensionTabs = results.filter(r => r?.isExtension).length;
    
    console.log(`✅ Extraction: ${successCount} successful (${extensionTabs} extension pages), ${failedTabs.length} failed`);
    
    tabData = {
      tabs: results.filter(r => r !== null),
      lastUpdated: Date.now(),
      stats: {
        total: tabs.length,
        successful: successCount,
        summarized: 0,
        failed: failedTabs.length,
        extensions: extensionTabs
      }
    };
    
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
      answer: `No content found.`,
      referencedTabs: [],
      timestamp: Date.now()
    };
  }

  const scored = contentTabs.map(t => {
    const searchContent = `${t.title}\n${t.text}\n${t.summary || ''}`.toLowerCase();
    const score = words.reduce((s, w) => s + (searchContent.includes(w) ? 1 : 0), 0);
    return { tab: t, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, 1);

  if (scored.length === 0) {
    return {
      answer: `No matches found.`,
      referencedTabs: [],
      timestamp: Date.now()
    };
  }

  return {
    answer: `Found relevant content.\nCheck: ${scored[0].tab.title}`,
    referencedTabs: [{
      title: scored[0].tab.title,
      url: scored[0].tab.url,
      favicon: scored[0].tab.favicon,
      tabId: scored[0].tab.id
    }],
    timestamp: Date.now()
  };
}

async function askGemini(question, tabs) {
  if (!isTabRelatedQuestion(question)) {
    return {
      answer: "Ask about your tabs.",
      referencedTabs: [],
      timestamp: Date.now()
    };
  }

  const meaningfulTabs = tabs.filter(tab => tab.hasContent);
  if (meaningfulTabs.length === 0) {
    return {
      answer: `No content found. Refresh tabs.`,
      referencedTabs: [],
      timestamp: Date.now()
    };
  }

  // Get more tabs for better coverage
  const topTabs = meaningfulTabs.slice(0, 10);
  
  // Build detailed tab list with content
  const tabsList = topTabs.map((tab, i) => {
    const preview = tab.text.slice(0, 300).replace(/\s+/g, ' ').trim();
    return `${i + 1}. "${tab.title}"\n   ${preview}...`;
  }).join('\n\n');

  // Format request for your backend - it expects { prompt: { contents: [...] } }
  const requestBody = {
    prompt: {
      contents: [
        {
          parts: [
            {
              text: `You are a helpful assistant that summarizes open browser tabs.

User has ${topTabs.length} tabs open. When asked "what tabs are open" or similar, provide a numbered list with brief descriptions.

Format:
1. "Exact Tab Title"
   Brief description of the content (one line)

2. "Next Tab Title"
   Brief description...

Available tabs:
${tabsList}

User question: ${question}

Remember: Use exact tab titles in quotes, provide helpful summaries.`
            }
          ]
        }
      ]
    }
  };

  console.log('📤 Sending to Gemini:', { 
    question, 
    tabCount: topTabs.length
  });

  try {
    const res = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();

    console.log('📥 Gemini raw response:', data);

    // Extract answer from Gemini's response format
    let answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.answer;
    
    console.log('🤖 Gemini answer:', answer);
    
    // FORCE LOCAL SUMMARY if Gemini response is bad
    const isBadResponse = !answer || 
                          answer.length < 50 || 
                          !answer.includes('"') ||
                          answer.includes('Found content. Check:');
    
    if (isBadResponse) {
      console.log('⚠️ Bad Gemini response, creating local summary');
      answer = `📑 You have ${topTabs.length} tabs open:\n\n`;
      topTabs.forEach((tab, i) => {
        const snippet = tab.text.slice(0, 100).replace(/\s+/g, ' ').trim();
        answer += `${i + 1}. "${tab.title}"\n   ${snippet}...\n\n`;
      });
    }
    
    const referencedTabs = extractReferencedTabs(answer, tabs);
    
    // Add all tabs as referenced if none found
    if (referencedTabs.length === 0) {
      topTabs.forEach(tab => {
        referencedTabs.push({
          title: tab.title,
          url: tab.url,
          favicon: tab.favicon,
          tabId: tab.id
        });
      });
    }
    
    return { answer, referencedTabs, timestamp: Date.now() };
  } catch (error) {
    console.error('❌ Gemini error:', error);
    
    // Better fallback with actual content
    const answer = `📑 You have ${topTabs.length} tabs open:\n\n` +
      topTabs.map((tab, i) => {
        const snippet = tab.text.slice(0, 100).replace(/\s+/g, ' ').trim();
        return `${i + 1}. "${tab.title}"\n   ${snippet}...`;
      }).join('\n\n');
    
    const referencedTabs = topTabs.map(tab => ({
      title: tab.title,
      url: tab.url,
      favicon: tab.favicon,
      tabId: tab.id
    }));
    
    return { answer, referencedTabs, timestamp: Date.now() };
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
