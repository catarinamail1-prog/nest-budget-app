// views/settings.js — idioma, moeda, casa (refazer quiz), backup, import de planilha antiga, apagar dados
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { CONFIG } from '../config.js';
import { icon } from '../utils/icons.js';
import { categoryLabel } from '../utils/helpers.js';
import { createCustomCategory } from '../modules/categories.js';
import { showToast } from '../components/toast.js';
import '../components/app-modal.js';

const LANG_LABELS = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português', it: 'Italiano' };
const CUSTOM_COLOR_OPTIONS = ['housing', 'groceries', 'utilities', 'car', 'kids', 'pets', 'personal', 'extra'];
// Nomes amigáveis das famílias de cor disponíveis pra categoria personalizada — não precisa de
// tradução perfeita, é só pra reconhecer visualmente a cor no <select> (que não renderiza swatches).
const COLOR_NAMES = {
  en: { housing: 'Terracotta', groceries: 'Green', utilities: 'Amber', car: 'Blue', kids: 'Berry', pets: 'Sage', personal: 'Coral', extra: 'Neutral' },
  es: { housing: 'Terracota', groceries: 'Verde', utilities: 'Ámbar', car: 'Azul', kids: 'Frambuesa', pets: 'Salvia', personal: 'Coral', extra: 'Neutro' },
  fr: { housing: 'Terracotta', groceries: 'Vert', utilities: 'Ambre', car: 'Bleu', kids: 'Baie', pets: 'Sauge', personal: 'Corail', extra: 'Neutre' },
  de: { housing: 'Terrakotta', groceries: 'Grün', utilities: 'Bernstein', car: 'Blau', kids: 'Beere', pets: 'Salbei', personal: 'Koralle', extra: 'Neutral' },
  pt: { housing: 'Terracota', groceries: 'Verde', utilities: 'Âmbar', car: 'Azul', kids: 'Framboesa', pets: 'Salva', personal: 'Coral', extra: 'Neutro' },
  it: { housing: 'Terracotta', groceries: 'Verde', utilities: 'Ambra', car: 'Blu', kids: 'Lampone', pets: 'Salvia', personal: 'Corallo', extra: 'Neutro' }
};

export function renderSettings(container, { onLangChange, onHouseholdReset } = {}) {
  const settings = DB.getSettings();

  function paint() {
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
      </div>

      <h3 class="section-title u-mb-sm">${I18n.t('settings.categories')}</h3>
      <div class="card u-mb-md">
        ${DB.getCategories().map(c => `
          <div class="review-row">
            <span class="cat-chip" style="background:var(--cat-${c.color}-bg); color:var(--cat-${c.color});">${icon(c.icon, 18)}</span>
            <span style="flex:1;font-weight:600;">${categoryLabel(c)}</span>
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
    container.querySelectorAll('[data-del-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.confirm(I18n.t('settings.deleteCategoryConfirm'))) return;
        DB.deleteCategory(btn.dataset.delCat);
        showToast(I18n.t('toast.categoryDeleted'), 'success');
        paint();
      });
    });

    container.querySelector('#set-lang').addEventListener('change', (e) => {
      DB.saveSettings({ lang: e.target.value });
      I18n.setLang(e.target.value);
      onLangChange?.(e.target.value);
    });
    container.querySelector('#set-currency').addEventListener('change', (e) => {
      DB.saveSettings({ currency: e.target.value });
      onLangChange?.(I18n.getLang());
    });

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
