// Ambria FnB — Recipe database, SOP steps, dish helpers
// Extracted from App.jsx
// ALL RECIPE DATA NOW LIVES IN SUPABASE — this file provides structure + helper functions only

import { MENU_PACKAGES, MENU_PACKAGE_SECTIONS } from './menuPackages.js';
import INGREDIENT_HINDI from './ingredientHindi.js';
   
   let DISH_HINDI_MAP = {};
   function setDishHindiMap(m) { DISH_HINDI_MAP = m || {}; }
   function upsertDishHindi(dishName, hi) {
     if (!dishName) return;
     if (hi) DISH_HINDI_MAP[dishName] = hi;
     else delete DISH_HINDI_MAP[dishName];
   }
   function upsertDishCat(dishName, catId) {
     if (!dishName) return;
     if (catId) DISH_CAT_MAP[dishName] = catId;
     else delete DISH_CAT_MAP[dishName];
   }

   // ── Dish master catalogue (canonical list of every dish we serve) ──
   // Shape: { [dish_name]: { is_active, notes, image_url } }
   let DISH_MASTER = {};
   function setDishMaster(m) { DISH_MASTER = m || {}; }
   function upsertDishMaster(dishName, patch) {
     if (!dishName) return;
     const prev = DISH_MASTER[dishName] || { is_active: true };
     DISH_MASTER[dishName] = { ...prev, ...(patch || {}) };
   }
   function deactivateDish(dishName) {
     if (!dishName || !DISH_MASTER[dishName]) return;
     DISH_MASTER[dishName] = { ...DISH_MASTER[dishName], is_active: false };
   }

   // ── Dish → Ops store item mapping (V62) ──
   // Shape: { [dish_name]: { ops_item_id, ops_item_name, ops_item_hindi, ops_item_unit, qty_per_cover } }
   let DISH_STORE_MAP = {};
   function setDishStoreMap(m) { DISH_STORE_MAP = m || {}; }
   function upsertDishStoreMap(dishName, row) {
     if (!dishName) return;
     if (row) DISH_STORE_MAP[dishName] = row;
     else delete DISH_STORE_MAP[dishName];
   }

function guessSectionForDish(name) {
  const n = (name||"").toLowerCase().trim();

  // ── Beverages — checked FIRST (juices/drinks/coolers often have fruit words) ──
  if(/\bjuice|lassi|mocktail|shikanji|jaljeera|\btea\b|lemonade|aerated|mineral water|\bcoke\b|\bfanta\b|\bsprite\b|mojito|pina colada|\bpunch\b|cooler|shots|green apple cooler|sweet sunrise|rose sherbet|\bsodas|virgin|thandai|aam panna|nimbu pani|chaas|fruit counter|fresh fruit|imported fruit|\bfruits\b|fruit punch|refreshing station|fresh juices|\bshakes\b/i.test(n)) return "Beverages";

  // ── Sweets / Desserts — check before Indian (halwa, kheer etc) ──
  if(/halwa|gulab jamun|\bkheer\b|\bbarfi\b|jalebi|rasmalai|rabri|\bkulfi\b|ice.?cream|mithai|dessert|gajar ka|mousse|parfait|\bcake\b|brownie|cheesecake|tiramisu|\bpudding\b|boondi|sheera|payasam|basundi|kaju|\bpeda\b|ladoo|modak|rasgulla|cham.?cham|kalakand|bal.?mithai|ghevar|gajak|revdi|coconut barfi|chocolate fountain|live dessert|assorted dessert|sweet counter|mithai counter|paan counter/i.test(n)) return "Sweets";

  // ── Chaat — before Indian ──
  if(/chaat|golgap|pani puri|\bbhel\b|bhalla papdi|matra kulcha|moonglet|aloo tikki|khajoor chutney|papdi|\bsev\b|ragda|aloo chana|kund.?dahi|\bpuchka\b|dahi station|chaat counter|street food|crispy aloo/i.test(n)) return "Chaat";

  // ── Tandoor ──
  if(/\btikka\b|seekh|\bkebab\b|tandoor|\bboti\b|chaap|\bshawarma\b|stuffed mushroom|afghani|ananas tikka|tandoori|galouti|dahi ke kabab|bhutte ki seekh|papad waala|golden coin|shami|galawat|kasturi|reshmi|murgh malai/i.test(n)) return "Tandoor";

  // ── Chinese / Pan-Asian ──
  if(/hakka|\bnoodle|manchurian|fried rice|kung pao|chilli paneer|schezwan|dim.?sum|spring roll|manchow|wonton|teppanyaki|\bthai\b|\bsushi\b|\bramen\b|udon|banh mi|kimchi|som tom|raw papaya|chilli garlic idli|honey chilli|szechuan|sichuan|crystal dim|chilli baby corn|pepper corn/i.test(n)) return "Chinese";

  // ── Continental / Bakery items → Indian (since we don't have Continental dept) ──
  if(/pasta|bruschetta|\bpizza\b|garlic bread|pita|falafel|hummus|babaganoush|mezze|lasagna|sandwich|burger|\bwrap\b|vol.au|cigar roll|corn and sweet pepper|corn pepper salad|caesar|waldorf|herb|watermelon|caprese|italian/i.test(n)) return "Indian Curries";

  // ── Soups → Chinese if clear; else Indian ──
  if(/\bsoup\b|\bshorba\b/i.test(n)) {
    if(/manchow|hot.?sour|tom|wonton/i.test(n)) return "Chinese";
    return "Indian Curries";
  }

  // ── Salads → Indian (served from main kitchen) ──
  if(/\bsalad\b|\braita\b|\bkachumber\b/i.test(n)) return "Indian Curries";

  // ── Sweets catch-all: anything with "sweet" as standalone word ──
  if(/\bsweet\b/i.test(n)) return "Sweets";

  // ── Drinks/Stations ──
  if(/counter|station|bar |\bbar\b|live |stall/i.test(n)) {
    if(/chaat|pani puri|bhel/i.test(n)) return "Chaat";
    if(/dessert|sweet|ice cream|kulfi/i.test(n)) return "Sweets";
    if(/juice|mocktail|drink|beverag/i.test(n)) return "Beverages";
    if(/tandoor|kebab|tikka/i.test(n)) return "Tandoor";
  }

  return "Indian Curries";
}

// ─── GENERIC STEPS (fallback for dishes without recipe) ──────────

const GENERIC_STEPS = [
  {t:"Mesa",desc:"Wash, cut, measure all ingredients",tm:600,ccp:null,d1:true},
  {t:"Primary prep",desc:"Prepare base masala / paste / batter",tm:480,ccp:null,d1:true},
  {t:"Cooking",desc:"Cook the dish as per standard method",tm:900,ccp:null,d1:false},
  {t:"Final seasoning",desc:"Adjust salt, spice, garnish",tm:120,ccp:null,d1:false},
  {t:"Garnish & plate",desc:"Garnish and transfer to serving vessel",tm:60,ccp:null,d1:false},
];

// ─── RECIPE INGREDIENTS ──────────────────────────────────────────
// All ingredient data now lives in Supabase `recipes.ingredients` JSONB column.
// This object is kept as a hydration target — Supabase data merges in on boot.
// Only non-Supabase entries (if any) should remain here as fallback.
const RECIPE_INGREDIENTS = {};

// ─── RECIPE DATABASE ─────────────────────────────────────────────
// All recipe SOPs now live in Supabase `recipes` + `recipe_categories` tables.
// Local cats array is the fallback before Supabase loads.
// Recipe arrays are empty — hydrateRecipeData() fills them from Supabase on boot.
const RECIPE_DB = {
  cats:[
    {id:"halwai",name:"Halwai & Savoury",icon:"🫓",count:0},
    {id:"tandoor",name:"Indian Tandoor",icon:"🔥",count:0},
    {id:"chinese",name:"Chinese & Pan-Asian",icon:"🥢",count:0},
    {id:"beverages",name:"Beverages",icon:"☕",count:0},
    {id:"maincourse",name:"Indian Main Course",icon:"🍛",count:0},
    {id:"sweets",name:"Indian Desserts",icon:"🍮",count:0},
  ],
  recipes:{
    halwai:[],
    tandoor:[],
    chinese:[],
    beverages:[],
    maincourse:[],
    sweets:[],
  },
};

// ─── DISH NAME NORMALIZATION ─────────────────────────────────────
// Strips Hindi in parens, trailing tags (Live/Gravy/Station/Counter),
// normalizes dashes/slashes/ampersands to spaces, collapses whitespace.
function normDish(name) {
  if (!name) return "";
  return name
    .replace(/\s*\(.*?\)\s*/g, " ")        // remove parenthetical: (Agra Style), (दाल मखनी), (Chef's Special)
    .replace(/\s*[\/–—]\s*/g, " ")          // slashes & dashes → space
    .replace(/\s*&\s*/g, " ")               // ampersand → space
    .replace(/\b(live|gravy|station|counter|assorted|chef.?s?\s+special)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .toLowerCase().trim();
}

function findRecipeForDish(dishName) {
  if(!dishName || typeof RECIPE_DB === "undefined") return null;
  try {
    const all = RECIPE_DB.cats.flatMap(cat => (RECIPE_DB.recipes[cat.id]||[]).map(r=>({...r,cat})));
    // Tier 0: explicit mapping from dish_name_map table
    const mapped = DISH_NAME_MAP[dishName] || Object.keys(DISH_NAME_MAP).find(k => k.toLowerCase().trim() === dishName.toLowerCase().trim()) && DISH_NAME_MAP[Object.keys(DISH_NAME_MAP).find(k => k.toLowerCase().trim() === dishName.toLowerCase().trim())];
    if (mapped) {
      const mapMatch = all.find(r => r.n === mapped || r.n.toLowerCase().trim() === mapped.toLowerCase().trim());
      if (mapMatch) return mapMatch;
    }
    const n   = dishName.toLowerCase().trim();
    // Tier 1: exact match
    const exact = all.find(r=>r.n.toLowerCase()===n);
    if (exact) return exact;
    // Tier 2: substring match
    const sub = all.find(r=>n.includes(r.n.toLowerCase())||r.n.toLowerCase().includes(n));
    if (sub) return sub;
    // Tier 3: normalized match (strips Hindi, slashes, suffixes)
    const nn = normDish(dishName);
    if (nn) {
      const normMatch = all.find(r => normDish(r.n) === nn);
      if (normMatch) return normMatch;
      const normSub = all.find(r => nn.includes(normDish(r.n)) || normDish(r.n).includes(nn));
      if (normSub) return normSub;
    }
    return null;
  } catch(e) { return null; }
}

function getStepsForDish(name) {
  try {
    const r = findRecipeForDish(name);
    if (!r) { const allNames = RECIPE_DB.cats.flatMap(c=>(RECIPE_DB.recipes[c.id]||[]).map(r2=>r2.n)); console.warn('[SOP miss]', name, '→ no recipe found ('+allNames.length+' recipes in DB). Closest:', allNames.filter(rn=>rn.toLowerCase().includes(name.split(' ')[0].toLowerCase())||name.toLowerCase().includes(rn.split(' ')[0].toLowerCase()))); return GENERIC_STEPS; }
    // Defensive: handle triple-encoded steps (string instead of array)
    let steps = r.steps;
    if (typeof steps === 'string') { try { steps = JSON.parse(steps); } catch(e2){} }
    if (typeof steps === 'string') { try { steps = JSON.parse(steps); } catch(e3){} }
    if (!Array.isArray(steps) || steps.length === 0) { console.warn('[SOP miss]', name, '→ recipe found (' + r.n + ') but steps empty/invalid'); return GENERIC_STEPS; }
    return steps.map(s=>({t:s.t||"Step",desc:s.i||"",tm:s.tm||null,ccp:s.ccp||null,d1:!!s.d1,subs:Array.isArray(s.subs)&&s.subs.length>0?s.subs.map(sb=>({t:sb.t||"",i:sb.i||"",tm:sb.tm||0})):null}));
  } catch(e){ console.warn('[SOP miss]', name, '→ error:', e.message); }
  return GENERIC_STEPS;
}

// ─── SHARED HELPERS (used by Kitchen + Beverages) ───────────────
function fmtT(s){if(s>=3600)return Math.floor(s/3600)+"h "+Math.floor((s%3600)/60)+"m";if(s>=60)return Math.floor(s/60)+"m "+String(s%60).padStart(2,"0")+"s";return s+"s";}
const BEV_RE=/mocktail|juice|drink|tea|coffee|lassi|sharbat|nimbu|jal jeera|chaas|sprite|coke|fanta|lemonade|virgin|pina|mojito|sunrise|mineral|water|soda/i;
function getFullSteps(name){
  const isBev=guessSectionForDish(name)==="Beverages";
  const sopSteps=getStepsForDish(name);
  if(isBev){
    const bevSteps=[{t:"Collect ingredients from Store",i:"Collect syrups, fruits, ice, garnishes, glasses per recipe. Verify stock.",tm:900,store:true},{t:"Setup counter at venue",i:"Arrange dispensers, ice bins, garnish trays, glasses on counter",tm:600}];
    if(/fruit counter|fresh fruit|imported fruit|\bfruits\b/i.test(name)){bevSteps.push({t:"Wash & sort fruits",i:"Wash all fruits thoroughly. Sort Indian and imported separately.",tm:600},{t:"Peel & slice",i:"Peel, deseed, and slice fruits into serving portions",tm:900},{t:"Arrange on platter",i:"Arrange beautifully on platters with garnish. Keep chilled.",tm:300},{t:"Serve fresh",i:"Replenish platters as needed. Keep ice bed fresh.",tm:0,live:true});}
    else if(/mocktail|virgin|pina|mojito|sunrise|pink lady|blue lagoon/i.test(name)){bevSteps.push({t:"Prepare base mix",i:"Mix syrups, juices, soda as per recipe proportion",tm:300},{t:"Ice & garnish prep",i:"Crush/cube ice, cut fruit slices, prepare mint sprigs",tm:300},{t:"Serve fresh on order",i:"Pour over ice, garnish, serve immediately to guests",tm:0,live:true});}
    else if(/tea|coffee|chai/i.test(name)){bevSteps.push({t:"Boil water & brew",i:"Boil water/milk, add tea leaves/coffee, brew to strength",tm:480},{t:"Strain & serve",i:"Strain into cups, add sugar per guest preference",tm:0,live:true});}
    else if(/juice|nimbu|jal jeera|sharbat|chaas|lassi/i.test(name)){bevSteps.push({t:"Blend & mix",i:"Blend fruits/ingredients, strain if needed, adjust sweetness",tm:360},{t:"Chill & serve",i:"Add ice, pour into glasses, garnish with mint/fruit slice",tm:0,live:true});}
    else{bevSteps.push({t:"Chill & arrange",i:"Chill bottles/cans, arrange on ice bed at counter",tm:300},{t:"Serve on demand",i:"Pour/open and serve to guests",tm:0,live:true});}
    return bevSteps;
  }
  return [{t:"Collect ingredients from Store",i:"Collect all ingredients as per recipe from AP/AE store. Verify quantities.",tm:1200,store:true},...sopSteps];
}

// ─── DISH IMAGE MAP (Unsplash food photos) ───────────────────────────────────
function getDishImageUrl(dishName) {
  const DISH_IMAGES = {
    "Paneer Lababdar":"https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=70",
    "Dal Makhani":"https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=70",
    "Dal-E-Ambria":"https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=70",
    "Palak Paneer":"https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=70",
    "Malai Kofta":"https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=400&q=70",
    "Butter Chicken":"https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&q=70",
    "Murgh Lababdar":"https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&q=70",
    "Mutton Rogan Josh":"https://images.unsplash.com/photo-1545247181-516773cae754?w=400&q=70",
    "Mutton Beliram":"https://images.unsplash.com/photo-1545247181-516773cae754?w=400&q=70",
    "Dum Aloo Kashmiri":"https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=70",
    "Amritsari Pindi Choley":"https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=70",
    "Kadhi Pakoda":"https://images.unsplash.com/photo-1630851840633-f96999247032?w=400&q=70",
    "Sarson Ka Saag":"https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=70",
    "Hyderabadi Subz Biryani":"https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=70",
    "Chicken Dum Biryani":"https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=70",
    "Gobhi Masala":"https://images.unsplash.com/photo-1574653853027-5382a3d23a15?w=400&q=70",
    "Diwan-e-Handi":"https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=70",
    "Paneer Tikka Shashlik":"https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=70",
    "Paneer Tikka":"https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=70",
    "Murgh Malai Tikka":"https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&q=70",
    "Mutton Seekh Kebab":"https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=70",
    "Tandoori Roti":"https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=70",
    "Naan":"https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=70",
    "Steamed Rice":"https://images.unsplash.com/photo-1516684732162-798a0062be99?w=400&q=70",
    "Veg Biryani":"https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=70",
    "Jeera Rice":"https://images.unsplash.com/photo-1516684732162-798a0062be99?w=400&q=70",
    "Golgappe with Varieties of Water":"https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=70",
    "Golgappe":"https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=70",
    "Crispy Aloo Tikki":"https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=70",
    "Honey Chilli Potatoes":"https://images.unsplash.com/photo-1576402187878-974f70c890a5?w=400&q=70",
    "Veg Manchurian Gravy":"https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&q=70",
    "Vegetable Hakka Noodles":"https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&q=70",
    "Chilli Chicken Dry":"https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=400&q=70",
    "Gajar Ka Halwa":"https://images.unsplash.com/photo-1576158113928-4c240eaaf360?w=400&q=70",
    "Gulab Jamun":"https://images.unsplash.com/photo-1607920591413-4ec007e70023?w=400&q=70",
    "Ras Malai":"https://images.unsplash.com/photo-1611270418597-a6c77f4b7271?w=400&q=70",
    "Phirni":"https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=70",
    "Gulab Kheer":"https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=70",
    "Kaju Katli":"https://images.unsplash.com/photo-1519676867240-f03562e64548?w=400&q=70",
    "Jalebi":"https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=70",
    "Tilla Kulfi":"https://images.unsplash.com/photo-1559703248-dcaaec9fab78?w=400&q=70",
    "Rasgulla":"https://images.unsplash.com/photo-1581424089014-81c0c5ca0bd7?w=400&q=70",
    "Moong Dal Halwa":"https://images.unsplash.com/photo-1576158113928-4c240eaaf360?w=400&q=70",
    "Shahi Tukda":"https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=70",
    "Fruit Cream":"https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=70",
    "Fruit Custard":"https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=70",
    "Bhindi Do Pyaza":"https://images.unsplash.com/photo-1674825810891-4e3c0e92da19?w=400&q=70",
    "Dal Tarka":"https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=70",
    "Fish Goan Curry":"https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=70",
    "Egg Curry":"https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=70",
    "Dhaba Chicken":"https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&q=70",
    "Subz Miloni":"https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=70",
    "Aloo Methi":"https://images.unsplash.com/photo-1574653853027-5382a3d23a15?w=400&q=70",
    "Mirch Ka Salan":"https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=70",
  };
  // Exact match
  if(DISH_IMAGES[dishName]) return DISH_IMAGES[dishName];
  // Partial match
  const key = Object.keys(DISH_IMAGES).find(k=>dishName.toLowerCase().includes(k.toLowerCase())||k.toLowerCase().includes(dishName.split(" ")[0].toLowerCase()));
  if(key) return DISH_IMAGES[key];
  // Fallback by section keyword
  const dl = dishName.toLowerCase();
  if(dl.includes("paneer")||dl.includes("tofu")) return "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=70";
  if(dl.includes("chicken")||dl.includes("murgh")) return "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&q=70";
  if(dl.includes("mutton")||dl.includes("lamb")) return "https://images.unsplash.com/photo-1545247181-516773cae754?w=400&q=70";
  if(dl.includes("biryani")||dl.includes("rice")||dl.includes("pulao")) return "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=70";
  if(dl.includes("dal")||dl.includes("lentil")) return "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=70";
  if(dl.includes("naan")||dl.includes("roti")||dl.includes("bread")) return "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=70";
  if(dl.includes("tikka")||dl.includes("kebab")||dl.includes("seekh")) return "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=70";
  if(dl.includes("halwa")||dl.includes("kheer")||dl.includes("sweet")||dl.includes("rabri")) return "https://images.unsplash.com/photo-1576158113928-4c240eaaf360?w=400&q=70";
  if(dl.includes("chaat")||dl.includes("golgapp")||dl.includes("papdi")) return "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=70";
  return "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&q=70";
}


// ─── HYDRATE FROM SUPABASE ──────────────────────────────────────
// Called once on boot from App.jsx after loadAllConfig()
// Merges Supabase recipe_categories + recipes + recipe_ingredients into the in-memory objects
function hydrateRecipeData(cfg) {
  // Hydrate categories
  if (cfg.recipeCategories && cfg.recipeCategories.length) {
    RECIPE_DB.cats = cfg.recipeCategories.map(c => ({
      id: c.id, name: c.name, icon: c.icon || '📋', color: c.color || '#8E8678', count: 0
    }));
  }
  // Hydrate recipes by category
  if (cfg.recipes) {
    Object.keys(cfg.recipes).forEach(catId => {
      RECIPE_DB.recipes[catId] = cfg.recipes[catId];
    });
  }
  // Update counts
  RECIPE_DB.cats.forEach(c => {
    c.count = (RECIPE_DB.recipes[c.id] || []).length;
  });
  // Hydrate per-pax ingredients (from legacy recipe_ingredients table, if any)
  if (cfg.recipeIngredients) {
    Object.assign(RECIPE_INGREDIENTS, cfg.recipeIngredients);
  }
  // Hydrate dish→category classification map
  if (cfg.dishCategories) {
    DISH_CAT_MAP = cfg.dishCategories;
  }
  // Hydrate LMS→SOP dish name map
  if (cfg.dishNameMap) {
    DISH_NAME_MAP = cfg.dishNameMap;
  }
  // Hydrate dish → Hindi override map
  if (cfg.dishHindiMap) {
    DISH_HINDI_MAP = cfg.dishHindiMap;
  }
  // Hydrate dish master catalogue
  if (cfg.dishMaster) {
    DISH_MASTER = cfg.dishMaster;
  }
  // V62: Hydrate dish → Ops store item map
  if (cfg.dishStoreMap) {
    DISH_STORE_MAP = cfg.dishStoreMap;
  }
}



// ─── DISH → CATEGORY RESOLVER ───────────────────────────────────
// Single source of truth: always returns SOP category, never kitchen sections.
// Priority: dish_categories table → recipes table → regex guess → fallback
let DISH_CAT_MAP = {};  // hydrated on boot
let DISH_NAME_MAP = {}; // LMS menu name → SOP recipe dish_name
//let DISH_HINDI_MAP = {}; // dish_name → Hindi override (menu-package dishes)

function getCatIdForDish(dishName) {
  if (!dishName) return null;
  const n = dishName.toLowerCase().trim();
  const explicit = DISH_CAT_MAP[dishName] || Object.keys(DISH_CAT_MAP).find(k => k.toLowerCase().trim() === n) && DISH_CAT_MAP[Object.keys(DISH_CAT_MAP).find(k => k.toLowerCase().trim() === n)];
  if (explicit) return explicit;
  for (const cat of RECIPE_DB.cats) {
    const recipes = RECIPE_DB.recipes[cat.id] || [];
    if (recipes.some(r => r.n && r.n.toLowerCase().trim() === n)) return cat.id;
  }
  for (const cat of RECIPE_DB.cats) {
    const recipes = RECIPE_DB.recipes[cat.id] || [];
    if (recipes.some(r => r.n && (n.includes(r.n.toLowerCase()) || r.n.toLowerCase().includes(n)))) return cat.id;
  }
  // Tier 3: normalized match
  const nn = normDish(dishName);
  if (nn) {
    for (const cat of RECIPE_DB.cats) {
      const recipes = RECIPE_DB.recipes[cat.id] || [];
      if (recipes.some(r => r.n && (normDish(r.n) === nn || nn.includes(normDish(r.n)) || normDish(r.n).includes(nn)))) return cat.id;
    }
  }
  const guessedSection = guessSectionForDish(dishName);
  const SECTION_TO_CAT = {
    'Indian Curries':'maincourse','Tandoor':'tandoor','Chinese':'chinese',
    'Chaat':'chaat','Sweets':'sweets','Continental':'continental','Beverages':'beverages',
  };
  return SECTION_TO_CAT[guessedSection] || 'maincourse';
}

function getCatForDish(dishName) {
  const catId = getCatIdForDish(dishName);
  return RECIPE_DB.cats.find(c => c.id === catId) || { id: catId || 'maincourse', name: catId || 'Other', icon: '🍽', color: '#8E8678' };
}

// ─── LEGACY COMPAT ──────────────────────────────────────────────
// Thin wrappers — now return category names instead of kitchen section names.
function catIdToSection(catId) {
  const cat = RECIPE_DB.cats.find(c => c.id === catId);
  return cat ? cat.name : null;
}

function getSectionForDish(dishName) {
  const cat = getCatForDish(dishName);
  return cat.name;
}

// ─── INGREDIENT HELPERS (shared across KitchenHub, EventDayTab, StoreModule) ──
function interpolatePax(qtyArr, sizes, targetPax) {
  if (!qtyArr || !sizes || sizes.length === 0) return 0;
  if (sizes.length === 1) return (targetPax / sizes[0]) * (qtyArr[0] || 0);
  if (targetPax <= sizes[0]) return (targetPax / sizes[0]) * (qtyArr[0] || 0);
  if (targetPax >= sizes[sizes.length - 1]) {
    const last = sizes.length - 1;
    return (targetPax / sizes[last]) * (qtyArr[last] || 0);
  }
  for (let i = 0; i < sizes.length - 1; i++) {
    if (targetPax >= sizes[i] && targetPax <= sizes[i + 1]) {
      const ratio = (targetPax - sizes[i]) / (sizes[i + 1] - sizes[i]);
      return (qtyArr[i] || 0) + ratio * ((qtyArr[i + 1] || 0) - (qtyArr[i] || 0));
    }
  }
  return qtyArr[0] || 0;
}

// hi ↔ hindi (SQL rebuild uses `hi`, older UI writes `hindi`)
function readHi(it) { return it.hi ?? it.hindi ?? ""; }

// Scale by pax ratio from the recipe's base_pax anchor (default 300).
// Used as the default until yield-based planning is active.
function getIngrForDish(dishName, targetPax) {
  const rec = findRecipeForDish(dishName);
  const items = rec?.ingredients?.items;
  if (items?.length > 0) {
    // NEW schema (post-V48): scalar qty at base_pax=300
    if (typeof items[0]?.qty === 'number' || items[0]?.qty === null) {
      const basePax = rec.ingredients.base_pax || 300;
      const factor = (targetPax || basePax) / basePax;
      return items.map(it => ({
        n: it.name,
        h: readHi(it),
        q: (it.qty || 0) * factor,
        u: it.unit || "kg",
        _newFmt: true
      }));
    }
    // LEGACY schema (pre-V48): qty[] array indexed by pax_sizes
    if (rec.ingredients.pax_sizes?.length > 0) {
      const sizes = rec.ingredients.pax_sizes;
      return items.map(it => {
        const qty = interpolatePax(it.qty, sizes, targetPax);
        return { n: it.name, h: readHi(it), q: qty, u: it.unit || "kg", _newFmt: true };
      });
    }
  }
  return RECIPE_INGREDIENTS[dishName] || null;
}

// Scale by target finished yield (kg). Requires base_yield.kg on the recipe.
// Returns null if yield not configured — caller should fall back to getIngrForDish.
function getIngrForYield(dishName, targetKg, sectionFactors) {
  const rec = findRecipeForDish(dishName);
  const items = rec?.ingredients?.items;
  if (!items?.length) return null;
  const baseKg = rec.ingredients.base_yield?.kg;
  const globalFactor = (baseKg && targetKg) ? targetKg / baseKg : null;
  if (globalFactor == null && !sectionFactors) return null;
  let currentSectionFactor = globalFactor;
  return items.map(it => {
    if (it.isSection) {
      if (sectionFactors && sectionFactors[it.name] != null) currentSectionFactor = sectionFactors[it.name];
      else currentSectionFactor = globalFactor;
      return { n: it.name, h: readHi(it), q: 0, u: '', _newFmt: true, _yieldBased: true, _isSection: true };
    }
    const f = currentSectionFactor;
    return {
      n: it.name,
      h: readHi(it),
      q: f == null ? 0 : (it.qty || 0) * f,
      u: it.unit || "kg",
      _newFmt: true,
      _yieldBased: true
    };
  });
}

function resolveDishHindi(dishName) {
  if (!dishName) return '';
  const key = typeof dishName === 'string' ? dishName : (dishName.name || dishName.n || '');
  if (!key) return '';
  if (DISH_HINDI_MAP[key]) return DISH_HINDI_MAP[key];
  const keyL = key.toLowerCase().trim();
  const mk = Object.keys(DISH_HINDI_MAP).find(k => k.toLowerCase().trim() === keyL);
  if (mk && DISH_HINDI_MAP[mk]) return DISH_HINDI_MAP[mk];
  try { const rec = findRecipeForDish(key); if (rec && rec.n_hi) return rec.n_hi; } catch (e) {}
  if (INGREDIENT_HINDI && INGREDIENT_HINDI[key]) return INGREDIENT_HINDI[key];
  if (INGREDIENT_HINDI && INGREDIENT_HINDI[keyL]) return INGREDIENT_HINDI[keyL];
  return '';
}

// V62: Resolve a dish to its Ops store-item mapping (returns null if unmapped).
// Case-insensitive key match, mirroring resolveDishHindi.
function resolveDishStore(dishName) {
  if (!dishName) return null;
  const key = typeof dishName === 'string' ? dishName : (dishName.name || dishName.n || '');
  if (!key) return null;
  if (DISH_STORE_MAP[key]) return DISH_STORE_MAP[key];
  const keyL = key.toLowerCase().trim();
  const mk = Object.keys(DISH_STORE_MAP).find(k => k.toLowerCase().trim() === keyL);
  if (mk && DISH_STORE_MAP[mk]) return DISH_STORE_MAP[mk];
  return null;
}

function dishLabel(dishName, lang) {
  const en = typeof dishName === 'string' ? dishName : (dishName && (dishName.name || dishName.n)) || '';
  if (lang !== 'hi') return en;
  const hi = resolveDishHindi(en);
  return hi || en;
}

// Joined view: master ⋈ dish_categories ⋈ recipes ⋈ dish_hindi_map
// Returns [{ dish_name, is_active, notes, image_url, catId, catName, hasRecipe, hindi }]
// Options: { includeInactive: false } — set true to include retired dishes
function getAllDishes(opts) {
  const options = opts || {};
  const includeInactive = !!options.includeInactive;
  const catIdToName = {};
  (RECIPE_DB.cats || []).forEach(c => { catIdToName[c.id] = c.name; });
  const recipeNameSet = new Set();
  (RECIPE_DB.cats || []).forEach(c => {
    (RECIPE_DB.recipes[c.id] || []).forEach(r => { if (r && r.n) recipeNameSet.add(r.n); });
  });
  const out = [];
  Object.keys(DISH_MASTER).forEach(name => {
    const row = DISH_MASTER[name] || {};
    if (!includeInactive && row.is_active === false) return;
    const catId = DISH_CAT_MAP[name] || null;
    // hasRecipe: direct name match OR resolvable via DISH_NAME_MAP (excluding __none__ sentinel)
    const mapped = DISH_NAME_MAP[name];
    const mappedResolves = mapped && mapped !== '__none__' && recipeNameSet.has(mapped);
    out.push({
      dish_name:    name,
      is_active:    row.is_active !== false,
      notes:        row.notes || '',
      image_url:    row.image_url || '',
      catId,
      catName:      catId ? (catIdToName[catId] || catId) : null,
      hasRecipe:    recipeNameSet.has(name) || mappedResolves,
      mappedTo:     mappedResolves ? mapped : null,
      explicitNone: mapped === '__none__',
      hindi:        DISH_HINDI_MAP[name] || ''
    });
  });
  return out.sort((a, b) => a.dish_name.localeCompare(b.dish_name));
}

function hasIngredients(dishName) {
  const rec = findRecipeForDish(dishName);
  if (rec?.ingredients?.items?.length > 0) return true;
  return !!RECIPE_INGREDIENTS[dishName];
}

// Returns package names that currently include this dish (sorted A→Z).
// Reads live MENU_PACKAGES — mutated in place by MenuPackagesView on save.
function packagesContainingDish(dishName) {
  if (!dishName) return [];
  const out = [];
  Object.keys(MENU_PACKAGES).forEach(pkg => {
    const list = MENU_PACKAGES[pkg] || [];
    if (list.indexOf(dishName) !== -1) out.push(pkg);
  });
  return out.sort();
}

// V63 ────────────────────────────────────────────────────────────
// Return structured sections for a package. Preference order:
//   1. Explicit sections hydrated from menu_packages.sections column
//   2. Derived on the fly from flat MENU_PACKAGES[pkg] using getSectionForDish
// Always returns a NEW array of NEW objects (safe for caller to mutate).
// Shape: [{ id, name, sop_category, dishes: [dishName, ...] }, ...]
function getSectionsForPackage(pkgName) {
  if (!pkgName) return [];
  const explicit = MENU_PACKAGE_SECTIONS[pkgName];
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.map(s => ({
      id: s.id || ('sec_' + Math.random().toString(36).slice(2, 8)),
      name: s.name || '',
      sop_category: s.sop_category || s.name || '',
      dishes: Array.isArray(s.dishes) ? s.dishes.slice() : []
    }));
  }
  // Derive from flat dishes[]
  const flat = MENU_PACKAGES[pkgName] || [];
  const bySec = {};
  const order = [];
  flat.forEach(d => {
    const sec = getSectionForDish(d) || 'Other';
    if (!bySec[sec]) { bySec[sec] = []; order.push(sec); }
    bySec[sec].push(d);
  });
  return order.map((sec, i) => ({
    id: 'sec_' + i + '_' + sec.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    name: sec,
    sop_category: sec,
    dishes: bySec[sec]
  }));
}

// Flatten sections → dedup'd flat dish name array, preserving section+intra-section order.
// Used before every menu_packages save to keep the legacy dishes[] column in sync.
function flattenSectionsToDishes(sections) {
  const out = [];
  const seen = {};
  (sections || []).forEach(s => {
    (s.dishes || []).forEach(d => {
      if (!d || seen[d]) return;
      seen[d] = true;
      out.push(d);
    });
  });
  return out;
}

// Mutate both in-memory maps in place after a successful save. Matches the
// existing pattern (MENU_PACKAGES[pkg] = filtered) in MenuPackagesView.
// Caller is responsible for the actual supabase.update() call.
function setPackageSections(pkgName, sections, flatDishes) {
  if (!pkgName) return;
  MENU_PACKAGE_SECTIONS[pkgName] = sections || [];
  if (Array.isArray(flatDishes)) MENU_PACKAGES[pkgName] = flatDishes;
}

export { guessSectionForDish, getSectionForDish, getCatIdForDish, getCatForDish, catIdToSection, GENERIC_STEPS, RECIPE_INGREDIENTS, RECIPE_DB, DISH_NAME_MAP, DISH_HINDI_MAP, findRecipeForDish, getStepsForDish, fmtT, BEV_RE, getFullSteps, getDishImageUrl, hydrateRecipeData, normDish, getIngrForDish, getIngrForYield, interpolatePax, hasIngredients, dishLabel, resolveDishHindi, setDishHindiMap, upsertDishHindi, upsertDishCat, DISH_MASTER, setDishMaster, upsertDishMaster, deactivateDish, getAllDishes, packagesContainingDish, DISH_STORE_MAP, setDishStoreMap, upsertDishStoreMap, resolveDishStore, getSectionsForPackage, flattenSectionsToDishes, setPackageSections };
