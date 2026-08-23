/**
 * Mistakes Module: Central Repository & Interactive Drill Mode
 */

let allMistakes = [];

async function loadMistakesList() {
  try {
    allMistakes = await apiCall('/api/mistakes');
    renderMistakesList(allMistakes);
  } catch (e) {
    console.error(e);
  }
}

function renderMistakesList(mistakes) {
  const container = document.getElementById('mistakesListContainer');
  if (!mistakes || mistakes.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 24px;">
        <p style="color: var(--text-muted); font-size: 13px;">Hozircha xatolar qayd etilmagan. Speaking va Writing topshiriqlarini bajarganingizda xatolar bu yerda avtomatik to'planadi.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = mistakes.map(m => `
    <div class="card" style="background: #151d2e; border-left: 4px solid #ef4444; margin-bottom: 12px; padding: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 10px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${m.error_type || 'Grammar'}</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; color: var(--text-muted);">${m.created_at || ''} &bull; ${m.source_title || 'Speaking/Writing'}</span>
          <button class="btn btn-sm btn-danger" style="padding: 2px 6px; font-size: 11px;" onclick="deleteMistake(${m.id})" title="Xatoni o'chirish">🗑️</button>
        </div>
      </div>

      <div style="margin-bottom: 8px;">
        <div style="font-size: 13px; color: #f87171; font-weight: 600; margin-bottom: 4px;">
          ❌ Mening xato variantim: <span style="text-decoration: line-through;">"${m.error_text}"</span>
        </div>
        <div style="font-size: 13px; color: #34d399; font-weight: 700;">
          ✅ To'g'ri / Ilg'or variant: "${m.corrected_text}"
        </div>
      </div>

      <div style="background: rgba(0,0,0,0.25); border-radius: 6px; padding: 8px; font-size: 12px; color: var(--text-muted);">
        <strong style="color: var(--accent);">💡 Tushuntirish:</strong> ${m.explanation}
      </div>
    </div>
  `).join('');
}

function startMistakesPracticeDrill() {
  if (!allMistakes || allMistakes.length === 0) {
    showToast('Mashq qilish uchun xatolar mavjud emas.');
    return;
  }
  showToast('Xatolar bo\'yicha interaktiv drill boshlandi!', 'success');
  // Scroll to list
  window.scrollTo({ top: 100, behavior: 'smooth' });
}

async function deleteMistake(mistakeId) {
  if (!confirm('Ushbu xatoni jurnaldan o\'chirmoqchimisiz?')) return;
  try {
    await apiCall(`/api/mistakes/${mistakeId}`, 'DELETE');
    showToast('Xato o\'chirildi! 🗑️', 'success');
    loadMistakesList();
  } catch (e) {
    console.error(e);
  }
}
