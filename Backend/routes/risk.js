const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { computeRisk, POLICIES, THRESHOLDS } = require('../services/riskEngine');
const supabase = require('../config/supabase');

router.post('/evaluate', protect, async (req, res) => {
  try {
    const { device, location, resource, fails = 0 } = req.body;
    const hour = new Date().getHours();
    const ctx = { device, location, resource, fails, hour };
    const result = computeRisk(ctx);

    const { data: log, error: logError } = await supabase
      .from('access_logs')
      .insert([{
        user_email: req.user.email,
        device,
        location,
        resource,
        fails,
        score: result.score,
        decision: result.decision,
        reasons: result.reasons
      }])
      .select()
      .single();

    if (logError) throw logError;

    let updatedUser = req.user;

    if (result.decision === 'RESTRICT' || result.decision === 'DENY') {
      const newStrikes = req.user.strikes + 1;
      
      const { data: u } = await supabase
        .from('users')
        .update({ strikes: newStrikes })
        .eq('id', req.user.id)
        .select()
        .single();
      
      if (u) updatedUser = u;

      await supabase.from('alerts').insert([{
        level: result.decision === 'DENY' ? 'critical' : 'warning',
        title: 'Access ' + result.decision + ' - ' + req.user.name,
        detail: req.user.email + ' - ' + device + ' - ' + location + ' - ' + resource + ' - Score ' + result.score
      }]);

      if (newStrikes >= req.user.access_limit) {
        await supabase.from('alerts').insert([{
          level: 'critical',
          title: 'ACCESS LIMIT CROSSED - ' + req.user.name + ' (' + newStrikes + '/' + req.user.access_limit + ')',
          detail: 'User ' + req.user.email + ' (' + req.user.role + ') exceeded risky attempts.'
        }]);
      }

      await supabase.from('audit_logs').insert([{
        actor: req.user.email,
        action: 'RISK_DECISION',
        entity: 'access:' + req.user.email + ':' + result.decision
      }]);
    }

    res.json({
      logId: log.id,
      score: result.score,
      decision: result.decision,
      action: result.action,
      reasons: result.reasons,
      strikes: updatedUser.strikes,
      accessLimit: updatedUser.access_limit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/policies', protect, (req, res) => {
  res.json({
    policies: POLICIES.map(p => ({ key: p.key, weight: p.weight })),
    thresholds: THRESHOLDS
  });
});

router.post('/simulate', protect, (req, res) => {
  const scenarios = [
    { time: '10:00 AM', hour: 10, device: 'Office Laptop',   location: 'Mumbai, India',   resource: 'Normal File' },
    { time: '08:00 PM', hour: 20, device: 'Personal Laptop', location: 'Mumbai, India',   resource: 'Sensitive Customer Data' },
    { time: '02:00 AM', hour: 2,  device: 'New Phone',       location: 'New York, USA',   resource: 'Sensitive Customer Data' },
    { time: '03:00 PM', hour: 15, device: 'Office Laptop',   location: 'Mumbai, India',   resource: 'Admin Panel' }
  ];
  const results = scenarios.map(s =>
    Object.assign({}, s, computeRisk(Object.assign({}, s, { fails: 0 })))
  );
  res.json({ results });
});

module.exports = router;
