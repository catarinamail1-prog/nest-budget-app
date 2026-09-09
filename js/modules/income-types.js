// modules/income-types.js — tipos de entrada (renda) disponíveis para classificar cada registro
export const INCOME_TYPE_DEFS = {
  salary: { icon: 'briefcase', color: 'good' },
  extra: { icon: 'sparkle', color: 'kids' },
  other: { icon: 'dot', color: 'muted' }
};

export const INCOME_TYPE_ORDER = ['salary', 'extra', 'other'];
