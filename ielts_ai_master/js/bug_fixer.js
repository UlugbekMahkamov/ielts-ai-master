/**
 * AI Bug Fixer Module: Interactive In-App Diagnostic, Auto-Repair & Debugger Agent
 */

let lastDiagnosticData = null;

function openBugFixerModal() {
  openModal('bugFixerModal');
  loadBugFixerDiagnostics();
}

async function loadBugFixerDiagnostics() {
  const statusContainer = document.getElementById('bugFixerStatusBox');
  statusContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px;">🔍 Tizim to'liq skanerdan o'tkazilmoqda...</div>`;

  try {
    const data = await apiCall('/api/bug-fixer/diagnose');
    lastDiagnosticData = data;

    const isHealthy = data.status === 'healthy';
    statusContainer.innerHTML = `
      <div style="background: ${isHealthy ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; border: 1px solid ${isHealthy ? 'var(--success)' : '#f59e0b'}; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="color: ${isHealthy ? 'var(--success)' : '#f59e0b'}; font-size: 14px;">
            ${isHealthy ? '✅ Barcha Tizimlar 100% Sog\'lom' : `⚠️ ${data.issues_found} ta sozlash talab qilinadi`}
          </strong>
          <span class="badge" style="background: var(--bg-card-alt); font-size: 11px;">LLM: ${data.llm_provider || 'gemini'}</span>
        </div>

        <div style="font-size: 12px; color: var(--text-main); margin-bottom: 6px;">
          <span>📚 Artikllar: <strong>${data.total_articles} ta</strong></span> &bull; 
          <span>🎙️ Podkastlar: <strong>${data.total_podcasts} ta</strong></span> &bull;
          <span>🎧 Har birida 20 ta IELTS savoli</span>
        </div>

        ${data.issues && data.issues.length > 0 ? `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
            ${data.issues.map(iss => `
              <div style="font-size: 12px; color: #fca5a5; margin-bottom: 4px;">
                &bull; <strong>${iss.component}:</strong> ${iss.message}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  } catch (e) {
    console.error(e);
    statusContainer.innerHTML = `<div style="color: var(--danger); font-size: 12px;">Diagnostika olishda xatolik: ${e.message}</div>`;
  }
}

async function runAutoRepair() {
  showToast('⚡ Tizim avtomatik sozlanmoqda va barcha topshiriqlar sinxronlanmoqda...');
  try {
    const res = await apiCall('/api/bug-fixer/auto-repair', 'POST', {});
    showToast(res.message, 'success');
    await loadBugFixerDiagnostics();

    // Reload active view if needed
    if (AppState.activeTab === 'article' && typeof loadArticlesList === 'function') {
      loadArticlesList();
    } else if (AppState.activeTab === 'podcast' && typeof loadPodcastsList === 'function') {
      loadPodcastsList();
    }
  } catch (e) {
    console.error(e);
    showToast('Xatolik: ' + e.message, 'error');
  }
}

async function submitBugFixerQuery() {
  const query = document.getElementById('bugFixerQueryInput').value.trim();
  const resultBox = document.getElementById('bugFixerQueryResult');

  if (!query) {
    showToast('Muammoni yozing!', 'error');
    return;
  }

  resultBox.style.display = 'block';
  resultBox.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">AI muammoni tahlil qilmoqda...</div>`;

  try {
    const res = await apiCall('/api/bug-fixer/chat', 'POST', { user_query: query });

    resultBox.innerHTML = `
      <div style="background: #141c2e; border: 1px solid var(--primary); border-radius: 8px; padding: 12px; margin-top: 10px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <span style="font-size: 16px;">🤖</span>
          <strong style="color: var(--accent); font-size: 13px;">AI Tahlili va Yechim:</strong>
        </div>
        <div style="font-size: 13px; color: var(--text-main); line-height: 1.5; margin-bottom: 10px;">
          ${res.reply}
        </div>
        ${res.recommended_action ? `
          <button class="btn btn-sm btn-primary" onclick="executeBugAction('${res.recommended_action}')">
            ${res.action_label || '⚡ Avtomatik Tuzatish'}
          </button>
        ` : ''}
      </div>
    `;
  } catch (e) {
    console.error(e);
  }
}

function executeBugAction(action) {
  if (action === 'auto_repair') {
    runAutoRepair();
  } else if (action === 'clear_cache') {
    clearAppCaches();
  } else if (action === 'check_tts') {
    speakText('Hello! Audio engine and pronunciation systems are operating normally.');
    showToast('Ovoz sinab ko\'rildi! 🔊', 'success');
  }
}

function clearAppCaches() {
  if (window.localStorage) {
    localStorage.clear();
  }
  showToast('Kesh tozalandi! Sahifa yangilanmoqda...', 'success');
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}
