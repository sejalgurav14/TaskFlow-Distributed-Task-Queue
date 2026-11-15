
-- WORKERS TABLE
CREATE TABLE IF NOT EXISTS workers (
    id SERIAL PRIMARY KEY,
    worker_name VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'idle',
    current_task_id INTEGER
);

-- TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    task_name VARCHAR(255) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    worker_id INTEGER REFERENCES workers(id),
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- TASK EVENTS TABLE
CREATE TABLE IF NOT EXISTS task_events (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id),
    event_type VARCHAR(50) NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INSERT THREE WORKERS
INSERT INTO workers (worker_name)
VALUES
    ('Worker 01'),
    ('Worker 02'),
    ('Worker 03')
ON CONFLICT (worker_name) DO NOTHING;
