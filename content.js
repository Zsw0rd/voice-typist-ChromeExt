let recognition=null,settings=null,hotkey=null,holdDown=false,targetEl=null;

function ensureRecognition(){
  if(recognition) return recognition;
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR) return null;
  recognition=new SR();
  recognition.lang=settings?.language||'en-US';
  recognition.interimResults=false;
  recognition.continuous=false;
  recognition.onresult=e=>{
    const text=Array.from(e.results).map(r=>r[0].transcript).join(' ').trim();
    if(!text) return;
    const action=(settings?.mode==='gemini')?(settings?.geminiAction||'echo'):'echo';
    if(action==='reply'){
      chrome.runtime.sendMessage({type:'va_generate',prompt:text},res=>{
        if(res?.ok) pasteText(res.text,targetEl);
      });
    }else{
      pasteText(text,targetEl);
      const n=text.split(/\s+/).filter(Boolean).length;
      chrome.runtime.sendMessage({type:'va_bump',n});
    }
  };
  recognition.onend=()=>{ if(holdDown) tryStart(); };
  return recognition;
}

function deepActive(root=document){
  let ae=root.activeElement||(root.getRootNode&&root.getRootNode().activeElement);
  while(ae&&ae.tagName==='IFRAME'){
    try{
      const doc=ae.contentDocument||ae.contentWindow?.document;
      if(!doc) break;
      root=doc; ae=doc.activeElement;
    }catch(_){ break; }
  }
  while(ae&&ae.shadowRoot){
    const next=ae.shadowRoot.activeElement||ae.shadowRoot.querySelector(':focus');
    if(!next) break;
    ae=next;
  }
  return ae||document.activeElement;
}

function findYouTubeSearchInputFrom(el){
  if(el&&el.tagName==='INPUT'&&(el.type==='search'||el.id==='search')) return el;
  if(el&&el.tagName==='YTD-SEARCHBOX'&&el.shadowRoot){
    return el.shadowRoot.querySelector('input#search, input[type="search"], input[type="text"]')||el;
  }
  const host=document.querySelector('ytd-searchbox');
  if(host){
    if(host.shadowRoot){
      return host.shadowRoot.querySelector('input#search, input[type="search"], input[type="text"]')||host;
    }
    return host;
  }
  return document.querySelector('input#search,input[type="search"][name="search_query"]')||el;
}

function resolveSpecialHosts(el){
  if(!el) return null;
  if(location.hostname.includes('youtube.com')) return findYouTubeSearchInputFrom(el);
  return el;
}

function dispatchCEInsert(el,t){
  const doc=el.ownerDocument,sel=doc.getSelection();
  const inRange=sel&&sel.rangeCount>0&&el.contains(sel.getRangeAt(0).startContainer);
  if(!inRange){
    const r=doc.createRange(); r.selectNodeContents(el); r.collapse(false);
    sel.removeAllRanges(); sel.addRange(r);
  }
  const before=new InputEvent('beforeinput',{inputType:'insertText',data:t,bubbles:true,cancelable:true,composed:true});
  el.dispatchEvent(before);
  if(!before.defaultPrevented) document.execCommand('insertText',false,t);
  const inputEvt=new InputEvent('input',{inputType:'insertText',data:t,bubbles:true,composed:true});
  el.dispatchEvent(inputEvt);
}

function insertIntoTextControl(el,t){
  try{ el.focus({preventScroll:true}); }catch(_){}
  const start=el.selectionStart??el.value.length;
  const end=el.selectionEnd??el.value.length;
  el.setRangeText(t,start,end,'end');
  el.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,data:t,inputType:'insertText'}));
  el.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
}

function execCommandInsertFallback(t){
  try{ document.execCommand('insertText',false,t); }catch(_){}
}

function pasteText(t,target=null){
  let el=resolveSpecialHosts(target||deepActive());
  if(!el) return;
  if(el.tagName==='YTD-SEARCHBOX'&&!el.shadowRoot){
    try{ el.focus({preventScroll:true}); }catch(_){}
    execCommandInsertFallback(t);
    return;
  }
  if(el.isContentEditable){ dispatchCEInsert(el,t); return; }
  if(el.tagName==='TEXTAREA'||(el.tagName==='INPUT'&&/text|search|url|email|tel|password/.test(el.type||'text'))){
    insertIntoTextControl(el,t); return;
  }
  try{ el.focus({preventScroll:true}); }catch(_){}
  execCommandInsertFallback(t);
}

function pressedMatches(e){
  if(!hotkey) return false;
  const parts=[];
  if(e.ctrlKey) parts.push('Control');
  if(e.metaKey) parts.push('Meta');
  if(e.altKey) parts.push('Alt');
  if(e.shiftKey) parts.push('Shift');
  const code=e.code;
  if(!['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight'].includes(code)) parts.push(code);
  if(parts.length!==hotkey.length) return false;
  for(const k of parts){ if(!hotkey.includes(k)) return false; }
  return true;
}

async function sync(){
  const v=await new Promise(r=>chrome.storage.local.get(['va_settings_v1','va_hotkey_v1'],x=>r(x)));
  settings=Object.assign({}, {mode:'webspeech',geminiModel:'gemini-2.0-flash',geminiAction:'echo',language:'en-US'}, v['va_settings_v1']||{});
  hotkey=v['va_hotkey_v1']||['ShiftLeft','Space'];
  if(recognition) recognition.lang=settings.language;
}

function tryStart(){ const sr=ensureRecognition(); if(!sr) return; try{ sr.start(); }catch(_){} }
function tryStop(){ if(!recognition) return; try{ recognition.stop(); }catch(_){} }

function onKeyDown(e){
  if(e.repeat) return;
  if(!pressedMatches(e)) return;
  e.preventDefault();
  e.stopPropagation();
  if(e.stopImmediatePropagation) e.stopImmediatePropagation();
  if(holdDown) return;
  holdDown=true;
  targetEl=resolveSpecialHosts(deepActive());
  try{ targetEl?.focus?.({preventScroll:true}); }catch(_){}
  tryStart();
}

function onKeyUp(e){
  if(!pressedMatches(e)) return;
  e.preventDefault();
  e.stopPropagation();
  if(e.stopImmediatePropagation) e.stopImmediatePropagation();
  if(!holdDown) return;
  holdDown=false;
  tryStop();
  setTimeout(()=>{ targetEl=null; },500);
}

function addKeyListeners(){
  const opts={capture:true,passive:false};
  window.addEventListener('keydown',onKeyDown,opts);
  window.addEventListener('keyup',onKeyUp,opts);
  document.addEventListener('keydown',onKeyDown,opts);
  document.addEventListener('keyup',onKeyUp,opts);
}

chrome.storage.onChanged.addListener((c,a)=>{ if(a==='local'&&(c.va_settings_v1||c.va_hotkey_v1)) sync(); });

(async()=>{ await sync(); addKeyListeners(); })();
