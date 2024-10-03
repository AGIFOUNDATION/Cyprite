import"./components/jsrsasign.all.min.js";import"./script/i18n.js";import"./script/ai/config.js";import"./script/common.js";import"./script/cachedDB.js";import"./script/ai.js";let UtilList={notification:{js:["/components/notification.js"],css:["/components/notification.css","/components/mention.css"]},panel:{js:["/components/marked.min.js","/pages/inner.js"],css:["/components/panel.css"]}},SimilarLimit=20,updateAIModelList=(globalThis.myInfo={inited:!1,useLocalKV:!0,apiKey:"",lang:DefaultLang,name:"主人",info:"(Not set yet)",model:ModelList[0]},()=>{var e,t=!1;for(e in ModelList.splice(0),myInfo.apiKey)myInfo.apiKey[e]&&(t=!0,AI2Model[e])&&ModelList.push(...AI2Model[e]);myInfo.edgeAvailable=t}),callLLMOneByOne=(globalThis.getWSConfig=async()=>{var[e,t]=await Promise.all([chrome.storage.local.get(["wsHost","apiKey","AImodel"]),chrome.storage.sync.get(["name","info","lang"])]),a=(logger.em("EXT","Config Loaded"),[]);return myInfo.inited=!0,myInfo.name=t.name||myInfo.name,myInfo.info=t.info||myInfo.info,myInfo.lang=t.lang,myInfo.lang&&(myInfo.lang=myInfo.lang.toLowerCase(),i18nList.includes(myInfo.lang))||(myInfo.lang=DefaultLang),myInfo.lang!==t.lang&&a.push(chrome.storage.sync.set({lang:myInfo.lang})),myInfo.apiKey=e.apiKey||{},isString(myInfo.apiKey)&&(t={},myInfo.apiKey&&(t.gemini=myInfo.apiKey),myInfo.apiKey=t,a.push(chrome.storage.local.set({apiKey:myInfo.apiKey}))),myInfo.useLocalKV=!ForceBackend&&!e.wsHost,myInfo.model=e.AImodel||myInfo.model||ModelList[0],updateAIModelList(),logger.em("EXT",myInfo),0<a.length&&await Promise.all(a),e.wsHost},async(e,t,a=!0,n="CallAI")=>{var r,i;for(i of e){var s=Date.now();try{r=await callAIandWait("directAskAI",{conversation:t,model:i})}catch(e){r=null,logger.error(n+": "+i,e);continue}s=Date.now()-s,logger.info(n,i+" : "+s+"ms"),a&&(r=parseReplyAsXMLToJSON(r));break}return r}),DBs={},initDB=async()=>{let e=new CachedDB("PageInfos",1);e.onUpdate(()=>{e.open("tabInfo","tid"),e.open("pageInfo","url"),e.open("notifyChecker","url"),e.open("pageConversation","url"),logger.info("DB","Updated")}),e.onConnect(()=>{globalThis.dbPageInfos=e,logger.info("DB","Connected")}),await e.connect(),DBs.pageInfo=e},gotoUniquePage=(globalThis.DefaultSendMessage||(globalThis.DefaultSendMessage=()=>{}),globalThis.sendMessage||(globalThis.sendMessage=DefaultSendMessage),async e=>{console.log(">>>>>>>>>>>>>>>>    1",e);var t=(t=await chrome.tabs.query({url:e}))&&t[0];return console.log(">>>>>>>>>>>>>>>>    2",t),t?(console.log(">>>>>>>>>>>>>>>>    4"),await chrome.tabs.update(t.id,{active:!0,highlighted:!0})):(console.log(">>>>>>>>>>>>>>>>    3"),t=await chrome.tabs.create({url:e})),t}),configureCyberButler=()=>{gotoUniquePage(chrome.runtime.getURL("pages/config.html"))},showSystemNotification=(globalThis.checkAvailability=async()=>{myInfo.inited||await getWSConfig();var e=!0;return(e=myInfo.useLocalKV?myInfo.edgeAvailable:!!await getWSConfig())||configureCyberButler(),e},e=>{var t=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang];isString(e)||(e=e.message||e.msg||e.data||e.toString()),chrome.notifications.create({title:t.cypriteName,message:e,type:"basic",iconUrl:"/images/cyprite.png"})}),isPageForbidden=(chrome.runtime.onInstalled.addListener(async()=>{var e,t,a=(await chrome.storage.sync.get("lang")).lang||DefaultLang,a=(I18NMessages[a]||I18NMessages[DefaultLang]).contextMenus,a=(chrome.contextMenus.create({id:"launchCyprite",title:a.launch,contexts:["all"]}),chrome.contextMenus.create({id:"translateSelection",title:a.translate,contexts:["selection"]}),chrome.contextMenus.create({id:"autoWrite",title:a.autoWrite,contexts:["editable"],enabled:!1}),chrome.runtime.getManifest().content_scripts);for(e of a)for(t of await chrome.tabs.query({url:e.matches}))if(!t.url.match(/^chrome/i))try{await chrome.scripting.executeScript({files:e.js,target:{tabId:t.id,allFrames:e.all_frames},injectImmediately:"document_start"===e.run_at})}catch{}}),chrome.storage.local.onChanged.addListener(e=>{e.AImodel?.newValue&&(myInfo.model=e.AImodel.newValue)}),chrome.storage.sync.onChanged.addListener(e=>{e.lang?.newValue&&(e=e.lang.newValue||myInfo.lang,e=(I18NMessages[e]||I18NMessages[DefaultLang]).contextMenus,chrome.contextMenus.update("launchCyprite",{title:e.launch}),chrome.contextMenus.update("translateSelection",{title:e.translate}),chrome.contextMenus.update("autoWrite",{title:e.autoWrite}))}),e=>!e||0===e.indexOf("chrome://")),onPageActivityChanged=async(t,a)=>{if(t){var n=await getTabInfo(t);if(n.active){if("show"===a)return}else if("hide"===a)return;try{r=await chrome.tabs.get(t)}catch{r=null}if(!r){if(await delTabInfo(t),"close"!==a)return;r={}}var{title:r,url:i,active:e}=r,s=Date.now();if(["open","show","active","update","loaded"].includes(a))if(e)if(isPageForbidden(i))await inactivePage(n,s,!0);else{let e="open"===a;i!==n.url&&(e=!0,await inactivePage(n,s,!0)),n.active&&"open"!==a||(n.open=s),n.title||(n.title=r),n.active=!0,n.url=i,e&&n.isArticle&&!n.requested&&(n.requested=!0,dispatchEvent({event:"requestCypriteNotify",target:"FrontEnd",tid:t})),await setTabInfo(t,n)}else await inactivePage(n,s);else["hide","idle"].includes(a)?await inactivePage(n,s):"close"===a&&(await inactivePage(n,s,!0),await delTabInfo(t))}},inactivePage=async(e,t,a=!1)=>{var n=!!e.url;0<e.open?e.duration+=t-e.open:n=!1,e.open=-1,e.active=!1,n&&await onPageDurationUpdated(a,e.url,e.duration,e.title),a&&(e.duration=0)},onPageDurationUpdated=async(e,t,a,n)=>{logger.log("PageActivity","Save Data: "+t),await savePageActivities(t,a,n,e);try{sendMessage("SavePageActivity",{url:t,duration:a,title:n,closed:e},"BackEnd")}catch{}},savePageActivities=async(e,t,a,n)=>{var r=await getPageInfo(e);r.reading=!n,r.title||(r.title=a),r.viewed++,r.totalDuration+=t,r.currentDuration=t,r.timestamp=timestmp2str("YYYY/MM/DD hh:mm:ss :WDE:"),console.log(r),await setPageInfo(e,r)},getPageInfo=async e=>{if(e.match(/^chrome/i))return{totalDuration:0,viewed:0};e=parseURL(e);var t=TabInfo[e];return t||(t=await DBs.pageInfo.get("pageInfo",e),logger.log("DB","Get Page Info: "+e),t=t||{totalDuration:0,viewed:0}),t},setPageInfo=async(e,t,a=!1)=>{e.match(/^chrome/i)||(t.url=e,e=parseURL(e),DBs.tmrPageInfos&&clearTimeout(DBs.tmrPageInfos),a?(delete DBs.tmrPageInfos,await DBs.pageInfo.set("pageInfo",e,t),logger.log("DB","Set Page Info: "+e)):DBs.tmrPageInfos=setTimeout(async()=>{delete DBs.tmrPageInfos,await DBs.pageInfo.set("pageInfo",e,t),logger.log("DB","Set Page Info: "+e)},200))},delPageInfo=async(e,t=!1)=>{var a=parseURL(e);DBs.tmrPageInfos&&clearTimeout(DBs.tmrPageInfos),t?(delete DBs.tmrPageInfos,delete TabInfo[a],await DBs.pageInfo.del("pageInfo",a),logger.log("DB","Del Page Info: "+a)):DBs.tmrPageInfos=setTimeout(async()=>{delPageInfo(e,!0)},200)},getTabInfo=async e=>{var t=TabInfo[e];return t||(DBs.pageInfo&&(t=await DBs.pageInfo.get("tabInfo","T-"+e),logger.log("DB","Get TabInfo: "+e)),t=t||{active:!1,duration:0,open:-1}),t},setTabInfo=async(e,t)=>{TabInfo[e]=t,DBs.tmrTabInfos&&clearTimeout(DBs.tmrTabInfos),DBs.tmrTabInfos=setTimeout(async()=>{delete DBs.tmrTabInfos,await DBs.pageInfo.set("tabInfo","T-"+e,t),logger.log("DB","Set TabInfo: "+e)},200)},delTabInfo=async e=>{for(var t in delete TabInfo[e],DBs.tmrTabInfos&&(clearTimeout(DBs.tmrTabInfos),delete DBs.tmrTabInfos),await DBs.pageInfo.all("tabInfo")){var a=t.replace(/^T\-/,"");try{await chrome.tabs.get(+a)}catch{await DBs.pageInfo.del("tabInfo",t),logger.log("DB","Del TabInfo: "+a)}}},TabInfo={};var LastActiveTab=null;let TabPorts=new Map;chrome.tabs.onActivated.addListener(e=>{LastActiveTab=e.tabId,chrome.tabs.connect(LastActiveTab)}),chrome.tabs.onRemoved.addListener(e=>{LastActiveTab===e&&(LastActiveTab=null),onPageActivityChanged(e,"close"),removeAIChatHistory(e),chrome.storage.session.remove(e+":mode")}),chrome.idle.onStateChanged.addListener(e=>{logger.info("Ext","Idle State Changed: "+e),LastActiveTab&&("idle"===e?onPageActivityChanged(LastActiveTab,"idle"):(onPageActivityChanged(LastActiveTab,"active"),chrome.tabs.connect(LastActiveTab)))}),chrome.runtime.onMessage.addListener((e,t)=>{"PopupEnd"!==e.sender&&(t=t.tab?.id,e.sid=t,"me"===e.tid)&&(e.tid=t),dispatchEvent(e)}),chrome.runtime.onConnect.addListener(e=>{var t;"cyberbutler_contentscript"===e.name&&(t=e.sender?.tab?.id)&&(logger.info("PORT","Connect: "+t),TabPorts.set(t,e),e.onMessage.addListener(e=>{"PopupEnd"!==e.sender&&(e.sid=t,"me"===e.tid)&&(e.tid=t),dispatchEvent(e)}),e.onDisconnect.addListener(()=>{logger.info("PORT","Disconnect: "+t),TabPorts.delete(t)}))}),chrome.action.onClicked.addListener(async()=>{var e,t;await checkAvailability()&&([e]=await chrome.tabs.query({active:!0,lastFocusedWindow:!0}),isPageForbidden(e?.url)?await gotoUniquePage(chrome.runtime.getURL("/pages/newtab.html")):((t=await getTabInfo(e.id)).requested=!0,await setTabInfo(e.id,t),dispatchEvent({event:"requestCypriteNotify",data:{forceShow:!0},target:"FrontEnd",tid:e.id})))}),chrome.contextMenus.onClicked.addListener((e,t)=>{0!==e.pageUrl.indexOf("chrome")&&0!==e.frameUrl.indexOf("chrome")&&dispatchEvent({event:"onContextMenuAction",data:{action:e.menuItemId,text:e.selectionText},target:"FrontEnd",tid:t.id})});var lastRequest=[];let EventHandler={},CacheLimit=(globalThis.dispatchEvent=async t=>{if(t.sender=t.sender||"BackEnd","ServerEnd"===t.target)try{sendMessage(t.event,t.data,t.sender,t.sid)}catch{}else if("FrontEnd"===t.target||"PageEnd"===t.target){let e=t.tid;if(e||([a]=await chrome.tabs.query({active:!0,lastFocusedWindow:!0}),a&&(e=a.id)),e=e||LastActiveTab){var a=TabPorts.get(e);if(a)try{await a.postMessage(t)}catch{}}}else if("BackEnd"===t.target){a=EventHandler[t.event];if(!a)return logger.log("SW","Got Event",t);a(t.data,t.sender,t.sid,t.target,t.tid)}else{a=t.tid;if(a)try{await chrome.tabs.sendMessage(a,t)}catch{}}},EventHandler.gotServerReply=e=>{e.ok?getReplyFromServer(e.taskId,e.data):getReplyFromServer(e.taskId,void 0,e.err)},EventHandler.SetConfig=async(e,t,a)=>{if("ConfigPage"===t&&(logger.log("WS","Set Host: "+e.wsHost),myInfo.name=e.name||"",myInfo.info=e.info||"",myInfo.lang=e.lang||DefaultLang,myInfo.apiKey=e.apiKey,myInfo.useLocalKV=!0,updateAIModelList(),myInfo.useLocalKV)){globalThis.sendMessage=DefaultSendMessage,chrome.tabs.sendMessage(a,{event:"connectWSHost",data:{wsHost:e.wsHost,ok:!0},target:t,sender:"BackEnd"});try{AIHandler.sayHello()}catch(e){logger.error("AI:SayHello",e)}}},EventHandler.PageStateChanged=async(e,t,a)=>{"FrontEnd"===t&&(logger.log("Page","State Changed: "+e.state),t=await getTabInfo(a),e&&e.pageInfo&&(t.title=e.pageInfo.title||t.title,t.isArticle=(isBoolean(e.pageInfo.isArticle)?e.pageInfo:t).isArticle,await setTabInfo(a,t)),onPageActivityChanged(a,e.state))},EventHandler.VisibilityChanged=(e,t,a)=>{"FrontEnd"===t&&onPageActivityChanged(a,e)},EventHandler.MountUtil=async(e,t,a)=>{var n;"FrontEnd"===t&&((t=UtilList[e])&&(n=[],t.css&&n.push(chrome.scripting.insertCSS({target:{tabId:a},files:t.css})),t.js&&n.push(chrome.scripting.executeScript({target:{tabId:a},files:t.js,injectImmediately:!0})),await Promise.all(n),logger.log("Page","Notification has mounted!")),dispatchEvent({event:"utilMounted",data:e,target:"FrontEnd",tid:a}))},EventHandler.AskAIAndWait=async(t,e,a)=>{lastRequest[0]=e,lastRequest[1]=a;var n={id:t.id},r="";if(t.action){var i=AIHandler[t.action];try{var s=await i(t.data,e,a);n.result=s,logger.log("AI","Task "+t.action+" Finished")}catch(e){n.result="",r=e.message||e.msg||e.data||e.toString?e.toString():e,logger.error("AI","Task "+t.action+" Failed:"),console.error(e),showSystemNotification(r)}}dispatchEvent({event:"replyAskAndWait",data:{ok:!r,data:n,error:r},target:e,tid:a})},EventHandler.AskSWAndWait=async(t,e,a)=>{lastRequest[0]=e,lastRequest[1]=a;var n={id:t.id},r="";if(t.action){var i=EventHandler[t.action];try{var s=await i(t.data,e,a);n.result=s,logger.log("SW","Task "+t.action+" Finished")}catch(e){n.result="",r=e.message||e.msg||e.data||e.toString?e.toString():e,logger.error("SW","Task "+t.action+" Failed:",r)}}dispatchEvent({event:"replyAskAndWait",data:{ok:!r,data:n,error:r},target:e,tid:a})},EventHandler.SavePageSummary=async(e,t,a)=>{var n=await getTabInfo(a),r=await getPageInfo(n.url);r.title||(r.title=e.title||r.title),e.content&&(r.content=e.content),r.description=e.summary||r.description,r.hash=e.hash||r.hash,r.embedding=e.embedding||r.embedding,await Promise.all([setTabInfo(a,n),setPageInfo(n.url,r)])},EventHandler.GotoConversationPage=async()=>{var e={};e[(await gotoUniquePage(chrome.runtime.getURL("/pages/newtab.html"))).id+":mode"]="crossPageConversation",await chrome.storage.session.set(e)},EventHandler.CalculateHash=async e=>{var t,a=e.content;return a?t=e.algorithm:a=e,calculateHash(a,t)},EventHandler.CheckPageNeedAI=async e=>getPageNeedAIInfo(e),EventHandler.UpdatePageNeedAIInfo=async e=>{var t=await getPageNeedAIInfo(e);t.page.visited++,t.path.visited++,t.host.visited++,e.need&&(t.page.need++,t.path.need++,t.host.need++),await updatePageNeedAIInfo(e,t)},EventHandler.LoadPageSummary=async(e,t,a)=>{a=await chrome.tabs.get(a);return a&&!isPageForbidden(a.url)?getPageInfo(a.url):null},EventHandler.FindSimilarArticle=async e=>{var t=e.vector,a=parseURL(e.url||"");if(!t)return[];var n,r=await DBs.pageInfo.all("pageInfo"),i=[];for(n in r)if(n!==a){var s=r[n];if(s&&s.embedding&&(!e.needContent||s.content)){var o,l={};for(o in s)l[o]=s[o];var g=calculateSimilarityRate(l.embedding,t);0<(l.similar=g)&&i.push(l)}}return logger.log("SIMI",e.url||"(NONE)"),(i=i.filter(e=>.05<=e.similar)).sort((e,t)=>t.similar-e.similar),console.table(i.map(e=>({title:e.title,similar:e.similar}))),i},EventHandler.FindRelativeArticles=async(e,t,a)=>{if(e.url=parseURL(e.url||""),e.url){var n=RelativeHandler[a];if(n!==e.url){RelativeHandler[a]=e.url;var r,n=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang];e.isWebPage=!1,dispatchEvent({event:"updateCurrentStatus",data:n.crossPageConv.statusFindingSimilarFiles,target:t,tid:a});try{e.articles=await EventHandler.FindSimilarArticle(e),r=await findRelativeArticles(e,t,a)}catch{r=null}dispatchEvent({event:"updateCurrentStatus",target:t,tid:a}),r&&(dispatchEvent({event:"foundRelativeArticles",data:r,target:"FrontEnd",tid:a}),await wait(ColdDownDuration),logger.log("SW","Cold Down finished for "+e.url))}delete RelativeHandler[a]}},EventHandler.GetConversation=async e=>{e=parseURL(e);e=await DBs.pageInfo.get("pageConversation",e);return e?e.conversation:null},EventHandler.ClearSummaryConversation=async e=>{e=parseURL(e);try{return await DBs.pageInfo.del("pageConversation",e),!0}catch{return!1}},EventHandler.GetArticleInfo=async e=>{var t,a,n=await DBs.pageInfo.all("pageInfo"),n=Object.keys(n).map(e=>n[e]),r=null,i=!1;return isArray(e)?(t=e[0],a=e[1],!1===t?i=!1:!0!==t&&isArray(t)?(i=!0,r=t):i=!0):e||(i=!0),i&&(n=n.filter(e=>!!e.content&&!!e.hash)),r&&(n=n.filter(e=>r.includes(e.url))),"LastVisit"===a?(n.forEach(e=>{var t=e.timestamp;e._time=t?new Date(t.replace(/\s+[a-z]+$/i,"")).getTime():Date.now()}),n.sort((e,t)=>t._time-e._time)):n.sort((e,t)=>t.totalDuration-e.totalDuration),n},EventHandler.SearchGoogle=async e=>{e=encodeURIComponent(e);var{key:t,cx:a}=myInfo.apiKey?.google||{};if(t&&a){logger.log("GoogleSearch","Search By API");t=`https://www.googleapis.com/customsearch/v1?key=${myInfo.apiKey.google.key}&cx=${myInfo.apiKey.google.cx}&q=${e}&num=10&sort=date-sdate:d:s`;try{var i,n=await waitUntil(fetchWithCheck(t));i=(i=await n.json()).error?(logger.error("GoogleSearch["+i.error.code+"]",i.error.message),null):(logger.info("GoogleSearch",i),(i.items||[]).map(e=>({title:e.title,url:e.link,summary:(e.snippet||"").trim()})))}catch(e){logger.error("GoogleSearch",e),i=null}}if(!i){logger.log("GoogleSearch","Search Via Crab");a=`https://www.google.com/search?q=${e}&hl=en-US&start=0&num=10&ie=UTF-8&oe=UTF-8&gws_rd=ssl`;try{let n=await waitUntil(fetchWithCheck(a));for(n=(n=(n=await n.text()).replace(/<![^>]*?>/gi,"").replace(/<(noscript|script|title|style|header|footer|head|ul|ol)[\w\W]*?>[\w\W]*?<\/\1>/gi,"").replace(/<(meta|input|img)[\w\W]*?>/gi,"").replace(/<[^\/\\]*?[\/\\]>/gi,"").replace(/<\/?(html|body)[^>]*?>/gi,"").replace(/<\/?span[^>]*?>/gi,"").replace(/<\/?(div|br|hr)[^>]*?>/gi,"\n")).replace(/<a[^>]*href=('|")([^'"]*)\1[^>]*>([\w\W]*?)<\/a>/gi,(e,t,a,n)=>a.match(/^https?:\/\/.*?\.google/)||a.match(/^\s*\//)&&!a.match(/^\s*\/url\?/)?"":e);;){var s=n.replace(/<([\w\-_]+)[^>]*?>[\s\r\t\n]*<\/\1>/gi,"");if(n===s)break;n=s}n=n.replace(/^[\w\W]*?<a/i,"<a").replace(/Related searches[\w\W]*?$/i,"").replace(/[\s\r\t]*\n+[\s\r\t]*/g,"\n").replace(/\n+/g,"\n");let r=[];n.replace(/<a[^>]*?>[\s\r\n]*/gi,(e,t)=>{r.push(t)}),r.push(n.length);for(let a=0;a<r.length-1;a++){var o=r[a],l=r[a+1];let e=n.substring(o,l),t=e.match(/^[\s\r\n]*<a[^>]*?href=('|")?([^'"]*?)\1[^>]*?>/i);if(t&&t[2]&&(t=t[2]).match(/^(f|ht)tps?/)){var g,c=parseParams(t);for(g in c){var d=c[g];if(d.match(/^https?/i)){t=decodeURI(d);break}}e=e.replace(/<h3[^>]*>/gi,"\n  Title: ").replace(/<\/h3[^>]*>/gi,"\n  Description: ").replace(/<\/?\w+[^>]*?>/gi,"").replace(/[\s\r\t]*\n+[\s\r\t]*/g,"\n").replace(/\n+/g,"\n").replace(/^\n+|\n+$/g,"").replace(/\n  Title:\s*\n\s*/gi,"\n  Title: ").replace(/\n  Description:\s*\n\s*/gi,"\n  Description: ").replace(/&#(\d+);/g,(e,t)=>{var a;try{a=String.fromCharCode(+t)}catch{a=e}return a}),r[a]=[t,e]}}(r=r.filter(e=>isArray(e))).length?(i=[],r.forEach(e=>{var t,n;e&&e[0]&&(t=(t=(t=e[1]||"").split("\n")).map(e=>e.replace(/^\-\s*/,"\n  ")).join("\n  "),n={url:e[0]},t.replace(/Title:\s*([\w\W]*?)\s*Description:|Title:\s*([\w\W]*?)\s*$/i,(e,t,a)=>{t=t||a;t&&(n.title=t)}),t.replace(/Description:\s*([\w\W]*?)\s*Title:|Description:\s*([\w\W]*?)\s*$/i,(e,t,a)=>{t=t||a;t&&(n.summary=t)}),n.title||(n.title=e[1]||""),n.summary||(n.summary=e[1]||""),i.push(n))})):i=[]}catch(e){return logger.error("GoogleCrab",e),[]}}return i},EventHandler.ReadWebPage=async e=>{var t;try{t=await(t=await waitUntil(fetch(e))).text()}catch{return null}return t},EventHandler.RemovePageInfo=async e=>{await delPageInfo(e,!0)},EventHandler.RemovePageInfos=async e=>{var t,a=await DBs.pageInfo.all("pageInfo"),n=(console.log(a),[]);for(t in a){var r=a[t];e?r.content||n.push(t):r.hash&&r.embedding||n.push(t)}console.log(n),await Promise.all(n.map(async e=>{await delPageInfo(e,!0)}))},EventHandler.ChangePageTitle=async e=>{var t=await getPageInfo(e.url);t.title=e.title,await setPageInfo(e.url,t,!0)},globalThis.AIHandler={},432e5),removeAIChatHistory=async e=>{var t=[];if(e&&(n=Tab2Article[e])){delete Tab2Article[e];for(var a of n)t.push(DBs.pageInfo.del("pageConversation",a));t.length&&(await Promise.all(t),logger.log("Chat","Remove Inside Tab History:",n))}var n,r,t=[],i=Date.now(),s=[];for(r in n=await DBs.pageInfo.all("pageConversation"))i-n[r].timestamp>=CacheLimit&&(s.push(r),t.push(DBs.pageInfo.del("pageConversation",r)));t.length&&(await Promise.all(t),logger.log("Chat","Remove Expired History:",s))},parseReplyAsXMLToJSON=i=>{var s={_origin:i.trim()},o=-1,l=0;let g=/<(\/?)([^>]+?)>/gi;return i.replace(g,(e,t,a,n)=>{var r;(t=!!t)?0===--l&&0<=o?(t=i.substring(o,n).trim(),o=-1,t.match(g)?s[a]=parseReplyAsXMLToJSON(t):"true"===(r=t.toLowerCase())?s[a]=!0:"false"===r?s[a]=!1:t.match(/^(\d+|\d+\.|\.\d+|\d+\.\d+)$/)?s[a]=+t:s[a]=t):l<0&&(l=0):1===++l&&(o=n+e.length)}),s},Tab2Article=(AIHandler.sayHello=async()=>{var e=timestmp2str("YYYY/MM/DD"),t=(await chrome.storage.session.get("lastHello")).lastHello;t&&t===e||(chrome.storage.session.set({lastHello:e}),t=await callAIandWait("sayHello"),showSystemNotification(t))},AIHandler.summarizeArticle=async e=>{var t,a;if(await checkAvailability())return[t,a]=await Promise.all([callAIandWait("summarizeArticle",e.article),(async()=>{try{return await callAIandWait("embeddingArticle",e)}catch(e){logger.error("SummarizeArticle",e)}})()]),{summary:t,embedding:a}},AIHandler.embeddingContent=async e=>await callAIandWait("embeddingArticle",e),AIHandler.askArticle=async(t,e,a)=>{var n=Tab2Article[a],r=parseURL(t.url),a=(n||(n=[],Tab2Article[a]=n),n=null,n=(n=await DBs.pageInfo.get("pageConversation",r))?n.conversation:[],{lang:LangName[myInfo.lang]});if(a.content="<currentArticle>\n"+t.content.trim()+"\n</currentArticle>",t.related){let e=await Promise.all(t.related.map(async e=>{var t=await getPageInfo(parseURL(e.url));return t?'<referenceMaterial title="'+(e.title||t.title)+'" url="'+t.url+'">\n'+t.description.trim()+"\n</referenceMaterial>":null}));e=e.filter(e=>!!e),a.related=e.join("\n")}else a.related="(No Reference Material)";a=PromptLib.assemble(PromptLib.askPageSystem,a),(n=n.filter(e=>"system"!==e[0])).unshift(["system",a]),n.push(["human",t.question]),console.log(n),a=await callAIandWait("directAskAI",[...n]);return n.push(["ai",a]),await DBs.pageInfo.set("pageConversation",r,{conversation:n,timestamp:Date.now()}),removeAIChatHistory(),a},AIHandler.translateContent=async(e,t,a)=>{if(!await checkAvailability())return"";var n=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang];e.requirement=e.requirement||"(No Extra Requirement)",e.myLang=LangName[myInfo.lang]||myInfo.lang;var r=[["human",PromptLib.assemble(PromptLib.firstTranslation,e)]],r=await callAIandWait("directAskAI",r),i=parseReplyAsXMLToJSON(r),s=(logger.log("Translate",i),i.translation&&(r=i.translation._origin||i.translation),dispatchEvent({event:"updateCurrentStatus",data:n.translation.afterFirstTranslate,target:t,tid:a}),dispatchEvent({event:"finishFirstTranslation",data:r,target:t,tid:a}),e.translation=r,i=PromptLib.assemble(PromptLib.reflectTranslation,e),await callAIandWait("directAskAI",[["human",i]]));return(s=parseReplyAsXMLToJSON(s)).needOptimize&&(s.deficiencies||s.suggestions)&&(dispatchEvent({event:"updateCurrentStatus",data:n.translation.afterReflect,target:t,tid:a}),(n=[]).push("#\tDeficiencies"),s.deficiencies?(s.deficiencies=s.deficiencies._origin||s.deficiencies,n.push(s.deficiencies)):n.push("(No deficiency be mentioned.)"),n.push("#\tSuggestions"),s.suggestions?(s.suggestions=s.suggestions._origin||s.suggestions,n.push(s.suggestions)):n.push("(No suggestion be provided.)"),e.suggestions=n.join("\n\n"),i=PromptLib.assemble(PromptLib.deepTranslation,e),console.log(i),r=await callAIandWait("directAskAI",[["human",i]])),dispatchEvent({event:"updateCurrentStatus",data:"",target:t,tid:a}),r},AIHandler.translateSentence=async(e,t,a)=>{var n;if(await checkAvailability())return e.myLang=LangName[myInfo.lang]||myInfo.lang,e=await callAIandWait("translateSentence",e),n=parseReplyAsXMLToJSON(e),logger.log("Translate",n),e=(e=(n||{}).translation||e)._origin?e._origin:e},AIHandler.selectArticlesAboutConversation=async(e,t,a)=>{var n,r,i=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang],s=SimilarLimit;isObject(e)&&(s=e.limit||s,e=e.request),dispatchEvent({event:"updateCurrentStatus",data:i.crossPageConv.statusAnalyzeRequest,target:t,tid:a});try{var o=await AIHandler.embeddingContent({article:e});dispatchEvent({event:"updateCurrentStatus",data:i.crossPageConv.statusFindingSimilarFiles,target:t,tid:a}),n=await EventHandler.FindSimilarArticle({vector:o,needContent:!0})}catch{let t=await DBs.pageInfo.all("pageInfo");(t=(t=Object.keys(t).map(e=>t[e])).filter(e=>!!e.content&&!!e.hash)).forEach(e=>e._time=new Date(e.timestamp.replace(/\s+[a-z]+$/i,"")).getTime()),t.sort((e,t)=>t._time-e._time),n=t}try{r=await findRelativeArticles({articles:n,requests:[e],isWebPage:!0,limit:s},t,a)}catch{r=[]}return dispatchEvent({event:"updateCurrentStatus",target:t,tid:a}),r},AIHandler.crossPageConversation=async e=>await callAIandWait("directAskAI",e),AIHandler.getSearchKeyWord=async e=>{var t=[],e=(t.push(["human",PromptLib.assemble(PromptLib.analyzeSearchKeyWords,{tasks:e,time:timestmp2str("YYYY/MM/DD hh:mm :WDE:")})]),getFunctionalModelList("analyzeSearchKeywords")),a=await callLLMOneByOne(e,t,!0,"SearchKeywords");return["search","arxiv","wikipedia"].forEach(e=>{var t=(t=a[e]||"").replace(/[\n\r]+/g,"\n").split("\n").map(e=>e.replace(/^[\s\-]*|\s*$/gi,"")).filter(e=>!!e&&!e.match(/^\s*\(?\s*(none|n\/a|null|nil)\s*\)?\s*$/i));a[e]=t}),logger.info("SearchKeywords",a.search.length+a.arxiv.length+a.wikipedia.length+" / "+a.search.length+" / "+a.arxiv.length+" / "+a.wikipedia.length),a},AIHandler.callLLMForSearch=async e=>{var t,a;for(a of SearchAIModel){var n,r=a.toLowerCase();if("ernie"===r){var i=myInfo.apiKey[r];if(!i||!i.api||!i.secret)continue}else if(!myInfo.apiKey[r])continue;try{if((n=await AI[a].search(e))&&n.length){t=n;break}}catch(e){logger.error("LLMSearch["+a+"]",e)}}return t||[]},AIHandler.findRelativeWebPages=async(e,t,a)=>(e.isWebPage=!0,findRelativeArticles(e,t,a)),AIHandler.replyBasedOnSearch=async e=>{logger.info("ReplyBasedOnSearch","Start"),e.webpages=e.webpages.map(e=>{var t=["<webpage>"];return t.push("<title>"+e.title+"</title>"),t.push("<url>"+e.url+"</title>"),e.summary&&(t.push("<summary>"),t.push(e.summary),t.push("</summary>")),t.push("</webpage>"),t.join("\n")}).join("\n\n");var t=PromptLib.assemble(PromptLib.replyBasedOnSearch,{lang:LangName[myInfo.lang]||myInfo.lang,request:e.request}),a=t.indexOf("{{webpages}}"),n=a+"{{webpages}}".length,a=t.substring(0,a),n=t.substring(n),a=[["human",t=a+e.webpages+n]],e=(logger.info("ReplyBasedOnSearch","Prompt Assembled",a),await callAIandWait("directAskAI",a));return(e=parseReplyAsXMLToJSON(e)).reply?e.reply=e.reply._origin||e.reply:e={reply:e._origin},e.more=(e.more||"").replace(/[\n\r]+/g,"\n").split("\n").map(e=>e.replace(/(^\s*([\-\+\*]\s+)*|\s*$)/g,"")).filter(e=>!!e),logger.info("ReplyBasedOnSearch","Got Reply:",e),e},AIHandler.replyAISearch=async e=>{logger.info("AdvAISearch","Start"),e.webpages=e.webpages.map(e=>{var t=["<article>"];return t.push("<title>"+e.title+"</title>"),t.push("<url>"+e.url+"</title>"),t.push("<content>"),t.push(e.content),t.push("</content>"),t.push("</article>"),t.join("\n")}).join("\n\n");var t=PromptLib.assemble(PromptLib.replySearchRequest,{lang:LangName[myInfo.lang]||myInfo.lang,request:e.request}),a=t.indexOf("{{webpages}}"),n=a+"{{webpages}}".length,a=t.substring(0,a),n=t.substring(n),a=[["human",t=a+e.webpages+n]],e=(logger.info("AdvAISearch","Prompt Assembled",a),await callAIandWait("directAskAI",a));return logger.info("AdvAISearch","Got Reply"),e},AIHandler.preliminaryThinking=async(e,t,a)=>{var n,r=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang],e={lang:LangName[myInfo.lang]||myInfo.lang,request:e.request,time:timestmp2str("YYYY/MM/DD hh:mm :WDE:")},e=[["human",PromptLib.assemble(PromptLib.deepThinkingStep0,e)]];logger.info("PreliminaryThinking","Prompt Assembled",[...e]);try{n=(n=await callAIandWait("directAskAI",e)).trim(),logger.info("PreliminaryThinking","Got Reply:\n",n)}catch(e){logger.error("PreliminaryThinking",e),n=r.aiSearch.msgPreliminaryThinkingFailed}return n},AIHandler.deepThinking=async(e,t,a)=>{var n=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang],r={lang:LangName[myInfo.lang]||myInfo.lang,request:e.request,time:timestmp2str("YYYY/MM/DD hh:mm :WDE:")},i=(e.webpages=e.webpages.map(e=>{var t=["<article>"];return t.push("<title>"+e.title.replace(/\s+/g," ")+"</title>"),t.push("<url>"+e.url+"</title>"),t.push("<responseOrSummary>"),t.push(e.reply),t.push("</responseOrSummary>"),t.push("</article>"),t.join("\n")}).join("\n\n"),e.basicAnswer||""),s="",o="",l="",g=(logger.info("DeepThinking","Start Deep Thingking"),dispatchEvent({event:"updateDeepThinkingStatus",data:n.aiSearch.msgLearningMaterial,target:t,tid:a}),PromptLib.assemble(PromptLib.deepThinkingStep1,r)),c=g.indexOf("{{webpages}}"),d=c+"{{webpages}}".length,m=g.substring(0,c),p=g.substring(d),u=[["human",g=m+e.webpages+p]];logger.info("DeepThinking","LRM Prompt Assembled",[...u]);try{console.log("LM:",u),s=(l=await callAIandWait("directAskAI",u)).trim(),logger.info("DeepThinking","LRM Got Reply:\n",s),s=s&&"# "+n.aiSearch.hintLearnFromInternet+"\n\n"+s}catch(e){return logger.error("DeepThinking",e),[""]}dispatchEvent({event:"updateDeepThinkingStatus",data:n.aiSearch.msgDeepThinking,target:t,tid:a}),d=(c=(g=PromptLib.assemble(PromptLib.deepThinkingStep2System,r)).indexOf("{{webpages}}"))+"{{webpages}}".length,m=g.substring(0,c),p=g.substring(d),u=[["system",g=m+e.webpages+p]],g=PromptLib.assemble(PromptLib.deepThinkingStep2Summary,r),u.push(["human",g]),u.push(["ai",s]);t={};i?(t.otheropinion=i,i="# "+n.aiSearch.hintMyPreliminaryThinking+"\n\n"+i):t.otheropinion=n.aiSearch.hintNoOpinion,g=PromptLib.assemble(PromptLib.deepThinkingStep2Running,r,t),u.push(["human",g]),logger.info("DeepThinkingStep2","DT Prompt Assembled",[...u]);try{console.log("DT:",u),l=(l=await callAIandWait("directAskAI",u)).trim(),logger.info("DeepThinkingStep2","DT Got Reply:\n",l);var h=parseReplyAsXMLToJSON(l);o=(o=h.more._origin||h.more||"").replace(/[\n\r]+/g,"\n").split("\n").map(e=>e.replace(/(^\s*([\-\+\*]\s+)*|\s*$)/g,"")).filter(e=>!!e),l=(l=h.reply._origin||h.reply||l)||n.refreshHint}catch(e){logger.error("DeepThinking",e),l=n.refreshHint}return u.pop(),g=PromptLib.assemble(PromptLib.deepThinkingStep2Replace,r,t),u.push(["human",g]),u.push(["ai",l]),u.push(["human",PromptLib.deepThinkingStep3Running]),u.push(["ai",PromptLib.deepThinkingStep3Reply]),console.log("ED:",u),l=["# "+n.aiSearch.hintMyResponseAfterReflection+"\n\n"+l],s&&l.unshift(s),i&&l.unshift(i),[l=l.join("\n\n----\n\n"),u,o]},AIHandler.raedAndReply=async e=>{logger.info("SummaryAndReply","Start");var t=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang],a=PromptLib.assemble(PromptLib.replyRequestBasedOnArticle,{lang:myInfo.lang,request:e.request}),n=a.indexOf("{{content}}"),r=n+"{{content}}".length,n=a.substring(0,n),r=a.substring(r);a=[["human",a=n+e.content+r]],logger.info("SummaryAndReply","Prompt Assembled");n=(n=await callAIandWait("directAskAI",a)).trim(),e=parseReplyAsXMLToJSON(n);return e.summary?e.summary=e.summary._origin||e.summary:e.summary="",e.reply=e.reply?e.reply._origin||e.reply:n,logger.info("SummaryAndReply","Got Reply"),console.log(e),e.relevant?e.reply&&(r=[],e.summary&&r.push("## "+t.aiSearch.hintPageSummary+"\n\n"+e.summary.trim()),r.push("## "+t.aiSearch.hintPageReply+"\n\n"+e.reply.trim()),n=r.join("\n\n")):n="",n},{}),RelativeHandler={},ColdDownDuration=3e5,WaitDuration=5e3,RelativeArticleRange=40,getPageNeedAIInfo=(globalThis.waitUntil=s=>new Promise((t,a)=>{var[e,n]=lastRequest;let r=setInterval(()=>{logger.log("Ext","Reactive and waiting..."),dispatchEvent({event:"requestHeartBeating",target:e,tid:n}),dispatchEvent({event:"requestHeartBeating",target:"FrontEnd",tid:LastActiveTab}),dispatchEvent({event:"requestHeartBeating",target:"HomeScreen",tid:LastActiveTab})},WaitDuration);if(isFunction(s))if(isAsyncFunction(s))s().then(e=>{t(e)}).catch(e=>{a(e)}).finally(()=>{clearInterval(r)});else{clearInterval(r);try{var i=s();t(i)}catch(e){a(e)}}else s.then(e=>{t(e)}).catch(e=>{a(e)}).finally(()=>{clearInterval(r)})}),globalThis.fetchWithCheck=(e,i,s,o)=>new Promise((t,a)=>{o=o||5e3,s=s||((s=e.match(/\w+:\/+[^\/]+\//))?s[0]:e);var n=!1,r=(fetch(e,i).then(e=>{n||(n=!0,clearTimeout(r),t(e))}).catch(e=>{n||(n=!0,clearTimeout(r),a(e))}),fetch(s).then(()=>{n||clearTimeout(r)}).catch(e=>{n||(n=!0,clearTimeout(r),a(e))}),setTimeout(()=>{n||(n=!0,a(new Error("Check Connection Timeout: "+s)))},o))}),async e=>{e=await Promise.all([DBs.pageInfo.get("notifyChecker",e.page),DBs.pageInfo.get("notifyChecker",e.path),DBs.pageInfo.get("notifyChecker",e.host)]);return(e={page:e[0],path:e[1],host:e[2]}).page||(e.page={need:0,visited:0}),e.path||(e.path={need:0,visited:0}),e.host||(e.host={need:0,visited:0}),e}),updatePageNeedAIInfo=async(e,t)=>{await Promise.all([DBs.pageInfo.set("notifyChecker",e.page,t.page),DBs.pageInfo.set("notifyChecker",e.path,t.path),DBs.pageInfo.set("notifyChecker",e.host,t.host)])},manhattanOfVectors=(t,a)=>{var n=Math.min(t.length,a.length),r=0;for(let e=0;e<n;e++)r=Math.max(r,Math.abs(t[e]-a[e]));return r},innerProductOfVectors=(t,a)=>{var n=Math.min(t.length,a.length),r=0;for(let e=0;e<n;e++)r+=t[e]*a[e];return r},calculateSimilarityRate=(i,e)=>{var r,t,s,o,l;return i&&e?(s=t=r=0,i.forEach(e=>{e.weight>r&&(r=e.weight)}),e.forEach(e=>{e.weight>t&&(t=e.weight),s+=e.weight**2}),s/=t,o=0,l=[],e.forEach(a=>{var e,t=a.weight,n=(a=a.vector,0),r=-1;i.forEach((e,t)=>{e=e.vector;e=innerProductOfVectors(e,a);n<e&&(r=t,n=e)}),r<0||((e=l[r])||(l[r]=e=[]),e.push([t,n]))}),r=0,l.forEach((e,t)=>{var a,n;e&&(a=i[t].weight,r<a&&(r=a),n=0,e.forEach(e=>{n+=a*e[0]*e[1]}),o+=n/r/s)}),o):0},initInjectScript=async()=>{var e="CypriteInjection";0<(await chrome.userScripts.getScripts({ids:[e]})).length||(chrome.userScripts.configureWorld({messaging:!0}),await chrome.userScripts.register([{id:e,matches:["*://*/*"],js:[{file:"inject.js"}],world:"MAIN"}]))},decomposePackage=(t,e=20)=>{t=[...t];var a=Math.floor(t.length/e);if(0===a)return[t];var n=[];for(let e=0;e<a;e++){var r=Math.round(t.length/(a-e)),r=t.splice(0,r);n.push(r)}return n},getIrrelevants=async(a,e,t,n,r)=>{var i=[],s=[],o=n?PromptLib.excludeIrrelevantsOnTopic:PromptLib.excludeIrrelevantsOnArticle,l={content:t};return n||(l.summary=r),await Promise.all(e.map(async e=>{l.list=e.map(e=>"- ["+e.title+"]("+e.url+")").join("\n");let t=[["human",PromptLib.assemble(o,l)]],n;n=(n=await callLLMOneByOne(a,t,!0,"ExcludeIrrelevants"))||{},["unrelated","related"].forEach(e=>{var t=n[e]||"",a=[],t=t.replace(/[\r\n]+/g,"\n").split(/\n+/).forEach(e=>{var t=(e=e.replace(/^\s*\-\s+/i,"").trim()).match(/\(\s*(https?:[^\[\] ]+[^\\\[\] ])(\\\\)*\)/);if(t)e=t[1];else{if(!(t=e.match(/https?:[^\[\] ]+/)))return;e=t[0]}a.push(e)});n[e]=a}),n.unrelated.forEach(e=>{i.push(e)}),n.related.forEach(e=>{s.push(e)})})),[i,s]},getRelevants=async(t,e,a,n,r)=>{var i=[],s=n?PromptLib.filterRelevantsOnTopic:PromptLib.filterRelevantsOnArticle,o={content:a};return n||(o.summary=r),await Promise.all(e.map(async e=>{o.list=e.map(e=>{var t="<webpage>\n<title>"+e.title+"</title>\n<url>"+e.url+"</url>";return(e.description||e.summary)&&(t=t+"\n<summary>\n"+(e.description||e.summary)+"\n</summary>"),t+="\n</webpage>"}).join("\n");e=[["human",PromptLib.assemble(s,o)]],e=("\n"+await callAIandWait("directAskAI",{conversation:e,model:t})+"\n").match(/[\-\+]\s+[^\n\r]+?[\n\r]/gi);e&&e.forEach(e=>{(e=e.replace(/[\-\+]\s+/i,"").trim()).match(/^\[[^\n\r]+?\]\(/)&&(e=e.replace(/^\[[^\n\r]+?\]\(/,"").replace(/\)$/,"").trim()),i.includes(e)||i.push(e)})})),i},findRelativeArticles=async(r,e,t)=>{if(myInfo.inited||await getWSConfig(),await checkAvailability()){for(var a=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang],n=!isBoolean(r.isWebPage)||r.isWebPage,i=(r.requests||[]).join("\n\n")||"(NONE)",s=(r.content||[]).map(e=>"<summary>\n"+e.trim()+"\n</summary>").join("\n\n")||"(NONE)",o=(logger.log("SW",r.articles.length+" Similar Articles for "+(r.url||"(NONE)")),dispatchEvent({event:"updateCurrentStatus",data:a.crossPageConv.hintExcludeIrrelevants,target:e,tid:t}),getFunctionalModelList("excludeIrrelevants")),l=[...r.articles],g=0,c=[],d=Date.now();;){g++;let e=decomposePackage(l,70),t,a;try{[t,a]=await getIrrelevants(o,e,i,n,s)}catch(e){t=[],a=[],console.error(e)}if(logger.info("Filter Irrelevants","Excludes("+g+"): "+t.length+" / "+a.length),t.forEach(e=>{c.includes(e)||c.push(e)}),l=(l=l.filter(e=>!t.includes(e.url))).filter(e=>!a.includes(e.url)),3<=g||l.length<=20||t.length+a.length<=7)break}d=Date.now()-d,logger.info("Exclude Irrelevants",d+"ms, "+c.length);for(var m,l=r.articles.filter(e=>!c.includes(e.url)),p=r.limit||RelativeArticleRange,u=(l.length>p&&l.splice(p),r.articles=[...l],console.log(l.map(e=>"-\t"+e.title+" : "+e.url).join("\n")),dispatchEvent({event:"updateCurrentStatus",data:a.crossPageConv.statusFindingRelatedFiles,target:e,tid:t}),(o=getFunctionalModelList("identityRelevants"))[0]),h=0,g=0,f=[],d=Date.now();;){g++;let e=decomposePackage(l,5),t;for(;;){logger.log("Identify Relevants","Curent Model: "+u);try{t=await getRelevants(u,e,i,n,s);break}catch(e){if(logger.error("Identify Relevants",e),t=[],++h>=o.length){m=e;break}u=o[h]}}if(logger.info("Identify Relevants","Filter("+g+"): "+t.length),m){showSystemNotification(m);break}if(t.forEach(e=>{f.push(parseURL(e))}),l=l.filter(e=>!t.includes(e.url)),2<=g||t.length<=2||l.length<=3)break}if(d=Date.now()-d,logger.info("Identify Relevants",u+" : "+d+"ms, "+f.length),n){let a=[];f.forEach(t=>{r.articles.some(e=>{if(e.url===t)return a.push(e),!0})}),f=a}else f=(f=await Promise.all(f.map(async e=>{var t=await getPageInfo(e);if(!t||!t.hash||t.hash===r.hash)return null;var a,n={};for(a in t)n[a]=t[a];return n.similar=100,n}))).filter(e=>!!e);return console.log(f.map(e=>"-\t"+e.title+" : "+e.url).join("\n")),dispatchEvent({event:"updateCurrentStatus",target:e,tid:t}),f}},parseParams=e=>{var a={};return(e=(e||"").split("?")).shift(),(e=(e||"").join("?").split("&")).forEach(e=>{var t=(e=e.split("=")).shift();t&&(e=e.join("="),a[t]=e)}),a};initDB(),EventHandler.notify=(e,t,a)=>{var n="Server";"BackEnd"===t?n="Background":"FrontEnd"===t?n="Content":"PageEnd"===t&&(n="Injection"),isString(e)||isNumber(e)||isBoolean(e)||(e=JSON.stringify(e)),logger.log("Notify | "+n,e)};