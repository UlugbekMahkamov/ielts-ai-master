/**
 * Podcast Module: Manual Transcript & Link Input, Audio Player & Complete IELTS Tasks
 * (20 Listening Questions across 4 types, 4-Level Speaking & Writing with AI Evaluation)
 */

let allPodcasts = [];
let currentPodcastTasks = null;
let podSpeakingRecognition = null;
let isPodSpeakingRecording = false;

async function loadPodcastsList() {
  try {
    allPodcasts = await apiCall('/api/podcasts');
    renderPodcastsList(allPodcasts);
  } catch (e) {
    console.error(e);
  }
}

function renderPodcastsList(podcasts) {
  const container = document.getElementById('podcastsListContainer');
  if (!podcasts || podcasts.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 30px;">
        <p style="color: var(--text-muted); margin-bottom: 12px;">Hozircha podkastlar yo'q.</p>
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button class="btn btn-primary" onclick="openSinglePodcastModal()">➕ Podkast & Transkript Qo'shish</button>
          <button class="btn btn-secondary" onclick="openBulkPodcastModal()">📑 Bulk (~200)</button>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = podcasts.map(p => `
    <div class="card" onclick="openPodcastDetail(${p.id})" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <strong style="font-size: 15px;">${p.title}</strong>
          ${p.has_transcript ? '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--success); font-size: 10px; padding: 2px 6px; border-radius: 4px;">Transkript Tayyor</span>' : '<span class="badge" style="background: var(--bg-card-alt); font-size: 10px; padding: 2px 6px; border-radius: 4px;">Transkript Kiritilmagan</span>'}
        </div>
        <div style="font-size: 12px; color: var(--text-muted); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span>${p.url || 'Podcast Audio'}</span> &bull; <span>${p.created_at}</span>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="btn btn-sm btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="event.stopPropagation(); deletePodcast(${p.id}, '${p.title.replace(/'/g, "\\'")}')" title="O'chirish">
          🗑️
        </button>
        <div style="color: var(--accent); font-size: 18px;">&rarr;</div>
      </div>
    </div>
  `).join('');
}

async function deletePodcast(podcastId, title) {
  if (!confirm(`"${title || 'Ushbu podkast'}"ni haqiqatdan ham o'chirmoqchimisiz?`)) return;
  try {
    await apiCall(`/api/podcasts/${podcastId}`, 'DELETE');
    showToast('Podkast muvaffaqiyatli o\'chirildi! 🗑️', 'success');
    loadPodcastsList();
  } catch (e) {
    console.error(e);
  }
}

async function deleteCurrentPodcast() {
  if (!AppState.activePodcast) return;
  if (!confirm(`"${AppState.activePodcast.title}"ni o'chirmoqchimisiz?`)) return;
  try {
    await apiCall(`/api/podcasts/${AppState.activePodcast.id}`, 'DELETE');
    showToast('Podkast o\'chirildi! 🗑️', 'success');
    backToPodcastList();
  } catch (e) {
    console.error(e);
  }
}

function openSinglePodcastModal() {
  openModal('singlePodcastModal');
}

async function submitSinglePodcast() {
  const url = document.getElementById('singlePodcastUrl').value.trim();
  const title = document.getElementById('singlePodcastTitle').value.trim();
  const transcript = document.getElementById('singlePodcastTranscript').value.trim();

  if (!transcript && !url) {
    showToast('Kamida transkript matni yoki podkast linkini kiriting!', 'error');
    return;
  }

  try {
    const res = await apiCall('/api/podcasts/bulk', 'POST', {
      podcasts: [{
        url: url || 'Podcast Audio',
        title: title || '',
        transcript: transcript
      }]
    });
    closeModal('singlePodcastModal');
    showToast('Podkast va transkript muvaffaqiyatli saqlandi! 🎉', 'success');
    document.getElementById('singlePodcastUrl').value = '';
    document.getElementById('singlePodcastTitle').value = '';
    document.getElementById('singlePodcastTranscript').value = '';
    loadPodcastsList();
  } catch (e) {
    console.error(e);
  }
}

function openBulkPodcastModal() {
  openModal('bulkPodcastModal');
}

async function submitBulkPodcasts() {
  const rawText = document.getElementById('bulkPodcastLinks').value;
  if (!rawText.trim()) {
    showToast('Kamida 1 ta podkast transkriptini kiriting!', 'error');
    return;
  }

  const chunks = rawText.split(/\n\s*---\s*\n/).filter(c => c.trim().length > 5);
  let podcastsData = [];

  if (chunks.length > 1) {
    podcastsData = chunks.map((chunk, idx) => {
      const lines = chunk.trim().split('\n');
      let url = '';
      let text = chunk.trim();
      if (lines[0].startsWith('http://') || lines[0].startsWith('https://')) {
        url = lines[0].trim();
        text = lines.slice(1).join('\n').trim();
      }
      return { url: url || `Podcast Link ${idx + 1}`, transcript: text };
    });
  } else {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    podcastsData = lines.map(line => {
      if (line.startsWith('http://') || line.startsWith('https://')) {
        return { url: line, transcript: '' };
      } else {
        return { url: '', transcript: line };
      }
    });
  }

  showToast(`${podcastsData.length} ta podkast bazaga saqlanmoqda...`);
  try {
    const res = await apiCall('/api/podcasts/bulk', 'POST', { podcasts: podcastsData });
    closeModal('bulkPodcastModal');
    showToast(`${res.inserted_count} ta podkast muvaffaqiyatli saqlandi!`, 'success');
    document.getElementById('bulkPodcastLinks').value = '';
    loadPodcastsList();
  } catch (e) {
    console.error(e);
  }
}

async function openPodcastDetail(podcastId) {
  try {
    const podcast = await apiCall(`/api/podcasts/${podcastId}`);
    AppState.activePodcast = podcast;

    document.getElementById('podcastListView').style.display = 'none';
    document.getElementById('podcastDetailView').style.display = 'block';

    document.getElementById('activePodcastTitle').innerText = podcast.title;
    
    // Audio Player or Link
    const audioContainer = document.getElementById('podcastAudioPlayer');
    const audioSrc = podcast.audio_url || (podcast.url && (podcast.url.endsWith('.mp3') || podcast.url.endsWith('.m4a')) ? podcast.url : '');

    audioContainer.innerHTML = `
      <div style="background: #111827; padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 8px;">
        ${podcast.url && podcast.url.startsWith('http') ? `<div style="margin-bottom: 6px;"><strong>Audio / Web Manba:</strong> <a href="${podcast.url}" target="_blank" style="color: var(--accent);">${podcast.url}</a></div>` : ''}
        ${audioSrc ? `
          <audio controls style="width: 100%; margin-top: 6px;">
            <source src="${audioSrc}" type="audio/mpeg">
            Brauzeringiz audio pleerni qo'llab-quvvatlamaydi.
          </audio>
        ` : ''}
      </div>
    `;

    // Transcript
    const transcriptBox = document.getElementById('activePodcastTranscript');
    if (podcast.transcript && podcast.transcript.trim().length > 0) {
      transcriptBox.innerText = podcast.transcript;
    } else {
      transcriptBox.innerHTML = `
        <div style="text-align: center; padding: 16px;">
          <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 8px;">Transkript kiritilmagan.</p>
          <button class="btn btn-sm btn-primary" onclick="openEditPodcastTranscriptModal()">
            ➕ Transkriptni Qo'lda Nusxalab Kiritish
          </button>
        </div>
      `;
    }

    // Tasks (Listening, Speaking, Writing)
    if (podcast.listening_data && podcast.speaking_data && podcast.writing_data) {
      currentPodcastTasks = {
        listening: podcast.listening_data,
        speaking: podcast.speaking_data,
        writing: podcast.writing_data
      };
      renderPodListeningTasks();
      renderPodSpeakingQuestionsForLevel();
      renderPodWritingPromptForLevel();
    } else {
      currentPodcastTasks = null;
      document.getElementById('podListeningTasksContainer').innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">Transkript bo'yicha topshiriqlar hali shakllantirilmagan.</p>
          <button class="btn btn-primary btn-block" onclick="generatePodcastAITasks()">
            ✨ Transkript Bo'yicha 20 ta IELTS Listening, Speaking & Writing Topshiriqlarini Yaratish
          </button>
        </div>
      `;
    }

    switchPodcastTab('listening');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    console.error(e);
  }
}

function backToPodcastList() {
  document.getElementById('podcastDetailView').style.display = 'none';
  document.getElementById('podcastListView').style.display = 'block';
  loadPodcastsList();
}

function switchPodcastTab(tabName) {
  document.getElementById('tabContentPodListening').style.display = tabName === 'listening' ? 'block' : 'none';
  document.getElementById('tabContentPodSpeaking').style.display = tabName === 'speaking' ? 'block' : 'none';
  document.getElementById('tabContentPodWriting').style.display = tabName === 'writing' ? 'block' : 'none';

  document.getElementById('tabBtnPodListening').className = tabName === 'listening' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
  document.getElementById('tabBtnPodSpeaking').className = tabName === 'speaking' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
  document.getElementById('tabBtnPodWriting').className = tabName === 'writing' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
}

function openEditPodcastTranscriptModal() {
  if (!AppState.activePodcast) return;
  document.getElementById('editPodcastAudioUrl').value = AppState.activePodcast.audio_url || AppState.activePodcast.url || '';
  document.getElementById('editPodcastTranscriptText').value = AppState.activePodcast.transcript || '';
  openModal('editPodcastTranscriptModal');
}

async function saveEditedPodcastTranscript() {
  if (!AppState.activePodcast) return;
  const transcript = document.getElementById('editPodcastTranscriptText').value.trim();
  const audio_url = document.getElementById('editPodcastAudioUrl').value.trim();

  if (!transcript) {
    showToast('Transkript matnini kiriting!', 'error');
    return;
  }

  try {
    await apiCall(`/api/podcasts/${AppState.activePodcast.id}/update-transcript`, 'POST', {
      transcript, audio_url
    });
    closeModal('editPodcastTranscriptModal');
    showToast('Transkript muvaffaqiyatli saqlandi! 🎉', 'success');
    openPodcastDetail(AppState.activePodcast.id);
  } catch (e) {
    console.error(e);
  }
}

async function generatePodcastAITasks() {
  if (!AppState.activePodcast) return;
  if (!AppState.activePodcast.transcript || AppState.activePodcast.transcript.trim().length === 0) {
    showToast('Avval transkript matnini kiriting!', 'error');
    openEditPodcastTranscriptModal();
    return;
  }

  showToast('Siz kiritgan transkript bo\'yicha 20 ta IELTS topshiriqlari yaratilmoqda...');
  try {
    const tasks = await apiCall(`/api/podcasts/${AppState.activePodcast.id}/generate-tasks`, 'POST');
    currentPodcastTasks = tasks;
    renderPodListeningTasks();
    renderPodSpeakingQuestionsForLevel();
    renderPodWritingPromptForLevel();
    showToast('20 ta IELTS Listening, Speaking & Writing topshiriqlari tayyor! 🎉', 'success');
  } catch (e) {
    console.error(e);
  }
}

// 1. Podcast Listening Section (All 20 Questions)
function renderPodListeningTasks() {
  const container = document.getElementById('podListeningTasksContainer');
  if (!currentPodcastTasks || !currentPodcastTasks.listening) return;

  const lis = currentPodcastTasks.listening;
  const tfList = lis.true_false_not_given || (lis.questions ? lis.questions.filter(q => q.type === 'true_false_not_given') : []);
  const mcList = lis.multiple_choice || (lis.questions ? lis.questions.filter(q => q.type === 'multiple_choice') : []);
  const scList = lis.summary_completion || (lis.questions ? lis.questions.filter(q => q.type === 'summary_completion') : []);
  const miList = lis.matching_information || [];

  const totalCount = tfList.length + mcList.length + scList.length + miList.length;

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: white;">${lis.title || 'IELTS Listening & Comprehension Test'}</h3>
        <p style="font-size: 12px; color: var(--text-muted);">Jami savollar: <strong style="color: var(--accent);">${totalCount} ta</strong></p>
      </div>
      <button class="btn btn-sm btn-secondary" onclick="generatePodcastAITasks()" title="Savollarni yangilash">
        🔄 20 ta Savol Generatsiya Qilish
      </button>
    </div>
    
    ${totalCount < 10 ? `
      <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 12px;">
        <span style="color: #f59e0b; font-weight: 700;">⚠️ Diqqat:</span> Ushbu podkastda avval eski versiyadagi 3 ta savol saqlanib qolgan. 
        <button class="btn btn-sm btn-primary" style="margin-top: 6px; display: block;" onclick="generatePodcastAITasks()">
          ⚡ To'liq 20 ta IELTS Savolini Hozir Yaratish
        </button>
      </div>
    ` : ''}

    <form id="podQuizForm" onsubmit="event.preventDefault(); gradePodQuiz();">
      
      <!-- 1. TFNG (5 Questions) -->
      ${tfList.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--accent); margin-bottom: 8px; text-transform: uppercase;">
            1-Qism: True / False / Not Given (${tfList.length} ta savol)
          </div>
          ${tfList.map((q, idx) => `
            <div class="card" style="background: #151e30; border-color: var(--border-color); margin-bottom: 10px; padding: 12px;">
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">1.${idx + 1} ${q.question}</div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                ${["TRUE", "FALSE", "NOT GIVEN"].map(opt => `
                  <label style="font-size: 12px; cursor: pointer; color: var(--text-main); display: flex; align-items: center; gap: 4px;">
                    <input type="radio" name="pod_q_${q.id || 'tf_' + idx}" value="${opt}"> ${opt}
                  </label>
                `).join('')}
              </div>
              <div id="pod_feedback_${q.id || 'tf_' + idx}" style="margin-top: 8px; font-size: 12px; display: none;"></div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- 2. MCQ (5 Questions) -->
      ${mcList.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: #38bdf8; margin-bottom: 8px; text-transform: uppercase;">
            2-Qism: Multiple Choice (${mcList.length} ta savol)
          </div>
          ${mcList.map((q, idx) => `
            <div class="card" style="background: #151e30; border-color: var(--border-color); margin-bottom: 10px; padding: 12px;">
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">2.${idx + 1} ${q.question}</div>
              ${(q.options || []).map(opt => `
                <label style="display: block; font-size: 12px; margin-bottom: 4px; cursor: pointer; color: var(--text-muted);">
                  <input type="radio" name="pod_q_${q.id || 'mc_' + idx}" value="${opt}" style="margin-right: 6px;"> ${opt}
                </label>
              `).join('')}
              <div id="pod_feedback_${q.id || 'mc_' + idx}" style="margin-top: 8px; font-size: 12px; display: none;"></div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- 3. Summary (5 Questions) -->
      ${scList.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: #34d399; margin-bottom: 8px; text-transform: uppercase;">
            3-Qism: Summary / Sentence Completion (${scList.length} ta savol)
          </div>
          ${scList.map((q, idx) => `
            <div class="card" style="background: #151e30; border-color: var(--border-color); margin-bottom: 10px; padding: 12px;">
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">3.${idx + 1} ${q.question}</div>
              <input type="text" name="pod_q_${q.id || 'sc_' + idx}" class="form-input" placeholder="Javob so'zni yozing..." style="font-size: 13px;">
              <div id="pod_feedback_${q.id || 'sc_' + idx}" style="margin-top: 8px; font-size: 12px; display: none;"></div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- 4. Matching (5 Questions) -->
      ${miList.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: #f59e0b; margin-bottom: 8px; text-transform: uppercase;">
            4-Qism: Matching Information (${miList.length} ta savol)
          </div>
          ${miList.map((q, idx) => `
            <div class="card" style="background: #151e30; border-color: var(--border-color); margin-bottom: 10px; padding: 12px;">
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">4.${idx + 1} ${q.question}</div>
              ${(q.options || []).map(opt => `
                <label style="display: block; font-size: 12px; margin-bottom: 4px; cursor: pointer; color: var(--text-muted);">
                  <input type="radio" name="pod_q_${q.id || 'mi_' + idx}" value="${opt}" style="margin-right: 6px;"> ${opt}
                </label>
              `).join('')}
              <div id="pod_feedback_${q.id || 'mi_' + idx}" style="margin-top: 8px; font-size: 12px; display: none;"></div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <button type="submit" class="btn btn-primary btn-block" style="margin-top: 14px;">
        ✅ Barcha Savollarni Tekshirish & Natijani Ko'rish
      </button>
    </form>
  `;
}

function gradePodQuiz() {
  if (!currentPodcastTasks || !currentPodcastTasks.listening) return;
  const lis = currentPodcastTasks.listening;
  const allGroups = [
    ...(lis.true_false_not_given || (lis.questions ? lis.questions.filter(q => q.type === 'true_false_not_given') : [])),
    ...(lis.multiple_choice || (lis.questions ? lis.questions.filter(q => q.type === 'multiple_choice') : [])),
    ...(lis.summary_completion || (lis.questions ? lis.questions.filter(q => q.type === 'summary_completion') : [])),
    ...(lis.matching_information || [])
  ];

  let score = 0;
  allGroups.forEach((q, idx) => {
    const qId = q.id || `q_${idx}`;
    const feedbackBox = document.getElementById(`pod_feedback_${qId}`);
    if (!feedbackBox) return;

    let userAnswer = '';
    const selectedRadio = document.querySelector(`input[name="pod_q_${qId}"]:checked`);
    if (selectedRadio) {
      userAnswer = selectedRadio.value;
    } else {
      const textInput = document.querySelector(`input[name="pod_q_${qId}"]`);
      if (textInput) userAnswer = textInput.value.trim();
    }

    const cleanUser = userAnswer.toLowerCase().trim();
    const cleanCorrect = (q.correct_answer || '').toLowerCase().trim();
    const isCorrect = cleanUser === cleanCorrect || (cleanCorrect.includes(cleanUser) && cleanUser.length > 2);

    if (isCorrect) score++;

    feedbackBox.style.display = 'block';
    feedbackBox.innerHTML = `
      <div style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}; font-weight: 700;">
        ${isCorrect ? '✅ To\'g\'ri!' : `❌ Noto\'g\'ri. To\'g\'ri javob: ${q.correct_answer}`}
      </div>
      <div style="color: var(--text-muted); font-size: 11px; margin-top: 2px;">💡 ${q.explanation || ''}</div>
    `;
  });

  const total = allGroups.length || 20;
  const percentage = Math.round((score / total) * 100);
  
  let estBand = 5.0;
  if (score >= 18) estBand = 8.5;
  else if (score >= 15) estBand = 7.5;
  else if (score >= 12) estBand = 6.5;
  else if (score >= 9) estBand = 6.0;

  showToast(`IELTS Podkast Natijasi: ${score}/${total} (${percentage}%) — Band ~${estBand}`, 'success');
}

// 2. Podcast Speaking Section
function renderPodSpeakingQuestionsForLevel() {
  if (!currentPodcastTasks || !currentPodcastTasks.speaking) return;
  const level = document.getElementById('podSpeakingLevelSelect').value;
  const levelData = currentPodcastTasks.speaking.levels ? currentPodcastTasks.speaking.levels[level] : null;

  const scaffoldingBox = document.getElementById('podSpeakingScaffoldingBox');
  const scaffoldingContent = document.getElementById('podScaffoldingContent');

  if (levelData && levelData.scaffolding && (level === 'A2' || level === 'B1' || level === 'B2')) {
    scaffoldingBox.style.display = 'block';
    const vocab = (levelData.scaffolding.useful_vocabulary || []).map(v => `<span class="badge" style="background: rgba(6, 182, 212, 0.2); color: var(--accent); padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px;">${v}</span>`).join(' ');
    const starters = (levelData.scaffolding.sentence_starters || []).map(s => `<em>"${s}"</em>`).join(', ');
    scaffoldingContent.innerHTML = `
      <div style="margin-bottom: 4px;"><strong>Lug'at:</strong> ${vocab}</div>
      <div><strong>Boshlang'ich iboralar:</strong> ${starters}</div>
    `;
  } else {
    scaffoldingBox.style.display = 'none';
  }

  const questions = levelData ? levelData.questions || [] : [];
  const container = document.getElementById('podSpeakingQuestionsContainer');

  container.innerHTML = questions.map((q, idx) => `
    <div class="card" style="background: #141c2e; border-color: var(--border-color); margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 11px; color: var(--accent); font-weight: 700;">SAVOL ${idx + 1} / ${questions.length}</span>
        <button class="btn btn-sm btn-secondary" onclick="speakText('${q.replace(/'/g, "\\'")}')">🔊 Tinglash</button>
      </div>
      <p style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: var(--text-main);">${q}</p>

      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <button class="btn btn-sm btn-primary" id="podRecBtn_${idx}" onclick="togglePodSpeakingRecord(${idx}, '${q.replace(/'/g, "\\'")}')">
          🎤 Mikrofonni Bosib Gapiring
        </button>
      </div>

      <div class="form-group">
        <textarea id="podSpeakingTranscript_${idx}" class="form-textarea" style="min-height: 70px; font-size: 13px;" placeholder="Sizning aytgan so'zlaringiz bu yerda ko'rinadi..."></textarea>
      </div>

      <button class="btn btn-sm btn-accent btn-block" onclick="submitPodSpeakingEvaluation(${idx}, '${q.replace(/'/g, "\\'")}')">
        ✨ AI Baholash (4 IELTS Mezon)
      </button>

      <div id="podSpeakingEvaluationResult_${idx}" style="margin-top: 10px; display: none;"></div>
    </div>
  `).join('');
}

function togglePodSpeakingRecord(index, questionText) {
  const btn = document.getElementById(`podRecBtn_${index}`);
  const textarea = document.getElementById(`podSpeakingTranscript_${index}`);

  if (isPodSpeakingRecording) {
    if (podSpeakingRecognition) {
      try { podSpeakingRecognition.stop(); } catch(e) {}
    }
    isPodSpeakingRecording = false;
    btn.innerHTML = '🎤 Mikrofonni Bosib Gapiring';
    btn.className = 'btn btn-sm btn-primary';
    showToast('Ovoz yozish to\'xtatildi');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Brauzeringizda ovozni tanish yoqilmagan. Matnni qo\'lda yozishingiz mumkin.', 'error');
    return;
  }

  if (podSpeakingRecognition) {
    try { podSpeakingRecognition.abort(); } catch(e) {}
  }

  podSpeakingRecognition = new SpeechRecognition();
  podSpeakingRecognition.lang = 'en-US';
  podSpeakingRecognition.continuous = true;
  podSpeakingRecognition.interimResults = false;

  podSpeakingRecognition.onstart = () => {
    isPodSpeakingRecording = true;
    btn.innerHTML = '⏹️ To\'xtatish (Gapiryapsiz...)';
    btn.className = 'btn btn-sm btn-danger';
    showToast('Tinglanmoqda, inglizcha gapiring...');
  };

  podSpeakingRecognition.onresult = (event) => {
    let finalStr = '';
    for (let i = 0; i < event.results.length; ++i) {
      if (event.results[i][0]) {
        finalStr += event.results[i][0].transcript.trim() + ' ';
      }
    }
    textarea.value = finalStr.trim();
  };

  podSpeakingRecognition.onerror = (e) => {
    console.error('Speech error:', e);
    if (e.error !== 'no-speech') {
      isPodSpeakingRecording = false;
      btn.innerHTML = '🎤 Mikrofonni Bosib Gapiring';
      btn.className = 'btn btn-sm btn-primary';
    }
  };

  podSpeakingRecognition.onend = () => {
    isPodSpeakingRecording = false;
    btn.innerHTML = '🎤 Mikrofonni Bosib Gapiring';
    btn.className = 'btn btn-sm btn-primary';
  };

  try {
    podSpeakingRecognition.start();
  } catch (err) {
    console.error(err);
  }
}

async function submitPodSpeakingEvaluation(index, questionText) {
  const transcript = document.getElementById(`podSpeakingTranscript_${index}`).value.trim();
  const level = document.getElementById('podSpeakingLevelSelect').value;
  const resultContainer = document.getElementById(`podSpeakingEvaluationResult_${index}`);

  if (!transcript) {
    showToast('Avval gapiring yoki matn yozing!', 'error');
    return;
  }

  showToast('AI Speaking javobingizni 4 mezon bo\'yicha baholamoqda...');
  try {
    const res = await apiCall(`/api/podcasts/${AppState.activePodcast.id}/evaluate-speaking`, 'POST', {
      question: questionText,
      transcript: transcript,
      level: level
    });

    const c = res.criteria || {};
    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div style="background: #101626; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: var(--accent); font-size: 14px;">IELTS Speaking Natijasi</strong>
          <span class="score-band-pill">Band ${res.overall_band}</span>
        </div>

        <div class="ielts-score-grid">
          <div class="score-criterion-card">
            <div class="score-criterion-header">
              <span class="score-criterion-name">Fluency & Coherence</span>
              <span class="score-band-pill">${c.fluency_coherence ? c.fluency_coherence.band : res.overall_band}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${c.fluency_coherence ? c.fluency_coherence.feedback : ''}</div>
          </div>
          <div class="score-criterion-card">
            <div class="score-criterion-header">
              <span class="score-criterion-name">Lexical Resource</span>
              <span class="score-band-pill">${c.lexical_resource ? c.lexical_resource.band : res.overall_band}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${c.lexical_resource ? c.lexical_resource.feedback : ''}</div>
          </div>
          <div class="score-criterion-card">
            <div class="score-criterion-header">
              <span class="score-criterion-name">Grammar & Accuracy</span>
              <span class="score-band-pill">${c.grammatical_range ? c.grammatical_range.band : res.overall_band}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${c.grammatical_range ? c.grammatical_range.feedback : ''}</div>
          </div>
          <div class="score-criterion-card">
            <div class="score-criterion-header">
              <span class="score-criterion-name">Pronunciation</span>
              <span class="score-band-pill">${c.pronunciation_naturalness ? c.pronunciation_naturalness.band : res.overall_band}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${c.pronunciation_naturalness ? c.pronunciation_naturalness.feedback : ''}</div>
          </div>
        </div>

        ${res.improved_model_answer ? `
          <div style="background: rgba(79, 70, 229, 0.15); border: 1px solid rgba(79, 70, 229, 0.3); border-radius: 6px; padding: 8px; margin-top: 8px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--primary-light);">🌟 Band 8.5+ Namunaviy Javob:</div>
            <div style="font-size: 12px; color: var(--text-main); margin-top: 4px;">${res.improved_model_answer}</div>
          </div>
        ` : ''}
      </div>
    `;

    showToast('Speaking baholandi! Xatolar va C1 so\'zlar saqlandi.', 'success');
  } catch (e) {
    console.error(e);
  }
}

// 3. Podcast Writing Section
function renderPodWritingPromptForLevel() {
  if (!currentPodcastTasks || !currentPodcastTasks.writing) return;
  const level = document.getElementById('podWritingLevelSelect').value;
  const levelData = currentPodcastTasks.writing.levels ? currentPodcastTasks.writing.levels[level] : null;

  if (levelData) {
    document.getElementById('podWritingPromptText').innerText = levelData.prompt || 'IELTS Task Prompt';
  }
}

function updatePodEssayWordCount() {
  const text = document.getElementById('podEssayInput').value.trim();
  const count = text ? text.split(/\s+/).length : 0;
  document.getElementById('podEssayWordCount').innerText = `${count} so'z`;
}

async function submitPodWriting() {
  const essayText = document.getElementById('podEssayInput').value.trim();
  const promptText = document.getElementById('podWritingPromptText').innerText;
  const level = document.getElementById('podWritingLevelSelect').value;
  const resultContainer = document.getElementById('podWritingEvaluationResult');

  if (!essayText) {
    showToast('Essengizni yozing!', 'error');
    return;
  }

  showToast('AI IELTS Writing tahlilini amalga oshirmoqda...');
  try {
    const res = await apiCall(`/api/podcasts/${AppState.activePodcast.id}/evaluate-writing`, 'POST', {
      prompt_text: promptText,
      essay_text: essayText,
      level: level
    });

    const c = res.criteria || {};
    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div style="background: #101626; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: var(--accent); font-size: 14px;">IELTS Writing Natijasi (${res.word_count} so'z)</strong>
          <span class="score-band-pill">Band ${res.overall_band}</span>
        </div>

        <div class="ielts-score-grid">
          <div class="score-criterion-card">
            <div class="score-criterion-header">
              <span class="score-criterion-name">Task Response</span>
              <span class="score-band-pill">${c.task_response ? c.task_response.band : res.overall_band}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${c.task_response ? c.task_response.feedback : ''}</div>
          </div>
          <div class="score-criterion-card">
            <div class="score-criterion-header">
              <span class="score-criterion-name">Coherence & Cohesion</span>
              <span class="score-band-pill">${c.coherence_cohesion ? c.coherence_cohesion.band : res.overall_band}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${c.coherence_cohesion ? c.coherence_cohesion.feedback : ''}</div>
          </div>
          <div class="score-criterion-card">
            <div class="score-criterion-header">
              <span class="score-criterion-name">Lexical Resource</span>
              <span class="score-band-pill">${c.lexical_resource ? c.lexical_resource.band : res.overall_band}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${c.lexical_resource ? c.lexical_resource.feedback : ''}</div>
          </div>
          <div class="score-criterion-card">
            <div class="score-criterion-header">
              <span class="score-criterion-name">Grammar & Accuracy</span>
              <span class="score-band-pill">${c.grammatical_range ? c.grammatical_range.band : res.overall_band}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${c.grammatical_range ? c.grammatical_range.feedback : ''}</div>
          </div>
        </div>

        ${res.paragraph_by_paragraph_improvements ? `
          <div style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 6px; padding: 8px; margin-top: 8px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--accent);">✨ C1 Akademik Yaxshilangan Variant:</div>
            <div style="font-size: 12px; color: var(--text-main); margin-top: 4px;">${res.paragraph_by_paragraph_improvements[0].enhanced_version}</div>
          </div>
        ` : ''}
      </div>
    `;

    showToast('Writing baholandi! Xatolar va C1 so\'zlar saqlandi.', 'success');
  } catch (e) {
    console.error(e);
  }
}
