# Change Logs

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