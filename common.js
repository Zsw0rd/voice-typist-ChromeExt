const VA_KEYS_STORAGE = 'va_hotkey_v1';
const VA_SETTINGS = 'va_settings_v1';
const VA_COUNTS = 'va_counts_v1';

const defaultSettings = {
  mode: 'webspeech',
  geminiModel: 'gemini-2.0-flash',
  geminiAction: 'echo',
  apiKey: '',
  pasteMode: 'insert',
  urlBarFallback: 'search',
  language: 'en-US'
};

function loadSettings() {
  return new Promise(r=>chrome.storage.local.get([VA_SETTINGS, VA_KEYS_STORAGE],v=>{
    const s = Object.assign({}, defaultSettings, v[VA_SETTINGS]||{});
    const hotkey = v[VA_KEYS_STORAGE] || ['ShiftLeft','Space'];
    r({settings:s,hotkey});
  }));
}

function saveSettings(obj) {
  return new Promise(r=>chrome.storage.local.get([VA_SETTINGS],v=>{
    const next = Object.assign({}, v[VA_SETTINGS]||{}, obj);
    chrome.storage.local.set({[VA_SETTINGS]:next},()=>r(next));
  }));
}

function saveHotkey(arr){
  return new Promise(r=>chrome.storage.local.set({[VA_KEYS_STORAGE]:arr},r));
}

function normalizeCombo(e){
  const parts=[];
  if(e.ctrlKey) parts.push('Control');
  if(e.metaKey) parts.push('Meta');
  if(e.altKey) parts.push('Alt');
  if(e.shiftKey) parts.push('Shift');
  const code = e.code;
  if(!['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight'].includes(code)) parts.push(code);
  return parts;
}

function comboToLabel(arr){
  return arr.map(k=>{
    if(k==='Shift') return 'Shift';
    if(k==='Control') return 'Ctrl';
    if(k==='Meta') return 'Cmd';
    if(k==='Alt') return 'Alt';
    if(k.startsWith('Key')) return k.slice(3);
    if(k.startsWith('Digit')) return k.slice(5);
    if(k==='Space') return 'Space';
    return k.replace('Left','').replace('Right','');
  }).join(' + ');
}

function matchesCombo(e, combo){
  const want = new Set(combo);
  const have = new Set(normalizeCombo(e));
  if(want.size!==have.size) return false;
  for(const k of want){ if(!have.has(k)) return false; }
  return true;
}

function countWords(t){
  if(!t) return 0;
  const s=t.trim();
  if(!s) return 0;
  return s.split(/\s+/).filter(Boolean).length;
}
