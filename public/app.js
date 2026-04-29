lucide.createIcons();

let tasks = [];
let isSyncing = false;
let editingTaskId = null;

const syncStatus = document.getElementById('syncStatus');
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;
const addTaskBtn = document.getElementById('addTaskBtn');
const taskPriority = document.getElementById('taskPriority');
const taskDescription = document.getElementById('taskDescription');

const savedTheme = localStorage.getItem('agent-tasks-theme') || 'dark';
html.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('agent-tasks-theme', newTheme);
});

// Image Paste Handling (Event Delegation for all textareas)
document.addEventListener('paste', async (e) => {
    if (e.target.tagName !== 'TEXTAREA') return;
    
    const textarea = e.target;
    const cd = e.clipboardData;
    if (!cd) return;

    // Try clipboardData.items first (Chrome/Edge)
    let imageFile = null;
    if (cd.items) {
        for (let i = 0; i < cd.items.length; i++) {
            if (cd.items[i].type.startsWith('image/')) {
                imageFile = cd.items[i].getAsFile();
                break;
            }
        }
    }
    // Fallback: clipboardData.files (Firefox, Snipping Tool edge cases)
    if (!imageFile && cd.files && cd.files.length > 0) {
        for (let i = 0; i < cd.files.length; i++) {
            if (cd.files[i].type.startsWith('image/')) {
                imageFile = cd.files[i];
                break;
            }
        }
    }

    if (!imageFile) return;
    e.preventDefault();

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const uploadingText = '![מעלה תמונה...]()\n';
    
    textarea.value = textarea.value.substring(0, startPos) + 
        uploadingText + 
        textarea.value.substring(endPos);
    
    try {
        // Convert to WebP client-side via canvas
        const bitmap = await createImageBitmap(imageFile);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        const webpBlob = await new Promise(r => canvas.toBlob(r, 'image/webp', 1.0));

        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/octet-stream',
                'X-File-Ext': 'webp' 
            },
            body: webpBlob
        });
        const data = await response.json();
        
        const mdImage = `![תמונה מצורפת](${data.url})\n`;
        textarea.value = textarea.value.replace(uploadingText, mdImage);
    } catch (err) {
        console.error('Image upload failed', err);
        textarea.value = textarea.value.replace(uploadingText, '[שגיאה בהעלאת תמונה]\n');
    }
});

async function fetchTasks() {
    if (isSyncing || editingTaskId) return;
    try {
        const res = await fetch('/api/tasks');
        const newTasks = await res.json();
        if (JSON.stringify(newTasks) !== JSON.stringify(tasks)) {
            tasks = newTasks;
            renderTasks();
        }
        setSyncStatus('synced');
    } catch (e) {
        console.error(e);
        setSyncStatus('error');
    }
}

async function saveTasks() {
    isSyncing = true;
    setSyncStatus('syncing');
    try {
        await fetch('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(tasks)
        });
        setSyncStatus('synced');
    } catch (e) {
        console.error(e);
        setSyncStatus('error');
    }
    isSyncing = false;
}

function setSyncStatus(status) {
    syncStatus.className = 'status-indicator ' + status;
    if (status === 'syncing') {
        syncStatus.innerHTML = '<i data-lucide="refresh-cw" class="spin"></i> שומר...';
    } else if (status === 'synced') {
        syncStatus.innerHTML = '<i data-lucide="check"></i> מעודכן';
    } else if (status === 'error') {
        syncStatus.innerHTML = '<i data-lucide="alert-triangle"></i> שגיאת חיבור';
    }
    lucide.createIcons();
}

addTaskBtn.addEventListener('click', async () => {
    const desc = taskDescription.value.trim();
    if (!desc) return alert('נא להזין משימה');

    const newTask = {
        id: Math.random().toString(36).substr(2, 9),
        content: desc,
        status: 'pending',
        priority: taskPriority.value
    };

    tasks.unshift(newTask);
    renderTasks();
    await saveTasks();

    taskDescription.value = '';
});

function toggleTaskStatus(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = task.status === 'done' ? 'pending' : 'done';
        renderTasks();
        saveTasks();
    }
}

function deleteTask(id) {
    if(!confirm('האם אתה בטוח שברצונך למחוק משימה זו?')) return;
    
    const task = tasks.find(t => t.id === id);
    if (task && task.content) {
        // Extract image filenames from markdown: ![...](images/filename.ext)
        const imgRegex = /!\[.*?\]\(images\/(.*?)\)/g;
        const filenames = [];
        let match;
        while ((match = imgRegex.exec(task.content)) !== null) {
            filenames.push(match[1]);
        }
        if (filenames.length > 0) {
            fetch('/api/delete-images', {
                method: 'POST',
                body: JSON.stringify({ filenames })
            }).catch(err => console.error('Failed to delete images', err));
        }
    }
    
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
    saveTasks();
}

function startEditTask(id) {
    editingTaskId = id;
    renderTasks();
}

function cancelEditTask() {
    editingTaskId = null;
    renderTasks();
}

async function saveEditTask(id, card) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newPriority = card.querySelector('.edit-priority').value;
    const newDesc = card.querySelector('.edit-desc').value.trim();

    if (!newDesc) {
        alert('המשימה לא יכולה להיות ריקה');
        return;
    }

    task.priority = newPriority;
    task.content = newDesc;
    
    editingTaskId = null;
    renderTasks();
    await saveTasks();
}

function renderTasks() {
    const lists = {
        'Urgent': document.getElementById('list-Urgent'),
        'High': document.getElementById('list-High'),
        'Normal': document.getElementById('list-Normal'),
        'Done': document.getElementById('list-Done')
    };

    Object.values(lists).forEach(l => l.innerHTML = '');

    const template = document.getElementById('task-template');

    tasks.forEach(task => {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.task-card');
        const viewMode = clone.querySelector('.task-view');
        const editMode = clone.querySelector('.task-edit');
        
        if (task.status === 'done') card.classList.add('done');
        
        const checkbox = clone.querySelector('.task-checkbox');
        checkbox.checked = task.status === 'done';
        checkbox.addEventListener('change', () => toggleTaskStatus(task.id));

        const delBtn = clone.querySelector('.delete-btn');
        delBtn.addEventListener('click', () => deleteTask(task.id));

        const editBtn = clone.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => startEditTask(task.id));

        const bodyEl = clone.querySelector('.task-body');
        const descText = task.content || '';
        
        if (descText && descText.trim() !== '') {
            bodyEl.innerHTML = marked.parse(descText);
        } else {
            bodyEl.style.display = 'none';
        }

        if (editingTaskId === task.id) {
            viewMode.style.display = 'none';
            editMode.style.display = 'block';

            clone.querySelector('.edit-priority').value = task.priority;
            clone.querySelector('.edit-desc').value = descText;

            clone.querySelector('.cancel-edit-btn').addEventListener('click', () => cancelEditTask());
            clone.querySelector('.save-edit-btn').addEventListener('click', () => saveEditTask(task.id, card));
        }

        // Done tasks go to the Done section
        const targetList = task.status === 'done' 
            ? lists['Done'] 
            : (lists[task.priority] || lists['Normal']);
        targetList.appendChild(clone);
    });

    lucide.createIcons();
}

fetchTasks();
setInterval(fetchTasks, 3000);
