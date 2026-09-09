# 🏥 OverDuty Pro — Hospital Over Duty / Patient Record Management System

> **Production-Grade Full-Stack Clinical Application**  
> *Engineered to replace legacy paper/Excel hospital records with a modern digital clinical portal, camera OCR scanning, dynamic month/year reporting, dual-database real-time replication, and enterprise-grade disaster recovery.*

---

## 🤖 AI Master Reproduction Prompt (কপি-পেস্ট প্রম্পট)

> **Tip:** আপনি যদি ভবিষ্যতে Claude, ChatGPT, অথবা Antigravity AI-কে দিয়ে এই সম্পূর্ণ প্রজেক্ট হুবহু তৈরি করতে চান, তবে নিচের প্রম্পটটি সরাসরি কপি করে ব্যবহার করুন:

```markdown
Build a full-stack, production-ready Hospital Over Duty and Patient Record Management web application called "OverDuty Pro" using React 18 + Vite + Tailwind CSS + Lucide Icons for the frontend and Node.js + Express (ES Modules) + MongoDB (Mongoose) for the backend API.

### 1. Key Business Rules & Functional Features:
- **Patient ID Validation & Leading Zero Preservation:** Patient ID MUST be stored strictly as a String in MongoDB and formatted explicitly as text (`{ t: 's' }`) in Excel exports so IDs like "001234" or "0250474" never lose leading zeroes. Input validation strictly enforces numeric digits `/^\d+$/`.
- **Patient Name Formatting:** Allows letters, numbers, spaces, dots (.), slashes (/), hyphens (-), and standard healthcare title prefixes.
- **Dynamic Month/Year Navigation:** Global Month/Year dropdown where each month displays dynamic record counts in real-time (e.g., "January (14)", "September (100)") powered by an aggregate endpoint.
- **Recycle Bin (Soft Deletion) & Security Hardening:** When a record is deleted, it moves to the Recycle Bin (`isDeleted: true`, `deletedBy`, `deletedAt`). ONLY the user who deleted/created the record can restore it. Super Admin cannot restore on behalf of other staff. Super Admin has exclusive permission to Permanently Delete or Empty the Recycle Bin.
- **Camera Document Scanner & OCR:** Client-side camera scanner with target viewfinder box, laser scanning animation, file upload fallback, contrast enhancement, and Tesseract.js OCR extraction with confidence badges and review verification modal.
- **Super Administrator 2FA Login OTP:** Login for Super Admin dispatches a 6-digit OTP (10 minutes validity) to the configured Super Admin email. Password reset and profile purge also enforce 6-digit email OTPs.
- **Staff User Inspection Modal (Settings):** Super Admin can inspect any staff member's live stats, monthly date ranges, and download full lifetime/monthly PDF & Excel statements directly.
- **Dual-MongoDB Live Auto-Sync & Failover:** Supports Primary (`MONGODB_URI`) and Secondary Backup (`MONGODB_SECONDARY_URI`) clusters. When records/users are saved or deleted on the Primary, they are asynchronously mirrored in real-time to the Secondary cluster. If the Primary cluster is down, the server automatically connects to the Secondary cluster.
- **Automated Email Reporting (Resend API / SMTP):** Dispatches midnight daily updates and 1st-of-the-month grand closing reports with formatted Excel (.xlsx) spreadsheets and PDF statements.
- **Enterprise Security:** Express rate limiting, strict auth rate limiter (brute-force defense), NoSQL query operator injection sanitizer (`mongoSanitize`), Helmet security headers (`X-Frame-Options: SAMEORIGIN`, `noSniff`), CORS restriction, and zero credentials in repository code (`.env` in `.gitignore`).

### 2. Mandatory Privacy & Secret Collection Step:
- **NEVER hardcode personal passwords, real emails, or MongoDB connection strings into source files.**
- Once code generation is complete, prompt the user to provide their own credentials:
  1. `MONGODB_URI` (Primary MongoDB Atlas connection string)
  2. `MONGODB_SECONDARY_URI` (Secondary backup MongoDB Atlas connection string)
  3. `JWT_SECRET` (A strong random 32+ character secret)
  4. `RESEND_API_KEY` & `RESEND_SENDER_EMAIL` (Transactional email credentials)
  5. `SUPERADMIN_EMAIL` (Super Administrator recovery and 2FA destination email)
```

---

## 🏛️ System Architecture Overview

```
[ Frontend: React 18 + Vite (Vercel) ]
     │
     ├── HTTPS REST API Calls (Bearer JWT)
     ▼
[ Backend API: Node.js + Express ESM (Render) ]
     │
     ├── Helmet Security Headers + NoSQL Sanitizer + Auth Rate Limiter
     ├── Resend Email Service (Daily/Monthly PDF + Excel Reports)
     │
     ├──► [ 1. Primary MongoDB Atlas (Daily Live Database) ]
     │        │
     │        └── Mongoose Post-Save/Delete Hooks (Instant Mirroring)
     │                 │
     └────────────────► [ 2. Secondary MongoDB Atlas (Offline Backup Cluster) ]
```

---

## 📁 Complete Project Structure & File Map

```
project-root/
├── .gitignore                          # Excludes node_modules, .env, dist, logs
├── package.json                        # Root concurrently runner (npm run dev, install-all, build)
├── README.md                           # Master system specification & reproduction blueprint
│
├── client/                             # Frontend SPA (React 18 + Vite + Tailwind CSS)
│   ├── index.html                      # HTML5 root template with viewport & Google Fonts
│   ├── package.json                    # Client dependencies (lucide-react, tesseract.js, xlsx)
│   ├── vite.config.js                  # Vite dev server & API proxy config
│   ├── tailwind.config.js              # Custom Tailwind clinical color palette & animation
│   └── src/
│       ├── main.jsx                    # React 18 DOM mount point
│       ├── App.jsx                     # Route definitions, ProtectedRoutes, Context Providers
│       ├── index.css                   # Tailwind directives, print media styles, custom scrollbars
│       │
│       ├── context/
│       │   ├── AuthContext.jsx         # User auth state, token storage, login/logout/2FA OTP
│       │   ├── SettingsContext.jsx     # Hospital metadata, theme preferences, backup state
│       │   └── ToastContext.jsx        # Global toast notifications
│       │
│       ├── services/
│       │   ├── api.js                  # Base fetch client with JWT token injection & 401 interception
│       │   ├── authApi.js              # Login, register, 2FA verify, password reset, user CRUD
│       │   ├── recordsApi.js           # Record CRUD, monthly counts, duplicate check, recycle bin
│       │   ├── settingsApi.js          # System settings update, manual backup triggers
│       │   ├── ocrService.js           # Tesseract.js image preprocessing & regex extraction
│       │   └── excelExport.js          # Formatted SheetJS Excel (.xlsx) generator with text types
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Header.jsx          # Top navbar, profile badge, quick action buttons
│       │   │   ├── Sidebar.jsx         # Desktop & mobile navigation drawer
│       │   │   ├── MonthYearPicker.jsx # Dynamic month selector with real-time counts (e.g. Jan (12))
│       │   │   └── ProtectedRoute.jsx  # Role-based route guard
│       │   │
│       │   ├── records/
│       │   │   ├── RecordForm.jsx      # Numeric-only Patient ID input, auto SL, duplicate checker
│       │   │   ├── RecordTable.jsx     # High-density patient table with inline actions
│       │   │   └── SearchFilterBar.jsx # Search input, date filter, sort order, and bulk actions
│       │   │
│       │   ├── camera/
│       │   │   ├── CameraScanner.jsx   # Live camera feed, viewfinder box, scanning laser animation
│       │   │   └── OCRReviewModal.jsx  # Confidence badge preview, input sanitization modal
│       │   │
│       │   └── common/
│       │       ├── Modal.jsx           # Reusable accessible dialog
│       │       ├── ConfirmModal.jsx    # Action confirmation dialog (delete, restore)
│       │       └── Toast.jsx           # Toast alert banner
│       │
│       ├── pages/
│       │   ├── DashboardPage.jsx       # Real-time metrics (Today, Month, All-Time, Unique Patients)
│       │   ├── RecordsPage.jsx         # Main Over Duty records list with month picker & Excel export
│       │   ├── AddRecordPage.jsx       # Single patient entry form with OCR scan shortcut
│       │   ├── MonthlyReportPage.jsx   # Printable clinical report table & grand totals
│       │   ├── RecycleBinPage.jsx      # Trash bin with deleter-only restore & superadmin purge
│       │   ├── SettingsPage.jsx        # Hospital settings, User management, staff inspector modal
│       │   ├── LoginPage.jsx           # Clean login card with Super Admin 2FA OTP overlay
│       │   └── ForgotPasswordPage.jsx  # 6-digit email OTP password recovery
│       │
│       └── utils/
│           ├── dateUtils.js            # Date formatting (DD/MM/YYYY, Time 12h/24h)
│           └── exportHelpers.js        # PDFKit & ExcelJS helper scripts
│
└── server/                             # Backend REST API (Node.js + Express ESM)
    ├── package.json                    # Server dependencies (mongoose, resend, helmet, exceljs)
    ├── .env.example                    # Sanitized template for environment variables
    ├── server.js                       # Express app entry, middleware mount, static SPA serve
    │
    ├── config/
    │   └── db.js                       # Primary Mongo connection with auto-failover to Secondary
    │
    ├── middleware/
    │   ├── auth.js                     # JWT `protect` and role `authorize` guards
    │   ├── security.js                 # NoSQL query injection sanitizer & strict auth rate limiter
    │   └── errorHandler.js             # Formatted production error sanitizer
    │
    ├── models/
    │   ├── Record.js                   # Patient record schema, compound indexes, mirror post-hooks
    │   ├── User.js                     # Staff schema, bcrypt hashing, 2FA OTP, mirror post-hooks
    │   └── Settings.js                 # Hospital branding, email credentials, mirror post-hooks
    │
    ├── services/
    │   ├── dbMirrorService.js          # Dual-MongoDB replication engine (syncs to Secondary DB)
    │   ├── backupService.js            # Midnight cron, Excel/PDF email generator, Resend SDK
    │   ├── pdfGenerator.js             # Hospital statement PDF generator with customized headers
    │   └── excelGenerator.js           # Multi-column formatted Excel (.xlsx) buffer generator
    │
    ├── controllers/
    │   ├── authController.js           # Auth, 2FA OTP, user lifecycle, admin seeding
    │   ├── recordController.js         # Record CRUD, monthly counts, recycle bin, duplicate check
    │   └── settingsController.js       # Hospital settings & email config
    │
    └── routes/
        ├── authRoutes.js               # /api/auth endpoints
        ├── recordRoutes.js             # /api/records endpoints
        ├── settingsRoutes.js           # /api/settings endpoints
        └── backupRoutes.js             # /api/backup endpoints
```

---

## 🗄️ Database Schemas (Mongoose Models)

### 1. `Record` Model (`server/models/Record.js`)
```javascript
{
  sl: { type: Number },
  patientId: { type: String, required: true, trim: true, index: true }, // Preserves leading 0s
  patientName: { type: String, required: true, trim: true, index: true },
  date: { type: Date, required: true, index: true },
  time: { type: String, required: true, trim: true },
  remark: { type: String, trim: true, default: '' },
  month: { type: Number, required: true, min: 1, max: 12, index: true },
  year: { type: Number, required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}
```

### 2. `User` Model (`server/models/User.js`)
```javascript
{
  name: { type: String, required: true, trim: true },
  username: { type: String, trim: true, lowercase: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['superadmin', 'admin', 'manager', 'staff'], default: 'staff' },
  status: { type: String, enum: ['active', 'pending', 'inactive', 'paused', 'suspended'], default: 'pending' },
  autoEmailBackup: { type: Boolean, default: true },
  backupEmail: { type: String, trim: true, lowercase: true },
  emailVerified: { type: Boolean, default: false },
  emailVerificationOtp: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  loginOtp: { type: String, select: false },
  loginOtpExpires: { type: Date, select: false },
  deleteOtp: { type: String, select: false },
  deleteOtpExpires: { type: Date, select: false },
  resetPasswordOtp: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false }
}
```

### 3. `Settings` Model (`server/models/Settings.js`)
```javascript
{
  hospitalName: { type: String, default: 'Hospital / Clinic Name' },
  location: { type: String, default: 'Clinical Department / Branch' },
  reportTitle: { type: String, default: 'OVER DUTY / PATIENT REPORT' },
  checkDuplicates: { type: Boolean, default: true },
  backupEmail: { type: String, default: 'admin@hospital.com' },
  autoEmailBackup: { type: Boolean, default: true },
  emailProvider: { type: String, enum: ['resend', 'smtp'], default: 'resend' },
  resendApiKey: { type: String, default: '' },
  senderEmail: { type: String, default: 'backup@yourdomain.com' },
  senderName: { type: String, default: 'OverDuty Hospital Backup' }
}
```

---

## 🔌 API Route Reference Table

| Method | Route | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Login credentials check & dispatches 2FA OTP for Super Admin (if enabled) |
| `POST` | `/api/auth/verify-admin-otp` | Public | Verifies 6-digit Super Admin login OTP |
| `POST` | `/api/auth/biometrics/login-options` | Public | Generates biometric challenge for 1-touch passkey login |
| `POST` | `/api/auth/biometrics/verify-login` | Public | Verifies device biometric passkey & issues instant JWT session |
| `POST` | `/api/auth/biometrics/register-options` | Private | Generates enrollment challenge to register device fingerprint |
| `POST` | `/api/auth/biometrics/verify-registration` | Private | Links & stores device biometric credential ID |
| `GET` | `/api/auth/biometrics/devices` | Private | Returns enrolled biometric devices & 2FA status |
| `DELETE` | `/api/auth/biometrics/:id` | Private | Removes an enrolled biometric device |
| `PUT` | `/api/auth/toggle-admin-2fa` | Admin | Toggles Admin Email 2FA OTP requirement [ON/OFF] |
| `POST` | `/api/auth/register` | Public | Registers staff & dispatches email verification OTP |
| `POST` | `/api/auth/verify-email-otp` | Public | Verifies email OTP & activates staff account |
| `POST` | `/api/auth/forgot-password` | Public | Dispatches 6-digit password reset OTP to user's email |
| `POST` | `/api/auth/verify-reset-password` | Public | Resets password with valid OTP |
| `GET` | `/api/auth/me` | Private | Returns current user profile |
| `GET` | `/api/auth/users` | Admin | Returns list of all registered staff accounts |
| `PUT` | `/api/auth/users/:id` | Admin | Updates user role, status (active/paused/inactive) |
| `POST` | `/api/auth/users/:id/send-delete-otp` | SuperAdmin | Dispatches delete confirmation OTP to user's email |
| `POST` | `/api/auth/users/:id/verify-delete` | SuperAdmin | Verifies OTP & permanently purges user and records |
| `GET` | `/api/records` | Private | Returns records filtered by month, year, search, user |
| `GET` | `/api/records/monthly-counts` | Private | Returns record counts for all 12 months for selected year |
| `GET` | `/api/records/dashboard-stats` | Private | Returns summary metrics for selected month & year |
| `GET` | `/api/records/check-duplicate` | Private | Real-time duplicate patient ID check |
| `GET` | `/api/records/next-sl` | Private | Calculates next sequence SL for month/year |
| `POST` | `/api/records` | Private | Creates a new patient entry |
| `PUT` | `/api/records/:id` | Private | Updates existing record (creator-only) |
| `DELETE` | `/api/records/:id` | Private | Soft-deletes record (moves to Recycle Bin) |
| `GET` | `/api/records/bin` | Private | Lists soft-deleted records in Recycle Bin |
| `PUT` | `/api/records/bin/:id/restore` | Private | Restores record (creator/deleter only) |
| `DELETE` | `/api/records/bin/:id/permanent` | SuperAdmin | Permanently deletes a single record |
| `DELETE` | `/api/records/bin/empty` | SuperAdmin | Empties entire Recycle Bin |
| `GET` | `/api/settings` | Private | Returns hospital metadata & backup preferences |
| `PUT` | `/api/settings` | Admin | Updates hospital branding & email settings |
| `POST` | `/api/backup/email-now` | Admin | Manually triggers immediate master email backup |

---

## ⚙️ Environment Variables Template (`server/.env.example`)

> ⚠️ **Important:** Real secrets must only be provided by the user in their private `.env` file or cloud dashboard. Never commit actual connection strings or keys to Git.

```env
PORT=5000
NODE_ENV=production

# 1. Primary MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/over_duty_db?retryWrites=true&w=majority

# 2. Secondary Backup MongoDB Atlas Connection String (Optional for Dual-DB Mirroring)
MONGODB_SECONDARY_URI=mongodb+srv://<backup_user>:<backup_password>@cluster-backup.xxxxx.mongodb.net/over_duty_db?retryWrites=true&w=majority

# JWT Token Secret & Expiration
JWT_SECRET=your_super_strong_random_jwt_secret_key_at_least_32_characters
JWT_EXPIRES_IN=7d

# Allowed Frontend Origins (CORS)
CORS_ORIGIN=https://<your-frontend-domain>.vercel.app

# Transactional Email Service (Resend API)
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_SENDER_EMAIL=backup@yourdomain.com
RESEND_DOMAIN=yourdomain.com
```

---

## 🚀 Installation & Running

### 1. Install All Dependencies
From the repository root:
```bash
npm run install-all
```

### 2. Start Development Servers (Frontend + Backend Concurrently)
```bash
npm run dev
```

### 3. Production Build
```bash
npm run build
npm start
```

---

## 🌐 Production Deployment

### Backend (Render / Node.js)
1. Link your GitHub repository to a new **Web Service** on [Render](https://render.com/).
2. Set **Root Directory** to `server`.
3. Set **Build Command** to `npm install`.
4. Set **Start Command** to `node server.js`.
5. Add your private Environment Variables (`MONGODB_URI`, `MONGODB_SECONDARY_URI`, `JWT_SECRET`, `RESEND_API_KEY`, etc.) in the Render dashboard.

### Frontend (Vercel)
1. Import the same repository into [Vercel](https://vercel.com/).
2. Set **Framework Preset** to `Vite`.
3. Set **Root Directory** to `client`.
4. Set Environment Variable:
   - `VITE_API_BASE_URL` = `https://<your-render-backend-service>.onrender.com/api`
5. Click **Deploy**.

---

## 📜 License
MIT License. Built for professional hospital clinical record management.
