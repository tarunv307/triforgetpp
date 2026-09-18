# 🛡️ FC-03: Risk-Based Access Intelligence Engine
**Comprehensive Project Analysis & Status Report**

The FC-03 project has evolved from a standard role-based access prototype into a **highly advanced, context-aware Risk Engine** paired with a robust **Web Application Firewall (WAF)**. 

Below is a complete breakdown of everything we have built and integrated into the system.

---

## 1. 🏗️ Architecture & Tech Stack

- **Frontend:** A high-performance, single-page application (SPA) built with vanilla HTML/CSS/JS. It features a modern, glassmorphic UI, real-time Chart.js integrations, and seamless tab-based routing.
- **Backend:** A Node.js and Express.js REST API server handling risk evaluation, user management, and firewall interception.
- **Database:** Migrated entirely from MongoDB to **Supabase (PostgreSQL)** for scalable, relational data storage.

---

## 2. 🧠 Core Risk Engine

Instead of relying purely on static roles, FC-03 evaluates the *context* of every access request using a dynamic scoring system (0 to 100).

### Evaluation Signals (Context):
1. **Device Posture:** Office Laptops (Safe) vs. Unknown Devices (High Risk).
2. **Location:** Requests originating from trusted locations (e.g., India) vs. Foreign locations.
3. **Time of Day:** Normal business hours vs. "Odd Hours" (Midnight to 5 AM).
4. **Target Resource:** Standard files vs. Sensitive Customer Data or Admin Panels.
5. **Behavioral History:** Previous failed access attempts (strikes).

### Automatic Decisions:
- **0–25 (ALLOW):** Grant immediate access.
- **26–50 (CHALLENGE):** Intercept the request and demand MFA / OTP verification.
- **51–75 (RESTRICT):** Grant limited access, issue a "strike", and alert the admin.
- **76–100 (DENY):** Hard block, issue a "strike", and send a critical alert.

---

## 3. 🛡️ Web Application Firewall (WAF)

We transformed the backend into an active defense system. The custom WAF runs *before* any application logic, providing enterprise-grade security.

### Live Defenses:
- **SQL Injection (SQLi):** Deep packet inspection on URLs, query parameters, and JSON bodies to block patterns like `' OR 1=1--`.
- **Cross-Site Scripting (XSS):** Intercepts `<script>` tags and malicious javascript payloads.
- **Command Injection & Path Traversal:** Blocks OS commands (`rm -rf`) and path traversal attempts (`../../etc/passwd`).
- **Geo-Blocking:** Active filtering that restricts API access **only** to India, USA, and the UK.
- **Rate Limiting:** Protects against DDoS and Brute Force attacks (max 100 requests / 10 minutes).

### Auto-Banning Intelligence:
If an attacker triggers the WAF **5 times within 10 minutes**, the system automatically upgrades their status to a permanent IP ban without manual admin intervention.

---

## 4. 📊 Admin Dashboard UI

The frontend application provides administrators with a complete "God-Mode" view of the network.

- **Live Activity Feed:** A real-time timeline of all access requests and their calculated risk scores.
- **Threat Log (WAF):** A dedicated interface showing every malicious request intercepted by the firewall, including the payload used.
- **Access Control List (ACL):** A management panel to manually block specific IPs or revoke automatic bans.
- **Simulator Panel:** A testing environment to run scenarios and see how the Risk Engine responds to different threat combinations.
- **Analytics:** Visual charts showing risk trends over the week and the ratio of Allowed vs. Denied requests.

---

## 5. 🗄️ Database Schema (Supabase)

We have modeled the PostgreSQL database to track everything:
1. **`users`:** Stores user credentials, roles, and current "strikes".
2. **`access_logs`:** A historical record of all evaluated access requests.
3. **`audit_logs`:** Tracks administrative actions (e.g., approving a user, changing a policy).
4. **`alerts`:** Notification system for critical security events.
5. **`firewall_rules`:** The active IP blocklist.
6. **`firewall_logs`:** Detailed records of intercepted attacks for forensics.

---

## 🚀 What's Next?
The foundation is incredibly solid. The primary remaining items from your advanced roadmap (Phase 3) include:
1. Integrating a **Live Attack Map** (using Leaflet.js).
2. Connecting to external **Threat Intelligence Feeds** (e.g., AbuseIPDB).
3. Setting up **Email Alerts** via Nodemailer for critical breaches.
