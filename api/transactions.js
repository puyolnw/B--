import express from 'express';
import pool from '../db.js';
const router = express.Router();


// 2. API สำหรับทำรายการฝากถอน
router.get('/transactions/:transactionId', async (req, res) => {
  const { transactionId } = req.params;

  try {
    // ใช้ pool.query เพื่อดึงข้อมูลจากฐานข้อมูล MySQL
    pool.query(
      'SELECT * FROM transactions WHERE transaction_id = ?',
      [transactionId], // ส่งค่าของ transactionId เป็น parameter
      (error, results) => {
        if (error) {
          console.error('Error fetching transaction details:', error);
          return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
        }

        // ตรวจสอบว่ามีข้อมูลหรือไม่
        if (results.length === 0) {
          return res.status(404).json({ message: 'ไม่พบข้อมูลธุรกรรม' });
        }

        // ส่งข้อมูลธุรกรรมที่พบ
        const transaction = results[0];
        return res.status(200).json(transaction);
      }
    );
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

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

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deposit, withdrawal, transaction_date, transaction_time } = req.body;
    
    // Get current transaction
    const [currentTransaction] = await pool.query(
      'SELECT * FROM transaction WHERE transaction_id = ?',
      [id]
    );

    if (currentTransaction.length === 0) {
      return res.status(404).json({ message: 'ไม่พบรายการธุรกรรม' });
    }

    // Calculate balance adjustment
    const oldAmount = currentTransaction[0].deposit || -currentTransaction[0].withdrawal;
    const newAmount = deposit || -withdrawal;
    const balanceAdjustment = newAmount - oldAmount;

    // Update transaction
    await pool.query(
      'UPDATE transaction SET deposit = ?, withdrawal = ?, transaction_date = ?, transaction_time = ?, t_balance = t_balance + ? WHERE transaction_id = ?',
      [deposit || 0, withdrawal || 0, transaction_date, transaction_time, balanceAdjustment, id]
    );

    // Update account balance
    await pool.query(
      'UPDATE account1 SET balance = balance + ? WHERE account_number = ?',
      [balanceAdjustment, currentTransaction[0].account_number]
    );

    res.json({ message: 'อัพเดทรายการสำเร็จ' });
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัพเดทรายการ' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get transaction before deletion
    const [transaction] = await pool.query(
      'SELECT * FROM transaction WHERE transaction_id = ?',
      [id]
    );

    if (transaction.length === 0) {
      return res.status(404).json({ message: 'ไม่พบรายการธุรกรรม' });
    }

    // Reverse the transaction amount in account balance
    const reverseAmount = transaction[0].deposit ? -transaction[0].deposit : transaction[0].withdrawal;
    await pool.query(
      'UPDATE account1 SET balance = balance + ? WHERE account_number = ?',
      [reverseAmount, transaction[0].account_number]
    );

    // Delete the transaction
    await pool.query('DELETE FROM transaction WHERE transaction_id = ?', [id]);

    res.json({ message: 'ลบรายการสำเร็จ' });
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบรายการ' });
  }
});

export default router;
