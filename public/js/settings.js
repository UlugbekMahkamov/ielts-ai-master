/**
 * Settings Module: LLM Provider, API Keys & Edge-TTS Voice Preferences
 */

async function loadSettingsView() {
  try {
    let s = {};
    try {
      s = await apiCall('/api/settings');
    } catch (err) {
      s = JSON.parse(localStorage.getItem('app_settings') || '{}');
    }
    
    document.getElementById('settingLLMProvider').value = s.llm_provider || 'gemini';
    document.getElementById('settingGeminiKey').value = s.gemini_api_key || localStorage.getItem('gemini_api_key') || '';
    document.getElementById('settingOpenAIKey').value = s.openai_api_key || '';
    document.getElementById('settingGroqKey').value = s.groq_api_key || '';
    document.getElementById('settingCustomBase').value = s.custom_api_base || '';
    document.getElementById('settingTTSVoice').value = s.tts_voice || 'en-GB-RyanNeural';

    updateSettingsVisibility();
  } catch (e) {
    console.error(e);
  }
}

function updateSettingsVisibility() {
  const provider = document.getElementById('settingLLMProvider').value;
  
  document.getElementById('groupGeminiKey').style.display = provider === 'gemini' ? 'block' : 'none';
  document.getElementById('groupOpenAIKey').style.display = provider === 'openai' ? 'block' : 'none';
  document.getElementById('groupGroqKey').style.display = provider === 'groq' ? 'block' : 'none';
  document.getElementById('groupCustomBase').style.display = provider === 'custom' ? 'block' : 'none';
}

async function saveAppSettings() {
  const settings = {
    llm_provider: document.getElementById('settingLLMProvider').value,
    gemini_api_key: document.getElementById('settingGeminiKey').value.trim(),
    openai_api_key: document.getElementById('settingOpenAIKey').value.trim(),
    groq_api_key: document.getElementById('settingGroqKey').value.trim(),
    custom_api_base: document.getElementById('settingCustomBase').value.trim(),
    tts_voice: document.getElementById('settingTTSVoice').value
  };

  localStorage.setItem('app_settings', JSON.stringify(settings));
  if (settings.gemini_api_key) {
    localStorage.setItem('gemini_api_key', settings.gemini_api_key);
  }

  showToast('Sozlamalar saqlanmoqda...');
  try {
    await apiCall('/api/settings', 'POST', { settings });
  } catch (e) {
    console.warn('Backend settings sync note:', e);
  }
  showToast('Sozlamalar muvaffaqiyatli saqlandi! ✅', 'success');
}
