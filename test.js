
    /* ===================================================
       ROLES + PAGES
       =================================================== */
    const ROLES = {
      admin: { pages: ['dashboard', 'evaluate', 'history', 'policies', 'simulator', 'threat', 'alerts', 'audit', 'users', 'firewall', 'about'] },
      analyst: { pages: ['dashboard', 'evaluate', 'history', 'simulator', 'threat', 'about'] },
      viewer: { pages: ['dashboard', 'history', 'threat', 'about'] }
    };

    const PAGE_LABELS = {
      dashboard: { icon: '🏠', label: 'Dashboard' },
      evaluate: { icon: '🔍', label: 'Evaluate Access' },
      history: { icon: '📜', label: 'History' },
      policies: { icon: '⚙️', label: 'Policies' },
      simulator: { icon: '🎬', label: 'Simulator' },
      threat: { icon: '⚠️', label: 'Threat Feed' },
      alerts: { icon: '🔔', label: 'Admin Alerts' },
      audit: { icon: '📊', label: 'Audit Trail' },
      users: { icon: '👥', label: 'User Management' },
      firewall: { icon: '🛡️', label: 'Firewall (WAF)' },
      about: { icon: 'ℹ️', label: 'About' }
    };

    /* ===================================================
       STATE
       =================================================== */
    let USERS = [];

    let currentUser = null;
    let adminAlerts = [];
    let otpCode = null;
    let otpAttempts = 0;
    let pendingRequest = null;

    /* Escaping helper — prevents HTML injection through names/emails */
    const esc = s => String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    /* ===================================================
       TABS
       =================================================== */
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const t = tab.dataset.tab;
        document.getElementById('loginForm').style.display = t === 'login' ? 'block' : 'none';
        document.getElementById('signupForm').style.display = t === 'signup' ? 'block' : 'none';
      });
    });

    /* ===================================================
       AUTH
       =================================================== */
    async function doLogin() {
      const email = document.getElementById('loginEmail').value.trim().toLowerCase();
      const pass = document.getElementById('loginPass').value;
      const err = document.getElementById('loginError');
      err.classList.remove('show');

      if (!email || !pass) { showError(err, 'Enter email and password'); return; }

      try {
        const res = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password: pass })
        });

        localStorage.setItem('fc03_token', res.token);
        currentUser = res.user;
        currentUser.accessLimit = currentUser.access_limit || 3;
        
        if (currentUser.status === 'pending') { showError(err, 'Account pending admin approval'); return; }
        if (currentUser.status === 'suspended') { showError(err, 'Account suspended. Contact admin.'); return; }

        enterApp();
      } catch (e) {
        let msg = 'Invalid email or password';
        try { msg = JSON.parse(e.message).error; } catch(err) {}
        showError(err, msg);
      }
    }

    function fillLogin(email, pass) {
      document.getElementById('loginEmail').value = email;
      document.getElementById('loginPass').value = pass;
      document.getElementById('loginEmail').focus();
    }

    async function doSignup() {
      const name = document.getElementById('suName').value.trim();
      const email = document.getElementById('suEmail').value.trim().toLowerCase();
      const pass = document.getElementById('suPass').value;
      const pass2 = document.getElementById('suPass2').value;
      const role = document.getElementById('suRole').value;

      const err = document.getElementById('signupError');
      const ok = document.getElementById('signupSuccess');
      err.classList.remove('show'); ok.classList.remove('show');

      if (!name || !email || !pass) { showError(err, 'All fields required'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError(err, 'Enter a valid email'); return; }
      if (pass.length < 6) { showError(err, 'Password must be at least 6 characters'); return; }
      if (pass !== pass2) { showError(err, 'Passwords do not match'); return; }

      try {
        const res = await apiFetch('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ name, email, password: pass, role })
        });

        ok.textContent = res.user.status === 'pending'
          ? '✅ Signup successful. Admin approval pending for admin role.'
          : '✅ Signup successful. Please login.';
        ok.classList.add('show');

        setTimeout(() => {
          document.querySelector('[data-tab="login"]').click();
          document.getElementById('loginEmail').value = email;
        }, 1500);
      } catch (e) {
        let msg = 'Signup failed';
        try { msg = JSON.parse(e.message).error; } catch(err) {}
        showError(err, msg);
      }
    }

    function showError(el, msg) { el.textContent = '❌ ' + msg; el.classList.add('show'); }

    /* ===================================================
       ENTER APP
       =================================================== */
    function enterApp() {
      document.getElementById('authPage').style.display = 'none';
      document.getElementById('appPage').classList.add('show');

      document.getElementById('userNameTop').textContent = currentUser.name.split(' ')[0];
      document.getElementById('avatar').textContent = currentUser.name[0].toUpperCase();
      const rb = document.getElementById('roleBadge');
      rb.textContent = currentUser.role.toUpperCase();
      rb.className = 'role-badge role-' + currentUser.role;

      document.getElementById('sidebarUser').textContent = currentUser.name;
      document.getElementById('sidebarEmail').textContent = currentUser.email;
      document.getElementById('sidebarRole').textContent = currentUser.role.toUpperCase();
      document.getElementById('evUser').value = currentUser.email;
      document.getElementById('historySub').textContent =
        currentUser.role === 'admin' ? 'All users · organisation-wide' : 'Your requests only';

      updateSidebarLimit();

      const hour = new Date().getHours();
      const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      document.getElementById('greeting').textContent = `${greet}, ${currentUser.name.split(' ')[0]} 👋`;
      document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      refreshEvalTime();

      document.getElementById('bellWrap').style.display = (currentUser.role === 'admin') ? 'block' : 'none';

      buildSidebar();
      renderAll();
      showPage(ROLES[currentUser.role].pages[0]);
      toast(`Welcome, ${currentUser.name.split(' ')[0]}! 🎉`);
      
      if (currentUser.role === 'admin') refreshUsers();
    }

    async function refreshUsers() {
      try {
        const res = await apiFetch('/users');
        USERS = res.users;
        renderUsers();
      } catch (e) {
        console.error('Failed to load users', e);
      }
    }

    function refreshEvalTime() {
      const now = new Date();
      document.getElementById('evTime').value =
        now.toLocaleTimeString('en-IN') + (isOddHour(now.getHours()) ? '  ⚠ odd hours' : '');
    }

    function updateSidebarLimit() {
      const el = document.getElementById('sidebarLimit');
      if (!currentUser) { el.textContent = ''; return; }
      const over = currentUser.strikes >= currentUser.accessLimit;
      el.innerHTML = `Risk strikes: <strong style="color:${over ? 'var(--danger)' : 'var(--muted)'}">${currentUser.strikes} / ${currentUser.accessLimit}</strong>`;
    }

    /* ===================================================
       SIDEBAR / NAV
       =================================================== */
    function buildSidebar() {
      const nav = document.getElementById('navMenu');
      nav.innerHTML = '';
      ROLES[currentUser.role].pages.forEach(key => {
        const p = PAGE_LABELS[key];
        const div = document.createElement('div');
        div.className = 'nav-item';
        div.dataset.page = key;
        div.innerHTML = `<span class="nav-icon">${p.icon}</span><span>${p.label}</span>` +
          (key === 'alerts' ? `<span class="nav-badge" id="navAlertBadge" style="display:none;">0</span>` : '');
        div.onclick = () => showPage(key);
        nav.appendChild(div);
      });
      renderAlerts();
    }

    function showPage(key) {
      if (!ROLES[currentUser.role].pages.includes(key)) { toast('🚫 Access Denied'); return; }
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const nav = document.querySelector(`.nav-item[data-page="${key}"]`);
      if (nav) nav.classList.add('active');
      document.getElementById('page-' + key).classList.add('active');

      if (key === 'evaluate') refreshEvalTime();

      if (key === 'alerts') {
        adminAlerts.forEach(a => a.read = true);
        renderAlerts();
      }
    }

    /* ===================================================
       DATA
       =================================================== */
    let accessLogs = [
      { time: '10:00 AM', user: 'priya@bank.com', device: 'Office Laptop', location: 'Mumbai, India', resource: 'Normal File', score: 0, decision: 'ALLOW' },
      { time: '08:00 PM', user: 'priya@bank.com', device: 'Personal Laptop', location: 'Mumbai, India', resource: 'Sensitive Customer Data', score: 5, decision: 'ALLOW' },
      { time: '02:00 AM', user: 'priya@bank.com', device: 'New Phone', location: 'New York, USA', resource: 'Sensitive Customer Data', score: 90, decision: 'DENY' },
      { time: '03:00 PM', user: 'priya@bank.com', device: 'Office Laptop', location: 'Mumbai, India', resource: 'Admin Panel', score: 5, decision: 'ALLOW' },
      { time: '11:15 AM', user: 'arjun@bank.com', device: 'Office Laptop', location: 'Mumbai, India', resource: 'Normal File', score: 0, decision: 'ALLOW' },
      { time: '09:40 PM', user: 'kavya@bank.com', device: 'Personal Laptop', location: 'Mumbai, India', resource: 'Normal File', score: 0, decision: 'ALLOW' }
    ];

    let auditLogs = [
      { time: '10:32 AM', actor: 'admin@bank.com', action: 'UPDATE_ROLE', entity: 'user:kavya@bank.com' },
      { time: '09:15 AM', actor: 'arjun@bank.com', action: 'EVALUATE', entity: 'access:1234' },
      { time: 'Yesterday', actor: 'admin@bank.com', action: 'APPROVE_USER', entity: 'user:new_hire@bank.com' }
    ];

    /* Single source of truth for the model */
    const POLICIES = [
      { key: 'Office laptop (managed)', weight: -10, category: 'device', test: c => c.device === 'Office Laptop' },
      { key: 'Personal laptop', weight: 5, category: 'device', test: c => c.device === 'Personal Laptop' },
      { key: 'New phone', weight: 25, category: 'device', test: c => c.device === 'New Phone' },
      { key: 'Unknown device', weight: 35, category: 'device', test: c => c.device === 'Unknown Device' },
      { key: 'Trusted location (India)', weight: -10, category: 'location', test: c => c.location.includes('India') },
      { key: 'Foreign location', weight: 30, category: 'location', test: c => !c.location.includes('India') },
      { key: 'Normal hours (06–23)', weight: -5, category: 'time', test: c => !isOddHour(c.hour) },
      { key: 'Odd hours (00–05)', weight: 15, category: 'time', test: c => isOddHour(c.hour) },
      { key: 'Sensitive resource', weight: 20, category: 'resource', test: c => c.resource === 'Sensitive Customer Data' },
      { key: 'Admin resource', weight: 30, category: 'resource', test: c => c.resource === 'Admin Panel' },
      { key: 'Failed attempts ≥ 3', weight: 20, category: 'behaviour', test: c => c.fails >= 3 }
    ];

    const THRESHOLDS = [
      { decision: 'ALLOW', min: 0, max: 25, action: 'Grant full access' },
      { decision: 'CHALLENGE', min: 26, max: 50, action: 'Request OTP / MFA' },
      { decision: 'RESTRICT', min: 51, max: 75, action: 'Limited access + log' },
      { decision: 'DENY', min: 76, max: 100, action: 'Block access + alert admin' }
    ];

    function isOddHour(h) { return h >= 0 && h <= 5; }

    /* ---------- THE RISK ENGINE (pure, shared by eval + simulator) ---------- */
    function computeRisk(ctx) {
      let score = 0;
      const reasons = [];

      POLICIES.forEach(p => {
        if (p.test(ctx)) {
          score += p.weight;
          reasons.push(`${p.key} (${p.weight > 0 ? '+' : ''}${p.weight})`);
        }
      });

      score = Math.max(0, Math.min(100, score));

      let decision = 'ALLOW', action = 'Grant full access';
      for (const t of THRESHOLDS) {
        if (score >= t.min && score <= t.max) {
          decision = t.decision; action = t.action; break;
        }
      }
      return { score, decision, action, reasons };
    }

    /* ===================================================
       RENDER
       =================================================== */
    function renderAll() {
      renderKpis();
      renderFeed();
      renderHistory();
      renderPolicies();
      renderThresholds();
      renderThreats();
      renderUsers();
      renderAudit();
      renderAlerts();
      setTimeout(renderCharts, 100);
    }

    function visibleLogs() {
      return currentUser.role === 'admin'
        ? accessLogs
        : accessLogs.filter(l => l.user === currentUser.email);
    }

    function renderKpis() {
      const logs = visibleLogs();
      const total = logs.length;
      const nAllow = logs.filter(l => l.decision === 'ALLOW').length;
      const nChal = logs.filter(l => l.decision === 'CHALLENGE').length;
      const nDeny = logs.filter(l => l.decision === 'RESTRICT' || l.decision === 'DENY').length;
      const pct = n => total ? Math.round(n / total * 100) + '%' : '0%';

      document.getElementById('kpiTotal').textContent = total;
      document.getElementById('kpiAllowed').textContent = pct(nAllow);
      document.getElementById('kpiChallenged').textContent = pct(nChal);
      document.getElementById('kpiDenied').textContent = pct(nDeny);
      document.getElementById('kpiAllowedN').textContent = nAllow + ' events';
      document.getElementById('kpiChallengedN').textContent = nChal + ' events';
      document.getElementById('kpiDeniedN').textContent = nDeny + ' events';
      document.getElementById('kpiScope').textContent = currentUser.role === 'admin'
        ? 'All users · organisation-wide'
        : 'Your requests only (' + currentUser.email + ')';
    }

    function badge(d) {
      const map = { ALLOW: 'badge-allow', CHALLENGE: 'badge-challenge', RESTRICT: 'badge-restrict', DENY: 'badge-deny' };
      return `<span class="decision-badge ${map[d]}">${d}</span>`;
    }

    function logRows(logs) {
      if (!logs.length) {
        return `<tr><td colspan="7" style="text-align:center; padding:36px; color:var(--muted);">No access events yet.</td></tr>`;
      }
      return logs.map(l => `
    <tr>
      <td>${esc(l.time)}</td>
      <td>${esc(l.user)}</td>
      <td>${esc(l.device)}</td>
      <td>${esc(l.location)}</td>
      <td>${esc(l.resource)}</td>
      <td><b>${l.score}</b></td>
      <td>${badge(l.decision)}</td>
    </tr>`).join('');
    }

    function renderFeed() { document.getElementById('liveFeed').innerHTML = logRows(visibleLogs()); }
    function renderHistory() { document.getElementById('historyTable').innerHTML = logRows(visibleLogs()); }

    function renderPolicies() {
      document.getElementById('policiesTable').innerHTML = POLICIES.map(p => `
    <tr>
      <td><b>${esc(p.key)}</b></td>
      <td>${esc(p.category)}</td>
      <td style="color:${p.weight < 0 ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">
        ${p.weight > 0 ? '+' : ''}${p.weight}
      </td>
    </tr>`).join('');
    }

    function renderThresholds() {
      document.getElementById('thresholdsTable').innerHTML = THRESHOLDS.map(t => `
    <tr>
      <td>${badge(t.decision)}</td>
      <td><b>${t.min} – ${t.max}</b></td>
      <td>${esc(t.action)}</td>
    </tr>`).join('');
    }

    function renderThreats() {
      const threats = [
        { severity: 'CRITICAL', indicator: '45.142.212.61', source: 'AlienVault OTX', desc: 'Known APT C2 server' },
        { severity: 'HIGH', indicator: '185.220.101.5', source: 'AbuseIPDB', desc: 'Tor exit node' },
        { severity: 'HIGH', indicator: 'fake-bank.com', source: 'PhishTank', desc: 'Phishing domain' },
        { severity: 'MEDIUM', indicator: '91.243.44.12', source: 'Internal', desc: 'Suspicious scanning' }
      ];
      const colors = {
        CRITICAL: 'background:#FEE2E2; color:#991B1B;',
        HIGH: 'background:#FFEDD5; color:#9A3412;',
        MEDIUM: 'background:#FEF3C7; color:#92400E;',
        LOW: 'background:#D1FAE5; color:#065F46;'
      };
      document.getElementById('threatList').innerHTML = threats.map(t => `
    <div style="padding:16px; border-bottom:1px solid #F1F5F9; display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <div>
        <span style="padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.05em; ${colors[t.severity]}">${t.severity}</span>
        <div style="margin-top:8px; font-weight:600;">${esc(t.indicator)}</div>
        <div style="color:var(--muted); font-size:12px;">${esc(t.source)} · ${esc(t.desc)}</div>
      </div>
      <button class="btn btn-secondary" style="width:auto; padding:8px 16px; font-size:12px;">Investigate</button>
    </div>`).join('');
    }

    function renderUsers() {
      document.getElementById('usersTable').innerHTML = USERS.map(u => {
        const strikes = u.strikes || 0;
        const limit = u.accessLimit || 3;
        const over = strikes >= limit;
        return `
    <tr>
      <td><b>${esc(u.name)}</b></td>
      <td>${esc(u.email)}</td>
      <td><span class="role-badge role-${esc(u.role)}" style="font-size:10px; padding:4px 10px;">${esc(u.role)}</span></td>
      <td>
        <span style="padding:4px 10px; border-radius:999px; font-size:11px; font-weight:600;
          background:${u.status === 'active' ? '#D1FAE5' : u.status === 'pending' ? '#FEF3C7' : '#FEE2E2'};
          color:${u.status === 'active' ? '#065F46' : u.status === 'pending' ? '#92400E' : '#991B1B'};">
          ${esc(u.status)}
        </span>
      </td>
      <td>
        <span style="font-weight:700; color:${over ? 'var(--danger)' : 'var(--muted)'};">${strikes} / ${limit}</span>
        ${over ? '<span style="font-size:10px; color:var(--danger); font-weight:700;"> ⚠ LIMIT</span>' : ''}
      </td>
      <td style="white-space:nowrap;">
        ${u.status === 'pending'
            ? `<button class="btn" style="width:auto; padding:6px 12px; font-size:11px; margin-right:6px;" onclick="approveUser('${esc(u.email)}')">✅ Approve</button>`
            : ''}
        ${u.email !== currentUser.email
            ? `<button class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:11px;" onclick="toggleUser('${esc(u.email)}')">${u.status === 'suspended' ? 'Activate' : 'Suspend'}</button>`
            : ''}
      </td>
    </tr>`;
      }).join('');

      document.getElementById('kpiTotalUsers').textContent = USERS.length;
      document.getElementById('kpiActiveUsers').textContent = USERS.filter(u => u.status === 'active').length;
      document.getElementById('kpiPendingUsers').textContent = USERS.filter(u => u.status === 'pending').length;
      document.getElementById('kpiSuspendedUsers').textContent = USERS.filter(u => u.status === 'suspended').length;
    }

    /* ===================================================
       USER MANAGEMENT
       =================================================== */
    async function addUser() {
      const name = document.getElementById('auName').value.trim();
      const email = document.getElementById('auEmail').value.trim().toLowerCase();
      const pass = document.getElementById('auPass').value;
      const role = document.getElementById('auRole').value;
      const limit = parseInt(document.getElementById('auLimit').value, 10) || 3;

      const err = document.getElementById('addUserError');
      const ok = document.getElementById('addUserSuccess');
      err.classList.remove('show'); ok.classList.remove('show');

      if (!name || !email || !pass) { showError(err, 'Name, email and password are required'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError(err, 'Enter a valid email address'); return; }
      if (pass.length < 6) { showError(err, 'Password must be at least 6 characters'); return; }

      try {
        await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({ name, email, password: pass, role, accessLimit: limit })
        });

        ok.textContent = `✅ User "${name}" created as ${role.toUpperCase()}. Login: ${email} / ${pass}`;
        ok.classList.add('show');

        document.getElementById('auName').value = '';
        document.getElementById('auEmail').value = '';
        document.getElementById('auPass').value = '';
        document.getElementById('auLimit').value = 3;

        await refreshUsers();
        toast('User created ✅');
      } catch (e) {
        let msg = 'Failed to create user';
        try { msg = JSON.parse(e.message).error; } catch(err) {}
        showError(err, msg);
      }
    }

    async function approveUser(email) {
      try {
        await apiFetch(`/users/${encodeURIComponent(email)}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'active' })
        });
        await refreshUsers();
        toast('User approved ✅');
      } catch (e) {
        toast('Error approving user');
      }
    }

    async function toggleUser(email) {
      const u = USERS.find(x => x.email === email);
      if (!u) return;
      
      const newStatus = u.status === 'suspended' ? 'active' : 'suspended';
      try {
        await apiFetch(`/users/${encodeURIComponent(email)}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus })
        });
        await refreshUsers();
        toast(`User ${newStatus}`);
      } catch (e) {
        toast('Error updating user');
      }
    }

    /* ===================================================
       AUDIT
       =================================================== */
    function logAudit(action, entity) {
      auditLogs.unshift({
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        actor: currentUser ? currentUser.email : 'system',
        action, entity
      });
      renderAudit();
    }

    function renderAudit() {
      document.getElementById('auditTable').innerHTML = auditLogs.map(l => `
    <tr>
      <td>${esc(l.time)}</td>
      <td><b>${esc(l.actor)}</b></td>
      <td>${esc(l.action)}</td>
      <td><code style="font-size:12px; color:var(--muted);">${esc(l.entity)}</code></td>
    </tr>`).join('');
    }

    /* ===================================================
       ADMIN ALERTS
       =================================================== */
    function pushAlert(level, title, detail) {
      adminAlerts.unshift({
        level, title, detail,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        read: false
      });
      renderAlerts();
    }

    function renderAlerts() {
      const list = document.getElementById('alertsList');
      if (!list) return;

      if (!adminAlerts.length) {
        list.innerHTML = `<div class="muted-empty">
      <div style="font-size:48px; margin-bottom:10px;">✅</div>
      <p>No alerts right now. All clear.</p>
    </div>`;
      } else {
        const icons = { critical: '🚨', warning: '⚠️', info: 'ℹ️' };
        list.innerHTML = adminAlerts.map(a => `
      <div class="alert-item alert-${a.level}">
        <div class="alert-icon">${icons[a.level] || 'ℹ️'}</div>
        <div style="flex:1;">
          <div class="alert-title">${esc(a.title)}</div>
          <div class="alert-detail">${esc(a.detail)}</div>
        </div>
        <div class="alert-time">${esc(a.time)}</div>
      </div>`).join('');
      }

      const unread = adminAlerts.filter(a => !a.read).length;
      const bb = document.getElementById('bellBadge');
      if (bb) { bb.textContent = unread; bb.style.display = unread ? 'flex' : 'none'; }
      const nb = document.getElementById('navAlertBadge');
      if (nb) { nb.textContent = unread; nb.style.display = unread ? 'inline-block' : 'none'; }
    }

    function openAlerts() {
      if (ROLES[currentUser.role].pages.includes('alerts')) showPage('alerts');
    }

    function clearAlerts() {
      adminAlerts = [];
      renderAlerts();
      toast('Alerts cleared');
    }

    /* ===================================================
       EVALUATE FORM
       =================================================== */
    function getSelectedDevice() {
      const el = document.querySelector('.radio-card.selected');
      return el ? el.dataset.value : 'Office Laptop';
    }

    document.querySelectorAll('.radio-card').forEach(c => {
      c.onclick = () => {
        document.querySelectorAll('.radio-card').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
      };
    });

    function evaluateRisk() {
      refreshEvalTime();

      const ctx = {
        device: getSelectedDevice(),
        location: document.getElementById('evLocation').value,
        resource: document.getElementById('evResource').value,
        fails: parseInt(document.getElementById('evFails').value, 10) || 0,
        hour: new Date().getHours()
      };

      const result = computeRisk(ctx);
      const full = Object.assign({}, ctx, result);
      pendingRequest = full;

      document.getElementById('resultEmpty').style.display = 'none';
      document.getElementById('resultContent').style.display = 'block';
      document.getElementById('otpPanel').style.display = 'none';
      document.getElementById('otpMsg').textContent = '';

      paintResult(full);

      if (full.decision === 'CHALLENGE') {
        startOtp();
      } else {
        finalizeDecision(full);
      }
    }

    function paintResult(ctx) {
      const color = ctx.decision === 'ALLOW' ? 'var(--success)'
        : ctx.decision === 'CHALLENGE' ? 'var(--warning)'
          : ctx.decision === 'RESTRICT' ? 'var(--caution)'
            : 'var(--danger)';
      const deg = (ctx.score / 100) * 360;
      document.getElementById('scoreRing').style.background =
        `conic-gradient(${color} 0deg ${deg}deg, #F1F5F9 ${deg}deg 360deg)`;

      document.getElementById('scoreValue').textContent = ctx.score;
      const db = document.getElementById('decisionBig');
      db.textContent = ctx.decision;
      db.className = 'decision-big decision-' + ctx.decision.toLowerCase();
      document.getElementById('recommendedAction').textContent = ctx.action;
      document.getElementById('reasonList').innerHTML = ctx.reasons.map(r => `<li>${esc(r)}</li>`).join('');
    }

    /* ---------- OTP (CHALLENGE band) ---------- */
    function startOtp() {
      // cryptographically stronger than Math.random for a demo
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      otpCode = String(100000 + (buf[0] % 900000));
      otpAttempts = 0;

      document.getElementById('otpPanel').style.display = 'block';
      document.getElementById('otpEmail').textContent = currentUser.email;
      document.getElementById('otpDemo').textContent = otpCode;
      document.getElementById('otpInput').value = '';
      const msg = document.getElementById('otpMsg');
      msg.textContent = ''; msg.style.color = '';

      toast('📧 OTP sent to ' + currentUser.email);
    }

    function verifyOtp() {
      const val = document.getElementById('otpInput').value.trim();
      const msg = document.getElementById('otpMsg');
      if (!pendingRequest || !otpCode) return;

      if (val === otpCode) {
        msg.style.color = 'var(--success)';
        msg.textContent = '✅ OTP verified — access granted';

        const ctx = pendingRequest;
        ctx.decision = 'ALLOW';
        ctx.action = 'Grant full access (OTP verified)';
        ctx.reasons = ctx.reasons.concat(['OTP verified successfully ✓']);
        paintResult(ctx);

        document.getElementById('otpPanel').style.display = 'none';
        finalizeDecision(ctx);

        pendingRequest = null; otpCode = null;
      } else {
        otpAttempts++;
        msg.style.color = 'var(--danger)';
        msg.textContent = `❌ Invalid OTP (attempt ${otpAttempts}/3)`;

        if (otpAttempts >= 3) {
          const ctx = pendingRequest;
          ctx.decision = 'DENY';
          ctx.action = 'Block access + alert admin';
          ctx.reasons = ctx.reasons.concat(['OTP failed 3 times → escalated to DENY']);
          paintResult(ctx);

          document.getElementById('otpPanel').style.display = 'none';
          finalizeDecision(ctx);

          pendingRequest = null; otpCode = null;
        }
      }
    }

    /* ---------- FINALIZE: log, strikes, alerts ---------- */
    function finalizeDecision(ctx) {
      const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      accessLogs.unshift({
        time,
        user: currentUser.email,
        device: ctx.device,
        location: ctx.location,
        resource: ctx.resource,
        score: ctx.score,
        decision: ctx.decision
      });

      renderFeed();
      renderHistory();
      renderKpis();

      const u = USERS.find(x => x.email === currentUser.email);

      if (u && (ctx.decision === 'RESTRICT' || ctx.decision === 'DENY')) {
        u.strikes = (u.strikes || 0) + 1;

        if (ctx.decision === 'DENY') {
          pushAlert('critical',
            `🚫 Access DENIED — ${u.name}`,
            `${u.email} · ${ctx.device} · ${ctx.location} · ${ctx.resource} · Score ${ctx.score}`);
        } else {
          pushAlert('warning',
            `⚠️ Access RESTRICTED — ${u.name}`,
            `${u.email} · ${ctx.device} · ${ctx.location} · ${ctx.resource} · Score ${ctx.score}`);
        }

        if (u.strikes >= u.accessLimit) {
          pushAlert('critical',
            `🚨 ACCESS LIMIT CROSSED — ${u.name} (${u.strikes}/${u.accessLimit})`,
            `User ${u.email} (role: ${u.role}) has exceeded the allowed risky attempts. Immediate admin review required.`);
        }

        updateSidebarLimit();
        renderUsers();
        logAudit('RISK_DECISION', `access:${u.email}:${ctx.decision}`);
      }

      toast(`${ctx.decision} — Score: ${ctx.score}`);
      if (currentUser.role !== 'admin' && (ctx.decision === 'RESTRICT' || ctx.decision === 'DENY')) {
        setTimeout(() => toast('🔔 Admin has been notified'), 1200);
      }
    }

    /* ===================================================
       SIMULATOR — uses the REAL engine
       =================================================== */
    const SCENARIOS = [
      { time: '10:00 AM', hour: 10, device: 'Office Laptop', location: 'Mumbai, India', resource: 'Normal File' },
      { time: '08:00 PM', hour: 20, device: 'Personal Laptop', location: 'Mumbai, India', resource: 'Sensitive Customer Data' },
      { time: '02:00 AM', hour: 2, device: 'New Phone', location: 'New York, USA', resource: 'Sensitive Customer Data' },
      { time: '03:00 PM', hour: 15, device: 'Office Laptop', location: 'Mumbai, India', resource: 'Admin Panel' }
    ];

    function runSimulator() {
      const colors = { ALLOW: 'var(--success)', CHALLENGE: 'var(--warning)', RESTRICT: 'var(--caution)', DENY: 'var(--danger)' };

      document.getElementById('simTimeline').innerHTML = SCENARIOS.map((s, i) => {
        const r = computeRisk({ device: s.device, location: s.location, resource: s.resource, fails: 0, hour: s.hour });
        return `
    <div class="timeline-item" style="animation:fadeIn .3s ease ${i * 0.1}s both;">
      <div class="timeline-dot" style="background:${colors[r.decision]};"></div>
      <div class="timeline-card">
        <div class="timeline-time">${esc(s.time)}</div>
        <div class="timeline-title">${esc(s.device)} · ${esc(s.location)}</div>
        <div class="timeline-meta">${esc(s.resource)} · Score: <b>${r.score}</b> · ${esc(r.action)}</div>
        <div style="margin-top:10px;">${badge(r.decision)}</div>
        <ul class="reason-list" style="margin:10px 0 0;">
          ${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}
        </ul>
      </div>
    </div>`;
      }).join('');

      toast('All 4 scenarios executed ✅');
    }

    /* ===================================================
       CHARTS
       =================================================== */
    function renderCharts() {
      const t = document.getElementById('trendChart');
      const d = document.getElementById('decisionChart');
      if (!t || !d) return;

      if (t.chartInstance) t.chartInstance.destroy();
      if (d.chartInstance) d.chartInstance.destroy();

      t.chartInstance = new Chart(t, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Avg Risk Score',
            data: [22, 35, 18, 42, 28, 55, 30],
            borderColor: '#6366F1',
            backgroundColor: 'rgba(99,102,241,.1)',
            fill: true, tension: .4, borderWidth: 3,
            pointBackgroundColor: '#6366F1', pointRadius: 5, pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, max: 100, grid: { color: '#F1F5F9' } }, x: { grid: { display: false } } }
        }
      });

      const counts = ['ALLOW', 'CHALLENGE', 'RESTRICT', 'DENY'].map(dc =>
        accessLogs.filter(l => l.decision === dc).length
      );

      d.chartInstance = new Chart(d, {
        type: 'doughnut',
        data: {
          labels: ['Allow', 'Challenge', 'Restrict', 'Deny'],
          datasets: [{
            data: counts.some(c => c > 0) ? counts : [0, 0, 0, 0],
            backgroundColor: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%', animation: { duration: 500 },
          plugins: { legend: { position: 'bottom', labels: { padding: 16, font: { family: 'Inter', size: 12 }, usePointStyle: true } } }
        }
      });
    }

    /* ===================================================
       TOAST
       =================================================== */
    function toast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('show'), 2500);
    }

    /* ===================================================
       FIREWALL (WAF) & API
       =================================================== */
    async function apiFetch(path, options = {}) {
      const headers = { 'Content-Type': 'application/json' };
      const token = localStorage.getItem('fc03_token');
      if (token) headers['Authorization'] = 'Bearer ' + token;
      
      const res = await fetch('/api' + path, {
        headers,
        ...options
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }

    async function wafRefresh() {
      try {
        const logs  = await apiFetch('/firewall/logs');
        const rules = await apiFetch('/firewall/rules');
        
        document.getElementById('kpiWafBlocked').textContent = logs.length;
        document.getElementById('kpiWafRules').textContent = rules.length;
        
        const lt = document.getElementById('wafLogTable');
        lt.innerHTML = !logs.length ? '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No intercepted attacks.</td></tr>' : logs.map(l => `
          <tr>
            <td>${new Date(l.timestamp).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</td>
            <td><code style="font-size:12px;background:#FEE2E2;color:#991B1B;padding:2px 6px;border-radius:4px;">${esc(l.ip_address)}</code></td>
            <td>${esc(l.method)}</td>
            <td>${esc(l.path)}</td>
            <td style="color:var(--danger);font-weight:600;">${esc(l.reason)}</td>
          </tr>
        `).join('');

        const rt = document.getElementById('wafRulesTable');
        rt.innerHTML = !rules.length ? '<tr><td colspan="4" style="text-align:center;color:var(--muted)">No IPs blocked.</td></tr>' : rules.map(r => `
          <tr>
            <td><b>${esc(r.ip_address)}</b></td>
            <td>${esc(r.reason)}</td>
            <td>${esc(r.created_by)}</td>
            <td><button class="btn btn-secondary" style="padding:4px 8px;font-size:11px;" onclick="wafRemoveRule('${r.id}')">Unblock</button></td>
          </tr>
        `).join('');
      } catch (err) {
        console.error(err);
      }
    }

    async function wafAddRule() {
      const ip_address = document.getElementById('wafIp').value.trim();
      const reason = document.getElementById('wafReason').value.trim();
      if (!ip_address) return toast('IP Address is required');
      
      try {
        await apiFetch('/firewall/rules', {
          method: 'POST',
          body: JSON.stringify({ ip_address, reason })
        });
        document.getElementById('wafIp').value = '';
        document.getElementById('wafReason').value = '';
        toast('IP Blocked 🚫');
        wafRefresh();
      } catch (err) {
        toast('Error: ' + err.message);
      }
    }

    async function wafRemoveRule(id) {
      try {
        await apiFetch('/firewall/rules/' + id, { method: 'DELETE' });
        toast('IP Unblocked ✅');
        wafRefresh();
      } catch (err) {
        toast('Error: ' + err.message);
      }
    }

    // Auto-refresh WAF if active
    setInterval(() => {
      const p = document.getElementById('page-firewall');
      if (p && p.classList.contains('active')) wafRefresh();
    }, 10000);

    /* ===================================================
       LOGOUT
       =================================================== */
    function doLogout() {
      localStorage.removeItem('fc03_token');
      currentUser = null;
      pendingRequest = null;
      otpCode = null;
      document.getElementById('appPage').classList.remove('show');
      document.getElementById('authPage').style.display = 'grid';
      document.getElementById('loginEmail').value = 'admin@bank.com';
      document.getElementById('loginPass').value = 'admin123';
      toast('Logged out');
    }

    /* ===================================================
       KEYBOARD SHORTCUTS
       =================================================== */
    document.getElementById('loginPass').addEventListener('keypress', e => {
      if (e.key === 'Enter') doLogin();
    });
    document.getElementById('otpInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') verifyOtp();
    });
  