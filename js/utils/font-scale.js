// utils/font-scale.js — controle de acessibilidade de tamanho de fonte. Em vez de reescrever
// todo o CSS do app (que usa px fixo em centenas de regras, não rem) pra reagir a um font-size
// de <html>, usamos a propriedade CSS "zoom" na página inteira: mesmo efeito do zoom nativo do
// navegador, cobre tudo — inclusive os <app-modal> que são anexados direto em document.body, fora
// da árvore de #app. Suporte: Chrome/Edge/Safari (16.4+) e Firefox (126+); é o mesmo mecanismo,
// então navegadores sem suporte simplesmente ignoram a propriedade (fica no 100% padrão).
export const FONT_SCALE_STEPS = [0.875, 1, 1.125, 1.25, 1.4];
export const DEFAULT_FONT_SCALE = 1;

export function clampFontScale(scale) {
  return FONT_SCALE_STEPS.includes(scale) ? scale : DEFAULT_FONT_SCALE;
}

export function applyFontScale(scale) {
  document.documentElement.style.setProperty('--app-font-zoom', clampFontScale(scale));
}

export function stepFontScale(current, direction) {
  const idx = FONT_SCALE_STEPS.indexOf(clampFontScale(current));
  const nextIdx = Math.min(FONT_SCALE_STEPS.length - 1, Math.max(0, idx + direction));
  return FONT_SCALE_STEPS[nextIdx];
}
