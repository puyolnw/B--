import express from 'express';
import pool from '../db.js'; // ใช้ pool สำหรับการเชื่อมต่อฐานข้อมูล

const router = express.Router();
const updateOverdueStatus = async () => {
  try {
    await pool.query(`
      UPDATE loan_payment_schedule 
      SET status = 'overdue' 
      WHERE due_date < CURDATE() 
      AND status = 'pending'
    `);
  } catch (error) {
    console.error('Error updating overdue status:', error);
  }
};

// Run this daily at midnight
setInterval(updateOverdueStatus, 24 * 60 * 60 * 1000);

// 1. API สำหรับเพิ่มข้อมูลสัญญากู้ยืม (CREATE)
// 1. API สำหรับเพิ่มข้อมูลสัญญากู้ยืม (CREATE)
router.post('/', async (req, res) => {
  try {
    console.log('Request Body:', req.body);

    const {
      title,
      first_name,
      last_name,
      address,
      birth_date,
      phone_number,
      id_card_number,
      guarantor_1_name,
      guarantor_2_name,
      committee_1_name,
      committee_2_name,
      bank_account_number,
      bank_name,
      loan_amount,
      interest_rate,
      installment_count,
    } = req.body;

    if (!title || !first_name || !last_name || !address || !birth_date || 
        !phone_number || !id_card_number || !loan_amount || !installment_count) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const principal = parseFloat(loan_amount);
    const interest = principal * (parseFloat(interest_rate || 5.0)) / 100;
    const totalAmount = principal + interest; // ยอดรวมที่ต้องชำระทั้งหมด

    const [result] = await pool.query(
      `INSERT INTO loan_contract (
        title, first_name, last_name, address, birth_date,
        phone_number, id_card_number, guarantor_1_name, guarantor_2_name,
        committee_1_name, committee_2_name, bank_account_number, bank_name,
        loan_amount, interest_rate, installment_count, total_paid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00)`,
      [
        title, first_name, last_name, address, birth_date,
        phone_number, id_card_number, guarantor_1_name, guarantor_2_name,
        committee_1_name, committee_2_name, bank_account_number, bank_name,
        loan_amount, interest_rate || 5.0, installment_count
      ]
    );;

    const loanContractId = result.insertId;
    const installmentAmount = totalAmount / parseInt(installment_count);

    const paymentSchedules = [];
    const today = new Date();
    let currentMonth = today.getMonth();
    let currentYear = today.getFullYear();

    if (today.getDate() > 25) {
      currentMonth += 1;
    }

    for (let i = 0; i < installment_count; i++) {
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear += 1;
      }

      const dueDate = new Date(currentYear, currentMonth, 25);
      paymentSchedules.push([
        loanContractId,
        dueDate.toISOString().split('T')[0],
        installmentAmount.toFixed(2),
        'pending',
      ]);

      currentMonth += 1;
    }

    await pool.query(
      `INSERT INTO loan_payment_schedule (loan_contract_id, due_date, amount, status) VALUES ?`,
      [paymentSchedules]
    );

    res.status(201).json({ message: 'เพิ่มข้อมูลสัญญากู้ยืมสำเร็จ', id: loanContractId });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูล' });
  }
});



// 2. API สำหรับดึงข้อมูลสัญญากู้ยืมทั้งหมด (READ)
router.get('/', async (req, res) => {
  try {
    // ใช้ COALESCE เพื่อให้ได้ค่า 0 เมื่อไม่มีข้อมูล
    // ตรวจสอบ alias ให้ตรงกับ frontend
    const [contracts] = await pool.query(`
      SELECT 
        lc.*,
        COALESCE(COUNT(lps.id), 0) AS paid_installments 
      FROM loan_contract lc
      LEFT JOIN loan_payment_schedule lps 
        ON lc.id = lps.loan_contract_id 
        AND lps.status = 'paid'
      GROUP BY lc.id
    `);

    // แปลงข้อมูลวันที่ให้อยู่ในรูปแบบ ISO String
    const formattedContracts = contracts.map(contract => ({
      ...contract,
      created_at: contract.created_at?.toISOString() || null
    }));

    res.json(formattedContracts);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

// 3. API สำหรับดึงข้อมูลสัญญากู้ยืมตาม ID (READ)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [contract] = await pool.query('SELECT * FROM loan_contract WHERE id = ?', [id]);

    if (contract.length === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลสัญญากู้ยืมนี้' });
    }

    res.json(contract[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});


// 4. API สำหรับแก้ไขข้อมูลสัญญากู้ยืม (UPDATE)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      first_name,
      last_name,
      address,
      birth_date,
      phone_number,
      id_card_number,
      guarantor_1_name,
      guarantor_2_name,
      committee_1_name,
      committee_2_name,
      bank_account_number,
      bank_name,
      loan_amount,
      interest_rate,
      installment_count,
    } = req.body;

    // อัปเดตข้อมูลในฐานข้อมูล
    const [result] = await pool.query(
      `UPDATE loan_contract SET
        title = ?,
        first_name = ?,
        last_name = ?,
        address = ?,
        birth_date = ?,
        phone_number = ?,
        id_card_number = ?,
        guarantor_1_name = ?,
        guarantor_2_name = ?,
        committee_1_name = ?,
        committee_2_name = ?,
        bank_account_number = ?,
        bank_name = ?,
        loan_amount = ?,
        interest_rate = ?,
        installment_count = ?
      WHERE id = ?`,
      [
        title,
        first_name,
        last_name,
        address,
        birth_date,
        phone_number,
        id_card_number,
        guarantor_1_name,
        guarantor_2_name,
        committee_1_name,
        committee_2_name,
        bank_account_number,
        bank_name,
        loan_amount,
        interest_rate,
        installment_count,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลสัญญากู้ยืมนี้' });
    }

    res.json({ message: 'แก้ไขข้อมูลสำเร็จ' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' });
  }
});

// 5. API สำหรับลบข้อมูลสัญญากู้ยืม (DELETE)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query('DELETE FROM loan_contract WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลสัญญากู้ยืมนี้' });
    }

    res.json({ message: 'ลบข้อมูลสำเร็จ' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
});

router.get('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const [payments] = await pool.query(
      `SELECT 
        due_date, 
        amount, 
        status 
      FROM loan_payment_schedule 
      WHERE loan_contract_id = ? 
      ORDER BY due_date`,
      [id]
    );
    res.json(payments);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

router.get('/:id/upcoming-payments', async (req, res) => {
  try {
    const [payments] = await pool.query(`
      SELECT 
        lps.*,
        lc.loan_amount,
        lc.remaining_balance
      FROM loan_payment_schedule lps
      JOIN loan_contract lc ON lps.loan_contract_id = lc.id
      WHERE lc.id = ? AND lps.status = 'pending'
      ORDER BY lps.due_date
      LIMIT 3
    `, [req.params.id]);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch upcoming payments' });
  }
});

// Add this route to handle loan repayments
router.post('/repayment', async (req, res) => {
  const { loan_contract_id, amount_paid, payment_date, payment_method } = req.body;
  
  try {
    await pool.query('START TRANSACTION');

    // Calculate date range for next 31 days
    const paymentDateTime = new Date(payment_date);
    const thirtyOneDaysLater = new Date(paymentDateTime);
    thirtyOneDaysLater.setDate(thirtyOneDaysLater.getDate() + 31);

    // Get all pending payments including overdue
    const [schedules] = await pool.query(
      `SELECT * FROM loan_payment_schedule 
       WHERE loan_contract_id = ? 
       AND status IN ('pending', 'overdue')
       ORDER BY due_date ASC`,
      [loan_contract_id]
    );

    let remainingPayment = parseFloat(amount_paid);

    // Process overdue payments first
    const overduePayments = schedules.filter(schedule => {
      const dueDate = new Date(schedule.due_date);
      return dueDate < paymentDateTime && schedule.status === 'overdue';
    });

    // Handle overdue payments
    for (const payment of overduePayments) {
      if (remainingPayment <= 0) break;

      const paymentAmount = parseFloat(payment.amount);
      if (remainingPayment >= paymentAmount) {
        await pool.query(
          'UPDATE loan_payment_schedule SET status = ?, amount = 0 WHERE id = ?',
          ['paid', payment.id]
        );
        remainingPayment -= paymentAmount;
      } else {
        const newAmount = paymentAmount - remainingPayment;
        await pool.query(
          'UPDATE loan_payment_schedule SET amount = ? WHERE id = ?',
          [newAmount, payment.id]
        );
        remainingPayment = 0;
      }
    }

    // If there's remaining payment, process upcoming payments (within 31 days)
    if (remainingPayment > 0) {
      const upcomingPayments = schedules.filter(schedule => {
        const dueDate = new Date(schedule.due_date);
        return dueDate <= thirtyOneDaysLater && schedule.status === 'pending';
      });

      for (const payment of upcomingPayments) {
        if (remainingPayment <= 0) break;

        const paymentAmount = parseFloat(payment.amount);
        if (remainingPayment >= paymentAmount) {
          await pool.query(
            'UPDATE loan_payment_schedule SET status = ?, amount = 0 WHERE id = ?',
            ['paid', payment.id]
          );
          remainingPayment -= paymentAmount;
        } else {
          const newAmount = paymentAmount - remainingPayment;
          await pool.query(
            'UPDATE loan_payment_schedule SET amount = ? WHERE id = ?',
            [newAmount, payment.id]
          );
          remainingPayment = 0;
        }
      }
    }

    // If still remaining, process from last installment backwards
    if (remainingPayment > 0) {
      const otherPayments = schedules
        .filter(schedule => {
          const dueDate = new Date(schedule.due_date);
          return dueDate > thirtyOneDaysLater && schedule.status === 'pending';
        })
        .sort((a, b) => new Date(b.due_date) - new Date(a.due_date));

      for (const payment of otherPayments) {
        if (remainingPayment <= 0) break;

        const paymentAmount = parseFloat(payment.amount);
        if (remainingPayment >= paymentAmount) {
          await pool.query(
            'UPDATE loan_payment_schedule SET status = ?, amount = 0 WHERE id = ?',
            ['paid', payment.id]
          );
          remainingPayment -= paymentAmount;
        } else {
          const newAmount = paymentAmount - remainingPayment;
          await pool.query(
            'UPDATE loan_payment_schedule SET amount = ? WHERE id = ?',
            [newAmount, payment.id]
          );
          remainingPayment = 0;
        }
      }
    }

    // Record payment
    await pool.query(
      `INSERT INTO loan_repayment (
        loan_contract_id, payment_date, amount_paid, payment_method
      ) VALUES (?, ?, ?, ?)`,
      [loan_contract_id, payment_date, amount_paid, payment_method]
    );

    // Update contract total
    await pool.query(
      `UPDATE loan_contract SET total_paid = total_paid + ? WHERE id = ?`,
      [amount_paid, loan_contract_id]
    );

    await pool.query('COMMIT');
    res.json({ 
      success: true, 
      message: 'บันทึกการชำระเงินเรียบร้อย',
      amount_paid: amount_paid
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Payment error:', error);
    res.status(500).json({ error: 'ไม่สามารถบันทึกการชำระเงินได้' });
  }
});




router.get('/:id/upcoming-payments', async (req, res) => {
  try {
    const [payments] = await pool.query(`
      SELECT 
        lps.*,
        lc.loan_amount,
        lc.remaining_balance
      FROM loan_payment_schedule lps
      JOIN loan_contract lc ON lps.loan_contract_id = lc.id
      WHERE lc.id = ? AND lps.status = 'pending'
      ORDER BY lps.due_date
      LIMIT 3
    `, [req.params.id]);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch upcoming payments' });
  }
});






router.get('/search', async (req, res) => {
  try {
    const [contracts] = await pool.query(`
      SELECT 
        lc.id,
        lc.first_name,
        lc.last_name,
        lc.loan_amount,
        lc.total_paid,
        lc.remaining_balance,
        COUNT(CASE WHEN lps.status = 'paid' THEN 1 END) as paid_installments,
        lc.installment_count
      FROM loan_contract lc
      LEFT JOIN loan_payment_schedule lps ON lc.id = lps.loan_contract_id
      GROUP BY lc.id
    `);
    res.json({ results: contracts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loan contracts' });
  }
});

router.get('/5/report', async (req, res) => {
  try {
    // Get monthly loan data (ยอดปล่อยกู้)
    const [monthlyLoans] = await db.query(`
      SELECT 
        DATE_FORMAT(loan_payment_schedule.due_date, '%Y-%m') as month,
        SUM(loan_contract.loan_amount) as loans
      FROM loan_contract
      JOIN loan_payment_schedule ON loan_contract.id = loan_payment_schedule.loan_contract_id 
      WHERE loan_payment_schedule.due_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(loan_payment_schedule.due_date, '%Y-%m')
      ORDER BY month ASC
    `);

    // Get monthly repayment data (ยอดชำระคืน)
    const [repayments] = await db.query(`
      SELECT 
        DATE_FORMAT(payment_date, '%Y-%m') as month,
        SUM(amount_paid) as repayments
      FROM loan_repayment
      WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
      ORDER BY month ASC
    `);

    const report = {
      monthlyLoans,
      repaymentData: repayments
    };

    res.json(report);
  } catch (error) {
    console.error('Error fetching loan report:', error);
    res.status(500).json({ error: 'Failed to fetch loan report' });
  }
});


export default router;