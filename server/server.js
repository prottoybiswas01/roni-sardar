import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { seedInitialAdmin } from './controllers/authController.js';
import { initDailyBackupScheduler } from './services/backupService.js';

import authRoutes from './routes/authRoutes.js';
import recordRoutes from './routes/recordRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import backupRoutes from './routes/backupRoutes.js';

// Setup dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize express app
const app = express();

// Connect to MongoDB
connectDB().then(() => {
  seedInitialAdmin();
  initDailyBackupScheduler();
});

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows flexible camera, inline styles and scripts in SPA
    crossOriginEmbedderPolicy: false,
  })
);

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// CORS setup
const allowedOrigins = [
  process.env.CORS_ORIGIN || 'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'production') {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev/self-hosted
      }
    },
    credentials: true,
  })
);

// Rate limiting for public and auth endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

app.use('/api', apiLimiter);

// Express JSON body parser with comfortable limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Healthcheck
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Hospital Over Duty / Patient Record Management API',
    version: '1.0.0',
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backup', backupRoutes);

// Serve static frontend build files in production or when dist exists
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // Catch-all route to serve index.html for client-side React SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(clientDistPath, 'index.html'));
  });
}

// Error Handling Middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Over Duty Record Management Backend running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
