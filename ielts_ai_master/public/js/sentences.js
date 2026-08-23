/**
 * Sentences Module: Daily C1 Academic Structure & Collocation Builder
 * Supports both standard C1 patterns and custom structures captured from Articles/Podcasts.
 */

let dailyPromptsData = null;
let activePromptIndex = 0;

async function loadSentencesView() {
  await fetchDailySentencePrompts();
  await loadSentencesHistory();
}

async function fetchDailySentencePrompts() {
  try {
    dailyPromptsData = await apiCall('/api/sentences/daily-prompts');
    renderActiveSentencePrompt();
  } catch (e) {
    console.error(e);
  }
}

function renderActiveSentencePrompt() {
  if (!dailyPromptsData || !dailyPromptsData.structures || dailyPromptsData.structures.length === 0) return;

  const structures = dailyPromptsData.structures;
  const current = structures[activePromptIndex % structures.length];

  document.getElementById('targetPatternHeading').innerText = current.pattern;
  document.getElementById('targetPatternHint').innerText = `${current.hint} ${current.example ? `(Masalan: "${current.example}")` : ''}`;
  
  const badge = document.getElementById('structureSourceBadge');
  if (badge) {
    badge.innerText = current.hint && current.hint.includes('Manba') ? 'Matndan Olingan' : 'AI C1 Pattern';
    badge.style.background = current.hint && current.hint.includes('Manba') ? 'rgba(6, 182, 212, 0.2)' : '#1e293b';
  }

  document.getElementById('userSentenceInput').value = '';
  document.getElementById('sentenceFeedbackResult').style.display = 'none';
}

function nextSentencePrompt() {
  activePromptIndex++;
  renderActiveSentencePrompt();
}

async function submitSentenceForEvaluation() {
  const sentence = document.getElementById('userSentenceInput').value.trim();
  const pattern = document.getElementById('targetPatternHeading').innerText;
  const hint = document.getElementById('targetPatternHint').innerText;
  const resultBox = document.getElementById('sentenceFeedbackResult');

  if (!sentence) {
    showToast('Gapingizni yozing!', 'error');
    return;
  }

  showToast('AI gapingizni tahlil qilmoqda...');
  try {
    const res = await apiCall('/api/sentences/submit', 'POST', {
      structure_or_word: pattern,
      pattern_hint: hint,
      user_sentence: sentence
    });

    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <div style="background: #101626; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: var(--accent); font-size: 13px;">AI Tahlili</strong>
          <span class="score-band-pill">Band ${res.band_score}</span>
        </div>

        <div style="font-size: 13px; color: var(--text-main); margin-bottom: 8px;">
          ${res.ai_feedback}
        </div>

        ${res.corrected_sentence ? `
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 8px; margin-bottom: 8px;">
            <div style="font-size: 11px; font-weight: 700; color: #34d399;">🌟 C1/C2 Ilg'or Variant:</div>
            <div style="font-size: 13px; color: white; margin-top: 2px;">"${res.corrected_sentence}"</div>
          </div>
        ` : ''}

        <div style="font-size: 11px; color: var(--text-muted);">
          📌 <em>${res.key_takeaway || ''}</em>
        </div>
      </div>
    `;

    showToast('Gap baholandi va saqlandi! 🎉', 'success');
    loadSentencesHistory();
  } catch (e) {
    console.error(e);
  }
}

async function loadSentencesHistory() {
  try {
    const history = await apiCall('/api/sentences/history');
    const container = document.getElementById('sentencesHistoryContainer');

    if (!history || history.length === 0) {
      container.innerHTML = `<p style="font-size: 12px; color: var(--text-muted);">Hozircha saqlangan gaplar yo'q.</p>`;
      return;
    }

    container.innerHTML = history.slice(0, 10).map(s => `
      <div style="background: #141c2e; border-radius: 6px; padding: 10px; margin-bottom: 8px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong style="color: var(--accent);">${s.structure_or_word}</strong>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="score-band-pill" style="font-size: 10px;">Band ${s.band_score}</span>
            <button class="btn btn-sm btn-danger" style="padding: 2px 6px; font-size: 10px;" onclick="deleteSentenceHistory(${s.id})" title="O'chirish">🗑️</button>
          </div>
        </div>
        <div style="color: white; margin-bottom: 4px;">"${s.user_sentence}"</div>
        ${s.corrected_sentence ? `<div style="color: #34d399; font-size: 11px;">✨ ${s.corrected_sentence}</div>` : ''}
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function deleteSentenceHistory(historyId) {
  if (!confirm('Ushbu gap mashqini o\'chirmoqchimisiz?')) return;
  try {
    await apiCall(`/api/sentences/history/${historyId}`, 'DELETE');
    showToast('O\'chirildi! 🗑️', 'success');
    loadSentencesHistory();
  } catch (e) {
    console.error(e);
  }
}
