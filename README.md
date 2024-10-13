#	Cyprite

> -	Author: LostAbaddon
> -	Version: 0.5.8

Your best and smartest AI partner.

---

$$
E = M \times C^2
$$

-	E: Enlightment
-	M: Mind
-	C: Cyprite

---

##	How to Use

After installing this plugin, please first enter your personal information and AI APIKey on the configuration page (the button to enter the configuration page is located at the top left of a new tab, to the right of the Logo) in order to use this plugin smoothly.

After entering the APIKey for each AI platform, you can switch AI models by hovering the mouse over the Logo icon.

###	Configuration Settings

When you use this plugin for the first time, a basic information settings page will pop up. You can also choose to click the plugin's Action button to bring up the settings page.

On the settings page, you can fill in your basic information, including your name, personal introduction, and preferred language. You can also set the URL of the local knowledge vault server and the APIKey of each AI platform used by the front end.

**Rest assured: the front end will not disclose your APIKey when calling AI, and when connecting to our official local knowledge vault, the knowledge vault will not disclose your personal information or APIKey.** However, please ensure that the local knowledge vault you connect to is from an official source.

Currently, the front end can connect to the following AI platforms:

-	Gemini (1.5 flash, 1.5 pro)
-	OpenAI (GPT-4o, GPT-4o-mini, o1-preview, o1-mini)
-	Anthropic (Claude 3 Opus, 3.5 Sonnet)
-	MoonShot (MoonShot-v1-128k)
-	DeepSeek (DeepSeek Chat, DeepSeek Coder)
-	GLM (GLM-4-plus, GLM-4-long, GLM-4-flash)

###	Feature Introduction

This plugin will judge the type of page you are currently browsing and automatically remind you of the operations you can perform. You can also click the plugin's Action button or use the shortcut key (Ctrl + Y) to manually call it.

In addition, you can also use the right-click menu to summon the plugin. The right-click menu has three modes:

1.	Normal mode: This mode menu is enabled when there is no selected content on the page and you are not in the input box;
2.	Translation mode: This mode menu is enabled when there is selected content on the page and you are not in the input box. You can directly translate the highlighted text;
3.	Writing mode: This mode menu is enabled when you are in the input box. You can directly optimize your input (under development).

####	New Tab Page

On the new tab page, you can directly use the following features:

-	Intelligent Search: You state your needs, and Cyprite searches for you.
-	Cross-Page Q&A: Select several pages and conduct intelligent Q&A based on these pages.
-	Cyber Butler: Chat freely with Cyprite and experience the unique autonomy of the AI (in development).
-	Instant Translation: It can quickly translate the content you input into the language of your choice.

####	Intelligent Search

In the intelligent search tab, which is the default page of the new tab, you can pose questions or tasks to the system through the input box. Subsequently, the system will automatically complete the following tasks:

1.	The system will analyze your question or task, generate search keywords automatically, and conduct a Google search. For academically related questions, it will also search Wikipedia and Arxiv automatically.
2.	It will intelligently filter the search results and select content that helps to complete the question or task you have posed.
3.	It will read the filtered web pages and analyze the content to provide a comprehensive answer based on them as reliable information sources.

Of course, you can also choose to have the intelligent search complete only part of the tasks, such as just providing search keywords, conducting searches, or providing full answers.

You can enter the Google API Key and CX value in the settings page. This allows the system to use Google's search API to search web pages. If you do not input the Key and CX, the intelligent search function can still be used; however, Google might mistakenly ban the system's web page reading process as web scraping. Therefore, it is recommended that you apply for the relevant Key and CX from Google.

####	Cross-Page Q&A

In the "Cross-page Q&A" module, you can select multiple pages (and local documents after connecting to a local knowledge vault), allowing AI to respond based on these selected documents.

AI will automatically match the most relevant articles based on your current input question when starting a new conversation. You can also manually select the articles you want to connect to the current conversation through the button in the upper right corner.

####	Overview and Summary

This plugin can summarize the content of the current page. You can also interact with AI directly based on the content of the current page (click the button in the upper right corner to bring up the communication interface).

In addition, this plugin will use relevance retrieval mechMechanism to automatically load other pages that you have previously summarized using this plugin and are related to the current page and the current dialogue content during your interaction with it. It will combine the content of these pages to provide richer and more detailed responses.

Your chat history with Cyprite will be saved for 12 hours. If there is no further dialogue within 12 hours, the chat history will be automatically cleared. You can also manually clear the chat history on the current page by clicking the button.

####	Translation

This plugin can translate the content of the current page or translate the part you have highlighted. You can get a better translation by entering further translation requirements (in the input box below the main translation interface) and letting AI re-translate for you. Make good use of this function!

At the same time, you can also translate with AI in real time (click the button in the upper right corner to bring up the real-time translation interface): if the content you enter is in the target language, AI will translate it into your currently set daily language; if the content you enter is not in the target language, AI will translate it into the target language.

####	Other

The plugin will remember all the web pages you have interacted with and load the historical pages related to the current chat topic when communicating with you, providing comprehensive interaction based on all these pages. Of course, you can also choose to manually add or delete these pages to limit the scope of interaction to areas that you are more interested in.

When using the local knowledge vault, the plugin will load local information through the server and use the local files and the web pages you have browsed as the current knowledge vault for question and answer interaction during the interaction process.

## Privacy Policy

See [Privacy Policy](./PRIVACY.md)

##	NextSteps

-	**1.0.0**
	1. Improve all basic functions;
	2. Server version: more comprehensive and complete features;
	3. A truly useful, pluggable AI partner marketplace.

## ChangeLog

See [ChangeLog](./CHANGELOG.md)