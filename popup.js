function label(arr){
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
chrome.runtime.sendMessage({type:'va_get_counts'},res=>{
  if(!res||!res.ok) return;
  document.getElementById('d').textContent = res.counts.day.count;
  document.getElementById('m').textContent = res.counts.month.count;
  document.getElementById('t').textContent = res.counts.total;
});
chrome.storage.local.get(['va_hotkey_v1'],v=>{
  const hk = v['va_hotkey_v1'] || ['ShiftLeft','Space'];
  document.getElementById('hk').textContent = label(hk);
});
document.getElementById('go').onclick=()=>chrome.runtime.openOptionsPage();