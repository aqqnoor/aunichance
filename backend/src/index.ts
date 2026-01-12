import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './database/connection.js';
import { searchRouter } from './routes/search.js';
import { universitiesRouter } from './routes/universities.js';
import { programsRouter } from './routes/programs.js';
import { chancesRouter } from './routes/chances.js';
import { reviewsRouter } from './routes/reviews.js';
import { authRouter } from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Routes
app.use('/api/search', searchRouter);
app.use('/api/universities', universitiesRouter);
app.use('/api/programs', programsRouter);
app.use('/api/chances', chancesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/auth', authRouter);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});