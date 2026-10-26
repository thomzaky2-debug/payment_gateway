export function renderAccountDeletionHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NilePay / InstaPay Gateway - Account & Data Deletion</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --border: rgba(51, 65, 85, 0.6);
      --danger: #ef4444;
      --success: #10b981;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      margin: 0;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
      line-height: 1.6;
    }
    .container {
      max-width: 680px;
      width: 100%;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: clamp(24px, 5vw, 40px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 28px;
      font-weight: 800;
      margin: 0 0 16px;
      letter-spacing: -0.5px;
    }
    h2 {
      font-size: 18px;
      font-weight: 700;
      margin: 28px 0 12px;
      color: #e2e8f0;
    }
    p, li {
      color: var(--text-muted);
      font-size: 14.5px;
    }
    ul {
      padding-left: 20px;
      margin: 10px 0;
    }
    li {
      margin-bottom: 8px;
    }
    .notice {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.25);
      border-radius: 12px;
      padding: 16px;
      margin: 24px 0;
    }
    .notice p {
      color: #fca5a5;
      margin: 0;
      font-size: 13.5px;
    }
    .step-indicators {
      display: flex;
      gap: 8px;
      margin: 20px 0 24px;
      flex-wrap: wrap;
    }
    .step-pill {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.12);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .step-pill.active {
      background: rgba(56, 189, 248, 0.2);
      color: var(--accent);
      border-color: var(--accent);
    }
    .step-pill.done {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
      border-color: var(--success);
    }
    .form-group {
      margin-top: 20px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 8px;
    }
    input[type="email"], input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: #090d16;
      color: #ffffff;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="email"]:focus, input[type="text"]:focus {
      border-color: var(--accent);
    }
    .btn-group {
      display: flex;
      gap: 12px;
      margin-top: 18px;
      align-items: center;
      flex-wrap: wrap;
    }
    button {
      display: inline-block;
      padding: 12px 24px;
      border-radius: 10px;
      border: none;
      background: var(--danger);
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover {
      opacity: 0.9;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-secondary {
      background: rgba(148, 163, 184, 0.2);
      color: #e2e8f0;
    }
    .btn-secondary:hover {
      background: rgba(148, 163, 184, 0.3);
    }
    .feedback {
      margin-top: 14px;
      font-size: 14px;
      display: none;
    }
    .success-box {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 12px;
      padding: 20px;
      margin-top: 20px;
    }
    .success-box h3 {
      color: var(--success);
      margin: 0 0 10px;
      font-size: 18px;
      font-weight: 700;
    }
    .success-box p {
      color: #d1fae5;
      margin: 6px 0;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <span class="badge">Privacy & Compliance</span>
      <h1>Merchant Account & Data Deletion</h1>
      <p>
        In accordance with Google Play Developer Policies and data protection principles, NilePay / InstaPay Gateway merchants can request permanent deletion of their account and associated personal data.
      </p>

      <h2>1. How to Delete Your Account</h2>
      <ul>
        <li><strong>In the NilePay Android App:</strong> Navigate to Settings &rarr; Security &rarr; Delete Account. Verify your password and 6-digit email confirmation code.</li>
        <li><strong>Web Form Below:</strong> If you have already uninstalled the application, submit your registered account email address below to receive confirmation instructions.</li>
      </ul>

      <h2>2. What Data Is Immediately Erased</h2>
      <p>Upon account deletion verification, the platform immediately and irrevocably erases:</p>
      <ul>
        <li>Personal contact details: Full name, business email, phone number, WhatsApp number, and profile image.</li>
        <li>Authentication credentials: Password hashes, active sessions, API keys, and webhook signing secrets.</li>
        <li>All enrolled detector devices, device tokens, and background synchronization heartbeats.</li>
        <li>All pending and queued webhook notifications.</li>
      </ul>

      <h2>3. Regulatory Data Retention</h2>
      <div class="notice">
        <p>
          <strong>Statutory Compliance Retention:</strong> Under Egyptian financial regulations and banking compliance standards, payment records, settled transactions, and immutable audit logs are retained for a statutory retention period (up to 5 years). All associated merchant names and personal identifiers within retained financial records are permanently anonymized.
        </p>
      </div>

      <h2>4. Submit a Deletion Request</h2>
      <div class="step-indicators">
        <span id="indicator1" class="step-pill active">Step 1: Request</span>
        <span id="indicator2" class="step-pill">Step 2: Enter Code</span>
        <span id="indicator3" class="step-pill">Step 3: Confirmed</span>
      </div>

      <!-- Step 1: Request Deletion Code -->
      <div id="step1">
        <form id="requestForm">
          <div class="form-group">
            <label for="merchantEmail">Registered Merchant Email Address</label>
            <input type="email" id="merchantEmail" name="email" required placeholder="merchant@yourdomain.com">
          </div>
          <div class="btn-group">
            <button type="submit" id="requestBtn">Send Confirmation Code</button>
          </div>
          <div id="step1Feedback" class="feedback"></div>
        </form>
      </div>

      <!-- Step 2: Confirm Single-Use Code -->
      <div id="step2" style="display: none;">
        <p>
          A single-use 6-digit confirmation code was sent to <strong id="targetEmailDisplay" style="color: var(--accent);"></strong>. It is valid for 30 minutes.
        </p>
        <form id="confirmForm">
          <div class="form-group">
            <label for="confirmationCode">6-Digit Confirmation Code</label>
            <input type="text" id="confirmationCode" name="code" required maxlength="6" pattern="[0-9]{6}" placeholder="123456" autocomplete="one-time-code">
          </div>
          <div class="btn-group">
            <button type="submit" id="confirmBtn">Confirm &amp; Permanently Delete Account</button>
            <button type="button" id="backBtn" class="btn-secondary">Change Email</button>
          </div>
          <div id="step2Feedback" class="feedback"></div>
        </form>
      </div>

      <!-- Step 3: Deletion Confirmed -->
      <div id="step3" style="display: none;">
        <div class="success-box">
          <h3>Account Deletion Completed</h3>
          <p>Your NilePay merchant account has been permanently deleted and personal data scrubbed.</p>
          <p>All active sessions, API keys, and device bindings have been immediately revoked, and pending webhooks canceled.</p>
          <p>Regulatory financial records are retained in an anonymized state for 5 years per statutory compliance requirements.</p>
        </div>
      </div>
    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()} NilePay / InstaPay Gateway. All rights reserved.
    </div>
  </div>

  <script src="/account-deletion.js"></script>
</body>
</html>`
}

export function renderAccountDeletionScript(): string {
  return `(function() {
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');

  const requestForm = document.getElementById('requestForm');
  const confirmForm = document.getElementById('confirmForm');

  const emailInput = document.getElementById('merchantEmail');
  const codeInput = document.getElementById('confirmationCode');

  const requestBtn = document.getElementById('requestBtn');
  const confirmBtn = document.getElementById('confirmBtn');
  const backBtn = document.getElementById('backBtn');

  const step1Feedback = document.getElementById('step1Feedback');
  const step2Feedback = document.getElementById('step2Feedback');
  const targetEmailDisplay = document.getElementById('targetEmailDisplay');

  let currentEmail = '';

  function setStep(step) {
    if (step1) step1.style.display = step === 1 ? 'block' : 'none';
    if (step2) step2.style.display = step === 2 ? 'block' : 'none';
    if (step3) step3.style.display = step === 3 ? 'block' : 'none';

    const ind1 = document.getElementById('indicator1');
    const ind2 = document.getElementById('indicator2');
    const ind3 = document.getElementById('indicator3');

    if (ind1) ind1.className = 'step-pill' + (step === 1 ? ' active' : (step > 1 ? ' done' : ''));
    if (ind2) ind2.className = 'step-pill' + (step === 2 ? ' active' : (step > 2 ? ' done' : ''));
    if (ind3) ind3.className = 'step-pill' + (step === 3 ? ' active' : '');
  }

  if (requestForm && emailInput) {
    requestForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = emailInput.value.trim();
      if (!email) return;

      if (requestBtn) {
        requestBtn.disabled = true;
        requestBtn.innerText = 'Sending Code...';
      }
      if (step1Feedback) step1Feedback.style.display = 'none';

      try {
        const res = await fetch('/api/account/deletion-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
        const data = await res.json();
        currentEmail = email;
        if (targetEmailDisplay) targetEmailDisplay.innerText = email;
        setStep(2);
        if (codeInput) {
          codeInput.value = '';
          codeInput.focus();
        }
      } catch (err) {
        if (step1Feedback) {
          step1Feedback.style.display = 'block';
          step1Feedback.style.color = '#ef4444';
          step1Feedback.innerText = 'Unable to send confirmation code. Please try again shortly.';
        }
      } finally {
        if (requestBtn) {
          requestBtn.disabled = false;
          requestBtn.innerText = 'Send Confirmation Code';
        }
      }
    });
  }

  if (confirmForm && codeInput) {
    confirmForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const code = codeInput.value.trim();
      if (!code || !currentEmail) return;

      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerText = 'Verifying...';
      }
      if (step2Feedback) step2Feedback.style.display = 'none';

      try {
        const res = await fetch('/api/account/deletion-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentEmail, code: code })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (step2Feedback) {
            step2Feedback.style.display = 'block';
            step2Feedback.style.color = '#ef4444';
            step2Feedback.innerText = data.error || 'Confirmation failed. Please try again.';
          }
          return;
        }

        setStep(3);
      } catch (err) {
        if (step2Feedback) {
          step2Feedback.style.display = 'block';
          step2Feedback.style.color = '#ef4444';
          step2Feedback.innerText = 'Network error during confirmation. Please try again.';
        }
      } finally {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerText = 'Confirm & Permanently Delete Account';
        }
      }
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', function() {
      setStep(1);
      if (step2Feedback) step2Feedback.style.display = 'none';
      if (codeInput) codeInput.value = '';
      if (emailInput) emailInput.focus();
    });
  }
})();`
}

