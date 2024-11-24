# Change Logs

## v0.5.10 (2024.11.16)

- New Features
  + Added web search functionality to all AI conversations
  + Added dictionary-style explanations and translations for words and phrases in translation
  + Added code block highlighting in the full version
  + Shortcut keys for switching function pages: `ctrl + alt + arrowLeft|arrowRight`
  + Integrated Qwen (Qwen Max, Qwen Turbo, Qwen Long)
  + Added Google Search functionality based on Gemini Grounding
- Optimizations
  + Added display of thinking process in translation, search, and conversation pages
  + Further optimized related article filtering mechanism in multi-page conversation mode, using current topic to search for most relevant content across all keywords and categories
  + Added Stanford Encyclopedia of Philosophy search capability in smart search
  + Added conversation history management function to intelligent assistant page
  + Optimized programmatic prompts for intelligent assistant;
  + Optimized initial thinking prompts for smart search using programmatic framework;
  + Optimized smart search summary responses
  + Code blocks can be copied by clicking the title
  + Added support for generating SVG cards
  + Synchronized model selection across all pages globally with automatic UI adjustment
  + Internationalization of model names
  + Added floating directory navigation for smart search results
  + Added official website navigation to homepage
- Bug Fixes
  + Fixed the bug where article selection status was cleared after search completion in multi-page conversations
  + Fixed the bug where asynchronous calls caused database records to be incorrectly cleared in certain situations
  + Fixed the issue where cross-page Q&A records were cleared upon page refresh
  + Fixed missing strategy and other information in conversation history

## v0.5.9 (2024.11.03)

- New Features
  + Save and load history of smart search and follow-up conversations
  + Introduce FontAwesome 6.6.0
  + Add conditional search function to article management page
  + Add conditional search function to cross-page conversations
  + Release test version of Cyprite assistant built with semantic structure and prompt code in full version
  + Simplified smart assistant available in restricted version with LaTeX formula parsing capability
- Optimizations
  + Updated Readme content with separate Chinese and English versions
  + Added Token usage prompts
  + Updated Claude 3.5 Sonnet to the latest version
  + Integrated GrokBeta
  + Made Token usage display configurable
  + Adjusted AI model selection mechanism in translation process
  + Updated homepage Logo image
  + Optimized code for saving and loading local files
  + Changed some buttons to icon buttons
  + Used `chrome.storage.local` to optimize article list loading and operation speed, improving page user experience
  + Optimized parsing of structured feedback in cross-page conversations
  + Added recording of categories and keywords in summary function for future recall
  + Implemented document recall algorithm based on categories and keywords, significantly speeding up frontend RAG response
  + Enabled direct modification of page titles recorded by Cyprite within the webpage
- Fixes
  + Fixed issue with conversation history recovery within pages
  + Fixed unresponsiveness issue in page translation due to language selection function
  + Fixed bugs in deletion and regeneration in multi-page conversations

## v0.5.8 (2024.10.13)

- **New Features:**
  - Shortcut keys: Close the reference page directly using ESC; quickly switch between search modes using Alt + left/right arrow keys.
  - Import and export configuration.
  - The NewTab page now supports MathJax to parse LaTeX formulas (full version).
  - Added Privacy Policy.
- **Optimization:**
  - UI for search results list.
  - UI for reference page list.
  - Added functionality to read and analyze HTML content from ARXIV.
  - Optimized AI prompts in the "comprehensive reply" and "intelligent analysis" sections of the "smart search" module, while enhancing the dialogue mechanism for extended conversations, and improving the depth of replies and the ability to reference search materials.
  - Added hover display on the reference page for user preview convenience.
  - Cached web pages and search results using SessionStorage.
  - Automatically switch to the appropriate Model for extremely long texts.
- **Fixes:**
  - Parsing error on Wiki pages.
  - Process errors caused by case sensitivity of XML tags returned by LLM in the deep translation reflection stage.

## v0.5.7 (2024.10.08)

- Integrate more AI platforms
- Optimize search and filter related algorithms and prompts
- Improve the quality of results for the "Summary Result" feature in "Intelligent Search"
- Other optimizations