
chrome.runtime.onInstalled.addListener(()=>{
  chrome.contextMenus.create({id:'vt_add_dict',title:'Add selection to Voice Typist dictionary…',contexts:['selection']});
});

chrome.contextMenus.onClicked.addListener((info,tab)=>{
  if(info.menuItemId==='vt_add_dict' && tab?.id){
    chrome.tabs.sendMessage(tab.id,{type:'VT_PROMPT_ADD_DICT',text:info.selectionText||''});
  }
});

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg?.type==='VT_GEMINI'){ transcribe(msg.b64,msg.lang).then(t=>sendResponse({text:t})); return true; }
});

async function transcribe(b64,lang){
  const {geminiKey='',geminiModel='gemini-2.5-flash'} = await chrome.storage.sync.get(['geminiKey','geminiModel']);
  if(!geminiKey) return '';
  const body={contents:[{parts:[
    {text:`Transcribe the speech verbatim in ${lang}. Return only the transcript.`},
    {inlineData:{mimeType:'audio/webm',data:b64}}
  ]}]};
  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!res.ok) return '';
  const j=await res.json();
  return j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join(' ')||'';
}
