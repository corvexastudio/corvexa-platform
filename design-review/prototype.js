// CaptoDesk Interactive Prototype & Design Review State Engine
// Strictly Simulated Demo Data - Zero Live SMS, Telephony, or Financial Transactions

const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

const PROTOTYPE_STATE = {
  currentScreen: urlParams.get('screen') || 'dashboard',
  deviceMode: urlParams.get('device') || 'desktop', // 'desktop', 'mobile', 'comparison'
  theme: urlParams.get('theme') || 'light',
  activeJourney: null,
  journeyStep: 0,
  onboardingStep: parseInt(urlParams.get('step') || '1', 10),
  
  // Simulated Data Stores
  fictionalData: {
    orgName: 'Apex Plumbing & Drain Solutions',
    ownerName: 'Dave Miller',
    phone: '[Your active CaptoDesk DID]',
    trade: 'Plumbing',
    carrier: 'Verizon',
    ccfCode: '*71 + [10-digit CaptoDesk DID]',
    ccfDeactivate: '*73',
    didStatus: 'pending_10dlc', // 'pending_10dlc', 'active_verified'
    
    // Recent Triage & Leads
    leads: [
      { id: 'lead-1', name: 'Sarah Jenkins', phone: '(512) 555-••92 (Demo)', service: 'Emergency Water Heater Leak', urgency: 'Emergency', time: '4m ago', status: 'New', source: 'Missed Call Auto-Text' },
      { id: 'lead-2', name: 'Robert Vance', phone: '(512) 555-••21 (Demo)', service: 'Main Sewer Line Cleanout', urgency: 'Normal', time: '22m ago', status: 'Contacted', source: 'Web Booking Form' },
      { id: 'lead-3', name: 'Marcus Brody', phone: '(512) 555-••90 (Demo)', service: 'Tankless Water Heater Flush', urgency: 'Normal', time: '1h ago', status: 'Booked', source: 'Customer Referral' }
    ],
    
    // Today's Jobs
    jobs: [
      { id: 'job-1042', title: 'Emergency Water Heater Diagnostic', customer: 'Sarah Jenkins', address: '742 Evergreen Terrace, Austin', time: '09:00 AM - 10:30 AM', status: 'en_route', tech: 'Dave (Solo)', total: 229.00 },
      { id: 'job-1043', title: 'Main Sewer Cleanout & Camera', customer: 'Robert Vance', address: '1804 Oak Crest Ave, Austin', time: '11:30 AM - 01:00 PM', status: 'scheduled', tech: 'Dave (Solo)', total: 385.00 },
      { id: 'job-1044', title: 'Tankless Flush & Descale', customer: 'Marcus Brody', address: '902 Barton Springs Rd, Austin', time: '02:30 PM - 04:00 PM', status: 'scheduled', tech: 'Dave (Solo)', total: 195.00 }
    ],
    
    // Invoices
    invoices: [
      { id: 'inv-2041', customer: 'Sarah Jenkins', job: '#JOB-1042', amount: 229.00, status: 'unpaid', date: 'Today' },
      { id: 'inv-2040', customer: 'David Kim', job: '#JOB-1039', amount: 450.00, status: 'paid', date: 'Yesterday' }
    ]
  }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateViewportFrame();
});

function setupEventListeners() {
  if (PROTOTYPE_STATE.theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.innerHTML = '🌙 Dark';
  }

  // Screen selector
  const screenSelect = document.getElementById('screenSelect');
  if (screenSelect) {
    screenSelect.value = PROTOTYPE_STATE.currentScreen;
    screenSelect.addEventListener('change', (e) => {
      PROTOTYPE_STATE.currentScreen = e.target.value;
      renderScreen();
    });
  }

  // Viewport mode buttons
  document.querySelectorAll('[data-device]').forEach(btn => {
    if (btn.dataset.device === PROTOTYPE_STATE.deviceMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-device]').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      PROTOTYPE_STATE.deviceMode = target.dataset.device;
      updateViewportFrame();
    });
  });

  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      PROTOTYPE_STATE.theme = PROTOTYPE_STATE.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', PROTOTYPE_STATE.theme);
      themeToggle.innerHTML = PROTOTYPE_STATE.theme === 'light' ? '☀️ Light' : '🌙 Dark';
    });
  }

  // Journey buttons
  document.querySelectorAll('[data-journey]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const journey = e.currentTarget.dataset.journey;
      startInteractiveJourney(journey);
    });
  });
}

function updateViewportFrame() {
  const frame = document.getElementById('viewportFrame');
  if (!frame) return;
  
  frame.className = `viewport-frame ${PROTOTYPE_STATE.deviceMode}`;
  renderScreen();
}

// Master Render Router for 22 Screens
function renderScreen() {
  const container = document.getElementById('screenMount');
  const screenId = PROTOTYPE_STATE.currentScreen;
  const isMobile = PROTOTYPE_STATE.deviceMode === 'mobile';
  const isComparison = PROTOTYPE_STATE.deviceMode === 'comparison';

  if (!container) return;

  if (isComparison) {
    renderComparisonMode(container, screenId);
    return;
  }

  // Render proposed redesign
  switch (screenId) {
    case 'landing':
      container.innerHTML = renderLandingScreen(isMobile);
      break;
    case 'login':
      container.innerHTML = renderLoginScreen(isMobile);
      break;
    case 'onboarding':
      container.innerHTML = renderOnboardingScreen(isMobile);
      break;
    case 'dashboard':
      container.innerHTML = renderDashboardScreen(isMobile);
      break;
    case 'leads':
      container.innerHTML = renderLeadsScreen(isMobile);
      break;
    case 'inbox':
      container.innerHTML = renderInboxScreen(isMobile);
      break;
    case 'customers':
      container.innerHTML = renderCustomersScreen(isMobile);
      break;
    case 'calendar':
      container.innerHTML = renderCalendarScreen(isMobile);
      break;
    case 'jobs':
      container.innerHTML = renderJobsScreen(isMobile);
      break;
    case 'field':
      container.innerHTML = renderFieldPortalScreen(isMobile);
      break;
    case 'services':
      container.innerHTML = renderServicesScreen(isMobile);
      break;
    case 'quotes':
      container.innerHTML = renderQuotesScreen(isMobile);
      break;
    case 'invoices':
      container.innerHTML = renderInvoicesScreen(isMobile);
      break;
    case 'reviews':
      container.innerHTML = renderReviewsScreen(isMobile);
      break;
    case 'automations':
      container.innerHTML = renderAutomationsScreen(isMobile);
      break;
    case 'notifications':
      container.innerHTML = renderNotificationsScreen(isMobile);
      break;
    case 'team':
      container.innerHTML = renderTeamScreen(isMobile);
      break;
    case 'settings':
      container.innerHTML = renderSettingsScreen(isMobile);
      break;
    case 'book_slug':
      container.innerHTML = renderPublicBookingScreen(isMobile);
      break;
    case 'track_token':
      container.innerHTML = renderPublicTrackingScreen(isMobile);
      break;
    case 'quote_token':
      container.innerHTML = renderPublicQuoteScreen(isMobile);
      break;
    case 'invoice_token':
      container.innerHTML = renderPublicInvoiceScreen(isMobile);
      break;
    default:
      container.innerHTML = renderDashboardScreen(isMobile);
  }
}

// Side-by-Side Comparison Renderer
function renderComparisonMode(container, screenId) {
  const actualImgMap = {
    landing: { file: 'actual-screenshots/landing_desktop.png', type: 'historical_claims', title: 'ACTUAL CURRENT-APP CAPTURE (CONTAINS CLAIMS REQUIRING FUTURE PRODUCTION UPDATE)', desc: 'Historical screenshot of existing production landing page (/app/page.tsx). Contains legacy unverified claims (62% calls, $1,500 jobs, 8s response, 0.5% fee) requiring a separate future production update. Column 2 shows the corrected proposed design.' },
    login: { file: 'actual-screenshots/login_desktop.png', type: 'live', title: 'LIVE PRODUCTION BUILD CAPTURE', desc: 'Captured directly from unauthenticated contractor login page.' },
    onboarding: { file: 'actual-screenshots/onboarding_desktop.png', type: 'live', title: 'LIVE PRODUCTION BUILD CAPTURE', desc: 'Captured directly from initial onboarding flow page.' },
    admin_login: { file: 'actual-screenshots/admin_login_desktop.png', type: 'live', title: 'LIVE PRODUCTION BUILD CAPTURE', desc: 'Captured directly from super-admin login page.' },
    admin_simulator: { file: 'actual-screenshots/admin_simulator_desktop.png', type: 'redirect', title: 'REDIRECT CAPTURE (UNAUTHENTICATED)', desc: 'Route /admin/simulator enforces super-admin session validation. When crawled anonymously, it redirected to /admin/login. Duplicate capture of login page. Auth was not bypassed.' },
    book_slug: { file: 'actual-screenshots/book_slug_desktop.png', type: 'error', title: 'ACTUAL ERROR STATE (CONTRACTOR NOT FOUND)', desc: 'Captured using demo slug (/book/demo-contractor). No matching tenant record existed in test DB, displaying application 404 fallback.' },
    track_token: { file: 'actual-screenshots/track_token_desktop.png', type: 'error', title: 'ACTUAL ERROR STATE (INVALID TOKEN)', desc: 'Captured using demo tracking token (/track/demo-token). No matching active dispatch record existed, displaying invalid token fallback.' },
    quote_token: { file: 'actual-screenshots/quote_token_desktop.png', type: 'error', title: 'ACTUAL ERROR STATE (ESTIMATE NOT FOUND)', desc: 'Captured using demo estimate token (/quote/demo-token). No matching quote record existed, displaying estimate not found fallback.' },
    invoice_token: { file: 'actual-screenshots/invoice_token_desktop.png', type: 'error', title: 'ACTUAL ERROR STATE (INVOICE NOT FOUND)', desc: 'Captured using demo invoice token (/invoice/demo-token). No matching invoice record existed, displaying invoice not found fallback.' }
  };

  const meta = actualImgMap[screenId];
  const hasActual = Boolean(meta);

  let bannerHtml = '';
  if (hasActual) {
    if (meta.type === 'live') {
      bannerHtml = `<div class="comparison-banner" style="background: #f0fdf4; border-bottom: 1px solid #bbf7d0; color: #166534;">
        <strong>✓ ${meta.title}</strong>
        <span>${meta.desc}</span>
      </div>`;
    } else if (meta.type === 'redirect') {
      bannerHtml = `<div class="comparison-banner banner-redirect">
        <strong>🔒 ${meta.title}</strong>
        <span>${meta.desc}</span>
      </div>`;
    } else if (meta.type === 'historical_claims') {
      bannerHtml = `<div class="comparison-banner" style="background: #fffbeb; border-bottom: 1px solid #fde68a; color: #92400e;">
        <strong>⚠️ ${meta.title}</strong>
        <span>${meta.desc}</span>
      </div>`;
    } else if (meta.type === 'error') {
      bannerHtml = `<div class="comparison-banner banner-error">
        <strong>⚠️ ${meta.title}</strong>
        <span>${meta.desc}</span>
      </div>`;
    }
  } else {
    bannerHtml = `<div class="comparison-banner banner-unvalidated">
      <strong>🔒 NOT VALIDATED IN PRODUCTION</strong>
      <span>Authenticated route protected by ClientLayout (supabase.auth.getUser()). Crawlers without active session cookies redirect to /client/login. Authentication strictly preserved.</span>
    </div>`;
  }

  container.innerHTML = `
    <div class="comparison-grid">
      <!-- Column 1: Actual Current Screen -->
      <div class="comparison-column">
        <div class="comparison-header actual">
          <span>ACTUAL CURRENT IMPLEMENTATION</span>
          <span class="badge ${hasActual ? (meta.type === 'live' ? 'emerald' : meta.type === 'historical_claims' ? 'amber' : meta.type === 'redirect' ? 'blue' : 'amber') : 'neutral'}">
            ${hasActual ? (meta.type === 'live' ? 'PROD BUILD CAPTURE' : meta.type === 'historical_claims' ? 'HISTORICAL PROD CAPTURE' : meta.type === 'redirect' ? 'REDIRECT CAPTURE' : 'ERROR STATE CAPTURE') : 'NOT VALIDATED (AUTH GUARDED)'}
          </span>
        </div>
        ${bannerHtml}
        <div style="padding: 16px; overflow-y: auto; flex: 1; background: #0f172a; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          ${hasActual 
            ? `<img src="${meta.file}" alt="Actual Screenshot" style="width: 100%; border-radius: 8px; border: 1px solid #334155; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">`
            : `<div style="text-align: center; color: #94a3b8; max-width: 440px; padding: 32px 16px;">
                <div style="font-size: 36px; margin-bottom: 12px;">🔒</div>
                <h4 style="color: #f8fafc; font-size: 16px; margin-bottom: 8px;">Protected by Contractor Auth Guard</h4>
                <p style="font-size: 13px; line-height: 1.5; color: #cbd5e1;">This route enforces <code>supabase.auth.getUser()</code> in <code>ClientLayout</code>. Because anonymous local requests carry no active Supabase session cookie, the browser safely redirects to <code>/client/login</code>.</p>
                <div style="margin-top: 14px; padding: 8px 12px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 11px; color: #94a3b8;">
                  Status: <strong>NOT VALIDATED IN PRODUCTION</strong> (Security Boundary Enforced)
                </div>
               </div>`
          }
        </div>
      </div>

      <!-- Column 2: Proposed Redesign -->
      <div class="comparison-column">
        <div class="comparison-header proposed">
          <span>PROPOSED REDESIGN (PHASE 1B.3 PROTOTYPE)</span>
          <span class="badge emerald">LIGHT-FIRST + 44PX TARGETS</span>
        </div>
        <div style="overflow-y: auto; flex: 1;">
          ${renderScreenContent(screenId, false)}
        </div>
      </div>
    </div>
  `;
}

function renderScreenContent(screenId, isMobile) {
  switch (screenId) {
    case 'landing': return renderLandingScreen(isMobile);
    case 'login': return renderLoginScreen(isMobile);
    case 'onboarding': return renderOnboardingScreen(isMobile);
    case 'dashboard': return renderDashboardScreen(isMobile);
    case 'leads': return renderLeadsScreen(isMobile);
    case 'inbox': return renderInboxScreen(isMobile);
    case 'calendar': return renderCalendarScreen(isMobile);
    case 'jobs': return renderJobsScreen(isMobile);
    case 'field': return renderFieldPortalScreen(isMobile);
    case 'invoices': return renderInvoicesScreen(isMobile);
    case 'track_token': return renderPublicTrackingScreen(isMobile);
    case 'quote_token': return renderPublicQuoteScreen(isMobile);
    case 'invoice_token': return renderPublicInvoiceScreen(isMobile);
    default: return renderDashboardScreen(isMobile);
  }
}

// ==========================================
// SCREEN 1: LANDING PAGE
// ==========================================
function renderLandingScreen(isMobile) {
  return `
    <div class="screen-wrapper" style="background: #ffffff;">
      <!-- Hero Topbar -->
      <div style="border-bottom: 1px solid #e2e8f0; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 28px; height: 28px; border-radius: 6px; background: #0284c7; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">C</div>
          <span style="font-size: 18px; font-weight: 700; color: #0f172a;">CaptoDesk</span>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary" onclick="setScreen('login')">Contractor Login</button>
          <button class="btn btn-primary" onclick="setScreen('onboarding')">Start Free Trial</button>
        </div>
      </div>

      <!-- Hero Header -->
      <div style="padding: ${isMobile ? '32px 16px' : '64px 32px'}; text-align: center; max-width: 800px; margin: 0 auto;">
        <span class="badge blue" style="margin-bottom: 16px;">FAST MISSED-CALL RECOVERY FOR TRADE CONTRACTORS</span>
        <h1 style="font-size: ${isMobile ? '28px' : '44px'}; font-weight: 800; color: #0f172a; line-height: 1.15; margin-bottom: 18px;">
          Never Lose a High-Paying Job to a Missed Call Again.
        </h1>
        <p style="font-size: ${isMobile ? '15px' : '18px'}; color: #475569; line-height: 1.5; margin-bottom: 28px;">
          When you're on a ladder or under a sink, CaptoDesk automatically texts callers back within seconds (internal SLA target < 15s), triages their service need, and helps book the appointment on your calendar.
        </p>
        <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <button class="btn btn-primary" style="min-height: 50px; font-size: 15px; padding: 0 24px;" onclick="setScreen('onboarding')">
            Start Guided Setup Wizard &rarr;
          </button>
          <button class="btn btn-secondary" style="min-height: 50px; font-size: 15px;" onclick="startInteractiveJourney('journeyA')">
            Interactive Missed Call Simulator
          </button>
        </div>
      </div>

      <!-- Feature Grid -->
      <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 40px 24px;">
        <div style="max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: ${isMobile ? '1fr' : 'repeat(3, 1fr)'}; gap: 20px;">
          <div class="card" style="margin: 0;">
            <div style="font-size: 24px; margin-bottom: 12px;">⚡</div>
            <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Automated Instant Text-Back</h3>
            <p style="font-size: 13px; color: #64748b; line-height: 1.45;">Personalized SMS response initiates when an incoming call goes unanswered, targeting response within seconds under standard carrier network conditions.</p>
          </div>
          <div class="card" style="margin: 0;">
            <div style="font-size: 24px; margin-bottom: 12px;">📱</div>
            <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Sunlight-Hardened Mobile</h3>
            <p style="font-size: 13px; color: #64748b; line-height: 1.45;">High-contrast light UI with 44px buttons engineered for direct outdoor sun and gloved fingers.</p>
          </div>
          <div class="card" style="margin: 0;">
            <div style="font-size: 24px; margin-bottom: 12px;">💳</div>
            <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">1-Tap Apple Pay Invoices</h3>
            <p style="font-size: 13px; color: #64748b; line-height: 1.45;">Customers can review and pay service bills directly from their mobile phone with express checkout options like Apple Pay, streamlining on-site collection.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// SCREEN 2: LOGIN
// ==========================================
function renderLoginScreen(isMobile) {
  return `
    <div class="screen-wrapper" style="display: flex; align-items: center; justify-content: center; padding: 24px; background: #f8fafc;">
      <div class="card" style="width: 100%; max-width: 420px; padding: 32px; box-shadow: var(--shadow-md);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: #0284c7; color: white; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; margin-bottom: 12px;">C</div>
          <h2 style="font-size: 20px; font-weight: 700; color: #0f172a;">Sign In to CaptoDesk</h2>
          <p style="font-size: 13px; color: #64748b; margin-top: 4px;">Field Growth System for Trade Contractors</p>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="font-size: 12px; font-weight: 600; color: #334155; display: block; margin-bottom: 6px;">Email Address</label>
          <input type="email" class="input-field" value="dave@apexplumbing.com" readonly>
        </div>

        <div style="margin-bottom: 24px;">
          <label style="font-size: 12px; font-weight: 600; color: #334155; display: block; margin-bottom: 6px;">Password</label>
          <input type="password" class="input-field" value="••••••••••••" readonly>
        </div>

        <button class="btn btn-primary" style="width: 100%; min-height: 48px; font-size: 14px;" onclick="setScreen('dashboard')">
          Sign In to Workspace &rarr;
        </button>

        <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #64748b;">
          New contractor? <a href="#" style="color: #0284c7; font-weight: 600; text-decoration: none;" onclick="setScreen('onboarding')">Start Guided Setup</a>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// SCREEN 3: GUIDED ONBOARDING (9-STATE ACTIVATION)
// ==========================================
function renderOnboardingScreen(isMobile) {
  const step = PROTOTYPE_STATE.onboardingStep;

  return `
    <div class="screen-wrapper" style="padding: ${isMobile ? '16px' : '32px 48px'}; background: #f8fafc;">
      <!-- Onboarding Progress Header -->
      <div style="max-width: 760px; margin: 0 auto 24px auto;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 13px; font-weight: 700; color: #0284c7;">STEP ${step} OF 9 &bull; ACTIVATION WIZARD</span>
          <span class="badge blue">LIVE VERIFICATION ARCHITECTURE</span>
        </div>
        <div style="height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden;">
          <div style="height: 100%; width: ${(step / 9) * 100}%; background: #0284c7; transition: width 0.3s ease;"></div>
        </div>
      </div>

      <!-- Dynamic Wizard Step Card -->
      <div class="card" style="max-width: 760px; margin: 0 auto; padding: ${isMobile ? '20px' : '32px'};">
        ${renderOnboardingStepContent(step, isMobile)}
      </div>
    </div>
  `;
}

function renderOnboardingStepContent(step, isMobile) {
  switch (step) {
    case 1:
      return `
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 6px;">1. Business Profile Setup</h2>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 24px;">Enter your public contractor profile as shown on quotes and SMS.</p>
        <div style="display: grid; gap: 16px; margin-bottom: 24px;">
          <div>
            <label style="font-size: 12px; font-weight: 600; margin-bottom: 6px; display: block;">Business Legal Name</label>
            <input type="text" class="input-field" value="Apex Plumbing & Drain Solutions LLC">
          </div>
          <div>
            <label style="font-size: 12px; font-weight: 600; margin-bottom: 6px; display: block;">Owner Mobile Phone (for notifications)</label>
            <input type="tel" class="input-field" value="(512) 555-••99 (Demo Owner Cell)">
          </div>
        </div>
        <button class="btn btn-primary" onclick="setOnboardingStep(2)">Continue to Trade Selection &rarr;</button>
      `;
    case 2:
      return `
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 6px;">2. Trade & Service Catalog Selection</h2>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 20px;">Selecting your trade automatically pre-populates your standard services and missed-call triage keywords.</p>
        <div style="display: grid; grid-template-columns: ${isMobile ? '1fr 1fr' : 'repeat(4, 1fr)'}; gap: 12px; margin-bottom: 24px;">
          <div class="card" style="margin: 0; border: 2px solid #0284c7; background: #f0f9ff; cursor: pointer; text-align: center; padding: 14px;">
            <div style="font-size: 24px;">🔧</div>
            <div style="font-size: 13px; font-weight: 700; margin-top: 6px;">Plumbing</div>
          </div>
          <div class="card" style="margin: 0; cursor: pointer; text-align: center; padding: 14px;">
            <div style="font-size: 24px;">❄️</div>
            <div style="font-size: 13px; font-weight: 700; margin-top: 6px;">HVAC</div>
          </div>
          <div class="card" style="margin: 0; cursor: pointer; text-align: center; padding: 14px;">
            <div style="font-size: 24px;">⚡</div>
            <div style="font-size: 13px; font-weight: 700; margin-top: 6px;">Electrical</div>
          </div>
          <div class="card" style="margin: 0; cursor: pointer; text-align: center; padding: 14px;">
            <div style="font-size: 24px;">🏠</div>
            <div style="font-size: 13px; font-weight: 700; margin-top: 6px;">Roofing</div>
          </div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
          <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">Pre-loaded Starter Services (Suggested Baselines — Fully Editable):</div>
          <ul style="font-size: 12px; color: #475569; margin-left: 20px; line-height: 1.6;">
            <li>Emergency Diagnostic & Leak Detection ($89.00)</li>
            <li>Main Drain Snake / Cleanout ($175.00)</li>
            <li>Water Heater Flush & Inspection ($149.00)</li>
          </ul>
          <div style="font-size: 11px; color: #64748b; margin-top: 8px;">* Note: Suggested prices are starting recommendations for trade diagnostics and can be customized at any time in your Service Catalog.</div>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary" onclick="setOnboardingStep(1)">&larr; Back</button>
          <button class="btn btn-primary" onclick="setOnboardingStep(3)">Continue &rarr;</button>
        </div>
      `;
    case 3:
      return `
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 6px;">3. Business Hours & Service Area</h2>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 20px;">Defines when automated missed-call text-backs announce normal vs after-hours emergency rates.</p>
        <div style="display: grid; gap: 14px; margin-bottom: 24px;">
          <div style="display: flex; gap: 12px; align-items: center;">
            <input type="checkbox" checked style="width: 18px; height: 18px;">
            <span style="font-size: 13px; font-weight: 600;">Mon - Fri: 08:00 AM – 06:00 PM</span>
          </div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <input type="checkbox" checked style="width: 18px; height: 18px;">
            <span style="font-size: 13px; font-weight: 600;">Saturday: 09:00 AM – 02:00 PM (Emergency Only)</span>
          </div>
          <div>
            <label style="font-size: 12px; font-weight: 600; margin-bottom: 6px; display: block;">Primary Zip Code & Radius</label>
            <input type="text" class="input-field" value="78701 (Austin, TX) - 25 Mile Radius">
          </div>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary" onclick="setOnboardingStep(2)">&larr; Back</button>
          <button class="btn btn-primary" onclick="setOnboardingStep(4)">Continue &rarr;</button>
        </div>
      `;
    case 4:
      return `
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 6px;">4. Owner Notification Routing</h2>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 20px;">Choose how you want to be alerted the moment a missed-call lead responds to the auto-text.</p>
        <div style="display: grid; gap: 12px; margin-bottom: 24px;">
          <label class="card" style="margin: 0; display: flex; gap: 12px; cursor: pointer; border: 2px solid #0284c7; background: #f0f9ff; padding: 14px;">
            <input type="checkbox" checked style="width: 18px; height: 18px; margin-top: 2px;">
            <div>
              <div style="font-size: 13px; font-weight: 700;">Instant Owner SMS Alert (Recommended)</div>
              <div style="font-size: 12px; color: #64748b;">Sends an immediate text to your personal cell with the customer's triage reply.</div>
            </div>
          </label>
          <label class="card" style="margin: 0; display: flex; gap: 12px; cursor: pointer; padding: 14px;">
            <input type="checkbox" checked style="width: 18px; height: 18px; margin-top: 2px;">
            <div>
              <div style="font-size: 13px; font-weight: 700;">Web Push Notifications</div>
              <div style="font-size: 12px; color: #64748b;">Browser banner alerts on your laptop and iPhone Safari home-screen web app.</div>
            </div>
          </label>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary" onclick="setOnboardingStep(3)">&larr; Back</button>
          <button class="btn btn-primary" onclick="setOnboardingStep(5)">Review Carrier Phone Status &rarr;</button>
        </div>
      `;
    case 5:
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <h2 style="font-size: 20px; font-weight: 700;">5. Inbound Line & Provisioning Readiness</h2>
          <span class="badge blue">&bull; ILLUSTRATIVE TEMPLATE: [Your active CaptoDesk DID]</span>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px; margin-bottom: 18px;">
          <div style="font-size: 13px; font-weight: 700; color: #1e40af; margin-bottom: 4px;">TELEPHONY READINESS IS SEPARATE FROM MESSAGING (10DLC):</div>
          <p style="font-size: 12px; color: #1e3a8a; line-height: 1.5;">
            Once provisioned by Super Admin, your dedicated CaptoDesk voice line <strong>[Your active CaptoDesk DID]</strong> will receive forwarded calls. Do not configure live forwarding codes until an active, verified DID is assigned to your account. Outbound carrier SMS broadcasting requires separate 10DLC registration, which is currently undergoing mobile carrier review.
          </p>
        </div>
        <div style="display: grid; gap: 12px; margin-bottom: 24px;">
          <div class="card" style="margin: 0; padding: 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; font-weight: 700;">1. Inbound Voice Line Routing</div>
              <div style="font-size: 12px; color: #64748b;">Assigned DID: [Your active CaptoDesk DID] &bull; Illustrative Template (Awaiting Assignment)</div>
            </div>
            <span class="badge blue">&bull; SIMULATION TEMPLATE</span>
          </div>
          <div class="card" style="margin: 0; padding: 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; font-weight: 700;">2. Carrier 10DLC Brand / Campaign Approval</div>
              <div style="font-size: 12px; color: #64748b;">US carrier 10DLC registration (TCR) in progress &bull; Timelines vary based on carrier queue &bull; Sandbox active</div>
            </div>
            <span class="badge amber">&bull; IN CARRIER REVIEW (VARIABLE TIMELINE)</span>
          </div>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary" onclick="setOnboardingStep(4)">&larr; Back</button>
          <button class="btn btn-primary" onclick="setOnboardingStep(6)">Configure Carrier Call Forwarding &rarr;</button>
        </div>
      `;
    case 6:
      return `
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 6px;">6. Carrier Call Forwarding (Voice Inbound Only)</h2>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; margin-bottom: 18px;">
          <div style="font-size: 13px; font-weight: 700; color: #991b1b; margin-bottom: 4px;">CRITICAL NOTICE &bull; VERIZON *72 UNCONDITIONAL WARNING:</div>
          <p style="font-size: 12px; color: #7f1d1d; line-height: 1.45;">
            On Verizon Wireless, dialing <strong>*72</strong> activates <em>unconditional call forwarding</em>, sending all incoming calls immediately to the forwarded number without ringing your cell. CaptoDesk requires <strong>conditional no-answer forwarding (*71)</strong>, which rings your mobile phone first and forwards ONLY unanswered calls.
          </p>
        </div>

        <div class="card" style="margin-bottom: 20px;">
          <div style="font-size: 13px; font-weight: 700; margin-bottom: 6px;">Carrier Call Forwarding Dial-Code Templates (Simulation Mode):</div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px; margin-bottom: 14px; font-size: 12px; color: #92400e; line-height: 1.45;">
          ⚠️ <strong>Demonstration Safeguard:</strong> These dial codes are illustrative templates in simulation mode, not dialable production instructions. Do not attempt to forward calls until an active and verified CaptoDesk DID has been assigned to your organization.
        </div>
          
          <!-- Verizon -->
          <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 14px; font-weight: 700; color: #0f172a;">Verizon Wireless</span>
              <span class="badge neutral" style="font-size: 10px;">Source: verizon.com/support/pound-star-codes</span>
            </div>
            <div style="font-size: 12px; color: #334155; line-height: 1.5;">
              &bull; <strong>Illustrative forwarding template (Simulation only):</strong> Dial <code>*71 + [10-digit CaptoDesk DID]</code> and press Send. Listen for confirmation tone.<br>
              &bull; <strong>Disable forwarding:</strong> Dial <code>*73</code> and press Send.<br>
              <span style="color: #991b1b; font-size: 11px; font-weight: 600;">* Warning: Never dial *72 on Verizon unless you intend to disable ringing on your personal phone completely.</span>
            </div>
          </div>

          <!-- T-Mobile -->
          <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 14px; font-weight: 700; color: #0f172a;">T-Mobile</span>
              <span class="badge neutral" style="font-size: 10px;">Source: t-mobile.com/support/plans-features/self-service-short-codes</span>
            </div>
            <div style="font-size: 12px; color: #334155; line-height: 1.5;">
              &bull; <strong>Illustrative forwarding template (Simulation only):</strong> Dial <code>**61*[CaptoDesk DID]#</code> and press Send.<br>
              &bull; <strong>Reset all conditional call forwarding:</strong> Dial <code>##004#</code> and press Send.<br>
              <span style="color: #64748b; font-size: 11px;">* Note: Dialing ##004# cancels ALL conditional forwarding rules (busy, unanswered, unreachable). It does not exclusively disable no-reply forwarding.</span>
            </div>
          </div>

          <!-- AT&T -->
          <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 14px; font-weight: 700; color: #0f172a;">AT&T</span>
              <span class="badge neutral" style="font-size: 10px;">Carrier Guidance</span>
            </div>
            <div style="font-size: 12px; color: #334155; line-height: 1.5;">
              &bull; <strong>Important Device Menu Notice:</strong> Standard iOS device Call Forwarding (<code>Settings &rarr; Apps &rarr; Phone &rarr; Call Forwarding</code>) on AT&T provides <em>unconditional forwarding only</em> (all incoming calls forward immediately without ringing).<br>
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px; margin-top: 8px; font-size: 12px; color: #991b1b; font-weight: 500; line-height: 1.45;">
                AT&T forwarding behavior depends on your wireless service. Contact AT&T and confirm whether conditional forwarding of unanswered calls is supported for your specific line. Do not enable unconditional forwarding as a substitute.
              </div>
            </div>
          </div>
        </div>

        <div style="background: #f1f5f9; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 12px; color: #475569;">
          ⚠️ <strong>Mandatory Verification Rule:</strong> Do not mark setup complete merely because you dialed a code or toggled a device setting. Always perform a test call from another phone to verify that your cell rings first, and if unanswered, forwards to CaptoDesk.
        </div>

        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary" onclick="setOnboardingStep(5)">&larr; Back</button>
          <button class="btn btn-primary" onclick="setOnboardingStep(7)">Launch Simulated Test Mode &rarr;</button>
        </div>
      `;
    case 7:
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <h2 style="font-size: 20px; font-weight: 700;">7. Simulated Test Sandbox</h2>
          <span class="badge blue">SIMULATION ENVIRONMENT ONLY</span>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 18px;">
          Test your automated missed-call triage sequence in a safe sandbox without placing live calls or sending real SMS.
        </p>
        <div class="card" style="background: #f0fdf4; border: 1px solid #bbf7d0; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 13px; font-weight: 700; color: #166534;">Simulated Event: Unanswered Caller Hangup</span>
            <span class="badge emerald">SIMULATED WEBHOOK</span>
          </div>
          <div style="font-size: 12px; color: #15803d; line-height: 1.5; margin-bottom: 12px;">
            Simulating unanswered inbound call from (512) 555-••92 (Demo) to CaptoDesk line [Your active CaptoDesk DID]... Caller disconnects after 4 rings.
          </div>
          <div style="background: white; border: 1px solid #86efac; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #0f172a;">
            <strong>Simulated Auto-Text Dispatched (Internal SLA Target: &lt; 15s):</strong><br>
            "Hey Sarah, this is Apex Plumbing! We're currently on a job and missed your call. Water leak, drain, or water heater? Text us here and we'll reply right away!"
          </div>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary" onclick="setOnboardingStep(6)">&larr; Back</button>
          <button class="btn btn-primary" onclick="setOnboardingStep(8)">Proceed to Verification Checklist &rarr;</button>
        </div>
      `;
    case 8:
      return `
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 6px;">8. Readiness Verification Checklist</h2>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 20px;">Clear distinction between telephony routing and carrier messaging readiness.</p>
        <div style="display: grid; gap: 12px; margin-bottom: 24px;">
          <div class="card" style="margin: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px;">
            <div>
              <div style="font-size: 13px; font-weight: 700;">1. Workspace Profile & Starter Catalog</div>
              <div style="font-size: 12px; color: #64748b;">Services, pricing baselines, and business hours configured</div>
            </div>
            <span class="badge emerald">&check; COMPLETE</span>
          </div>
          <div class="card" style="margin: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px;">
            <div>
              <div style="font-size: 13px; font-weight: 700;">2. CaptoDesk DID Provisioning</div>
              <div style="font-size: 12px; color: #64748b;">Destination DID: [Your active CaptoDesk DID] (Awaiting Super Admin Allocation)</div>
            </div>
            <span class="badge amber">&bull; AWAITING ALLOCATION</span>
          </div>
          <div class="card" style="margin: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px;">
            <div>
              <div style="font-size: 13px; font-weight: 700;">3. Carrier Call Forwarding Configuration</div>
              <div style="font-size: 12px; color: #64748b;">Carrier codes documented &bull; Requires actual test call verification</div>
            </div>
            <span class="badge amber">&bull; AWAITING TEST CALL</span>
          </div>
          <div class="card" style="margin: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px;">
            <div>
              <div style="font-size: 13px; font-weight: 700;">4. Carrier 10DLC Brand / Campaign Registration</div>
              <div style="font-size: 12px; color: #64748b;">Carrier compliance approval for outbound SMS broadcasts (processing timeline varies by carrier queue)</div>
            </div>
            <span class="badge amber">&bull; IN CARRIER REVIEW</span>
          </div>
          <div class="card" style="margin: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px;">
            <div>
              <div style="font-size: 13px; font-weight: 700;">5. Outbound SMS Delivery Readiness</div>
              <div style="font-size: 12px; color: #64748b;">Simulated sandbox verified &bull; Live carrier SMS unlocks upon 10DLC approval</div>
            </div>
            <span class="badge blue">&bull; SANDBOX ACTIVE</span>
          </div>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary" onclick="setOnboardingStep(7)">&larr; Back</button>
          <button class="btn btn-primary" onclick="setOnboardingStep(9)">View Operational Status &rarr;</button>
        </div>
      `;
    case 9:
      return `
        <div style="text-align: center; padding: 16px 0;">
          <div style="width: 56px; height: 56px; border-radius: 99px; background: #ecfdf5; color: #059669; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 16px;">&check;</div>
          <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">Workspace Ready for Initial Operations</h2>
          <p style="font-size: 14px; color: #475569; max-width: 540px; margin: 0 auto 20px auto; line-height: 1.5;">
            Once allocated by Super Admin, inbound voice calls can be forwarded to your active CaptoDesk DID and logged to your dashboard. Live outbound carrier SMS will activate automatically upon 10DLC carrier approval.
          </p>
          <div style="display: flex; justify-content: center; gap: 12px;">
            <button class="btn btn-primary" style="min-height: 48px; font-size: 14px; padding: 0 24px;" onclick="setScreen('dashboard')">
              Enter Contractor Dashboard &rarr;
            </button>
          </div>
        </div>
      `;
  }
}

function setOnboardingStep(s) {
  PROTOTYPE_STATE.onboardingStep = s;
  renderScreen();
}

// ==========================================
// SCREEN 4: DASHBOARD / TODAY
// ==========================================
function renderDashboardScreen(isMobile) {
  const d = PROTOTYPE_STATE.fictionalData;

  const content = `
    <!-- Top Action Alert Banner: Urgent Attention Queue -->
    <div class="card" style="border-left: 4px solid #dc2626; background: #fef2f2; margin-bottom: 24px;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="badge rose">URGENT ATTENTION NEEDED</span>
            <span style="font-size: 12px; color: #991b1b; font-weight: 600;">Missed Call 4 mins ago</span>
          </div>
          <div style="font-size: 14px; font-weight: 700; color: #7f1d1d;">
            Sarah Jenkins &bull; (512) 555-••92 (Demo)
          </div>
          <div style="font-size: 13px; color: #991b1b; margin-top: 2px;">
            Auto-Text Reply: <em>"Water heater is leaking all over my garage floor!"</em>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-danger" style="min-height: 40px;" onclick="startInteractiveJourney('journeyA')">
            Reply in Inbox & Book Slot &rarr;
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Action Launcher Row (44px Minimum Touch) -->
    <div style="display: grid; grid-template-columns: ${isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))'}; gap: 12px; margin-bottom: 24px;">
      <button class="btn btn-secondary" style="min-height: 48px; justify-content: flex-start;" onclick="setScreen('leads')">
        <span style="font-size: 16px;">🎯</span> Inbound Leads (3)
      </button>
      <button class="btn btn-secondary" style="min-height: 48px; justify-content: flex-start;" onclick="setScreen('inbox')">
        <span style="font-size: 16px;">💬</span> Unified Inbox (1)
      </button>
      <button class="btn btn-secondary" style="min-height: 48px; justify-content: flex-start;" onclick="setScreen('calendar')">
        <span style="font-size: 16px;">📅</span> Today's Schedule (3)
      </button>
      <button class="btn btn-primary" style="min-height: 48px; justify-content: flex-start;" onclick="setScreen('field')">
        <span style="font-size: 16px;">🚚</span> Field Portal (Active)
      </button>
    </div>

    <!-- Priority Job Card -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <div class="card-title">
          <span>⏰ NEXT UP TODAY</span>
          <span class="badge blue">09:00 AM - 10:30 AM</span>
        </div>
        <span class="badge emerald">CONFIRMED</span>
      </div>
      <div style="display: flex; flex-direction: ${isMobile ? 'column' : 'row'}; justify-content: space-between; gap: 16px;">
        <div>
          <div style="font-size: 16px; font-weight: 700; color: #0f172a;">Sarah Jenkins &bull; Water Heater Diagnostic</div>
          <div style="font-size: 13px; color: #475569; margin: 4px 0 8px 0;">📍 742 Evergreen Terrace, Austin, TX 78704</div>
          <div style="font-size: 12px; color: #64748b;">Assigned Tech: Dave Miller (Van 1)</div>
        </div>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-secondary" onclick="alert('Simulated: Navigating to Apple Maps')">🗺️ Open GPS Maps</button>
          <button class="btn btn-primary" onclick="setScreen('field')">Open Field Portal &rarr;</button>
        </div>
      </div>
    </div>

    <!-- Operations & Revenue Grid -->
    <div style="display: grid; grid-template-columns: ${isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(130px, 1fr))'}; gap: 14px;">
      <div class="card" style="margin: 0;">
        <div style="font-size: 12px; color: #64748b; font-weight: 600;">TOTAL CALLS (30D)</div>
        <div style="font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 4px;" class="num-tabular">142</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Illustrative 30D volume</div>
      </div>
      <div class="card" style="margin: 0;">
        <div style="font-size: 12px; color: #64748b; font-weight: 600;">MISSED RECOVERED</div>
        <div style="font-size: 24px; font-weight: 800; color: #0284c7; margin-top: 4px;" class="num-tabular">38</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">38 of 44 missed calls responded (86.4% illustrative rate)</div>
      </div>
      <div class="card" style="margin: 0;">
        <div style="font-size: 12px; color: #64748b; font-weight: 600;">CLOSED REVENUE</div>
        <div style="font-size: 24px; font-weight: 800; color: #059669; margin-top: 4px;" class="num-tabular">$24,850</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">52 jobs paid via Stripe / Apple Pay (Illustrative)</div>
      </div>
      <div class="card" style="margin: 0;">
        <div style="font-size: 12px; color: #64748b; font-weight: 600;">GOOGLE REVIEWS</div>
        <div style="font-size: 24px; font-weight: 800; color: #d97706; margin-top: 4px;" class="num-tabular">14</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">14 of 32 invites completed (43.8% rate &bull; Zero Gating)</div>
      </div>
    </div>
  `;

  return isMobile ? renderMobileAppFrame('Today', content) : renderDesktopAppShell('Today', content);
}

// ==========================================
// SCREEN 5: LEADS & PIPELINE
// ==========================================
function renderLeadsScreen(isMobile) {
  const content = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <div>
        <h2 style="font-size: 20px; font-weight: 700;">Inbound Leads Pipeline</h2>
        <p style="font-size: 13px; color: #64748b;">Calls and inquiries automatically converted to action items.</p>
      </div>
      <button class="btn btn-primary" onclick="alert('Simulated: Quick Lead Modal')">+ Manual Lead</button>
    </div>

    <div style="display: grid; gap: 14px;">
      ${PROTOTYPE_STATE.fictionalData.leads.map(l => `
        <div class="card" style="margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 15px; font-weight: 700; color: #0f172a;">${l.name}</span>
                <span class="badge ${l.urgency === 'Emergency' ? 'rose' : 'blue'}">${l.urgency}</span>
                <span class="badge neutral">${l.source}</span>
              </div>
              <div style="font-size: 13px; font-weight: 600; color: #0284c7; margin-top: 4px;">${l.service}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">📞 ${l.phone} &bull; Received ${l.time}</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" style="min-height: 40px;" onclick="setScreen('inbox')">💬 View Chat</button>
              <button class="btn btn-primary" style="min-height: 40px;" onclick="startInteractiveJourney('journeyA')">📅 Book Appointment</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  return isMobile ? renderMobileAppFrame('Leads', content) : renderDesktopAppShell('Leads', content);
}

// ==========================================
// SCREEN 6: UNIFIED INBOX
// ==========================================
function renderInboxScreen(isMobile) {
  const content = `
    <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '300px 1fr'}; gap: 16px; min-height: 540px;">
      <!-- Thread List -->
      <div class="card" style="margin: 0; padding: 12px; overflow-y: auto;">
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding: 0 4px;">CONVERSATIONS</div>
        <div style="padding: 10px; background: #e0f2fe; border-radius: 8px; border: 1px solid #bae6fd; margin-bottom: 8px; cursor: pointer;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: #0369a1;">
            <span>Sarah Jenkins</span>
            <span style="font-size: 11px; color: #0284c7;">4m ago</span>
          </div>
          <div style="font-size: 12px; color: #0369a1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
            Water heater is leaking all over my garage...
          </div>
        </div>
        <div style="padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px; cursor: pointer;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
            <span>Robert Vance</span>
            <span style="font-size: 11px; color: #94a3b8;">22m ago</span>
          </div>
          <div style="font-size: 12px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
            Can someone come look at the main cleanout?
          </div>
        </div>
      </div>

      <!-- Active Chat Window -->
      <div class="card" style="margin: 0; padding: 16px; display: flex; flex-direction: column;">
        <!-- Chat Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 15px; font-weight: 700;">Sarah Jenkins &bull; (512) 555-••92 (Demo)</div>
            <div style="font-size: 12px; color: #64748b;">Emergency Lead &bull; 742 Evergreen Terrace</div>
          </div>
          <button class="btn btn-primary" style="min-height: 38px;" onclick="startInteractiveJourney('journeyA')">
            📅 Book Inline Slot
          </button>
        </div>

        <!-- Chat Stream -->
        <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; margin-bottom: 16px;">
          <!-- Auto-Text Outbound -->
          <div style="align-self: flex-end; max-width: 80%; background: #0284c7; color: white; border-radius: 12px 12px 2px 12px; padding: 10px 14px; font-size: 13px;">
            Hey Sarah, this is Apex Plumbing! We're on a job and missed your call. Water leak, drain, or water heater? Text us here and we'll reply right away!
            <div style="font-size: 10px; color: #e0f2fe; text-align: right; margin-top: 4px;">Simulated dispatch: 11.2s &bull; Auto-Text (Target < 15s)</div>
          </div>

          <!-- Customer Reply Inbound -->
          <div style="align-self: flex-start; max-width: 80%; background: #f1f5f9; color: #0f172a; border-radius: 12px 12px 12px 2px; padding: 10px 14px; font-size: 13px;">
            Water heater is leaking all over my garage floor! How soon can someone get here?
            <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">4m ago &bull; SMS Inbound</div>
          </div>
        </div>

        <!-- Canned Quick Reply Chips -->
        <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 10px;">
          <button class="btn btn-secondary" style="min-height: 36px; font-size: 12px; white-space: nowrap;" onclick="alert('Inserted snippet')">"On my way (15m)"</button>
          <button class="btn btn-secondary" style="min-height: 36px; font-size: 12px; white-space: nowrap;" onclick="alert('Inserted snippet')">"Can we call you now?"</button>
          <button class="btn btn-secondary" style="min-height: 36px; font-size: 12px; white-space: nowrap;" onclick="alert('Inserted snippet')">"Here is our booking link"</button>
        </div>

        <!-- Input Bar -->
        <div style="display: flex; gap: 8px;">
          <input type="text" class="input-field" placeholder="Type customer reply...">
          <button class="btn btn-primary" style="min-width: 80px;">Send</button>
        </div>
      </div>
    </div>
  `;

  return isMobile ? renderMobileAppFrame('Inbox', content) : renderDesktopAppShell('Inbox', content);
}

// ==========================================
// SCREEN 10: FIELD TECHNICIAN PORTAL
// ==========================================
function renderFieldPortalScreen(isMobile) {
  const content = `
    <!-- High-Visibility Sunlight Field Cockpit -->
    <div style="max-width: 600px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <span class="badge blue" style="font-size: 12px; padding: 4px 10px;">VAN 1 &bull; DAVE MILLER</span>
        <span class="badge emerald">CURRENT ACTIVE JOB</span>
      </div>

      <div class="card" style="border: 2px solid #0284c7; box-shadow: var(--shadow-md);">
        <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Sarah Jenkins &bull; #JOB-1042</div>
        <div style="font-size: 14px; font-weight: 600; color: #0284c7;">Emergency Water Heater Diagnostic</div>
        <div style="font-size: 13px; color: #475569; margin: 8px 0;">📍 742 Evergreen Terrace, Austin, TX</div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 18px;">Customer: (512) 555-••92 (Demo) &bull; Gate: #4921</div>

        <!-- 4 Distinct Operational Stages -->
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
          <!-- Stage 1: En Route -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 700; color: #0f172a;">STAGE 1: DISPATCH</span>
              <span class="badge emerald">&check; DISPATCHED</span>
            </div>
            <button class="btn btn-primary btn-field-action" style="margin-bottom: 0;" onclick="alert('Simulated: Marked En Route & Customer Tracking SMS Sent with Live ETA')">
              🚗 1. ON MY WAY (15 MIN ETA SENT)
            </button>
          </div>

          <!-- Stage 2: Arrived -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 700; color: #0f172a;">STAGE 2: JOBSITE ARRIVAL</span>
              <span class="badge blue">CHECK-IN</span>
            </div>
            <button class="btn btn-secondary btn-field-action" style="margin-bottom: 0;" onclick="alert('Simulated: Jobsite arrival timestamp logged')">
              📍 2. MARK ARRIVED ON JOBSITE
            </button>
          </div>

          <!-- Stage 3: Photo Proof -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 700; color: #0f172a;">STAGE 3: WORK EVIDENCE</span>
              <span class="badge neutral">2 PHOTOS CACHED</span>
            </div>
            <button class="btn btn-secondary btn-field-action" style="margin-bottom: 0;" onclick="alert('Simulated: Multi-photo camera capture (Before & After) cached to device')">
              📷 3. ATTACH WORK PHOTOS (BEFORE / AFTER)
            </button>
          </div>

          <!-- Stage 4: Invoicing & Payment -->
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 700; color: #166534;">STAGE 4: INVOICING & PAYMENT</span>
              <span class="badge amber">UNPAID ($229.00)</span>
            </div>
            <div style="font-size: 12px; color: #15803d; margin-bottom: 10px;">
              Customer authorization required. Completing a job does not automatically charge customer.
            </div>
            <div style="display: grid; gap: 8px;">
              <button class="btn btn-secondary" style="min-height: 44px; width: 100%; justify-content: flex-start;" onclick="setScreen('invoices')">
                📄 4a. Review Itemized Invoice ($229.00)
              </button>
              <button class="btn btn-secondary" style="min-height: 44px; width: 100%; justify-content: flex-start;" onclick="alert('Simulated: Payment link sent to customer phone via SMS')">
                📲 4b. Text Payment Link to Customer
              </button>
              <button class="btn btn-success btn-field-action" style="margin-bottom: 0;" onclick="startInteractiveJourney('journeyB')">
                 4c. Present In-Person Checkout (Apple Pay / Card)
              </button>
            </div>
          </div>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px; font-size: 11px; color: #1e40af; line-height: 1.45;">
          ℹ️ <strong>Payment Safety Notice:</strong> All payments require explicit cardholder interaction and authorization. CaptoDesk never stores raw card data or initiates unauthorized post-job debits.
        </div>
      </div>
    </div>
  `;

  return isMobile ? renderMobileAppFrame('Field Portal', content) : renderDesktopAppShell('Field Portal', content);
}

function renderCalendarScreen(isMobile) {
  const content = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <h2 style="font-size: 20px; font-weight: 700;">Schedule & Dispatch</h2>
        <p style="font-size: 13px; color: #64748b;">Wednesday, Oct 18 &bull; 3 Jobs Scheduled</p>
      </div>
      <button class="btn btn-primary">+ New Booking</button>
    </div>

    <div style="display: grid; gap: 12px;">
      ${PROTOTYPE_STATE.fictionalData.jobs.map(j => `
        <div class="card" style="margin: 0; border-left: 4px solid #0284c7;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge blue">${j.time}</span>
                <span style="font-size: 15px; font-weight: 700; color: #0f172a;">${j.title}</span>
              </div>
              <div style="font-size: 13px; color: #334155; margin-top: 4px;">${j.customer} &bull; ${j.address}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Assigned: ${j.tech} &bull; Est. Total: $${j.total}</div>
            </div>
            <button class="btn btn-secondary" onclick="setScreen('field')">Open Job &rarr;</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  return isMobile ? renderMobileAppFrame('Calendar', content) : renderDesktopAppShell('Calendar', content);
}

// ==========================================
// SCREEN 9: JOBS
// ==========================================
function renderJobsScreen(isMobile) {
  return renderCalendarScreen(isMobile);
}

// ==========================================
// SCREEN 7: CUSTOMERS
// ==========================================
function renderCustomersScreen(isMobile) {
  const content = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="font-size: 20px; font-weight: 700;">Customer CRM</h2>
      <button class="btn btn-primary">+ Add Customer</button>
    </div>
    <div class="card">
      <div style="font-size: 14px; font-weight: 700;">Sarah Jenkins</div>
      <div style="font-size: 12px; color: #64748b;">(512) 555-••92 (Demo) &bull; 742 Evergreen Terrace, Austin</div>
      <div style="margin-top: 8px; font-size: 12px;">Jobs: 1 &bull; Lifetime Value: $229.00 &bull; Status: Active</div>
    </div>
  `;
  return isMobile ? renderMobileAppFrame('Customers', content) : renderDesktopAppShell('Customers', content);
}

// ==========================================
// SCREEN 11: SERVICES
// ==========================================
function renderServicesScreen(isMobile) {
  const content = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="font-size: 20px; font-weight: 700;">Service Catalog</h2>
      <button class="btn btn-primary">+ New Service</button>
    </div>
    <div class="card" style="margin-bottom: 10px;">
      <div style="display: flex; justify-content: space-between;">
        <span style="font-weight: 700;">Emergency Diagnostic & Leak Detection</span>
        <span class="num-tabular" style="font-weight: 700; color: #059669;">$89.00</span>
      </div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">60 mins &bull; Standard diagnostic fee applied toward repair</div>
    </div>
    <div class="card">
      <div style="display: flex; justify-content: space-between;">
        <span style="font-weight: 700;">Water Heater Replacement (50-Gal Gas)</span>
        <span class="num-tabular" style="font-weight: 700; color: #059669;">$1,850.00</span>
      </div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">240 mins &bull; Includes haul-away of old unit and expansion tank</div>
    </div>
  `;
  return isMobile ? renderMobileAppFrame('Services', content) : renderDesktopAppShell('Services', content);
}

// ==========================================
// SCREEN 12: QUOTES
// ==========================================
function renderQuotesScreen(isMobile) {
  const content = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="font-size: 20px; font-weight: 700;">Quotes & Estimates</h2>
      <button class="btn btn-primary" onclick="startInteractiveJourney('journeyC')">+ Create Quote</button>
    </div>
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 700;">#QTE-1018 &bull; Sarah Jenkins</div>
          <div style="font-size: 12px; color: #64748b;">50-Gal Gas Water Heater Replacement</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; font-size: 16px;" class="num-tabular">$1,850.00</div>
          <span class="badge blue">SENT &bull; VIEWED</span>
        </div>
      </div>
    </div>
  `;
  return isMobile ? renderMobileAppFrame('Quotes', content) : renderDesktopAppShell('Quotes', content);
}

// ==========================================
// SCREEN 13: INVOICES
// ==========================================
function renderInvoicesScreen(isMobile) {
  const content = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="font-size: 20px; font-weight: 700;">Invoices & Payments</h2>
      <button class="btn btn-primary">+ New Invoice</button>
    </div>
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 700;">#INV-2041 &bull; Sarah Jenkins</div>
          <div style="font-size: 12px; color: #64748b;">Emergency Valve Replacement & Diagnostic</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; font-size: 16px; color: #0f172a;" class="num-tabular">$229.00</div>
          <span class="badge amber">UNPAID &bull; DUE TODAY</span>
        </div>
      </div>
    </div>
  `;
  return isMobile ? renderMobileAppFrame('Invoices', content) : renderDesktopAppShell('Invoices', content);
}

// ==========================================
// SCREEN 14: REVIEWS & RETENTION (STRICTLY NO GATING)
// ==========================================
function renderReviewsScreen(isMobile) {
  const content = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <h2 style="font-size: 20px; font-weight: 700;">Google Reviews & Reputation</h2>
        <span class="badge emerald">100% POLICY-COMPLIANT &bull; ZERO GATING</span>
      </div>
      <button class="btn btn-primary" onclick="startInteractiveJourney('journeyD')">+ Send Review Link</button>
    </div>
    <div class="card" style="border-left: 4px solid #059669; margin-bottom: 16px;">
      <div style="font-size: 13px; font-weight: 700; color: #065f46; margin-bottom: 4px;">STRICT NEUTRAL INVITATION POLICY:</div>
      <div style="font-size: 12px; color: #047857; line-height: 1.45;">
        CaptoDesk sends identical public Google review links to all eligible customers regardless of satisfaction score, fully complying with FTC regulations and Google Business Profile guidelines.
      </div>
    </div>
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 700;">Sarah Jenkins &bull; #JOB-1042</div>
          <div style="font-size: 12px; color: #64748b;">Scheduled 45m post-payment &bull; Cooldown check: Passed</div>
        </div>
        <span class="badge emerald">READY TO DISPATCH</span>
      </div>
    </div>
  `;
  return isMobile ? renderMobileAppFrame('Reviews', content) : renderDesktopAppShell('Reviews', content);
}

// ==========================================
// SCREEN 15-18: AUTOMATIONS, NOTIFICATIONS, TEAM, SETTINGS
// ==========================================
function renderAutomationsScreen(isMobile) {
  const content = `<div class="card"><h3>Automations Engine</h3><p style="font-size: 13px; color: #64748b; margin-top: 6px;">Missed-Call Instant Auto-Text: ACTIVE (Target < 15s) &bull; Post-Job Review Invitation: ACTIVE</p></div>`;
  return isMobile ? renderMobileAppFrame('Automations', content) : renderDesktopAppShell('Automations', content);
}
function renderNotificationsScreen(isMobile) {
  const content = `<div class="card"><h3>Notification Center</h3><p style="font-size: 13px; color: #64748b; margin-top: 6px;">Owner SMS Alert: (512) 555-••99 (Demo Owner Cell) &bull; Web Push: Enabled</p></div>`;
  return isMobile ? renderMobileAppFrame('Notifications', content) : renderDesktopAppShell('Notifications', content);
}
function renderTeamScreen(isMobile) {
  const content = `<div class="card"><h3>Team & Fleet</h3><p style="font-size: 13px; color: #64748b; margin-top: 6px;">Dave Miller (Owner / Tech) &bull; Mike Evans (Van 1 Tech)</p></div>`;
  return isMobile ? renderMobileAppFrame('Team', content) : renderDesktopAppShell('Team', content);
}
function renderSettingsScreen(isMobile) {
  const content = `<div class="card"><h3>Settings & Billing</h3><p style="font-size: 13px; color: #64748b; margin-top: 6px;">Plan: Solo Contractor Safety Net ($49/mo) &bull; Stripe Connect: Active</p></div>`;
  return isMobile ? renderMobileAppFrame('Settings', content) : renderDesktopAppShell('Settings', content);
}

// ==========================================
// SCREEN 19-22: PUBLIC CUSTOMER PAGES
// ==========================================
function renderPublicBookingScreen(isMobile) {
  return `
    <div class="screen-wrapper" style="padding: 24px; background: #f8fafc; display: flex; align-items: center; justify-content: center;">
      <div class="card" style="width: 100%; max-width: 480px; box-shadow: var(--shadow-md);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="font-size: 20px; font-weight: 800;">Apex Plumbing & Drain</h2>
          <p style="font-size: 13px; color: #64748b;">Instant Online Service Booking</p>
        </div>
        <div style="font-size: 13px; font-weight: 700; margin-bottom: 10px;">Select Available Time Slot Today:</div>
        <div style="display: grid; gap: 8px; margin-bottom: 20px;">
          <button class="btn btn-secondary" style="justify-content: space-between;"><span>Today, 02:00 PM - 04:00 PM</span><span class="badge emerald">Available</span></button>
          <button class="btn btn-secondary" style="justify-content: space-between;"><span>Today, 04:30 PM - 06:30 PM</span><span class="badge emerald">Available</span></button>
        </div>
        <button class="btn btn-primary" style="width: 100%; min-height: 48px;">Confirm Appointment &rarr;</button>
      </div>
    </div>
  `;
}

function renderPublicTrackingScreen(isMobile) {
  return `
    <div class="screen-wrapper" style="padding: 20px; background: #f8fafc; display: flex; align-items: center; justify-content: center;">
      <div class="card" style="width: 100%; max-width: 460px; border-top: 6px solid #0284c7; box-shadow: var(--shadow-lg);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span class="badge blue" style="font-size: 12px; padding: 4px 10px;">TECHNICIAN EN ROUTE</span>
          <span style="font-size: 14px; font-weight: 800; color: #0284c7;">ESTIMATED ARRIVAL: 15 MINS</span>
        </div>
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 4px;">Dave from Apex Plumbing</h2>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">Assigned Technician: Dave Miller &bull; Vehicle: White Ford Transit (Van 1)</p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 14px; margin-bottom: 18px; font-size: 13px;">
          📍 Heading to: 742 Evergreen Terrace, Austin<br>
          Service: Emergency Water Heater Diagnostic<br>
          <span style="font-size: 11px; color: #64748b; display: block; margin-top: 4px;">ETA calculated from technician dispatch timestamp.</span>
        </div>
        <button class="btn btn-secondary" style="width: 100%; min-height: 44px;" onclick="alert('Calling Dave Miller at [Your active CaptoDesk DID]')">📞 Call Technician</button>
      </div>
    </div>
  `;
}

function renderPublicQuoteScreen(isMobile) {
  return `
    <div class="screen-wrapper" style="padding: 20px; background: #f8fafc; display: flex; align-items: center; justify-content: center;">
      <div class="card" style="width: 100%; max-width: 520px; box-shadow: var(--shadow-lg);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div><h2 style="font-size: 18px; font-weight: 800;">Apex Plumbing</h2><div style="font-size: 12px; color: #64748b;">Estimate #QTE-1018</div></div>
          <div style="font-size: 20px; font-weight: 800; color: #0f172a;" class="num-tabular">$1,850.00</div>
        </div>
        <div style="border-top: 1px solid #e2e8f0; padding: 12px 0; margin-bottom: 16px; font-size: 13px;">
          <strong>Included Scope:</strong><br>
          &bull; 50-Gallon Gas Water Heater (6-Yr Warranty)<br>
          &bull; Thermal Expansion Tank & Gas Flex Supply Line<br>
          &bull; Complete Labor, City Permit & Old Tank Disposal
        </div>
        <button class="btn btn-success" style="width: 100%; min-height: 48px; font-size: 15px;" onclick="alert('Simulated: Quote Accepted! In production, this schedules the job.')">
          &check; Accept & Approve Estimate ($1,850.00)
        </button>
      </div>
    </div>
  `;
}

function renderPublicInvoiceScreen(isMobile) {
  return `
    <div class="screen-wrapper" style="padding: 20px; background: #f8fafc; display: flex; align-items: center; justify-content: center;">
      <div class="card" style="width: 100%; max-width: 480px; box-shadow: var(--shadow-lg);">
        <div style="text-align: center; margin-bottom: 16px;">
          <div style="font-size: 13px; color: #64748b;">Invoice from Apex Plumbing & Drain</div>
          <div style="font-size: 32px; font-weight: 800; color: #0f172a; margin: 4px 0;" class="num-tabular">$229.00</div>
          <span class="badge amber">DUE UPON RECEIPT</span>
        </div>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 12px; margin-bottom: 16px; font-size: 11px; color: #991b1b; text-align: center; font-weight: 600;">
          SIMULATED CHECKOUT &bull; Demo mode only &bull; Zero live financial charges
        </div>

        <!-- 1-Tap Express Mobile Checkout -->
        <div style="margin-bottom: 20px;">
          <button class="btn" style="width: 100%; min-height: 48px; background: #000000; color: white; font-size: 16px; margin-bottom: 8px;" onclick="alert('Simulated Checkout: Apple Pay authorization flow demonstrated. In production, this completes via Stripe Connect Customer Session with explicit user confirmation.')">
             Pay
          </button>
          <button class="btn btn-secondary" style="width: 100%; min-height: 44px; font-size: 14px;" onclick="alert('Simulated Checkout: Standard Card Entry demonstrated.')">
            Pay with Credit Card
          </button>
        </div>

        <div style="font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; line-height: 1.45;">
          Services: Diagnostic ($89.00) + Valve Replacement ($140.00)<br>
          <span style="font-size: 11px; color: #94a3b8; display: block; margin-top: 4px;">* Product Rule: Customer cards are never charged without explicit authorization and transaction consent.</span>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// SHELL HELPERS (DESKTOP & MOBILE)
// ==========================================
function renderDesktopAppShell(title, bodyHtml) {
  const nav = [
    { id: 'dashboard', label: 'Today', icon: '📊' },
    { id: 'inbox', label: 'Inbox', icon: '💬' },
    { id: 'leads', label: 'Leads', icon: '🎯' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'field', label: 'Field Portal', icon: '🚚' },
    { id: 'quotes', label: 'Quotes', icon: '📄' },
    { id: 'invoices', label: 'Invoices', icon: '💳' },
    { id: 'reviews', label: 'Reviews', icon: '⭐' },
    { id: 'services', label: 'Services', icon: '🔧' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  return `
    <div class="app-shell">
      <div class="app-sidebar">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px; padding: 0 4px;">
          <div style="width: 26px; height: 26px; border-radius: 6px; background: #0284c7; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">C</div>
          <span style="font-size: 15px; font-weight: 700; color: var(--text-primary);">CaptoDesk</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
          ${nav.map(item => `
            <div 
              style="padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; background: ${PROTOTYPE_STATE.currentScreen === item.id ? '#e0f2fe' : 'transparent'}; color: ${PROTOTYPE_STATE.currentScreen === item.id ? '#0369a1' : 'var(--text-secondary)'};"
              onclick="setScreen('${item.id}')"
            >
              <span>${item.icon}</span>
              <span>${item.label}</span>
            </div>
          `).join('')}
        </div>
        <div style="border-top: 1px solid var(--border); padding-top: 12px; font-size: 11px; color: var(--text-muted);">
          Apex Plumbing &bull; Solo Plan
        </div>
      </div>
      <div class="app-main">
        <div class="app-topbar">
          <div style="font-size: 16px; font-weight: 700;">${title}</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="badge emerald">&bull; SIMULATED DEMO ACTIVE</span>
            <button class="btn btn-secondary" style="min-height: 36px; font-size: 12px;" onclick="setScreen('settings')">⚙️ Settings</button>
          </div>
        </div>
        <div class="app-content">${bodyHtml}</div>
      </div>
    </div>
  `;
}

function renderMobileAppFrame(title, bodyHtml) {
  return `
    <div style="display: flex; flex-direction: column; min-height: 100%;">
      <div class="mobile-topbar">
        <div style="font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
          <span style="color: #0284c7;">C</span>
          <span>Apex Plumbing</span>
        </div>
        <span class="badge blue">${title}</span>
      </div>
      <div style="flex: 1; padding: 14px; background: var(--canvas); overflow-y: auto;">
        ${bodyHtml}
      </div>
      <div class="mobile-bottom-nav">
        <div class="mobile-nav-item ${PROTOTYPE_STATE.currentScreen === 'dashboard' ? 'active' : ''}" onclick="setScreen('dashboard')">
          <span>📊</span><span>Today</span>
        </div>
        <div class="mobile-nav-item ${PROTOTYPE_STATE.currentScreen === 'inbox' ? 'active' : ''}" onclick="setScreen('inbox')">
          <span>💬</span><span>Inbox</span>
        </div>
        <div class="mobile-nav-item ${PROTOTYPE_STATE.currentScreen === 'field' ? 'active' : ''}" onclick="setScreen('field')">
          <span>🚚</span><span>Field</span>
        </div>
        <div class="mobile-nav-item ${PROTOTYPE_STATE.currentScreen === 'calendar' ? 'active' : ''}" onclick="setScreen('calendar')">
          <span>📅</span><span>Schedule</span>
        </div>
        <div class="mobile-nav-item ${PROTOTYPE_STATE.currentScreen === 'invoices' ? 'active' : ''}" onclick="setScreen('invoices')">
          <span>💳</span><span>Invoices</span>
        </div>
      </div>
    </div>
  `;
}

function setScreen(s) {
  PROTOTYPE_STATE.currentScreen = s;
  const select = document.getElementById('screenSelect');
  if (select) select.value = s;
  renderScreen();
}

// ==========================================
// INTERACTIVE JOURNEYS ENGINE (PART 5)
// ==========================================
function startInteractiveJourney(journeyKey) {
  PROTOTYPE_STATE.activeJourney = journeyKey;
  PROTOTYPE_STATE.journeyStep = 1;
  renderJourneyStepModal();
}

function advanceJourneyStep() {
  PROTOTYPE_STATE.journeyStep++;
  renderJourneyStepModal();
}

function closeJourneyModal() {
  const modal = document.getElementById('journeyModalOverlay');
  if (modal) modal.style.display = 'none';
  PROTOTYPE_STATE.activeJourney = null;
}

function renderJourneyStepModal() {
  const modal = document.getElementById('journeyModalOverlay');
  const container = document.getElementById('journeyModalMount');
  if (!modal || !container) return;

  modal.style.display = 'flex';
  const jKey = PROTOTYPE_STATE.activeJourney;
  const step = PROTOTYPE_STATE.journeyStep;

  let title = '';
  let body = '';
  let nextAction = '';

  if (jKey === 'journeyA') {
    title = 'JOURNEY A: MISSED CALL TO BOOKING';
    if (step === 1) {
      body = `
        <div class="badge rose" style="margin-bottom: 8px;">STEP 1: UNANSWERED INBOUND CALL</div>
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Homeowner Calls During Plumbing Job</h3>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 12px;">
          Sarah Jenkins calls [Your active CaptoDesk DID]. Dave is under a sink and cannot pick up. Call goes unanswered after 4 rings.
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; margin-bottom: 16px;">
          &bull; Telnyx Webhook: <code>call.hangup (unanswered)</code><br>
          &bull; Automated Text-Back Dispatched to Sarah (Simulated Target < 15s): <em>"Hey Sarah, this is Apex Plumbing! Water leak, drain, or water heater?"</em>
        </div>
      `;
      nextAction = 'Simulate Sarah Replying via SMS &rarr;';
    } else if (step === 2) {
      body = `
        <div class="badge blue" style="margin-bottom: 8px;">STEP 2: INBOX 2-WAY TRIAGE</div>
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Customer Replies: "Water heater leaking"</h3>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 12px;">
          Sarah responds in 45 seconds. An owner notification pops up on Dave's phone. Dave taps the notification and opens the unified conversation thread.
        </p>
        <div style="background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px; font-size: 12px; margin-bottom: 16px;">
          Dave taps the <strong>[Book Inline Slot]</strong> button directly in the chat header.
        </div>
      `;
      nextAction = 'Select 02:00 PM Slot & Confirm &rarr;';
    } else if (step === 3) {
      body = `
        <div class="badge emerald" style="margin-bottom: 8px;">STEP 3: APPOINTMENT CONFIRMED</div>
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Slot Booked & Added to Calendar</h3>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 12px;">
          The appointment is placed on Dave's calendar for 02:00 PM today. Sarah receives an automated confirmation SMS with tracking link.
        </p>
      `;
      nextAction = 'View Updated Schedule on Dashboard &rarr;';
    } else {
      closeJourneyModal();
      setScreen('dashboard');
      return;
    }
  } else if (jKey === 'journeyB') {
    title = 'JOURNEY B: DAILY FIELD WORK';
    if (step === 1) {
      body = `
        <div class="badge blue" style="margin-bottom: 8px;">STEP 1: FIELD DISPATCH</div>
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Technician Taps "On My Way (15m)"</h3>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 12px;">
          Dave finishes his morning job, opens <code>/client/field</code>, and taps the oversized 1-tap ETA button.
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; margin-bottom: 16px;">
          &bull; Customer receives live SMS with tracking token: <code>captodesk.com/t/7f8a</code><br>
          &bull; Apple Maps opens turn-by-turn directions automatically.
        </div>
      `;
      nextAction = 'Simulate Arrived & Take Photos &rarr;';
    } else if (step === 2) {
      body = `
        <div class="badge emerald" style="margin-bottom: 8px;">STEP 2: JOB EXECUTION & PHOTO PROOF</div>
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">2 Before Photos & 1 After Photo Captured</h3>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 12px;">
          Dave replaces the pressure valve. Photos are safely cached in local storage before background upload.
        </p>
      `;
      nextAction = 'Generate Invoice & Apple Pay Checkout &rarr;';
    } else if (step === 3) {
      body = `
        <div class="badge emerald" style="margin-bottom: 8px;">STEP 3: INSTANT PAYMENT COLLECTED</div>
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">$229.00 Settled via Apple Pay</h3>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 12px;">
          Sarah double-clicks Apple Pay on Dave's phone. Funds clear to Dave's Stripe balance immediately.
        </p>
      `;
      nextAction = 'Complete Journey & Return &rarr;';
    } else {
      closeJourneyModal();
      setScreen('field');
      return;
    }
  } else if (jKey === 'journeyC') {
    title = 'JOURNEY C: QUOTE TO PAYMENT';
    if (step === 1) {
      body = `
        <div class="badge blue" style="margin-bottom: 8px;">STEP 1: PROPOSAL DISPATCHED</div>
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Estimate #QTE-1018 Sent to Customer</h3>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 12px;">
          $1,850.00 water heater replacement quote texted to customer with 1-tap approval link.
        </p>
      `;
      nextAction = 'Simulate Customer Approving Quote &rarr;';
    } else if (step === 2) {
      body = `
        <div class="badge emerald" style="margin-bottom: 8px;">STEP 2: ESTIMATE APPROVED ONLINE</div>
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Customer Accepted Quote ($1,850.00)</h3>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 12px;">
          Status updates instantly on contractor dashboard. Job auto-created on calendar.
        </p>
      `;
      nextAction = 'Finish Journey &rarr;';
    } else {
      closeJourneyModal();
      setScreen('quotes');
      return;
    }
  } else if (jKey === 'journeyD') {
    title = 'JOURNEY D: JOB COMPLETION TO REVIEW';
    if (step === 1) {
      body = `
        <div class="badge emerald" style="margin-bottom: 8px;">STEP 1: POLICY-COMPLIANT ELIGIBILITY CHECK</div>
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">60-Day Suppression Engine Evaluated</h3>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 12px;">
          Job #1042 marked paid. System verifies customer has not received a review request in 60 days.
        </p>
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; font-size: 12px; margin-bottom: 16px;">
          <strong>Zero-Gating Rule Enforced:</strong> Neutral invitation sent with identical Google link to all customers.
        </div>
      `;
      nextAction = 'Simulate Review SMS Delivery &rarr;';
    } else if (step === 2) {
      body = `
        <div class="badge emerald" style="margin-bottom: 8px;">STEP 2: REVIEW REQUEST DELIVERED</div>
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Public Google Link Delivered via SMS</h3>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 12px;">
          Sarah taps link, leaves 5-star review on Google Maps. CaptoDesk dashboard updates review count to 15.
        </p>
      `;
      nextAction = 'Finish Journey &rarr;';
    } else {
      closeJourneyModal();
      setScreen('reviews');
      return;
    }
  }

  container.innerHTML = `
    <div class="journey-step-bar">
      <span style="font-size: 13px; font-weight: 800; color: #0284c7;">${title}</span>
      <button style="background: none; border: none; font-size: 18px; cursor: pointer; color: #94a3b8;" onclick="closeJourneyModal()">&times;</button>
    </div>
    <div style="padding: 24px;">
      ${body}
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
        <button class="btn btn-secondary" onclick="closeJourneyModal()">Exit</button>
        <button class="btn btn-primary" onclick="advanceJourneyStep()">${nextAction}</button>
      </div>
    </div>
  `;
}
