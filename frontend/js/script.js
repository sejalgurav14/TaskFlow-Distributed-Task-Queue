
// ============================================
// TASKFLOW - DISTRIBUTED TASK QUEUE
// Dashboard Functionality
// ============================================

// TASK DATA
// TASK DATA
const API_URL = "https://taskflow-backend-0nxf.onrender.com/api/tasks";
const WORKERS_API_URL = "https://taskflow-backend-0nxf.onrender.com/api/workers";
let tasks = [];
let taskCounter = 1;
let queueTimer = null;
// Recent activity records
let activityLog = [];

// ANALYTICS CHART VARIABLES
let throughputChart = null;
let taskDistributionChart = null;
let workerPerformanceChart = null;
let analyticsTasks = [];

// Three worker nodes
const workers = [
    { id: 1, name: "Worker 01", busy: false, taskId: null },
    { id: 2, name: "Worker 02", busy: false, taskId: null },
    { id: 3, name: "Worker 03", busy: false, taskId: null }
];

// Timing configuration
const PROCESSING_TIME = 30000;
const PROGRESS_INTERVAL = 300;

// DOM ELEMENTS
const newTaskButton = document.getElementById("newTaskButton");
const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");
const taskNameInput = document.getElementById("taskName");
const taskPriorityInput = document.getElementById("taskPriority");
const closeModalButton = document.getElementById("closeModal");
const cancelTaskButton = document.getElementById("cancelTask");

const detailsModal = document.getElementById("detailsModal");
const closeDetailsModal = document.getElementById("closeDetailsModal");

const taskTableBody = document.getElementById("taskTableBody");

const taskSearch = document.getElementById("taskSearch");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");

// ============================================
// HELPER FUNCTIONS
// ============================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}


function updateActivityFeed() {
    const feed = document.getElementById("activityFeed");

    if (!feed) return;

    if (activityLog.length === 0) {
        feed.innerHTML = `<p class="empty-message">No activity yet.</p>`;
        return;
    }

    feed.innerHTML = activityLog.slice(0, 15).map(item => `
        <div class="activity-item">
            <div class="activity-icon ${item.type}">
                ${item.icon}
            </div>

            <div class="activity-content">
                <p>${escapeHTML(item.message)}</p>
                <small>
                    Task #${item.taskId} · ${escapeHTML(item.time)}
                </small>
            </div>
        </div>
    `).join("");
}

function addHistory(task, message) {

    const now = new Date();

    // Keep existing task history
    task.history.push({
        message: message,
        time: now.toLocaleTimeString()
    });

    // Identify activity type
    let type = "submitted";
    let icon = "+";

    if (message.toLowerCase().includes("completed")) {
        type = "completed";
        icon = "✓";
    } else if (message.toLowerCase().includes("failed")) {
        type = "failed";
        icon = "!";
    } else if (message.toLowerCase().includes("retry")) {
        type = "retry";
        icon = "↻";
    } else if (message.toLowerCase().includes("started")) {
        type = "running";
        icon = "▶";
    }

    // Add newest activity first
   activityLog.unshift({ 
        taskId: task.id,
        message: message,
        time: now.toLocaleTimeString(),
        type: type,
        icon: icon
    });

    // Keep only the latest 15 activities
    activityLog = activityLog.slice(0, 15);

    updateActivityFeed();
}


function getTaskById(id) {
    return tasks.find(task => task.id === id);
}

function getWorkerById(id) {
    return workers.find(worker => worker.id === id);
}

function formatTime(date) {
    return date.toLocaleString();
}

// ============================================
// CREATE TASK MODAL
// ============================================

function openTaskModal() {
    taskModal.style.display = "flex";
    taskNameInput.focus();
}

function closeTaskModal() {
    taskModal.style.display = "none";
    taskForm.reset();
}

// ============================================
// CREATE NEW TASK
// ============================================


async function createTask(event) {
    event.preventDefault();

    const name = taskNameInput.value.trim();
    const priority = taskPriorityInput.value;

    if (!name) {
        alert("Please enter a task name.");
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                task_name: name,
                priority: priority
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Task creation failed");
        }

        await loadTasksFromBackend();

        closeTaskModal();

        alert("Task saved successfully!");

    } catch (error) {
        console.error("Task creation error:", error);
        alert("Unable to save task. Check whether the backend is running.");
    }
}

// ============================================
// SUBMISSION COOLDOWN
// ============================================

function startSubmissionCooldown() {
    let remainingTime = SUBMISSION_COOLDOWN / 1000;

    newTaskButton.disabled = true;
    newTaskButton.textContent = `Wait ${remainingTime}s`;

    const cooldownTimer = setInterval(() => {
        remainingTime--;

        if (remainingTime > 0) {
            newTaskButton.textContent = `Wait ${remainingTime}s`;
        } else {
            clearInterval(cooldownTimer);

            newTaskButton.disabled = false;
            newTaskButton.textContent = "+ New Task";
        }
    }, 1000);
}

// ============================================
// PRIORITY-BASED QUEUE PROCESSING
// ============================================

function processQueue() {

    const priorityOrder = {
        High: 1,
        Medium: 2,
        Low: 3
    };

    // Find all available workers
    const availableWorkers = workers.filter(
        worker => !worker.busy
    );

    // Find all pending tasks
    const pendingTasks = tasks
        .filter(task => task.status === "Pending")
        .sort((a, b) => {
            return priorityOrder[a.priority] - priorityOrder[b.priority]
                || a.id - b.id;
        });

    // Assign pending tasks to available workers
    for (const worker of availableWorkers) {

        if (pendingTasks.length === 0) {
            break;
        }

        const nextTask = pendingTasks.shift();

        assignTask(nextTask, worker);
    }

    // Refresh dashboard
    updateDashboard();
}

// ============================================
// ASSIGN TASK TO WORKER
// ============================================

function assignTask(task, worker) {
    task.status = "Running";
    task.workerId = worker.id;
    task.progress = 0;

    worker.busy = true;
    worker.taskId = task.id;

    addHistory(task, `${worker.name} started processing the task.`);

    // Update progress every 300 milliseconds.
    task.progressTimer = setInterval(() => {
        if (task.status !== "Running") {
            clearInterval(task.progressTimer);
            return;
        }

        task.progress += 2;

        if (task.progress > 100) {
            task.progress = 100;
        }

        updateDashboard();
    }, PROGRESS_INTERVAL);

    // Complete task after processing time.
    task.completionTimer = setTimeout(() => {
        completeTask(task, worker);
    }, PROCESSING_TIME);

    updateDashboard();
}

// ============================================
// COMPLETE TASK
// ============================================

function completeTask(task, worker) {
    if (task.status !== "Running") {
        return;
    }

    clearInterval(task.progressTimer);

    task.progress = 100;
    task.status = "Completed";
    task.completedAt = new Date();

    worker.busy = false;
    worker.taskId = null;

    addHistory(task, `${worker.name} completed the task successfully.`);

    updateDashboard();

    // Assign the next pending task.
    processQueue();
}

// ============================================
// FAIL TASK
// ============================================
// ============================================
// FAIL TASK
// ============================================

async function failTask(taskId) {
    const task = getTaskById(taskId);

    if (!task || task.status !== "Running") {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${taskId}/fail`, {
            method: "PATCH"
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            alert(data.message || "Unable to fail task.");
            return;
        }

        clearInterval(task.progressTimer);
        clearTimeout(task.completionTimer);

        const worker = getWorkerById(task.workerId);

        if (worker) {
            worker.busy = false;
            worker.taskId = null;
        }

        task.status = "Failed";
        addHistory(task, "Task manually stopped.");

        updateDashboard();

    } catch (error) {
        console.error("Fail task error:", error);
        alert("Unable to connect to the backend.");
    }
}


// ============================================
// RETRY FAILED TASK
// ============================================

async function retryTask(taskId) {
    const task = getTaskById(taskId);

    if (!task || task.status !== "Failed") {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${taskId}/retry`, {
            method: "PATCH"
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            alert(data.message || "Unable to retry task.");
            return;
        }

        task.status = "Pending";
        task.progress = 0;
        task.workerId = null;
        task.retryCount = (task.retryCount || 0) + 1;

        addHistory(
            task,
            `Task added to the queue for retry #${task.retryCount}.`
        );

        updateDashboard();

    } catch (error) {
        console.error("Retry task error:", error);
        alert("Unable to connect to the backend.");
    }
}
async function loadTasksFromBackend(showAll = false) {
    try {
        const response = await fetch(
    showAll ? `${API_URL}/all` : API_URL
);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error("Unable to load tasks");
        }

        tasks = data.tasks.map(item => ({
            id: item.id,
            name: item.task_name,
            priority: item.priority,
            status: item.status.charAt(0).toUpperCase() +
                    item.status.slice(1),
            workerId: item.worker_id,
            progress: item.progress,
            retryCount: item.retry_count,
            submittedAt: new Date(item.created_at),
            completedAt: item.completed_at
                ? new Date(item.completed_at)
                : null,
            history: [],
            progressTimer: null,
            completionTimer: null
        }));

        taskCounter = tasks.length > 0
            ? Math.max(...tasks.map(task => task.id)) + 1
            : 1;

        await loadWorkersFromBackend();
await loadAnalyticsTasks();
updateDashboard();
    } catch (error) {
        console.error("Loading tasks failed:", error);
    }
}
// LOAD COMPLETE TASK HISTORY FOR ANALYTICS
async function loadAnalyticsTasks() {
    try {
        const response = await fetch(`${API_URL}/all`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error("Unable to load analytics tasks");
        }

        analyticsTasks = data.tasks.map(item => ({
            id: item.id,
            name: item.task_name,
            priority: item.priority,
            status: item.status.charAt(0).toUpperCase() +
                    item.status.slice(1),
            workerId: item.worker_id,
            completedAt: item.completed_at
                ? new Date(item.completed_at)
                : null,
            submittedAt: new Date(item.created_at)
        }));

        console.log("Analytics task history loaded:", analyticsTasks.length);

    } catch (error) {
        console.error("Loading analytics data failed:", error);
    }
}
// ============================================
// UPDATE TASK TABLE
// ============================================

function updateTaskTable() {
    const searchText = taskSearch.value.toLowerCase();
    const selectedStatus = statusFilter.value;
    const selectedPriority = priorityFilter.value;

    const tasksToDisplay = showingAllTasks
    ? tasks
    : tasks.slice(0, 15);

const filteredTasks = tasksToDisplay.filter(task => {
        const matchesSearch =
            task.name.toLowerCase().includes(searchText) ||
            String(task.id).includes(searchText);

        const matchesStatus =
            selectedStatus === "All" ||
            task.status === selectedStatus;

        const matchesPriority =
            selectedPriority === "All" ||
            task.priority === selectedPriority;

        return matchesSearch && matchesStatus && matchesPriority;
    });

    if (filteredTasks.length === 0) {
        taskTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-message">
                    No matching tasks found.
                </td>
            </tr>
        `;
        return;
    }

    taskTableBody.innerHTML = filteredTasks.map(task => {
        let actionButtons = `
            <button class="task-action"
                data-action="details"
                data-id="${task.id}">
                Details
            </button>
        `;

        if (task.status === "Running") {
            actionButtons += `
                <button class="task-action fail-button"
                    data-action="fail"
                    data-id="${task.id}">
                    Fail
                </button>
            `;
        }

        if (task.status === "Failed") {
            actionButtons += `
                <button class="task-action retry-button"
                    data-action="retry"
                    data-id="${task.id}">
                    Retry
                </button>
            `;
        }

        const worker = task.workerId
            ? getWorkerById(task.workerId)?.name || "-"
            : "-";

        return `
            <tr>
                <td>
                    <strong>#${task.id}</strong>
                    ${escapeHTML(task.name)}
                    ${task.status === "Running"
                        ? `<div class="task-progress">
                               <div class="task-progress-track">
                                   <div class="task-progress-fill"
                                       style="width:${task.progress}%">
                                   </div>
                               </div>
                               <small>${task.progress}%</small>
                           </div>`
                        : ""}
                </td>

                <td>
                    <span class="priority priority-${task.priority.toLowerCase()}">
                        ${task.priority}
                    </span>
                </td>

                <td>
                    <span class="status status-${task.status.toLowerCase()}">
                        ${task.status}
                    </span>
                </td>

                <td>${worker}</td>

                <td>${actionButtons}</td>
            </tr>
        `;
    }).join("");
}

// ============================================
// UPDATE STATISTICS
// ============================================

function updateStatistics() {
    const pending = tasks.filter(t => t.status === "Pending").length;
    const running = tasks.filter(t => t.status === "Running").length;
    const completed = tasks.filter(t => t.status === "Completed").length;

    document.getElementById("pendingTasks").textContent = pending;
    document.getElementById("runningTasks").textContent = running;
    document.getElementById("completedTasks").textContent = completed;

    loadTaskCount();
}
async function loadTaskCount() {
    try {
        const response = await fetch(`${API_URL}/count`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error("Unable to load task statistics");
        }

        document.getElementById("totalTasks").textContent =
            data.totalTasks;

        document.getElementById("pendingTasks").textContent =
            data.pendingTasks;

        document.getElementById("runningTasks").textContent =
            data.runningTasks;

        document.getElementById("completedTasks").textContent =
            data.completedTasks;

    } catch (error) {
        console.error("Loading task statistics failed:", error);
    }
}

async function loadWorkersFromBackend() {
    try {
        const response = await fetch(WORKERS_API_URL);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error("Unable to load workers");
        }

        data.workers.forEach(dbWorker => {
            const worker = workers.find(
                item => item.id === dbWorker.id
            );

            if (!worker) return;

            worker.busy = dbWorker.status === "busy";

            const activeTask = tasks.find(
                task =>
                    Number(task.workerId) === Number(dbWorker.id) &&
                    task.status === "Running"
            );

            worker.taskId = activeTask ? activeTask.id : null;
        });

    } catch (error) {
        console.error("Loading workers failed:", error);
    }
}

// ============================================
// UPDATE WORKER DISPLAY
// ============================================


function updateWorkers() {
    workers.forEach(worker => {
        const workerElement = document.querySelector(
            `.worker-item[data-worker="${worker.id}"]`
        );

        if (!workerElement) return;

        const statusElement = workerElement.querySelector(".worker-status");
        const infoElement = workerElement.querySelector(".worker-info");
        const smallElement = infoElement.querySelector("small");

        if (worker.busy) {
            statusElement.textContent = "Busy";
            statusElement.style.color = "var(--cyan)";
            statusElement.style.background = "#12364D";

            if (smallElement) {
    smallElement.textContent = worker.taskId
        ? `Processing Task #${worker.taskId}`
        : "Processing task...";
}
        } else {
            statusElement.textContent = "Idle";
            statusElement.style.color = "var(--teal)";
            statusElement.style.background = "#123D3C";

            if (smallElement) {
                smallElement.textContent = `Processing node 0${worker.id}`;
            }
        }
    });
}

async function loadWorkerStatuses() {
    try {
        const response = await fetch(WORKERS_API_URL);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error("Unable to load worker statuses");
        }

        data.workers.forEach(dbWorker => {
            const worker = workers.find(
                w => w.id === dbWorker.id
            );

            if (worker) {
    worker.busy =
        dbWorker.status.toLowerCase() !== "idle";

    worker.taskId = dbWorker.current_task_id;
}
        });

        updateWorkers();

    } catch (error) {
        console.error("Loading worker statuses failed:", error);
    }
}

// ============================================
// UPDATE ANALYTICS
// ============================================


function updateAnalytics() {

    const total = analyticsTasks.length;

const completed = analyticsTasks.filter(t => t.status === "Completed").length;
const pending = analyticsTasks.filter(t => t.status === "Pending").length;
const running = analyticsTasks.filter(t => t.status === "Running").length;
const failed = analyticsTasks.filter(t => t.status === "Failed").length;

    const finishedTasks = completed + failed;

    const successRate = finishedTasks > 0
        ? Math.round((completed / finishedTasks) * 100)
        : 0;

    const workerUtilization = Math.round(
        (workers.filter(worker => worker.busy).length / workers.length) * 100
    );

    // Update analytics statistics
    document.getElementById("analyticsFailed").textContent = failed;
    document.getElementById("successRate").textContent = `${successRate}%`;
    document.getElementById("workerUtilization").textContent =
        `${workerUtilization}%`;

    // Stop if Chart.js has not loaded
    if (typeof Chart === "undefined") {
        console.error("Chart.js is not loaded.");
        return;
    }

    // =====================================
    // 1. TASK THROUGHPUT - LINE GRAPH
    // =====================================

    const throughputCanvas = document.getElementById("throughputChart");

    const lastSevenDays = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        lastSevenDays.push({
            key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
            label: date.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short"
            })
        });
    }

    const throughputData = lastSevenDays.map(day => {
        return analyticsTasks.filter(task => {
            if (task.status !== "Completed" || !task.completedAt) {
                return false;
            }

            const completedDate = new Date(task.completedAt);

            if (isNaN(completedDate.getTime())) {
                return false;
            }

            const key = `${completedDate.getFullYear()}-${completedDate.getMonth()}-${completedDate.getDate()}`;

            return key === day.key;
        }).length;
    });

    if (!throughputChart) {

        throughputChart = new Chart(throughputCanvas, {
            type: "line",

            data: {
                labels: lastSevenDays.map(day => day.label),

                datasets: [{
                    label: "Completed Tasks",
                    data: throughputData,
                    borderColor: "#38BDF8",
                    backgroundColor: "rgba(56, 189, 248, 0.12)",
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: "#A78BFA",
                    pointBorderColor: "#FFFFFF",
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    }
                },

                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            color: "#8FA3BE"
                        },
                        grid: {
                            color: "rgba(143, 163, 190, 0.12)"
                        }
                    },

                    x: {
                        ticks: {
                            color: "#8FA3BE"
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

    } else {

        throughputChart.data.labels = lastSevenDays.map(day => day.label);
        throughputChart.data.datasets[0].data = throughputData;
        throughputChart.update();

    }


    // =====================================
    // 2. TASK DISTRIBUTION - DOUGHNUT
    // =====================================

    const distributionCanvas = document.getElementById("taskDistributionChart");

    const distributionData = [
        completed,
        pending,
        running,
        failed
    ];

    if (!taskDistributionChart) {

        taskDistributionChart = new Chart(distributionCanvas, {
            type: "doughnut",

            data: {
                labels: ["Completed", "Pending", "Running", "Failed"],

                datasets: [{
                    data: distributionData,

                    backgroundColor: [
                        "#38BDF8",
                        "#A78BFA",
                        "#2DD4BF",
                        "#F472B6"
                    ],

                    borderColor: "#111D30",
                    borderWidth: 5,
                    hoverOffset: 10
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",

                plugins: {
                    legend: {
                        position: "bottom",

                        labels: {
                            color: "#EDF4FF",
                            padding: 18,
                            usePointStyle: true,
                            pointStyle: "circle"
                        }
                    }
                }
            }
        });

    } else {

        taskDistributionChart.data.datasets[0].data = distributionData;
        taskDistributionChart.update();

    }


    // =====================================
    // 3. WORKER PERFORMANCE - BAR GRAPH
    // =====================================

    const workerCanvas = document.getElementById("workerPerformanceChart");

    const workerCompletedData = workers.map(worker => {

    return analyticsTasks.filter(task =>
        task.status === "Completed" &&
        task.workerId === worker.id
    ).length;

});

    if (!workerPerformanceChart) {

        workerPerformanceChart = new Chart(workerCanvas, {
            type: "bar",

            data: {
                labels: workers.map(worker => worker.name),

                datasets: [{
                    label: "Completed Tasks",
                    data: workerCompletedData,

                    backgroundColor: [
                        "#38BDF8",
                        "#A78BFA",
                        "#2DD4BF"
                    ],

                    borderRadius: 8,
                    borderSkipped: false,
                    barThickness: 45
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    }
                },

                scales: {
                    y: {
                        beginAtZero: true,

                        ticks: {
                            precision: 0,
                            color: "#8FA3BE"
                        },

                        grid: {
                            color: "rgba(143, 163, 190, 0.12)"
                        }
                    },

                    x: {
                        ticks: {
                            color: "#EDF4FF"
                        },

                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

    } else {

        workerPerformanceChart.data.datasets[0].data = workerCompletedData;
        workerPerformanceChart.update();

    }

}


// ============================================
// UPDATE COMPLETE DASHBOARD
// ============================================

function updateDashboard() {
    updateStatistics();
    updateTaskTable();
    updateWorkers();
    updateAnalytics();
}

// ============================================
// TASK DETAILS MODAL
// ============================================

function openTaskDetails(taskId) {
    const task = getTaskById(taskId);

    if (!task) return;

    document.getElementById("detailTaskId").textContent = `#${task.id}`;
    document.getElementById("detailTaskName").textContent = task.name;
    document.getElementById("detailPriority").textContent = task.priority;
    document.getElementById("detailStatus").textContent = task.status;

    const worker = task.workerId
        ? getWorkerById(task.workerId)?.name || "-"
        : "-";

    document.getElementById("detailWorker").textContent = worker;
    document.getElementById("detailRetries").textContent = task.retryCount;
    document.getElementById("detailSubmitted").textContent =
        formatTime(task.submittedAt);

    const historyContainer = document.getElementById("taskHistory");

    historyContainer.innerHTML = task.history.map(item => `
        <div class="history-item">
            <span>${escapeHTML(item.message)}</span>
            <small>${escapeHTML(item.time)}</small>
        </div>
    `).join("");

    detailsModal.style.display = "flex";
}

// ============================================
// TASK TABLE BUTTON EVENTS
// ============================================

taskTableBody.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const taskId = Number(button.dataset.id);
    const action = button.dataset.action;

    if (action === "details") {
        openTaskDetails(taskId);
    }

    if (action === "fail") {
        failTask(taskId);
    }

    if (action === "retry") {
        retryTask(taskId);
    }
});

// ============================================
// SEARCH AND FILTER EVENTS
// ============================================

taskSearch.addEventListener("input", updateTaskTable);
statusFilter.addEventListener("change", updateTaskTable);
priorityFilter.addEventListener("change", updateTaskTable);

// ============================================
// MODAL EVENTS
// ============================================

newTaskButton.addEventListener("click", openTaskModal);

closeModalButton.addEventListener("click", closeTaskModal);
cancelTaskButton.addEventListener("click", closeTaskModal);

taskForm.addEventListener("submit", createTask);

closeDetailsModal.addEventListener("click", function () {
    detailsModal.style.display = "none";
});

window.addEventListener("click", function (event) {
    if (event.target === taskModal) {
        closeTaskModal();
    }

    if (event.target === detailsModal) {
        detailsModal.style.display = "none";
    }
});

// ============================================
// VIEW ALL TASKS
// ============================================

let showingAllTasks = false;

document.getElementById("viewAllButton").addEventListener("click", async function () {

    showingAllTasks = !showingAllTasks;

    taskSearch.value = "";
    statusFilter.value = "All";
    priorityFilter.value = "All";

    await loadTasksFromBackend(showingAllTasks);

    this.textContent = showingAllTasks
        ? "Show Recent"
        : "View All";

    document.getElementById("tasks").scrollIntoView({
        behavior: "smooth"
    });
});

// ============================================
// SIDEBAR NAVIGATION
// ============================================

document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", function () {
        document.querySelectorAll(".nav-link").forEach(item => {
            item.classList.remove("active");
        });

        this.classList.add("active");
    });
});

// ============================================
// INITIALIZE DASHBOARD
// ============================================

// Load tasks when dashboard starts
loadTasksFromBackend();

// Automatically refresh task information every 2 seconds
// Automatically refresh task information every 2 seconds
setInterval(() => {
    loadTasksFromBackend(showingAllTasks);
    loadRecentActivity();
    loadWorkerStatuses();
}, 2000);

console.log("TaskFlow dashboard initialized successfully.");


async function loadRecentActivity() {
    const feed = document.getElementById("activityFeed");

    if (!feed) return;

    try {
        const response = await fetch(`${API_URL}/activity`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error("Unable to load recent activity");
        }

        if (data.activities.length === 0) {
            feed.innerHTML = `<p class="empty-message">No activity yet.</p>`;
            return;
        }

        feed.innerHTML = data.activities.map(item => {
           
let icon = "●";
let type = item.event_type;

if (item.event_type === "started") {
    icon = "▶";
    type = "running";
}

if (item.event_type === "completed") {
    icon = "✓";
    type = "completed";
}

if (item.event_type === "failed") {
    icon = "✕";
    type = "failed";
}

if (item.event_type === "retrying") {
    icon = "↻";
    type = "retry";
}

if (item.event_type === "submitted") {
    icon = "+";
    type = "submitted";
}


            const time = new Date(item.created_at).toLocaleTimeString();

            return `
                <div class="activity-item">
                    <div class="activity-icon ${type}">
                        ${icon}
                    </div>

                    <div class="activity-content">
                        <p>${escapeHTML(item.message)}</p>
                        <small>
                            Task #${item.task_id} · ${escapeHTML(time)}
                        </small>
                    </div>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Loading recent activity failed:", error);
    }
}
