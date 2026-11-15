# TaskFlow – Distributed Task Queue Management System

## 1. Project Overview

TaskFlow is a web-based Distributed Task Queue Management System designed to manage and process multiple tasks efficiently.

The system uses a priority-based queue and multiple workers to execute tasks. It allows users to create tasks, monitor their progress, track worker activity, and handle failed tasks through a retry mechanism.

TaskFlow uses Redis and BullMQ for queue management, Node.js and Express.js for backend operations, and PostgreSQL for storing task information.

## 2. Objectives

- To understand the working of distributed task processing.
- To implement priority-based task scheduling.
- To manage multiple workers concurrently.
- To monitor task progress and status.
- To handle task failures and retry operations.
- To store task information in a database.

## 3. Technologies Used

| Technology | Purpose |
|---|---|
| HTML | Frontend structure |
| CSS | User interface and styling |
| JavaScript | Frontend functionality |
| Node.js | Backend runtime |
| Express.js | Backend API |
| Redis | Queue data storage |
| BullMQ | Task queue management |
| PostgreSQL | Database |
| Docker | Running Redis container |

## 4. Main Features

### Task Management
Users can create and manage tasks through the dashboard.

### Priority-Based Scheduling
Tasks are assigned priority levels:
- High
- Medium
- Low

High-priority tasks are processed before medium- and low-priority tasks when workers are available.

### Multiple Worker Management
The system uses three workers to process tasks concurrently.

### Progress Monitoring
Users can monitor the progress and current status of tasks.

### Failure and Retry
Failed tasks can be manually retried and added back to the queue.

### Dashboard and Analytics
The dashboard displays task statistics, worker information, and system activity.

### Activity History
The system records important task events, including task creation, processing, failure, and retry.

## 5. System Architecture

The system follows a distributed task-processing architecture.

1. The user creates a task through the frontend.
2. The frontend sends a request to the backend API.
3. The backend stores task information in PostgreSQL.
4. The task is added to the BullMQ queue.
5. Redis manages the queue.
6. Available workers fetch and process tasks.
7. Task progress and status are updated in PostgreSQL.
8. The frontend displays the latest task and worker information.

## 6. Project Structure

```text
TaskFlow/
│
├── backend/
│   ├── server.js
│   ├── taskController.js
│   ├── taskRoutes.js
│   ├── taskQueue.js
│   ├── taskWorker.js
│   ├── db.js
│   └── redis.js
│
├── css/
│   └── style.css
│
├── js/
│   └── script.js
│
├── index.html
└── README.md
```

## 7. Requirements

- Node.js and npm
- PostgreSQL
- Docker Desktop
- Redis
- Visual Studio Code or another code editor

## 8. How to Run the Project

### Step 1: Start Redis

Start Docker Desktop and make sure the Redis container is running.

If the container has already been created, start it using:

```bash
docker start taskflow-redis
```

### Step 2: Install Backend Dependencies

Open the terminal inside the backend folder:

```bash
cd backend
npm install
```

### Step 3: Configure Environment Variables

Create a `.env` file inside the backend folder and add the database and Redis configuration required by your project.

Do not upload this file to GitHub because it may contain private credentials.

### Step 4: Start the Backend Server

```bash
node server.js
```

The API server runs on port 5000.

### Step 5: Start the Workers

Open another terminal inside the backend folder:

```bash
node taskWorker.js
```

### Step 6: Open the Frontend

Open the `index.html` file using the VS Code Live Server extension.

The frontend can be accessed at:

```text
http://localhost:5500
```

## 9. Expected Outcome

TaskFlow provides a centralized dashboard to create, schedule, process, and monitor tasks. It demonstrates distributed task processing using multiple workers, priority scheduling, queue management, and failure recovery.

## 10. Future Enhancements

- User authentication and role management.
- Advanced task scheduling.
- Automatic worker recovery.
- Email notifications.
- Cloud deployment.
- Support for additional workers and distributed nodes.

## 11. Conclusion

TaskFlow demonstrates how distributed task queue systems can improve task processing and workload management. By combining Redis, BullMQ,