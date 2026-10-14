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
    .form-group {
      margin-top: 24px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 8px;
    }
    input[type="email"] {
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
    input[type="email"]:focus {
      border-color: var(--accent);
    }
    button {
      display: inline-block;
      margin-top: 16px;
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
    .feedback {
      margin-top: 14px;
      font-size: 14px;
      display: none;
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
      <form id="deletionForm">
        <div class="form-group">
          <label for="merchantEmail">Registered Merchant Email Address</label>
          <input type="email" id="merchantEmail" name="email" required placeholder="merchant@yourdomain.com">
        </div>
        <button type="submit" id="submitBtn">Request Account Deletion</button>
        <div id="feedbackMessage" class="feedback"></div>
      </form>
    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()} NilePay / InstaPay Gateway. All rights reserved.
    </div>
  </div>

  <script>
    const form = document.getElementById('deletionForm');
    const emailInput = document.getElementById('merchantEmail');
    const feedback = document.getElementById('feedbackMessage');
    const btn = document.getElementById('submitBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      if (!email) return;

      btn.disabled = true;
      btn.innerText = 'Submitting...';
      feedback.style.display = 'none';

      try {
        const res = await fetch('/api/account/deletion-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        feedback.style.display = 'block';
        feedback.style.color = '#10b981';
        feedback.innerText = data.message || 'If an account exists for this email, deletion instructions have been sent.';
        form.reset();
      } catch (err) {
        feedback.style.display = 'block';
        feedback.style.color = '#ef4444';
        feedback.innerText = 'Unable to submit deletion request. Please try again shortly.';
      } finally {
        btn.disabled = false;
        btn.innerText = 'Request Account Deletion';
      }
    });
  </script>
</body>
</html>`
}
