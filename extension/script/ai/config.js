globalThis.ModelContinueRequestLoopLimit = 10;
globalThis.ModelList = [];
globalThis.Model2AI = {
	"gemini-1.5-flash-exp-0827": "Gemini",
	"gemini-1.5-pro-exp-0827": "Gemini",
	"gemini-1.5-flash-002": "Gemini",
	"gemini-1.5-pro-002": "Gemini",
	"claude-3-5-sonnet-latest": "Claude",
	"claude-3-opus-20240229": "Claude",
	"claude-3-haiku-20240307": "Claude",
	"chatgpt-4o-latest": "OpenAI",
	"gpt-4o-mini": "OpenAI",
	"o1-preview": "OpenAI",
	"o1-mini": "OpenAI",
	"grok-beta": "Grok",
	"open-mixtral-8x22b": "Mixtral",
	"open-mistral-7b": "Mixtral",
	"open-mistral-nemo": "Mixtral",
	"open-codestral-mamba": "Mixtral",
	"pixtral-12b-latest": "Mixtral",
	"gemma2-9b-it": "Groq",
	"llama-3.1-70b-versatile": "Groq",
	"llama-3.2-11b-vision-preview": "Groq",
	"llama-3.2-90b-text-preview": "Groq",
};
globalThis.AI2Model = {
	"gemini": [
		"gemini-1.5-flash-exp-0827",
		"gemini-1.5-pro-exp-0827",
		"gemini-1.5-flash-002",
		"gemini-1.5-pro-002",
	],
	"claude": [
		"claude-3-5-sonnet-latest",
		"claude-3-opus-20240229",
		"claude-3-haiku-20240307",
	],
	"openai": [
		"chatgpt-4o-latest",
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
		"llama-3.1-70b-versatile",
		"llama-3.2-11b-vision-preview",
		"llama-3.2-90b-text-preview",
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
	"gemini-1.5-flash-exp-0827": "GeminiFlash",
	"gemini-1.5-pro-exp-0827": "GeminiPro",
	// "gemini-1.5-flash-002": "GeminiFlash2",
	// "gemini-1.5-pro-002": "GeminiPro2",
	"claude-3-5-sonnet-latest": "Sonnet3.5",
	"claude-3-opus-20240229": "Opus3",
	// "claude-3-haiku-20240307": "Haiku",
	"chatgpt-4o-latest": "GPT",
	"gpt-4o-mini": "GPTMini",
	"o1-preview": "O1",
	"o1-mini": "O1-Mini",
	"grok-beta": "GrokBeta",
	"open-mixtral-8x22b": "OpenMixtral",
	// "open-mistral-7b": "OpenMistral",
	"open-mistral-nemo": "MistralNemo",
	// "open-codestral-mamba": "CodestralMamba",
	"pixtral-12b-latest": "Pixtral",
	"gemma2-9b-it": "Gemma2",
	"llama-3.1-70b-versatile": "LLaMa3.1",
	"llama-3.2-90b-text-preview": "LLaMa3.2",
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
	"chatgpt-4o-latest": {
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

/* Long Context Control */

globalThis.AILongContextLimit = 200000;
const LongContextModel = [
	'gemini-1.5-pro-exp-0827',
	'gemini-1.5-pro-002',
];
LongContextModel.idx = -1;
globalThis.PickLongContextModel = () => {
	return myInfo.model;
};

/* Functional Model Allocation */

const FunctionalModel = {
	excludeIrrelevants: [
		"gemini-1.5-flash-exp-0827",
		"gemini-1.5-flash-002",
		"o1-mini",
		"deepseek-chat",
		"moonshot-v1-auto",
	],
	identityRelevants: [
		"gemini-1.5-flash-exp-0827",
		"gemini-1.5-flash-002",
		"chatgpt-4o-latest",
		"deepseek-chat",
		"glm-4-plus",
		"claude-3-5-sonnet-latest",
	],
	analyzeSearchKeywords: [
		'gemini-1.5-flash-exp-0827',
		"gemini-1.5-flash-002",
		'llama-3.2-90b-text-preview',
		'claude-3-haiku-20240307',
		'glm-4-long',
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
		rpm: 15,
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
	"chatgpt-4o-latest": {
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
	"gemini-1.5-pro-exp-0827": {
		rpm: 2,
		tpm: 32000,
	},
	"gemini-1.5-flash-002": {
		rpm: 15,
		tpm: 1000000,
	},
	"gemini-1.5-pro-002": {
		rpm: 2,
		tpm: 32000,
	},
};
const OneMinute = 60 * 1000;
const ModelRequestHistory = {};
const ModelRequestPending = {};
const getRateLimitHistory = (model) => {
	var list = ModelRequestHistory[model];
	if (!list) {
		list = {
			start: [],
			finish: [],
		};
		ModelRequestHistory[model] = list;
	}
	return list;
};
globalThis.requestRateLimitLock = (model) => new Promise(async res => {
	var aiName = Model2AI[model] || '';
	var rpm = (ModelRateLimit[model] || {}).rpm || (ModelRateLimit[aiName] || {}).rpm || 0;
	if (rpm <= 0) return res();

	var time = Date.now();
	var rateLimiter = getRateLimitHistory(model);
	var delayS = 0, delayF = 0;
	rateLimiter.start = rateLimiter.start.filter(t => time - t <= OneMinute);
	if (rateLimiter.start.length >= rpm) delayS = OneMinute - time + rateLimiter.start[0];
	rateLimiter.finish = rateLimiter.finish.filter(t => time - t <= OneMinute);
	if (rateLimiter.finish.length >= rpm) delayF = OneMinute - time + rateLimiter.finish[0];

	var delay = Math.max(delayS, delayF);
	logger.strong('RPM', 'RPM ' + model + ' : ' + rpm + ' (' + rateLimiter.start.length + ', ' + rateLimiter.finish.length + ') ' + delay);
	var pending = ModelRequestPending[model];
	if (!pending) {
		pending = [];
		ModelRequestPending[model] = pending;
	}
	pending.push(res);
	if (delay === 0) {
		res = pending[0];
		pending.shift();
		if (!!res) res();
		return;
	}

	logger.strong('RPM', 'RPM Waiting: ' + model);
	while (delay > 0) {
		if (delay > 5000) {
			delay -= 5000;
			await wait(5000);
		}
		else {
			await wait(delay);
			delay = 0;
		}
	}
	await requestRateLimitLock(model);
	logger.strong('RPM', 'RPM Continue: ' + model);
	res = pending[0];
	pending.shift();
	if (!!res) res();
});
globalThis.updateRateLimitLock = (model, isStart, input, output) => {
	var time = Date.now();

	var rateLimiter = getRateLimitHistory(model);
	if (isStart) {
		rateLimiter.start.unshift(time);
	}
	else {
		rateLimiter.finish.unshift(time);
	}
	rateLimiter.start = rateLimiter.start.filter(t => time - t <= OneMinute);
	rateLimiter.finish = rateLimiter.finish.filter(t => time - t <= OneMinute);
};