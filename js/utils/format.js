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
