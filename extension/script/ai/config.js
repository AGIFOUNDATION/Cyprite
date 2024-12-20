globalThis.ModelContinueRequestLoopLimit = 10;
globalThis.ModelList = [];
globalThis.Model2AI = {
	"gemini-1.5-pro-exp-0827": "Gemini",
	"gemini-1.5-flash-exp-0827": "Gemini",
	"gemini-1.5-pro-002": "Gemini",
	"gemini-1.5-flash-002": "Gemini",
	"gemini-exp-1121": "Gemini",
	"learnlm-1.5-pro-experimental": "Gemini",
	"claude-3-5-sonnet-latest": "Claude",
	"claude-3-opus-20240229": "Claude",
	"claude-3-5-haiku-latest": "Claude",
	"o1-preview": "OpenAI",
	"o1-mini": "OpenAI",
	"gpt-4o": "OpenAI",
	"gpt-4o-mini": "OpenAI",
	"grok-beta": "Grok",
	"open-mixtral-8x22b": "Mixtral",
	"open-mistral-7b": "Mixtral",
	"open-mistral-nemo": "Mixtral",
	"open-codestral-mamba": "Mixtral",
	"pixtral-12b-latest": "Mixtral",
	"gemma2-9b-it": "Groq",
	"llama3-groq-70b-8192-tool-use-preview": "Groq",
	"llama-3.1-70b-versatile": "Groq",
	"llama-3.2-90b-vision-preview": "Groq",
};
globalThis.AI2Model = {
	"gemini": [
		"gemini-1.5-pro-exp-0827",
		"gemini-1.5-flash-exp-0827",
		"gemini-1.5-pro-002",
		"gemini-1.5-flash-002",
		"gemini-exp-1121",
		"learnlm-1.5-pro-experimental",
	],
	"claude": [
		"claude-3-5-sonnet-latest",
		"claude-3-opus-20240229",
		"claude-3-5-haiku-latest",
	],
	"openai": [
		"gpt-4o",
		"gpt-4o-mini",
		"o1-preview",
		"o1-mini",
	],
	"grok": [
		"grok-beta",
	],
	"mixtral": [
		"open-mixtral-8x22b",
		"open-mistral-7b",
		"open-mistral-nemo",
		"open-codestral-mamba",
		"pixtral-12b-latest",
	],
	"groq": [
		"gemma2-9b-it",
		"llama3-groq-70b-8192-tool-use-preview",
		"llama-3.1-70b-versatile",
		"llama-3.2-90b-vision-preview",
	],
};
globalThis.ModelOrder = [
	"gemini",
	"claude",
	"openai",
	"grok",
	"groq",
	"mixtral",
];
globalThis.ModelNameList = {
	"gemini-1.5-pro-exp-0827": "Gemini Pro",
	"gemini-1.5-flash-exp-0827": "Gemini Flash",
	// "gemini-1.5-pro-002": "GeminiPro2",
	// "gemini-1.5-flash-002": "GeminiFlash2",
	"gemini-exp-1121": "Gemini Exp",
	"learnlm-1.5-pro-experimental": "Gemini LearnLM",
	"claude-3-5-sonnet-latest": "Sonnet 3.5",
	"claude-3-opus-20240229": "Opus 3",
	"claude-3-5-haiku-latest": "Haiku 3.5",
	"o1-preview": "O1",
	"o1-mini": "O1 Mini",
	"gpt-4o": "GPT 4o",
	"gpt-4o-mini": "GPT 4o Mini",
	"grok-beta": "Grok Beta",
	"open-mixtral-8x22b": "Open Mixtral",
	// "open-mistral-7b": "OpenMistral",
	"open-mistral-nemo": "Mistral Nemo",
	// "open-codestral-mamba": "CodestralMamba",
	"pixtral-12b-latest": "Pixtral",
	"gemma2-9b-it": "Gemma2",
	"llama3-groq-70b-8192-tool-use-preview": "LLaMa Groq",
	"llama-3.1-70b-versatile": "LLaMa 3.1",
	"llama-3.2-90b-vision-preview": "LLaMa 3.2",
};
globalThis.ModelDefaultConfig = {
	Gemini: {
		header: {
			"content-type": "application/json"
		},
		chat: {
			generationConfig: {
				temperature: 1.0,
				topP: 0.95,
				topK: 32,
				candidateCount: 1,
				maxOutputTokens: 8192,
				responseMimeType: "text/plain",
				stopSequences: [],
			},
			safetySettings: [
				{
					"category": "HARM_CATEGORY_HARASSMENT",
					"threshold": "BLOCK_NONE"
				},
				{
					"category": "HARM_CATEGORY_HATE_SPEECH",
					"threshold": "BLOCK_NONE"
				},
				{
					"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
					"threshold": "BLOCK_NONE"
				},
				{
					"category": "HARM_CATEGORY_DANGEROUS_CONTENT",
					"threshold": "BLOCK_NONE"
				},
				{
					"category": "HARM_CATEGORY_CIVIC_INTEGRITY",
					"threshold": "BLOCK_NONE"
				}
			]
		}
	},
	Claude: {
		header: {
			Accept: "application/json",
			"content-type": "application/json",
			"anthropic-version": "2023-06-01",
			"anthropic-beta": "messages-2023-12-15",
			"anthropic-dangerous-direct-browser-access": true
		},
		chat: {
			top_k: 3,
			temperature: 1.0,
			max_tokens: 4096,
		}
	},
	OpenAI: {
		header: {
			"Content-Type": "application/json",
		},
		chat: {
			temperature: 1.0,
			max_tokens: 4096,
		},
	},
	Grok: {
		header: {
			"Content-Type": "application/json",
		},
		chat: {
			temperature: 1.0,
			max_tokens: 409600,
		},
	},
	Mixtral: {
		header: {
			"Content-Type": "application/json",
			"Accept": "application/json",
		},
		chat: {
			temperature: 0.95,
			max_tokens: 32000,
		},
	},
	Groq: {
		header: {
			"Content-Type": "application/json",
		},
		chat: {
			temperature: 0.95,
			max_tokens: 8192,
		},
	},
	"claude-3-5-sonnet-latest": {
		header: {
			"anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15",
		},
		chat: {
			max_tokens: 8192,
		}
	},
	"gpt-4o": {
		chat: {
			max_tokens: 16384,
		}
	},
	"gpt-4o-mini": {
		chat: {
			max_tokens: 16384,
		}
	},
	"o1-preview": {
		chat: {
			max_tokens: 32768,
		}
	},
	"o1-mini": {
		chat: {
			max_tokens: 65536,
		}
	},
	"open-mixtral-8x22b": {
		chat: {
			max_tokens: 64000,
		}
	},
	"open-codestral-mamba": {
		chat: {
			max_tokens: 256000,
		}
	},
	"open-mistral-nemo": {
		chat: {
			max_tokens: 128000,
		}
	},
	"llama-3.1-70b-versatile": {
		chat: {
			max_tokens: 8000,
		},
	},
};
globalThis.SearchAIModel = ['GLM', 'MoonShot'];
globalThis.PaCableModels = [
	"gemini-1.5-pro-exp-0827",
	"gemini-1.5-flash-exp-0827",
	"gemini-1.5-pro-002",
	"gemini-1.5-flash-002",
	"claude-3-5-sonnet-latest",
	"claude-3-5-haiku-latest",
	"claude-3-opus-20240229",
	"o1-preview",
	"deepseek-chat",
	"qwen-max-latest",
];

/* Long Context Control */

globalThis.AILongContextLimit = 200000;
const LongContextModel = [
	'gemini-1.5-pro-exp-0827',
	'gemini-1.5-pro-002',
	"gemini-exp-1121",
	"learnlm-1.5-pro-experimental",
];
LongContextModel.idx = -1;
globalThis.PickLongContextModel = () => {
	return myInfo.model;
};

/* Functional Model Allocation */

const FunctionalModel = {
	analyzeKeywordCategory: [
		'claude-3-5-haiku-latest',
		'grok-beta',
		'glm-4-flash',
		'moonshot-v1-auto',
		'gemini-1.5-flash-exp-0827',
	],
	filterKeywordCategory: [
		'claude-3-5-haiku-latest',
		'gemini-1.5-flash-002',
		'glm-4-flash',
		'gemini-1.5-flash-exp-0827',
		'deepseek-chat',
		'glm-4-plus',
		'gpt-4o',
		'gemini-1.5-pro-002',
		'gpt-4o-mini',
		'grok-beta',
		'gemini-1.5-pro-exp-0827',
		'claude-3-5-sonnet-latest',
	],
	findArticlesFromList: [
		"gpt-4o-mini",
		"gemini-1.5-flash-002",
		"grok-beta",
		"abab6.5s-chat",
	],
	excludeIrrelevants: [
		"gemini-1.5-flash-exp-0827",
		"gemini-1.5-flash-002",
		"o1-mini",
		"gpt-4o-mini",
		"deepseek-chat",
		"moonshot-v1-auto",
	],
	identityRelevants: [
		"gemini-1.5-flash-exp-0827",
		"gemini-1.5-flash-002",
		"gpt-4o",
		"deepseek-chat",
		"glm-4-plus",
		"claude-3-5-sonnet-latest",
	],
	analyzeSearchKeywords: [
		'gemini-1.5-flash-exp-0827',
		"gemini-1.5-flash-002",
		'claude-3-5-haiku-latest',
		'glm-4-long',
	],
	firstTranslation: [
		'claude-3-5-sonnet-latest',
		'gpt-4o',
		'o1-preview',
		'grok-beta',
		'moonshot-v1-auto',
		'deepseek-chat',
	],
	analysisTranslationInadequacies: [
		'o1-mini',
		"gpt-4o-mini",
		'claude-3-5-sonnet-latest',
		'grok-beta',
		'gemini-1.5-pro-002',
		'gemini-1.5-pro-exp-0827',
		'moonshot-v1-auto',
		'deepseek-chat',
	],
};
globalThis.getFunctionalModelList = () => {
	return [myInfo.model];
};

/* Rate Limit Controller */

globalThis.ModelRateLimit= {
	OpenAI: {
		rpm: 5000,
		tpm: 800000,
	},
	Claude: {
		rpm: 2000,
		tpm: 160000,
	},
	Gemini: {
		rpm: 2,
		tpm: 32000,
	},
	Mixtral: {
		rpm: 1,
		tpm: 500000
	},
	Groq: {
		rpm: 30,
		tpm: 15000
	},
	"gpt-4o": {
		rpm: 10000,
		tpm: 30000000,
	},
	"gpt-4o-mini": {
		rpm: 30000,
		tpm: 150000000,
	},
	"o1-preview": {
		rpm: 500,
		tpm: 30000000,
	},
	"o1-mini": {
		rpm: 1000,
		tpm: 150000000,
	},
	"claude-3-opus-20240229": {
		tpm: 80000,
	},
	"gemini-1.5-flash-exp-0827": {
		rpm: 15,
		tpm: 1000000,
	},
	"gemini-1.5-flash-002": {
		rpm: 15,
		tpm: 1000000,
	},
};