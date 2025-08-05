document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // Load stored settings
  chrome.storage.sync.get(
    {
      hotkey: 'Ctrl+Space',
      mode: 'webspeech',
      language: 'en-US',
      geminiKey: '',
      geminiModel: 'gemini-2.5-flash'
    },
    s => {
      $('hk').value  = s.hotkey;
      $('mode').value = s.mode;
      $('lang').value = s.language;
      $('gkey').value = s.geminiKey;
      $('gmodel').value = s.geminiModel;
    }
  );

  // Save on change
  function save() {
    chrome.storage.sync.set({
      hotkey: $('hk').value.trim()   || 'Ctrl+Space',
      mode:   $('mode').value,
      language: $('lang').value.trim() || 'en-US',
      geminiKey: $('gkey').value.trim(),
      geminiModel: $('gmodel').value.trim() || 'gemini-2.5-flash'
    });
  }

  ['hk','mode','lang','gkey','gmodel']
    .forEach(id => $(id).addEventListener('change', save));
});
