import"./components/jsrsasign.all.min.js";import"./script/i18n.js";import"./script/ai/config.js";import"./script/common.js";import"./script/cachedDB.js";import"./script/ai.js";import"./script/socket.js";let UtilList={notification:{js:["/components/notification.js"],css:["/components/notification.css","/components/mention.css"]},panel:{js:["/components/marked.min.js","/pages/inner.js"],css:["/components/panel.css"]}},SimilarLimit=20,DBs=(globalThis.myInfo={useLocalKV:!0,apiKey:"",lang:DefaultLang,name:"主人",info:"(Not set yet)",model:ModelList[0]},{}),initDB=async()=>{let e=new CachedDB("PageInfos",1);e.onUpdate(()=>{e.open("tabInfo","tid"),e.open("pageInfo","url"),e.open("notifyChecker","url"),e.open("pageConversation","url"),logger.info("DB","Updated")}),e.onConnect(()=>{globalThis.dbPageInfos=e,logger.info("DB","Connected")}),await e.connect(),DBs.pageInfo=e},gotoUniquePage=async e=>{console.log(">>>>>>>>>>>>>>>>    1",e);var t=(t=await chrome.tabs.query({url:e}))&&t[0];return console.log(">>>>>>>>>>>>>>>>    2",t),t?(console.log(">>>>>>>>>>>>>>>>    4"),await chrome.tabs.update(t.id,{active:!0,highlighted:!0})):(console.log(">>>>>>>>>>>>>>>>    3"),t=await chrome.tabs.create({url:e})),t},configureCyberButler=()=>{gotoUniquePage(chrome.runtime.getURL("pages/config.html"))},showSystemNotification=(globalThis.checkAvailability=async()=>{var e=!0;return(e=myInfo.useLocalKV?myInfo.edgeAvailable:!!await getWSConfig())||configureCyberButler(),e},e=>{var t=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang];isString(e)||(e=e.message||e.msg||e.data||e.toString()),chrome.notifications.create({title:t.cypriteName,message:e,type:"basic",iconUrl:"/images/cyprite.png"})}),isPageForbidden=(chrome.runtime.onInstalled.addListener(async()=>{var e,t,a=(await chrome.storage.sync.get("lang")).lang||DefaultLang,a=(I18NMessages[a]||I18NMessages[DefaultLang]).contextMenus,a=(chrome.contextMenus.create({id:"launchCyprite",title:a.launch,contexts:["all"]}),chrome.contextMenus.create({id:"translateSelection",title:a.translate,contexts:["selection"]}),chrome.contextMenus.create({id:"autoWrite",title:a.autoWrite,contexts:["editable"],enabled:!1}),chrome.runtime.getManifest().content_scripts);for(e of a)for(t of await chrome.tabs.query({url:e.matches}))if(!t.url.match(/^chrome/i))try{await chrome.scripting.executeScript({files:e.js,target:{tabId:t.id,allFrames:e.all_frames},injectImmediately:"document_start"===e.run_at})}catch{}}),chrome.storage.local.onChanged.addListener(e=>{e.AImodel?.newValue&&(myInfo.model=e.AImodel.newValue)}),chrome.storage.sync.onChanged.addListener(e=>{e.lang?.newValue&&(e=e.lang.newValue||myInfo.lang,e=(I18NMessages[e]||I18NMessages[DefaultLang]).contextMenus,chrome.contextMenus.update("launchCyprite",{title:e.launch}),chrome.contextMenus.update("translateSelection",{title:e.translate}),chrome.contextMenus.update("autoWrite",{title:e.autoWrite}))}),e=>!e||0===e.indexOf("chrome://")),onPageActivityChanged=async(t,a)=>{if(t){var n=await getTabInfo(t);if(n.active){if("show"===a)return}else if("hide"===a)return;try{r=await chrome.tabs.get(t)}catch{r=null}if(!r){if(await delTabInfo(t),"close"!==a)return;r={}}var{title:r,url:i,active:e}=r,s=Date.now();if(["open","show","active","update","loaded"].includes(a))if(e)if(isPageForbidden(i))await inactivePage(n,s,!0);else{let e="open"===a;i!==n.url&&(e=!0,await inactivePage(n,s,!0)),n.active&&"open"!==a||(n.open=s),n.title||(n.title=r),n.active=!0,n.url=i,e&&n.isArticle&&!n.requested&&(n.requested=!0,dispatchEvent({event:"requestCypriteNotify",target:"FrontEnd",tid:t})),await setTabInfo(t,n)}else await inactivePage(n,s);else["hide","idle"].includes(a)?await inactivePage(n,s):"close"===a&&(await inactivePage(n,s,!0),await delTabInfo(t))}},inactivePage=async(e,t,a=!1)=>{var n=!!e.url;0<e.open?e.duration+=t-e.open:n=!1,e.open=-1,e.active=!1,n&&await onPageDurationUpdated(a,e.url,e.duration,e.title),a&&(e.duration=0)},onPageDurationUpdated=async(e,t,a,n)=>{logger.log("PageActivity","Save Data: "+t),await savePageActivities(t,a,n,e);try{sendMessage("SavePageActivity",{url:t,duration:a,title:n,closed:e},"BackEnd")}catch{}},savePageActivities=async(e,t,a,n)=>{var r=await getPageInfo(e);r.reading=!n,r.title||(r.title=a),r.viewed++,r.totalDuration+=t,r.currentDuration=t,r.timestamp=timestmp2str("YYYY/MM/DD hh:mm:ss :WDE:"),console.log(r),await setPageInfo(e,r)},getPageInfo=async e=>{if(e.match(/^chrome/i))return{totalDuration:0,viewed:0};e=parseURL(e);var t=TabInfo[e];return t||(t=await DBs.pageInfo.get("pageInfo",e),logger.log("DB","Get Page Info: "+e),t=t||{totalDuration:0,viewed:0}),t},setPageInfo=async(e,t,a=!1)=>{e.match(/^chrome/i)||(t.url=e,e=parseURL(e),DBs.tmrPageInfos&&clearTimeout(DBs.tmrPageInfos),a?(delete DBs.tmrPageInfos,await DBs.pageInfo.set("pageInfo",e,t),logger.log("DB","Set Page Info: "+e)):DBs.tmrPageInfos=setTimeout(async()=>{delete DBs.tmrPageInfos,await DBs.pageInfo.set("pageInfo",e,t),logger.log("DB","Set Page Info: "+e)},200))},delPageInfo=async(e,t=!1)=>{var a=parseURL(e);DBs.tmrPageInfos&&clearTimeout(DBs.tmrPageInfos),t?(delete DBs.tmrPageInfos,delete TabInfo[a],await DBs.pageInfo.del("pageInfo",a),logger.log("DB","Del Page Info: "+a)):DBs.tmrPageInfos=setTimeout(async()=>{delPageInfo(e,!0)},200)},getTabInfo=async e=>{var t=TabInfo[e];return t||(DBs.pageInfo&&(t=await DBs.pageInfo.get("tabInfo","T-"+e),logger.log("DB","Get TabInfo: "+e)),t=t||{active:!1,duration:0,open:-1}),t},setTabInfo=async(e,t)=>{TabInfo[e]=t,DBs.tmrTabInfos&&clearTimeout(DBs.tmrTabInfos),DBs.tmrTabInfos=setTimeout(async()=>{delete DBs.tmrTabInfos,await DBs.pageInfo.set("tabInfo","T-"+e,t),logger.log("DB","Set TabInfo: "+e)},200)},delTabInfo=async e=>{for(var t in delete TabInfo[e],DBs.tmrTabInfos&&(clearTimeout(DBs.tmrTabInfos),delete DBs.tmrTabInfos),await DBs.pageInfo.all("tabInfo")){var a=t.replace(/^T\-/,"");try{await chrome.tabs.get(+a)}catch{await DBs.pageInfo.del("tabInfo",t),logger.log("DB","Del TabInfo: "+a)}}},TabInfo={};var LastActiveTab=null;let TabPorts=new Map;chrome.tabs.onActivated.addListener(e=>{LastActiveTab=e.tabId,chrome.tabs.connect(LastActiveTab)}),chrome.tabs.onRemoved.addListener(e=>{LastActiveTab===e&&(LastActiveTab=null),onPageActivityChanged(e,"close"),removeAIChatHistory(e),chrome.storage.session.remove(e+":mode")}),chrome.idle.onStateChanged.addListener(e=>{logger.info("Ext","Idle State Changed: "+e),LastActiveTab&&("idle"===e?onPageActivityChanged(LastActiveTab,"idle"):(onPageActivityChanged(LastActiveTab,"active"),chrome.tabs.connect(LastActiveTab)))}),chrome.runtime.onMessage.addListener((e,t)=>{"PopupEnd"!==e.sender&&(t=t.tab?.id,e.sid=t,"me"===e.tid)&&(e.tid=t),dispatchEvent(e)}),chrome.runtime.onConnect.addListener(e=>{var t;"cyberbutler_contentscript"===e.name&&(t=e.sender?.tab?.id)&&(logger.info("PORT","Connect: "+t),TabPorts.set(t,e),e.onMessage.addListener(e=>{"PopupEnd"!==e.sender&&(e.sid=t,"me"===e.tid)&&(e.tid=t),dispatchEvent(e)}),e.onDisconnect.addListener(()=>{logger.info("PORT","Disconnect: "+t),TabPorts.delete(t)}))}),chrome.action.onClicked.addListener(async()=>{var e,t;await checkAvailability()&&([e]=await chrome.tabs.query({active:!0,lastFocusedWindow:!0}),isPageForbidden(e?.url)?await gotoUniquePage(chrome.runtime.getURL("/pages/newtab.html")):((t=await getTabInfo(e.id)).requested=!0,await setTabInfo(e.id,t),dispatchEvent({event:"requestCypriteNotify",data:{forceShow:!0},target:"FrontEnd",tid:e.id})))}),chrome.contextMenus.onClicked.addListener((e,t)=>{0!==e.pageUrl.indexOf("chrome")&&0!==e.frameUrl.indexOf("chrome")&&dispatchEvent({event:"onContextMenuAction",data:{action:e.menuItemId,text:e.selectionText},target:"FrontEnd",tid:t.id})});var lastRequest=[];let EventHandler={},CacheLimit=(globalThis.dispatchEvent=async t=>{if(t.sender=t.sender||"BackEnd","ServerEnd"===t.target)try{sendMessage(t.event,t.data,t.sender,t.sid)}catch{}else if("FrontEnd"===t.target||"PageEnd"===t.target){let e=t.tid;if(e||([a]=await chrome.tabs.query({active:!0,lastFocusedWindow:!0}),a&&(e=a.id)),e=e||LastActiveTab){var a=TabPorts.get(e);if(a)try{await a.postMessage(t)}catch{}}}else if("BackEnd"===t.target){a=EventHandler[t.event];if(!a)return logger.log("SW","Got Event",t);a(t.data,t.sender,t.sid,t.target,t.tid)}else{a=t.tid;if(a)try{await chrome.tabs.sendMessage(a,t)}catch{}}},EventHandler.gotServerReply=e=>{e.ok?getReplyFromServer(e.taskId,e.data):getReplyFromServer(e.taskId,void 0,e.err)},EventHandler.gotoWebSite=async(e,t,a)=>{var n;try{n=await callServer("getWebSite")}catch(e){var r=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang];return void dispatchEvent({event:"getWebSiteURLFailed",data:{ok:!1,err:r.configPage.connectFailed},target:t,tid:a})}gotoUniquePage(n)},EventHandler.SetConfig=async(e,t,a)=>{if("ConfigPage"===t)if(logger.log("WS","Set Host: "+e.wsHost),myInfo.name=e.name||"",myInfo.info=e.info||"",myInfo.lang=e.lang||DefaultLang,myInfo.apiKey=e.apiKey,myInfo.useLocalKV=!ForceBackend&&!e.wsHost,updateAIModelList(),myInfo.useLocalKV){globalThis.sendMessage=DefaultSendMessage,chrome.tabs.sendMessage(a,{event:"connectWSHost",data:{wsHost:e.wsHost,ok:!0},target:t,sender:"BackEnd"});try{AIHandler.sayHello()}catch(e){logger.error("AI:SayHello",e)}}else{var n;try{n=await prepareWS(e.wsHost)}catch(e){console.error(e),n=!1}chrome.tabs.sendMessage(a,{event:"connectWSHost",data:{wsHost:e.wsHost,ok:n},target:t,sender:"BackEnd"})}},EventHandler.PageStateChanged=async(e,t,a)=>{"FrontEnd"===t&&(logger.log("Page","State Changed: "+e.state),t=await getTabInfo(a),e&&e.pageInfo&&(t.title=e.pageInfo.title||t.title,t.isArticle=(isBoolean(e.pageInfo.isArticle)?e.pageInfo:t).isArticle,await setTabInfo(a,t)),onPageActivityChanged(a,e.state))},EventHandler.VisibilityChanged=(e,t,a)=>{"FrontEnd"===t&&onPageActivityChanged(a,e)},EventHandler.MountUtil=async(e,t,a)=>{var n;"FrontEnd"===t&&((t=UtilList[e])&&(n=[],t.css&&n.push(chrome.scripting.insertCSS({target:{tabId:a},files:t.css})),t.js&&n.push(chrome.scripting.executeScript({target:{tabId:a},files:t.js,injectImmediately:!0})),await Promise.all(n),logger.log("Page","Notification has mounted!")),dispatchEvent({event:"utilMounted",data:e,target:"FrontEnd",tid:a}))},EventHandler.AskAIAndWait=async(t,e,a)=>{lastRequest[0]=e,lastRequest[1]=a;var n={id:t.id},r="";if(t.action){var i=AIHandler[t.action];try{var s=await i(t.data,e,a);n.result=s,logger.log("AI","Task "+t.action+" Finished")}catch(e){n.result="",r=e.message||e.msg||e.data||e.toString?e.toString():e,logger.error("AI","Task "+t.action+" Failed:",r),showSystemNotification(r)}}dispatchEvent({event:"replyAskAndWait",data:{ok:!r,data:n,error:r},target:e,tid:a})},EventHandler.AskSWAndWait=async(t,e,a)=>{lastRequest[0]=e,lastRequest[1]=a;var n={id:t.id},r="";if(t.action){var i=EventHandler[t.action];try{var s=await i(t.data,e,a);n.result=s,logger.log("SW","Task "+t.action+" Finished")}catch(e){n.result="",r=e.message||e.msg||e.data||e.toString?e.toString():e,logger.error("SW","Task "+t.action+" Failed:",r)}}dispatchEvent({event:"replyAskAndWait",data:{ok:!r,data:n,error:r},target:e,tid:a})},EventHandler.SavePageSummary=async(e,t,a)=>{var n=await getTabInfo(a),r=await getPageInfo(n.url);r.title||(r.title=e.title||r.title),e.content&&(r.content=e.content),r.description=e.summary||r.description,r.hash=e.hash||r.hash,r.embedding=e.embedding||r.embedding,await Promise.all([setTabInfo(a,n),setPageInfo(n.url,r)])},EventHandler.GotoConversationPage=async()=>{var e={};e[(await gotoUniquePage(chrome.runtime.getURL("/pages/newtab.html"))).id+":mode"]="crossPageConversation",await chrome.storage.session.set(e)},EventHandler.CalculateHash=async e=>{var t,a=e.content;return a?t=e.algorithm:a=e,calculateHash(a,t)},EventHandler.CheckPageNeedAI=async e=>getPageNeedAIInfo(e),EventHandler.UpdatePageNeedAIInfo=async e=>{var t=await getPageNeedAIInfo(e);t.page.visited++,t.path.visited++,t.host.visited++,e.need&&(t.page.need++,t.path.need++,t.host.need++),await updatePageNeedAIInfo(e,t)},EventHandler.LoadPageSummary=async(e,t,a)=>{a=await chrome.tabs.get(a);return a&&!isPageForbidden(a.url)?getPageInfo(a.url):null},EventHandler.FindSimilarArticle=async e=>{var t,a=e.vector,n=parseURL(e.url||""),r=await DBs.pageInfo.all("pageInfo"),i=[];for(t in r)if(t!==n){var s=r[t];if(s&&s.embedding&&(!e.needContent||s.content)){var o,l={};for(o in s)l[o]=s[o];var c=calculateSimilarityRate(l.embedding,a)*calculateNearestScore(l.embedding,a);c<=0||(l.similar=c,i.push(l))}}return i.sort((e,t)=>t.similar-e.similar),logger.log("SIMI",e.url||"(NONE)"),console.table(i.map(e=>({title:e.title,similar:e.similar}))),i},EventHandler.FindRelativeArticles=async(e,t,a)=>{var n;e.url=parseURL(e.url||""),e.url&&(RelativeHandler[a]!==e.url&&(RelativeHandler[a]=e.url,n=await findRelativeArticles(e))&&(dispatchEvent({event:"foundRelativeArticles",data:n,target:"FrontEnd",tid:a}),await wait(ColdDownDuration),logger.log("SW","Cold Down finished for "+e.url)),delete RelativeHandler[a])},EventHandler.GetConversation=async e=>{e=parseURL(e);e=await DBs.pageInfo.get("pageConversation",e);return e?e.conversation:null},EventHandler.ClearSummaryConversation=async e=>{e=parseURL(e);try{return await DBs.pageInfo.del("pageConversation",e),!0}catch{return!1}},EventHandler.GetArticleInfo=async e=>{var t,a,n=await DBs.pageInfo.all("pageInfo"),n=Object.keys(n).map(e=>n[e]),r=null,i=!1;return isArray(e)?(t=e[0],a=e[1],!1===t?i=!1:!0!==t&&isArray(t)?(i=!0,r=t):i=!0):e||(i=!0),i&&(n=n.filter(e=>!!e.content&&!!e.hash&&!!e.embedding)),r&&(n=n.filter(e=>r.includes(e.url))),"LastVisit"===a?(n.forEach(e=>e._time=new Date(e.timestamp.replace(/\s+[a-z]+$/i,"")).getTime()),n.sort((e,t)=>t._time-e._time)):n.sort((e,t)=>t.totalDuration-e.totalDuration),n},EventHandler.SearchGoogle=async e=>{e=encodeURIComponent(e);var{key:t,cx:a}=myInfo.apiKey?.google||{};if(t&&a){logger.log("GoogleSearch","Search By API");t=`https://www.googleapis.com/customsearch/v1?key=${myInfo.apiKey.google.key}&cx=${myInfo.apiKey.google.cx}&q=${e}&num=10&sort=date-sdate:d:s`;try{var i,n=await waitUntil(fetch(t));i=(i=await n.json()).error?(logger.error("GoogleSearch["+i.error.code+"]",i.error.message),null):(logger.info("GoogleSearch",i),(i.items||[]).map(e=>({title:e.title,url:e.link,summary:(e.snippet||"").trim()})))}catch(e){logger.error("GoogleSearch",e),i=null}}if(!i){logger.log("GoogleSearch","Search Via Crab");a=`https://www.google.com/search?q=${e}&hl=en-US&start=0&num=10&ie=UTF-8&oe=UTF-8&gws_rd=ssl`;try{let n=await waitUntil(fetch(a));for(n=(n=(n=await n.text()).replace(/<![^>]*?>/gi,"").replace(/<(noscript|script|title|style|header|footer|head|ul|ol)[\w\W]*?>[\w\W]*?<\/\1>/gi,"").replace(/<(meta|input|img)[\w\W]*?>/gi,"").replace(/<[^\/\\]*?[\/\\]>/gi,"").replace(/<\/?(html|body)[^>]*?>/gi,"").replace(/<\/?span[^>]*?>/gi,"").replace(/<\/?(div|br|hr)[^>]*?>/gi,"\n")).replace(/<a[^>]*href=('|")([^'"]*)\1[^>]*>([\w\W]*?)<\/a>/gi,(e,t,a,n)=>a.match(/^https?:\/\/.*?\.google/)||a.match(/^\s*\//)&&!a.match(/^\s*\/url\?/)?"":e);;){var s=n.replace(/<([\w\-_]+)[^>]*?>[\s\r\t\n]*<\/\1>/gi,"");if(n===s)break;n=s}n=n.replace(/^[\w\W]*?<a/i,"<a").replace(/Related searches[\w\W]*?$/i,"").replace(/[\s\r\t]*\n+[\s\r\t]*/g,"\n").replace(/\n+/g,"\n");let r=[];n.replace(/<a[^>]*?>[\s\r\n]*/gi,(e,t)=>{r.push(t)}),r.push(n.length);for(let a=0;a<r.length-1;a++){var o=r[a],l=r[a+1];let e=n.substring(o,l),t=e.match(/^[\s\r\n]*<a[^>]*?href=('|")?([^'"]*?)\1[^>]*?>/i);if(t&&t[2]&&(t=t[2]).match(/^(f|ht)tps?/)){var c,g=parseParams(t);for(c in g){var d=g[c];if(d.match(/^https?/i)){t=decodeURI(d);break}}e=e.replace(/<h3[^>]*>/gi,"\n  Title: ").replace(/<\/h3[^>]*>/gi,"\n  Description: ").replace(/<\/?\w+[^>]*?>/gi,"").replace(/[\s\r\t]*\n+[\s\r\t]*/g,"\n").replace(/\n+/g,"\n").replace(/^\n+|\n+$/g,"").replace(/\n  Title:\s*\n\s*/gi,"\n  Title: ").replace(/\n  Description:\s*\n\s*/gi,"\n  Description: ").replace(/&#(\d+);/g,(e,t)=>{var a;try{a=String.fromCharCode(+t)}catch{a=e}return a}),r[a]=[t,e]}}(r=r.filter(e=>isArray(e))).length?(i=[],r.forEach(e=>{var t,n;e&&e[0]&&(t=(t=(t=e[1]||"").split("\n")).map(e=>e.replace(/^\-\s*/,"\n  ")).join("\n  "),n={url:e[0]},t.replace(/Title:\s*([\w\W]*?)\s*Description:|Title:\s*([\w\W]*?)\s*$/i,(e,t,a)=>{t=t||a;t&&(n.title=t)}),t.replace(/Description:\s*([\w\W]*?)\s*Title:|Description:\s*([\w\W]*?)\s*$/i,(e,t,a)=>{t=t||a;t&&(n.summary=t)}),n.title||(n.title=e[1]||""),n.summary||(n.summary=e[1]||""),i.push(n))})):i=[]}catch(e){return logger.error("GoogleCrab",e),[]}}return i},EventHandler.ReadWebPage=async e=>{var t;try{t=await(t=await waitUntil(fetch(e))).text()}catch{return null}return t},EventHandler.RemovePageInfo=async e=>{await delPageInfo(e,!0)},EventHandler.RemovePageInfos=async e=>{var t,a=await DBs.pageInfo.all("pageInfo"),n=(console.log(a),[]);for(t in a){var r=a[t];e?r.content||n.push(t):r.hash&&r.embedding||n.push(t)}console.log(n),await Promise.all(n.map(async e=>{await delPageInfo(e,!0)}))},EventHandler.ChangePageTitle=async e=>{var t=await getPageInfo(e.url);t.title=e.title,await setPageInfo(e.url,t,!0)},globalThis.AIHandler={},432e5),removeAIChatHistory=async e=>{var t=[];if(e&&(n=Tab2Article[e])){delete Tab2Article[e];for(var a of n)t.push(DBs.pageInfo.del("pageConversation",a));t.length&&(await Promise.all(t),logger.log("Chat","Remove Inside Tab History:",n))}var n,r,t=[],i=Date.now(),s=[];for(r in n=await DBs.pageInfo.all("pageConversation"))i-n[r].timestamp>=CacheLimit&&(s.push(r),t.push(DBs.pageInfo.del("pageConversation",r)));t.length&&(await Promise.all(t),logger.log("Chat","Remove Expired History:",s))},parseReplyAsXMLToJSON=i=>{var s={},o=-1,l=0;let c=/<(\/?)([\w\.\-\+\*]+)>/gi;return i.replace(c,(e,t,a,n)=>{var r;(t=!!t)?0===--l&&0<=o?(t=i.substring(o,n).trim(),o=-1,t.match(c)?s[a]=parseReplyAsXMLToJSON(t):"true"===(r=t.toLowerCase())?s[a]=!0:"false"===r?s[a]=!1:t.match(/^(\d+|\d+\.|\.\d+|\d+\.\d+)$/)?s[a]=+t:s[a]=t):l<0&&(l=0):1===++l&&(o=n+e.length)}),s},Tab2Article=(AIHandler.sayHello=async()=>{var e=timestmp2str("YYYY/MM/DD"),t=(await chrome.storage.session.get("lastHello")).lastHello;t&&t===e||(chrome.storage.session.set({lastHello:e}),t=await callAIandWait("sayHello"),showSystemNotification(t))},AIHandler.summarizeArticle=async e=>{var t;if(await checkAvailability())return[e,t]=await Promise.all([callAIandWait("summarizeArticle",e.article),callAIandWait("embeddingArticle",e)]),{summary:e,embedding:t}},AIHandler.embeddingContent=async e=>await callAIandWait("embeddingArticle",e),AIHandler.askArticle=async(t,e,a)=>{var n=Tab2Article[a],r=parseURL(t.url),a=(n||(n=[],Tab2Article[a]=n),n=null,n=(n=await DBs.pageInfo.get("pageConversation",r))?n.conversation:[],{lang:LangName[myInfo.lang]});if(a.content="<currentArticle>\n"+t.content.trim()+"\n</currentArticle>",t.related){let e=await Promise.all(t.related.map(async e=>{var t=await getPageInfo(parseURL(e.url));return t?'<referenceMaterial title="'+(e.title||t.title)+'" url="'+t.url+'">\n'+t.description.trim()+"\n</referenceMaterial>":null}));e=e.filter(e=>!!e),a.related=e.join("\n")}else a.related="(No Reference Material)";a=PromptLib.assemble(PromptLib.askPageSystem,a),(n=n.filter(e=>"system"!==e[0])).unshift(["system",a]),n.push(["human",t.question]),console.log(n),a=await callAIandWait("directAskAI",[...n]);return n.push(["ai",a]),await DBs.pageInfo.set("pageConversation",r,{conversation:n,timestamp:Date.now()}),removeAIChatHistory(),a},AIHandler.translateContent=async e=>{if(await checkAvailability())return e.requirement=e.requirement||"(No Extra Requirement)",await callAIandWait("translateContent",e)},AIHandler.translateSentence=async e=>{if(await checkAvailability())return e.myLang=LangName[myInfo.lang]||myInfo.lang,await callAIandWait("translateSentence",e)},AIHandler.selectArticlesAboutConversation=async(e,t,a)=>{var n=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang],r=SimilarLimit,i=(isObject(e)&&(r=e.limit||r,e=e.request),dispatchEvent({event:"updateCurrentStatus",data:n.crossPageConv.statusAnalyzeRequest,target:t,tid:a}),await AIHandler.embeddingContent({article:e})),i=(dispatchEvent({event:"updateCurrentStatus",data:n.crossPageConv.statusFindingSimilarFiles,target:t,tid:a}),await EventHandler.FindSimilarArticle({vector:i,needContent:!0})),r=(i.length>r&&i.splice(r),dispatchEvent({event:"updateCurrentStatus",data:n.crossPageConv.statusFindingRelatedFiles,target:t,tid:a}),await findRelativeArticles({articles:i,requests:[e]}));return dispatchEvent({event:"updateCurrentStatus",target:t,tid:a}),r},AIHandler.crossPageConversation=async e=>await callAIandWait("directAskAI",e),AIHandler.getSearchKeyWord=async e=>{var t=[["system",PromptLib.analyzeSearchKeyWordsSystem]],e=(t.push(["human",PromptLib.assemble(PromptLib.analyzeSearchKeyWordsRunning,{tasks:e,time:timestmp2str("YYYY/MM/DD hh:mm :WDE:")})]),await callAIandWait("directAskAI",t)),a=(console.log(e),{});return e.replace(/<google>\s*([\w\W]*?)\s*<\/google>/gi,(e,t)=>{0!==(t=t.split(/\r*\n\r*/).map(e=>e.replace(/^[\s\-]*|\s*$/gi,"")).filter(e=>!!e)).length&&(a.search=t)}),a.search||(e.replace(/<keywords?>\s*([\w\W]*?)\s*<\/keywords?>/gi,(e,t)=>{0!==(t=t.split(/\r*\n\r*/).map(e=>e.replace(/^[\s\-]*|\s*$/gi,"")).filter(e=>!!e)).length&&(a.search=t)}),e.replace(/<search>\s*([\w\W]*?)\s*<\/search>/gi,(e,t)=>{0!==(t=t.split(/\r*\n\r*/).map(e=>e.replace(/^[\s\-]*|\s*$/gi,"")).filter(e=>!!e)).length&&(a.search=t)})),a.search||(a.search=[]),e.replace(/<arxiv>\s*([\w\W]*?)\s*<\/arxiv>/gi,(e,t)=>{t=t.split(/\r*\n\r*/).map(e=>e.replace(/^[\s\-]*|\s*$/gi,"")).filter(e=>!!e&&!e.match(/^\(?(none|n\/a|null|nil)\)?$/i)),a.arxiv=t}),e.replace(/<wikipedia>\s*([\w\W]*?)\s*<\/wikipedia>/gi,(e,t)=>{t=t.split(/\r*\n\r*/).map(e=>e.replace(/^[\s\-]*|\s*$/gi,"")).filter(e=>!!e&&!e.match(/^\(?(none|n\/a|null|nil)\)?$/i)),a.wikipedia=t}),a},AIHandler.findRelativeWebPages=async e=>findRelativeArticles(e),AIHandler.replyAISearch=async e=>{logger.info("AdvAISearch","Start"),e.webpages=e.webpages.map(e=>{var t=["<article>"];return t.push("<title>"+e.title+"</title>"),t.push("<url>"+e.url+"</title>"),t.push("<content>"),t.push(e.content),t.push("</content>"),t.push("</article>"),t.join("\n")}).join("\n\n");var t=PromptLib.assemble(PromptLib.replySearchRequest,{lang:LangName[myInfo.lang]||myInfo.lang,request:e.request}),a=t.indexOf("{{webpages}}"),n=a+"{{webpages}}".length,a=t.substring(0,a),n=t.substring(n),a=[["human",t=a+e.webpages+n]],e=(logger.info("AdvAISearch","Prompt Assembled",a),await callAIandWait("directAskAI",a));return logger.info("AdvAISearch","Got Reply"),e},AIHandler.deepThinking=async(e,t,a)=>{var n=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang],r={lang:LangName[myInfo.lang]||myInfo.lang,request:e.request,time:timestmp2str("YYYY/MM/DD hh:mm :WDE:")},i=(e.webpages=e.webpages.map(e=>{var t;if(e.reply)return(t=["<article>"]).push("<title>"+e.title.replace(/\s+/g," ")+"</title>"),t.push("<url>"+e.url+"</title>"),t.push("<responseOrSummary>"),t.push(e.reply),t.push("</responseOrSummary>"),t.push("</article>"),t.join("\n")}).filter(e=>!!e),""),s="",o="",l=(logger.info("DeepThinking","Start Deep Thingking"),dispatchEvent({event:"updateDeepThinkingStatus",data:n.aiSearch.msgPreliminaryThinking,target:t,tid:a}),PromptLib.assemble(PromptLib.deepThinkingStep0,r)),c=[["human",l]];logger.info("DeepThinking","PT Prompt Assembled",[...c]);try{i=(h=await callAIandWait("directAskAI",c)).trim(),logger.info("DeepThinking","PT Got Reply:\n",i)}catch(e){logger.error("DeepThinking",e),i=n.aiSearch.msgPreliminaryThinkingFailed}e.webpages=e.webpages.join("\n\n"),dispatchEvent({event:"updateDeepThinkingStatus",data:n.aiSearch.msgLearningMaterial,target:t,tid:a});var g=(l=PromptLib.assemble(PromptLib.deepThinkingStep1,r)).indexOf("{{webpages}}"),d=g+"{{webpages}}".length,p=l.substring(0,g),m=l.substring(d),c=[["human",l=p+e.webpages+m]];logger.info("DeepThinking","LRM Prompt Assembled",[...c]);try{console.log("LM:",c),s=(h=await callAIandWait("directAskAI",c)).trim(),logger.info("DeepThinking","LRM Got Reply:\n",s),s=s&&"# "+n.aiSearch.hintLearnFromInternet+"\n\n"+s}catch(e){return logger.error("DeepThinking",e),[""]}dispatchEvent({event:"updateDeepThinkingStatus",data:n.aiSearch.msgDeepThinking,target:t,tid:a}),d=(g=(l=PromptLib.assemble(PromptLib.deepThinkingStep2System,r)).indexOf("{{webpages}}"))+"{{webpages}}".length,p=l.substring(0,g),m=l.substring(d),c=[["system",l=p+e.webpages+m]],l=PromptLib.assemble(PromptLib.deepThinkingStep2Summary,r),c.push(["human",l]),c.push(["ai",s]);t={};i?(t.otheropinion=i,i="# "+n.aiSearch.hintMyPreliminaryThinking+"\n\n"+i):t.otheropinion=n.aiSearch.hintNoOpinion,l=PromptLib.assemble(PromptLib.deepThinkingStep2Running,r,t),c.push(["human",l]),logger.info("DeepThinkingStep2","DT Prompt Assembled",[...c]);try{console.log("DT:",c),h=(h=await callAIandWait("directAskAI",c)).trim(),logger.info("DeepThinkingStep2","DT Got Reply:\n",h);var h,u=parseReplyAsXMLToJSON(h),o=u.more||[];h=(h=u.reply||h)||n.refreshHint}catch(e){logger.error("DeepThinking",e),h=n.refreshHint}return c.pop(),l=PromptLib.assemble(PromptLib.deepThinkingStep2Replace,r,t),c.push(["human",l]),c.push(["ai",h]),c.push(["human",PromptLib.deepThinkingStep3Running]),c.push(["ai",PromptLib.deepThinkingStep3Reply]),console.log("ED:",c),h=["# "+n.aiSearch.hintMyResponseAfterReflection+"\n\n"+h],s&&h.unshift(s),i&&h.unshift(i),[h=h.join("\n\n----\n\n"),c,o]},AIHandler.raedAndReply=async e=>{logger.info("SummaryAndReply","Start");var t=I18NMessages[myInfo.lang]||I18NMessages[DefaultLang],a=PromptLib.assemble(PromptLib.replyRequestBasedOnArticle,{lang:myInfo.lang,request:e.request}),n=a.indexOf("{{content}}"),r=n+"{{content}}".length,n=a.substring(0,n),r=a.substring(r);a=[["human",a=n+e.content+r]],logger.info("SummaryAndReply","Prompt Assembled");n=(n=await callAIandWait("directAskAI",a)).trim(),e=parseReplyAsXMLToJSON(n);return logger.info("SummaryAndReply","Got Reply"),console.log(n,e),e.relevant?e.reply&&(r=[],e.summay&&r.push("## "+t.aiSearch.hintPageSummary+"\n\n"+e.summay.trim()),r.push("## "+t.aiSearch.hintPageReply+"\n\n"+e.reply.trim()),n=r.join("\n\n")):n="",n},{}),RelativeHandler={},ColdDownDuration=3e5,WaitDuration=5e3,RelativeArticleRange=40,getPageNeedAIInfo=(globalThis.waitUntil=s=>new Promise((t,a)=>{var[e,n]=lastRequest;let r=setInterval(()=>{logger.log("Ext","Reactive and waiting..."),dispatchEvent({event:"requestHeartBeating",target:e,tid:n}),dispatchEvent({event:"requestHeartBeating",target:"FrontEnd",tid:LastActiveTab}),dispatchEvent({event:"requestHeartBeating",target:"HomeScreen",tid:LastActiveTab})},WaitDuration);if(isFunction(s))if(isAsyncFunction(s))s().then(e=>t(e)).catch(e=>a(e)).finally(()=>{clearInterval(r)});else{clearInterval(r);try{var i=s();t(i)}catch(e){a(e)}}else s.then(e=>t(e)).catch(e=>a(e)).finally(()=>{clearInterval(r)})}),async e=>{e=await Promise.all([DBs.pageInfo.get("notifyChecker",e.page),DBs.pageInfo.get("notifyChecker",e.path),DBs.pageInfo.get("notifyChecker",e.host)]);return(e={page:e[0],path:e[1],host:e[2]}).page||(e.page={need:0,visited:0}),e.path||(e.path={need:0,visited:0}),e.host||(e.host={need:0,visited:0}),e}),updatePageNeedAIInfo=async(e,t)=>{await Promise.all([DBs.pageInfo.set("notifyChecker",e.page,t.page),DBs.pageInfo.set("notifyChecker",e.path,t.path),DBs.pageInfo.set("notifyChecker",e.host,t.host)])},manhattanOfVectors=(t,a)=>{var n=Math.min(t.length,a.length),r=0;for(let e=0;e<n;e++)r=Math.max(r,Math.abs(t[e]-a[e]));return r},innerProductOfVectors=(t,a)=>{var n=Math.min(t.length,a.length),r=0;for(let e=0;e<n;e++)r+=t[e]*a[e];return r},calculateSimilarityRate=(t,e)=>{if(!t||!e)return 0;let i=.5**.5;var a=0,n=0,s=(t.forEach(e=>a+=e.weight),e.forEach(e=>n+=e.weight),0);return e.forEach(a=>{var e=a.weight,n=(a=a.vector,0),r=0;t.forEach(e=>{var t=e.weight,e=(e=e.vector,innerProductOfVectors(e,a));e>i&&(t=(e-i)/(1-i)*t,n+=e*t,r+=t)}),0<r&&(s+=n*e/r)}),s/n},calculateNearestScore=(e,t)=>{if(!e||!t)return 0;var s=[],a=(t.forEach((n,r)=>{var i=n.weight;n=n.vector,e.forEach((e,t)=>{var a=e.weight,e=(e=e.vector,innerProductOfVectors(e,n));s.push([e,a*i,e*a*i,r,t])})}),s.sort((e,t)=>t[1]-e[1]),s[0][1]),n=(s.sort((e,t)=>t[0]-e[0]),[]),r=Math.min(e.length,t.length);for(let e=0;e<r;e++){let t=s[0];n.push(t),s=s.filter(e=>e[3]!==t[3]&&e[4]!==t[4])}var i=0;return n.forEach(e=>i+=e[2]),i/=a},initInjectScript=async()=>{var e="CypriteInjection";0<(await chrome.userScripts.getScripts({ids:[e]})).length||(chrome.userScripts.configureWorld({messaging:!0}),await chrome.userScripts.register([{id:e,matches:["*://*/*"],js:[{file:"inject.js"}],world:"MAIN"}]))},findRelativeArticles=async r=>{if(await checkAvailability()){logger.log("SW",r.articles.length+" Similar Articles for "+(r.url||"(NONE)"));var e=r.limit||RelativeArticleRange,e=(r.articles.length>e&&r.articles.splice(e),{list:[]});e.content=r.requests.join("\n\n"),r.content&&r.content.length?e.articles=r.content.map(e=>"<article>\n"+e.trim()+"\n</article>").join("\n\n"):e.articles="(NONE)",e.list=(r.isWebPage?r.articles.map(e=>"<webpage>\n<title>"+e.title+"</title>\n<url>"+e.url+"</url>\n<summary>\n"+(e.description||e.summary||"(NONE)").trim()+"\n</summary>\n</webpage>"):r.articles.map(e=>"<candidate>\n<title>"+e.title+"</title>\n<url>"+e.url+"</url>\n<content>\n"+(e.description||e.summary||"(NONE)").trim()+"\n</content>\n</candidate>")).join("\n\n"),console.log(e);try{var t=r.isWebPage?"findRelativeWebPages":"findRelativeArticles",n=await callAIandWait(t,e)}catch(e){return showSystemNotification(e),null}if(n)if(n=(n=n.split(/(\r*\n\r*)+/)).filter(e=>e.match(/(\*\*)?url(\s*:\s*\1|\1\s*:\s*)/i)).map(e=>e=(e=e.replace(/[\w\W]*(\*\*)?url(\s*:\s*\1|\1\s*:\s*)/i,"")).trim()).filter(e=>!!e).map(e=>parseURL(e)),r.isWebPage){let a=[];n.forEach(t=>{r.articles.some(e=>{if(e.url===t)return a.push(e),!0})}),n=a}else n=(n=await Promise.all(n.map(async e=>{var t=await getPageInfo(e);if(!t||!t.hash||t.hash===r.hash)return null;var a,n={};for(a in t)n[a]=t[a];return n.similar=100,n}))).filter(e=>!!e),logger.log("SW",n.length+" Relative Articles for "+(r.url||"(NONE)"));else n=[];return n}},parseParams=e=>{var a={};return(e=(e||"").split("?")).shift(),(e=(e||"").join("?").split("&")).forEach(e=>{var t=(e=e.split("=")).shift();t&&(e=e.join("="),a[t]=e)}),a};initDB(),initWS(),EventHandler.notify=(e,t,a)=>{var n="Server";"BackEnd"===t?n="Background":"FrontEnd"===t?n="Content":"PageEnd"===t&&(n="Injection"),isString(e)||isNumber(e)||isBoolean(e)||(e=JSON.stringify(e)),logger.log("Notify | "+n,e)};