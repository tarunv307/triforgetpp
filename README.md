# 🛡️ FC-03: Risk-Based Access Intelligence Engine & WAF

FC-03 is a highly advanced, context-aware Access Control Engine and Web Application Firewall (WAF) built with Node.js, Express, and Supabase. Unlike traditional role-based systems, FC-03 dynamically evaluates every access request based on context (Device, Location, Time, History, and Threat Feeds) and actively defends itself against malicious traffic.

## 🚀 Key Features

### 1. Context-Aware Risk Engine
- Evaluates risk dynamically from `0` (Safe) to `100` (Critical).
- Grants access, challenges with OTP, restricts capabilities, or outright denies access based on context.

### 2. Deep Packet Inspection WAF
- **SQL Injection (SQLi):** Intercepts and blocks malicious queries (e.g., `' OR 1=1--`).
- **Cross-Site Scripting (XSS):** Blocks unauthorized script executions.
- **Command Injection & Directory Traversal:** Prevents OS command execution and unauthorized file access (`../`).
- **File Upload Scanning:** Blocks oversized files and restricts MIME types to safe formats (Images, PDFs).

### 3. Active Defense Mechanisms
- **Auto-Banning System:** Automatically and permanently bans IPs that trigger the WAF 5 times within 10 minutes.
- **Geo-Blocking:** Uses `geoip-lite` to restrict API access strictly to whitelisted countries (IN, US, GB).
- **Rate Limiting:** Protects against Brute Force and DDoS attacks by routing limit abusers directly to the Firewall blocklist.

### 4. Admin Dashboard
- A beautiful, glassmorphic UI.
- Real-time **Threat Logs** of intercepted attacks.
- Manual **Access Control List (ACL)** to block/unblock IPs instantly.
- Live charts and metrics mapping organizational risk.

---

## 🛠️ Tech Stack
- **Frontend:** Vanilla JS / HTML / CSS / Chart.js
- **Backend:** Node.js, Express.js
- **Security:** Helmet, express-rate-limit, csurf, geoip-lite
- **Database:** Supabase (PostgreSQL)

---

## ⚙️ Local Setup

### 1. Prerequisites
- Node.js installed on your machine.
- A [Supabase](https://supabase.com/) project.

### 2. Database Configuration
In your Supabase SQL Editor, run the schema to set up the necessary tables (Users, Logs, WAF Rules):
*(Run the contents of `waf_schema.sql` included in the artifacts or project setup).*

### 3. Environment Variables
Create a `.env` file in the `Backend` directory:
```env
PORT=5000
SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co
SUPABASE_KEY=[YOUR_SUPABASE_SERVICE_ROLE_KEY]
JWT_SECRET=your_super_secret_jwt_string
JWT_EXPIRES=8h
```

### 4. Running the Application
Open two terminals.

**Terminal 1: Start the Backend (Port 5000)**
```bash
cd Backend
npm install
npm run dev
```

**Terminal 2: Serve the Frontend (Port 3000)**
```bash
cd Frontend
npx serve -p 3000
```
Visit `http://localhost:3000` and login with your configured admin credentials.

---

## 🛡️ WAF Testing
To verify the Web Application Firewall is active, run the following curl command in your terminal:
```bash
curl "http://localhost:5000/api/firewall/logs?search=' OR 1=1--"
```
**Expected Response:**
```json
{ "error": "Forbidden", "reason": "SQL Injection detected" }
```
You can then view this intercepted attack inside your Admin Dashboard under **Firewall (WAF)**.
