// modules/categories.js — catálogo de categorias e geração personalizada a partir das respostas do quiz
import { round2 } from '../utils/format.js';

// Categorias sempre incluídas + as condicionais (filhos/pets/carro), com ícone, cor e orçamento sugerido de partida
export const CATEGORY_DEFS = {
  housing: { icon: 'house', color: 'housing', defaultBudget: 1450 },
  groceries: { icon: 'cart', color: 'groceries', defaultBudget: 650 },
  utilities_water: { icon: 'droplet', color: 'utilities', defaultBudget: 60 },
  utilities_electricity: { icon: 'bolt', color: 'utilities', defaultBudget: 160 },
  utilities_heating: { icon: 'flame', color: 'utilities', defaultBudget: 80 },
  car: { icon: 'car', color: 'car', defaultBudget: 400 },
  health: { icon: 'heart', color: 'health', defaultBudget: 120 },
  personal: { icon: 'sparkle', color: 'personal', defaultBudget: 250 },
  kids_education: { icon: 'graduationCap', color: 'kids', defaultBudget: 150 },
  kids_courses: { icon: 'sparkles', color: 'kids', defaultBudget: 90 },
  kids_clothing: { icon: 'shirt', color: 'kids', defaultBudget: 110 },
  pets: { icon: 'paw', color: 'pets', defaultBudget: 120 },
  extra: { icon: 'sparkle', color: 'extra', defaultBudget: 150 }
};

export const CATEGORY_ORDER = [
  'housing', 'groceries', 'utilities_water', 'utilities_electricity', 'utilities_heating', 'car', 'health',
  'kids_education', 'kids_courses', 'kids_clothing',
  'pets', 'personal', 'extra'
];

// Chaves de categoria "fixas" do catálogo — usadas para decidir se uma categoria salva é uma
// categoria personalizada criada pelo comprador (qualquer chave fora desta lista).
export const BUILTIN_CATEGORY_KEYS = Object.keys(CATEGORY_DEFS);

// Incremento de orçamento por filho/carro extra em cada subcategoria
const PER_EXTRA_KID = { kids_education: 70, kids_courses: 40, kids_clothing: 60 };
const PER_EXTRA_CAR = 250;

// A partir do perfil do quiz (composição da casa, moradia, carros), monta a lista de categorias
// personalizada com um orçamento sugerido de partida (o comprador ajusta na revisão e depois quando quiser).
export function buildCategoriesFromProfile(profile) {
  const kidsCount = profile.hasKids ? Math.max(1, profile.kidsCount || 1) : 0;
  const carsCount = profile.carsCount != null ? profile.carsCount : 1;

  const keys = ['housing', 'groceries', 'utilities_water', 'utilities_electricity', 'utilities_heating', 'health'];
  if (carsCount > 0) keys.push('car');
  if (profile.hasKids) keys.push('kids_education', 'kids_courses', 'kids_clothing');
  if (profile.hasPets) keys.push('pets');
  keys.push('personal', 'extra');

  return CATEGORY_ORDER.filter(k => keys.includes(k)).map(key => {
    const def = CATEGORY_DEFS[key];
    let budget = def.defaultBudget;

    if (key === 'housing' && profile.housingType === 'rent' && profile.rentAmount > 0) {
      budget = profile.rentAmount;
    }
    if (key === 'health' && profile.hasHealthPlan && profile.healthPlanAmount > 0) {
      budget = profile.healthPlanAmount;
    }
    if (key === 'car' && carsCount > 1) {
      budget += (carsCount - 1) * PER_EXTRA_CAR;
    }
    if (PER_EXTRA_KID[key] && kidsCount > 1) {
      budget += (kidsCount - 1) * PER_EXTRA_KID[key];
    }

    return { key, icon: def.icon, color: def.color, budget: round2(budget) };
  });
}

// Categoria personalizada criada pelo comprador (nome próprio, sem tradução automática).
export function createCustomCategory(name, { icon: iconName = 'sparkle', color = 'extra', budget = 0 } = {}) {
  return {
    key: `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: name,
    icon: iconName,
    color,
    budget: round2(budget),
    custom: true
  };
}
