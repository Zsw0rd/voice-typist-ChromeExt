/*  Voice Typist – content.js  */

let cfg = { hotkey:'Ctrl+Space', mode:'webspeech', language:'en-US' };
chrome.storage.sync.get(cfg, s => { cfg = {...cfg, ...s}; hk = parseHK(cfg.hotkey); });
chrome.storage.onChanged.addListener(ch => { for (const k in ch) cfg[k]=ch[k].newValue; if(ch.hotkey) hk=parseHK(cfg.hotkey); });

/* ── hot-key parsing ─────────────────────────────────────────── */
const parseHK = hk => {
  const p = hk.split('+').map(s=>s.trim().toLowerCase());
  return {
    ctrl : p.includes('ctrl'),
    alt  : p.includes('alt'),
    shift: p.includes('shift'),
    meta : p.includes('meta')||p.includes('cmd')||p.includes('command'),
    key  : p.find(k=>!['ctrl','alt','shift','meta','cmd','command'].includes(k)) || ' '
  };
};
let hk = parseHK(cfg.hotkey);
const matchHK = e => {
  const k = hk.key.length===1 ? e.key.toLowerCase() : e.code.toLowerCase();
  const hkKey = hk.key.length===1 ? hk.key : hk.key.toLowerCase();
  return (!!e.ctrlKey===hk.ctrl)&& (!!e.altKey===hk.alt)&& (!!e.shiftKey===hk.shift)&& (!!e.metaKey===hk.meta)&& (k===hkKey || e.key.toLowerCase()===hkKey);
};

/* ── badge ───────────────────────────────────────────────────── */
const badge = document.createElement('div');
badge.style='position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#111;color:#fff;padding:6px 10px;border-radius:20px;font-size:12px;display:none';
badge.innerHTML='<span id="d" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:#888"></span>Voice Typist';
document.documentElement.appendChild(badge);
const dot = badge.querySelector('#d');

/* ── target detection (focusin + deep focus) ─────────────────── */
let target=null;
document.addEventListener('focusin', e => { if(isEditable(e.target)) target=e.target; });
window.addEventListener('focus', e => {
  const deep = e.composedPath ? e.composedPath()[0] : e.target;
  if (isEditable(deep)) target = deep;
}, true);


function isEditable(el){
  if(!el) return false;
  const t=el.tagName;
  if(t==='TEXTAREA') return true;
  if(t==='INPUT')    return ['text','search','url','tel','email','password'].includes(el.type||'text');
  return el.isContentEditable;
}

/* ── state ───────────────────────────────────────────────────── */
let isDown=false, recognizer=null, buffer='';
let ctx, stream, source, processor, pcm=[];

/* ── key listeners ───────────────────────────────────────────── */
document.addEventListener('keydown', e=>{
  if(isDown||!isEditable(document.activeElement)) return;
  if(matchHK(e)){ isDown=true; startDictation(); e.preventDefault(); }
}, true);

document.addEventListener('keyup', e=>{
  if(!isDown) return;
  if(matchHK(e)){ isDown=false; stopDictation(); e.preventDefault(); }
}, true);

/* =======================  START / STOP  ======================= */
function startDictation(){
  if(!target) return;
  badge.style.display='inline-block';
  dot.style.background='#0f0';

  if(cfg.mode==='webspeech'){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognizer = new SR();
    recognizer.lang = cfg.language;
    recognizer.continuous = false;
    recognizer.interimResults = false;
    buffer='';
    recognizer.onresult = e=>{
      buffer += Array.from(e.results).map(r=>r[0].transcript).join(' ');
    };
    recognizer.onend = ()=>{ if(buffer.trim()) insertText(buffer); badge.style.display='none'; };
    recognizer.start();
  } else {                                    /* ─ Gemini branch ─ */
    pcm=[];
    navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{
      stream=s;
      ctx = new AudioContext({sampleRate:16000});
      source = ctx.createMediaStreamSource(stream);
      processor = ctx.createScriptProcessor(4096,1,1);
      source.connect(processor); processor.connect(ctx.destination);
      processor.onaudioprocess = e=> pcm.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    }).catch(err=>{console.error(err);badge.style.display='none';});
  }
}

function stopDictation(){
  if(cfg.mode==='webspeech'){
    recognizer && recognizer.stop();     // final text arrives in onend
  }else{
    if(!processor) return;
    processor.disconnect(); source.disconnect();
    stream.getTracks().forEach(t=>t.stop());
    ctx.close();
    const wav  = float32ToWav(pcm,16000);
    const b64  = arrayBufferToBase64(wav);
    chrome.runtime.sendMessage({type:'VT_GEMINI',b64,lang:cfg.language},res=>{
      if(res?.text) insertText(res.text);
    });
    badge.style.display='none';
  }
}

/* ======================  INSERT HELPER  ====================== */
function insertText(text){
  if(!target) return;

  if(target.tagName==='TEXTAREA'||target.tagName==='INPUT'){
    const st=target.selectionStart,en=target.selectionEnd;
    target.value = target.value.slice(0,st)+text+target.value.slice(en);
    const pos = st+text.length;
    target.setSelectionRange(pos,pos);
    target.dispatchEvent(new Event('input',{bubbles:true}));
    target.dispatchEvent(new Event('change',{bubbles:true})); 
  }else if(target.isContentEditable){
    const sel=getSelection(); if(!sel.rangeCount) return;
    const r=sel.getRangeAt(0);
    r.deleteContents(); r.insertNode(document.createTextNode(text)); r.collapse(false);
  }
}

/* ==========  WAV helpers (stack-safe Base-64)  ========== */
function float32ToWav(buffers,sr){
  const cat = arrs=>{
    let len=arrs.reduce((a,b)=>a+b.length,0),out=new Float32Array(len),o=0;
    arrs.forEach(a=>{out.set(a,o);o+=a.length}); return out;
  };
  const f32=cat(buffers),len=f32.length,buf=new ArrayBuffer(44+len*2),v=new DataView(buf);
  const w=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  w(0,'RIFF'); v.setUint32(4,36+len*2,true); w(8,'WAVEfmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*2,true);
  v.setUint16(32,2,true); v.setUint16(34,16,true);
  w(36,'data'); v.setUint32(40,len*2,true);
  for(let i=0,o=44;i<len;i++,o+=2){
    let s=Math.max(-1,Math.min(1,f32[i]));
    v.setInt16(o,s<0?s*0x8000:s*0x7FFF,true);
  }
  return buf;
}
function arrayBufferToBase64(buf){
  const bytes = new Uint8Array(buf);
  const chunk = 8192;           // 8 KB avoids V8 arg limit
  let result = '';
  for (let i = 0; i < bytes.length; i += chunk){
    result += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(result);
}


/* ==========  Context-menu dictionary ========== */
chrome.runtime.onMessage.addListener(msg=>{
  if(msg?.type==='VT_PROMPT_ADD_DICT'){
    const word = prompt('Word:', msg.text||'');
    if(word===null) return;
    const repl = prompt('Replacement:', word);
    chrome.storage.sync.get({dictionary:[]},s=>{
      s.dictionary.push({word,repl});
      chrome.storage.sync.set({dictionary:s.dictionary});
    });
  }
});
