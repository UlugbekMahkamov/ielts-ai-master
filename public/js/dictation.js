/**
 * Dictation Module: ~2 min Native Connected Speech & Speechling-Style Real-Time Diff Checker
 */

let currentDictation = null;
let dictationAudioEl = null;

function initDictationView() {
  dictationAudioEl = document.getElementById('nativeDictationAudio');
  
  if (!currentDictation) {
    loadLatestOrGenerateDictation();
  }

  // Setup audio time tracking
  if (dictationAudioEl) {
    dictationAudioEl.ontimeupdate = () => {
      if (dictationAudioEl.duration) {
        const cur = formatTime(dictationAudioEl.currentTime);
        const dur = formatTime(dictationAudioEl.duration);
        document.getElementById('dictationAudioTimer').innerText = `${cur} / ${dur}`;
        const pct = (dictationAudioEl.currentTime / dictationAudioEl.duration) * 100;
        document.getElementById('dictationAudioSlider').value = pct;
      }
    };

    dictationAudioEl.onended = () => {
      document.getElementById('dictationPlayBtn').innerText = '▶';
    };
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

async function loadLatestOrGenerateDictation() {
  try {
    const list = await apiCall('/api/dictations');
    if (list && list.length > 0) {
      loadDictationData(list[0]);
    } else {
      generateNewDictationAudio();
    }
  } catch (e) {
    console.error(e);
  }
}

async function generateNewDictationAudio() {
  showToast('AI ~2 daqiqalik tabiiy audio (Connected Speech) generatsiya qilmoqda...');
  try {
    const res = await apiCall('/api/dictations/generate', 'POST', {
      topic: 'Science & Sustainable Architecture',
      level: 'B2/C1'
    });
    loadDictationData(res);
    showToast('Yangi diktant audiosi tayyor!', 'success');
  } catch (e) {
    console.error(e);
  }
}

function loadDictationData(data) {
  currentDictation = data;
  document.getElementById('dictationTitle').innerText = data.title || 'IELTS Dictation';
  document.getElementById('dictationAccuracyBadge').innerText = `${data.accuracy_rate || 0}% To'g'ri`;
  document.getElementById('dictationInputText').value = '';
  document.getElementById('dictationLiveDiffBox').innerHTML = `<span style="color: var(--text-subtle);">Audioni tinglab, eshitganingizni yozing. Xatolar qizil bilan belgilanadi...</span>`;

  if (data.audio_url) {
    dictationAudioEl.src = data.audio_url;
  }

  // Connected Speech Notes
  const notesBox = document.getElementById('connectedSpeechBox');
  const notesList = document.getElementById('connectedSpeechNotesList');
  let notes = data.connected_speech_notes;
  if (typeof notes === 'string') {
    try { notes = JSON.parse(notes); } catch (e) { notes = []; }
  }

  if (notes && notes.length > 0) {
    notesBox.style.display = 'block';
    notesList.innerHTML = notes.map(n => `
      <div style="background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 6px;">
        <strong style="color: #38bdf8;">"${n.phrase}":</strong> <span>${n.phonetic_explanation}</span>
      </div>
    `).join('');
  } else {
    notesBox.style.display = 'none';
  }
}

function toggleDictationAudio() {
  if (!dictationAudioEl || !dictationAudioEl.src) return;
  const btn = document.getElementById('dictationPlayBtn');

  if (dictationAudioEl.paused) {
    dictationAudioEl.play();
    btn.innerText = '⏸';
  } else {
    dictationAudioEl.pause();
    btn.innerText = '▶';
  }
}

function seekDictationAudio(val) {
  if (dictationAudioEl && dictationAudioEl.duration) {
    dictationAudioEl.currentTime = (val / 100) * dictationAudioEl.duration;
  }
}

function changeDictationSpeed(speed) {
  if (dictationAudioEl) {
    dictationAudioEl.playbackRate = parseFloat(speed);
  }
}

// Speechling-Style Real-Time Diff Checker
function handleDictationInput() {
  if (!currentDictation || !currentDictation.transcript) return;

  const originalWords = currentDictation.transcript.trim().split(/\s+/);
  const userText = document.getElementById('dictationInputText').value.trim();
  const userWords = userText ? userText.split(/\s+/) : [];

  const diffBox = document.getElementById('dictationLiveDiffBox');
  if (userWords.length === 0) {
    diffBox.innerHTML = `<span style="color: var(--text-subtle);">Audioni tinglab, eshitganingizni yozing. Xatolar qizil bilan belgilanadi...</span>`;
    return;
  }

  let html = '';
  let correctCount = 0;

  for (let i = 0; i < userWords.length; i++) {
    const userWord = userWords[i];
    const origWord = originalWords[i] || '';

    // Clean word for comparison (remove punctuation, lower case)
    const cleanUser = userWord.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").toLowerCase();
    const cleanOrig = origWord.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").toLowerCase();

    if (cleanUser === cleanOrig) {
      correctCount++;
      html += `<span class="diff-word-correct">${userWord}</span> `;
    } else {
      html += `<span class="diff-word-error" title="To'g'ri so'z bo'lishi kerak: ${origWord}">${userWord}</span> `;
    }
  }

  // Show placeholders for missing remaining words
  if (originalWords.length > userWords.length) {
    const remaining = originalWords.length - userWords.length;
    html += `<span class="diff-word-missing">... (${remaining} ta so'z qoldi)</span>`;
  }

  diffBox.innerHTML = html;

  // Calculate live accuracy rate
  const accuracy = Math.round((correctCount / originalWords.length) * 100);
  const badge = document.getElementById('dictationAccuracyBadge');
  badge.innerText = `${accuracy}% To'g'ri`;

  if (accuracy >= 95) {
    badge.style.background = 'var(--success)';
    if (accuracy === 100) {
      showToast('Ajoyib! Diktant 100% to\'g\'ri bajarildi! 🎉', 'success');
      if (currentDictation.id) {
        apiCall(`/api/dictations/${currentDictation.id}/submit-result`, 'POST', { accuracy_rate: 100.0 });
      }
    }
  } else {
    badge.style.background = '#06b6d4';
  }
}
