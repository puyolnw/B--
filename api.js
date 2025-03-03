import express from 'express';
import cors from 'cors';
import userRoutes from './api/user.js';
import loginRoutes from './api/login.js';
import membersRoutes from './api/members.js';
import accountRouter from './api/account-1.js';
import transactionsRouter from './api/transactions.js';
import loanRouter from './api/loan.js';
import fundRouter from './api/fund-account.js';
const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json());

app.use('/uploads', express.static('public/uploads'));
app.use('/api/users', userRoutes);
app.use('/api/login', loginRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/accounts', accountRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/loan', loanRouter);
app.use('/api/fundaccount', fundRouter);

app.get('/', (req, res) => {
  res.send('Welcome to the API');
});

const PORT = process.env.PORT || 3301;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

export default app;