
const pool = require("./db");
const taskQueue = require("./taskQueue");

// CREATE TASK
const createTask = async (req, res) => {
    try {
        const { task_name, priority } = req.body;

        if (!task_name || !priority) {
            return res.status(400).json({
                success: false,
                message: "Task name and priority are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO tasks (task_name, priority)
             VALUES ($1, $2)
             RETURNING *`,
            [task_name, priority]
        );

        const task = result.rows[0];

        await pool.query(
            `INSERT INTO task_events (task_id, event_type, message)
             VALUES ($1, $2, $3)`,
            [task.id, "submitted", "New task submitted"]
        );
        const priorityMap = {
    High: 1,
    Medium: 2,
    Low: 3
};

await taskQueue.add(
    "process-task",
    { taskId: task.id },
    {
        priority: priorityMap[priority],
        jobId: `task-${task.id}`
    }
);

        res.status(201).json({
            success: true,
            message: "Task created successfully",
            task
        });

    } catch (error) {
        console.error("Create task error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to create task"
        });
    }
};

// GET RECENT 15 TASKS
const getTasks = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT tasks.*, workers.worker_name
             FROM tasks
             LEFT JOIN workers ON tasks.worker_id = workers.id
             ORDER BY tasks.created_at DESC
             LIMIT 15`
        );

        res.json({
            success: true,
            tasks: result.rows
        });

    } catch (error) {
        console.error("Get tasks error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve tasks"
        });
    }
};

// GET ALL TASKS (COMPLETE HISTORY)
const getAllTasks = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT tasks.*, workers.worker_name
             FROM tasks
             LEFT JOIN workers ON tasks.worker_id = workers.id
             ORDER BY tasks.created_at DESC`
        );

        res.json({
            success: true,
            tasks: result.rows
        });

    } catch (error) {
        console.error("Get all tasks error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve all tasks"
        });
    }
};

const getTaskCount = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending,
                COUNT(*) FILTER (WHERE status = 'running') AS running,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed
            FROM tasks
        `);

        res.json({
            success: true,
            totalTasks: Number(result.rows[0].total),
            pendingTasks: Number(result.rows[0].pending),
            runningTasks: Number(result.rows[0].running),
            completedTasks: Number(result.rows[0].completed)
        });

    } catch (error) {
        console.error("Error fetching task statistics:", error);
        res.status(500).json({
            success: false,
            message: "Unable to fetch task statistics"
        });
    }
};
const getRecentActivity = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                task_id,
                event_type,
                message,
                created_at
            FROM task_events
            ORDER BY created_at DESC
            LIMIT 20
        `);

        res.json({
            success: true,
            activities: result.rows
        });

    } catch (error) {
        console.error("Error fetching activity:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch recent activity"
        });
    }
};

// FAIL TASK
const failTask = async (req, res) => {
    try {
        const taskId = Number(req.params.id);

        const result = await pool.query(
            `UPDATE tasks
             SET status = 'failed'
             WHERE id = $1
             AND status IN ('pending', 'running')
             RETURNING *`,
            [taskId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Task cannot be failed"
            });
        }

        await pool.query(
            `INSERT INTO task_events (task_id, event_type, message)
             VALUES ($1, $2, $3)`,
            [taskId, "failed", "Task manually stopped"]
        );

        res.json({
            success: true,
            message: "Task marked as failed"
        });

    } catch (error) {
        console.error("Fail task error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to stop task"
        });
    }
};

// RETRY TASK
const retryTask = async (req, res) => {
    try {
        const taskId = Number(req.params.id);

        const result = await pool.query(
            `UPDATE tasks
             SET status = 'pending',
                 progress = 0,
                 worker_id = NULL,
                 started_at = NULL,
                 completed_at = NULL
             WHERE id = $1
             AND status = 'failed'
             RETURNING *`,
            [taskId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Only failed tasks can be retried"
            });
        }

        const task = result.rows[0];

        const priorityMap = {
            High: 1,
            Medium: 2,
            Low: 3
        };

        await taskQueue.add(
            "process-task",
            { taskId },
            {
                priority: priorityMap[task.priority],
                jobId: `task-${taskId}-retry-${Date.now()}`
            }
        );

        await pool.query(
            `INSERT INTO task_events (task_id, event_type, message)
             VALUES ($1, $2, $3)`,
            [taskId, "retrying", "Task manually added to retry queue"]
        );

        res.json({
            success: true,
            message: "Task added to retry queue"
        });

    } catch (error) {
        console.error("Retry task error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to retry task"
        });
    }
};
module.exports = {
    createTask,
    getTasks,
    getAllTasks,
    getTaskCount,
    getRecentActivity,
   failTask,
retryTask
};