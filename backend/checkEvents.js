const pool = require("./db");

async function checkEvents() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'task_events'
            ORDER BY ordinal_position
        `);

        console.log("Task Events Table Columns:");
        console.table(result.rows);

    } catch (error) {
        console.error(error.message);
    } finally {
        await pool.end();
    }
}

checkEvents();