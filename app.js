// ===== 预设活动模版 =====
const PRESET_TEMPLATES = [
    { id: 'yuwen-lianzi', name: '语文练字', duration: 30, category: '语文', icon: '✍️', desc: '练字', isPreset: true },
    { id: 'yuwen-beisong', name: '语文背诵', duration: 15, category: '语文', icon: '📖', desc: '背古诗/课文', isPreset: true },
    { id: 'yuwen-yuedu', name: '语文阅读', duration: 20, category: '语文', icon: '📚', desc: '课外阅读', isPreset: true },
    { id: 'shuxue-lianxi', name: '数学练习', duration: 20, category: '数学', icon: '🔢', desc: '学而思习题', isPreset: true },
    { id: 'yingyu-yuedu', name: '英语阅读', duration: 25, category: '英语', icon: '🌍', desc: '英语书阅读及做题', isPreset: true },
    { id: 'lianqin', name: '练琴', duration: 35, category: '练琴', icon: '🎹', desc: '钢琴练习', isPreset: true },
    { id: 'wangyuan', name: '望远休息', duration: 5, category: '休息', icon: '👀', desc: '保护视力', isPreset: true },
    { id: 'xishu', name: '洗漱', duration: 15, category: '生活', icon: '🪥', desc: '洗漱准备', isPreset: true },
    { id: 'tiyu-daka', name: '体育打卡', duration: 15, category: '体育', icon: '⚽', desc: '体育运动打卡', isPreset: true },
    { id: 'ziyou', name: '自由活动', duration: 30, category: '活动', icon: '🎮', desc: '自由安排', isPreset: true },
];

// ===== 状态管理 =====
let allTemplates = []; // 预设 + 自定义
let planItems = [];    // 今日计划中的活动列表
let editingPlanIndex = -1; // 正在编辑的计划项索引
let dragIndex = -1;    // 拖拽源索引

// ===== DOM 引用 =====
const elDate = document.getElementById('plan-date');
const elStartTime = document.getElementById('start-time');
const elTemplateList = document.getElementById('template-list');
const elPlanList = document.getElementById('plan-list');
const elPlanEmpty = document.getElementById('plan-empty');
const elPrintArea = document.getElementById('print-area');
const elPrintDate = document.getElementById('print-date');
const elPrintTableBody = document.getElementById('print-table-body');

// Modals
const elModalNew = document.getElementById('modal-new-template');
const elModalEdit = document.getElementById('modal-edit-item');

// ===== 初始化 =====
async function init() {
    // 设置今天日期
    const today = new Date();
    elDate.value = formatDateForInput(today);

    // 加载模版（从服务器）
    await loadTemplates();
    renderTemplates();
    renderPlan();

    // 绑定事件
    bindEvents();
}

// ===== 工具函数 =====
function formatDateForInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateChinese(dateStr) {
    const d = new Date(dateStr);
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const w = weekDays[d.getDay()];
    return `${y}年${m}月${day}日（周${w}）`;
}

function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function generateId() {
    return 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

// ===== 模版管理 =====
async function loadTemplates() {
    try {
        const res = await fetch('/api/templates');
        const custom = await res.json();
        allTemplates = [...PRESET_TEMPLATES, ...custom];
    } catch (e) {
        console.warn('加载自定义模版失败，仅使用预设模版:', e);
        allTemplates = [...PRESET_TEMPLATES];
    }
}

async function saveCustomTemplate(tpl) {
    try {
        await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tpl),
        });
    } catch (e) {
        console.error('保存模版失败:', e);
        alert('保存模版失败，请检查服务器是否正常运行');
    }
}

async function deleteTemplateFromServer(id) {
    try {
        await fetch('/api/templates/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
    } catch (e) {
        console.error('删除模版失败:', e);
        alert('删除模版失败，请检查服务器是否正常运行');
    }
}

function renderTemplates(filter = 'all') {
    elTemplateList.innerHTML = '';
    const filtered = filter === 'all'
        ? allTemplates
        : allTemplates.filter(t => t.category === filter);

    filtered.forEach((tpl, _i) => {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.setAttribute('data-category', tpl.category);
        card.innerHTML = `
            <span class="template-icon">${tpl.icon}</span>
            <div class="template-info">
                <div class="template-name">${tpl.name}</div>
                <div class="template-meta">${tpl.category} · ${tpl.desc || ''}</div>
            </div>
            <span class="template-duration">${tpl.duration}分钟</span>
            ${!tpl.isPreset ? `<button class="template-delete" data-id="${tpl.id}" title="删除此模版">✕</button>` : ''}
        `;

        // 点击添加到计划
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('template-delete')) return;
            addToPlan(tpl);
        });

        // 删除自定义模版
        const delBtn = card.querySelector('.template-delete');
        if (delBtn) {
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteTemplate(tpl.id);
            });
        }

        elTemplateList.appendChild(card);
    });
}

async function deleteTemplate(id) {
    if (!confirm('确定要删除这个模版吗？')) return;
    allTemplates = allTemplates.filter(t => t.id !== id);
    await deleteTemplateFromServer(id);
    renderTemplates(getCurrentFilter());
}

function getCurrentFilter() {
    const active = document.querySelector('.filter-btn.active');
    return active ? active.dataset.category : 'all';
}

// ===== 计划编排 =====
function addToPlan(tpl) {
    planItems.push({
        name: tpl.name,
        duration: tpl.duration,
        category: tpl.category,
        icon: tpl.icon,
        note: tpl.desc || '',
    });
    renderPlan();
}

function removePlanItem(index) {
    planItems.splice(index, 1);
    renderPlan();
}

function calculateTimes() {
    const startMinutes = timeToMinutes(elStartTime.value);
    let current = startMinutes;
    return planItems.map(item => {
        const start = minutesToTime(current);
        current += item.duration;
        const end = minutesToTime(current);
        return { start, end };
    });
}

function renderPlan() {
    // Show/hide empty state
    elPlanEmpty.style.display = planItems.length === 0 ? 'flex' : 'none';

    // Remove old plan items (keep empty state element)
    const oldItems = elPlanList.querySelectorAll('.plan-item');
    oldItems.forEach(el => el.remove());

    // Remove old summary
    const oldSummary = elPlanList.parentElement.querySelector('.plan-summary');
    if (oldSummary) oldSummary.remove();

    if (planItems.length === 0) return;

    const times = calculateTimes();

    planItems.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'plan-item';
        el.setAttribute('data-category', item.category);
        el.setAttribute('draggable', 'true');
        el.setAttribute('data-index', index);

        el.innerHTML = `
            <span class="plan-drag-handle" title="拖拽排序">⋮⋮</span>
            <span class="plan-index">${index + 1}</span>
            <span class="plan-time">${times[index].start} - ${times[index].end}</span>
            <span class="plan-icon">${item.icon}</span>
            <div class="plan-details">
                <div class="plan-name">${item.name}</div>
                ${item.note ? `<div class="plan-note">${item.note}</div>` : ''}
            </div>
            <div class="plan-item-actions">
                <button class="plan-item-btn edit" title="编辑" data-index="${index}">✏️</button>
                <button class="plan-item-btn delete" title="删除" data-index="${index}">🗑️</button>
            </div>
        `;

        // Drag events
        el.addEventListener('dragstart', handleDragStart);
        el.addEventListener('dragover', handleDragOver);
        el.addEventListener('dragenter', handleDragEnter);
        el.addEventListener('dragleave', handleDragLeave);
        el.addEventListener('drop', handleDrop);
        el.addEventListener('dragend', handleDragEnd);

        // Edit button
        el.querySelector('.plan-item-btn.edit').addEventListener('click', () => openEditModal(index));

        // Delete button
        el.querySelector('.plan-item-btn.delete').addEventListener('click', () => removePlanItem(index));

        elPlanList.appendChild(el);
    });

    // Add summary bar
    const totalMin = planItems.reduce((sum, item) => sum + item.duration, 0);
    const endTime = minutesToTime(timeToMinutes(elStartTime.value) + totalMin);
    const summary = document.createElement('div');
    summary.className = 'plan-summary';
    summary.innerHTML = `
        <span>共 <strong>${planItems.length}</strong> 项活动</span>
        <span>总时长 <span class="total-time">${totalMin} 分钟</span>，预计 <span class="total-time">${endTime}</span> 结束</span>
    `;
    elPlanList.parentElement.appendChild(summary);
}

// ===== 拖拽排序 =====
function handleDragStart(e) {
    dragIndex = parseInt(e.currentTarget.dataset.index);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const dropIndex = parseInt(e.currentTarget.dataset.index);
    if (dragIndex === dropIndex) return;

    // Reorder
    const [moved] = planItems.splice(dragIndex, 1);
    planItems.splice(dropIndex, 0, moved);
    renderPlan();
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.plan-item').forEach(el => el.classList.remove('drag-over'));
}

// ===== 编辑活动弹窗 =====
function openEditModal(index) {
    editingPlanIndex = index;
    const item = planItems[index];
    document.getElementById('edit-duration').value = item.duration;
    document.getElementById('edit-note').value = item.note || '';
    elModalEdit.classList.add('active');
}

function closeEditModal() {
    elModalEdit.classList.remove('active');
    editingPlanIndex = -1;
}

function saveEdit() {
    if (editingPlanIndex < 0) return;
    const duration = parseInt(document.getElementById('edit-duration').value) || 20;
    const note = document.getElementById('edit-note').value.trim();
    planItems[editingPlanIndex].duration = Math.max(5, Math.min(120, duration));
    planItems[editingPlanIndex].note = note;
    closeEditModal();
    renderPlan();
}

// ===== 新建模版弹窗 =====
function openNewTemplateModal() {
    document.getElementById('tpl-name').value = '';
    document.getElementById('tpl-duration').value = 20;
    document.getElementById('tpl-category').value = '语文';
    document.getElementById('tpl-icon').value = '';
    document.getElementById('tpl-desc').value = '';
    elModalNew.classList.add('active');
}

function closeNewTemplateModal() {
    elModalNew.classList.remove('active');
}

async function saveNewTemplate() {
    const name = document.getElementById('tpl-name').value.trim();
    const duration = parseInt(document.getElementById('tpl-duration').value) || 20;
    const category = document.getElementById('tpl-category').value;
    const icon = document.getElementById('tpl-icon').value.trim() || '📌';
    const desc = document.getElementById('tpl-desc').value.trim();

    if (!name) {
        alert('请输入活动名称');
        return;
    }

    const newTpl = {
        id: generateId(),
        name,
        duration: Math.max(5, Math.min(120, duration)),
        category,
        icon,
        desc,
        isPreset: false,
    };

    allTemplates.push(newTpl);
    await saveCustomTemplate(newTpl);
    renderTemplates(getCurrentFilter());
    closeNewTemplateModal();
}

// ===== 打印 =====
function preparePrint() {
    if (planItems.length === 0) {
        alert('请先添加活动到计划中');
        return;
    }

    // Set date
    elPrintDate.textContent = formatDateChinese(elDate.value);

    // Build table
    elPrintTableBody.innerHTML = '';
    const times = calculateTimes();

    planItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        const taskText = item.note ? `${item.name}（${item.note}）` : item.name;
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${times[index].start} - ${times[index].end}</td>
            <td>${item.category}</td>
            <td class="task-cell">${item.icon} ${taskText}</td>
            <td>☐</td>
            <td></td>
        `;
        elPrintTableBody.appendChild(tr);
    });

    window.print();
}

// ===== 清空计划 =====
function clearPlan() {
    if (planItems.length === 0) return;
    if (!confirm('确定要清空所有计划吗？')) return;
    planItems = [];
    renderPlan();
}

// ===== 事件绑定 =====
function bindEvents() {
    // 开始时间变化 → 刷新计划时间
    elStartTime.addEventListener('change', renderPlan);

    // 分类筛选
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTemplates(btn.dataset.category);
        });
    });

    // 新建模版
    document.getElementById('btn-new-template').addEventListener('click', openNewTemplateModal);
    document.getElementById('modal-close-new').addEventListener('click', closeNewTemplateModal);
    document.getElementById('btn-cancel-new').addEventListener('click', closeNewTemplateModal);
    document.getElementById('btn-confirm-new').addEventListener('click', saveNewTemplate);

    // 编辑活动
    document.getElementById('modal-close-edit').addEventListener('click', closeEditModal);
    document.getElementById('btn-cancel-edit').addEventListener('click', closeEditModal);
    document.getElementById('btn-confirm-edit').addEventListener('click', saveEdit);

    // 打印
    document.getElementById('btn-print').addEventListener('click', preparePrint);

    // 清空
    document.getElementById('btn-clear-plan').addEventListener('click', clearPlan);

    // 点击遮罩关闭弹窗
    elModalNew.addEventListener('click', (e) => {
        if (e.target === elModalNew) closeNewTemplateModal();
    });
    elModalEdit.addEventListener('click', (e) => {
        if (e.target === elModalEdit) closeEditModal();
    });

    // ESC 关闭弹窗
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeNewTemplateModal();
            closeEditModal();
        }
    });
}

// ===== 启动 =====
init();
