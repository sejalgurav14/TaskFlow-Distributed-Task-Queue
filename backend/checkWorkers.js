require("dotenv").config();

const pool = require("./db");

async function checkWorkers() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'workers'
            ORDER BY ordinal_position
        `);

        console.table(result.rows);

    } catch (error) {
        console.error(error);
    } finally {
        await pool.end();
    }
}

checkWorkers();