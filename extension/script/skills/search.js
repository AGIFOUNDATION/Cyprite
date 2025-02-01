const SearchMaxCount = 10;

globalThis.AISkils = globalThis.AISkils || {};

globalThis.AISkils.searchViaAI = async (topic) => {
	var timeused = Date.now();
	var result = await AI.getCachedInformation('LLMSearch', topic), usage = {};
	if (!result) {
		try {
			result = await AIHandler.callLLMForSearch(topic);
			if (!!result && !!result.result) {
				usage = result.usage;
				result = result.result;
				if (!isArray(result)) {
					result = [];
				}
				else {
					await AI.setCachedInformation('LLMSearch', topic, [...result]);
				}
			}
		}
		catch (err) {
			logger.error('SearchViaAI', err);
			throw err;
		}
	}
	else {
		logger.blank('UseCachedLLMSearchResult', topic);
		result = [...result];
	}

	timeused = Date.now() - timeused;
	logger.info('LLMSearch', 'timeused: ' + timeused + 'ms, count: ' + result.length);
	if (!IsPublished) console.log(result);

	return {result, usage};
};
globalThis.AISkils.searchViaGoogle = async (topic) => {
	var timeused = Date.now();
	var result = await AI.getCachedInformation('GoogleSearch', topic);
	if (!result) {
		try {
			result = await EventHandler.SearchGoogle(topic);
			if (!isArray(result)) {
				result = [];
			}
			else if (result.length > 0) {
				await AI.setCachedInformation('GoogleSearch', topic, [...result]);
			}
		}
		catch (err) {
			logger.error('Search', err);
			throw err;
		}
	}
	else {
		logger.blank('UseCachedGoogleSearchResult', topic);
		result = [...result];
	}

	result.sort((a, b) => (b.summary || '').length - (a.summary || '').length);
	if (result.length > SearchMaxCount) result.splice(SearchMaxCount);
	timeused = Date.now() - timeused;
	logger.info('GoogleSearch', 'timeused: ' + timeused + 'ms, count: ' + result.length);
	if (!IsPublished) console.log(result);

	return {
		result,
		usage: {}
	};
};
globalThis.AISkils.searchLocally = async (topic) => {
	let timeused = Date.now();
	let articles = await AI.getCachedInformation('LocalSearch', topic);
	let usage = {};
	if (!articles) {
		try {
			articles = await AIHandler.selectArticlesAboutConversation(topic);
			usage = articles.usage;
			articles = articles.articles;
			articles = await EventHandler.GetArticleInfo({articles: articles.map(item => item.url)});
			articles = articles.map(item => {
				return {
					url: item.url,
					title: item.title || 'Untitled',
					summary: item.description || '(EMPTY)',
				}
			});
			await AI.setCachedInformation('LocalSearch', topic, [...articles]);
		}
		catch (err) {
			logger.error('SearchLocally', err);
			articles = [];
		}
	}
	else {
		logger.blank('UseCachedLocalSearchResult', topic);
		articles = [...articles];
	}
	timeused = Date.now() - timeused;
	logger.info('LocalSearch', 'timeused: ' + timeused + 'ms, count: ' + articles.length);
	if (!IsPublished) console.log(articles);

	return {
		result: articles,
		usage
	};
};