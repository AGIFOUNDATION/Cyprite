globalThis.AI=globalThis.AI||{},globalThis.AI.Claude={};let DefaultChatModel=AI2Model.claude[0],convertClaudeChinese=e=>(e=e&&e.trim())?e=(e=(e=e.split(/\r*\n\r*/)).map(e=>e=(e=(e=(e=(e=e.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*[\(\)]|[\(\)]\s*[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/gi,e=>e=e.replace(/\s*([\(\)])\s*/g,(e,t)=>","===t?"，":":"===t?"：":";"===t?"；":"?"===t?"？":"!"===t?"！":"("===t?"（":")"===t?"）":t))).replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*[,:;\?\!]/gi,e=>e=e.replace(/\s*([,:;\?\!\(\)])\s*/g,(e,t)=>","===t?"，":":"===t?"：":";"===t?"；":"?"===t?"？":"!"===t?"！":"("===t?"（":")"===t?"）":t))).replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*\.+/gi,e=>e=e.replace(/\s*(\.+)\s*/g,(e,t)=>1===t.length?"。":"……"))).replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*\-{2,}|\-{2,}\s*[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/gi,e=>e=e.replace(/\s*(\-{2,})\s*/g,(e,t)=>"——"))).replace(/[\(（]\s*([\w\d_\-\+\*\\\/:;,\.\?\!@%#\^\&\(\)=]+)\s*[\)）]/g,(e,t)=>"("+t+")"))).join("\n"):"",assembleConversation=e=>{var t={messages:[]};return e.forEach(e=>{"system"===e[0]?t.system=e[1]:"human"===e[0]?t.messages.push({role:"user",content:e[1]}):"ai"===e[0]&&t.messages.push({role:"assistant",content:e[1]})}),"assistant"!==t.messages[t.messages.length-1].role&&t.messages.push({role:"assistant",content:""}),t};AI.Claude.chat=async(a,s=DefaultChatModel,e={})=>{for(var t=Object.assign({},ModelDefaultConfig.Claude.header,(ModelDefaultConfig[s]||{}).header||{}),u=(t["x-api-key"]=myInfo.apiKey.claude,Object.assign({},ModelDefaultConfig.Claude.chat,(ModelDefaultConfig[s]||{}).chat||{},e)),o=(u.model=s,Object.assign(u,assembleConversation(a)),{method:"POST",headers:t,body:JSON.stringify(u)}),n=[],i={input:0,output:0},f=!0,e=Date.now();;){let e;try{await requestRateLimitLock(s),updateRateLimitLock(s,!0),e=await waitUntil(fetch("https://api.anthropic.com/v1/messages",o)),updateRateLimitLock(s,!1)}catch(e){throw updateRateLimitLock(s,!1),e}e=await e.json(),logger.info("Claude",e);var r=e.usage;r&&(i.input+=r.input_tokens,i.output+=r.output_tokens);let t=e.content;if(!(t=t&&t[0]))throw t="",r=e.error?.message||"Error Occur!",logger.error("Claude",r),new Error(r);if(t=convertClaudeChinese(t.text),n.push(t),"max_tokens"!==(e.stop_reason||"").toLowerCase())break;f?(a.push(["ai",t]),a.push(["human",PromptLib.continueOutput]),f=!1):a[a.length-2][1]=n.join(" "),Object.assign(u,assembleConversation(a)),o.body=JSON.stringify(u)}return e=Date.now()-e,logger.info("Claude","Timespent: "+e/1e3+"s; Input: "+i.input+"; Output: "+i.output),AIUsage.request++,AIUsage.input+=i.input,AIUsage.output+=i.output,n.join(" ")};