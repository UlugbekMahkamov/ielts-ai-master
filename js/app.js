/**
 * Global App Controller, Router, State & Utilities
 */

const AppState = {
  currentRoute: 'dashboard',
  dashboardData: null,
  activeArticle: null,
  activePodcast: null,
  selectedTextForSRS: ''
};

// Local In-Browser Dispatcher
function handleLocalDispatcher(endpoint, method, data) {
  const clean = endpoint.split('?')[0];

  if (clean === '/api/dashboard') {
    return JSON.parse(localStorage.getItem('ielts_dashboard_data') || 'null') || DEFAULT_DASHBOARD;
  }
  if (clean === '/api/settings') {
    if (method === 'POST' && data && data.settings) {
      localStorage.setItem('ielts_app_settings', JSON.stringify(data.settings));
      if (data.settings.gemini_api_key) {
        localStorage.setItem('gemini_api_key', data.settings.gemini_api_key);
      }
      return { status: 'success' };
    }
    return JSON.parse(localStorage.getItem('ielts_app_settings') || '{"llm_provider":"gemini","tts_voice":"en-GB-RyanNeural"}');
  }
  if (clean === '/api/mistakes') {
    const mistakes = JSON.parse(localStorage.getItem('ielts_mistakes_bank') || '[]');
    if (method === 'POST' && data) {
      const newM = {
        id: Date.now(),
        original_text: data.original_text || '',
        corrected_text: data.corrected_text || '',
        explanation: data.explanation || '',
        category: data.category || 'grammar',
        created_at: new Date().toLocaleDateString()
      };
      mistakes.unshift(newM);
      localStorage.setItem('ielts_mistakes_bank', JSON.stringify(mistakes));
      return newM;
    }
    return mistakes;
  }
  if (clean === '/api/sentences/history') {
    return JSON.parse(localStorage.getItem('ielts_sentences_history') || '[]');
  }
  if (clean === '/api/coach/history') {
    if (method === 'DELETE') {
      localStorage.removeItem('coach_local_history');
      return { status: 'success' };
    }
    return JSON.parse(localStorage.getItem('coach_local_history') || '[]');
  }
  return undefined;
}

// API Fetch Helper with Local Fallback (backend har doim BIRINCHI sinaladi)
async function apiCall(endpoint, method = 'GET', data = null, silent = true) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }
  try {
    const res = await fetch(endpoint, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Server bilan aloqa yo\'q' }));
      const fallback = handleLocalDispatcher(endpoint, method, data);
      if (fallback !== undefined) return fallback;
      throw new Error(err.detail || 'Tarmoq xatosi');
    }
    return await res.json();
  } catch (error) {
    const fallback = handleLocalDispatcher(endpoint, method, data);
    if (fallback !== undefined) return fallback;
    if (!silent) {
      showToast(error.message, 'error');
    }
    throw error;
  }
}

// Router
function navigateTo(routeId) {
  AppState.currentRoute = routeId;

  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });
  const targetSec = document.getElementById(`view-${routeId}`);
  if (targetSec) {
    targetSec.classList.add('active');
  }

  document.querySelectorAll('.drawer-item').forEach(item => {
    if (item.dataset.route === routeId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    if (item.dataset.route === routeId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  toggleDrawer(false);

  if (routeId === 'dashboard') loadDashboard();
  if (routeId === 'study-plan') loadStudyPlans();
  if (routeId === 'article') loadArticlesList();
  if (routeId === 'podcast') loadPodcastsList();
  if (routeId === 'dictation') initDictationView();
  if (routeId === 'vocabulary') loadVocabularyView();
  if (routeId === 'mistakes') loadMistakesList();
  if (routeId === 'coach') loadCoachView();
  if (routeId === 'settings') loadSettingsView();

  if (window.lucide) {
    try { lucide.createIcons(); } catch(e) {}
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleDrawer(open) {
  const drawer = document.getElementById('appDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if (open) {
    drawer.classList.add('active');
    overlay.classList.add('active');
  } else {
    drawer.classList.remove('active');
    overlay.classList.remove('active');
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let icon = '🔔';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

const DEFAULT_DASHBOARD = {
  streak_days: 1,
  lessons_done: 0,
  lessons_total: 1,
  words_learned: 5,
  words_total: 5,
  articles_added: 6,
  podcasts_added: 6,
  mistakes_logged: 0,
  progress: {
    study_plan: 25,
    article: 30,
    podcast: 20,
    dictation: 15,
    vocabulary: 40,
    mistakes: 10,
    sentences: 20
  }
};

async function loadDashboard() {
  let data = DEFAULT_DASHBOARD;
  try {
    const fetched = await apiCall('/api/dashboard');
    if (fetched && fetched.streak_days !== undefined) {
      data = fetched;
    }
  } catch (e) {
    data = JSON.parse(localStorage.getItem('cached_dashboard') || 'null') || DEFAULT_DASHBOARD;
  }
  localStorage.setItem('cached_dashboard', JSON.stringify(data));
  AppState.dashboardData = data;

  const el = id => document.getElementById(id);
  if (el('streakCount')) el('streakCount').innerText = data.streak_days;
  if (el('dashStreakVal')) el('dashStreakVal').innerText = data.streak_days;
  if (el('dashLessonsVal')) el('dashLessonsVal').innerText = data.lessons_done;
  if (el('dashWordsVal')) el('dashWordsVal').innerText = data.words_learned;
  if (el('dashArticlesVal')) el('dashArticlesVal').innerText = `${(data.articles_added || 0) + (data.podcasts_added || 0)}`;

  if (el('drawerBadgeStudy')) el('drawerBadgeStudy').innerText = data.lessons_total || 1;
  if (el('drawerBadgeArticle')) el('drawerBadgeArticle').innerText = data.articles_added || 6;
  if (el('drawerBadgePodcast')) el('drawerBadgePodcast').innerText = data.podcasts_added || 6;
  if (el('drawerBadgeVocab')) el('drawerBadgeVocab').innerText = data.words_total || 5;
  if (el('drawerBadgeMistakes')) el('drawerBadgeMistakes').innerText = data.mistakes_logged || 0;

  const p = data.progress || DEFAULT_DASHBOARD.progress;
  updateProgressBar('Study', p.study_plan || 0);
  updateProgressBar('Article', p.article || 0);
  updateProgressBar('Podcast', p.podcast || 0);
  updateProgressBar('Dictation', p.dictation || 0);
  updateProgressBar('Vocab', p.vocabulary || 0);
  updateProgressBar('Mistakes', p.mistakes || 0);
  updateProgressBar('Sentences', p.sentences || 0);

  if (window.lucide) {
    try { lucide.createIcons(); } catch(e) {}
  }
}

function updateProgressBar(name, val) {
  const fill = document.getElementById(`progFill${name}`);
  const text = document.getElementById(`progText${name}`);
  if (fill && text) {
    fill.style.width = `${val}%`;
    text.innerText = `${val}%`;
  }
}

// Global Text Selection Handler
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  const tooltip = document.getElementById('wordSelectionTooltip');

  if (text.length >= 2 && text.length < 250 && (AppState.currentRoute === 'article' || AppState.currentRoute === 'podcast')) {
    AppState.selectedTextForSRS = text;
    document.getElementById('selectedWordLabel').innerText = text;

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      tooltip.style.left = `${Math.min(window.innerWidth - 240, Math.max(10, rect.left))}px`;
      tooltip.style.top = `${Math.max(10, rect.bottom + 8)}px`;
      tooltip.style.display = 'flex';
    } catch (e) {
      tooltip.style.display = 'none';
    }
  } else {
    if (tooltip && !tooltip.contains(document.activeElement)) {
      tooltip.style.display = 'none';
    }
  }
});

// 1. Add selected text to Vocabulary (SRS)
async function addSelectedWordToSRS() {
  const word = AppState.selectedTextForSRS;
  if (!word) return;
  document.getElementById('wordSelectionTooltip').style.display = 'none';
  showToast(`"${word}" AI tahlili qilinmoqda...`);

  try {
    const res = await apiCall('/api/vocabulary/add', 'POST', {
      word: word,
      source: AppState.activeArticle ? AppState.activeArticle.title : (AppState.activePodcast ? AppState.activePodcast.title : 'Selected Text'),
      auto_lookup: true
    });
    showToast(`"${word}" SRS Lug'atiga qo'shildi!`, 'success');
  } catch (e) {
    console.error(e);
  }
}

// 2. Extract and add sentence structure to Sentences module
async function addSelectedSentenceToStructures() {
  const sentence = AppState.selectedTextForSRS;
  if (!sentence) return;
  document.getElementById('wordSelectionTooltip').style.display = 'none';
  showToast(`AI ushbu gapdan akademik grammatik modelni ajratmoqda...`);

  try {
    const res = await apiCall('/api/sentences/add-from-text', 'POST', {
      selected_text: sentence,
      source: AppState.activeArticle ? AppState.activeArticle.title : (AppState.activePodcast ? AppState.activePodcast.title : 'Matndan olingan')
    });
    showToast(`"${res.pattern}" Sentences bo'limiga qo'shildi! 🎉`, 'success');
  } catch (e) {
    console.error(e);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});
