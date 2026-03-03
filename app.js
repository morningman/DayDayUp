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
const elModalEditTpl = document.getElementById('modal-edit-template');
const elModalDelete = document.getElementById('modal-confirm-delete');
const elModalEdit = document.getElementById('modal-edit-item');
const elModalSavedPlans = document.getElementById('modal-saved-plans');
const elModalSavePlan = document.getElementById('modal-save-plan');
const elSavedPlanList = document.getElementById('saved-plan-list');
const elSavedPlanEmpty = document.getElementById('saved-plan-empty');
const elModalCustomDialog = document.getElementById('modal-custom-dialog');

// 待删除模版 ID
let pendingDeleteId = null;

// ===== 通用自定义对话框 =====
function showDialog({ title = '提示', message = '', confirmText = '确定', cancelText = '取消', showCancel = false, danger = false } = {}) {
    return new Promise((resolve) => {
        const elTitle = document.getElementById('custom-dialog-title');
        const elMessage = document.getElementById('custom-dialog-message');
        const elConfirm = document.getElementById('btn-custom-dialog-confirm');
        const elCancel = document.getElementById('btn-custom-dialog-cancel');
        const elClose = document.getElementById('modal-close-custom-dialog');

        elTitle.textContent = title;
        elMessage.textContent = message;
        elConfirm.textContent = confirmText;
        elCancel.textContent = cancelText;
        elCancel.style.display = showCancel ? '' : 'none';

        // 切换危险样式
        if (danger) {
            elConfirm.className = 'btn btn-danger';
        } else {
            elConfirm.className = 'btn btn-confirm';
        }

        function cleanup(result) {
            elConfirm.removeEventListener('click', onConfirm);
            elCancel.removeEventListener('click', onCancel);
            elClose.removeEventListener('click', onCancel);
            elModalCustomDialog.removeEventListener('click', onOverlay);
            elModalCustomDialog.classList.remove('active');
            resolve(result);
        }

        function onConfirm() { cleanup(true); }
        function onCancel() { cleanup(false); }
        function onOverlay(e) { if (e.target === elModalCustomDialog) cleanup(false); }

        elConfirm.addEventListener('click', onConfirm);
        elCancel.addEventListener('click', onCancel);
        elClose.addEventListener('click', onCancel);
        elModalCustomDialog.addEventListener('click', onOverlay);

        elModalCustomDialog.classList.add('active');
    });
}

// 快捷方法：提示框（仅 OK）
function showAlert(message, title = '提示') {
    return showDialog({ title, message });
}

// 快捷方法：确认框（OK + 取消）
function showConfirm(message, { title = '确认', danger = false } = {}) {
    return showDialog({ title, message, showCancel: true, confirmText: '确定', danger });
}

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
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
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
        showAlert('保存模版失败，请检查服务器是否正常运行', '❌ 错误');
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
        showAlert('删除模版失败，请检查服务器是否正常运行', '❌ 错误');
    }
}

async function updateTemplateOnServer(tpl) {
    try {
        await fetch('/api/templates/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tpl),
        });
    } catch (e) {
        console.error('更新模版失败:', e);
        showAlert('更新模版失败，请检查服务器是否正常运行', '❌ 错误');
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
            <div class="template-actions">
                <button class="template-action-btn template-edit" data-id="${tpl.id}" title="编辑模版">✏️</button>
                <button class="template-action-btn template-copy" data-id="${tpl.id}" title="复制模版">📋</button>
                ${!tpl.isPreset ? `<button class="template-action-btn template-delete" data-id="${tpl.id}" title="删除模版">🗑️</button>` : ''}
            </div>
        `;

        // 点击添加到计划（排除操作按钮区域）
        card.addEventListener('click', (e) => {
            if (e.target.closest('.template-actions')) return;
            addToPlan(tpl);
        });

        // 编辑模版
        card.querySelector('.template-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditTemplateModal(tpl.id);
        });

        // 复制模版
        card.querySelector('.template-copy').addEventListener('click', (e) => {
            e.stopPropagation();
            copyTemplate(tpl.id);
        });

        // 删除自定义模版
        const delBtn = card.querySelector('.template-delete');
        if (delBtn) {
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                openDeleteModal(tpl.id);
            });
        }

        elTemplateList.appendChild(card);
    });
}

function openDeleteModal(id) {
    const tpl = allTemplates.find(t => t.id === id);
    if (!tpl) return;
    pendingDeleteId = id;
    document.getElementById('delete-tpl-name').textContent = tpl.name;
    elModalDelete.classList.add('active');
}

function closeDeleteModal() {
    elModalDelete.classList.remove('active');
    pendingDeleteId = null;
}

async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    allTemplates = allTemplates.filter(t => t.id !== id);
    await deleteTemplateFromServer(id);
    renderTemplates(getCurrentFilter());
    closeDeleteModal();
}

function getCurrentFilter() {
    const active = document.querySelector('.filter-btn.active');
    return active ? active.dataset.category : 'all';
}

// ===== 编辑模版弹窗 =====
function openEditTemplateModal(id) {
    const tpl = allTemplates.find(t => t.id === id);
    if (!tpl) return;
    document.getElementById('edit-tpl-id').value = tpl.id;
    document.getElementById('edit-tpl-name').value = tpl.name;
    document.getElementById('edit-tpl-duration').value = tpl.duration;
    document.getElementById('edit-tpl-category').value = tpl.category;
    document.getElementById('edit-tpl-icon').value = tpl.icon;
    document.getElementById('edit-tpl-desc').value = tpl.desc || '';
    elModalEditTpl.classList.add('active');
}

function closeEditTemplateModal() {
    elModalEditTpl.classList.remove('active');
}

async function saveEditTemplate() {
    const id = document.getElementById('edit-tpl-id').value;
    const name = document.getElementById('edit-tpl-name').value.trim();
    const duration = parseInt(document.getElementById('edit-tpl-duration').value) || 20;
    const category = document.getElementById('edit-tpl-category').value;
    const icon = document.getElementById('edit-tpl-icon').value.trim() || '📌';
    const desc = document.getElementById('edit-tpl-desc').value.trim();

    if (!name) {
        showAlert('请输入活动名称', '⚠️ 提示');
        return;
    }

    const tpl = allTemplates.find(t => t.id === id);
    if (!tpl) return;

    tpl.name = name;
    tpl.duration = Math.max(5, Math.min(120, duration));
    tpl.category = category;
    tpl.icon = icon;
    tpl.desc = desc;

    // 仅自定义模版同步到服务器
    if (!tpl.isPreset) {
        await updateTemplateOnServer(tpl);
    }

    renderTemplates(getCurrentFilter());
    closeEditTemplateModal();
}

async function copyTemplate(id) {
    const tpl = allTemplates.find(t => t.id === id);
    if (!tpl) return;

    const newTpl = {
        id: generateId(),
        name: tpl.name + '（副本）',
        duration: tpl.duration,
        category: tpl.category,
        icon: tpl.icon,
        desc: tpl.desc || '',
        isPreset: false,
    };

    allTemplates.push(newTpl);
    await saveCustomTemplate(newTpl);
    renderTemplates(getCurrentFilter());
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
                <div class="plan-name" contenteditable="true" data-index="${index}">${item.name}</div>
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

        // Inline edit plan name
        const nameEl = el.querySelector('.plan-name');
        nameEl.addEventListener('blur', () => {
            const newName = nameEl.textContent.trim();
            if (newName && newName !== planItems[index].name) {
                planItems[index].name = newName;
            } else {
                nameEl.textContent = planItems[index].name;
            }
        });
        nameEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
            if (e.key === 'Escape') { nameEl.textContent = planItems[index].name; nameEl.blur(); }
        });

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
        showAlert('请输入活动名称', '⚠️ 提示');
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
        showAlert('请先添加活动到计划中', '⚠️ 提示');
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

    // 先切换到打印布局，让 Chrome 正确计算页数
    document.body.classList.add('printing');

    const cleanup = () => {
        document.body.classList.remove('printing');
        window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    // 等待一帧让浏览器完成布局计算
    requestAnimationFrame(() => {
        window.print();
    });
}

// ===== 清空计划 =====
async function clearPlan() {
    if (planItems.length === 0) return;
    const ok = await showConfirm('确定要清空所有计划吗？', { title: '⚠️ 清空计划', danger: true });
    if (!ok) return;
    planItems = [];
    renderPlan();
}

// ===== 保存计划 =====
function openSavePlanModal() {
    if (planItems.length === 0) {
        showAlert('请先添加活动到计划中', '⚠️ 提示');
        return;
    }
    document.getElementById('save-plan-name').value = '';
    elModalSavePlan.classList.add('active');
    // 自动聚焦输入框
    setTimeout(() => document.getElementById('save-plan-name').focus(), 100);
}

function closeSavePlanModal() {
    elModalSavePlan.classList.remove('active');
}

async function confirmSavePlan() {
    const name = document.getElementById('save-plan-name').value.trim();
    if (!name) {
        showAlert('请输入计划名称', '⚠️ 提示');
        return;
    }

    const plan = {
        id: 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name,
        items: planItems.map(item => ({ ...item })),
        createdAt: new Date().toISOString(),
    };

    try {
        await fetch('/api/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plan),
        });
        closeSavePlanModal();
        showAlert('计划已保存！', '✅ 成功');
    } catch (e) {
        console.error('保存计划失败:', e);
        showAlert('保存计划失败，请检查服务器是否正常运行', '❌ 错误');
    }
}

// ===== 加载已保存计划 =====
async function openSavedPlansModal() {
    elModalSavedPlans.classList.add('active');
    await renderSavedPlans();
}

function closeSavedPlansModal() {
    elModalSavedPlans.classList.remove('active');
}

async function renderSavedPlans() {
    let plans = [];
    try {
        const res = await fetch('/api/plans');
        plans = await res.json();
    } catch (e) {
        console.error('加载已保存计划失败:', e);
    }

    // 清除旧的卡片（保留 empty 提示）
    const oldCards = elSavedPlanList.querySelectorAll('.saved-plan-card');
    oldCards.forEach(el => el.remove());

    elSavedPlanEmpty.style.display = plans.length === 0 ? 'block' : 'none';

    // 按创建时间倒序显示
    plans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    plans.forEach(plan => {
        const card = document.createElement('div');
        card.className = 'saved-plan-card';

        const itemCount = plan.items ? plan.items.length : 0;
        const totalMin = plan.items ? plan.items.reduce((sum, it) => sum + (it.duration || 0), 0) : 0;
        const dateStr = plan.createdAt ? new Date(plan.createdAt).toLocaleString('zh-CN') : '';

        card.innerHTML = `
            <div class="saved-plan-info">
                <div class="saved-plan-name">📋 ${plan.name}</div>
                <div class="saved-plan-meta">${itemCount} 项活动 · 共 ${totalMin} 分钟 · ${dateStr}</div>
            </div>
            <div class="saved-plan-actions">
                <button class="saved-plan-btn load-btn" title="加载此计划">加载</button>
                <button class="saved-plan-btn delete-btn" title="删除此计划">删除</button>
            </div>
        `;

        // 加载按钮
        card.querySelector('.load-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            loadSavedPlan(plan);
        });

        // 删除按钮
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSavedPlan(plan.id);
        });

        elSavedPlanList.appendChild(card);
    });
}

async function loadSavedPlan(plan) {
    if (planItems.length > 0) {
        const ok = await showConfirm('当前计划不为空，加载将覆盖当前计划，确定继续吗？', { title: '⚠️ 覆盖确认' });
        if (!ok) return;
    }
    planItems = plan.items.map(item => ({ ...item }));
    renderPlan();
    closeSavedPlansModal();
}

async function deleteSavedPlan(id) {
    const ok = await showConfirm('确定要删除这个已保存的计划吗？', { title: '⚠️ 删除计划', danger: true });
    if (!ok) return;
    try {
        await fetch('/api/plans/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        await renderSavedPlans();
    } catch (e) {
        console.error('删除计划失败:', e);
        showAlert('删除计划失败，请检查服务器是否正常运行', '❌ 错误');
    }
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

    // 编辑模版
    document.getElementById('modal-close-edit-tpl').addEventListener('click', closeEditTemplateModal);
    document.getElementById('btn-cancel-edit-tpl').addEventListener('click', closeEditTemplateModal);
    document.getElementById('btn-confirm-edit-tpl').addEventListener('click', saveEditTemplate);

    // 删除确认
    document.getElementById('modal-close-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-confirm-delete').addEventListener('click', confirmDelete);

    // 编辑活动
    document.getElementById('modal-close-edit').addEventListener('click', closeEditModal);
    document.getElementById('btn-cancel-edit').addEventListener('click', closeEditModal);
    document.getElementById('btn-confirm-edit').addEventListener('click', saveEdit);

    // 打印
    document.getElementById('btn-print').addEventListener('click', preparePrint);

    // 清空
    document.getElementById('btn-clear-plan').addEventListener('click', clearPlan);

    // 保存计划
    document.getElementById('btn-save-plan').addEventListener('click', openSavePlanModal);
    document.getElementById('modal-close-save-plan').addEventListener('click', closeSavePlanModal);
    document.getElementById('btn-cancel-save-plan').addEventListener('click', closeSavePlanModal);
    document.getElementById('btn-confirm-save-plan').addEventListener('click', confirmSavePlan);

    // 加载已保存计划
    document.getElementById('btn-load-plan').addEventListener('click', openSavedPlansModal);
    document.getElementById('modal-close-saved-plans').addEventListener('click', closeSavedPlansModal);
    document.getElementById('btn-close-saved-plans').addEventListener('click', closeSavedPlansModal);

    // 点击遮罩关闭弹窗
    elModalNew.addEventListener('click', (e) => {
        if (e.target === elModalNew) closeNewTemplateModal();
    });
    elModalEditTpl.addEventListener('click', (e) => {
        if (e.target === elModalEditTpl) closeEditTemplateModal();
    });
    elModalDelete.addEventListener('click', (e) => {
        if (e.target === elModalDelete) closeDeleteModal();
    });
    elModalEdit.addEventListener('click', (e) => {
        if (e.target === elModalEdit) closeEditModal();
    });

    // ESC 关闭弹窗
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeNewTemplateModal();
            closeEditTemplateModal();
            closeDeleteModal();
            closeEditModal();
            closeSavePlanModal();
            closeSavedPlansModal();
        }
    });

    // 点击遮罩关闭保存/加载弹窗
    elModalSavePlan.addEventListener('click', (e) => {
        if (e.target === elModalSavePlan) closeSavePlanModal();
    });
    elModalSavedPlans.addEventListener('click', (e) => {
        if (e.target === elModalSavedPlans) closeSavedPlansModal();
    });
}

// ===== 启动 =====
init();
