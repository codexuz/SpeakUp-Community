import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import http from 'http';
import https from 'https';

dotenv.config();

import authRoutes from './routes/auth';
import groupsRoutes from './routes/groups';
import responsesRoutes from './routes/responses';
import testsRoutes from './routes/tests';

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_HOSTNAME = process.env.PUBLIC_HOSTNAME || 'localhost';
const SSL_KEY_FILE = process.env.SSL_KEY_FILE;
const SSL_CERT_FILE = process.env.SSL_CERT_FILE;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
  })
);
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/tests', testsRoutes);
app.use('/api/responses', responsesRoutes);
app.use('/api/groups', groupsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const useHttps = Boolean(SSL_KEY_FILE && SSL_CERT_FILE);

const server = useHttps
  ? https.createServer(
      {
        key: fs.readFileSync(SSL_KEY_FILE!),
        cert: fs.readFileSync(SSL_CERT_FILE!),
      },
      app
    )
  : http.createServer(app);

server.listen(Number(PORT), HOST, () => {
  const protocol = useHttps ? 'https' : 'http';
  console.log(`Server running at ${protocol}://${PUBLIC_HOSTNAME}:${PORT}`);
});
