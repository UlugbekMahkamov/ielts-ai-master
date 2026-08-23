/**
 * Article Module: Bulk 200 Articles, Comprehensive IELTS Listening (20 Tasks), Speaking & Writing
 */

let allArticles = [];
let currentArticleTasks = null;
let speakingRecognition = null;
let isSpeakingRecording = false;

const DEFAULT_ARTICLES = [
  {
    id: 1,
    title: "Sustainable Urban Development",
    level: "B2",
    word_count: 320,
    created_at: "2026-08-23",
    content: "Sustainable urban development involves creating cities that meet the needs of present residents without compromising the ability of future generations to meet their own needs. It encompasses renewable energy integration, comprehensive mass transit infrastructure, and resilient environmental policies."
  },
  {
    id: 2,
    title: "The Psychological Impacts of AI in Modern Education",
    level: "C1",
    word_count: 450,
    created_at: "2026-08-23",
    content: "The proliferation of artificial intelligence in higher education has revolutionized personalized learning paradigms. While automated feedback loops enhance metacognitive awareness, over-reliance on algorithmic synthesis poses critical challenges to independent critical reasoning."
  },
  {
    id: 3,
    title: "Ocean Acidification and Marine Ecosystems",
    level: "C1",
    word_count: 380,
    created_at: "2026-08-23",
    content: "Ocean acidification, driven predominantly by anthropogenic carbon dioxide emissions, alters marine chemistry with catastrophic ramifications for calcifying organisms. Coral reef bleaching and trophic cascades threaten global maritime biodiversity."
  },
  {
    id: 4,
    title: "Remote Work Trends and the Global Economy",
    level: "B2",
    word_count: 310,
    created_at: "2026-08-23",
    content: "The transition toward decentralized work models has fundamentally altered urban geography and labor mobility. Digital nomadism allows professionals to bridge socioeconomic divides while challenging traditional commercial real estate paradigms."
  },
  {
    id: 5,
    title: "The Architectural Evolution of Megacities",
    level: "C1",
    word_count: 420,
    created_at: "2026-08-23",
    content: "Modern megacities represent the zenith of architectural innovation. Vertical urbanism, biophilic facades, and subterranean logistics networks optimize spatial constraints in ultra-dense demographic hubs."
  },
  {
    id: 6,
    title: "Cognitive Advantages of Multilingualism",
    level: "B2",
    word_count: 340,
    created_at: "2026-08-23",
    content: "Acquiring multiple languages enhances executive function, cognitive flexibility, and divergent problem-solving capacities. Neuroscientific evidence demonstrates that bilingual individuals exhibit delayed onset of age-related cognitive decline."
  }
];

async function loadArticlesList() {
  try {
    try {
      allArticles = await apiCall('/api/articles');
      if (!allArticles || allArticles.length === 0) {
        allArticles = DEFAULT_ARTICLES;
      }
    } catch (e) {
      allArticles = JSON.parse(localStorage.getItem('cached_articles') || 'null') || DEFAULT_ARTICLES;
    }
    localStorage.setItem('cached_articles', JSON.stringify(allArticles));
    renderArticlesList(allArticles);
  } catch (e) {
    console.error(e);
    renderArticlesList(DEFAULT_ARTICLES);
  }
}

function renderArticlesList(articles) {
  const container = document.getElementById('articlesListContainer');
  if (!articles || articles.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 30px;">
        <p style="color: var(--text-muted); margin-bottom: 12px;">Hozircha artikllar yo'q.</p>
        <button class="btn btn-primary" onclick="openBulkArticleModal()">📑 Bulk (~200) Artikl Qo'shish</button>
      </div>
    `;
    return;
  }

  container.innerHTML = articles.map(a => `
    <div class="card" onclick="openArticleDetail(${a.id})" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <strong style="font-size: 15px;">${a.title}</strong>
          <span class="badge" style="background: var(--bg-card-alt); font-size: 10px; padding: 2px 6px; border-radius: 4px;">${a.level || 'B2'}</span>
          ${a.status === 'completed' ? '<span style="color: var(--success); font-size: 12px;">✅ Bajarilgan</span>' : ''}
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">
          <span>${a.word_count || 0} so'z</span> &bull; <span>${a.created_at}</span>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="btn btn-sm btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="event.stopPropagation(); deleteArticle(${a.id}, '${a.title.replace(/'/g, "\\'")}')" title="O'chirish">
          🗑️
        </button>
        <div style="color: var(--accent); font-size: 18px;">&rarr;</div>
      </div>
    </div>
  `).join('');
}

async function deleteArticle(articleId, title) {
  if (!confirm(`"${title || 'Ushbu artikl'}"ni haqiqatdan ham o'chirmoqchimisiz?`)) return;
  try {
    await apiCall(`/api/articles/${articleId}`, 'DELETE');
    showToast('Artikl muvaffaqiyatli o\'chirildi! 🗑️', 'success');
    loadArticlesList();
  } catch (e) {
    console.error(e);
  }
}

async function deleteCurrentArticle() {
  if (!AppState.activeArticle) return;
  if (!confirm(`"${AppState.activeArticle.title}"ni o'chirmoqchimisiz?`)) return;
  try {
    await apiCall(`/api/articles/${AppState.activeArticle.id}`, 'DELETE');
    showToast('Artikl o\'chirildi! 🗑️', 'success');
    backToArticleList();
  } catch (e) {
    console.error(e);
  }
}

function filterArticles() {
  const q = document.getElementById('articleSearchInput').value.toLowerCase();
  const filtered = allArticles.filter(a => a.title.toLowerCase().includes(q));
  renderArticlesList(filtered);
}

function openSingleArticleModal() {
  openModal('singleArticleModal');
}

async function submitSingleArticle() {
  const title = document.getElementById('singleArticleTitle').value;
  const level = document.getElementById('singleArticleLevel').value;
  const content = document.getElementById('singleArticleContent').value;

  if (!content.trim()) {
    showToast('Matn kiritilishi shart!', 'error');
    return;
  }

  try {
    await apiCall('/api/articles/single', 'POST', { title, content, level });
    closeModal('singleArticleModal');
    showToast('Artikl muvaffaqiyatli saqlandi!', 'success');
    document.getElementById('singleArticleContent').value = '';
    loadArticlesList();
  } catch (e) {
    console.error(e);
  }
}

function openBulkArticleModal() {
  openModal('bulkArticleModal');
}

async function submitBulkArticles() {
  const rawText = document.getElementById('bulkArticleContent').value;
  if (!rawText.trim()) {
    showToast('Kamida 1 ta artikl kiriting!', 'error');
    return;
  }

  const rawChunks = rawText.split(/\n\s*---\s*\n/).filter(c => c.trim().length > 10);
  if (rawChunks.length === 0) {
    showToast('Artikllarni ajratish uchun "---" belgisidan foydalaning.', 'error');
    return;
  }

  const articlesData = rawChunks.map(chunk => ({
    content: chunk.trim()
  }));

  showToast(`${articlesData.length} ta artikl bazaga yuklanmoqda...`);
  try {
    const res = await apiCall('/api/articles/bulk', 'POST', { articles: articlesData });
    closeModal('bulkArticleModal');
    showToast(`${res.inserted_count} ta artikl muvaffaqiyatli saqlandi!`, 'success');
    document.getElementById('bulkArticleContent').value = '';
    loadArticlesList();
  } catch (e) {
    console.error(e);
  }
}

async function openArticleDetail(articleId) {
  try {
    const article = await apiCall(`/api/articles/${articleId}`);
    AppState.activeArticle = article;

    document.getElementById('articleListView').style.display = 'none';
    document.getElementById('articleDetailView').style.display = 'block';

    document.getElementById('activeArticleTitle').innerText = article.title;
    document.getElementById('activeArticleLevel').innerText = article.level || 'B2';
    document.getElementById('activeArticleContent').innerText = article.content;

    if (article.listening_data && article.speaking_data && article.writing_data) {
      currentArticleTasks = {
        listening: article.listening_data,
        speaking: article.speaking_data,
        writing: article.writing_data
      };
      renderListeningTasks();
      renderSpeakingQuestionsForLevel();
      renderWritingPromptForLevel();
    } else {
      currentArticleTasks = null;
      document.getElementById('listeningTasksContainer').innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">Ushbu artikl bo'yicha IELTS topshiriqlari hali yaratilmagan.</p>
          <button class="btn btn-primary btn-block" onclick="generateArticleAITasks()">
            ✨ AI orqali IELTS Topshiriqlarini Generatsiya Qilish (20 ta savol)
          </button>
        </div>
      `;
    }

    switchArticleTab('listening');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    console.error(e);
  }
}

function backToArticleList() {
  document.getElementById('articleDetailView').style.display = 'none';
  document.getElementById('articleListView').style.display = 'block';
  loadArticlesList();
}

function switchArticleTab(tabName) {
  document.getElementById('tabContentListening').style.display = tabName === 'listening' ? 'block' : 'none';
  document.getElementById('tabContentSpeaking').style.display = tabName === 'speaking' ? 'block' : 'none';
  document.getElementById('tabContentWriting').style.display = tabName === 'writing' ? 'block' : 'none';

  document.getElementById('tabBtnListening').className = tabName === 'listening' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
  document.getElementById('tabBtnSpeaking').className = tabName === 'speaking' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
  document.getElementById('tabBtnWriting').className = tabName === 'writing' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
}

async function generateArticleAITasks() {
  if (!AppState.activeArticle) return;
  showToast('AI IELTS topshiriqlarini yaratmoqda (20 ta Listening, Speaking, Writing)...');

  try {
    const tasks = await apiCall(`/api/articles/${AppState.activeArticle.id}/generate-tasks`, 'POST');
    currentArticleTasks = tasks;
    renderListeningTasks();
    renderSpeakingQuestionsForLevel();
    renderWritingPromptForLevel();
    showToast('20 ta IELTS topshirig\'i tayyor! 🎉', 'success');
  } catch (e) {
    console.error(e);
  }
}

// 1. Listening Comprehension Tasks (5 TFNG, 5 MCQ, 5 Summary, 5 Matching)
function renderListeningTasks() {
  const container = document.getElementById('listeningTasksContainer');
  if (!currentArticleTasks || !currentArticleTasks.listening) return;

  const lis = currentArticleTasks.listening;
  const tfList = lis.true_false_not_given || (lis.questions ? lis.questions.filter(q => q.type === 'true_false_not_given') : []);
  const mcList = lis.multiple_choice || (lis.questions ? lis.questions.filter(q => q.type === 'multiple_choice') : []);
  const scList = lis.summary_completion || (lis.questions ? lis.questions.filter(q => q.type === 'summary_completion') : []);
  const miList = lis.matching_information || [];

  const totalCount = tfList.length + mcList.length + scList.length + miList.length;

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: white;">${lis.title || 'IELTS Academic Comprehension Test'}</h3>
        <p style="font-size: 12px; color: var(--text-muted);">Jami savollar: <strong style="color: var(--accent);">${totalCount} ta</strong></p>
      </div>
      <button class="btn btn-sm btn-secondary" onclick="generateArticleAITasks()" title="Savollarni yangilash">
        🔄 20 ta Savol Generatsiya Qilish
      </button>
    </div>
    
    ${totalCount < 10 ? `
      <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 12px;">
        <span style="color: #f59e0b; font-weight: 700;">⚠️ Diqqat:</span> Ushbu artiklda avval eski versiyadagi 3 ta savol saqlanib qolgan. 
        <button class="btn btn-sm btn-primary" style="margin-top: 6px; display: block;" onclick="generateArticleAITasks()">
          ⚡ To'liq 20 ta IELTS Savolini Hozir Yaratish
        </button>
      </div>
    ` : ''}

    <form id="comprehensiveQuizForm" onsubmit="event.preventDefault(); gradeComprehensiveQuiz();">
      
      <!-- 1. TFNG (5 Questions) -->
      ${tfList.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--accent); margin-bottom: 8px; text-transform: uppercase;">
            1-Qism: True / False / Not Given (5 ta savol)
          </div>
          ${tfList.map((q, idx) => `
            <div class="card" style="background: #151e30; border-color: var(--border-color); margin-bottom: 10px; padding: 12px;">
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">1.${idx + 1} ${q.question}</div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                ${["TRUE", "FALSE", "NOT GIVEN"].map(opt => `
                  <label style="font-size: 12px; cursor: pointer; color: var(--text-main); display: flex; align-items: center; gap: 4px;">
                    <input type="radio" name="q_${q.id || 'tf_' + idx}" value="${opt}"> ${opt}
                  </label>
                `).join('')}
              </div>
              <div id="feedback_${q.id || 'tf_' + idx}" style="margin-top: 8px; font-size: 12px; display: none;"></div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- 2. MCQ (5 Questions) -->
      ${mcList.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: #38bdf8; margin-bottom: 8px; text-transform: uppercase;">
            2-Qism: Multiple Choice (5 ta savol)
          </div>
          ${mcList.map((q, idx) => `
            <div class="card" style="background: #151e30; border-color: var(--border-color); margin-bottom: 10px; padding: 12px;">
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">2.${idx + 1} ${q.question}</div>
              ${(q.options || []).map(opt => `
                <label style="display: block; font-size: 12px; margin-bottom: 4px; cursor: pointer; color: var(--text-muted);">
                  <input type="radio" name="q_${q.id || 'mc_' + idx}" value="${opt}" style="margin-right: 6px;"> ${opt}
                </label>
              `).join('')}
              <div id="feedback_${q.id || 'mc_' + idx}" style="margin-top: 8px; font-size: 12px; display: none;"></div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- 3. Summary (5 Questions) -->
      ${scList.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: #34d399; margin-bottom: 8px; text-transform: uppercase;">
            3-Qism: Summary / Sentence Completion (5 ta savol)
          </div>
          ${scList.map((q, idx) => `
            <div class="card" style="background: #151e30; border-color: var(--border-color); margin-bottom: 10px; padding: 12px;">
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">3.${idx + 1} ${q.question}</div>
              <input type="text" name="q_${q.id || 'sc_' + idx}" class="form-input" placeholder="Javob so'zni yozing..." style="font-size: 13px;">
              <div id="feedback_${q.id || 'sc_' + idx}" style="margin-top: 8px; font-size: 12px; display: none;"></div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- 4. Matching (5 Questions) -->
      ${miList.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: #f59e0b; margin-bottom: 8px; text-transform: uppercase;">
            4-Qism: Matching Information (5 ta savol)
          </div>
          ${miList.map((q, idx) => `
            <div class="card" style="background: #151e30; border-color: var(--border-color); margin-bottom: 10px; padding: 12px;">
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">4.${idx + 1} ${q.question}</div>
              ${(q.options || []).map(opt => `
                <label style="display: block; font-size: 12px; margin-bottom: 4px; cursor: pointer; color: var(--text-muted);">
                  <input type="radio" name="q_${q.id || 'mi_' + idx}" value="${opt}" style="margin-right: 6px;"> ${opt}
                </label>
              `).join('')}
              <div id="feedback_${q.id || 'mi_' + idx}" style="margin-top: 8px; font-size: 12px; display: none;"></div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <button type="submit" class="btn btn-primary btn-block" style="margin-top: 14px;">
        ✅ Barcha 20 ta Savolni Tekshirish & Natijani Ko'rish
      </button>
    </form>
  `;
}

function gradeComprehensiveQuiz() {
  if (!currentArticleTasks || !currentArticleTasks.listening) return;
  const lis = currentArticleTasks.listening;
  const allGroups = [
    ...(lis.true_false_not_given || lis.questions || []),
    ...(lis.multiple_choice || []),
    ...(lis.summary_completion || []),
    ...(lis.matching_information || [])
  ];

  let score = 0;
  allGroups.forEach((q, idx) => {
    const qId = q.id || `q_${idx}`;
    const feedbackBox = document.getElementById(`feedback_${qId}`);
    if (!feedbackBox) return;

    let userAnswer = '';
    const selectedRadio = document.querySelector(`input[name="q_${qId}"]:checked`);
    if (selectedRadio) {
      userAnswer = selectedRadio.value;
    } else {
      const textInput = document.querySelector(`input[name="q_${qId}"]`);
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

  showToast(`IELTS Natija: ${score}/${total} (${percentage}%) — Band ~${estBand}`, 'success');

  if (percentage >= 60 && AppState.activeArticle) {
    apiCall(`/api/articles/${AppState.activeArticle.id}/status`, 'POST', { status: 'completed' });
  }
}

// 2. Speaking Section
function renderSpeakingQuestionsForLevel() {
  if (!currentArticleTasks || !currentArticleTasks.speaking) return;
  const level = document.getElementById('speakingLevelSelect').value;
  const levelData = currentArticleTasks.speaking.levels ? currentArticleTasks.speaking.levels[level] : null;

  const scaffoldingBox = document.getElementById('speakingScaffoldingBox');
  const scaffoldingContent = document.getElementById('scaffoldingContent');

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
  const container = document.getElementById('speakingQuestionsContainer');

  container.innerHTML = questions.map((q, idx) => `
    <div class="card" style="background: #141c2e; border-color: var(--border-color); margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 11px; color: var(--accent); font-weight: 700;">SAVOL ${idx + 1} / ${questions.length}</span>
        <button class="btn btn-sm btn-secondary" onclick="speakText('${q.replace(/'/g, "\\'")}')">🔊 Tinglash</button>
      </div>
      <p style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: var(--text-main);">${q}</p>

      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <button class="btn btn-sm btn-primary" id="recBtn_${idx}" onclick="toggleSpeakingRecord(${idx}, '${q.replace(/'/g, "\\'")}')">
          🎤 Mikrofonni Bosib Gapiring
        </button>
      </div>

      <div class="form-group">
        <textarea id="speakingTranscript_${idx}" class="form-textarea" style="min-height: 70px; font-size: 13px;" placeholder="Sizning aytgan so'zlaringiz bu yerda ko'rinadi..."></textarea>
      </div>

      <button class="btn btn-sm btn-accent btn-block" onclick="submitSpeakingEvaluation(${idx}, '${q.replace(/'/g, "\\'")}')">
        ✨ AI Baholash (4 IELTS Mezon)
      </button>

      <div id="speakingEvaluationResult_${idx}" style="margin-top: 10px; display: none;"></div>
    </div>
  `).join('');
}

function toggleSpeakingRecord(index, questionText) {
  const btn = document.getElementById(`recBtn_${index}`);
  const textarea = document.getElementById(`speakingTranscript_${index}`);

  if (isSpeakingRecording) {
    if (speakingRecognition) {
      try { speakingRecognition.stop(); } catch(e) {}
    }
    isSpeakingRecording = false;
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

  if (speakingRecognition) {
    try { speakingRecognition.abort(); } catch(e) {}
  }

  speakingRecognition = new SpeechRecognition();
  speakingRecognition.lang = 'en-US';
  speakingRecognition.continuous = true;
  speakingRecognition.interimResults = false;

  speakingRecognition.onstart = () => {
    isSpeakingRecording = true;
    btn.innerHTML = '⏹️ To\'xtatish (Gapiryapsiz...)';
    btn.className = 'btn btn-sm btn-danger';
    showToast('Tinglanmoqda, inglizcha gapiring...');
  };

  speakingRecognition.onresult = (event) => {
    let finalStr = '';
    for (let i = 0; i < event.results.length; ++i) {
      if (event.results[i][0]) {
        finalStr += event.results[i][0].transcript.trim() + ' ';
      }
    }
    textarea.value = finalStr.trim();
  };

  speakingRecognition.onerror = (e) => {
    console.error('Speech error:', e);
    if (e.error !== 'no-speech') {
      isSpeakingRecording = false;
      btn.innerHTML = '🎤 Mikrofonni Bosib Gapiring';
      btn.className = 'btn btn-sm btn-primary';
    }
  };

  speakingRecognition.onend = () => {
    isSpeakingRecording = false;
    btn.innerHTML = '🎤 Mikrofonni Bosib Gapiring';
    btn.className = 'btn btn-sm btn-primary';
  };

  try {
    speakingRecognition.start();
  } catch(err) {
    console.error(err);
  }
}

async function submitSpeakingEvaluation(index, questionText) {
  const transcript = document.getElementById(`speakingTranscript_${index}`).value.trim();
  const level = document.getElementById('speakingLevelSelect').value;
  const resultContainer = document.getElementById(`speakingEvaluationResult_${index}`);

  if (!transcript) {
    showToast('Avval gapiring yoki matn yozing!', 'error');
    return;
  }

  showToast('AI Speaking javobingizni 4 mezon bo\'yicha baholamoqda...');
  try {
    const res = await apiCall(`/api/articles/${AppState.activeArticle.id}/evaluate-speaking`, 'POST', {
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

// 3. Writing Section
function renderWritingPromptForLevel() {
  if (!currentArticleTasks || !currentArticleTasks.writing) return;
  const level = document.getElementById('writingLevelSelect').value;
  const levelData = currentArticleTasks.writing.levels ? currentArticleTasks.writing.levels[level] : null;

  if (levelData) {
    document.getElementById('writingPromptText').innerText = levelData.prompt || 'IELTS Task Prompt';
  }
}

function updateEssayWordCount() {
  const text = document.getElementById('essayInput').value.trim();
  const count = text ? text.split(/\s+/).length : 0;
  document.getElementById('essayWordCount').innerText = `${count} so'z`;
}

async function submitArticleWriting() {
  const essayText = document.getElementById('essayInput').value.trim();
  const promptText = document.getElementById('writingPromptText').innerText;
  const level = document.getElementById('writingLevelSelect').value;
  const resultContainer = document.getElementById('writingEvaluationResult');

  if (!essayText) {
    showToast('Essengizni yozing!', 'error');
    return;
  }

  showToast('AI IELTS Writing tahlilini amalga oshirmoqda...');
  try {
    const res = await apiCall(`/api/articles/${AppState.activeArticle.id}/evaluate-writing`, 'POST', {
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

async function speakText(text) {
  try {
    const res = await apiCall('/api/tts/speak', 'POST', { text });
    if (res.audio_url) {
      const audio = new Audio(res.audio_url);
      audio.play();
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    window.speechSynthesis.speak(utterance);
  }
}
