# 🏥 OverDuty Pro — Clinical Records & Hospital Management System

<div align="center">

![OverDuty Pro Banner](https://img.shields.io/badge/System-OverDuty%20Pro-0ea5e9?style=for-the-badge&logo=medscape&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)

**Next-Generation Hospital Over Duty & Clinical Record Management Platform**  
*Built for Ad-din Akij Medical College Hospital*

</div>

---

## 🌟 Overview

**OverDuty Pro** is a modern, high-security clinical record management and hospital workflow automation system. It is engineered to streamline hospital duty rosters, track patient records, automate midnight daily backup reporting, and provide cutting-edge authentication including **1-Touch Mobile Biometrics (Fingerprint/Passkeys)** and **Super Admin 2FA**.

---

## 🚀 Key Features

### 📱 1. Mobile-Exclusive 1-Touch Biometric Login
- **Frictionless 1-Touch Access:** Mobile users (Android & iPhone) can authenticate in `<1 second` using native device fingerprint or Face ID via standard WebAuthn Passkeys.
- **Zero OTP for Biometrics:** Instant sign-in without waiting for email verification codes.
- **Strict Device Filtering:** Biometric triggers are intelligently activated exclusively on mobile phones, maintaining a standard login on desktop viewports.

### 🛡️ 2. Enterprise Authentication & Security
- **Super Admin 2FA (Two-Factor Authentication):** Time-sensitive 6-digit email security codes protect administrative operations.
- **Role-Based Access Control (RBAC):** Distinct permission hierarchies for `Super Admin`, `Administrator`, `Manager`, and `Staff`.
- **Dynamic 2FA Toggle:** Super Admins can toggle password-based 2FA on/off directly from the Settings hub.

### 📊 3. Real-Time Clinical Duty Records
- **Intelligent Duplicate Detection:** Real-time visual alerts if a duplicate patient ID is entered on the same date.
- **Dynamic Search & Filtering:** Instant filter by date range, doctor name, department, or patient ID.
- **Audit Logs & Master Protection:** Critical patient records and master admin profiles are permanently safeguarded against accidental deletion.

### 📧 4. Automated Midnight Reporting & Multi-Format Exports
- **Automated Midnight Dispatch (00:00):** Sends comprehensive daily and monthly closing Excel and PDF summary statements directly to registered staff emails.
- **Instant Excel & PDF Export:** One-click generation of professional monthly closing statements with summary analytics and hospital headers.

### 🔄 5. High-Availability Dual-Database Mirroring
- **Real-Time Replication:** Synchronizes hospital records between primary and secondary MongoDB clusters for disaster recovery.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React (Vite), Tailwind CSS, Lucide Icons, WebAuthn API, Axios |
| **Backend** | Node.js, Express.js (ES Modules), Mongoose, JWT, Resend Mail API |
| **Database** | MongoDB Atlas (Multi-Cluster High Availability) |
| **Security** | Helmet, Express Rate Limit, Mongo Sanitize, WebAuthn ES256/RS256 |
| **Deployment** | Vercel (Frontend), Render / Cloud (Backend) |

---

## 📦 Getting Started & Setup Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18.0 or higher)
- [MongoDB Atlas Account](https://www.mongodb.com/atlas) or a local MongoDB instance
- [Resend Account](https://resend.com) (or SMTP service for email delivery)

### 2. Clone Repository
```bash
git clone https://github.com/prottoybiswas01/roni-sardar.git
cd roni-sardar
```

### 3. Install Dependencies
```bash
# Install Server dependencies
cd server
npm install

# Install Client dependencies
cd ../client
npm install
```

### 4. Environment Configuration
Create a `.env` file inside the `server/` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Primary Database
MONGODB_URI=your_primary_mongodb_connection_string

# Secondary Standby Database (Optional for Dual-DB Mirroring)
SECONDARY_MONGODB_URI=your_backup_mongodb_connection_string

# Authentication Secrets
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters
JWT_EXPIRE=30d

# Resend Email API Service
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=Hospital Records <noreply@yourdomain.com>

# Master Super Admin Email
ADMIN_EMAIL=prottoybiswas575358@gmail.com

# Client Origin URL
CORS_ORIGIN=http://localhost:5173
```

### 5. Running the Application
```bash
# Run Backend (from /server)
npm run dev

# Run Frontend (from /client)
npm run dev
```
Open your browser at `http://localhost:5173` to access the application.

---

## 👨‍💻 Author & Intellectual Property

- **Developer & System Architect:** **Prottoy Kumar Biswas**
- **Email:** [prottoybiswas575358@gmail.com](mailto:prottoybiswas575358@gmail.com)
- **GitHub:** [@prottoybiswas01](https://github.com/prottoybiswas01)
- **Hospital:** Ad-din Akij Medical College Hospital

---

## 📄 License & Terms

Copyright (c) 2026 **Prottoy Kumar Biswas**. All Rights Reserved.

This software is **Proprietary & Confidential**. Unauthorized reproduction, redistribution, reverse-engineering, or commercial use without explicit permission from the author is strictly prohibited.
