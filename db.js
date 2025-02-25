import dotenv from 'dotenv'; // โหลดค่าจาก .env
dotenv.config();

import mysql from 'mysql2/promise'; // เปลี่ยนเป็น promise-based interface

// ใช้ createPool เพื่อรองรับการเชื่อมต่อหลายครั้ง
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ทดสอบการเชื่อมต่อ
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to database');
    connection.release(); // ปล่อยการเชื่อมต่อกลับไปที่ pool
  } catch (err) {
    console.error('Database connection failed:', err.stack);
  }
})();

export default pool; // เปลี่ยนจาก connection เป็น pool