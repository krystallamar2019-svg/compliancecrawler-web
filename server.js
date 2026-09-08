const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 8080);
const sourceHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const checkoutPatch = `
<script>
(() => {
  const JUST_COMPLIANCE_CHECKOUT = 'https://book.stripe.com/test_00wbJ27Ib4mce2V9idcEw00';
  const FULL_BRAND_AUDIT_CHECKOUT = 'https://book.stripe.com/test_5kQ3cwaUn2e45wp1PLcEw01';

  function checkout(url) {
    window.location.href = url;
  }

  function renderPaidModal(id, title, copy, bullets, price, checkoutUrl) {
    const card = document.querySelector('#' + id + ' .modal-card');
    if (!card) return;

    card.innerHTML =
      '<button class="close" onclick="closeModal(\\'' + id + '\\')" aria-label="Close">×</button>' +
      '<h2>' + title + '</h2>' +
      '<p>' + copy + '</p>' +
      '<div class="result" style="display:block;margin:16px 0">' +
      bullets.map(x => '• ' + x).join('<br>') +
      '</div>' +
      '<p style="font-size:28px;font-weight:700;margin:14px 0">$' + price + '</p>' +
      '<button class="action" id="checkout-' + id + '">Continue to Secure Checkout →</button>' +
      '<div class="notice">One-time payment. Automated guidance identifies potential issues and is not legal advice or legal certification.</div>';

    document.getElementById('checkout-' + id).onclick = () => checkout(checkoutUrl);
  }

  window.openCompliance = function() {
    renderPaidModal(
      'complianceModal',
      'Just Compliance',
      'A focused review of one website, offer, page, or promotion for potential compliance and disclosure concerns.',
      [
        'Compliance review',
        'Plain language report',
        'Clear next steps'
      ],
      '49',
      JUST_COMPLIANCE_CHECKOUT
    );

    openModal('complianceModal');
  };

  window.openAudit = function() {
    renderPaidModal(
      'auditModal',
      'Full Brand Audit',
      'Review how your offers, websites, partnerships, promotions, disclosures, and messaging work together under one brand.',
      [
        'Full brand review',
        'Cross-offer analysis',
        'Prioritized action plan'
      ],
      '149',
      FULL_BRAND_AUDIT_CHECKOUT
    );

    openModal('auditModal');
  };

  window.showFit = function(title, copy) {
    const r = document.getElementById('fitResult');
    if (!r) return;

    const isAudit = title === 'Full Brand Audit';
    const checkoutUrl = isAudit
      ? FULL_BRAND_AUDIT_CHECKOUT
      : JUST_COMPLIANCE_CHECKOUT;

    const price = isAudit ? '149' : '49';

    r.innerHTML =
      '<strong>' + title + '</strong><br>' +
      copy +
      '<br><button class="action" id="fitCheckout" style="margin-top:14px">' +
      'Choose ' + title + ' · $' + price + ' →</button>';

    r.style.display = 'block';

    document.getElementById('fitCheckout').onclick = () => checkout(checkoutUrl);
  };
})();
</script>`;

const html = sourceHtml.includes('</body>')
  ? sourceHtml.replace('</body>', checkoutPatch + '\n</body>')
  : sourceHtml + checkoutPatch;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8'
    });

    return res.end(JSON.stringify({
      ok: true,
      service: 'brandedalign-web'
    }));
  }

  if (url.pathname === '/robots.txt') {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8'
    });

    return res.end('User-agent: *\nAllow: /\n');
  }

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });

  res.end(html);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`BrandedAlign web listening on ${port}`);
});
