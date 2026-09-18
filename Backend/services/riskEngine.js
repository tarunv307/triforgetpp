const POLICIES = [
  { key: 'Office laptop (managed)',  weight: -10, test: c => c.device === 'Office Laptop' },
  { key: 'Personal laptop',          weight:   5, test: c => c.device === 'Personal Laptop' },
  { key: 'New phone',                weight:  25, test: c => c.device === 'New Phone' },
  { key: 'Unknown device',           weight:  35, test: c => c.device === 'Unknown Device' },
  { key: 'Trusted location (India)', weight: -10, test: c => c.location.includes('India') },
  { key: 'Foreign location',         weight:  30, test: c => !c.location.includes('India') },
  { key: 'Normal hours (06-23)',     weight:  -5, test: c => !isOddHour(c.hour) },
  { key: 'Odd hours (00-05)',        weight:  15, test: c => isOddHour(c.hour) },
  { key: 'Sensitive resource',       weight:  20, test: c => c.resource === 'Sensitive Customer Data' },
  { key: 'Admin resource',           weight:  30, test: c => c.resource === 'Admin Panel' },
  { key: 'Failed attempts >= 3',     weight:  20, test: c => c.fails >= 3 }
];

const THRESHOLDS = [
  { decision: 'ALLOW',     min: 0,  max: 25,  action: 'Grant full access' },
  { decision: 'CHALLENGE', min: 26, max: 50,  action: 'Request OTP / MFA' },
  { decision: 'RESTRICT',  min: 51, max: 75,  action: 'Limited access + log' },
  { decision: 'DENY',      min: 76, max: 100, action: 'Block access + alert admin' }
];

const isOddHour = h => h >= 0 && h <= 5;

function computeRisk(ctx) {
  let score = 0;
  const reasons = [];

  POLICIES.forEach(p => {
    if (p.test(ctx)) {
      score += p.weight;
      reasons.push(p.key + ' (' + (p.weight > 0 ? '+' : '') + p.weight + ')');
    }
  });

  score = Math.max(0, Math.min(100, score));

  let decision = 'ALLOW', action = 'Grant full access';
  for (const t of THRESHOLDS) {
    if (score >= t.min && score <= t.max) {
      decision = t.decision;
      action = t.action;
      break;
    }
  }

  return { score, decision, action, reasons };
}

module.exports = { computeRisk, POLICIES, THRESHOLDS };
