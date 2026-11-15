
require("dotenv").config();

const { Worker } = require("bullmq");
const pool = require("./db");
const redisConnection = require("./redis");

const workerNames = [
    "Worker 01",
    "Worker 02",
    "Worker 03"
];

let nextWorkerIndex = 0;

const delay = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

// Assign the next available worker using round-robin scheduling
async function assignAvailableWorker(taskId) {

    while (true) {

        for (let offset = 0; offset < workerNames.length; offset++) {

            const index =
                (nextWorkerIndex + offset) % workerNames.length;

            const result = await pool.query(
    `UPDATE workers
     SET status = 'busy',
         current_task_id = $2
     WHERE worker_name = $1
     AND status = 'idle'
     RETURNING id, worker_name, current_task_id`,
    [workerNames[index], taskId]
);

            if (result.rows.length > 0) {

                nextWorkerIndex = (index + 1) % workerNames.length;

                return result.rows[0];
            }
        }

        await delay(250);
    }
}

// BullMQ Worker
const taskWorker = new Worker(
    "taskflow-queue",

    async (job) => {

        const taskId = job.data.taskId;
        // Do not start a task that was already manually failed
const initialStatus = await pool.query(
    `SELECT status FROM tasks WHERE id = $1`,
    [taskId]
);

if (
    initialStatus.rows.length === 0 ||
    initialStatus.rows[0].status === "failed"
) {
    console.log(`Task ${taskId} is already failed. Skipping.`);
    return {
        success: false,
        cancelled: true,
        taskId
    };
}

        let workerId = null;
        let workerName = null;

        try {

            // Get an available worker
           const assignedWorker = await assignAvailableWorker(taskId);

            workerId = assignedWorker.id;
            workerName = assignedWorker.worker_name;

            console.log(`${workerName} started Task ${taskId}`);

            // Update task status
          // Start only if the task is still pending
const startResult = await pool.query(
    `UPDATE tasks
     SET status = 'running',
         worker_id = $1,
         started_at = CURRENT_TIMESTAMP,
         progress = 0
     WHERE id = $2
     AND status = 'pending'
     RETURNING id`,
    [workerId, taskId]
);

if (startResult.rows.length === 0) {
    console.log(`Task ${taskId} is no longer pending. Skipping.`);
    return {
        success: false,
        cancelled: true,
        taskId
    };
}

            // Record task event
            await pool.query(
                `INSERT INTO task_events
                 (task_id, event_type, message)
                 VALUES ($1, $2, $3)`,
                [taskId, "started",
                 `${workerName} started processing`]
            );

            // Simulate task processing
            // Simulate task processing
for (let progress = 10; progress <= 100; progress += 10) {

    await delay(2000);

    // Check whether the task was manually failed
    const statusResult = await pool.query(
        `SELECT status FROM tasks WHERE id = $1`,
        [taskId]
    );

    if (
        statusResult.rows.length === 0 ||
        statusResult.rows[0].status === "failed"
    ) {
        console.log(`Task ${taskId} was manually stopped`);

        return {
            success: false,
            cancelled: true,
            taskId
        };
    }

    await job.updateProgress(progress);

    await pool.query(
        `UPDATE tasks
         SET progress = $1
         WHERE id = $2
         AND status = 'running'`,
        [progress, taskId]
    );
}

            // Mark task completed
            await pool.query(
                `UPDATE tasks
                 SET status = 'completed',
                     progress = 100,
                     completed_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [taskId]
            );

            await pool.query(
                `INSERT INTO task_events
                 (task_id, event_type, message)
                 VALUES ($1, $2, $3)`,
                [taskId, "completed",
                 `${workerName} completed the task`]
            );

            console.log(`${workerName} completed Task ${taskId}`);

            return {
                success: true,
                taskId,
                workerName
            };

        } catch (error) {

            console.error(
                `Task ${taskId} processing error:`,
                error.message
            );

            // Check whether BullMQ will retry this job
            const maxAttempts = job.opts.attempts || 1;

            const willRetry =
                job.attemptsMade + 1 < maxAttempts;

            try {

                await pool.query(
                    `UPDATE tasks
                     SET status = $1
                     WHERE id = $2`,
                    [willRetry ? "pending" : "failed", taskId]
                );

                await pool.query(
                    `INSERT INTO task_events
                     (task_id, event_type, message)
                     VALUES ($1, $2, $3)`,
                    [
                        taskId,
                        willRetry ? "retrying" : "failed",
                        error.message
                    ]
                );

            } catch (dbError) {

                console.error(
                    "Database update error:",
                    dbError.message
                );
            }

            throw error;

        } finally {

            // Release worker after processing
            if (workerId !== null) {

                try {

                    await pool.query(
    `UPDATE workers
     SET status = 'idle',
         current_task_id = NULL
     WHERE id = $1`,
    [workerId]
);
                    console.log(`${workerName} is now idle`);

                } catch (releaseError) {

                    console.error(
                        "Worker release error:",
                        releaseError.message
                    );
                }
            }
        }
    },

    {
        connection: redisConnection,
        concurrency: 3
    }
);

// Event listeners
taskWorker.on("completed", job => {
    console.log(`Completed job ${job.id}`);
});

taskWorker.on("failed", (job, error) => {
    console.error(
        `Failed job ${job?.id}:`,
        error.message
    );
});

taskWorker.on("error", error => {
    console.error("Worker error:", error.message);
});

console.log("TaskFlow: Round-Robin scheduling enabled!");
console.log("Three workers are ready!");
