import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csurf from 'csurf';
import cookieParser from 'cookie-parser';
import path from 'path'; // เพิ่มสำหรับ static files

// Routes
import userRoutes from './api/user.js';
import loginRoutes from './api/login.js';
import membersRoutes from './api/members.js';
import accountRouter from './api/account-1.js';
import transactionsRouter from './api/transactions.js';
import loanRouter from './api/loan.js';
import fundRouter from './api/fund-account.js';

dotenv.config(); // โหลด .env ก่อนใช้ process.env

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(express.json()); // Parse JSON bodies
app.use(cookieParser()); // จำเป็นสำหรับ csurf ต้องมาก่อน csurf

// CORS configuration
const allowedOrigins = [process.env.FRONT]; // Default ถ้า FRONT ไม่มีค่า
app.use(cors({
  origin: (origin, callback) => {
    // console.log('Request Origin:', origin); // Debug
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Rate limiting (เฉพาะ /api/login)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 100, // 100 คำขอต่อ IP
  message: 'Too many requests from this IP, please try again later.',
});

// CSRF protection
const csrfProtection = csurf({ cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production' } });
app.use(csrfProtection);
app.use((req, res, next) => {
  res.cookie('XSRF-TOKEN', req.csrfToken());
  next();
});

// Static files with path traversal protection
app.use('/uploads', (req, res, next) => {
  const filePath = path.join(__dirname, 'public/uploads', req.path);
  if (!filePath.startsWith(path.join(__dirname, 'public/uploads'))) {
    return res.status(403).send('Access denied');
  }
  next();
}, express.static('public/uploads'));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/login', limiter, loginRoutes); // ใช้ limiter เฉพาะ login
app.use('/api/members', membersRoutes);
app.use('/api/accounts', accountRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/loan', loanRouter);
app.use('/api/fundaccount', fundRouter);

app.get('/', (req, res) => {
  res.send('Welcome to the API');
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3301;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

export default app;