import express from 'express';
import pool from '../db.js'; // ใช้ pool สำหรับการเชื่อมต่อฐานข้อมูล

const router = express.Router();

// 1. API สำหรับเพิ่มข้อมูลสัญญากู้ยืม (CREATE)
// 1. API สำหรับเพิ่มข้อมูลสัญญากู้ยืม (CREATE)
router.post('/', async (req, res) => {
    try {
      console.log('Request Body:', req.body); // Debug ข้อมูลที่ได้รับจาก Client
  
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
  
      // ตรวจสอบว่าข้อมูลครบถ้วน
      if (
        !title ||
        !first_name ||
        !last_name ||
        !address ||
        !birth_date ||
        !phone_number ||
        !id_card_number ||
        !loan_amount ||
        !installment_count
      ) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
      }
  
      // เพิ่มข้อมูลลงในฐานข้อมูล
      const [result] = await pool.query(
        `INSERT INTO loan_contract (
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
          installment_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          interest_rate || 5.0, // ใช้ค่า Default 5% หากไม่ได้ระบุ
          installment_count,
        ]
      );
  
      const loanContractId = result.insertId; // ดึง ID ของ loan_contract ที่เพิ่งสร้าง
  
      // คำนวณจำนวนเงินที่ต้องจ่ายในแต่ละงวด
      const totalAmount = parseFloat(loan_amount) + (parseFloat(loan_amount) * (parseFloat(interest_rate) / 100));
      const installmentAmount = totalAmount / parseInt(installment_count);
  
      // สร้างตารางการจ่ายเงิน
      const paymentSchedules = [];
      const today = new Date();
  
      for (let i = 1; i <= installment_count; i++) {
        const dueDate = new Date(today);
        dueDate.setMonth(dueDate.getMonth() + i); // เพิ่มเดือนสำหรับแต่ละงวด
        paymentSchedules.push([loanContractId, dueDate.toISOString().split('T')[0], installmentAmount.toFixed(2), 'pending']);
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
    const [contracts] = await pool.query('SELECT * FROM loan_contract');
    res.json(contracts);
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

export default router;