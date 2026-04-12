import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

import authRoutes from './routes/auth';
import groupsRoutes from './routes/groups';
import responsesRoutes from './routes/responses';
import testsRoutes from './routes/tests';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/tests', testsRoutes);
app.use('/api/responses', responsesRoutes);
app.use('/api/groups', groupsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
