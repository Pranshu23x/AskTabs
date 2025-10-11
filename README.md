# 🚀 AskTabs

<div align="center">

![AskTabs Logo](logo.png)

**Stop searching, start knowing. Your tabs, summarized in a flash.**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-1.0-blue?style=for-the-badge)](https://github.com/Pranshu23x/AskTabs)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)

*Instantly query all your open tabs with AI-powered intelligence*

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Tech Stack](#-tech-stack) • [Contributing](#-contributing)

</div>

---

## 🎯 What is AskTabs?

AskTabs is a powerful Chrome extension that brings AI-powered search across all your open browser tabs. Instead of manually switching between dozens of tabs, simply ask a question and get instant answers from your tab content.

**Perfect for:**
- 📚 Researchers juggling multiple papers and articles
- 💼 Professionals managing numerous work-related tabs
- 🛍️ Online shoppers comparing products across sites
- 📰 News readers tracking multiple stories
- 🎓 Students researching for assignments

---

## ✨ Features

### 🤖 **AI-Powered Intelligence**
- Powered by Google Gemini for accurate, context-aware responses
- Natural language processing understands your questions
- Smart content extraction from all tab types

### ⚡ **Lightning Fast**
- Real-time tab content indexing
- Auto-refresh when tabs update
- Instant search results
- Built-in summarization for quick insights

### 🎨 **Beautiful Interface**
- Modern glassmorphism design
- Smooth animations and transitions
- Responsive side panel layout
- Dark mode optimized

### 🔒 **Privacy First**
- All processing happens through secure API
- No tab data stored permanently
- Content extracted only when needed

### 🎯 **Smart Features**
- **Auto-summarization**: Get TL;DR summaries of lengthy pages
- **Tab references**: See which tabs answered your question
- **One-click navigation**: Jump to relevant tabs instantly
- **Conversation history**: Review past queries
- **Real-time updates**: Tab content refreshes automatically

---

## 🚀 Installation

### From Chrome Web Store
1. Visit the [AskTabs Chrome Web Store page](#) *(coming soon)*
2. Click "Add to Chrome"
3. Grant necessary permissions
4. Click the AskTabs icon to open the side panel

### Manual Installation (Developer Mode)
1. Clone this repository:
   ```bash
   git clone https://github.com/Pranshu23x/AskTabs.git
   cd AskTabs
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **Load unpacked** and select the `AskTabs` folder

5. Pin the extension for easy access

6. Click the AskTabs icon to open the side panel

---

## 💡 Usage

### Basic Queries
```
"What articles am I reading about AI?"
"Which tab has the recipe?"
"Find documentation about React hooks"
"What's the price on Amazon?"
```

### Example Workflows

#### 📚 **Research Mode**
1. Open multiple research papers/articles
2. Ask: *"Summarize the key findings across my tabs"*
3. Get AI-generated insights from all sources
4. Click referenced tabs to dive deeper

#### 🛍️ **Shopping Assistant**
1. Open product pages from different sites
2. Ask: *"Compare prices for laptops"*
3. Get instant comparison with tab references
4. Jump to the best deal with one click

#### 📰 **News Aggregation**
1. Open news articles on a topic
2. Ask: *"What's the consensus on this story?"*
3. Get synthesized summary across sources
4. See which outlets reported what

---

## 🛠️ Tech Stack

### Frontend
- **HTML5/CSS3** - Modern, responsive UI
- **JavaScript (ES6+)** - Core functionality
- **Glassmorphism Design** - Beautiful visual effects

### Backend
- **Google Gemini API** - AI-powered responses
- **Vercel Serverless** - API endpoint hosting
- **Chrome Extensions API** - Browser integration

### Key APIs Used
- `chrome.tabs` - Tab management
- `chrome.scripting` - Content extraction
- `chrome.sidePanel` - UI integration
- `chrome.storage` - Settings persistence
- `window.ai.summarizer` - Built-in summarization (experimental)

---

## 📁 Project Structure

```
AskTabs/
├── manifest.json          # Extension configuration
├── background.js          # Service worker & core logic
├── sidepanel.html         # Side panel interface
├── sidepanel.js           # UI logic & interactions
├── styles.css             # Styling & animations
├── logo.png              # Extension icon
└── README.md             # This file
```

---

## 🔧 Configuration

### API Setup
The extension uses a Vercel-hosted API endpoint. To set up your own:

1. Deploy the server code to Vercel:
   ```bash
   vercel deploy
   ```

2. Update the endpoint in `background.js`:
   ```javascript
   const GEMINI_ENDPOINT = 'https://your-project.vercel.app/ask-gemini';
   ```

3. Configure your Gemini API key in the server environment

---

## 🎨 Customization

### Styling
Modify `styles.css` to customize:
- Color schemes
- Animation speeds
- Layout dimensions
- Glassmorphism effects

### AI Behavior
Adjust in `background.js`:
- `maxTokens` - Response length
- `temperature` - Creativity level
- Summarization length
- Refresh intervals

---

## 🐛 Troubleshooting

### Extension not loading?
- Ensure Developer mode is enabled
- Check for manifest.json errors in Console
- Reload the extension after changes

### No content extracted?
- Verify tab permissions are granted
- Some sites block content scripts
- Restricted pages (chrome://, file://) can't be accessed

### API errors?
- Check network connectivity
- Verify API endpoint is accessible
- Ensure Gemini API quota isn't exceeded

### Slow performance?
- Reduce number of open tabs
- Clear conversation history
- Disable auto-refresh if not needed

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow existing code style
- Test thoroughly before submitting
- Update documentation as needed
- Add comments for complex logic

---

## 📝 Roadmap

- [ ] Firefox extension support
- [ ] Export conversation history
- [ ] Custom AI model selection
- [ ] Tab grouping & organization
- [ ] Multi-language support
- [ ] Offline mode with caching
- [ ] Voice input support
- [ ] Advanced filtering options

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Pranshu**

- GitHub: [@Pranshu23x](https://github.com/Pranshu23x)
- Project: [AskTabs](https://github.com/Pranshu23x/AskTabs)



## 📊 Stats

<div align="center">

![GitHub stars](https://img.shields.io/github/stars/Pranshu23x/AskTabs?style=social)
![GitHub forks](https://img.shields.io/github/forks/Pranshu23x/AskTabs?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/Pranshu23x/AskTabs?style=social)

</div>

---

<div align="center">

**Made with ❤️ by Pranshu**

*If you find AskTabs helpful, consider giving it a ⭐ on GitHub!*

[⬆ Back to Top](#-asktabs)

</div>
