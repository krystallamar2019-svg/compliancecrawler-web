const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 8080);
const sourceHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const launchPatch = `
<style>
  #ba-deep-dives{padding:84px 22px;background:linear-gradient(180deg,#fffdf8 0%,#f7fbfa 100%);border-top:1px solid rgba(16,42,58,.08)}
  #ba-deep-dives .ba-wrap{width:min(1180px,100%);margin:0 auto}
  #ba-deep-dives .ba-kicker{display:block;text-transform:uppercase;letter-spacing:.18em;font-size:12px;font-weight:800;color:#8b6b38;margin-bottom:10px}
  #ba-deep-dives h2{font-family:Georgia,'Times New Roman',serif;color:#102a3a;font-size:clamp(34px,5vw,58px);line-height:1.02;margin:0 0 14px}
  #ba-deep-dives .ba-intro{max-width:780px;color:#536b76;font-size:17px;line-height:1.75;margin:0 0 32px}
  .ba-deep-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
  .ba-deep-card{background:rgba(255,255,255,.92);border:1px solid rgba(16,42,58,.09);border-radius:24px;padding:24px;box-shadow:0 14px 40px rgba(16,42,58,.07);display:flex;flex-direction:column;min-height:285px}
  .ba-deep-card .ba-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .ba-chip{font-size:11px;line-height:1;text-transform:uppercase;letter-spacing:.08em;padding:8px 10px;border-radius:999px;background:#edf7f6;color:#0b6477;font-weight:800}
  .ba-chip.ba-review{background:#fff5df;color:#7b5b20}.ba-chip.ba-pro{background:#fff0eb;color:#8f4938}
  .ba-deep-card h3{font-family:Georgia,'Times New Roman',serif;color:#102a3a;font-size:25px;line-height:1.16;margin:0 0 11px}
  .ba-deep-card p{color:#5b6d75;line-height:1.65;margin:0 0 18px}
  .ba-takeaway{border-left:3px solid #e8b84c;padding:10px 0 10px 14px;color:#173a4d;font-weight:700;margin-top:auto}
  .ba-deep-actions{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-top:18px}
  .ba-deep-actions button,.ba-legal-links button{border:0;background:none;color:#0b6477;font-weight:800;cursor:pointer;padding:0;text-decoration:underline;text-underline-offset:4px}
  .ba-reviewed{font-size:12px;color:#7b8c93}
  .ba-guidance-banner{margin:14px 0 18px;padding:14px 16px;border:1px solid rgba(11,100,119,.18);border-radius:16px;background:#f4fbfa;color:#36555f;font-size:13px;line-height:1.55}
  .ba-guidance-banner strong{color:#102a3a}
  .ba-ownership{margin-top:18px;padding-top:16px;border-top:1px solid rgba(16,42,58,.10);font-size:12px;line-height:1.65;color:#71838a}
  .ba-legal-links{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px}
  .ba-legal-overlay{position:fixed;inset:0;z-index:99999;background:rgba(7,27,36,.68);display:none;align-items:center;justify-content:center;padding:24px}
  .ba-legal-overlay.open{display:flex}
  .ba-legal-card{width:min(760px,100%);max-height:min(760px,88vh);overflow:auto;background:#fffdf8;border-radius:24px;padding:28px;box-shadow:0 30px 90px rgba(0,0,0,.28);position:relative}
  .ba-legal-card h2{font-family:Georgia,'Times New Roman',serif;color:#102a3a;font-size:36px;margin:0 42px 14px 0}
  .ba-legal-card h3{color:#173a4d;margin:22px 0 8px}
  .ba-legal-card p{color:#536b76;line-height:1.7}
  .ba-legal-close{position:absolute;top:18px;right:18px;border:0;background:#f1f5f4;border-radius:999px;width:38px;height:38px;font-size:24px;cursor:pointer;color:#173a4d}
  .ba-source-link{color:#0b6477;font-weight:800;text-decoration:none}
  .ba-source-link:hover{text-decoration:underline}
  @media(max-width:760px){.ba-deep-grid{grid-template-columns:1fr}#ba-deep-dives{padding:58px 18px}.ba-deep-card{min-height:0}}
</style>
<script>
(() => {
  const OWNER = 'TeamUpWithKrystal';
  const COPYRIGHT = '© 2026 TeamUpWithKrystal. All rights reserved.';
  const DISCLAIMER = 'BrandedAlign provides automated educational information, risk spotting, and organizational guidance. It is not a law firm and does not provide legal advice, legal opinions, legal certification, or a guarantee of compliance. Results are not a determination that content, conduct, or a business practice is lawful or unlawful. Laws, regulations, platform rules, and standards change and can vary by jurisdiction and circumstance. You remain responsible for your decisions and what you publish. For high-risk, regulated, jurisdiction-specific, or uncertain issues, consult a qualified attorney or other appropriate professional. Use of BrandedAlign does not create an attorney-client relationship.';

  function cleanRisk(v) {
    if (v === 'professional_review_advised') return 'Professional review advised';
    if (v === 'review_recommended') return 'Review recommended';
    return 'Informational';
  }

  function riskClass(v) {
    if (v === 'professional_review_advised') return 'ba-pro';
    if (v === 'review_recommended') return 'ba-review';
    return '';
  }

  function fmtDate(v) {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
  }

  function safeUrl(v) {
    try {
      const u = new URL(v);
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
    } catch (_) { return ''; }
  }

  function addGuidanceBanner(target, compact) {
    if (!target || target.querySelector('.ba-guidance-banner')) return;
    const box = document.createElement('div');
    box.className = 'ba-guidance-banner';
    const strong = document.createElement('strong');
    strong.textContent = 'Guidance, not a legal verdict. ';
    box.appendChild(strong);
    box.appendChild(document.createTextNode(compact
      ? 'BrandedAlign identifies signals worth reviewing. It does not certify compliance or replace qualified professional advice.'
      : 'Findings are designed to help you spot potential issues, ask better questions, and prioritize review. They are not a determination that something is legal, illegal, compliant, or noncompliant.'));
    target.prepend(box);
  }

  function ensureLegalModal() {
    if (document.getElementById('baLegalOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'baLegalOverlay';
    overlay.className = 'ba-legal-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','baLegalTitle');
    overlay.innerHTML =
      '<div class="ba-legal-card">' +
        '<button class="ba-legal-close" type="button" aria-label="Close">×</button>' +
        '<h2 id="baLegalTitle">BrandedAlign Disclaimer & Use</h2>' +
        '<p id="baLegalDisclaimer"></p>' +
        '<h3>Automated analysis</h3>' +
        '<p>BrandedAlign can miss issues, surface false positives, or interpret context differently than a regulator, court, platform, professional, or human reviewer. A low-risk result is not a safe harbor. A flagged item is a prompt for review, not an accusation or legal conclusion.</p>' +
        '<h3>Changing rules and sources</h3>' +
        '<p>Deep Dives summarize selected official guidance and other sources for educational use. Source material can change after a Deep Dive is reviewed. When a decision carries legal, financial, health, privacy, accessibility, intellectual-property, employment, or other regulated consequences, verify the current primary source and obtain qualified advice where appropriate.</p>' +
        '<h3>Ownership & copyright</h3>' +
        '<p>' + COPYRIGHT + ' BrandedAlign is owned and operated by ' + OWNER + '. Unless otherwise identified, original BrandedAlign text, interface content, graphics, organization, and educational materials are provided for personal or internal business use and may not be republished, resold, scraped, copied in bulk, or represented as another party\'s work without permission. Third-party names, marks, quotations, links, and source materials remain the property of their respective owners.</p>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById('baLegalDisclaimer').textContent = DISCLAIMER;
    overlay.querySelector('.ba-legal-close').addEventListener('click',()=>overlay.classList.remove('open'));
    overlay.addEventListener('click',e=>{ if(e.target===overlay) overlay.classList.remove('open'); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') overlay.classList.remove('open'); });
  }

  function openLegal() {
    ensureLegalModal();
    document.getElementById('baLegalOverlay').classList.add('open');
  }

  function addOwnershipFooter() {
    const footer = document.querySelector('footer.footer, footer');
    if (!footer || document.getElementById('baOwnership')) return;
    const block = document.createElement('div');
    block.id = 'baOwnership';
    block.className = 'ba-ownership';
    const line1 = document.createElement('div');
    line1.textContent = COPYRIGHT + ' BrandedAlign is owned and operated by ' + OWNER + '.';
    const line2 = document.createElement('div');
    line2.textContent = 'Automated educational guidance only. No legal advice, legal certification, or guarantee of compliance.';
    const links = document.createElement('div');
    links.className = 'ba-legal-links';
    const disclaimer = document.createElement('button');
    disclaimer.type = 'button';
    disclaimer.textContent = 'Disclaimer';
    disclaimer.addEventListener('click',openLegal);
    const copyright = document.createElement('button');
    copyright.type = 'button';
    copyright.textContent = 'Copyright & Use';
    copyright.addEventListener('click',openLegal);
    links.append(disclaimer,copyright);
    block.append(line1,line2,links);
    footer.appendChild(block);
  }

  function openDive(dive) {
    ensureLegalModal();
    const overlay = document.getElementById('baLegalOverlay');
    const card = overlay.querySelector('.ba-legal-card');
    const title = card.querySelector('h2');
    const disclaimer = card.querySelector('#baLegalDisclaimer');
    title.textContent = dive.title || 'Deep Dive';
    disclaimer.textContent = '';

    Array.from(card.querySelectorAll('.ba-dynamic')).forEach(n=>n.remove());
    const wrap = document.createElement('div');
    wrap.className = 'ba-dynamic';

    const meta = document.createElement('p');
    meta.textContent = (dive.category || 'Deep Dive') + ' · ' + cleanRisk(dive.risk_level) + (dive.reviewed_at ? ' · Reviewed ' + fmtDate(dive.reviewed_at) : '');
    wrap.appendChild(meta);

    String(dive.body || '').split(/\n\s*\n/).filter(Boolean).forEach(part=>{
      const p = document.createElement('p');
      p.textContent = part;
      wrap.appendChild(p);
    });

    const take = document.createElement('div');
    take.className = 'ba-takeaway';
    take.textContent = 'Safer takeaway: ' + (dive.safe_takeaway || 'Review the source and use qualified advice when the stakes are high.');
    wrap.appendChild(take);

    const href = safeUrl(dive.source_url);
    if (href) {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.className = 'ba-source-link';
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Primary source: ' + (dive.source_label || href);
      p.appendChild(a);
      wrap.appendChild(p);
    }

    const note = document.createElement('p');
    note.textContent = 'This Deep Dive is educational guidance, not legal advice or a guarantee of compliance.';
    wrap.appendChild(note);

    card.insertBefore(wrap, card.querySelector('h3'));
    overlay.classList.add('open');
  }

  function renderDeepDiveCard(dive) {
    const card = document.createElement('article');
    card.className = 'ba-deep-card';

    const meta = document.createElement('div');
    meta.className = 'ba-meta';
    const cat = document.createElement('span');
    cat.className = 'ba-chip';
    cat.textContent = dive.category || 'Deep Dive';
    const risk = document.createElement('span');
    risk.className = 'ba-chip ' + riskClass(dive.risk_level);
    risk.textContent = cleanRisk(dive.risk_level);
    meta.append(cat,risk);

    const h = document.createElement('h3');
    h.textContent = dive.title || 'Deep Dive';
    const p = document.createElement('p');
    p.textContent = dive.summary || '';
    const take = document.createElement('div');
    take.className = 'ba-takeaway';
    take.textContent = dive.safe_takeaway || '';

    const actions = document.createElement('div');
    actions.className = 'ba-deep-actions';
    const read = document.createElement('button');
    read.type = 'button';
    read.textContent = 'Read Deep Dive →';
    read.addEventListener('click',()=>openDive(dive));
    const reviewed = document.createElement('span');
    reviewed.className = 'ba-reviewed';
    reviewed.textContent = dive.reviewed_at ? 'Reviewed ' + fmtDate(dive.reviewed_at) : '';
    actions.append(read,reviewed);

    card.append(meta,h,p,take,actions);
    return card;
  }

  async function loadDeepDives() {
    const grid = document.getElementById('baDeepDiveGrid');
    if (!grid) return;
    try {
      if (typeof sb === 'undefined') throw new Error('Content client unavailable');
      const {data,error} = await sb
        .from('deep_dives')
        .select('slug,title,summary,body,safe_takeaway,category,risk_level,source_label,source_url,source_type,reviewed_at,display_order,published_at')
        .eq('published',true)
        .order('display_order',{ascending:true})
        .order('published_at',{ascending:false});
      if (error) throw error;
      grid.textContent = '';
      (data || []).forEach(d=>grid.appendChild(renderDeepDiveCard(d)));
      if (!data || !data.length) {
        const p = document.createElement('p');
        p.textContent = 'Deep Dives are being reviewed for publication.';
        grid.appendChild(p);
      }
    } catch (err) {
      grid.textContent = '';
      const p = document.createElement('p');
      p.textContent = 'Deep Dives are temporarily unavailable. Please use the linked primary sources in your report and check back.';
      grid.appendChild(p);
      console.error('BrandedAlign Deep Dives failed to load:',err);
    }
  }

  function addDeepDiveSection() {
    if (document.getElementById('ba-deep-dives')) return;
    const section = document.createElement('section');
    section.id = 'ba-deep-dives';
    const wrap = document.createElement('div');
    wrap.className = 'ba-wrap';
    const kicker = document.createElement('span');
    kicker.className = 'ba-kicker';
    kicker.textContent = 'Deep Dives · Source Reviewed';
    const h2 = document.createElement('h2');
    h2.textContent = 'Know why something was flagged.';
    const intro = document.createElement('p');
    intro.className = 'ba-intro';
    intro.textContent = 'Short, source-linked explainers turn a finding into a safer next step. BrandedAlign deliberately uses review language instead of pretending an automated scan can make a legal determination.';
    const grid = document.createElement('div');
    grid.id = 'baDeepDiveGrid';
    grid.className = 'ba-deep-grid';
    const loading = document.createElement('p');
    loading.textContent = 'Loading reviewed guidance…';
    grid.appendChild(loading);
    wrap.append(kicker,h2,intro,grid);
    section.appendChild(wrap);
    const footer = document.querySelector('footer.footer, footer');
    if (footer) footer.parentNode.insertBefore(section,footer);
    else document.body.appendChild(section);
  }

  function addGuidanceNotices() {
    const dash = document.querySelector('.dashmain');
    if (dash) addGuidanceBanner(dash,true);
    const seed = document.getElementById('seedResult');
    if (seed) {
      const observer = new MutationObserver(()=> {
        if (!seed.classList.contains('hide')) addGuidanceBanner(seed,true);
      });
      observer.observe(seed,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }
  }

  function repairEntryPaths() {
    window.openCompliance = function() {
      const pricing = document.getElementById('pricing');
      if (pricing) pricing.scrollIntoView({behavior:'smooth'});
      if (typeof toast === 'function') toast('For a focused ongoing review, Steward is the starting paid plan.');
    };
    window.openAudit = function() {
      const pricing = document.getElementById('pricing');
      if (pricing) pricing.scrollIntoView({behavior:'smooth'});
      if (typeof toast === 'function') toast('For a multi-offer brand audit, Harvest is the recommended starting plan.');
    };
    window.showFit = function(title, copy) {
      const r = document.getElementById('fitResult');
      if (!r) return;
      const plan = title === 'Full Brand Audit' ? 'Harvest' : 'Steward';
      r.textContent = '';
      const strong = document.createElement('strong');
      strong.textContent = title + ' → ' + plan;
      r.appendChild(strong);
      r.appendChild(document.createElement('br'));
      r.appendChild(document.createTextNode(copy || 'Review the plan details below, then choose the capacity that fits your brand.'));
      r.appendChild(document.createElement('br'));
      const btn = document.createElement('button');
      btn.className = 'action';
      btn.style.marginTop = '14px';
      btn.type = 'button';
      btn.textContent = 'See ' + plan + ' plan →';
      btn.addEventListener('click',()=>{
        const pricing = document.getElementById('pricing');
        if (pricing) pricing.scrollIntoView({behavior:'smooth'});
      });
      r.appendChild(btn);
      r.style.display = 'block';
      r.classList.remove('hide');
    };
  }

  function initLaunchLayer() {
    ensureLegalModal();
    addDeepDiveSection();
    addOwnershipFooter();
    addGuidanceNotices();
    repairEntryPaths();
    loadDeepDives();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',initLaunchLayer,{once:true});
  } else {
    initLaunchLayer();
  }
})();
</script>`;

const ownershipMeta = '<meta name="copyright" content="© 2026 TeamUpWithKrystal"><meta name="author" content="TeamUpWithKrystal">';
let html = sourceHtml.includes('</head>')
  ? sourceHtml.replace('</head>', ownershipMeta + '\n</head>')
  : sourceHtml;

html = html.includes('</body>')
  ? html.replace('</body>', launchPatch + '\n</body>')
  : html + launchPatch;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8'
    });

    return res.end(JSON.stringify({
      ok: true,
      service: 'brandedalign-web',
      owner: 'TeamUpWithKrystal',
      content: 'deep-dives-enabled'
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
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });

  res.end(html);
});

server.listen(port, '0.0.0.0', () => {
  console.log('BrandedAlign launch layer active: TeamUpWithKrystal + Deep Dives');
  console.log(`BrandedAlign web listening on ${port}`);
});
