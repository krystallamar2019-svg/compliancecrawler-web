(() => {
  const PLANS = {
    steward: { name: 'Steward', price: '$39', description: 'Focused ongoing review for a growing brand.', bullets: ['10 scans per billing cycle', 'Up to 3 websites', 'Up to 100 pages per scan'] },
    harvest: { name: 'Harvest', price: '$89', description: 'Best fit for multi-offer brands and deeper review.', bullets: ['30 scans per billing cycle', 'Up to 10 websites', 'Up to 500 pages per scan'] },
    abundance: { name: 'Abundance', price: '$249', description: 'Higher-capacity review for active teams and ecosystems.', bullets: ['100 scans per billing cycle', 'Up to 40 websites', 'Up to 1,000 pages per scan'] }
  };

  function addStyles() {
    if (document.getElementById('baCustomerFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'baCustomerFixStyles';
    style.textContent = `
      .ba-sub-overlay{position:fixed;inset:0;z-index:100100;background:rgba(7,27,36,.72);display:none;align-items:center;justify-content:center;padding:20px;line-height:1.35}
      .ba-sub-overlay.open{display:flex}
      .ba-sub-shell{width:min(980px,100%);max-height:92vh;overflow:auto;background:#fffdf8;border:1px solid rgba(232,184,76,.45);border-radius:28px;padding:28px;box-shadow:0 34px 100px rgba(0,0,0,.32);position:relative}
      .ba-sub-shell h2{font-family:Georgia,'Times New Roman',serif;color:#102a3a;font-size:clamp(32px,4vw,48px);line-height:1.05;margin:0 46px 8px 0}
      .ba-sub-intro{color:#536b76;line-height:1.65;margin:0 0 22px;max-width:780px}
      .ba-sub-close{position:absolute;top:18px;right:18px;border:1px solid rgba(16,42,58,.12);background:#fff;border-radius:999px;width:40px;height:40px;font-size:24px;cursor:pointer;color:#173a4d}
      .ba-sub-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .ba-sub-plan{border:1px solid rgba(16,42,58,.12);border-radius:20px;background:#fff;padding:20px;display:flex;flex-direction:column;min-height:285px;box-shadow:0 10px 28px rgba(16,42,58,.05)}
      .ba-sub-plan.selected{border-color:#e8b84c;box-shadow:0 0 0 2px rgba(232,184,76,.18),0 16px 36px rgba(16,42,58,.08)}
      .ba-sub-plan[data-plan="harvest"]{background:linear-gradient(180deg,#fffdfb,#fff7f2)}
      .ba-sub-name{font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#102a3a;font-weight:700}
      .ba-sub-price{font-family:Georgia,'Times New Roman',serif;font-size:30px;color:#102a3a;margin:8px 0}.ba-sub-price span{font-family:Arial,sans-serif;font-size:13px;color:#71838a;font-weight:600}
      .ba-sub-desc{font-size:14px;line-height:1.5;color:#536b76;margin-bottom:12px}.ba-sub-list{font-size:13px;line-height:1.65;color:#36555f;margin:0 0 18px;padding-left:18px}
      .ba-sub-choose{margin-top:auto;border:1px solid #b98649;border-radius:999px;padding:12px 14px;background:linear-gradient(#fff7e8,#e4bd82);color:#2d241a;font-family:Georgia,'Times New Roman',serif;font-size:16px;cursor:pointer}
      .ba-sub-auth{margin-top:20px;border-top:1px solid rgba(16,42,58,.10);padding-top:18px}.ba-sub-auth h3{font-family:Georgia,'Times New Roman',serif;color:#173a4d;margin:0 0 8px;font-size:22px}.ba-sub-auth p{color:#536b76;line-height:1.55;margin:6px 0 12px}
      .ba-sub-auth-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:660px}.ba-sub-auth-grid input{width:100%;height:46px;border:1px solid #c8d2d2;border-radius:10px;padding:0 12px;font-size:16px;box-sizing:border-box}
      .ba-sub-auth-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}.ba-sub-auth-actions button{border-radius:999px;padding:11px 16px;cursor:pointer;font-weight:700}.ba-sub-primary{border:1px solid #b98649;background:linear-gradient(#fff7e8,#e4bd82);color:#2d241a}.ba-sub-secondary{border:1px solid rgba(11,100,119,.25);background:#f4fbfa;color:#0b6477}
      .ba-sub-status{margin-top:10px;padding:10px 12px;border-radius:12px;background:#f4fbfa;color:#36555f;line-height:1.45;display:none}.ba-sub-status.show{display:block}.ba-sub-status.error{display:block;background:#fff0ec;color:#a1452f}
      .ba-sub-security{margin-top:18px;padding:13px 15px;border:1px solid rgba(11,100,119,.18);border-radius:14px;background:#f4fbfa;color:#36555f;font-size:12px;line-height:1.5}.ba-sub-security strong{color:#102a3a}
      .ba-price-cover{position:absolute;z-index:4;top:74.2%;height:7.5%;pointer-events:none;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;line-height:1.08;box-shadow:0 6px 18px rgba(16,42,58,.08);border:1px solid rgba(185,134,73,.24)}
      .ba-price-cover strong{font-family:Georgia,'Times New Roman',serif;font-size:clamp(11px,2.2vw,23px);color:#102a3a}.ba-price-cover span{font-size:clamp(8px,1.35vw,13px);color:#5b6d75;margin-top:4px;font-weight:700}
      .ba-price-steward{left:5.7%;width:28%;background:linear-gradient(180deg,#fffdf8,#fff8eb)}.ba-price-harvest{left:35.5%;width:29%;background:linear-gradient(180deg,#fffaf7,#fff1eb)}
      @media(max-width:760px){.ba-sub-grid{grid-template-columns:1fr}.ba-sub-auth-grid{grid-template-columns:1fr}.ba-sub-shell{padding:22px}.ba-sub-plan{min-height:0}}
    `;
    document.head.appendChild(style);
  }

  function status(message, isError) {
    const el = document.getElementById('baSubStatus');
    if (!el) return;
    el.textContent = message || '';
    el.className = 'ba-sub-status' + (message ? ' show' : '') + (isError ? ' error' : '');
  }

  function ensureOverlay() {
    if (document.getElementById('baSubOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'baSubOverlay';
    overlay.className = 'ba-sub-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.innerHTML = `
      <div class="ba-sub-shell">
        <button class="ba-sub-close" type="button" aria-label="Close">×</button>
        <h2 id="baSubTitle">Choose your BrandedAlign plan</h2>
        <p class="ba-sub-intro">Choose the capacity that fits your brand. Stripe hosts payment securely. BrandedAlign unlocks paid access only after the verified Stripe webhook confirms your subscription.</p>
        <div class="ba-sub-grid">
          <article class="ba-sub-plan" data-plan="steward"><div class="ba-sub-name">Steward</div><div class="ba-sub-price">$39 <span>/ month</span></div><div class="ba-sub-desc">Focused ongoing review for a growing brand.</div><ul class="ba-sub-list"><li>10 scans per billing cycle</li><li>Up to 3 websites</li><li>Up to 100 pages per scan</li></ul><button class="ba-sub-choose" data-plan="steward" type="button">Choose Steward →</button></article>
          <article class="ba-sub-plan" data-plan="harvest"><div class="ba-sub-name">Harvest</div><div class="ba-sub-price">$89 <span>/ month</span></div><div class="ba-sub-desc">Best fit for multi-offer brands and deeper review.</div><ul class="ba-sub-list"><li>30 scans per billing cycle</li><li>Up to 10 websites</li><li>Up to 500 pages per scan</li></ul><button class="ba-sub-choose" data-plan="harvest" type="button">Choose Harvest →</button></article>
          <article class="ba-sub-plan" data-plan="abundance"><div class="ba-sub-name">Abundance</div><div class="ba-sub-price">$249 <span>/ month</span></div><div class="ba-sub-desc">Higher-capacity review for active teams and ecosystems.</div><ul class="ba-sub-list"><li>100 scans per billing cycle</li><li>Up to 40 websites</li><li>Up to 1,000 pages per scan</li></ul><button class="ba-sub-choose" data-plan="abundance" type="button">Choose Abundance →</button></article>
        </div>
        <section class="ba-sub-auth"><h3>Secure account</h3><p id="baSubAuthCopy">Sign in or create an account before checkout.</p><div class="ba-sub-auth-grid" id="baSubAuthFields"><input id="baSubEmail" type="email" autocomplete="email" placeholder="Email"><input id="baSubPassword" type="password" autocomplete="current-password" minlength="8" placeholder="Password (8+ characters)"></div><div class="ba-sub-auth-actions" id="baSubAuthActions"><button id="baSubSignIn" class="ba-sub-primary" type="button">Sign in & continue</button><button id="baSubSignUp" class="ba-sub-secondary" type="button">Create account</button></div><div class="ba-sub-status" id="baSubStatus"></div></section>
        <div class="ba-sub-security"><strong>Billing security.</strong> A successful browser redirect does not unlock access. The Stripe webhook must verify the event and update the subscription state first.</div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.ba-sub-close').addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
    overlay.querySelectorAll('.ba-sub-choose').forEach(btn => btn.addEventListener('click', () => startCheckout(btn.dataset.plan)));
    document.getElementById('baSubSignIn').addEventListener('click', signInAndContinue);
    document.getElementById('baSubSignUp').addEventListener('click', signUpAndContinue);
  }

  function choose(planKey) {
    ensureOverlay();
    const key = PLANS[planKey] ? planKey : 'harvest';
    const overlay = document.getElementById('baSubOverlay');
    overlay.dataset.plan = key;
    overlay.querySelectorAll('.ba-sub-plan').forEach(card => card.classList.toggle('selected', card.dataset.plan === key));
    document.getElementById('baSubTitle').textContent = PLANS[key].name + ' · ' + PLANS[key].price + '/month';
    return key;
  }

  async function refreshAuth() {
    const fields = document.getElementById('baSubAuthFields');
    const actions = document.getElementById('baSubAuthActions');
    const copy = document.getElementById('baSubAuthCopy');
    try {
      const result = await sb.auth.getSession();
      const session = result && result.data ? result.data.session : null;
      if (session && session.user) {
        fields.style.display = 'none';
        actions.style.display = 'none';
        copy.textContent = 'Signed in as ' + (session.user.email || 'your BrandedAlign account') + '. Choose a plan above to continue to Stripe Checkout.';
      } else {
        fields.style.display = 'grid';
        actions.style.display = 'flex';
        copy.textContent = 'Sign in or create an account before checkout.';
      }
    } catch (_) {
      fields.style.display = 'grid';
      actions.style.display = 'flex';
    }
  }

  function openPlans(planKey) {
    choose(planKey || 'harvest');
    const overlay = document.getElementById('baSubOverlay');
    overlay.classList.add('open');
    status('');
    refreshAuth();
  }

  async function startCheckout(planKey) {
    const key = choose(planKey || (document.getElementById('baSubOverlay') || {}).dataset.plan || 'harvest');
    document.getElementById('baSubOverlay').classList.add('open');
    status('Preparing secure checkout…');
    try {
      const auth = await sb.auth.getSession();
      const session = auth && auth.data ? auth.data.session : null;
      if (!session || !session.access_token) {
        status('Sign in or create your account below, then we will continue to Stripe Checkout.');
        await refreshAuth();
        const email = document.getElementById('baSubEmail');
        if (email) email.focus();
        return;
      }
      const response = await fetch(API_URL + '/billing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
        body: JSON.stringify({ plan_key: key })
      });
      let payload = {};
      try { payload = await response.json(); } catch (_) {}
      if (!response.ok) throw new Error(payload.detail || payload.message || 'Unable to create Stripe Checkout.');
      const checkoutUrl = payload.url || payload.checkout_url || payload.checkoutUrl;
      if (!checkoutUrl) throw new Error('Stripe Checkout did not return a checkout URL.');
      status('Opening Stripe Checkout…');
      window.location.assign(checkoutUrl);
    } catch (err) {
      status(err && err.message ? err.message : 'Unable to start checkout.', true);
    }
  }

  async function signInAndContinue() {
    const email = (document.getElementById('baSubEmail').value || '').trim();
    const password = document.getElementById('baSubPassword').value || '';
    if (!email || password.length < 8) return status('Enter your email and a password of at least 8 characters.', true);
    status('Signing in…');
    try {
      const result = await sb.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      await refreshAuth();
      await startCheckout(document.getElementById('baSubOverlay').dataset.plan || 'harvest');
    } catch (err) { status(err && err.message ? err.message : 'Unable to sign in.', true); }
  }

  async function signUpAndContinue() {
    const email = (document.getElementById('baSubEmail').value || '').trim();
    const password = document.getElementById('baSubPassword').value || '';
    if (!email || password.length < 8) return status('Enter your email and a password of at least 8 characters.', true);
    status('Creating your account…');
    try {
      const result = await sb.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (result.data && result.data.session) {
        await refreshAuth();
        await startCheckout(document.getElementById('baSubOverlay').dataset.plan || 'harvest');
      } else {
        status('Account created. Check your email to confirm it, then return here and sign in to continue.');
      }
    } catch (err) { status(err && err.message ? err.message : 'Unable to create your account.', true); }
  }

  function addPriceCovers() {
    const page = document.getElementById('visualPage');
    if (!page || document.getElementById('baStewardCover')) return;
    const steward = document.createElement('div');
    steward.id = 'baStewardCover';
    steward.className = 'ba-price-cover ba-price-steward';
    steward.innerHTML = '<strong>Steward · $39/mo</strong><span>Membership · secure Stripe checkout</span>';
    const harvest = document.createElement('div');
    harvest.id = 'baHarvestCover';
    harvest.className = 'ba-price-cover ba-price-harvest';
    harvest.innerHTML = '<strong>Harvest · $89/mo</strong><span>Recommended for full brand review</span>';
    page.append(steward, harvest);
  }

  function installCapture() {
    if (document.documentElement.dataset.baSubscriptionCapture === '1') return;
    document.documentElement.dataset.baSubscriptionCapture = '1';
    document.addEventListener('click', e => {
      const target = e.target && e.target.closest ? e.target.closest('.hs-just-card,.hs-just-hero,.hs-audit-card,.hs-audit-hero,.hs-top-start,.hs-final-start,.hs-pricing,.hs-foot-pricing') : null;
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (target.matches('.hs-just-card,.hs-just-hero')) openPlans('steward');
      else if (target.matches('.hs-audit-card,.hs-audit-hero')) openPlans('harvest');
      else openPlans('harvest');
    }, true);
  }

  function overrideLegacyPaths() {
    window.openCompliance = () => openPlans('steward');
    window.openAudit = () => openPlans('harvest');
    window.showFit = (title, copy) => {
      const result = document.getElementById('fitResult');
      if (!result) return;
      const planKey = title === 'Full Brand Audit' ? 'harvest' : 'steward';
      const meta = PLANS[planKey];
      result.textContent = '';
      const strong = document.createElement('strong');
      strong.textContent = title + ' → ' + meta.name;
      result.append(strong, document.createElement('br'), document.createTextNode(copy || 'Choose the membership capacity that fits your brand.'), document.createElement('br'));
      const btn = document.createElement('button');
      btn.className = 'action';
      btn.type = 'button';
      btn.style.marginTop = '14px';
      btn.textContent = 'See ' + meta.name + ' · ' + meta.price + '/mo →';
      btn.addEventListener('click', () => openPlans(planKey));
      result.appendChild(btn);
      result.style.display = 'block';
      result.classList.remove('hide');
    };
  }

  function init() {
    addStyles();
    ensureOverlay();
    addPriceCovers();
    installCapture();
    overrideLegacyPaths();
    setTimeout(overrideLegacyPaths, 250);
    setTimeout(overrideLegacyPaths, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
