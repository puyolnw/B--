import express from 'express';
import db from '../db.js';
const router = express.Router();

// Get all fund accounts
router.get('/', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM fund_account');
    res.json(results);
  } catch (err) {
    console.error('Error fetching fund accounts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get fund account by ID
router.get('/:id', async (req, res) => {
    try {
      const [results] = await db.query(
        'SELECT * FROM fund_account WHERE fund_account_id = ?',
        [req.params.id]
      );
      
      if (results.length === 0) {
        return res.status(404).json({ error: 'Fund account not found' });
      }
      
      res.json(results[0]);
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/4/report', async (req, res) => {
    try {
      // Get total loans and amounts
      const [totalStats] = await db.query(`
        SELECT 
          COUNT(*) as totalLoans,
          SUM(loan_amount) as totalAmount
        FROM loan_contract
        WHERE loan_c_status = 'active'
      `);
  
      // Get monthly loan data
      const [monthlyLoans] = await db.query(`
        SELECT 
          DATE_FORMAT(loan_payment_schedule.due_date, '%Y-%m') as month,
          SUM(loan_contract.loan_amount / loan_contract.installment_count) as loans
        FROM loan_contract
        JOIN loan_payment_schedule ON loan_contract.id = loan_payment_schedule.loan_contract_id 
        WHERE loan_payment_schedule.due_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND loan_payment_schedule.due_date <= CURDATE()
        GROUP BY DATE_FORMAT(loan_payment_schedule.due_date, '%Y-%m')
        ORDER BY month ASC
      `);
  
      // Get monthly repayment data
      const [repayments] = await db.query(`
        SELECT 
          DATE_FORMAT(payment_date, '%Y-%m') as month,
          SUM(amount_paid) as repayments
        FROM loan_repayment
        WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND payment_date <= CURDATE()
        GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
        ORDER BY month ASC
      `);
  
      // Format response
      const report = {
        totalLoans: totalStats[0].totalLoans,
        totalAmount: totalStats[0].totalAmount || 0,
        monthlyLoans: monthlyLoans,
        repaymentData: repayments
      };
  
      res.json(report);
    } catch (error) {
      console.error('Error fetching loan report:', error);
      res.status(500).json({ error: 'Failed to fetch loan report' });
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
