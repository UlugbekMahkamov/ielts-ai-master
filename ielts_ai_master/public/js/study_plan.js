/**
 * Study Plan Module: Dynamic AI Lessons (Lesson 1, Lesson 2...) & Tasks Checklist
 */

let allStudyPlans = [];

async function loadStudyPlans() {
  try {
    allStudyPlans = await apiCall('/api/study-plans');
    renderStudyPlans(allStudyPlans);
  } catch (e) {
    console.error(e);
  }
}

function renderStudyPlans(plans) {
  const container = document.getElementById('studyPlansContainer');
  if (!plans || plans.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 24px;">
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 10px;">Hozircha reja darslari yo'q.</p>
        <button class="btn btn-primary" onclick="generateNextLesson()">✨ Lesson 1 Yaratish</button>
      </div>
    `;
    return;
  }

  // Update Dashboard Bugungi Rejangiz widget with latest active plan
  const activePlan = plans.find(p => !p.is_completed) || plans[plans.length - 1];
  if (activePlan) {
    const titleEl = document.getElementById('dashPlanTitle');
    const descEl = document.getElementById('dashPlanDesc');
    if (titleEl) titleEl.innerText = `Lesson ${activePlan.lesson_number}: ${activePlan.title}`;
    if (descEl) descEl.innerText = activePlan.description;
  }

  container.innerHTML = plans.map(p => `
    <div class="card" style="margin-bottom: 16px; border-color: ${p.is_completed ? 'var(--success)' : 'rgba(79, 70, 229, 0.4)'};">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span class="badge" style="background: ${p.is_completed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(79, 70, 229, 0.2)'}; color: ${p.is_completed ? 'var(--success)' : 'var(--accent)'}; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
          LESSON ${p.lesson_number} ${p.is_completed ? '✅ Bajarilgan' : '⏳ Jarayonda'}
        </span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; color: var(--text-muted);">${p.created_at || ''}</span>
          <button class="btn btn-sm btn-danger" style="padding: 2px 6px; font-size: 11px;" onclick="deleteStudyPlan(${p.id}, ${p.lesson_number})" title="Darsni o'chirish">🗑️</button>
        </div>
      </div>

      <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 4px; color: white;">${p.title}</h3>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">${p.description || ''}</p>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${(p.tasks || []).map(t => `
          <div style="background: #141c2e; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; align-items: flex-start; gap: 10px;">
            <input type="checkbox" ${t.completed ? 'checked' : ''} style="margin-top: 3px; cursor: pointer; width: 16px; height: 16px; accent-color: var(--primary);" onchange="togglePlanTask(${p.id}, '${t.id}', this.checked)">
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 600; color: ${t.completed ? 'var(--text-muted)' : 'var(--text-main)'}; ${t.completed ? 'text-decoration: line-through;' : ''}">
                ${t.title}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ${t.description}
              </div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="navigateTo('${t.target_route || 'article'}')" style="padding: 4px 8px; font-size: 11px;">
              O'tish &rarr;
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

async function togglePlanTask(planId, taskId, isDone) {
  try {
    await apiCall(`/api/study-plans/${planId}/toggle-task`, 'POST', {
      task_id: taskId,
      is_done: isDone
    });
    showToast(isDone ? 'Vazifa bajarildi! ✅' : 'Vazifa belgilandi');
    loadStudyPlans();
    loadDashboard();
  } catch (e) {
    console.error(e);
  }
}

async function generateNextLesson() {
  showToast('AI navbatdagi kunlik darsni (Lesson) tuzmoqda...');
  try {
    const res = await apiCall('/api/study-plans/generate-next', 'POST', {});
    showToast(`Lesson ${res.lesson_number} muvaffaqiyatli shakllantirildi!`, 'success');
    loadStudyPlans();
  } catch (e) {
    console.error(e);
  }
}

async function deleteStudyPlan(planId, lessonNum) {
  if (!confirm(`Lesson ${lessonNum} ni o'chirmoqchimisiz?`)) return;
  try {
    await apiCall(`/api/study-plans/${planId}`, 'DELETE');
    showToast(`Lesson ${lessonNum} o'chirildi! 🗑️`, 'success');
    loadStudyPlans();
    loadDashboard();
  } catch (e) {
    console.error(e);
  }
}
