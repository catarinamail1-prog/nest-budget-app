// app.js — ponto de entrada: decide quiz vs. shell principal, monta navegação e view ativa
import { I18n, detectBrowserLang } from './utils/i18n.js';
import { applyFontScale } from './utils/font-scale.js';
import { DB } from './storage/db.js';
import { CONFIG } from './config.js';
import { icon, BRAND_MARK } from './utils/icons.js';
import { renderQuiz } from './views/quiz.js';
import { renderDashboard } from './views/dashboard.js';
import { renderExpenses } from './views/expenses.js';
import { renderIncome } from './views/income.js';
import { renderFunds } from './views/funds.js';
import { renderWealth } from './views/wealth.js';
import { renderAIInsights } from './views/ai-insights.js';
import { renderAnalytics } from './views/analytics.js';
import { renderCalendar } from './views/calendar.js';
import { renderSettings } from './views/settings.js';

const NAV_ITEMS = [
  { key: 'dashboard', icon: 'grid' },
  { key: 'ai-insights', icon: 'sparkles' },
  { key: 'income', icon: 'income' },
  { key: 'expenses', icon: 'list' },
  { key: 'funds', icon: 'piggy' },
  { key: 'wealth', icon: 'wallet' },
  { key: 'analytics', icon: 'chartBar' },
  { key: 'calendar', icon: 'calendar' }
];

let activeView = 'dashboard';

function init() {
  // Primeira visita (nada salvo ainda): abre já no idioma do navegador do comprador,
  // em vez de sempre começar em inglês até ele trocar manualmente em Configurações.
  if (!DB.hasSettings()) {
    const detected = detectBrowserLang(CONFIG.DEFAULT_LANG);
    DB.saveSettings({ lang: detected, currency: CONFIG.DEFAULT_CURRENCY });
  }
  const settings = DB.getSettings();
  I18n.setLang(settings.lang || CONFIG.DEFAULT_LANG);
  applyFontScale(settings.fontScale);
  // Quem já usava a meta de poupança mensal única ganha um cofrinho inicial com esse valor (rodada
  // anterior de features); roda uma única vez, controlado por CONFIG.FUNDS_MIGRATED_KEY.
  DB.migrateGoalToFunds(I18n.t('funds.defaultName'));
  route();
}

function route() {
  if (!DB.hasProfile()) {
    renderQuizScreen();
  } else {
    renderShell();
  }
}

function renderQuizScreen(existingProfile = null) {
  const app = document.getElementById('app');
  app.innerHTML = '<div id="quiz-root"></div>';
  renderQuiz(document.getElementById('quiz-root'), {
    existingProfile,
    onComplete: () => {
      activeView = 'dashboard';
      renderShell();
    }
  });
}

function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-shell">
      <aside class="app-sidebar">
        <div class="app-sidebar__brand">${BRAND_MARK}</div>
        <nav class="app-sidebar__nav" id="app-nav"></nav>
        <div class="app-sidebar__bottom">
          <button class="nav-icon ${activeView === 'settings' ? 'is-active' : ''}" id="nav-settings" aria-label="${I18n.t('nav.settings')}">${icon('gear', 20)}</button>
        </div>
      </aside>
      <main class="app-main" id="app-view"></main>
    </div>
  `;
  paintNav();
  paintView();
}

function paintNav() {
  const nav = document.getElementById('app-nav');
  nav.innerHTML = NAV_ITEMS.map(item => `
    <button class="nav-icon ${activeView === item.key ? 'is-active' : ''}" data-view="${item.key}" aria-label="${I18n.t('nav.' + item.key)}">${icon(item.icon, 20)}</button>
  `).join('');
  nav.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeView = btn.dataset.view;
      paintNav();
      document.querySelectorAll('#nav-settings').forEach(b => b.classList.remove('is-active'));
      paintView();
    });
  });
  const settingsBtn = document.getElementById('nav-settings');
  settingsBtn.classList.toggle('is-active', activeView === 'settings');
  settingsBtn.addEventListener('click', () => {
    activeView = 'settings';
    paintNav();
    paintView();
  });
}

function paintView() {
  const view = document.getElementById('app-view');
  if (activeView === 'dashboard') {
    renderDashboard(view, { onNavigate: (v) => { activeView = v; paintNav(); paintView(); } });
  } else if (activeView === 'ai-insights') {
    renderAIInsights(view, { onNavigate: (v) => { activeView = v; paintNav(); paintView(); } });
  } else if (activeView === 'income') {
    renderIncome(view);
  } else if (activeView === 'expenses') {
    renderExpenses(view);
  } else if (activeView === 'funds') {
    renderFunds(view);
  } else if (activeView === 'wealth') {
    renderWealth(view);
  } else if (activeView === 'analytics') {
    renderAnalytics(view);
  } else if (activeView === 'calendar') {
    renderCalendar(view);
  } else if (activeView === 'settings') {
    renderSettings(view, {
      onLangChange: () => { paintNav(); paintView(); },
      onHouseholdReset: () => {
        const existing = DB.getProfile();
        if (existing) {
          renderQuizScreen(existing);
        } else {
          route();
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
