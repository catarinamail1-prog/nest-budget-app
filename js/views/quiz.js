// views/quiz.js — onboarding: composição da casa → renda → meta de poupança → revisão do orçamento personalizado
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { CONFIG } from '../config.js';
import { buildCategoriesFromProfile } from '../modules/categories.js';
import { icon, NEST_MARK } from '../utils/icons.js';
import { round2, formatDateISO } from '../utils/format.js';
import { categoryLabel } from '../utils/helpers.js';

const TOTAL_STEPS = 5;

export function renderQuiz(container, { onComplete, existingProfile } = {}) {
  let step = 1;
  let profile = existingProfile
    ? {
        householdType: existingProfile.hasPartner ? 'partner' : 'alone',
        hasKids: !!existingProfile.hasKids,
        kidsCount: existingProfile.kidsCount || 1,
        hasPets: !!existingProfile.hasPets,
        housingType: existingProfile.housingType || null,
        rentAmount: existingProfile.rentAmount || 0,
        carsCount: existingProfile.carsCount != null ? existingProfile.carsCount : 1,
        hasHealthPlan: !!existingProfile.hasHealthPlan,
        healthPlanAmount: existingProfile.healthPlanAmount || 0
      }
    : { householdType: null, hasKids: false, kidsCount: 1, hasPets: false, housingType: null, rentAmount: 0, carsCount: 1, hasHealthPlan: false, healthPlanAmount: 0 };
  const priorIncomes = DB.getIncomes();
  const lastSalary = priorIncomes.find(i => i.type === 'salary');
  let monthlyIncome = lastSalary ? lastSalary.amount : 0;
  // O cofrinho criado por este passo do quiz é marcado com fromQuiz — refazer o quiz (reset de casa)
  // atualiza esse mesmo cofrinho em vez de criar um novo a cada vez.
  const quizFund = DB.getFunds().find(f => f.fromQuiz);
  let goalTarget = quizFund ? quizFund.target : 0;
  let categories = buildCategoriesFromProfile(profile);
  const currency = DB.getSettings().currency;
  const curSymbol = (CONFIG.CURRENCIES[currency] || CONFIG.CURRENCIES.USD).symbol;

  function quizCard(key, label, iconName, selected) {
    return `
      <button type="button" class="quiz-card ${selected ? 'is-selected' : ''}" data-card="${key}">
        ${selected ? `<span class="quiz-card__check">${icon('checkCircle', 18, 2)}</span>` : ''}
        <span class="quiz-card__icon">${icon(iconName, 22)}</span>
        <span class="quiz-card__label">${label}</span>
      </button>
    `;
  }

  function renderHousehold() {
    return `
      <div class="quiz-heading"><h1>${I18n.t('quiz.householdTitle')}</h1><p>${I18n.t('quiz.householdSubtitle')}</p></div>
      <div class="quiz-grid">
        ${quizCard('alone', I18n.t('quiz.justMe'), 'person', profile.householdType === 'alone')}
        ${quizCard('partner', I18n.t('quiz.partner'), 'people', profile.householdType === 'partner')}
        ${quizCard('kids', I18n.t('quiz.kids'), 'bottle', profile.hasKids)}
        ${quizCard('pets', I18n.t('quiz.pets'), 'paw', profile.hasPets)}
      </div>
      ${profile.hasKids ? `
        <div class="quiz-stepper-row">
          <span style="font-weight:600;font-size:15px;">${I18n.t('quiz.howManyKids')}</span>
          <div class="pill-group">
            ${[1, 2, 3].map(n => `<div class="pill-btn ${(n === 3 ? profile.kidsCount >= 3 : profile.kidsCount === n) ? 'is-selected' : ''}" data-kids="${n}">${n === 3 ? '3+' : n}</div>`).join('')}
          </div>
        </div>` : ''}
      <div class="quiz-footer">
        <span></span>
        <button class="btn btn--primary" id="q-next" ${profile.householdType ? '' : 'disabled'}>${I18n.t('quiz.continue')}</button>
      </div>
    `;
  }

  function renderHome() {
    return `
      <div class="quiz-heading"><h1>${I18n.t('quiz.homeTitle')}</h1><p>${I18n.t('quiz.homeSubtitle')}</p></div>
      <div class="quiz-grid">
        ${quizCard('own', I18n.t('quiz.homeOwn'), 'house', profile.housingType === 'own')}
        ${quizCard('rent', I18n.t('quiz.homeRent'), 'key', profile.housingType === 'rent')}
      </div>
      ${profile.housingType === 'rent' ? `
        <div class="card u-mt-md">
          <label class="field">
            <span class="field__label">${I18n.t('quiz.rentLabel')}</span>
            <input type="number" min="0" step="1" id="q-rent" value="${profile.rentAmount || ''}" placeholder="${curSymbol}0">
          </label>
          <p class="field__hint u-mt-xs">${I18n.t('quiz.rentHint')}</p>
        </div>` : ''}
      <div class="quiz-stepper-row">
        <span style="font-weight:600;font-size:15px;">${I18n.t('quiz.howManyCars')}</span>
        <div class="pill-group">
          ${[0, 1, 2, 3].map(n => `<div class="pill-btn ${(n === 3 ? profile.carsCount >= 3 : profile.carsCount === n) ? 'is-selected' : ''}" data-cars="${n}">${n === 3 ? '3+' : n}</div>`).join('')}
        </div>
      </div>
      <div class="quiz-stepper-row">
        <span style="font-weight:600;font-size:15px;">${I18n.t('quiz.healthPlanQuestion')}</span>
        <div class="pill-group">
          <div class="pill-btn ${profile.hasHealthPlan ? 'is-selected' : ''}" data-healthplan="yes">${I18n.t('common.yes')}</div>
          <div class="pill-btn ${!profile.hasHealthPlan ? 'is-selected' : ''}" data-healthplan="no">${I18n.t('common.no')}</div>
        </div>
      </div>
      ${profile.hasHealthPlan ? `
        <div class="card u-mt-md">
          <label class="field">
            <span class="field__label">${I18n.t('quiz.healthPlanLabel')}</span>
            <input type="number" min="0" step="1" id="q-healthplan" value="${profile.healthPlanAmount || ''}" placeholder="${curSymbol}0">
          </label>
          <p class="field__hint u-mt-xs">${I18n.t('quiz.healthPlanHint')}</p>
        </div>` : ''}
      <div class="quiz-footer">
        <button class="btn btn--text" id="q-back">${icon('backArrow', 18)}${I18n.t('quiz.back')}</button>
        <button class="btn btn--primary" id="q-next" ${profile.housingType ? '' : 'disabled'}>${I18n.t('quiz.continue')}</button>
      </div>
    `;
  }

  function renderIncome() {
    return `
      <div class="quiz-heading"><h1>${I18n.t('quiz.incomeTitle')}</h1><p>${I18n.t('quiz.incomeSubtitle')}</p></div>
      <div class="card u-mt-md">
        <label class="field">
          <span class="field__label">${I18n.t('quiz.incomeLabel')}</span>
          <input type="number" min="0" step="1" id="q-income" value="${monthlyIncome || ''}" placeholder="${curSymbol}0">
        </label>
        <p class="field__hint u-mt-xs">${I18n.t('quiz.incomeHint')}</p>
      </div>
      <div class="quiz-footer">
        <button class="btn btn--text" id="q-back">${icon('backArrow', 18)}${I18n.t('quiz.back')}</button>
        <button class="btn btn--primary" id="q-next">${I18n.t('quiz.continue')}</button>
      </div>
    `;
  }

  function renderGoal() {
    return `
      <div class="quiz-heading"><h1>${I18n.t('quiz.goalTitle')}</h1><p>${I18n.t('quiz.goalSubtitle')}</p></div>
      <div class="card u-mt-md">
        <label class="field">
          <span class="field__label">${I18n.t('quiz.goalLabel')}</span>
          <input type="number" min="0" step="1" id="q-goal" value="${goalTarget || ''}" placeholder="${curSymbol}0">
        </label>
      </div>
      <div class="quiz-footer">
        <button class="btn btn--text" id="q-back">${icon('backArrow', 18)}${I18n.t('quiz.back')}</button>
        <button class="btn btn--primary" id="q-next">${I18n.t('quiz.continue')}</button>
      </div>
    `;
  }

  function renderReview() {
    return `
      <div class="quiz-heading"><h1>${I18n.t('quiz.reviewTitle')}</h1><p>${I18n.t('quiz.reviewSubtitle')}</p></div>
      <div class="card u-mt-md">
        ${categories.map(c => `
          <div class="review-row">
            <span class="cat-chip" style="background:var(--cat-${c.color}-bg); color:var(--cat-${c.color});">${icon(c.icon, 18)}</span>
            <span style="flex:1;font-weight:600;">${categoryLabel(c)}</span>
            <div class="review-row__budget">
              <span class="u-text-muted">${curSymbol}</span>
              <input type="number" min="0" step="1" data-budget-key="${c.key}" value="${c.budget}">
            </div>
          </div>
        `).join('')}
      </div>
      <div class="quiz-footer">
        <button class="btn btn--text" id="q-back">${icon('backArrow', 18)}${I18n.t('quiz.back')}</button>
        <button class="btn btn--primary" id="q-finish">${I18n.t('quiz.finish')}</button>
      </div>
    `;
  }

  function paint() {
    const body = step === 1 ? renderHousehold()
      : step === 2 ? renderHome()
      : step === 3 ? renderIncome()
      : step === 4 ? renderGoal()
      : renderReview();
    container.innerHTML = `
      <div class="quiz-shell">
        <div class="quiz-panel">
          <div class="quiz-topbar">
            <div class="quiz-brand">${NEST_MARK}<span>${I18n.t('app.title')}</span></div>
            <span class="quiz-step-label">${I18n.t('quiz.stepLabel', { current: step, total: TOTAL_STEPS })}</span>
          </div>
          <div class="quiz-progress"><div class="quiz-progress__fill" style="width:${(step / TOTAL_STEPS) * 100}%"></div></div>
          ${body}
        </div>
      </div>
    `;
    wire();
  }

  function wire() {
    if (step === 1) {
      container.querySelectorAll('[data-card]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.card;
          if (key === 'alone' || key === 'partner') {
            profile.householdType = key;
          } else if (key === 'kids') {
            profile.hasKids = !profile.hasKids;
            if (profile.hasKids && !profile.kidsCount) profile.kidsCount = 1;
          } else if (key === 'pets') {
            profile.hasPets = !profile.hasPets;
          }
          categories = buildCategoriesFromProfile(profile);
          paint();
        });
      });
      container.querySelectorAll('[data-kids]').forEach(pill => {
        pill.addEventListener('click', () => {
          profile.kidsCount = Number(pill.dataset.kids);
          categories = buildCategoriesFromProfile(profile);
          paint();
        });
      });
      const nextBtn = container.querySelector('#q-next');
      if (nextBtn) nextBtn.addEventListener('click', () => {
        if (!profile.householdType) return;
        step = 2;
        paint();
      });
    } else if (step === 2) {
      container.querySelectorAll('[data-card]').forEach(btn => {
        btn.addEventListener('click', () => {
          profile.housingType = btn.dataset.card;
          categories = buildCategoriesFromProfile(profile);
          paint();
        });
      });
      container.querySelectorAll('[data-cars]').forEach(pill => {
        pill.addEventListener('click', () => {
          profile.carsCount = Number(pill.dataset.cars);
          categories = buildCategoriesFromProfile(profile);
          paint();
        });
      });
      const rentInput = container.querySelector('#q-rent');
      if (rentInput) rentInput.addEventListener('input', () => {
        const val = parseFloat(rentInput.value);
        profile.rentAmount = Number.isFinite(val) && val >= 0 ? val : 0;
        categories = buildCategoriesFromProfile(profile);
      });
      container.querySelectorAll('[data-healthplan]').forEach(pill => {
        pill.addEventListener('click', () => {
          profile.hasHealthPlan = pill.dataset.healthplan === 'yes';
          categories = buildCategoriesFromProfile(profile);
          paint();
        });
      });
      const healthPlanInput = container.querySelector('#q-healthplan');
      if (healthPlanInput) healthPlanInput.addEventListener('input', () => {
        const val = parseFloat(healthPlanInput.value);
        profile.healthPlanAmount = Number.isFinite(val) && val >= 0 ? val : 0;
        categories = buildCategoriesFromProfile(profile);
      });
      container.querySelector('#q-back').addEventListener('click', () => { step = 1; paint(); });
      container.querySelector('#q-next').addEventListener('click', () => {
        if (!profile.housingType) return;
        step = 3;
        paint();
      });
    } else if (step === 3) {
      container.querySelector('#q-back').addEventListener('click', () => { step = 2; paint(); });
      container.querySelector('#q-next').addEventListener('click', () => {
        const val = parseFloat(container.querySelector('#q-income').value);
        monthlyIncome = Number.isFinite(val) && val >= 0 ? round2(val) : 0;
        step = 4;
        paint();
      });
    } else if (step === 4) {
      container.querySelector('#q-back').addEventListener('click', () => { step = 3; paint(); });
      container.querySelector('#q-next').addEventListener('click', () => {
        const val = parseFloat(container.querySelector('#q-goal').value);
        goalTarget = Number.isFinite(val) && val >= 0 ? round2(val) : 0;
        categories = buildCategoriesFromProfile(profile);
        step = 5;
        paint();
      });
    } else {
      container.querySelectorAll('[data-budget-key]').forEach(input => {
        input.addEventListener('input', () => {
          const key = input.dataset.budgetKey;
          const val = parseFloat(input.value);
          categories = categories.map(c => c.key === key ? { ...c, budget: Number.isFinite(val) ? val : 0 } : c);
        });
      });
      container.querySelector('#q-back').addEventListener('click', () => { step = 4; paint(); });
      container.querySelector('#q-finish').addEventListener('click', () => {
        const finalCategories = categories.map(c => ({ ...c, budget: round2(c.budget) }));
        DB.saveProfile({
          hasPartner: profile.householdType === 'partner',
          hasKids: profile.hasKids,
          kidsCount: profile.hasKids ? profile.kidsCount : 0,
          hasPets: profile.hasPets,
          housingType: profile.housingType,
          rentAmount: profile.housingType === 'rent' ? round2(profile.rentAmount || 0) : 0,
          carsCount: profile.carsCount,
          hasHealthPlan: profile.hasHealthPlan,
          healthPlanAmount: profile.hasHealthPlan ? round2(profile.healthPlanAmount || 0) : 0
        });
        DB.saveCategories(finalCategories);
        if (quizFund) {
          DB.updateFund(quizFund.id, { target: goalTarget });
        } else if (goalTarget > 0) {
          DB.addFund({ name: I18n.t('funds.defaultName'), type: 'general', target: goalTarget, fromQuiz: true });
        }
        // Não duplica: se já existe uma entrada de salário (de uma execução anterior do quiz),
        // apenas atualiza o valor; só cria uma nova entrada na primeira vez.
        if (monthlyIncome > 0) {
          if (lastSalary) {
            if (monthlyIncome !== lastSalary.amount) {
              DB.updateIncome(lastSalary.id, { amount: monthlyIncome });
            }
          } else {
            DB.addIncome({
              description: I18n.t('income.typeSalary'),
              amount: monthlyIncome,
              type: 'salary',
              date: formatDateISO(),
              source: 'manual'
            });
          }
        }
        onComplete?.();
      });
    }
  }

  paint();
}
