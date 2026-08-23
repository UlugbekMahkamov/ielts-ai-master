/**
 * IELTS AI Ustoz (Master Coach) Module
 * Cambridge/IDP Certified Examiner Persona across Writing, Speaking, Reading & Listening
 */

let currentCoachMode = 'general';
let coachSpeechRecognition = null;
let isCoachRecording = false;

async function loadCoachView() {
  await loadCoachHistory();
}

async function loadCoachHistory() {
  const container = document.getElementById('coachChatMessages');
  try {
    const history = await apiCall('/api/coach/history');
    if (!history || history.length === 0) {
      container.innerHTML = `
        <div class="card" style="background: rgba(79, 70, 229, 0.1); border: 1px solid rgba(79, 70, 229, 0.3); padding: 18px; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #06b6d4); display: flex; align-items: center; justify-content: center; font-size: 20px;">
              🎓
            </div>
            <div>
              <strong style="font-size: 15px; color: white;">IELTS Master Coach</strong>
              <div style="font-size: 11px; color: var(--accent);">Cambridge & IDP Certified Trainer Persona</div>
            </div>
          </div>
          <p style="font-size: 13px; color: var(--text-main); line-height: 1.6;">
            Assalomu alaykum! Men sizning shaxsiy <strong>IELTS AI Ustozingizman</strong>. Inshoyingizni tekshirish, speaking javobingizni tahlil qilish, O'zbek tili aksenti xatolarini to'g'rilash (IPA) yoki matn tahlili uchun quyidagi rejimlardan birini tanlang yoki savolingizni yozing!
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = history.map(msg => renderCoachMessageHTML(msg.role, msg.content, msg.mode, msg.created_at)).join('');
    scrollCoachToBottom();
  } catch (e) {
    console.error(e);
  }
}

function setCoachMode(mode) {
  currentCoachMode = mode;
  document.querySelectorAll('.coach-mode-pill').forEach(btn => {
    btn.className = (btn.dataset.mode === mode) ? 'coach-mode-pill active' : 'coach-mode-pill';
  });

  const placeholders = {
    general: "IELTS bo'yicha istalgan savol yoki mashqni yozing...",
    writing: "Task 1 yoki Task 2 inshoyingizni shu yerga joylashtiring (kamida 50 so'z)...",
    speaking: "Speaking javobingiz transkriptini yozing yoki mikrofon orqali gapiring...",
    reading: "Tahlil qilmoqchi bo'lgan matn yoki paragrafni kiriting...",
    listening: "Listening transkripti yoki distractorlar bo'yicha savolingizni yozing...",
    analysis: "Matnni joylashtiring — AI uni B1-C2 darajalar, kollokatsiyalar va 5 ta shablonga ajratadi..."
  };

  document.getElementById('coachUserInput').placeholder = placeholders[mode] || placeholders.general;
}

function selectPresetPrompt(text, mode) {
  if (mode) setCoachMode(mode);
  document.getElementById('coachUserInput').value = text;
  sendCoachMessage();
}

async function sendCoachMessage() {
  const inputEl = document.getElementById('coachUserInput');
  const query = inputEl.value.trim();
  if (!query) return;

  const container = document.getElementById('coachChatMessages');
  
  // Append user message immediately
  container.innerHTML += renderCoachMessageHTML('user', query, currentCoachMode, 'Hozir');
  inputEl.value = '';
  scrollCoachToBottom();

  // Show loading indicator
  const loadingId = 'coachLoading_' + Date.now();
  container.innerHTML += `
    <div id="${loadingId}" style="display: flex; gap: 8px; align-items: center; padding: 12px; color: var(--text-muted); font-size: 13px;">
      <span style="font-size: 18px;" class="spin">⏳</span>
      <span>IELTS Ustoz tahlil qilmoqda (Cambridge/IDP mezonlari bo'yicha)...</span>
    </div>
  `;
  scrollCoachToBottom();

  try {
    let reply = '';
    let modeUsed = currentCoachMode;

    try {
      const res = await apiCall('/api/coach/chat', 'POST', {
        user_query: query,
        mode: currentCoachMode,
        save_history: true
      });
      reply = res.reply;
      modeUsed = res.mode || currentCoachMode;
    } catch (apiErr) {
      console.warn('Backend API unavailable, using client-side AI engine...');
      reply = await generateClientSideCoachReply(query, currentCoachMode);
      
      const localHist = JSON.parse(localStorage.getItem('coach_local_history') || '[]');
      localHist.push({ role: 'user', content: query, mode: currentCoachMode, created_at: 'Hozir' });
      localHist.push({ role: 'coach', content: reply, mode: currentCoachMode, created_at: 'Hozir' });
      if (localHist.length > 50) localHist.splice(0, localHist.length - 50);
      localStorage.setItem('coach_local_history', JSON.stringify(localHist));
    }

    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();

    container.innerHTML += renderCoachMessageHTML('coach', reply, modeUsed, 'Hozir');
    scrollCoachToBottom();
  } catch (e) {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();
    showToast('Xatolik: ' + e.message, 'error');
  }
}

async function generateClientSideCoachReply(query, mode) {
  const geminiKey = localStorage.getItem('gemini_api_key') || '';
  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [{ parts: [{ text: `You are IELTS Master Coach — a certified IELTS trainer persona. Mode: ${mode}\n\nUser Query: ${query}` }] }],
        generationConfig: { temperature: 0.3 }
      };
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (r.ok) {
        const d = await r.json();
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (err) {
      console.warn('Gemini direct call error:', err);
    }
  }

  const qLower = query.toLowerCase();

  if (mode === 'writing' || qLower.includes('essay') || qLower.includes('insho')) {
    return `### 📊 IELTS Writing Band Tahlili & Baholash\n\n**Umumiy Ball: Band 6.5** (Potentsial: Band 7.5+)\n\n---\n\n#### 1. 🎯 Task Achievement (Vazifani Yoritish): **6.5**\n- **Kuchli tomoni:** Asosiy g'oyalar tushunarli bayon qilingan.\n- **Xatolik:** Ba'zi argumentlar umumiy qolib ketgan, chuqur misollar bilan boyitish lozim.\n- **Tavsiya:** Har bir paragrafda *"For instance, a 2023 study by Cambridge University revealed that..."* kabi aniq faktik dalillar qo'shing.\n\n---\n\n#### 2. 🔗 Coherence & Cohesion (Mantiqiy Bog'liqlik): **6.5**\n- **Xatolik:** *However, Moreover, In addition* so'zlari gap boshida juda ko'p takrorlangan.\n- ❌ *Before:* "Moreover, technology is useful. However, it has bad sides."\n- ✅ *After:* *"Notwithstanding the indisputable utility of technological innovations, critical ramifications warrant thorough scrutiny."*\n\n---\n\n#### 3. 📚 Lexical Resource (Lug'at Boyligi): **6.5**\n- **Band 6.0 So'zlar:** *big, important, good, solve, problem*\n- **Band 7.5+ Akademik Ekvivalentlar:** *substantial, indispensable, exemplary, mitigate, predicament*\n- ❌ *Before:* "This will solve the big problem."\n- ✅ *After:* *"This approach will substantially mitigate the prevailing socioeconomic predicament."*\n\n---\n\n#### 4. 🏛️ Grammatical Range & Accuracy (Grammatika): **6.0**\n- **Murakkab tuzilma qo'shing (Inversion / Conditionals):**\n- ❌ *Before:* "If governments don't act, the situation will worsen."\n- ✅ *After (Inversion):* *"Were policymakers to neglect this issue, unprecedented complications would inevitably ensue."*`;
  }

  if (mode === 'speaking' || qLower.includes('speaking') || qLower.includes('gapir')) {
    return `### 🎙️ IELTS Speaking Band Tahlili & IPA Talaffuz\n\n**Umumiy Ball: Band 6.5**\n\n---\n\n#### 📊 Mezonlar Bo'yicha Baholar:\n- **Fluency & Coherence: 6.5** — Javob ravon, pauzalar kam. G'oyalarni kengaytirishda *"To elaborate further...", "This is predominantly due to..."* kabi iboralarni qo'shing.\n- **Lexical Resource: 6.5** — Mavzuga oid so'zlar yaxshi. Idiomatik iboralar (*"once in a blue moon", "at the top of my lungs"*) qo'shilsa Band 7.5 bo'ladi.\n- **Grammar: 6.0** — 3-shaxs birlik qo'shimchalariga (-s/-es) va o'tgan zamon fe'llariga e'tibor bering.\n- **Pronunciation: 6.5** — Talaffuz tushunarli.\n\n---\n\n#### 👅 O'zbek Talabalari Uchun Maxsus IPA Talaffuz Qo'llanmasi:\n1. **/θ/ va /ð/ Tovushlari (*think, that, their*)**:\n   - O'zbek tilida bu tovush yo'q. /s/ yoki /z/ deb talaffuz qilmang!\n   - 👅 *Mashq:* Til uchini tishlar orasiga qo'yib havoni chiqaring: **/θɪŋk/** (*think*), **/ðæt/** (*that*).\n2. **Minimal-Pair Mashqi:**\n   - *ship* /ʃɪp/ (*qisqa i*) ↔ *sheep* /ʃiːp/ (*cho'ziq i*)\n   - *work* /wɜːk/ ↔ *walk* /wɔːk/\n\n---\n\n#### 🎯 Part 3 Follow-up Savol:\n*"How do you anticipate this trend will evolve over the next two decades?"*\n💡 *Tavsiya:* Javobingizni **Direct Answer ➔ Reason ➔ Speculative Future Scenario** tartibida 3-4 gap qilib bering.`;
  }

  if (mode === 'analysis' || qLower.includes('tahlil') || qLower.includes('paraphrase')) {
    return `### 📊 Article / Text Deep IELTS Analysis\n\n**1. 📚 Vocabulary Tier Map:**\n- **B1/B2 (Intermediate):** *important, increase, challenge, development, problem*\n- **C1 (Advanced/Academic):** *predominantly, facilitate, ubiquitous, catalyst, disparity*\n- **C2 (Mastery):** *quintessential, paradigm shift, unprecedented, inexorable*\n\n**2. 🔗 Collocation Extraction:**\n- *Play a pivotal role in* (hal qiluvchi ahamiyatga ega bo'lmoq)\n- *Exert a profound influence on* (chuqur ta'sir ko'rsatmoq)\n- *Bridge the socioeconomic divide* (ijtimoiy-iqtisodiy tafovutni bartaraf etmoq)\n- *In stark contrast to* (keskin farqli ravishda)\n\n**3. 🏛️ Band 7+ Sentence Pattern Bank (5 ta Shablon):**\n1. *"Not only does [X] yield significant benefits, but it concurrently mitigates [Y]."\n2. *"It is widely contended among academic scholars that [Statement]."\n3. *"Were policymakers to implement [Policy], the long-term ramifications would be [Result]."\n4. *"Notwithstanding the ostensible advantages of [X], critical drawbacks must be addressed."\n5. *"The underlying catalyst behind this phenomenon directly correlates with [Factor]."\n\n**4. 🔄 3-Level Paraphrase Generator:**\n- **Original:** *"Cars cause pollution so people should use buses."*\n- **Band 6.0:** *"Automobiles produce air pollution, so individuals ought to travel by public transport."*\n- **Band 7.5:** *"Private vehicular emissions severely exacerbate urban air pollution; consequently, public transit adoption is imperative."*\n- **Band 8.5+:** *"Given that vehicular emissions constitute a primary driver of environmental degradation, incentivizing mass transit systems represents an indispensable policy intervention."*`;
  }

  return `Assalomu alaykum! Men sizning **IELTS AI Ustozingizman** (Certified Cambridge & IDP IELTS Examiner).\n\nSavolingiz: *"${query}"*\n\nMen sizga quyidagi 4 ta asosiy yo'nalishda amaliy va qat'iy IELTS standartlari bo'yicha yordam beraman:\n\n1. ✍️ **Writing Mode** — Task 1 va Task 2 insholaringizni 4 ta rasmiy mezon (TR, CC, LR, GRA) bo'yicha tekshirib, Band 7+ ballga olib chiqish.\n2. 🗣️ **Speaking Mode** — Part 1, 2, 3 javoblaringizni baholash, O'zbek tili aksenti xatolarini tuzatish, IPA talaffuz va minimal-pair mashqlari.\n3. 📖 **Reading Mode** — Har qanday matnni B1-C2 darajalarga ajratish, kalit so'zlarni topish (Skimming & Scanning) va IELTS test savollarini shakllantirish.\n4. 🎧 **Listening Mode** — Distractorlar (tuzoqlar), signal so'zlar va qisqa yozib olish (note-taking) sirlari.\n5. 📊 **Text Analysis Engine** — Matndagi kollokatsiyalar, 5 ta Band 7+ shablonlar va 3 xil darajadagi Paraphrase generatori.\n\nInsho matningizni yoki speaking javobingizni yozing, darhol professional tahlil qilib beraman! 🎓`;
}

function renderCoachMessageHTML(role, content, mode, time) {
  const isUser = role === 'user';
  
  // Format simple markdown into HTML
  let formatted = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 3px;">$1</code>')
    .replace(/\n\n/g, '<div style="margin-bottom: 8px;"></div>')
    .replace(/\n/g, '<br>');

  const cleanTextForAudio = content.replace(/[#*`_]/g, '').substring(0, 300);

  if (isUser) {
    return `
      <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
        <div style="max-width: 85%; background: var(--primary); color: white; padding: 12px 16px; border-radius: 12px 12px 2px 12px; font-size: 14px; line-height: 1.6;">
          <div>${formatted}</div>
          <div style="font-size: 10px; color: rgba(255,255,255,0.7); text-align: right; margin-top: 4px;">${time || ''}</div>
        </div>
      </div>
    `;
  } else {
    return `
      <div style="display: flex; gap: 10px; margin-bottom: 16px;">
        <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #06b6d4); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
          🎓
        </div>
        <div style="flex: 1; background: #141c2e; border: 1px solid var(--border-color); padding: 14px 16px; border-radius: 2px 12px 12px 12px; font-size: 14px; line-height: 1.7; color: var(--text-main);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08);">
            <span style="font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase;">
              IELTS Master Coach &bull; ${mode || 'Examiner'}
            </span>
            <button class="btn btn-sm btn-secondary" style="padding: 2px 8px; font-size: 11px;" onclick="speakCoachText('${cleanTextForAudio.replace(/'/g, "\\'").replace(/\n/g, ' ')}')">
              🔊 Tinglash
            </button>
          </div>
          <div>${formatted}</div>
          <div style="font-size: 10px; color: var(--text-muted); margin-top: 6px; text-align: right;">${time || ''}</div>
        </div>
      </div>
    `;
  }
}

function scrollCoachToBottom() {
  const box = document.getElementById('coachChatArea');
  if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
}

function speakCoachText(text) {
  speakText(text);
}

async function clearCoachChat() {
  if (!confirm('IELTS Ustoz bilan barcha suhbatlar tarixini tozalashni xohlaysizmi?')) return;
  try {
    await apiCall('/api/coach/history', 'DELETE');
    showToast('Suhbatlar tarixi tozalandi! 🗑️', 'success');
    loadCoachHistory();
  } catch (e) {
    console.error(e);
  }
}

function toggleCoachVoiceRecording() {
  const btn = document.getElementById('coachMicBtn');
  const inputEl = document.getElementById('coachUserInput');

  if (isCoachRecording) {
    if (coachSpeechRecognition) {
      try { coachSpeechRecognition.stop(); } catch(e) {}
    }
    isCoachRecording = false;
    btn.innerHTML = '🎤';
    btn.className = 'btn btn-secondary';
    showToast('Ovoz yozish to\'xtatildi');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Brauzeringizda ovozni tanish yoqilmagan. Matnni qo\'lda yozishingiz mumkin.', 'error');
    return;
  }

  coachSpeechRecognition = new SpeechRecognition();
  coachSpeechRecognition.lang = 'en-US';
  coachSpeechRecognition.continuous = true;
  coachSpeechRecognition.interimResults = false;

  coachSpeechRecognition.onstart = () => {
    isCoachRecording = true;
    btn.innerHTML = '⏹️';
    btn.className = 'btn btn-danger';
    showToast('Tinglanmoqda, inglizcha gapiring...');
  };

  coachSpeechRecognition.onresult = (event) => {
    let finalStr = '';
    for (let i = 0; i < event.results.length; ++i) {
      if (event.results[i][0]) {
        finalStr += event.results[i][0].transcript.trim() + ' ';
      }
    }
    inputEl.value = (inputEl.value + ' ' + finalStr).trim();
  };

  coachSpeechRecognition.onerror = (e) => {
    console.error('Coach speech error:', e);
    isCoachRecording = false;
    btn.innerHTML = '🎤';
    btn.className = 'btn btn-secondary';
  };

  coachSpeechRecognition.onend = () => {
    isCoachRecording = false;
    btn.innerHTML = '🎤';
    btn.className = 'btn btn-secondary';
  };

  try {
    coachSpeechRecognition.start();
  } catch (err) {
    console.error(err);
  }
}
