
const express = require("express");

const router = express.Router();

const {
    createTask,
    getTasks,
    getAllTasks,
    getTaskCount,
    getRecentActivity,
    failTask,
    retryTask
} = require("./taskController");

// Create a new task
router.post("/", createTask);

// Get all tasks
router.get("/", getTasks);
// Get complete task history
router.get("/all", getAllTasks);
router.get("/count", getTaskCount);
router.get("/activity", getRecentActivity);
// Fail a task
router.patch("/:id/fail", failTask);
// Retry a failed task
router.patch("/:id/retry", retryTask);
module.exports = router;
