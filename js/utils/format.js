// format.js — formatação de moeda, percentual e data
import { CONFIG } from '../config.js';

const LOCALE_MAP = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR', it: 'it-IT' };

export function localeFor(lang) {
  return LOCALE_MAP[lang] || 'en-US';
}

export function formatCurrency(value, currencyCode) {
  const cur = CONFIG.CURRENCIES[currencyCode] || CONFIG.CURRENCIES.USD;
  const n = Number.isFinite(value) ? value : 0;
  const sign = n < 0 ? '-' : '';
  return `${sign}${cur.symbol}${Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d)\.)/g, ',')}`;
}

export function formatPct(value, decimals = 0) {
  const n = Number.isFinite(value) ? value : 0;
  return `${n.toFixed(decimals)}%`;
}

export function formatDateISO(date = new Date()) {
  return date.toISOString().split('T')[0];
}

export function formatDateShort(isoDate, lang) {
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return new Intl.DateTimeFormat(localeFor(lang), { month: 'short', day: 'numeric' }).format(d);
  } catch {
    return isoDate;
  }
}

export function monthLabel(lang, date = new Date()) {
  return new Intl.DateTimeFormat(localeFor(lang), { month: 'long' }).format(date);
}

// Versão curta ("Jan", "Fev"...) — usada nos rótulos dos gráficos de tendência anual (Análises),
// onde 12 nomes completos de mês não cabem lado a lado.
export function monthShortLabel(lang, date = new Date()) {
  return new Intl.DateTimeFormat(localeFor(lang), { month: 'short' }).format(date);
}

// Nomes curtos dos dias da semana (Dom..Sáb), no idioma ativo — usado no cabeçalho do Calendário.
// 4 de janeiro de 1970 é um domingo; construir a partir dele (hora local) evita qualquer
// depender de fuso: nunca lemos o valor como data, só a posição do dia da semana.
export function weekdayShortLabels(lang) {
  const fmt = new Intl.DateTimeFormat(localeFor(lang), { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(1970, 0, 4 + i)));
}

export function formatDateLong(isoDate, lang) {
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return new Intl.DateTimeFormat(localeFor(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  } catch {
    return isoDate;
  }
}

export function daysLeftInMonth(date = new Date()) {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return Math.max(0, end.getDate() - date.getDate());
}

export function isSameMonth(isoDate, ref = new Date()) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
