// Ambria FnB — Ingredient category styling + decorative row emoji
//
// Purely cosmetic: nothing here affects what is collected, ordered or costed.
// Categories come from categorizeIngredient() in utils/helpers.js — the keys
// below must match INGR_CATEGORY_ORDER exactly.

// Tint + emoji per ingredient category. `toneName` maps to tone() in theme.js.
const INGR_CAT_META = {
  'Vegetables & herbs':    { emoji: '🥬', toneName: 'ok' },
  'Dairy & eggs':          { emoji: '🥛', toneName: 'info' },
  'Meat & seafood':        { emoji: '🍗', toneName: 'danger' },
  'Grains & flour':        { emoji: '🌾', toneName: 'warn' },
  'Spices & seasonings':   { emoji: '🧂', toneName: 'danger' },
  'Oils, sauces & sweets': { emoji: '🍯', toneName: 'warn' },
  'Liquids & stocks':      { emoji: '💧', toneName: 'info' },
  'Other':                 { emoji: '📦', toneName: 'accent' },
};

function catMeta(cat) {
  return INGR_CAT_META[cat] || INGR_CAT_META.Other;
}

// Keyword → emoji. First match wins, so put specific terms before generic ones
// ("coconut oil" before "oil"). Extend freely — an unmatched ingredient simply
// falls back to its category emoji, so nothing breaks if a term is missing.
const EMOJI_RULES = [
  [/\b(tomato|tamatar)\b/i,                 '🍅'],
  [/\b(onion|pyaa?z|pyaz)\b/i,              '🧅'],
  [/\b(garlic|lehsun|lasan)\b/i,            '🧄'],
  [/\b(ginger|adrak)\b/i,                   '🫚'],
  [/\b(cucumber|kheera|kakdi)\b/i,          '🥒'],
  [/\b(carrot|gajar)\b/i,                   '🥕'],
  [/\b(potato|aloo|alu)\b/i,                '🥔'],
  [/\b(chilli|chili|mirch|mirchi)\b/i,      '🌶️'],
  [/\b(lemon|lime|nimbu|neembu)\b/i,        '🍋'],
  [/\b(coriander|dhaniya|mint|pudina|curry leaf|basil|spinach|palak|methi|herb)\b/i, '🌿'],
  [/\b(capsicum|pepper corn|bell pepper|shimla)\b/i, '🫑'],
  [/\b(corn|makka|bhutta)\b/i,              '🌽'],
  [/\b(mushroom|khumb)\b/i,                 '🍄'],
  [/\b(coconut|nariyal)\b/i,                '🥥'],
  [/\b(banana|kela)\b/i,                    '🍌'],
  [/\b(apple|seb)\b/i,                      '🍎'],
  [/\b(mango|aam)\b/i,                      '🥭'],
  [/\b(pineapple|ananas)\b/i,               '🍍'],
  [/\b(grape|angoor)\b/i,                   '🍇'],
  [/\b(peas|matar)\b/i,                     '🫛'],
  [/\b(cauliflower|gobh?i|cabbage|patta)\b/i, '🥦'],
  [/\b(brinjal|baingan|eggplant)\b/i,       '🍆'],

  [/\b(curd|dahi|yogh?urt|raita)\b/i,       '🥣'],
  [/\b(paneer|cheese|cream|malai|khoya)\b/i,'🧀'],
  [/\b(butter|makkhan|ghee)\b/i,            '🧈'],
  [/\b(milk|doodh|dudh)\b/i,                '🥛'],
  [/\b(egg|anda)\b/i,                       '🥚'],

  [/\b(chicken|murg|mutton|lamb|meat|keema)\b/i, '🍗'],
  [/\b(fish|prawn|machh?li|seafood)\b/i,    '🐟'],

  [/\b(rice|chawal|basmati|biryani)\b/i,    '🍚'],
  [/\b(papad|papadum)\b/i,                  '🥮'],
  [/\b(bread|pav|bun|naan|roti|paratha|kulcha)\b/i, '🍞'],
  [/\b(atta|maida|flour|besan|suji|rava)\b/i, '🌾'],
  [/\b(dal|daal|lentil|chana|rajma|moong|urad)\b/i, '🫘'],
  [/\b(boondi|namkeen|sev)\b/i,             '🥠'],

  [/\b(salt|namak)\b/i,                     '🧂'],
  [/\b(sugar|cheeni|shakkar|gud|jaggery)\b/i, '🍬'],
  [/\b(oil|tel|refined)\b/i,                '🫗'],
  [/\b(honey|shahad)\b/i,                   '🍯'],
  [/\b(jeera|cumin|haldi|turmeric|dhania powder|garam masala|masala|spice|elaichi|clove|laung|dalchini|cinnamon)\b/i, '🥄'],
  [/\b(ketchup|sauce|chutney|vinegar|sirka)\b/i, '🥫'],

  [/\b(coke|cola|pepsi|limca|fanta|sprite|thums|aerated|soft ?drink)\b/i, '🥤'],
  [/\b(juice|shake|lassi|shikanji|jaljeera|mojito|cooler)\b/i, '🧃'],
  [/\b(water|pani|mineral)\b/i,             '💧'],
  [/\b(tea|chai|coffee)\b/i,                '☕'],
  [/\b(ice ?cream|kulfi|pastry|cake|jamun|jalebi|halwa|kheer|rasmalai|sweet|mithai)\b/i, '🍮'],
];

// Decorative emoji for one ingredient row. `cat` is the already-computed
// category, used as the fallback so every row always shows something.
function ingredientEmoji(name, cat) {
  const s = name || '';
  for (let i = 0; i < EMOJI_RULES.length; i++) {
    if (EMOJI_RULES[i][0].test(s)) return EMOJI_RULES[i][1];
  }
  return catMeta(cat).emoji;
}

export { INGR_CAT_META, catMeta, ingredientEmoji };
