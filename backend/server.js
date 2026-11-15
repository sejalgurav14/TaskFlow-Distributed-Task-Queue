const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");
const taskRoutes = require("./taskRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/tasks", taskRoutes);
// Get all worker statuses
app.get("/api/workers", async (req, res) => {
    try {
        const result = await pool.query(
    `SELECT id, worker_name, status, current_task_id
     FROM workers
     ORDER BY id`
);

        res.json({
            success: true,
            workers: result.rows
        });

    } catch (error) {
        console.error("Worker fetch error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to fetch workers"
        });
    }
});

// Test route
app.get("/", (req, res) => {
    res.json({
        message: "TaskFlow Backend is running successfully!"
    });
});

// Database connection test
app.get("/api/db-test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            success: true,
            message: "PostgreSQL connected successfully!",
            databaseTime: result.rows[0].now
        });

    } catch (error) {
        console.error("Database connection failed:", error.message);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`TaskFlow server running on port ${PORT}`);
});