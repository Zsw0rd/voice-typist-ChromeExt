function toLabel(arr){
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

let combo = [];
const $ = s=>document.querySelector(s);

async function init(){
  const v = await loadSettings();
  $('#mode').value = v.settings.mode;
  $('#model').value = v.settings.geminiModel;
  $('#key').value = v.settings.apiKey;
  $('#gaction').value = v.settings.geminiAction || 'echo';
  $('#paste').value = v.settings.pasteMode || 'insert';
  $('#lang').value = v.settings.language || 'en-US';
  combo = v.hotkey;
  $('#hotkey').value = toLabel(v.hotkey);
  toggleGeminiBox();
  refreshUsage();
}

function toggleGeminiBox(){
  const on = $('#mode').value==='gemini';
  $('#geminiBox').classList.toggle('on',on);
}

$('#mode').addEventListener('change',async()=>{ await saveSettings({mode: $('#mode').value}); toggleGeminiBox(); });
$('#model').addEventListener('change',async()=>{ await saveSettings({geminiModel: $('#model').value}); });
$('#key').addEventListener('input',async()=>{ await saveSettings({apiKey: $('#key').value}); });
$('#gaction').addEventListener('change',async()=>{ await saveSettings({geminiAction: $('#gaction').value}); });
$('#paste').addEventListener('change',async()=>{ await saveSettings({pasteMode: $('#paste').value}); });
$('#lang').addEventListener('change',async()=>{ await saveSettings({language: $('#lang').value}); });

$('#clear').addEventListener('click',()=>{ combo=[]; $('#hotkey').value=''; saveHotkey(combo); });

$('#hotkey').addEventListener('keydown',e=>{
  e.preventDefault();
  if(e.code==='Backspace'){ combo=[]; $('#hotkey').value=''; saveHotkey(combo); return; }
  const parts=[];
  if(e.ctrlKey) parts.push('Control');
  if(e.metaKey) parts.push('Meta');
  if(e.altKey) parts.push('Alt');
  if(e.shiftKey) parts.push('Shift');
  const code=e.code;
  if(!['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight'].includes(code)) parts.push(code);
  if(parts.length===0) return;
  combo=parts;
  $('#hotkey').value=toLabel(combo);
  saveHotkey(combo);
});

async function refreshUsage(){
  chrome.runtime.sendMessage({type:'va_get_counts'},res=>{
    if(!res||!res.ok) return;
    $('#u-day').textContent = res.counts.day.count;
    $('#u-month').textContent = res.counts.month.count;
    $('#u-total').textContent = res.counts.total;
  });
}

$('#reset').addEventListener('click',async()=>{
  const z={day:{date:new Date().toISOString().slice(0,10),count:0},month:{ym:new Date().toISOString().slice(0,7),count:0},total:0};
  chrome.storage.local.set({va_counts_v1:z},refreshUsage);
});

init();
