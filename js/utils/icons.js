// icons.js — conjunto de ícones SVG desenhados à mão (stroke-based, grade 24px), sem dependência externa.
// Uso: icon('house', 18) devolve uma string <svg>...</svg> com currentColor.

const PATHS = {
  house: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/>',
  cart: '<path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h7.4a1.5 1.5 0 0 0 1.5-1.2L20 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  bolt: '<path d="M13 3 5 14h5.5L11 21l8-11h-5.5L13 3Z"/>',
  car: '<path d="M4.5 15.5 6 10a2 2 0 0 1 1.9-1.4h8.2A2 2 0 0 1 18 10l1.5 5.5"/><rect x="3.2" y="15.5" width="17.6" height="4.2" rx="1.4"/><circle cx="7.2" cy="19.7" r="1.4"/><circle cx="16.8" cy="19.7" r="1.4"/>',
  sparkle: '<path d="M12 3.5c.6 3.4 1.7 4.5 5.1 5.1-3.4.6-4.5 1.7-5.1 5.1-.6-3.4-1.7-4.5-5.1-5.1 3.4-.6 4.5-1.7 5.1-5.1Z"/><path d="M18.5 15c.35 1.9.95 2.5 2.85 2.85-1.9.35-2.5.95-2.85 2.85-.35-1.9-.95-2.5-2.85-2.85 1.9-.35 2.5-.95 2.85-2.85Z"/>',
  bottle: '<path d="M10 3h4"/><path d="M11 3v2.6c0 .5-.2 1-.6 1.3-.7.7-1.4 1.6-1.4 3.1v9c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-9c0-1.5-.7-2.4-1.4-3.1-.4-.4-.6-.8-.6-1.3V3"/><path d="M9 12h6"/>',
  paw: '<circle cx="7.5" cy="8.5" r="1.6"/><circle cx="12" cy="6.5" r="1.7"/><circle cx="16.5" cy="8.5" r="1.6"/><path d="M8 14c0-1.8 1.8-3 4-3s4 1.2 4 3-1.8 3.3-4 3.3-4-1.5-4-3.3Z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M4.9 6.9l1.4 1.4M17.7 15.7l1.4 1.4M3.5 12h2M18.5 12h2M4.9 17.1l1.4-1.4M17.7 8.3l1.4-1.4"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.1l.9-1.6A1.5 1.5 0 0 1 9.8 4.6h4.4a1.5 1.5 0 0 1 1.3.8l.9 1.6h2.1A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="13" r="3.4"/>',
  pencil: '<path d="M4 20l.9-3.6L15.6 5.7a1.5 1.5 0 0 1 2.1 0l1.6 1.6a1.5 1.5 0 0 1 0 2.1L8.6 20.1 4 20Z"/><path d="M13.8 7.5l2.7 2.7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.6 2.6L16.4 9"/>',
  backArrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronUp: '<path d="M6 15l6-6 6 6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M5 7h14"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M7 7l1 12.5A1.5 1.5 0 0 0 9.5 21h5a1.5 1.5 0 0 0 1.5-1.5L17 7"/><path d="M10 11v6M14 11v6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
  person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6"/>',
  people: '<circle cx="9" cy="8" r="2.6"/><circle cx="17" cy="9" r="2.2"/><path d="M3.5 20c0-3.2 2.5-5.4 5.5-5.4s5.5 2.2 5.5 5.4"/><path d="M14.8 15.4c1-.7 2.1-1 3.2-1 2.5 0 4.5 2 4.5 4.6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3v4M16 3v4"/>',
  piggy: '<path d="M4.5 12.5c0-3.6 3.2-6.2 7.3-6.2 3 0 5.6 1.4 6.8 3.5H20a1 1 0 0 1 1 1v2.4a1 1 0 0 1-1 1h-1.1a6 6 0 0 1-1.1 1.9V19a1 1 0 0 1-1 1h-1.6a1 1 0 0 1-1-1v-.6c-.6.1-1.3.1-2 .1s-1.4 0-2-.1v.6a1 1 0 0 1-1 1H7.6a1 1 0 0 1-1-1v-2.9A6.7 6.7 0 0 1 4.5 12.5Z"/><circle cx="14.5" cy="10.7" r=".9" fill="currentColor" stroke="none"/><path d="M6.5 9 5 7.3"/>',
  income: '<path d="M12 4v11"/><path d="M7.5 11.5 12 16l4.5-4.5"/><path d="M5 18h14"/>',
  briefcase: '<rect x="3.5" y="7.5" width="17" height="11" rx="1.8"/><path d="M8.5 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 6v1.5"/><path d="M3.5 12.5h17"/>',
  dot: '<circle cx="12" cy="12" r="7"/>',
  book: '<path d="M4 5.5c2-1 5-1 8 .5 3-1.5 6-1.5 8-.5v13c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5V5.5Z"/><path d="M12 6v13"/>',
  shirt: '<path d="M8 4 4 7l2 3 2-1.4V20h8V8.6L18 10l2-3-4-3-2 2h-4L8 4Z"/>',
  graduationCap: '<path d="M2 9 12 4l10 5-10 5L2 9Z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/><path d="M20 9v6"/>',
  wallet: '<rect x="3.5" y="6.5" width="17" height="12" rx="2"/><path d="M3.5 10.5h17"/><circle cx="16.5" cy="14.5" r="1.1" fill="currentColor" stroke="none"/>',
  creditCard: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 9.5h18"/><path d="M6 14.5h4"/>',
  trendingUp: '<path d="M4 16l5-5 4 3 7-8"/><path d="M15 6h5v5"/>',
  repeat: '<path d="M6 8h9a3 3 0 0 1 3 3v1"/><path d="M9 5 6 8l3 3"/><path d="M18 16H9a3 3 0 0 1-3-3v-1"/><path d="M15 19l3-3-3-3"/>',
  banknote: '<rect x="3" y="7" width="18" height="10" rx="1.5"/><circle cx="12" cy="12" r="2.2"/><path d="M6 9v.01M18 15v.01"/>',
  receipt: '<path d="M6 3.5h12v17l-2.2-1.4L13.6 20l-1.6-1.4L10.4 20l-2.2-1.4L6 20.5z"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4.5"/>',
  key: '<circle cx="8" cy="9" r="3.5"/><path d="M10.5 11.5 19 20M16 17l2-2M18.5 19.5l2-2"/>',
  calendarCheck: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3v4M16 3v4"/><path d="M9 14.5l2 2 4-4.2"/>',
  sparkles: '<path d="M12 3.5c.6 3.4 1.7 4.5 5.1 5.1-3.4.6-4.5 1.7-5.1 5.1-.6-3.4-1.7-4.5-5.1-5.1 3.4-.6 4.5-1.7 5.1-5.1Z"/><path d="M18.5 15c.35 1.9.95 2.5 2.85 2.85-1.9.35-2.5.95-2.85 2.85-.35-1.9-.95-2.5-2.85-2.85 1.9-.35 2.5-.95 2.85-2.85Z"/><path d="M5 15.5c.25 1.3.65 1.7 1.95 1.95-1.3.25-1.7.65-1.95 1.95-.25-1.3-.65-1.7-1.95-1.95 1.3-.25 1.7-.65 1.95-1.95Z"/>',
  droplet: '<path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11Z"/>',
  flame: '<path d="M12 3c1 3-1 4.5-2.5 6.5C8 11.5 7 13 7 15a5 5 0 0 0 10 0c0-2-.8-3-1.8-4.3.6 2-.4 3-1.7 3-1.6 0-2-1.3-1.5-3C13 8.5 12.6 5.5 12 3Z"/>',
  scanFrame: '<path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/>',
  heart: '<path d="M12 20.5c-.3 0-.6-.1-.8-.3C7.8 17.4 3 13.5 3 9.2 3 6.3 5.2 4 8 4c1.6 0 3.1.8 4 2.1C12.9 4.8 14.4 4 16 4c2.8 0 5 2.3 5 5.2 0 4.3-4.8 8.2-8.2 11-.2.2-.5.3-.8.3Z"/>',
  trendingDown: '<path d="M4 8l5 5 4-3 7 8"/><path d="M15 18h5v-5"/>',
  chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  chartBar: '<rect x="4.5" y="12" width="3.4" height="7.5" rx="1"/><rect x="10.3" y="7.5" width="3.4" height="12" rx="1"/><rect x="16.1" y="4" width="3.4" height="15.5" rx="1"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.7C11.1 5.6 11.5 5.5 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3.2 4M6.5 7.4C4 9.2 2.5 12 2.5 12S6 18.5 12 18.5c1.4 0 2.6-.3 3.7-.9"/><path d="M9.9 10.1a3 3 0 0 0 4.1 4.1"/>'
};

export function icon(name, size = 20, strokeWidth = 1.75) {
  const path = PATHS[name] || '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

export const NEST_MARK = `<svg width="26" height="26" viewBox="0 0 28 28" fill="none">
  <path d="M4 16c0 5 4.5 8 10 8s10-3 10-8" stroke="#E0633F" stroke-width="2" stroke-linecap="round"></path>
  <path d="M7 13c0 4 3.5 6.5 7 6.5s7-2.5 7-6.5" stroke="#E0633F" stroke-width="2" stroke-linecap="round" opacity="0.5"></path>
  <circle cx="14" cy="10" r="3.2" fill="#D9A23B"></circle>
</svg>`;
