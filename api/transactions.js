import express from 'express';
import pool from '../db.js';
const router = express.Router();


// 2. API สำหรับทำรายการฝากถอน
router.post('/', async (req, res) => {
  try {
    const {
      account_number,
      transaction_type,
      amount,
      by_user,
      channel
    } = req.body;

    if (!account_number || !transaction_type || !amount || !by_user || !channel) {
      throw new Error('กรุณากรอกข้อมูลให้ครบถ้วน');
    }

    // ตรวจสอบบัญชี
    const [account] = await pool.query(
      'SELECT * FROM account1 WHERE account_number = ?',
      [account_number]
    );

    if (account.length === 0) {
      throw new Error('ไม่พบบัญชีนี้ในระบบ');
    }

    let newBalance = parseFloat(account[0].balance);
    const transactionAmount = parseFloat(amount);

    if (transaction_type === 'withdrawal') {
      if (newBalance < transactionAmount) {
        throw new Error('ยอดเงินในบัญชีไม่เพียงพอ');
      }
      newBalance -= transactionAmount;
    } else if (transaction_type === 'deposit') {
      newBalance += transactionAmount;
    } else {
      throw new Error('ประเภทรายการไม่ถูกต้อง');
    }

    // บันทึกรายการธุรกรรม
    const [result] = await pool.query(
      `INSERT INTO transaction (
        account_number,
        transaction_date,
        transaction_time,
        by_user,
        channel,
        deposit,
        withdrawal,
        t_balance
      ) VALUES (?, CURDATE(), CURTIME(), ?, ?, ?, ?, ?)`,
      [
        account_number,
        by_user,
        channel,
        transaction_type === 'deposit' ? transactionAmount : 0,
        transaction_type === 'withdrawal' ? transactionAmount : 0,
        newBalance // บันทึกยอดคงเหลือหลังทำรายการ
      ]
    );

    // อัพเดทยอดเงินในบัญชี
    await pool.query(
      'UPDATE account1 SET balance = ? WHERE account_number = ?',
      [newBalance, account_number]
    );

    // ดึงข้อมูลรายการที่บันทึก
    const [transactionDetail] = await pool.query(
      `SELECT t.*, a.balance
       FROM transaction t
       JOIN account1 a ON t.account_number = a.account_number
       WHERE t.transaction_id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: 'บันทึกรายการสำเร็จ',
      transaction: transactionDetail[0]
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการทำรายการ'
    });
  }
});


// 3. API สำหรับดูประวัติการทำรายการทั้งหมด
router.get('/', async (req, res) => {
  try {
    const [transactions] = await pool.query(
      `SELECT 
         LPAD(t.transaction_id, 6, '0') AS transaction_id, 
         t.account_number, 
         t.transaction_date, 
         t.transaction_time, 
         t.by_user, 
         t.deposit, 
         t.withdrawal, 
         t.t_balance, 
         a.balance
       FROM transaction t
       JOIN account1 a ON t.account_number = a.account_number
       ORDER BY t.transaction_date DESC, t.transaction_time DESC`
    );
    res.json(transactions);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// 4. API สำหรับดูประวัติการทำรายการของบัญชี
router.get('/accounts/:accountNumber/transactions', async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const [transactions] = await pool.query(
      `SELECT t.*, a.balance
       FROM transaction t
       JOIN account1 a ON t.account_number = a.account_number
       WHERE t.account_number = ?
       ORDER BY t.transaction_date DESC, t.transaction_time DESC`,
      [accountNumber]
    );
    res.json(transactions);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch account transactions' });
  }
});


// 5. API สำหรับดูรายละเอียดรายการ
router.get('/:id', async (req, res) => {
  try {
    const [transaction] = await pool.query(
      `SELECT t.*, a.balance
       FROM transaction t
       JOIN account1 a ON t.account_number = a.account_number
       WHERE t.transaction_id = ?`,
      [req.params.id]
    );
    
    if (transaction.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(transaction[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction details' });
  }
});

export default router;
