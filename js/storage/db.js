// storage/db.js — persistência em localStorage (Tier A: volume de dados de uma casa não justifica IndexedDB)
// + export/import JSON, export para Excel (.xlsx) e import de planilha antiga de orçamento (bridge de migração)
import { CONFIG } from '../config.js';
import { generateId } from '../utils/id.js';
import { downloadBlob, parseCSV } from '../utils/helpers.js';
import { round2, formatDateISO } from '../utils/format.js';
import { buildCategoriesFromProfile } from '../modules/categories.js';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn(`DB read error (${key}):`, err);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`DB write error (${key}):`, err);
    return false;
  }
}

export const DB = {
  // ---- perfil / onboarding ----
  hasProfile() {
    return !!readJSON(CONFIG.PROFILE_KEY, null);
  },

  getProfile() {
    return readJSON(CONFIG.PROFILE_KEY, null);
  },

  // Cria (ou refaz) o perfil e regenera as categorias personalizadas a partir dele.
  // Preserva o orçamento que o comprador já tiver ajustado nas categorias que continuarem existindo.
  saveProfile(profile) {
    const existingCats = this.getCategories();
    writeJSON(CONFIG.PROFILE_KEY, { ...profile, updatedAt: new Date().toISOString() });
    const generated = buildCategoriesFromProfile(profile);
    const merged = generated.map(cat => {
      const prev = existingCats.find(c => c.key === cat.key);
      return prev ? { ...cat, budget: prev.budget } : cat;
    });
    writeJSON(CONFIG.CATEGORIES_KEY, merged);
    return merged;
  },

  // ---- categorias ----
  getCategories() {
    return readJSON(CONFIG.CATEGORIES_KEY, []);
  },

  saveCategories(categories) {
    writeJSON(CONFIG.CATEGORIES_KEY, categories);
  },

  updateCategoryBudget(key, budget) {
    const cats = this.getCategories().map(c => c.key === key ? { ...c, budget: round2(budget) } : c);
    writeJSON(CONFIG.CATEGORIES_KEY, cats);
    return cats;
  },

  // Reclassifica uma categoria como necessidade/desejo pra regra 50/30/20 (ver modules/categories.js
  // categoryGroup — isso só existe pra sobrescrever o padrão do catálogo).
  updateCategoryGroup(key, group) {
    const cats = this.getCategories().map(c => c.key === key ? { ...c, group } : c);
    writeJSON(CONFIG.CATEGORIES_KEY, cats);
    return cats;
  },

  // Categoria personalizada criada pelo comprador (nome próprio digitado, sem tradução)
  addCategory(category) {
    const cats = [...this.getCategories(), category];
    writeJSON(CONFIG.CATEGORIES_KEY, cats);
    return cats;
  },

  // Só remove categorias personalizadas (custom: true) — as do catálogo padrão não podem ser apagadas.
  deleteCategory(key) {
    const cats = this.getCategories().filter(c => !(c.key === key && c.custom));
    writeJSON(CONFIG.CATEGORIES_KEY, cats);
    return cats;
  },

  // ---- meta de economia ----
  getGoal() {
    return readJSON(CONFIG.GOAL_KEY, { target: 0 });
  },

  saveGoal(goal) {
    writeJSON(CONFIG.GOAL_KEY, { ...this.getGoal(), ...goal });
  },

  // ---- contas bancárias / cartões de crédito ----
  getAccounts() {
    return readJSON(CONFIG.ACCOUNTS_KEY, []);
  },

  saveAccounts(accounts) {
    writeJSON(CONFIG.ACCOUNTS_KEY, accounts);
  },

  addAccount(account) {
    const accounts = this.getAccounts();
    const now = new Date().toISOString();
    const record = {
      id: generateId(),
      name: account.name || '',
      type: account.type,
      startingBalance: round2(account.startingBalance || 0),
      createdAt: now,
      updatedAt: now
    };
    accounts.push(record);
    writeJSON(CONFIG.ACCOUNTS_KEY, accounts);
    return record;
  },

  updateAccount(id, patch) {
    const accounts = this.getAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx < 0) return null;
    accounts[idx] = {
      ...accounts[idx],
      ...patch,
      startingBalance: round2(patch.startingBalance ?? accounts[idx].startingBalance),
      updatedAt: new Date().toISOString()
    };
    writeJSON(CONFIG.ACCOUNTS_KEY, accounts);
    return accounts[idx];
  },

  // Só remove a conta — despesas/rendas que apontavam pra ela ficam com um accountId órfão,
  // igual já acontece hoje quando uma categoria é apagada (a UI trata isso graciosamente).
  deleteAccount(id) {
    writeJSON(CONFIG.ACCOUNTS_KEY, this.getAccounts().filter(a => a.id !== id));
  },

  // ---- dívidas (calculadora snowball/avalanche/custom) ----
  getDebts() {
    return readJSON(CONFIG.DEBTS_KEY, []);
  },

  saveDebts(debts) {
    writeJSON(CONFIG.DEBTS_KEY, debts);
  },

  addDebt(debt) {
    const debts = this.getDebts();
    const now = new Date().toISOString();
    const record = {
      id: generateId(),
      name: debt.name || '',
      type: debt.type,
      balance: round2(debt.balance || 0),
      apr: round2(debt.apr || 0),
      minPayment: round2(debt.minPayment || 0),
      order: debts.length, // vai pro fim da ordem custom por padrão
      createdAt: now,
      updatedAt: now
    };
    debts.push(record);
    writeJSON(CONFIG.DEBTS_KEY, debts);
    return record;
  },

  updateDebt(id, patch) {
    const debts = this.getDebts();
    const idx = debts.findIndex(d => d.id === id);
    if (idx < 0) return null;
    debts[idx] = {
      ...debts[idx],
      ...patch,
      balance: round2(patch.balance ?? debts[idx].balance),
      apr: round2(patch.apr ?? debts[idx].apr),
      minPayment: round2(patch.minPayment ?? debts[idx].minPayment),
      updatedAt: new Date().toISOString()
    };
    writeJSON(CONFIG.DEBTS_KEY, debts);
    return debts[idx];
  },

  deleteDebt(id) {
    writeJSON(CONFIG.DEBTS_KEY, this.getDebts().filter(d => d.id !== id));
  },

  getDebtPlan() {
    return readJSON(CONFIG.DEBT_PLAN_KEY, { strategy: 'avalanche', extraMonthly: 0 });
  },

  saveDebtPlan(patch) {
    writeJSON(CONFIG.DEBT_PLAN_KEY, { ...this.getDebtPlan(), ...patch });
  },

  // ---- cofrinhos (sinking funds) — substituem a antiga meta de poupança única ----
  getFunds() {
    return readJSON(CONFIG.FUNDS_KEY, []);
  },

  saveFunds(funds) {
    writeJSON(CONFIG.FUNDS_KEY, funds);
  },

  addFund(fund) {
    const funds = this.getFunds();
    const now = new Date().toISOString();
    const record = {
      id: generateId(),
      name: fund.name || '',
      type: fund.type || 'general',
      target: round2(fund.target || 0),
      targetDate: fund.targetDate || null,
      fromQuiz: !!fund.fromQuiz,
      createdAt: now,
      updatedAt: now
    };
    funds.push(record);
    writeJSON(CONFIG.FUNDS_KEY, funds);
    return record;
  },

  updateFund(id, patch) {
    const funds = this.getFunds();
    const idx = funds.findIndex(f => f.id === id);
    if (idx < 0) return null;
    funds[idx] = {
      ...funds[idx],
      ...patch,
      target: round2(patch.target ?? funds[idx].target),
      updatedAt: new Date().toISOString()
    };
    writeJSON(CONFIG.FUNDS_KEY, funds);
    return funds[idx];
  },

  // Só remove o cofrinho — contribuições que apontavam pra ele ficam com um fundId órfão,
  // mesmo padrão tolerante de accountId/categoryKey já usado no resto do app.
  deleteFund(id) {
    writeJSON(CONFIG.FUNDS_KEY, this.getFunds().filter(f => f.id !== id));
  },

  // Migração de uma vez só: quem já usava a meta mensal única antiga ganha um cofrinho inicial
  // com esse valor como alvo, e todas as contribuições antigas (despesas categoria "savings")
  // passam a apontar pra ele — assim nada se perde na troca de modelo. Roda no boot do app.js.
  migrateGoalToFunds(defaultName) {
    if (readJSON(CONFIG.FUNDS_MIGRATED_KEY, false)) return;
    const goal = this.getGoal();
    const funds = this.getFunds();
    if (funds.length === 0 && goal.target > 0) {
      const fund = this.addFund({ name: defaultName, type: 'general', target: goal.target, fromQuiz: true });
      const expenses = this.getExpenses();
      let changed = false;
      expenses.forEach(e => {
        if (e.categoryKey === CONFIG.SAVINGS_CATEGORY_KEY && !e.fundId) {
          e.fundId = fund.id;
          changed = true;
        }
      });
      if (changed) writeJSON(CONFIG.EXPENSES_KEY, expenses);
    }
    writeJSON(CONFIG.FUNDS_MIGRATED_KEY, true);
  },

  // ---- despesas ----
  getExpenses() {
    return readJSON(CONFIG.EXPENSES_KEY, []);
  },

  getExpense(id) {
    return this.getExpenses().find(e => e.id === id) || null;
  },

  addExpense(expense) {
    const expenses = this.getExpenses();
    const now = new Date().toISOString();
    const record = {
      id: generateId(),
      description: expense.description || '',
      amount: round2(expense.amount),
      categoryKey: expense.categoryKey,
      date: expense.date || formatDateISO(),
      source: expense.source || 'manual',
      accountId: expense.accountId || null,
      fundId: expense.fundId || null,
      createdAt: now,
      updatedAt: now
    };
    expenses.unshift(record);
    writeJSON(CONFIG.EXPENSES_KEY, expenses);
    return record;
  },

  updateExpense(id, patch) {
    const expenses = this.getExpenses();
    const idx = expenses.findIndex(e => e.id === id);
    if (idx < 0) return null;
    expenses[idx] = { ...expenses[idx], ...patch, amount: round2(patch.amount ?? expenses[idx].amount), updatedAt: new Date().toISOString() };
    writeJSON(CONFIG.EXPENSES_KEY, expenses);
    return expenses[idx];
  },

  deleteExpense(id) {
    writeJSON(CONFIG.EXPENSES_KEY, this.getExpenses().filter(e => e.id !== id));
  },

  // ---- entradas (renda) ----
  getIncomes() {
    return readJSON(CONFIG.INCOMES_KEY, []);
  },

  getIncome(id) {
    return this.getIncomes().find(i => i.id === id) || null;
  },

  addIncome(income) {
    const incomes = this.getIncomes();
    const now = new Date().toISOString();
    const record = {
      id: generateId(),
      description: income.description || '',
      amount: round2(income.amount),
      type: income.type || 'other',
      date: income.date || formatDateISO(),
      source: income.source || 'manual',
      accountId: income.accountId || null,
      createdAt: now,
      updatedAt: now
    };
    incomes.unshift(record);
    writeJSON(CONFIG.INCOMES_KEY, incomes);
    return record;
  },

  updateIncome(id, patch) {
    const incomes = this.getIncomes();
    const idx = incomes.findIndex(i => i.id === id);
    if (idx < 0) return null;
    incomes[idx] = { ...incomes[idx], ...patch, amount: round2(patch.amount ?? incomes[idx].amount), updatedAt: new Date().toISOString() };
    writeJSON(CONFIG.INCOMES_KEY, incomes);
    return incomes[idx];
  },

  deleteIncome(id) {
    writeJSON(CONFIG.INCOMES_KEY, this.getIncomes().filter(i => i.id !== id));
  },

  // ---- configurações ----
  // Distingue "nunca configurado" (primeira visita, ainda sem nada salvo) de "já usa o padrão
  // porque o comprador escolheu isso" — getSettings() sozinho não dá pra diferenciar os dois.
  hasSettings() {
    return !!readJSON(CONFIG.SETTINGS_KEY, null);
  },

  getSettings() {
    return readJSON(CONFIG.SETTINGS_KEY, { lang: CONFIG.DEFAULT_LANG, currency: CONFIG.DEFAULT_CURRENCY });
  },

  saveSettings(settings) {
    writeJSON(CONFIG.SETTINGS_KEY, { ...this.getSettings(), ...settings });
  },

  // ---- conta de IA (leitura de recibo por foto, BYOK) ----
  // De propósito FORA de exportJSON/importJSON: a chave de API é um segredo da pessoa, não faz
  // sentido ela ir dentro de um backup .json que pode ser compartilhado. clearAll() continua
  // removendo, porque "apagar tudo" deve mesmo apagar tudo, inclusive a chave.
  getAISettings() {
    return readJSON(CONFIG.AI_SETTINGS_KEY, { provider: 'anthropic', apiKey: '', model: '' });
  },

  saveAISettings(settings) {
    writeJSON(CONFIG.AI_SETTINGS_KEY, { ...this.getAISettings(), ...settings });
  },

  clearAISettings() {
    localStorage.removeItem(CONFIG.AI_SETTINGS_KEY);
  },

  // ---- reset ----
  clearAll() {
    [CONFIG.PROFILE_KEY, CONFIG.CATEGORIES_KEY, CONFIG.EXPENSES_KEY, CONFIG.INCOMES_KEY, CONFIG.GOAL_KEY, CONFIG.ACCOUNTS_KEY, CONFIG.DEBTS_KEY, CONFIG.DEBT_PLAN_KEY, CONFIG.FUNDS_KEY, CONFIG.FUNDS_MIGRATED_KEY, CONFIG.AI_SETTINGS_KEY].forEach(k => localStorage.removeItem(k));
  },

  // ---- export / import ----
  exportJSON() {
    const data = {
      version: CONFIG.VERSION,
      product: CONFIG.PRODUCT_SLUG,
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      profile: this.getProfile(),
      categories: this.getCategories(),
      goal: this.getGoal(),
      accounts: this.getAccounts(),
      debts: this.getDebts(),
      debtPlan: this.getDebtPlan(),
      funds: this.getFunds(),
      expenses: this.getExpenses(),
      incomes: this.getIncomes()
    };
    const date = formatDateISO();
    downloadBlob(JSON.stringify(data, null, 2), `${CONFIG.PRODUCT_SLUG}_backup_${date}.json`, 'application/json');
  },

  exportXLSX() {
    if (typeof XLSX === 'undefined') throw new Error('xlsx_unavailable');
    const cats = this.getCategories();
    const catLabel = (key) => cats.find(c => c.key === key)?.key || key;
    const expenseRows = this.getExpenses()
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => ({
        'Date': e.date,
        'Description': e.description,
        'Category': catLabel(e.categoryKey),
        'Amount': round2(e.amount)
      }));
    const incomeRows = this.getIncomes()
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(i => ({
        'Date': i.date,
        'Description': i.description,
        'Type': i.type,
        'Amount': round2(i.amount)
      }));
    const wsExpenses = XLSX.utils.json_to_sheet(expenseRows.length ? expenseRows : [{ Date: '', Description: '', Category: '', Amount: '' }]);
    wsExpenses['!cols'] = [{ wch: 12 }, { wch: 32 }, { wch: 14 }, { wch: 12 }];
    const wsIncome = XLSX.utils.json_to_sheet(incomeRows.length ? incomeRows : [{ Date: '', Description: '', Type: '', Amount: '' }]);
    wsIncome['!cols'] = [{ wch: 12 }, { wch: 32 }, { wch: 14 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');
    XLSX.utils.book_append_sheet(wb, wsIncome, 'Income');
    const date = formatDateISO();
    XLSX.writeFile(wb, `${CONFIG.PRODUCT_SLUG}_${date}.xlsx`);
  },

  async importJSON(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data.expenses)) throw new Error('invalid_format');
    if (data.profile) writeJSON(CONFIG.PROFILE_KEY, data.profile);
    if (Array.isArray(data.categories)) writeJSON(CONFIG.CATEGORIES_KEY, data.categories);
    if (data.goal) writeJSON(CONFIG.GOAL_KEY, data.goal);
    if (Array.isArray(data.accounts)) writeJSON(CONFIG.ACCOUNTS_KEY, data.accounts);
    if (Array.isArray(data.debts)) writeJSON(CONFIG.DEBTS_KEY, data.debts);
    if (data.debtPlan) writeJSON(CONFIG.DEBT_PLAN_KEY, data.debtPlan);
    if (Array.isArray(data.funds)) writeJSON(CONFIG.FUNDS_KEY, data.funds);
    if (data.settings) writeJSON(CONFIG.SETTINGS_KEY, data.settings);
    writeJSON(CONFIG.EXPENSES_KEY, data.expenses);
    if (Array.isArray(data.incomes)) writeJSON(CONFIG.INCOMES_KEY, data.incomes);
    return data.expenses.length;
  },

  // Import de planilha antiga de orçamento doméstico — reconhece colunas comuns por nome.
  // Despesas sem categoria reconhecível caem em "personal" (ajustável depois).
  async importSpreadsheetCSV(file) {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('empty');

    const header = rows[0].map(h => h.trim().toLowerCase());
    const findCol = (...aliases) => header.findIndex(h => aliases.some(a => h.includes(a)));

    const col = {
      description: findCol('description', 'item', 'expense', 'descricao', 'descrição', 'despesa', 'gasto', 'concepto', 'concept'),
      amount: findCol('amount', 'valor', 'total', 'price', 'preco', 'preço', 'importe', 'montant'),
      date: findCol('date', 'data', 'fecha', 'datum'),
      category: findCol('category', 'categoria', 'catégorie', 'kategorie')
    };

    const cats = this.getCategories();
    const matchCategory = (raw) => {
      if (!raw) return 'personal';
      const norm = raw.trim().toLowerCase();
      const found = cats.find(c => c.key.toLowerCase() === norm || norm.includes(c.key.toLowerCase()));
      return found ? found.key : 'personal';
    };
    const toNum = (v) => {
      const n = parseFloat(String(v ?? '').replace(/[^0-9.,-]/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const toISODate = (v) => {
      if (!v) return formatDateISO();
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? formatDateISO() : formatDateISO(d);
    };

    const expenses = this.getExpenses();
    let imported = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const description = col.description >= 0 ? r[col.description]?.trim() : '';
      if (!description) continue;
      const now = new Date().toISOString();
      expenses.unshift({
        id: generateId(),
        description,
        amount: col.amount >= 0 ? round2(toNum(r[col.amount])) : 0,
        categoryKey: col.category >= 0 ? matchCategory(r[col.category]) : 'personal',
        date: col.date >= 0 ? toISODate(r[col.date]) : formatDateISO(),
        source: 'manual',
        createdAt: now,
        updatedAt: now
      });
      imported++;
    }
    writeJSON(CONFIG.EXPENSES_KEY, expenses);
    return imported;
  }
};
