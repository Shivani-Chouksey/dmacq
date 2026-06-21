
import 'dotenv/config';
import express from 'express';
import activityRoutes from './routes/activity.route.js';
import { connectDB } from './config/db.js';
import { initActivitySocket } from './ws/activitySocket.js';

const app = express();

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((o) => o.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-tenant-id');

  next();
});

app.use(express.json());
app.get('/health', (req, res) => {
  console.log('Health route hit');
  res.json({ status: 'ok' });
});
app.use('/activities', activityRoutes);

const PORT = process.env.PORT || 4000;


const startServer =
  async () => {
    try {
      await connectDB();
      const httpServer = app.listen(
        PORT,
        () => {
          console.log(
            `🚀 Server running on port ${PORT}`
          );
        }
      );

      initActivitySocket(httpServer);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  };


startServer();