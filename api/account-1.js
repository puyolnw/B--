import express from 'express';
import db from '../db.js';
const router = express.Router();

// GET: ดึงข้อมูลบัญชีทั้งหมด
router.get('/', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM account1');
    res.json(results);
  } catch (err) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// GET: ค้นหาบัญชีตามเลขบัญชี (เลขบัตรประชาชน)
router.get('/search', async (req, res) => {
  const searchTerm = req.query.term;

  try {
    if (!searchTerm) {
      const [results] = await db.query(`
        SELECT 
          account_id,
          account_name,
          account_number,
          balance,
          open_date,
          created_by,
          account_status
        FROM account1
      `);

      const formattedResults = results.map((row) => ({
        account_id: row.account_id,
        account_name: row.account_name,
        account_number: row.account_number,
        balance: row.balance.toString(),
        open_date: row.open_date,
        created_by: row.created_by,
        account_status: row.account_status || 'ปกติ',
      }));

      return res.json({
        success: true,
        results: formattedResults,
      });
    }

    const query = `
      SELECT 
        account_id,
        account_name,
        account_number,
        balance,
        open_date,
        created_by,
        account_status
      FROM account1
      WHERE account_name LIKE ?
      OR account_number LIKE ?
    `;
    const [results] = await db.query(query, [`%${searchTerm}%`, `%${searchTerm}%`]);

    const formattedResults = results.map((row) => ({
      account_id: row.account_id,
      account_name: row.account_name,
      account_number: row.account_number,
      balance: row.balance.toString(),
      open_date: row.open_date,
      created_by: row.created_by,
      account_status: row.account_status || 'ปกติ',
    }));

    res.json({
      success: true,
      results: formattedResults,
    });
  } catch (err) {
    console.error('Error searching accounts:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to search accounts',
    });
  }
});

// GET: ดึงข้อมูลบัญชีตาม ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await db.query('SELECT * FROM account1 WHERE account_id = ?', [id]);
    if (results.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(results[0]);
  } catch (err) {
    console.error('Error fetching account:', err);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// POST: สร้างบัญชีใหม่
router.post('/', async (req, res) => {
  const { account_name, account_number, balance, created_by } = req.body;

  if (!account_name || !account_number) {
    return res.status(400).json({ error: 'Account name and number are required' });
  }

  const query = `
    INSERT INTO account1 (
      account_name,
      account_number,
      balance,
      created_by
    ) VALUES (?, ?, ?, ?)
  `;

  const values = [account_name, account_number, balance || 0, created_by];

  try {
    const [results] = await db.query(query, values);
    res.status(201).json({
      message: 'Account created successfully',
      account_id: results.insertId,
    });
  } catch (err) {
    console.error('Error creating account:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PUT: อัพเดตข้อมูลบัญชี
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { account_name, account_number, balance, account_status } = req.body;

  let query = 'UPDATE account1 SET ';
  const updates = [];
  const values = [];

  if (account_name) {
    updates.push('account_name = ?');
    values.push(account_name);
  }
  if (account_number) {
    updates.push('account_number = ?');
    values.push(account_number);
  }
  if (balance !== undefined) {
    updates.push('balance = ?');
    values.push(balance);
  }
  if (account_status) {
    updates.push('account_status = ?');
    values.push(account_status);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  query += updates.join(', ');
  query += ' WHERE account_id = ?';
  values.push(id);

  try {
    const [results] = await db.query(query, values);
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ message: 'Account updated successfully' });
  } catch (err) {
    console.error('Error updating account:', err);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// DELETE: ลบบัญชี
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await db.query('DELETE FROM account1 WHERE account_id = ?', [id]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Error deleting account:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;