import express from 'express';
import db from '../db.js'; // ใช้ db ที่เป็น promise-based
const router = express.Router();

// GET: ดึงข้อมูลสมาชิกทั้งหมด
router.get('/', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM members');
    res.json(results);
  } catch (err) {
    console.error('Error fetching members:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// GET: ดึงข้อมูลสมาชิกตาม ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await db.query('SELECT * FROM members WHERE member_id = ?', [id]);
    if (results.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(results[0]);
  } catch (err) {
    console.error('Error fetching member:', err);
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// POST: เพิ่มสมาชิกใหม่
router.post('/', async (req, res) => {
  const {
    id_card_number,
    full_name,
    birth_date,
    gender,
    house_code,
    address,
    phone_number,
    marital_status,
    has_account,
    created_by, // เพิ่ม created_by เพื่อรับค่าผู้ทำรายการ
  } = req.body;

  if (!id_card_number || !full_name) {
    return res.status(400).json({ error: 'ID card number and full name are required' });
  }

  const connection = await db.getConnection(); // ใช้ connection จาก pool
  try {
    await connection.beginTransaction();

    const memberQuery = `
      INSERT INTO members (
        id_card_number, full_name, birth_date, gender, 
        house_code, address, phone_number, marital_status, has_account
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [memberResults] = await connection.query(memberQuery, [
      id_card_number,
      full_name,
      birth_date,
      gender,
      house_code,
      address,
      phone_number,
      marital_status,
      has_account || 0,
    ]);

    const accountQuery = `
      INSERT INTO account1 (
        account_name,
        account_number,
        created_by
      ) VALUES (?, ?, ?)
    `;
    const [accountResults] = await connection.query(accountQuery, [
      full_name,
      id_card_number,
      created_by,
    ]);

    await connection.commit();
    res.status(201).json({
      message: 'Member and account created successfully',
      member_id: memberResults.insertId,
      account_id: accountResults.insertId,
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error creating member and account:', err);
    res.status(500).json({ error: 'Failed to create member and account' });
  } finally {
    connection.release();
  }
});

// PUT: อัปเดตข้อมูลสมาชิก
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    id_card_number,
    full_name,
    birth_date,
    gender,
    house_code,
    address,
    phone_number,
    marital_status,
    has_account,
  } = req.body;

  let query = 'UPDATE members SET ';
  const updates = [];
  const values = [];

  if (id_card_number) {
    updates.push('id_card_number = ?');
    values.push(id_card_number);
  }
  if (full_name) {
    updates.push('full_name = ?');
    values.push(full_name);
  }
  if (birth_date) {
    updates.push('birth_date = ?');
    values.push(birth_date);
  }
  if (gender) {
    updates.push('gender = ?');
    values.push(gender);
  }
  if (house_code) {
    updates.push('house_code = ?');
    values.push(house_code);
  }
  if (address) {
    updates.push('address = ?');
    values.push(address);
  }
  if (phone_number) {
    updates.push('phone_number = ?');
    values.push(phone_number);
  }
  if (marital_status) {
    updates.push('marital_status = ?');
    values.push(marital_status);
  }
  if (has_account !== undefined) {
    updates.push('has_account = ?');
    values.push(has_account);
  }

  query += updates.join(', ');
  query += ' WHERE member_id = ?';
  values.push(id);

  try {
    const [results] = await db.query(query, values);
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json({ message: 'Member updated successfully' });
  } catch (err) {
    console.error('Error updating member:', err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE: ลบสมาชิก
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await db.query('DELETE FROM members WHERE member_id = ?', [id]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json({ message: 'Member deleted successfully' });
  } catch (err) {
    console.error('Error deleting member:', err);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

export default router;