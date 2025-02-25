import express from 'express';
import bcrypt from 'bcrypt';
import db from '../db.js'; // เชื่อมต่อกับฐานข้อมูล
const router = express.Router();

// GET: ดึงข้อมูลผู้ใช้ทั้งหมด
router.get('/', (req, res) => {
  db.query('SELECT * FROM user', (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json(results);
  });
});

// GET: ดึงข้อมูลผู้ใช้ตาม ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM user WHERE user_id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error fetching user by ID:', err);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(results[0]);
  });
});

// POST: เพิ่มผู้ใช้ใหม่
router.post('/', async (req, res) => {
  const { username, password, role } = req.body;

  // ตรวจสอบข้อมูลที่ส่งมา
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10); // เข้ารหัสรหัสผ่าน
    const query = 'INSERT INTO user (username, password, role) VALUES (?, ?, ?)';
    const values = [username, hashedPassword, role || 'member'];

    db.query(query, values, (err, results) => {
      if (err) {
        console.error('Error creating user:', err);
        return res.status(500).json({ error: 'Failed to create user' });
      }
      res.status(201).json({ message: 'User created successfully', user_id: results.insertId });
    });
  } catch (err) {
    console.error('Error hashing password:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT: อัปเดตข้อมูลผู้ใช้
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;

  try {
    let query = 'UPDATE user SET ';
    const values = [];

    // ตรวจสอบว่ามีการส่งค่ามาอัปเดตอะไรบ้าง
    if (username) {
      query += 'username = ?, ';
      values.push(username);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10); // เข้ารหัสรหัสผ่านใหม่
      query += 'password = ?, ';
      values.push(hashedPassword);
    }
    if (role) {
      query += 'role = ?, ';
      values.push(role);
    }

    query = query.slice(0, -2); // ลบคอมม่า (,) สุดท้าย
    query += ' WHERE user_id = ?';
    values.push(id);

    db.query(query, values, (err, results) => {
      if (err) {
        console.error('Error updating user:', err);
        return res.status(500).json({ error: 'Failed to update user' });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ message: 'User updated successfully' });
    });
  } catch (err) {
    console.error('Error hashing password:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE: ลบผู้ใช้
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM user WHERE user_id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  });
});

export default router;