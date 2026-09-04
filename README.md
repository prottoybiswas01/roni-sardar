# OverDuty Pro — Hospital Over Duty / Patient Record Management System

A complete, professional, production-ready full-stack web application designed to replace legacy Excel-based workflows for logging daily hospital Over Duty and Patient records.

Built with a modern clinical aesthetic, dynamic monthly reporting, camera-based OCR extraction, leading-zero preserving Excel export, and role-based access control (RBAC).

---

## Architecture Overview

```
https://yourdomain.com
    │
    ├── React Frontend (Vite + Tailwind CSS + Lucide Icons)
    │     ├── Camera Scanner + Viewfinder Box + File Upload Fallback
    │     ├── Client-Side OCR Engine (Tesseract.js) + Verification Modal
    │     ├── Dynamic Month/Year Selector & Real-Time Filtering
    │     └── Excel Generator (SheetJS) & A4 Print Layout
    │
    └── /api (Node.js + Express.js API)
          ├── Rate Limiting, Helmet Security Headers, CORS, Error Handler
          ├── JWT Authentication & Role-Based Access Control (Admin, Manager, Staff)
          └── MongoDB Database (Mongoose ODM with String-type IDs)
```

---

## Key Features

1. **Strict Leading-Zero Preservation (Patient IDs)**:
   - Patient ID is stored strictly as `String` in MongoDB and formatted explicitly as text (`{ t: 's' }`) in Excel exports, preventing IDs like `001234` or `0250474` from losing leading zeroes.
2. **Camera Document Scanner & OCR**:
   - Live camera stream with document target viewfinder and scanning laser animation.
   - File upload fallback for devices without camera permissions or pre-captured photos.
   - Client-side OCR with image contrast enhancement and regex extraction for Patient ID, Name, Date, Time, and Remarks.
   - Confidence scoring (High/Medium/Low) and verification review modal before saving.
3. **Dynamic Month & Year Architecture**:
   - Month and Year are never hardcoded. Global selectors instantly re-query and update the Dashboard, Records table, Report headers, Excel exports, and Printouts.
4. **Professional Excel Reports (SheetJS)**:
   - Merged organization title banner (`Hospital Name`, `Location`, `MONTH: [SELECTED MONTH]-[SELECTED YEAR]`).
   - Styled bold table headers: `SL`, `ID`, `Patient`, `Date`, `TIME`, `Remark`.
   - Formatted column widths and text cells.
5. **A4 Clean Print Layout**:
   - `@media print` stylesheets that isolate only the official header and formatted report table, cleanly hiding navigation, sidebars, and action toolbars.
6. **Intelligent Duplicate Warning**:
   - Real-time server check warning when a record for the same Patient ID and Date already exists.
7. **Production Security**:
   - JWT authentication, bcrypt password hashing, Express rate-limiting, Helmet security headers, and MongoDB sanitized queries.

---

## Directory Structure

```
.
├── package.json              # Root script manager (dev, install-all, build, start)
├── .env.example              # Central environment template
├── README.md
├── server/                   # Backend API (Node.js / Express)
│   ├── package.json
│   ├── .env.example
│   ├── server.js             # Main server entry & static SPA serving
│   ├── config/
│   │   └── db.js             # Mongoose connection handler
│   ├── models/
│   │   ├── User.js           # User schema & bcrypt hashing
│   │   ├── Record.js         # Patient Over Duty schema with string IDs
│   │   └── Settings.js       # Hospital metadata & preferences
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── recordController.js
│   │   └── settingsController.js
│   ├── middleware/
│   │   ├── auth.js           # JWT verification & role authorization
│   │   └── errorHandler.js   # Production error handler
│   └── routes/
│       ├── authRoutes.js
│       ├── recordRoutes.js
│       └── settingsRoutes.js
└── client/                   # Frontend SPA (React 18 + Vite + Tailwind CSS)
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── index.css
    │   ├── context/          # Auth, Settings, and Toast contexts
    │   ├── services/         # API clients, OCR service, Excel exporter
    │   ├── components/       # Layout, Records, Camera Scanner, Reports
    │   ├── pages/            # Dashboard, Records, AddRecord, Reports, Settings, Login
    │   └── utils/            # Date and formatting utilities
```

---

## Installation & Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **MongoDB**: Local MongoDB community server (`mongodb://127.0.0.1:27017`) or MongoDB Atlas URI.

### 1. Install Dependencies
Run from the root directory:
```bash
npm run install-all
```
*Or individually:*
```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure Environment Variables
Copy `.env.example` in `server/`:
```bash
cd server
cp .env.example .env
```
Ensure your `server/.env` contains:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/over_duty_db
JWT_SECRET=your_super_secret_jwt_key_hospital_overduty_2026
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

---

## Running the Application

### Development Mode (Concurrent Frontend & Backend)
From the root directory:
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

### Default Administrator Credentials
On initial startup, if no users exist in the database, a default administrator account is automatically provisioned:
- **Email**: `admin@hospital.local`
- **Password**: `adminPassword123!`

---

## Production Build & Self-Hosted Deployment

This application is built for straightforward hosting on your own domain and server (e.g. Linux VPS, cPanel Node.js selector, Nginx reverse proxy) without vendor lock-in.

### Option A: Unified Single-Origin Deployment (Recommended)
In this setup, Express serves both the API endpoints (`/api/*`) and the compiled static React frontend (`dist/`) under the same domain.

1. Build the React frontend:
   ```bash
   npm run build
   ```
2. Start the Node.js production server:
   ```bash
   NODE_ENV=production npm start
   ```
3. Reverse proxy port `5000` in Nginx / Apache to your domain `https://yourdomain.com`.

### Option B: Split-Origin Deployment
If hosting the React build on a CDN/static web host and the Node.js API separately:
1. In `client/`, set `.env.production`:
   ```env
   VITE_API_BASE_URL=https://api.yourdomain.com/api
   ```
2. Run `npm run build` in `client/` and upload `client/dist` to your static host.
3. In `server/.env`, set `CORS_ORIGIN=https://yourdomain.com` and run `npm start`.

---

## API Documentation Overview

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticate user & receive JWT token |
| `POST` | `/api/auth/register` | Public | Register new staff or admin user |
| `GET` | `/api/auth/me` | Private | Get current user profile & role |
| `GET` | `/api/auth/users` | Admin | List all registered users |
| `PUT` | `/api/auth/users/:id` | Admin | Update user role or active status |
| `GET` | `/api/records` | Private | Get records with pagination, search, month/year filters |
| `GET` | `/api/records/dashboard-stats` | Private | Get summary metrics for the selected month/year |
| `GET` | `/api/records/check-duplicate` | Private | Check for existing patient record on the same date |
| `POST` | `/api/records` | Private | Create a new patient record (auto SL computation) |
| `PUT` | `/api/records/:id` | Private | Update an existing patient record |
| `DELETE` | `/api/records/:id` | Manager/Admin | Delete a patient record |
| `GET` | `/api/settings` | Private | Get hospital name, location, and report preferences |
| `PUT` | `/api/settings` | Manager/Admin | Update hospital branding and settings |

---

## License
MIT License. Built for professional healthcare administration.
