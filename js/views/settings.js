// views/settings.js — idioma, moeda, casa (refazer quiz), backup, import de planilha antiga, apagar dados
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { CONFIG } from '../config.js';
import { icon } from '../utils/icons.js';
import { categoryLabel } from '../utils/helpers.js';
import { createCustomCategory, categoryGroup } from '../modules/categories.js';
import { AI_PROVIDERS } from '../modules/receipt-ai.js';
import { showToast } from '../components/toast.js';
import { applyFontScale, stepFontScale, clampFontScale, FONT_SCALE_STEPS } from '../utils/font-scale.js';
import '../components/app-modal.js';

function escapeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}

const LANG_LABELS = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', 'pt-BR': 'Português (Brasil)', 'pt-PT': 'Português (Portugal)', it: 'Italiano' };
const CUSTOM_COLOR_OPTIONS = ['housing', 'groceries', 'utilities', 'car', 'kids', 'pets', 'personal', 'extra'];
// Nomes amigáveis das famílias de cor disponíveis pra categoria personalizada — não precisa de
// tradução perfeita, é só pra reconhecer visualmente a cor no <select> (que não renderiza swatches).
const COLOR_NAMES = {
  en: { housing: 'Terracotta', groceries: 'Green', utilities: 'Amber', car: 'Blue', kids: 'Berry', pets: 'Sage', personal: 'Coral', extra: 'Neutral' },
  es: { housing: 'Terracota', groceries: 'Verde', utilities: 'Ámbar', car: 'Azul', kids: 'Frambuesa', pets: 'Salvia', personal: 'Coral', extra: 'Neutro' },
  fr: { housing: 'Terracotta', groceries: 'Vert', utilities: 'Ambre', car: 'Bleu', kids: 'Baie', pets: 'Sauge', personal: 'Corail', extra: 'Neutre' },
  de: { housing: 'Terrakotta', groceries: 'Grün', utilities: 'Bernstein', car: 'Blau', kids: 'Beere', pets: 'Salbei', personal: 'Koralle', extra: 'Neutral' },
  'pt-BR': { housing: 'Terracota', groceries: 'Verde', utilities: 'Âmbar', car: 'Azul', kids: 'Framboesa', pets: 'Salva', personal: 'Coral', extra: 'Neutro' },
  'pt-PT': { housing: 'Terracota', groceries: 'Verde', utilities: 'Âmbar', car: 'Azul', kids: 'Framboesa', pets: 'Salva', personal: 'Coral', extra: 'Neutro' },
  it: { housing: 'Terracotta', groceries: 'Verde', utilities: 'Ambra', car: 'Blu', kids: 'Lampone', pets: 'Salvia', personal: 'Corallo', extra: 'Neutro' }
};

export function renderSettings(container, { onLangChange, onHouseholdReset } = {}) {
  const settings = DB.getSettings();
  let aiKeyVisible = false;

  function paint() {
    const aiSettings = DB.getAISettings();
    container.innerHTML = `
      <div class="view-header">
        <div><h1 class="view-title">${I18n.t('settings.title')}</h1></div>
      </div>

      <div class="card u-mb-md">
        <div class="field-row">
          <label class="field">
            <span class="field__label">${I18n.t('settings.language')}</span>
            <select id="set-lang">
              ${CONFIG.SUPPORTED_LANGS.map(l => `<option value="${l}" ${settings.lang === l ? 'selected' : ''}>${LANG_LABELS[l]}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span class="field__label">${I18n.t('settings.currency')}</span>
            <select id="set-currency">
              ${Object.entries(CONFIG.CURRENCIES).map(([code, c]) => `<option value="${code}" ${settings.currency === code ? 'selected' : ''}>${c.label} (${c.symbol})</option>`).join('')}
            </select>
          </label>
        </div>
        <label class="field u-mt-sm">
          <span class="field__label">${I18n.t('settings.fontSize')}</span>
          <div class="fontsize-control">
            <button type="button" class="fontsize-control__btn" id="font-dec" aria-label="${I18n.t('settings.fontSizeDecrease')}" ${clampFontScale(settings.fontScale) <= FONT_SCALE_STEPS[0] ? 'disabled' : ''}>A<span class="fontsize-control__sign">&minus;</span></button>
            <span class="fontsize-control__value" id="font-value">${Math.round(clampFontScale(settings.fontScale) * 100)}%</span>
            <button type="button" class="fontsize-control__btn" id="font-inc" aria-label="${I18n.t('settings.fontSizeIncrease')}" ${clampFontScale(settings.fontScale) >= FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1] ? 'disabled' : ''}>A<span class="fontsize-control__sign">+</span></button>
          </div>
        </label>
      </div>

      <h3 class="section-title u-mb-sm">${I18n.t('settings.categories')}</h3>
      <p class="u-text-faint u-text-sm u-mb-sm" style="margin-top:-6px;">${I18n.t('settings.categoryGroupHint')}</p>
      <div class="card u-mb-md">
        ${DB.getCategories().map(c => `
          <div class="review-row">
            <span class="cat-chip" style="background:var(--cat-${c.color}-bg); color:var(--cat-${c.color});">${icon(c.icon, 18)}</span>
            <span style="flex:1;font-weight:600;">${categoryLabel(c)}</span>
            <select class="u-text-sm" data-cat-group="${c.key}" style="border:1.5px solid var(--border); border-radius:8px; padding:6px 8px; background:var(--surface); color:var(--ink);">
              <option value="needs" ${categoryGroup(c) === 'needs' ? 'selected' : ''}>${I18n.t('budgetRule.needs')}</option>
              <option value="wants" ${categoryGroup(c) === 'wants' ? 'selected' : ''}>${I18n.t('budgetRule.wants')}</option>
            </select>
            ${c.custom ? `<button class="icon-btn icon-btn--danger" data-del-cat="${c.key}" aria-label="${I18n.t('common.delete')}">${icon('trash', 15)}</button>` : ''}
          </div>
        `).join('')}
        <div class="u-flex u-gap-sm u-items-end u-mt-sm" style="flex-wrap:wrap;">
          <label class="field" style="flex:1; min-width:160px;">
            <span class="field__label">${I18n.t('settings.newCategoryLabel')}</span>
            <input type="text" id="new-cat-name" placeholder="${I18n.t('settings.newCategoryPlaceholder')}">
          </label>
          <label class="field">
            <span class="field__label">${I18n.t('settings.newCategoryColor')}</span>
            <select id="new-cat-color">
              ${CUSTOM_COLOR_OPTIONS.map(c => `<option value="${c}">${(COLOR_NAMES[I18n.getLang()] || COLOR_NAMES.en)[c]}</option>`).join('')}
            </select>
          </label>
          <button class="btn btn--ghost" id="btn-add-cat">${icon('plus', 16, 2)}${I18n.t('settings.addCategory')}</button>
        </div>
      </div>

      <h3 class="section-title u-mb-sm">${I18n.t('settings.aiTitle')}</h3>
      <p class="u-text-faint u-text-sm u-mb-sm" style="margin-top:-6px;">${I18n.t('settings.aiSubtitle')}</p>
      <div class="card u-mb-md">
        <div class="field-row">
          <label class="field">
            <span class="field__label">${I18n.t('settings.aiProvider')}</span>
            <div class="field__static">${icon('sparkles', 16, 2)}${AI_PROVIDERS.anthropic.label}</div>
          </label>
          <label class="field">
            <span class="field__label">${I18n.t('settings.aiModel')}</span>
            <input type="text" id="ai-model" placeholder="${(AI_PROVIDERS[aiSettings.provider] || AI_PROVIDERS.anthropic).defaultModel}" value="${aiSettings.model ? escapeAttr(aiSettings.model) : ''}">
          </label>
        </div>
        <label class="field u-mt-sm">
          <span class="field__label">${I18n.t('settings.aiApiKey')}</span>
          <div class="u-flex u-gap-sm">
            <input type="${aiKeyVisible ? 'text' : 'password'}" id="ai-api-key" style="flex:1;" placeholder="${(AI_PROVIDERS[aiSettings.provider] || AI_PROVIDERS.anthropic).keyPlaceholder}" value="${aiSettings.apiKey ? escapeAttr(aiSettings.apiKey) : ''}">
            <button type="button" class="icon-btn" id="ai-toggle-key" aria-label="${I18n.t('settings.aiShowKey')}">${icon('eye', 18)}</button>
          </div>
        </label>
        <p class="field__hint u-mt-sm">${I18n.t('settings.aiPrivacyNote')}</p>
        <div class="u-flex u-gap-sm u-mt-sm">
          <button class="btn btn--primary" id="ai-save">${I18n.t('settings.aiSave')}</button>
          ${aiSettings.apiKey ? `<button class="btn btn--ghost" id="ai-clear">${I18n.t('settings.aiClear')}</button>` : ''}
        </div>
      </div>

      <h3 class="section-title u-mb-sm">${I18n.t('settings.household')}</h3>
      <div class="card u-mb-md">
        <button class="btn btn--ghost u-w-full" id="btn-redo-quiz">${I18n.t('settings.editHousehold')}</button>
      </div>

      <h3 class="section-title u-mb-sm">${I18n.t('settings.dataManagement')}</h3>
      <div class="card u-flex-col u-gap-sm">
        <p class="u-text-muted u-text-sm" style="margin:0 0 4px;">${I18n.t('settings.privacyNote')}</p>

        <button class="btn btn--ghost u-w-full" id="btn-export">${I18n.t('settings.exportData')}</button>
        <button class="btn btn--ghost u-w-full" id="btn-export-xlsx">${I18n.t('settings.exportExcel')}</button>

        <label class="btn btn--ghost u-w-full" style="text-align:center; cursor:pointer;">
          ${I18n.t('settings.importData')}
          <input type="file" accept="application/json" id="file-import-json" class="u-hidden">
        </label>

        <div class="u-flex-col u-gap-sm" style="border-top:1px solid var(--border); padding-top:12px; margin-top:4px;">
          <span class="field__label">${I18n.t('settings.importSpreadsheet')}</span>
          <p class="u-text-muted u-text-sm" style="margin:0;">${I18n.t('settings.importSpreadsheetHint')}</p>
          <label class="btn btn--ghost u-w-full" style="text-align:center; cursor:pointer;">
            ${I18n.t('settings.importSpreadsheet')}
            <input type="file" accept=".csv,text/csv" id="file-import-csv" class="u-hidden">
          </label>
        </div>

        <button class="btn btn--danger u-w-full u-mt-sm" id="btn-clear">${I18n.t('settings.clearAll')}</button>
      </div>

      <app-modal modal-title="${I18n.t('settings.editHousehold')}" id="redo-modal">
        <p style="margin:0;">${I18n.t('settings.editHouseholdConfirm')}</p>
        <div class="app-modal__actions">
          <button class="btn btn--ghost" id="redo-cancel">${I18n.t('common.cancel')}</button>
          <button class="btn btn--primary" id="redo-confirm">${I18n.t('quiz.continue')}</button>
        </div>
      </app-modal>

      <app-modal modal-title="${I18n.t('settings.clearAll')}" id="clear-modal">
        <p style="margin:0;">${I18n.t('settings.clearAllConfirm')}</p>
        <div class="app-modal__actions">
          <button class="btn btn--ghost" id="clear-cancel">${I18n.t('common.cancel')}</button>
          <button class="btn btn--danger" id="clear-confirm">${I18n.t('settings.clearAll')}</button>
        </div>
      </app-modal>
    `;

    container.querySelector('#btn-add-cat').addEventListener('click', () => {
      const nameInput = container.querySelector('#new-cat-name');
      const name = nameInput.value.trim();
      if (!name) return;
      const color = container.querySelector('#new-cat-color').value;
      DB.addCategory(createCustomCategory(name, { color, icon: 'sparkle', budget: 0 }));
      showToast(I18n.t('toast.categoryAdded'), 'success');
      paint();
    });
    container.querySelectorAll('[data-cat-group]').forEach(sel => {
      sel.addEventListener('change', (e) => {
        DB.updateCategoryGroup(sel.dataset.catGroup, e.target.value);
        showToast(I18n.t('toast.categoryUpdated'), 'success');
      });
    });
    container.querySelectorAll('[data-del-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.confirm(I18n.t('settings.deleteCategoryConfirm'))) return;
        DB.deleteCategory(btn.dataset.delCat);
        showToast(I18n.t('toast.categoryDeleted'), 'success');
        paint();
      });
    });

    container.querySelector('#ai-toggle-key').addEventListener('click', () => {
      aiKeyVisible = !aiKeyVisible;
      const input = container.querySelector('#ai-api-key');
      input.type = aiKeyVisible ? 'text' : 'password';
      container.querySelector('#ai-toggle-key').innerHTML = icon(aiKeyVisible ? 'eyeOff' : 'eye', 18);
    });
    container.querySelector('#ai-save').addEventListener('click', () => {
      const apiKey = container.querySelector('#ai-api-key').value.trim();
      const model = container.querySelector('#ai-model').value.trim();
      DB.saveAISettings({ provider: 'anthropic', apiKey, model });
      showToast(I18n.t('toast.aiSettingsSaved'), 'success');
      paint();
    });
    const aiClearBtn = container.querySelector('#ai-clear');
    if (aiClearBtn) {
      aiClearBtn.addEventListener('click', () => {
        DB.clearAISettings();
        showToast(I18n.t('toast.aiSettingsCleared'), 'success');
        paint();
      });
    }

    container.querySelector('#set-lang').addEventListener('change', (e) => {
      DB.saveSettings({ lang: e.target.value });
      I18n.setLang(e.target.value);
      onLangChange?.(e.target.value);
    });
    container.querySelector('#set-currency').addEventListener('change', (e) => {
      DB.saveSettings({ currency: e.target.value });
      onLangChange?.(I18n.getLang());
    });

    function changeFontScale(direction) {
      const current = clampFontScale(DB.getSettings().fontScale);
      const next = stepFontScale(current, direction);
      if (next === current) return;
      DB.saveSettings({ fontScale: next });
      applyFontScale(next);
      container.querySelector('#font-value').textContent = `${Math.round(next * 100)}%`;
      container.querySelector('#font-dec').disabled = next <= FONT_SCALE_STEPS[0];
      container.querySelector('#font-inc').disabled = next >= FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1];
    }
    container.querySelector('#font-dec').addEventListener('click', () => changeFontScale(-1));
    container.querySelector('#font-inc').addEventListener('click', () => changeFontScale(1));

    const redoModal = container.querySelector('#redo-modal');
    container.querySelector('#btn-redo-quiz').addEventListener('click', () => redoModal.open());
    container.querySelector('#redo-cancel').addEventListener('click', () => redoModal.close());
    container.querySelector('#redo-confirm').addEventListener('click', () => {
      redoModal.close();
      onHouseholdReset?.();
    });

    container.querySelector('#btn-export').addEventListener('click', () => {
      DB.exportJSON();
      showToast(I18n.t('toast.exportDone'), 'success');
    });

    container.querySelector('#btn-export-xlsx').addEventListener('click', () => {
      try {
        DB.exportXLSX();
        showToast(I18n.t('toast.exportExcelDone'), 'success');
      } catch (err) {
        showToast(I18n.t('toast.exportExcelError'), 'error');
      }
    });

    container.querySelector('#file-import-json').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const count = await DB.importJSON(file);
        showToast(I18n.t('toast.importSuccess', { count }), 'success');
        onLangChange?.(I18n.getLang());
      } catch (err) {
        showToast(I18n.t('toast.importError'), 'error');
      }
      e.target.value = '';
    });

    container.querySelector('#file-import-csv').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const count = await DB.importSpreadsheetCSV(file);
        showToast(I18n.t('toast.csvImported', { count }), 'success');
        onLangChange?.(I18n.getLang());
      } catch (err) {
        showToast(I18n.t('toast.csvError'), 'error');
      }
      e.target.value = '';
    });

    const clearModal = container.querySelector('#clear-modal');
    container.querySelector('#btn-clear').addEventListener('click', () => clearModal.open());
    container.querySelector('#clear-cancel').addEventListener('click', () => clearModal.close());
    container.querySelector('#clear-confirm').addEventListener('click', () => {
      DB.clearAll();
      clearModal.close();
      showToast(I18n.t('toast.cleared'), 'success');
      onHouseholdReset?.();
    });
  }

  paint();
}
