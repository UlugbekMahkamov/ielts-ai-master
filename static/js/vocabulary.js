const DEFAULT_VOCABULARY = [
  {
    id: 1,
    word: "ubiquitous",
    translation: "hamma joyda mavjud",
    definition: "present, appearing, or found everywhere",
    ipa: "/juːˈbɪk.wɪ.təs/",
    example: "Smartphones have become ubiquitous in daily modern life.",
    collocations: "ubiquitous presence, increasingly ubiquitous",
    interval_stage: 1,
    interval_days: 1,
    review_count: 1,
    next_review_date: "2026-08-24"
  },
  {
    id: 2,
    word: "predominantly",
    translation: "asosan, aksariyat hollarda",
    definition: "mainly; for the most part",
    ipa: "/prɪˈdɒm.ɪ.nənt.li/",
    example: "The student population is predominantly bilingual.",
    collocations: "predominantly focused on, remain predominantly",
    interval_stage: 1,
    interval_days: 1,
    review_count: 1,
    next_review_date: "2026-08-24"
  },
  {
    id: 3,
    word: "paradigm shift",
    translation: "tub burilish, yangi modelga o'tish",
    definition: "a fundamental change in approach or underlying assumptions",
    ipa: "/ˈpær.ə.daɪm ʃɪft/",
    example: "Quantum computing marks a paradigm shift in data science.",
    collocations: "trigger a paradigm shift, radical paradigm shift",
    interval_stage: 2,
    interval_days: 3,
    review_count: 2,
    next_review_date: "2026-08-26"
  },
  {
    id: 4,
    word: "mitigate",
    translation: "yumshatmoq, ta'sirini kamaytirmoq",
    definition: "make something less severe, serious, or painful",
    ipa: "/ˈmɪt.ɪ.ɡeɪt/",
    example: "Reforestation substantially mitigates catastrophic soil erosion.",
    collocations: "mitigate environmental impact, mitigate the risk",
    interval_stage: 2,
    interval_days: 3,
    review_count: 2,
    next_review_date: "2026-08-26"
  },
  {
    id: 5,
    word: "inexorable",
    translation: "to'xtatib bo'lmas, muqarrar",
    definition: "impossible to stop or prevent",
    ipa: "/ɪnˈek.sər.ə.bəl/",
    example: "The inexorable march of technological advancement transforms commerce.",
    collocations: "inexorable rise, inexorable process",
    interval_stage: 1,
    interval_days: 1,
    review_count: 0,
    next_review_date: "2026-08-24"
  }
];

let currentSRSStage = 'due';
let allVocabWords = [];
let studyQueue = [];
let activeCardIndex = 0;

function getStoredVocabulary() {
  return JSON.parse(localStorage.getItem('ielts_vocab_list') || 'null') || DEFAULT_VOCABULARY;
}

function saveStoredVocabulary(words) {
  localStorage.setItem('ielts_vocab_list', JSON.stringify(words));
}

async function loadVocabularyView() {
  await loadSRSCounts();
  await loadWordsForStage(currentSRSStage);
}

async function loadSRSCounts() {
  const words = getStoredVocabulary();
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0, s5 = 0, learned = 0, due = 0;
  words.forEach(w => {
    if (w.interval_stage === 1) s1++;
    else if (w.interval_stage === 2) s2++;
    else if (w.interval_stage === 3) s3++;
    else if (w.interval_stage === 4) s4++;
    else if (w.interval_stage === 5) s5++;
    else if (w.interval_stage >= 6) learned++;
    due++;
  });

  const el = id => document.getElementById(id);
  if (el('countDue')) el('countDue').innerText = due;
  if (el('countStage1')) el('countStage1').innerText = s1;
  if (el('countStage2')) el('countStage2').innerText = s2;
  if (el('countStage3')) el('countStage3').innerText = s3;
  if (el('countStage4')) el('countStage4').innerText = s4;
  if (el('countStage5')) el('countStage5').innerText = s5;
  if (el('countLearned')) el('countLearned').innerText = learned;
}

async function switchSRSTab(stage) {
  currentSRSStage = stage;
  document.querySelectorAll('.srs-tab-btn').forEach(btn => {
    btn.className = (btn.dataset.stage == stage) ? 'btn btn-sm btn-primary srs-tab-btn' : 'btn btn-sm btn-secondary srs-tab-btn';
  });
  await loadWordsForStage(stage);
}

async function loadWordsForStage(stage) {
  const words = getStoredVocabulary();
  if (stage === 'due') {
    allVocabWords = words;
  } else {
    allVocabWords = words.filter(w => w.interval_stage == stage);
  }
  renderVocabTable(allVocabWords);
}

function renderVocabTable(words) {
  const container = document.getElementById('vocabularyListContainer');
  if (!words || words.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 24px;">
        <p style="color: var(--text-muted); font-size: 13px;">Ushbu bo'limda so'zlar mavjud emas.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = words.map(w => `
    <div class="card" style="background: #141c2e; margin-bottom: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
          <strong style="font-size: 16px; color: white;">${w.word}</strong>
          <span style="font-size: 11px; color: var(--text-muted);">${w.ipa || ''}</span>
          <span class="badge" style="background: var(--primary); font-size: 9px; padding: 1px 5px; border-radius: 4px;">
            ${w.is_learned ? 'Learned' : `${w.interval_days} kun`}
          </span>
        </div>
        <div style="font-size: 13px; color: #38bdf8; font-weight: 600;">${w.translation || ''}</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${w.example || w.definition || ''}</div>
      </div>
      <div style="display: flex; gap: 6px;">
        <button class="btn btn-sm btn-secondary" onclick="speakText('${w.word.replace(/'/g, "\\'")}')" title="Tinglash">🔊</button>
        <button class="btn btn-sm btn-danger" onclick="deleteVocabWord(${w.id}, '${w.word.replace(/'/g, "\\'")}')" title="So'zni o'chirish">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function deleteVocabWord(wordId, word) {
  if (!confirm(`"${word}" so'zini lug'atdan o'chirmoqchimisiz?`)) return;
  try {
    await apiCall(`/api/vocabulary/${wordId}`, 'DELETE');
    showToast('So\'z o\'chirildi! 🗑️', 'success');
    loadVocabularyView();
  } catch (e) {
    console.error(e);
  }
}

// 3D Flashcard Study Session
function startFlashcardStudySession() {
  studyQueue = allVocabWords.length > 0 ? [...allVocabWords] : [];
  if (studyQueue.length === 0) {
    showToast('Mashq qilish uchun so\'zlar mavjud emas.');
    return;
  }

  activeCardIndex = 0;
  document.getElementById('flashcardStudyArea').style.display = 'block';
  displayActiveCard();
  window.scrollTo({ top: 300, behavior: 'smooth' });
}

function displayActiveCard() {
  if (activeCardIndex >= studyQueue.length) {
    document.getElementById('flashcardStudyArea').style.display = 'none';
    showToast('Bugungi takrorlash muvaffaqiyatli yakunlandi! 🎉', 'success');
    loadVocabularyView();
    return;
  }

  const card = studyQueue[activeCardIndex];
  const cardEl = document.getElementById('activeFlashcard');
  cardEl.classList.remove('flipped');

  document.getElementById('cardStageLabel').innerText = card.is_learned ? 'Mastered (Learned)' : `Stage ${card.interval_stage} (${card.interval_days} kun)`;
  document.getElementById('cardWord').innerText = card.word;
  document.getElementById('cardIPA').innerText = card.ipa || '';
  document.getElementById('cardContextSnippet').innerText = card.example ? `"${card.example}"` : '';

  document.getElementById('cardTranslation').innerText = card.translation || 'Tarjima kiritilmagan';
  document.getElementById('cardDefinition').innerText = card.definition || '';
  document.getElementById('cardCollocations').innerText = card.collocations || 'Collocations mavjud emas';
}

function flipFlashcard() {
  const cardEl = document.getElementById('activeFlashcard');
  cardEl.classList.toggle('flipped');
}

function playWordTTS() {
  const card = studyQueue[activeCardIndex];
  if (card && card.word) {
    speakText(card.word);
  }
}

async function rateActiveCard(isCorrect) {
  const card = studyQueue[activeCardIndex];
  if (!card) return;

  try {
    const updated = await apiCall(`/api/vocabulary/${card.id}/review`, 'POST', { is_correct: isCorrect });
    showToast(isCorrect ? `To'g'ri! Keyingi interval: ${updated.interval_days} kun` : `Xato. 1 kunga qaytarildi.`, isCorrect ? 'success' : 'error');
    activeCardIndex++;
    displayActiveCard();
    loadSRSCounts();
  } catch (e) {
    console.error(e);
  }
}

// Add Word Modal & AI Auto-Fill
function openAddWordModal() {
  openModal('addWordModal');
}

async function autoFillWordDetails() {
  const word = document.getElementById('newWordInput').value.trim();
  if (!word) {
    showToast('So\'zni kiriting!', 'error');
    return;
  }

  showToast(`AI "${word}" tahlilini yuklamoqda...`);
  try {
    const details = await apiCall('/api/vocabulary/lookup', 'POST', { word });
    document.getElementById('newWordTranslation').value = details.translation || '';
    document.getElementById('newWordDefinition').value = details.definition || '';
    document.getElementById('newWordIPA').value = details.ipa || '';
    document.getElementById('newWordExample').value = details.example || '';
    showToast('Tafsilotlar avtomatik to\'ldirildi!', 'success');
  } catch (e) {
    console.error(e);
  }
}

async function submitNewWord() {
  const word = document.getElementById('newWordInput').value.trim();
  const translation = document.getElementById('newWordTranslation').value.trim();
  const definition = document.getElementById('newWordDefinition').value.trim();
  const ipa = document.getElementById('newWordIPA').value.trim();
  const example = document.getElementById('newWordExample').value.trim();

  if (!word) {
    showToast('So\'z kiritilishi shart!', 'error');
    return;
  }

  try {
    await apiCall('/api/vocabulary/add', 'POST', {
      word, translation, definition, ipa, example, source: 'Manual Input'
    });
    closeModal('addWordModal');
    showToast(`"${word}" SRS tizimiga qo'shildi!`, 'success');
    document.getElementById('newWordInput').value = '';
    document.getElementById('newWordTranslation').value = '';
    document.getElementById('newWordDefinition').value = '';
    document.getElementById('newWordIPA').value = '';
    document.getElementById('newWordExample').value = '';
    loadVocabularyView();
  } catch (e) {
    console.error(e);
  }
}
