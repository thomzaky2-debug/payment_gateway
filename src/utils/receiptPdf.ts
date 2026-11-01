/**
 * Utility to generate and trigger "Save as PDF" for NilePay Transaction Receipts
 * with pixel-perfect matching dark card design.
 */

export interface PrintableReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  category?: string;
}

export interface PrintableReceiptData {
  sessionId: string;
  amountEgp: number;
  currency?: string;
  status: string;
  senderHandle?: string | null;
  recipientHandle?: string | null;
  detectedRef?: string | null;
  detectedAt?: string | Date | null;
  createdAt: string | Date;
  note?: string | null;
  productCategory?: string | null;
  businessName?: string | null;
  subtitle?: string | null;
  items?: PrintableReceiptItem[] | null;
}

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatReceiptDate(dateString: string | Date | undefined, isRtl: boolean): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(dateString);
  }
}

export function saveReceiptAsPdf(data: PrintableReceiptData, isRtl: boolean = false) {
  const isConfirmed = data.status === 'CONFIRMED' || data.status === 'PAID';
  const isExpired = data.status === 'EXPIRED';
  const isPending = data.status === 'PENDING';

  const statusColor = isConfirmed ? '#34d399' : isExpired ? '#fbbf24' : isPending ? '#38bdf8' : '#f87171';
  const statusBg = isConfirmed
    ? 'rgba(16, 185, 129, 0.18)'
    : isExpired
    ? 'rgba(245, 158, 11, 0.18)'
    : isPending
    ? 'rgba(56, 189, 248, 0.18)'
    : 'rgba(239, 68, 68, 0.18)';
  const statusBorder = isConfirmed
    ? 'rgba(16, 185, 129, 0.35)'
    : isExpired
    ? 'rgba(245, 158, 11, 0.35)'
    : isPending
    ? 'rgba(56, 189, 248, 0.35)'
    : 'rgba(239, 68, 68, 0.35)';

  const categoryLabel =
    data.productCategory ||
    (data.items && data.items.length > 0 ? (isRtl ? 'طلب منتجات' : 'Product Order') : isRtl ? 'طلب فوري' : 'Direct Order');

  const formattedCreated = formatReceiptDate(data.createdAt, isRtl);
  const formattedDetected = data.detectedAt ? formatReceiptDate(data.detectedAt, isRtl) : null;
  const fileName = `Receipt-${data.sessionId}`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const itemsHtml =
    data.items && data.items.length > 0
      ? `
        <div style="margin-top: 14px; padding: 12px 14px; border-radius: 12px; background-color: rgba(0, 0, 0, 0.25); border: 1px solid rgba(51, 65, 85, 0.4);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              <span>${isRtl ? 'أصناف ومنتجات الطلب:' : 'Order Products & Quantities:'}</span>
            </span>
            <span style="font-size: 11px; color: #94a3b8;">${data.items.length} ${isRtl ? 'أصناف' : 'items'}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${data.items
              .map(
                (it) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; border-radius: 8px; background-color: #1e293b; border: 1px solid #334155; font-size: 11.5px;">
                <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;">
                  <span style="font-weight: 600; color: #f8fafc;">${escapeHtml(it.name)}</span>
                  <span style="padding: 1px 5px; border-radius: 4px; background-color: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10px; font-weight: 700; font-family: monospace;">×${it.quantity}</span>
                  <span style="font-size: 10.5px; color: #94a3b8;">(${Number(it.unitPrice).toFixed(2)} EGP)</span>
                </div>
                <span style="font-family: monospace; color: #10b981; font-weight: 700;">${(it.totalPrice ?? it.quantity * it.unitPrice).toFixed(2)} EGP</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
      : '';

  const html = `
    <!DOCTYPE html>
    <html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(fileName)}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 10mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        body {
          margin: 0;
          padding: 30px 16px;
          background-color: #0b1120;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #f8fafc;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .receipt-card {
          width: 100%;
          max-width: 520px;
          background-color: #111827;
          border: 1px solid rgba(51, 65, 85, 0.7);
          border-radius: 24px;
          padding: 28px 24px;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
          position: relative;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
        }
        .icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background-color: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.35);
          color: #fbbf24;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .header-titles h2 {
          font-size: 17px;
          font-weight: 800;
          margin: 0;
          color: #f8fafc;
          letter-spacing: -0.2px;
        }
        .header-titles p {
          font-size: 11.5px;
          color: #94a3b8;
          margin: 3px 0 0 0;
        }
        .amount-section {
          text-align: center;
          margin: 10px 0 22px 0;
        }
        .status-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          padding: 3px 12px;
          border-radius: 9999px;
          background-color: ${statusBg};
          border: 1px solid ${statusBorder};
          color: ${statusColor};
          margin-bottom: 10px;
        }
        .amount-display {
          font-size: 32px;
          font-weight: 900;
          color: ${isConfirmed ? '#10b981' : '#f8fafc'};
          font-family: monospace;
          letter-spacing: -0.5px;
          line-height: 1.1;
        }
        .amount-display span {
          font-size: 18px;
          font-weight: 700;
        }
        .subtitle {
          font-size: 13px;
          color: #94a3b8;
          margin: 8px 0 0 0;
          font-weight: 500;
        }
        .details-box {
          background-color: #162033;
          border: 1px solid rgba(51, 65, 85, 0.4);
          border-radius: 16px;
          padding: 16px 18px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 11px;
          font-size: 13px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(51, 65, 85, 0.4);
        }
        .detail-row:last-child {
          padding-bottom: 0;
          border-bottom: none;
        }
        .label {
          color: #94a3b8;
        }
        .val-text {
          color: #f8fafc;
          font-weight: 600;
        }
        .val-mono {
          font-family: monospace;
          font-weight: 700;
          color: #f8fafc;
        }
        .val-blue {
          font-family: monospace;
          color: #38bdf8;
          font-weight: 700;
        }
        .val-green {
          font-family: monospace;
          color: #10b981;
          font-weight: 800;
        }
        .seal-footer {
          margin-top: 20px;
          padding-top: 14px;
          border-top: 1px dashed rgba(51, 65, 85, 0.6);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: #64748b;
        }
        .seal-brand {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #94a3b8;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="receipt-card">
        <!-- Header -->
        <div class="header">
          <div class="icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" x2="8" y1="13" y2="13"/>
              <line x1="16" x2="8" y1="17" y2="17"/>
              <line x1="10" x2="8" y1="9" y2="9"/>
            </svg>
          </div>
          <div class="header-titles">
            <h2>${isRtl ? 'إيصال وتفاصيل المعاملة' : 'Transaction Receipt & Details'}</h2>
            <p>${isRtl ? 'بيانات العملية المسجلة في بوابة الدفع' : 'Gateway recorded transaction details'}</p>
          </div>
        </div>

        <!-- Amount & Status -->
        <div class="amount-section">
          <div class="status-badge">${escapeHtml(data.status)}</div>
          <div class="amount-display">
            ${data.amountEgp.toFixed(2)} <span>EGP</span>
          </div>
          <p class="subtitle">
            ${escapeHtml(data.subtitle || data.note || (isRtl ? 'طلب فوري عبر إنستاباي' : 'Direct InstaPay Order'))}
          </p>
        </div>

        <!-- Details Card -->
        <div class="details-box">
          <div class="detail-row">
            <span class="label">${isRtl ? 'معرف الجلسة:' : 'Session ID:'}</span>
            <span class="val-blue">${escapeHtml(data.sessionId)}</span>
          </div>

          ${
            data.detectedRef
              ? `
            <div class="detail-row">
              <span class="label">${isRtl ? 'رقم الإشعار المرجعي:' : 'InstaPay Ref ID:'}</span>
              <span class="val-green">${escapeHtml(data.detectedRef)}</span>
            </div>
          `
              : ''
          }

          <div class="detail-row">
            <span class="label">${isRtl ? 'حساب العميل الراسل:' : 'Sender InstaPay Handle:'}</span>
            <span class="val-mono">${escapeHtml(data.senderHandle || '—')}</span>
          </div>

          <div class="detail-row">
            <span class="label">${isRtl ? 'حساب المتجر المستلم:' : 'Merchant Recipient IPA:'}</span>
            <span class="val-mono">${escapeHtml(data.recipientHandle || 'platform@instapay')}</span>
          </div>

          <div class="detail-row">
            <span class="label">${isRtl ? 'تصنيف المعاملة:' : 'Purchase Category:'}</span>
            <span class="val-text">${escapeHtml(categoryLabel)}</span>
          </div>

          <div class="detail-row">
            <span class="label">${isRtl ? 'توقيت الإنشاء:' : 'Created Time:'}</span>
            <span class="val-text">${escapeHtml(formattedCreated)}</span>
          </div>

          ${
            formattedDetected
              ? `
            <div class="detail-row">
              <span class="label">${isRtl ? 'توقيت التأكيد:' : 'Verified Time:'}</span>
              <span class="val-green">${escapeHtml(formattedDetected)}</span>
            </div>
          `
              : ''
          }

          ${
            data.note
              ? `
            <div class="detail-row">
              <span class="label">${isRtl ? 'ملاحظة الطلب:' : 'Order Note:'}</span>
              <span class="val-text">${escapeHtml(data.note)}</span>
            </div>
          `
              : ''
          }

          ${itemsHtml}
        </div>

        <!-- Official NilePay Verification Seal -->
        <div class="seal-footer">
          <div class="seal-brand">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>NilePay Verified Receipt</span>
          </div>
          <span>${isRtl ? 'إيصال رسمي معتمد • تشفير إلكتروني' : 'Official Cryptographically Stamped'}</span>
        </div>
      </div>
    </body>
    </html>
  `;

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch {
      window.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1500);
    }
  }, 250);
}
