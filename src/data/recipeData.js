// Ambria FnB — Recipe database, SOP steps, dish helpers
// Extracted from App.jsx

import { MENU_PACKAGES } from './menuPackages.js';

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

// ─── RECIPE DATABASE (will be populated with actual SOPs in next phase) ──
// ─── RECIPE INGREDIENTS (per-pax in grams/ml, calculated from SOP 200-pax base) ──
const RECIPE_INGREDIENTS = {
  "Aloo Pakoda":[{n:"Potato",h:"आलू",q:20,u:"g"},{n:"Besan",h:"बेसन",q:10,u:"g"},{n:"Oil (frying)",h:"तेल",q:40,u:"ml"}],
  "Gobhi Pakoda":[{n:"Cauliflower",h:"फूलगोभी",q:25,u:"g"},{n:"Besan",h:"बेसन",q:10,u:"g"},{n:"Oil (frying)",h:"तेल",q:40,u:"ml"}],
  "Pyaz Pakoda":[{n:"Onion",h:"प्याज",q:30,u:"g"},{n:"Besan",h:"बेसन",q:8,u:"g"},{n:"Oil (frying)",h:"तेल",q:35,u:"ml"}],
  "Palak Pakoda":[{n:"Spinach Leaves",h:"पालक पत्ते",q:20,u:"g"},{n:"Besan",h:"बेसन",q:6,u:"g"},{n:"Oil (frying)",h:"तेल",q:30,u:"ml"}],
  "Aloo Paratha":[{n:"Wheat Flour",h:"गेहूं आटा",q:30,u:"g"},{n:"Potato (boiled)",h:"आलू उबला",q:25,u:"g"},{n:"Ghee",h:"घी",q:5,u:"g"}],
  "Samosa Mini":[{n:"Maida",h:"मैदा",q:10,u:"g"},{n:"Potato filling",h:"आलू मसाला",q:15,u:"g"},{n:"Oil (frying)",h:"तेल",q:40,u:"ml"}],
  "Arbi Ka Jhol":[{n:"Arbi (Colocasia)",h:"अरबी",q:35,u:"g"},{n:"Oil",h:"तेल",q:6,u:"ml"},{n:"Tamarind",h:"इमली",q:2,u:"g"}],
  "Butterscotch Caramel Kheer":[{n:"Milk",h:"दूध",q:50,u:"ml"},{n:"Basmati Rice",h:"बासमती चावल",q:5,u:"g"},{n:"Sugar",h:"चीनी",q:8,u:"g"},{n:"Butterscotch Chips",h:"बटरस्कॉच चिप्स",q:3,u:"g"}],
  "Paneer Tikka":[{n:"Paneer",h:"पनीर",q:175,u:"g"},{n:"Hung Curd",h:"हंग दही",q:30,u:"g"},{n:"Mustard Oil",h:"सरसों तेल",q:5,u:"ml"},{n:"Capsicum",h:"शिमला मिर्च",q:20,u:"g"},{n:"Onion",h:"प्याज",q:15,u:"g"},{n:"Butter",h:"मक्खन",q:2.5,u:"g"}],
  "Soya Chaap Malai":[{n:"Soya Chaap",h:"सोया चाप",q:150,u:"g"},{n:"Cream",h:"क्रीम",q:20,u:"ml"},{n:"Cashew Paste",h:"काजू पेस्ट",q:10,u:"g"},{n:"Butter",h:"मक्खन",q:3,u:"g"}],
  "Dahi Ke Sholay":[{n:"Hung Curd",h:"हंग दही",q:30,u:"g"},{n:"Bread (crust)",h:"ब्रेड क्रस्ट",q:15,u:"g"},{n:"Oil (frying)",h:"तेल",q:25,u:"ml"},{n:"Green Chilli",h:"हरी मिर्च",q:2,u:"g"}],
  "Golden Coin":[{n:"Paneer",h:"पनीर",q:20,u:"g"},{n:"Bread Disc",h:"ब्रेड डिस्क",q:10,u:"g"},{n:"Corn",h:"कॉर्न",q:5,u:"g"},{n:"Oil (frying)",h:"तेल",q:20,u:"ml"}],
  "Veg Galauti":[{n:"Raw Banana",h:"कच्चा केला",q:25,u:"g"},{n:"Potato",h:"आलू",q:15,u:"g"},{n:"Khoya",h:"खोया",q:5,u:"g"},{n:"Ghee",h:"घी",q:5,u:"g"}],
  "Mushroom Galauti":[{n:"Mushroom",h:"मशरूम",q:30,u:"g"},{n:"Potato",h:"आलू",q:10,u:"g"},{n:"Ghee",h:"घी",q:5,u:"g"},{n:"Galauti Masala",h:"गलौटी मसाला",q:1,u:"g"}],
  "Tandoori Broccoli":[{n:"Broccoli",h:"ब्रोकली",q:50,u:"g"},{n:"Hung Curd",h:"हंग दही",q:15,u:"g"},{n:"Mustard Oil",h:"सरसों तेल",q:3,u:"ml"}],
  "Chicken Seekh Kebab":[{n:"Chicken Mince",h:"चिकन कीमा",q:60,u:"g"},{n:"Onion",h:"प्याज",q:10,u:"g"},{n:"Ginger Garlic",h:"अदरक-लहसुन",q:3,u:"g"},{n:"Butter",h:"मक्खन",q:2,u:"g"}],
  "Mutton Seekh Kebab":[{n:"Mutton Mince",h:"मटन कीमा",q:70,u:"g"},{n:"Onion",h:"प्याज",q:10,u:"g"},{n:"Raw Papaya Paste",h:"कच्चा पपीता पेस्ट",q:5,u:"g"},{n:"Ghee",h:"घी",q:3,u:"g"}],
  "Tangri Kebab":[{n:"Chicken Legs",h:"चिकन टांग",q:200,u:"g"},{n:"Hung Curd",h:"हंग दही",q:20,u:"g"},{n:"Cream",h:"क्रीम",q:10,u:"ml"},{n:"Butter",h:"मक्खन",q:5,u:"g"}],
  "Murgh Malai Tikka":[{n:"Chicken",h:"चिकन",q:60,u:"g"},{n:"Cream",h:"क्रीम",q:15,u:"ml"},{n:"Cream Cheese",h:"क्रीम चीज़",q:10,u:"g"},{n:"Butter",h:"मक्खन",q:3,u:"g"}],
  "Chicken Tikka":[{n:"Chicken",h:"चिकन",q:60,u:"g"},{n:"Hung Curd",h:"हंग दही",q:20,u:"g"},{n:"Mustard Oil",h:"सरसों तेल",q:3,u:"ml"},{n:"Butter",h:"मक्खन",q:2,u:"g"}],
  "Fish Tikka":[{n:"Fish (Boneless)",h:"मछली",q:60,u:"g"},{n:"Hung Curd",h:"हंग दही",q:15,u:"g"},{n:"Carom Seeds",h:"अजवाइन",q:0.5,u:"g"}],
  "Mint Chutney":[{n:"Mint",h:"पुदीना",q:5,u:"g"},{n:"Coriander",h:"हरा धनिया",q:5,u:"g"},{n:"Green Chilli",h:"हरी मिर्च",q:1,u:"g"},{n:"Lemon",h:"नींबू",q:2,u:"ml"}],
  "Naan":[{n:"Maida",h:"मैदा",q:30,u:"g"},{n:"Yogurt",h:"दही",q:5,u:"g"},{n:"Butter",h:"मक्खन",q:3,u:"g"},{n:"Baking Powder",h:"बेकिंग पाउडर",q:0.3,u:"g"}],
  "Honey Chilli Potatoes":[{n:"Potato",h:"आलू",q:60,u:"g"},{n:"Corn Flour",h:"कॉर्नफ्लोर",q:10,u:"g"},{n:"Honey",h:"शहद",q:2.5,u:"g"},{n:"Tomato Sauce",h:"टोमैटो सॉस",q:7.5,u:"g"},{n:"Chilli Sauce",h:"चिली सॉस",q:2.5,u:"g"},{n:"Oil (frying)",h:"तेल",q:50,u:"ml"}],
  "Schezwan Mushroom":[{n:"Mushroom",h:"मशरूम",q:50,u:"g"},{n:"Schezwan Sauce",h:"स्चेज़वान सॉस",q:5,u:"g"},{n:"Capsicum",h:"शिमला मिर्च",q:10,u:"g"},{n:"Corn Flour",h:"कॉर्नफ्लोर",q:5,u:"g"},{n:"Oil",h:"तेल",q:20,u:"ml"}],
  "Chilli Paneer":[{n:"Paneer",h:"पनीर",q:40,u:"g"},{n:"Corn Flour",h:"कॉर्नफ्लोर",q:8,u:"g"},{n:"Soy Sauce",h:"सोया सॉस",q:3,u:"ml"},{n:"Capsicum",h:"शिमला मिर्च",q:10,u:"g"},{n:"Oil",h:"तेल",q:25,u:"ml"}],
  "Veg Spring Roll":[{n:"Spring Roll Sheet",h:"स्प्रिंग रोल शीट",q:1,u:"pcs"},{n:"Mixed Vegetables",h:"मिक्स सब्ज़ी",q:20,u:"g"},{n:"Noodles",h:"नूडल्स",q:5,u:"g"},{n:"Oil (frying)",h:"तेल",q:30,u:"ml"}],
  "Veg Momos":[{n:"Maida",h:"मैदा",q:12,u:"g"},{n:"Cabbage",h:"पत्तागोभी",q:15,u:"g"},{n:"Carrot",h:"गाजर",q:5,u:"g"},{n:"Soy Sauce",h:"सोया सॉस",q:0.5,u:"ml"}],
  "Green Thai Curry Veg":[{n:"Mixed Vegetables",h:"मिक्स सब्ज़ी",q:40,u:"g"},{n:"Coconut Milk",h:"नारियल दूध",q:40,u:"ml"},{n:"Green Thai Paste",h:"ग्रीन थाई पेस्ट",q:5,u:"g"},{n:"Lemongrass",h:"लेमनग्रास",q:1,u:"g"}],
  "Chicken Red Thai Curry":[{n:"Chicken",h:"चिकन",q:60,u:"g"},{n:"Coconut Milk",h:"नारियल दूध",q:40,u:"ml"},{n:"Red Thai Paste",h:"रेड थाई पेस्ट",q:5,u:"g"}],
  "Veg Hakka Noodles":[{n:"Hakka Noodles",h:"हक्का नूडल्स",q:30,u:"g"},{n:"Cabbage",h:"पत्तागोभी",q:15,u:"g"},{n:"Capsicum",h:"शिमला मिर्च",q:10,u:"g"},{n:"Soy Sauce",h:"सोया सॉस",q:2,u:"ml"},{n:"Oil",h:"तेल",q:8,u:"ml"}],
  "Garlic Onion Fried Rice":[{n:"Cooked Rice",h:"पका चावल",q:40,u:"g"},{n:"Garlic",h:"लहसुन",q:2,u:"g"},{n:"Onion",h:"प्याज",q:10,u:"g"},{n:"Soy Sauce",h:"सोया सॉस",q:2,u:"ml"},{n:"Oil",h:"तेल",q:5,u:"ml"}],
  "Green Tea":[{n:"Hot Water",h:"गर्म पानी",q:180,u:"ml"},{n:"Green Tea Bag",h:"ग्रीन टी बैग",q:1,u:"pcs"},{n:"Honey",h:"शहद",q:15,u:"ml"},{n:"Lime Juice",h:"नींबू रस",q:10,u:"ml"}],
  "Masala Chai":[{n:"Tea Leaves",h:"चाय पत्ती",q:8,u:"g"},{n:"Milk",h:"दूध",q:60,u:"ml"},{n:"Water",h:"पानी",q:120,u:"ml"},{n:"Ginger",h:"अदरक",q:10,u:"g"},{n:"Cardamom",h:"इलायची",q:4,u:"pcs"},{n:"Cloves",h:"लौंग",q:2,u:"pcs"}],
  "Virgin Mojito":[{n:"Lime",h:"नींबू",q:1,u:"pcs"},{n:"Mint Leaves",h:"पुदीना",q:8,u:"pcs"},{n:"Sugar Syrup",h:"शुगर सिरप",q:15,u:"ml"},{n:"Soda",h:"सोडा",q:150,u:"ml"},{n:"Ice",h:"बर्फ",q:100,u:"g"}],
  "Jaljeera":[{n:"Cumin Powder",h:"जीरा पाउडर",q:2,u:"g"},{n:"Tamarind Water",h:"इमली पानी",q:30,u:"ml"},{n:"Mint",h:"पुदीना",q:3,u:"g"},{n:"Chilled Water",h:"ठंडा पानी",q:200,u:"ml"}],
  "Shikanji":[{n:"Lemon",h:"नींबू",q:1,u:"pcs"},{n:"Sugar",h:"चीनी",q:15,u:"g"},{n:"Black Salt",h:"काला नमक",q:0.5,u:"g"},{n:"Chilled Water",h:"ठंडा पानी",q:250,u:"ml"}],
  "Mango Michelada":[{n:"Mango Puree",h:"आम प्यूरी",q:60,u:"ml"},{n:"Lime Juice",h:"नींबू रस",q:15,u:"ml"},{n:"Chilli Rim Salt",h:"चिली रिम सॉल्ट",q:2,u:"g"},{n:"Soda",h:"सोडा",q:100,u:"ml"}],
  "Spicy Jamun Shots":[{n:"Jamun Puree",h:"जामुन प्यूरी",q:40,u:"ml"},{n:"Lime Juice",h:"नींबू रस",q:10,u:"ml"},{n:"Jaljeera Powder",h:"जलजीरा पाउडर",q:1,u:"g"},{n:"Salt",h:"नमक",q:0.3,u:"g"}],
  "Caribbean Citrus Cooler":[{n:"Orange Juice",h:"संतरे का रस",q:80,u:"ml"},{n:"Pineapple Juice",h:"अनानास रस",q:40,u:"ml"},{n:"Lime Juice",h:"नींबू रस",q:15,u:"ml"},{n:"Grenadine",h:"ग्रेनाडाइन",q:10,u:"ml"},{n:"Soda",h:"सोडा",q:60,u:"ml"}],
  "Paneer Tikka":[{n:"Paneer",h:"पनीर",q:175,u:"g"},{n:"Hung Curd",h:"हंग दही",q:30,u:"g"},{n:"Mustard Oil",h:"सरसों तेल",q:5,u:"ml"},{n:"Capsicum",h:"शिमला मिर्च",q:20,u:"g"},{n:"Onion",h:"प्याज",q:15,u:"g"},{n:"Butter",h:"मक्खन",q:2.5,u:"g"}],
  "Soya Chaap Malai":[{n:"Soya Chaap",h:"सोया चाप",q:150,u:"g"},{n:"Cream",h:"क्रीम",q:20,u:"ml"},{n:"Cashew Paste",h:"काजू पेस्ट",q:10,u:"g"},{n:"Butter",h:"मक्खन",q:3,u:"g"}],
  "Dahi Ke Sholay":[{n:"Hung Curd",h:"हंग दही",q:30,u:"g"},{n:"Bread (crust)",h:"ब्रेड क्रस्ट",q:15,u:"g"},{n:"Oil (frying)",h:"तेल",q:25,u:"ml"},{n:"Green Chilli",h:"हरी मिर्च",q:2,u:"g"}],
  "Golden Coin":[{n:"Paneer",h:"पनीर",q:20,u:"g"},{n:"Bread Disc",h:"ब्रेड डिस्क",q:10,u:"g"},{n:"Corn",h:"कॉर्न",q:5,u:"g"},{n:"Oil (frying)",h:"तेल",q:20,u:"ml"}],
  "Veg Galauti":[{n:"Raw Banana",h:"कच्चा केला",q:25,u:"g"},{n:"Potato",h:"आलू",q:15,u:"g"},{n:"Khoya",h:"खोया",q:5,u:"g"},{n:"Ghee",h:"घी",q:5,u:"g"}],
  "Mushroom Galauti":[{n:"Mushroom",h:"मशरूम",q:30,u:"g"},{n:"Potato",h:"आलू",q:10,u:"g"},{n:"Ghee",h:"घी",q:5,u:"g"},{n:"Galauti Masala",h:"गलौटी मसाला",q:1,u:"g"}],
  "Tandoori Broccoli":[{n:"Broccoli",h:"ब्रोकली",q:50,u:"g"},{n:"Hung Curd",h:"हंग दही",q:15,u:"g"},{n:"Mustard Oil",h:"सरसों तेल",q:3,u:"ml"}],
  "Chicken Seekh Kebab":[{n:"Chicken Mince",h:"चिकन कीमा",q:60,u:"g"},{n:"Onion",h:"प्याज",q:10,u:"g"},{n:"Ginger Garlic",h:"अदरक-लहसुन",q:3,u:"g"},{n:"Butter",h:"मक्खन",q:2,u:"g"}],
  "Mutton Seekh Kebab":[{n:"Mutton Mince",h:"मटन कीमा",q:70,u:"g"},{n:"Onion",h:"प्याज",q:10,u:"g"},{n:"Raw Papaya Paste",h:"कच्चा पपीता पेस्ट",q:5,u:"g"},{n:"Ghee",h:"घी",q:3,u:"g"}],
  "Tangri Kebab":[{n:"Chicken Legs",h:"चिकन टांग",q:200,u:"g"},{n:"Hung Curd",h:"हंग दही",q:20,u:"g"},{n:"Cream",h:"क्रीम",q:10,u:"ml"},{n:"Butter",h:"मक्खन",q:5,u:"g"}],
  "Murgh Malai Tikka":[{n:"Chicken",h:"चिकन",q:60,u:"g"},{n:"Cream",h:"क्रीम",q:15,u:"ml"},{n:"Cream Cheese",h:"क्रीम चीज़",q:10,u:"g"},{n:"Butter",h:"मक्खन",q:3,u:"g"}],
  "Chicken Tikka":[{n:"Chicken",h:"चिकन",q:60,u:"g"},{n:"Hung Curd",h:"हंग दही",q:20,u:"g"},{n:"Mustard Oil",h:"सरसों तेल",q:3,u:"ml"},{n:"Butter",h:"मक्खन",q:2,u:"g"}],
  "Fish Tikka":[{n:"Fish (Boneless)",h:"मछली",q:60,u:"g"},{n:"Hung Curd",h:"हंग दही",q:15,u:"g"},{n:"Carom Seeds",h:"अजवाइन",q:0.5,u:"g"}],
  "Mint Chutney":[{n:"Mint",h:"पुदीना",q:5,u:"g"},{n:"Coriander",h:"हरा धनिया",q:5,u:"g"},{n:"Green Chilli",h:"हरी मिर्च",q:1,u:"g"},{n:"Lemon",h:"नींबू",q:2,u:"ml"}],
  "Naan":[{n:"Maida",h:"मैदा",q:30,u:"g"},{n:"Yogurt",h:"दही",q:5,u:"g"},{n:"Butter",h:"मक्खन",q:3,u:"g"},{n:"Baking Powder",h:"बेकिंग पाउडर",q:0.3,u:"g"}],
  "Honey Chilli Potatoes":[{n:"Potato",h:"आलू",q:60,u:"g"},{n:"Corn Flour",h:"कॉर्नफ्लोर",q:10,u:"g"},{n:"Honey",h:"शहद",q:2.5,u:"g"},{n:"Tomato Sauce",h:"टोमैटो सॉस",q:7.5,u:"g"},{n:"Chilli Sauce",h:"चिली सॉस",q:2.5,u:"g"},{n:"Oil (frying)",h:"तेल",q:50,u:"ml"}],
  "Schezwan Mushroom":[{n:"Mushroom",h:"मशरूम",q:50,u:"g"},{n:"Schezwan Sauce",h:"स्चेज़वान सॉस",q:5,u:"g"},{n:"Capsicum",h:"शिमला मिर्च",q:10,u:"g"},{n:"Corn Flour",h:"कॉर्नफ्लोर",q:5,u:"g"},{n:"Oil",h:"तेल",q:20,u:"ml"}],
  "Chilli Paneer":[{n:"Paneer",h:"पनीर",q:40,u:"g"},{n:"Corn Flour",h:"कॉर्नफ्लोर",q:8,u:"g"},{n:"Soy Sauce",h:"सोया सॉस",q:3,u:"ml"},{n:"Capsicum",h:"शिमला मिर्च",q:10,u:"g"},{n:"Oil",h:"तेल",q:25,u:"ml"}],
  "Veg Spring Roll":[{n:"Spring Roll Sheet",h:"स्प्रिंग रोल शीट",q:1,u:"pcs"},{n:"Mixed Vegetables",h:"मिक्स सब्ज़ी",q:20,u:"g"},{n:"Noodles",h:"नूडल्स",q:5,u:"g"},{n:"Oil (frying)",h:"तेल",q:30,u:"ml"}],
  "Veg Momos":[{n:"Maida",h:"मैदा",q:12,u:"g"},{n:"Cabbage",h:"पत्तागोभी",q:15,u:"g"},{n:"Carrot",h:"गाजर",q:5,u:"g"},{n:"Soy Sauce",h:"सोया सॉस",q:0.5,u:"ml"}],
  "Green Thai Curry Veg":[{n:"Mixed Vegetables",h:"मिक्स सब्ज़ी",q:40,u:"g"},{n:"Coconut Milk",h:"नारियल दूध",q:40,u:"ml"},{n:"Green Thai Paste",h:"ग्रीन थाई पेस्ट",q:5,u:"g"},{n:"Lemongrass",h:"लेमनग्रास",q:1,u:"g"}],
  "Chicken Red Thai Curry":[{n:"Chicken",h:"चिकन",q:60,u:"g"},{n:"Coconut Milk",h:"नारियल दूध",q:40,u:"ml"},{n:"Red Thai Paste",h:"रेड थाई पेस्ट",q:5,u:"g"}],
  "Veg Hakka Noodles":[{n:"Hakka Noodles",h:"हक्का नूडल्स",q:30,u:"g"},{n:"Cabbage",h:"पत्तागोभी",q:15,u:"g"},{n:"Capsicum",h:"शिमला मिर्च",q:10,u:"g"},{n:"Soy Sauce",h:"सोया सॉस",q:2,u:"ml"},{n:"Oil",h:"तेल",q:8,u:"ml"}],
  "Garlic Onion Fried Rice":[{n:"Cooked Rice",h:"पका चावल",q:40,u:"g"},{n:"Garlic",h:"लहसुन",q:2,u:"g"},{n:"Onion",h:"प्याज",q:10,u:"g"},{n:"Soy Sauce",h:"सोया सॉस",q:2,u:"ml"},{n:"Oil",h:"तेल",q:5,u:"ml"}],
  "Green Tea":[{n:"Hot Water",h:"गर्म पानी",q:180,u:"ml"},{n:"Green Tea Bag",h:"ग्रीन टी बैग",q:1,u:"pcs"},{n:"Honey",h:"शहद",q:15,u:"ml"},{n:"Lime Juice",h:"नींबू रस",q:10,u:"ml"}],
  "Masala Chai":[{n:"Tea Leaves",h:"चाय पत्ती",q:8,u:"g"},{n:"Milk",h:"दूध",q:60,u:"ml"},{n:"Water",h:"पानी",q:120,u:"ml"},{n:"Ginger",h:"अदरक",q:10,u:"g"},{n:"Cardamom",h:"इलायची",q:4,u:"pcs"},{n:"Cloves",h:"लौंग",q:2,u:"pcs"}],
  "Virgin Mojito":[{n:"Lime",h:"नींबू",q:1,u:"pcs"},{n:"Mint Leaves",h:"पुदीना",q:8,u:"pcs"},{n:"Sugar Syrup",h:"शुगर सिरप",q:15,u:"ml"},{n:"Soda",h:"सोडा",q:150,u:"ml"},{n:"Ice",h:"बर्फ",q:100,u:"g"}],
  "Jaljeera":[{n:"Cumin Powder",h:"जीरा पाउडर",q:2,u:"g"},{n:"Tamarind Water",h:"इमली पानी",q:30,u:"ml"},{n:"Mint",h:"पुदीना",q:3,u:"g"},{n:"Chilled Water",h:"ठंडा पानी",q:200,u:"ml"}],
  "Shikanji":[{n:"Lemon",h:"नींबू",q:1,u:"pcs"},{n:"Sugar",h:"चीनी",q:15,u:"g"},{n:"Black Salt",h:"काला नमक",q:0.5,u:"g"},{n:"Chilled Water",h:"ठंडा पानी",q:250,u:"ml"}],
  "Mango Michelada":[{n:"Mango Puree",h:"आम प्यूरी",q:60,u:"ml"},{n:"Lime Juice",h:"नींबू रस",q:15,u:"ml"},{n:"Chilli Rim Salt",h:"चिली रिम सॉल्ट",q:2,u:"g"},{n:"Soda",h:"सोडा",q:100,u:"ml"}],
  "Spicy Jamun Shots":[{n:"Jamun Puree",h:"जामुन प्यूरी",q:40,u:"ml"},{n:"Lime Juice",h:"नींबू रस",q:10,u:"ml"},{n:"Jaljeera Powder",h:"जलजीरा पाउडर",q:1,u:"g"},{n:"Salt",h:"नमक",q:0.3,u:"g"}],
  "Caribbean Citrus Cooler":[{n:"Orange Juice",h:"संतरे का रस",q:80,u:"ml"},{n:"Pineapple Juice",h:"अनानास रस",q:40,u:"ml"},{n:"Lime Juice",h:"नींबू रस",q:15,u:"ml"},{n:"Grenadine",h:"ग्रेनाडाइन",q:10,u:"ml"},{n:"Soda",h:"सोडा",q:60,u:"ml"}],
  "Gajar Ka Halwa":[{n:"Gajar (grated)",h:"गाजर कसी",q:50,u:"g"},{n:"Sugar",h:"चीनी",q:10,u:"g"},{n:"Khoya",h:"खोया",q:10,u:"g"},{n:"Milk",h:"दूध",q:50,u:"ml"},{n:"Desi Ghee",h:"देसी घी",q:5,u:"g"},{n:"Cardamom",h:"इलायची",q:0.25,u:"g"},{n:"Cashew",h:"काजू",q:1.5,u:"g"},{n:"Pistachio",h:"पिस्ता",q:0.25,u:"g"}],
  "Moong Dal Halwa":[{n:"Moong Dal",h:"मूंग दाल",q:10,u:"g"},{n:"Desi Ghee",h:"देसी घी",q:15,u:"g"},{n:"Sugar",h:"चीनी",q:10,u:"g"},{n:"Sooji",h:"सूजी",q:1,u:"g"},{n:"Water",h:"पानी",q:22,u:"ml"},{n:"Cashew",h:"काजू",q:2.5,u:"g"},{n:"Cardamom",h:"इलायची",q:0.15,u:"g"}],
  "Anjeer Halwa":[{n:"Anjeer (Fig)",h:"अंजीर",q:7.5,u:"g"},{n:"Desi Ghee",h:"देसी घी",q:3,u:"g"},{n:"Khoya",h:"खोया",q:5,u:"g"},{n:"Sugar",h:"चीनी",q:1.5,u:"g"},{n:"Cardamom",h:"इलायची",q:0.015,u:"g"},{n:"Pistachio",h:"पिस्ता",q:0.05,u:"g"}],
  "Apple Halwa":[{n:"Apple",h:"सेब",q:15,u:"g"},{n:"Milk",h:"दूध",q:15,u:"ml"},{n:"Sugar",h:"चीनी",q:2.5,u:"g"},{n:"Khoya",h:"खोया",q:4,u:"g"},{n:"Desi Ghee",h:"देसी घी",q:1.25,u:"g"},{n:"Cardamom",h:"इलायची",q:0.025,u:"g"},{n:"Cashew",h:"काजू",q:0.5,u:"g"}],
  "Mirch Ka Halwa":[{n:"Achari Mirch",h:"अचारी मिर्च",q:15,u:"g"},{n:"Sugar",h:"चीनी",q:3,u:"g"},{n:"Khoya",h:"खोया",q:3.75,u:"g"},{n:"Milk",h:"दूध",q:15,u:"ml"},{n:"Desi Ghee",h:"देसी घी",q:1.5,u:"g"},{n:"Cashew",h:"काजू",q:0.5,u:"g"}],
  "Ghewar":[{n:"Maida",h:"मैदा",q:5,u:"g"},{n:"Dalda/Ghee (batter)",h:"डालडा/घी",q:1,u:"g"},{n:"Water (batter)",h:"पानी",q:15,u:"ml"},{n:"Desi Ghee (frying)",h:"देसी घी तलने",q:25,u:"g"},{n:"Sugar (syrup)",h:"चीनी चाशनी",q:15,u:"g"},{n:"Saffron",h:"केसर",q:0.0015,u:"g"}],
  "Gulab Jamun":[{n:"Khoya (dhaap)",h:"खोया",q:15,u:"g"},{n:"Chhena",h:"छैना",q:6.25,u:"g"},{n:"Maida",h:"मैदा",q:3.75,u:"g"},{n:"Baking Powder",h:"बेकिंग पाउडर",q:0.04,u:"g"},{n:"Cardamom",h:"इलायची",q:0.05,u:"g"},{n:"Sugar (syrup)",h:"चीनी चाशनी",q:45,u:"g"},{n:"Desi Ghee (frying)",h:"देसी घी तलने",q:25,u:"g"}],
  "Ras Malai":[{n:"Chhena",h:"छैना",q:20,u:"g"},{n:"Sugar (syrup)",h:"चीनी चाशनी",q:10,u:"g"},{n:"Milk (rabri)",h:"दूध रबड़ी",q:40,u:"ml"},{n:"Saffron",h:"केसर",q:0.005,u:"g"},{n:"Cardamom",h:"इलायची",q:0.1,u:"g"},{n:"Pistachio",h:"पिस्ता",q:0.5,u:"g"}],
  "Gulab Kheer":[{n:"Basmati Rice",h:"बासमती चावल",q:5,u:"g"},{n:"Milk",h:"दूध",q:40,u:"ml"},{n:"Sugar",h:"चीनी",q:8,u:"g"},{n:"Cardamom",h:"इलायची",q:0.1,u:"g"},{n:"Rose Water",h:"गुलाब जल",q:0.5,u:"ml"},{n:"Pistachio",h:"पिस्ता",q:0.25,u:"g"}],
  "Jalebi":[{n:"Maida",h:"मैदा",q:5,u:"g"},{n:"Dahi (Yogurt)",h:"दही",q:2,u:"g"},{n:"Sugar (syrup)",h:"चीनी चाशनी",q:15,u:"g"},{n:"Desi Ghee (frying)",h:"देसी घी तलने",q:10,u:"g"},{n:"Saffron",h:"केसर",q:0.002,u:"g"}],
  "Shahi Tukda":[{n:"Bread",h:"ब्रेड",q:10,u:"g"},{n:"Desi Ghee",h:"देसी घी",q:5,u:"g"},{n:"Sugar (syrup)",h:"चीनी चाशनी",q:8,u:"g"},{n:"Milk (rabri)",h:"दूध रबड़ी",q:30,u:"ml"},{n:"Saffron",h:"केसर",q:0.003,u:"g"},{n:"Pistachio",h:"पिस्ता",q:0.5,u:"g"}],
  "Kaju Katli":[{n:"Cashew",h:"काजू",q:10,u:"g"},{n:"Sugar",h:"चीनी",q:6,u:"g"},{n:"Desi Ghee",h:"देसी घी",q:1,u:"g"},{n:"Cardamom",h:"इलायची",q:0.05,u:"g"},{n:"Silver Leaf",h:"वर्क",q:0.01,u:"g"}],
  "Phirni":[{n:"Basmati Rice",h:"बासमती चावल",q:4,u:"g"},{n:"Milk",h:"दूध",q:35,u:"ml"},{n:"Sugar",h:"चीनी",q:8,u:"g"},{n:"Cardamom",h:"इलायची",q:0.1,u:"g"},{n:"Saffron",h:"केसर",q:0.003,u:"g"},{n:"Pistachio",h:"पिस्ता",q:0.3,u:"g"},{n:"Almond",h:"बादाम",q:0.3,u:"g"}],
  "Fruit Cream":[{n:"Fresh Cream",h:"ताज़ी क्रीम",q:15,u:"ml"},{n:"Mixed Fruits",h:"मिक्स फल",q:20,u:"g"},{n:"Sugar",h:"चीनी",q:3,u:"g"},{n:"Vanilla Essence",h:"वनीला एसेंस",q:0.1,u:"ml"}],
  "Fruit Custard":[{n:"Milk",h:"दूध",q:30,u:"ml"},{n:"Custard Powder",h:"कस्टर्ड पाउडर",q:2,u:"g"},{n:"Sugar",h:"चीनी",q:5,u:"g"},{n:"Mixed Fruits",h:"मिक्स फल",q:15,u:"g"}],
  "Rasgulla":[{n:"Chhena",h:"छैना",q:15,u:"g"},{n:"Sugar (syrup)",h:"चीनी चाशनी",q:20,u:"g"},{n:"Water (syrup)",h:"पानी",q:40,u:"ml"}],
  "Tilla Kulfi":[{n:"Milk",h:"दूध",q:50,u:"ml"},{n:"Sugar",h:"चीनी",q:8,u:"g"},{n:"Cardamom",h:"इलायची",q:0.1,u:"g"},{n:"Saffron",h:"केसर",q:0.005,u:"g"},{n:"Pistachio",h:"पिस्ता",q:0.5,u:"g"},{n:"Almond",h:"बादाम",q:0.5,u:"g"}],
  "Kadai Doodh":[{n:"Milk",h:"दूध",q:60,u:"ml"},{n:"Sugar",h:"चीनी",q:8,u:"g"},{n:"Almond",h:"बादाम",q:1,u:"g"},{n:"Cashew",h:"काजू",q:1,u:"g"},{n:"Pistachio",h:"पिस्ता",q:0.5,u:"g"},{n:"Saffron",h:"केसर",q:0.005,u:"g"},{n:"Cardamom",h:"इलायची",q:0.1,u:"g"}],
  // Generic per-pax for common dishes (approx)
  "Paneer Tikka":[{n:"Paneer",h:"पनीर",q:40,u:"g"},{n:"Capsicum",h:"शिमला मिर्च",q:10,u:"g"},{n:"Onion",h:"प्याज",q:10,u:"g"},{n:"Yogurt",h:"दही",q:15,u:"g"},{n:"Spice Mix",h:"मसाला मिक्स",q:3,u:"g"},{n:"Lemon",h:"नींबू",q:2,u:"g"}],
  "Dal Makhani":[{n:"Black Urad Dal",h:"काली उड़द दाल",q:12,u:"g"},{n:"Rajma",h:"राजमा",q:3,u:"g"},{n:"Butter",h:"मक्खन",q:5,u:"g"},{n:"Cream",h:"क्रीम",q:5,u:"ml"},{n:"Tomato",h:"टमाटर",q:8,u:"g"},{n:"Ginger-Garlic",h:"अदरक-लहसुन",q:2,u:"g"}],
  "Butter Chicken":[{n:"Chicken",h:"चिकन",q:60,u:"g"},{n:"Yogurt",h:"दही",q:10,u:"g"},{n:"Butter",h:"मक्खन",q:8,u:"g"},{n:"Cream",h:"क्रीम",q:8,u:"ml"},{n:"Tomato",h:"टमाटर",q:15,u:"g"},{n:"Cashew",h:"काजू",q:3,u:"g"},{n:"Kasuri Methi",h:"कसूरी मेथी",q:0.3,u:"g"}],
  "Tandoori Roti":[{n:"Wheat Flour",h:"गेहूं आटा",q:25,u:"g"},{n:"Salt",h:"नमक",q:0.5,u:"g"},{n:"Water",h:"पानी",q:12,u:"ml"},{n:"Ghee (brush)",h:"घी",q:2,u:"g"}],
  "Naan":[{n:"Maida",h:"मैदा",q:25,u:"g"},{n:"Yogurt",h:"दही",q:5,u:"g"},{n:"Baking Powder",h:"बेकिंग पाउडर",q:0.3,u:"g"},{n:"Butter",h:"मक्खन",q:3,u:"g"}],
  "Veg Biryani":[{n:"Basmati Rice",h:"बासमती चावल",q:40,u:"g"},{n:"Mixed Vegetables",h:"मिक्स सब्ज़ियां",q:25,u:"g"},{n:"Onion (fried)",h:"प्याज तला",q:10,u:"g"},{n:"Desi Ghee",h:"देसी घी",q:5,u:"g"},{n:"Saffron",h:"केसर",q:0.005,u:"g"},{n:"Biryani Masala",h:"बिरयानी मसाला",q:2,u:"g"}],
  "Gobhi Masala":[{n:"Cauliflower",h:"फूलगोभी",q:35,u:"g"},{n:"Onion",h:"प्याज",q:10,u:"g"},{n:"Tomato",h:"टमाटर",q:10,u:"g"},{n:"Green Chilli",h:"हरी मिर्च",q:1,u:"g"},{n:"Oil",h:"तेल",q:5,u:"ml"},{n:"Garam Masala",h:"गरम मसाला",q:0.5,u:"g"}],
  "Paneer Lababdar":[{n:"Paneer",h:"पनीर",q:25.0,u:"g"},{n:"Tomato",h:"टमाटर",q:22.5,u:"g"},{n:"Onion",h:"प्याज़",q:12.5,u:"g"},{n:"Cashew",h:"काजू",q:3.0,u:"g"},{n:"Cream",h:"क्रीम",q:4.0,u:"ml"},{n:"Butter",h:"मक्खन",q:4.0,u:"g"},{n:"Oil",h:"तेल",q:3.0,u:"ml"},{n:"Khoya",h:"खोया",q:2.5,u:"g"},{n:"Ginger Garlic Paste",h:"अदरक-लहसुन पेस्ट",q:2.0,u:"g"},{n:"Capsicum",h:"शिमला मिर्च",q:2.5,u:"g"},{n:"Kasuri Methi",h:"कसूरी मेथी",q:0.15,u:"g"}],
  "Dal-E-Ambria":[{n:"Urad Dal Whole",h:"उड़द साबुत",q:15.0,u:"g"},{n:"Moong Dal Whole",h:"मूंग साबुत",q:3.0,u:"g"},{n:"Tomato Puree",h:"टमाटर प्यूरी",q:10.0,u:"g"},{n:"Onion",h:"प्याज़",q:10.0,u:"g"},{n:"Butter",h:"मक्खन",q:3.0,u:"g"},{n:"Fresh Cream",h:"फ्रेश क्रीम",q:5.0,u:"ml"},{n:"Oil",h:"तेल",q:2.5,u:"ml"},{n:"Ginger Garlic Paste",h:"अदरक-लहसुन पेस्ट",q:2.0,u:"g"},{n:"Kasuri Methi",h:"कसूरी मेथी",q:0.1,u:"g"}],
  "Palak Paneer":[{n:"Paneer",h:"पनीर",q:25.0,u:"g"},{n:"Palak (Spinach)",h:"पालक",q:30.0,u:"g"},{n:"Onion",h:"प्याज़",q:7.5,u:"g"},{n:"Tomato Paste",h:"टमाटर पेस्ट",q:5.0,u:"g"},{n:"Cream",h:"क्रीम",q:1.5,u:"g"},{n:"Ghee",h:"घी",q:1.0,u:"g"},{n:"Oil",h:"तेल",q:3.0,u:"ml"}],
  "Diwan-e-Handi":[{n:"Paneer",h:"पनीर",q:15.0,u:"g"},{n:"Mixed Vegetables",h:"मिक्स सब्ज़ी",q:15.0,u:"g"},{n:"Onion",h:"प्याज़",q:10.0,u:"g"},{n:"Cream",h:"क्रीम",q:2.5,u:"ml"},{n:"Cashew",h:"काजू",q:1.5,u:"g"}],
  "Malai Kofta":[{n:"Paneer",h:"पनीर",q:15.0,u:"g"},{n:"Potato (boiled)",h:"आलू उबला",q:10.0,u:"g"},{n:"Cashew",h:"काजू",q:3.0,u:"g"},{n:"Cream",h:"क्रीम",q:4.0,u:"ml"},{n:"Oil (frying)",h:"तेल तलने",q:15.0,u:"ml"}],
  "Dum Aloo Kashmiri":[{n:"Baby Potato",h:"छोटे आलू",q:30.0,u:"g"},{n:"Dahi (Yogurt)",h:"दही",q:7.5,u:"g"},{n:"Oil",h:"तेल",q:5.0,u:"ml"},{n:"Kashmiri Mirch",h:"कश्मीरी मिर्च",q:0.5,u:"g"}],
  "Kadhi Pakoda":[{n:"Besan",h:"बेसन",q:12.5,u:"g"},{n:"Dahi (Yogurt)",h:"दही",q:20.0,u:"g"},{n:"Oil (frying)",h:"तेल तलने",q:10.0,u:"ml"},{n:"Onion",h:"प्याज़",q:5.0,u:"g"}],
  "Amritsari Pindi Choley":[{n:"Kabuli Chana",h:"काबुली चना",q:25.0,u:"g"},{n:"Onion",h:"प्याज़",q:10.0,u:"g"},{n:"Tea Bag",h:"टी बैग",q:0.05,u:"pcs"},{n:"Chole Masala",h:"छोले मसाला",q:1.0,u:"g"}],
  "Sarson Ka Saag":[{n:"Sarson (Mustard Leaves)",h:"सरसों",q:40.0,u:"g"},{n:"Palak",h:"पालक",q:10.0,u:"g"},{n:"Bathua",h:"बथुआ",q:5.0,u:"g"},{n:"Makkai Atta",h:"मक्की आटा",q:2.5,u:"g"},{n:"Ghee",h:"घी",q:2.5,u:"g"}],
  "Butter Chicken":[{n:"Chicken",h:"चिकन",q:60.0,u:"g"},{n:"Yogurt",h:"दही",q:7.5,u:"g"},{n:"Butter",h:"मक्खन",q:7.5,u:"g"},{n:"Cream",h:"क्रीम",q:5.0,u:"ml"},{n:"Tomato",h:"टमाटर",q:25.0,u:"g"},{n:"Cashew",h:"काजू",q:2.5,u:"g"}],
  "Mutton Beliram":[{n:"Mutton",h:"मटन",q:60.0,u:"g"},{n:"Onion (fried)",h:"प्याज़ तला",q:15.0,u:"g"},{n:"Yogurt",h:"दही",q:7.5,u:"g"},{n:"Oil",h:"तेल",q:7.5,u:"ml"}],
  "Mutton Rogan Josh":[{n:"Mutton",h:"मटन",q:60.0,u:"g"},{n:"Dahi",h:"दही",q:7.5,u:"g"},{n:"Kashmiri Mirch",h:"कश्मीरी मिर्च",q:0.75,u:"g"},{n:"Oil",h:"तेल",q:5.0,u:"ml"}],
  "Murgh Lababdar":[{n:"Chicken",h:"चिकन",q:60.0,u:"g"},{n:"Onion",h:"प्याज़",q:15.0,u:"g"},{n:"Cream",h:"क्रीम",q:4.0,u:"ml"},{n:"Cashew",h:"काजू",q:2.5,u:"g"}],
  "Hyderabadi Subz Biryani":[{n:"Basmati Rice",h:"बासमती चावल",q:30.0,u:"g"},{n:"Mixed Vegetables",h:"मिक्स सब्ज़ी",q:20.0,u:"g"},{n:"Onion (fried)",h:"तली प्याज़",q:10.0,u:"g"},{n:"Dahi",h:"दही",q:5.0,u:"g"},{n:"Ghee",h:"घी",q:4.0,u:"g"},{n:"Saffron",h:"केसर",q:0.03,u:"g"}],
  "Mirch Ka Salan":[{n:"Green Chilli (Bhavnagri)",h:"भवनगरी मिर्च",q:5.0,u:"g"},{n:"Peanut",h:"मूंगफली",q:1.5,u:"g"},{n:"Sesame",h:"तिल",q:1.0,u:"g"},{n:"Coconut",h:"नारियल",q:1.0,u:"g"},{n:"Tamarind",h:"इमली",q:0.5,u:"g"}],
  "Chicken Dum Biryani":[{n:"Chicken",h:"चिकन",q:60.0,u:"g"},{n:"Basmati Rice",h:"बासमती चावल",q:30.0,u:"g"},{n:"Onion (fried)",h:"तली प्याज़",q:15.0,u:"g"},{n:"Dahi",h:"दही",q:7.5,u:"g"},{n:"Ghee",h:"घी",q:5.0,u:"g"},{n:"Saffron",h:"केसर",q:0.03,u:"g"}],
  "Bhindi Do Pyaza":[{n:"Bhindi (Okra)",h:"भिंडी",q:25.0,u:"g"},{n:"Onion",h:"प्याज़",q:15.0,u:"g"},{n:"Oil",h:"तेल",q:5.0,u:"ml"}],
  "Gobhi Masala":[{n:"Cauliflower",h:"फूलगोभी",q:35.0,u:"g"},{n:"Onion",h:"प्याज़",q:10.0,u:"g"},{n:"Tomato",h:"टमाटर",q:10.0,u:"g"},{n:"Oil",h:"तेल",q:4.0,u:"ml"}],
  "Aloo Methi":[{n:"Potato",h:"आलू",q:30.0,u:"g"},{n:"Methi (Fenugreek)",h:"मेथी",q:10.0,u:"g"},{n:"Oil",h:"तेल",q:3.0,u:"ml"}],
  "Subz Miloni":[{n:"Mixed Vegetables",h:"मिक्स सब्ज़ी",q:30.0,u:"g"},{n:"Onion",h:"प्याज़",q:7.5,u:"g"},{n:"Cream",h:"क्रीम",q:2.5,u:"ml"}],
  "Dhaba Chicken":[{n:"Chicken",h:"चिकन",q:60.0,u:"g"},{n:"Onion",h:"प्याज़",q:15.0,u:"g"},{n:"Tomato",h:"टमाटर",q:15.0,u:"g"},{n:"Oil",h:"तेल",q:5.0,u:"ml"}],
  "Egg Curry":[{n:"Eggs",h:"अंडे",q:2.0,u:"pcs"},{n:"Onion",h:"प्याज़",q:10.0,u:"g"},{n:"Tomato",h:"टमाटर",q:10.0,u:"g"},{n:"Oil",h:"तेल",q:2.5,u:"ml"}],
  "Dal Tarka":[{n:"Toor Dal",h:"तूर दाल",q:15.0,u:"g"},{n:"Moong Dal",h:"मूंग दाल",q:7.5,u:"g"},{n:"Onion",h:"प्याज़",q:5.0,u:"g"},{n:"Ghee",h:"घी",q:2.5,u:"g"}],
  "Steamed Rice":[{n:"Basmati Rice",h:"बासमती चावल",q:30.0,u:"g"},{n:"Ghee",h:"घी",q:1.0,u:"g"},{n:"Cumin",h:"जीरा",q:0.25,u:"g"}],
  "Fish Goan Curry":[{n:"Fish",h:"मछली",q:40.0,u:"g"},{n:"Coconut Milk",h:"नारियल दूध",q:10.0,u:"ml"},{n:"Onion",h:"प्याज़",q:7.5,u:"g"},{n:"Tamarind",h:"इमली",q:1.0,u:"g"}],
  "Golgappe":[{n:"Semolina",h:"सूजी",q:5,u:"g"},{n:"Wheat Flour",h:"गेहूं आटा",q:3,u:"g"},{n:"Tamarind",h:"इमली",q:3,u:"g"},{n:"Mint",h:"पुदीना",q:2,u:"g"},{n:"Chickpeas (boiled)",h:"छोले उबले",q:5,u:"g"},{n:"Potato (boiled)",h:"आलू उबला",q:5,u:"g"}],
};

const RECIPE_DB = {
  cats:[
    {id:"halwai",name:"Halwai & Savoury",icon:"🫓",count:8},
    {id:"tandoor",name:"Indian Tandoor",icon:"🔥",count:15},
    {id:"chinese",name:"Chinese & Pan-Asian",icon:"🥢",count:9},
    {id:"beverages",name:"Beverages",icon:"☕",count:8},
    {id:"indian",name:"Indian Main Course",icon:"🍛",count:25},
    {id:"sweets",name:"Indian Desserts",icon:"🍮",count:32},
  ],
  recipes:{
    halwai:[
      {n:"Aloo Pakoda",sub:"Veg",steps:[{t:"Mesa",i:"आलू छीलकर 3-4mm गोल स्लाइस काटें",tm:900},{t:"Batter",i:"बेसन + कुटी मिर्च + हरी मिर्च + नमक + बेकिंग पाउडर + पानी — गाढ़ा बेटर बनाएं",tm:300},{t:"Frying",i:"तेल 175-180°C गरम करें, आलू बेटर में डुबोकर सुनहरा तलें",tm:1800,ccp:"तेल 175-180°C — कम गर्मी पर तेलीय होगा"},{t:"Drain",i:"छलनी पर निकालें, नमक छिड़कें",tm:120},{t:"Serve",i:"हरी चटनी और इमली चटनी के साथ गर्म परोसें",tm:60,ccp:"तुरंत सर्व — ठंडा होने पर नरम पड़ जाता है"}]},
      {n:"Gobhi Pakoda",sub:"Veg",steps:[{t:"Mesa",i:"गोभी छोटे फूलों में तोड़ें, धोकर सुखाएं",tm:600,ccp:"गोभी पूरी सूखी हो"},{t:"Batter",i:"बेसन + मसाला बेटर बनाएं",tm:300},{t:"Frying",i:"गोभी बेटर में डुबोकर 175°C तेल में तलें",tm:1800,ccp:"तेल 175-180°C"},{t:"Serve",i:"चटनी के साथ गर्म परोसें",tm:60}]},
      {n:"Pyaz Pakoda",sub:"Veg",steps:[{t:"Mesa",i:"प्याज पतले छल्लों में काटें",tm:600},{t:"Batter",i:"बेसन + हरी मिर्च + धनिया + मसाला बेटर — प्याज के साथ मिलाएं",tm:300},{t:"Frying",i:"बेटर मिश्रण को छोटे-छोटे हिस्से गर्म तेल में तलें",tm:1500,ccp:"तेल 175-180°C"},{t:"Serve",i:"गर्म चटनी के साथ",tm:60}]},
      {n:"Palak Pakoda",sub:"Veg",steps:[{t:"Mesa",i:"पालक पत्ते धोकर सुखाएं, बड़े पत्ते चुनें",tm:600,ccp:"पालक पूरी सूखी हो"},{t:"Batter",i:"पतला बेसन बेटर बनाएं + मसाला",tm:300},{t:"Frying",i:"पालक पत्तों को बेटर में डुबोकर कुरकुरा तलें",tm:1200,ccp:"तेल 175°C — पत्ता जले नहीं"},{t:"Serve",i:"तुरंत गर्म परोसें",tm:60,ccp:"तुरंत सर्व करें"}]},
      {n:"Aloo Paratha",sub:"Veg",steps:[{t:"Dough",i:"आटा + नमक + पानी से नरम आटा गूंधें, 20 मिनट आराम दें",tm:1800},{t:"Filling prep",i:"उबले आलू मैश करें, हरी मिर्च + धनिया + अमचूर + मसाला मिलाएं",tm:600},{t:"Rolling",i:"आटे की लोई लें, भरावन भरें, बेलें",tm:300},{t:"Cooking",i:"तवे पर घी लगाकर दोनों तरफ सुनहरा पकाएं",tm:360,ccp:"तवा गर्म हो — पराठा कच्चा न रहे"},{t:"Serve",i:"घी लगाकर दही/चटनी/अचार के साथ परोसें",tm:60}]},
      {n:"Samosa Mini",sub:"Veg",steps:[{t:"Dough",i:"मैदा + अजवाइन + नमक + घी मोयन — कड़क आटा गूंधें, 30 मिनट आराम",tm:2100},{t:"Filling prep",i:"आलू उबालकर मैश करें, हरी मिर्च + अमचूर + गरम मसाला + धनिया मिलाएं",tm:900},{t:"Shaping",i:"लोई बेलें, भरावन भरें, त्रिकोण आकार में बंद करें",tm:600},{t:"Frying",i:"धीमी आंच (160°C) पर सुनहरा कुरकुरा तलें",tm:2400,ccp:"धीमी आंच — अंदर तक पकने दें"},{t:"Serve",i:"इमली/हरी चटनी के साथ",tm:60}]},
      {n:"Arbi Ka Jhol",sub:"Veg",steps:[{t:"Mesa",i:"अरबी उबालकर छीलें, टुकड़ों में काटें",tm:1800},{t:"Shallow fry",i:"तेल में अरबी हल्की क्रिस्पी करें",tm:900},{t:"Masala",i:"इमली + धनिया-जीरा पाउडर + अमचूर + गर्म मसाला ग्रेवी बनाएं",tm:600},{t:"Combine",i:"अरबी ग्रेवी में डालें, 10 मिनट सिमर",tm:600},{t:"Garnish",i:"हरा धनिया डालें",tm:120}]},
      {n:"Butterscotch Caramel Kheer",sub:"Cold",steps:[{t:"Rice prep",i:"चावल धोकर भिगोएं, दरदरा पीसें",tm:1800},{t:"Kheer cook",i:"दूध उबालें, पिसे चावल डालें, गाढ़ा होने तक पकाएं",tm:2400,ccp:"लगातार चलाएं"},{t:"Caramel",i:"चीनी से कैरेमल बनाएं, खीर में मिलाएं",tm:600,ccp:"कैरेमल जले नहीं"},{t:"Chill",i:"ठंडा करें, बटरस्कॉच चिप्स डालें",tm:3600},{t:"Serve",i:"ग्लास में सर्व करें, व्हिप्ड क्रीम से गार्निश",tm:120}]}
    ],
    tandoor:[
      {n:"Paneer Tikka",sub:"Veg",steps:[{t:"Marination",i:"पनीर क्यूब को दही + सरसों तेल + मसाला में 1-2 घंटे मैरिनेट करें",tm:7200,ccp:"कम से कम 1 घंटा मैरिनेशन"},{t:"Skewering",i:"पनीर + शिमला मिर्च + प्याज + टमाटर बदल-बदलकर सींक में लगाएं",tm:300},{t:"Tandoor",i:"तंदूर 250°C पर — 8-10 मिनट पकाएं, बीच में घुमाएं",tm:600,ccp:"तंदूर 250°C — बाहर धब्बे, अंदर नरम"},{t:"Brush",i:"बाहर निकालकर मक्खन लगाएं, चाट मसाला छिड़कें",tm:60},{t:"Serve",i:"लेमन वेज + हरी चटनी + प्याज सलाद के साथ",tm:60}]},
      {n:"Soya Chaap Malai",sub:"Veg",steps:[{t:"Marination",i:"सोया चाप क्रीम + काजू पेस्ट + इलायची + मसाला में 1 घंटे मैरिनेट करें",tm:3600},{t:"Tandoor",i:"तंदूर में 8-10 मिनट पकाएं",tm:600,ccp:"अंदर नरम, बाहर हल्के धब्बे"},{t:"Serve",i:"मक्खन लगाकर हरी चटनी के साथ",tm:60}]},
      {n:"Dahi Ke Sholay",sub:"Veg",steps:[{t:"Filling prep",i:"हंग दही + हरी मिर्च + धनिया + मसाला मिलाएं",tm:300},{t:"Assembly",i:"ब्रेड क्रस्ट में भरावन भरें, बंद करें",tm:600},{t:"Frying",i:"170°C तेल में सुनहरा तलें",tm:600,ccp:"अंदर ठंडा दही — बाहर गर्म क्रस्ट"},{t:"Serve",i:"तुरंत गर्म परोसें",tm:60,ccp:"तुरंत सर्व — ठंडे होने पर नरम"}]},
      {n:"Golden Coin",sub:"Veg",steps:[{t:"Topping prep",i:"पनीर + कॉर्न + शिमला मिर्च + मसाला टॉपिंग बनाएं",tm:300},{t:"Assembly",i:"ब्रेड डिस्क पर टॉपिंग लगाएं",tm:300},{t:"Frying",i:"170°C तेल में हल्का तलें या बेक करें",tm:600,ccp:"ज्यादा न तलें — रंग सुनहरा"},{t:"Serve",i:"सॉस के साथ तुरंत सर्व",tm:60}]},
      {n:"Veg Galauti",sub:"Veg",steps:[{t:"Mesa",i:"कच्चा केला + आलू उबालकर मैश करें, बारीक पीसें",tm:1200},{t:"Mixing",i:"खोया + गलौटी मसाला + इत्र मिलाएं, मुलायम होने तक गूंधें",tm:600,ccp:"मिश्रण बिल्कुल चिकना हो"},{t:"Shaping",i:"पतले गोल कटलेट आकार दें",tm:300},{t:"Cooking",i:"तवे पर घी डालकर दोनों तरफ हल्के हाथ से पकाएं",tm:480,ccp:"बहुत नाजुक है — धीरे पलटें"},{t:"Serve",i:"उल्टे तवे पर सर्व, रुमाली रोटी + प्याज सलाद के साथ",tm:60}]},
      {n:"Mushroom Galauti",sub:"Veg",steps:[{t:"Mesa",i:"मशरूम बारीक काटें, पानी सुखाएं",tm:900,ccp:"नमी पूरी निकले — नहीं तो बिखरेगा"},{t:"Mixing",i:"उबला आलू + खोया + गलौटी मसाला मिलाएं",tm:600},{t:"Cooking",i:"तवे पर घी में पतला फैलाकर पकाएं",tm:480,ccp:"बहुत नाजुक — धीरे पलटें"},{t:"Serve",i:"रुमाली रोटी के साथ",tm:60}]},
      {n:"Tandoori Broccoli",sub:"Veg",steps:[{t:"Marination",i:"ब्रोकली दही + मसाला + सरसों तेल में 30 मिनट मैरिनेट",tm:1800},{t:"Tandoor",i:"तंदूर में 6-8 मिनट पकाएं",tm:450,ccp:"ज्यादा न पकाएं — क्रंची रहे"},{t:"Serve",i:"चाट मसाला + लेमन + चटनी",tm:60}]},
      {n:"Chicken Seekh Kebab",sub:"Non-Veg",steps:[{t:"Mesa",i:"कीमा बारीक पीसें, प्याज-अदरक-लहसुन बारीक काटें, पानी निकालें",tm:900,ccp:"कीमे में नमी न हो"},{t:"Mixing",i:"कीमा + मसाले + धनिया + हरी मिर्च + कच्चा पपीता पेस्ट मिलाएं",tm:600},{t:"Shaping",i:"सींक पर बराबर लंबाई में लपेटें",tm:600},{t:"Tandoor",i:"तंदूर में 12-15 मिनट पकाएं, बीच में पलटें",tm:840,ccp:"चिकन 74°C — कच्चा न रहे"},{t:"Serve",i:"मक्खन लगाकर, प्याज + नींबू के साथ",tm:60}]},
      {n:"Mutton Seekh Kebab",sub:"Non-Veg",steps:[{t:"Mesa",i:"मटन कीमा + पपीता पेस्ट + मसाले मिलाएं, 2 घंटे रखें",tm:7200,ccp:"पपीता पेस्ट मटन को नरम करता है"},{t:"Shaping",i:"सींक पर मोटा आकार दें",tm:600},{t:"Tandoor",i:"तंदूर में 15-18 मिनट — बीच में पलटें, घी लगाएं",tm:1080,ccp:"मटन 71°C — अंदर तक पका हो"},{t:"Serve",i:"घी + चाट मसाला + प्याज + नींबू",tm:60}]},
      {n:"Tangri Kebab",sub:"Non-Veg",steps:[{t:"Marination",i:"चिकन टांग में गहरे cuts लगाएं, दोहरी मैरिनेट — 6-8 घंटे",tm:25200,ccp:"6-8 घंटे मैरिनेशन जरूरी"},{t:"Tandoor",i:"तंदूर में 18-22 मिनट — बीच में पलटें, मक्खन लगाएं",tm:1200,ccp:"चिकन 74°C — हड्डी के पास भी पका हो"},{t:"Serve",i:"मक्खन, चाट मसाला, सलाद के साथ",tm:60}]},
      {n:"Murgh Malai Tikka",sub:"Non-Veg",steps:[{t:"Marination",i:"चिकन को क्रीम + चीज़ + इलायची + सफ़ेद मसाला में 4-6 घंटे मैरिनेट",tm:21600,ccp:"कम से कम 4 घंटे"},{t:"Tandoor",i:"250°C तंदूर में 12-15 मिनट",tm:840,ccp:"चिकन 74°C — सफेद रंग बना रहे"},{t:"Serve",i:"मक्खन, सलाद, हरी चटनी के साथ",tm:60}]},
      {n:"Chicken Tikka",sub:"Non-Veg",steps:[{t:"Marination",i:"चिकन दही + कश्मीरी मिर्च + मसाला में 4-6 घंटे",tm:21600,ccp:"कम से कम 4 घंटे"},{t:"Tandoor",i:"250°C तंदूर में 12-15 मिनट, धब्बे पड़ने दें",tm:840,ccp:"चिकन 74°C"},{t:"Serve",i:"नींबू + प्याज + हरी चटनी",tm:60}]},
      {n:"Fish Tikka",sub:"Non-Veg",steps:[{t:"Marination",i:"मछली के टुकड़े + दही + अजवाइन + मसाला — 30 मिनट",tm:1800},{t:"Skewering",i:"सींक में लगाएं, सब्ज़ियों के साथ",tm:180},{t:"Tandoor",i:"250°C में 8-10 मिनट — मछली नाजुक होती है",tm:540,ccp:"मछली 63°C — ज्यादा न पकाएं वरना बिखरेगी"},{t:"Serve",i:"नींबू + चाट मसाला + पुदीना चटनी",tm:60}]},
      {n:"Mint Chutney",sub:"Veg",steps:[{t:"Blend",i:"पुदीना + धनिया + हरी मिर्च + अदरक + नींबू रस + थोड़ा पानी — पीस लें",tm:180},{t:"Adjust",i:"नमक + काला नमक एडजस्ट करें",tm:60},{t:"Serve",i:"ताज़ी परोसें या ठंडा करके रखें",tm:60,ccp:"1 घंटे से ज्यादा न रखें — रंग काला पड़ता है"}]},
      {n:"Naan",sub:"Bread",steps:[{t:"Dough",i:"मैदा + दही + नमक + बेकिंग पाउडर + पानी — नरम आटा, 30 मिनट आराम",tm:2100},{t:"Roll",i:"तिकोना या गोल बेलें, लहसुन/तिल ऑप्शन",tm:60},{t:"Tandoor",i:"तंदूर की दीवार पर थपकाएं, 2-3 मिनट",tm:150,ccp:"फूलना चाहिए — तंदूर गर्म हो"},{t:"Serve",i:"मक्खन लगाकर गर्म परोसें",tm:30}]}
    ],
    chinese:[
      {n:"Honey Chilli Potatoes",sub:"Veg",steps:[{t:"Prep",i:"आलू फिंगर कट — कॉर्नफ्लोर + नमक बेटर में कोट",tm:1200},{t:"Frying",i:"175-180°C तेल में कुरकुरा तलें",tm:1500,ccp:"तेल 175-180°C — कुरकुरा बने"},{t:"Sauce",i:"वॉक में लहसुन + अदरक भूनें, टोमैटो + चिली सॉस + शहद डालें",tm:480},{t:"Toss",i:"तले आलू डालकर तेज़ आंच पर टॉस करें, तिल + स्प्रिंग अनियन",tm:180,ccp:"शहद आखिर में — जलने से बचाएं"},{t:"Serve",i:"तुरंत सर्व करें",tm:60,ccp:"तुरंत सर्व — ठंडे होने पर नरम"}]},
      {n:"Schezwan Mushroom",sub:"Veg",steps:[{t:"Prep",i:"मशरूम कॉर्नफ्लोर में कोट करें",tm:300},{t:"Fry",i:"170°C तेल में तलें",tm:600,ccp:"ज्यादा न तलें — नमी रहे"},{t:"Sauce",i:"वॉक में लहसुन + शिमला मिर्च + स्चेज़वान सॉस डालें",tm:480},{t:"Toss",i:"मशरूम डालकर टॉस करें, स्प्रिंग अनियन",tm:180},{t:"Serve",i:"तुरंत सर्व",tm:60}]},
      {n:"Chilli Paneer",sub:"Veg",steps:[{t:"Prep",i:"पनीर क्यूब कॉर्नफ्लोर + सोया मैरिनेट में डुबोएं",tm:600},{t:"Fry",i:"170°C में सुनहरा तलें",tm:600,ccp:"पनीर मुलायम रहे — ज्यादा न तलें"},{t:"Sauce",i:"लहसुन + प्याज + शिमला मिर्च + सोया + विनेगर + चिली सॉस",tm:480},{t:"Toss",i:"पनीर डालकर टॉस करें",tm:180},{t:"Serve",i:"स्प्रिंग अनियन से गार्निश, तुरंत सर्व",tm:60}]},
      {n:"Veg Spring Roll",sub:"Veg",steps:[{t:"Filling",i:"सब्ज़ी + नूडल्स + सोया + मसाला — स्टर फ्राई करें, ठंडा करें",tm:900},{t:"Roll",i:"शीट पर भरावन रखें, कसकर रोल करें, मैदा-पानी से सील करें",tm:600},{t:"Fry",i:"175°C में कुरकुरा सुनहरा तलें",tm:480,ccp:"तेल 175°C — सील मजबूत हो नहीं तो खुलेगा"},{t:"Serve",i:"चिली सॉस + स्वीट चिली के साथ",tm:60}]},
      {n:"Veg Momos",sub:"Veg",steps:[{t:"Dough",i:"मैदा + नमक + पानी — कड़क आटा, 20 मिनट आराम",tm:1800},{t:"Filling",i:"पत्तागोभी + गाजर + प्याज + सोया + मसाला भरावन",tm:600},{t:"Shaping",i:"पतली पूरी बेलें, भरें, प्लीट बनाएं",tm:900,ccp:"प्लीट कसी हों — भाप में खुले नहीं"},{t:"Steam",i:"10-12 मिनट भाप में पकाएं",tm:720,ccp:"पूरी तरह पका हो — पारदर्शी दिखे"},{t:"Serve",i:"मोमो चटनी / स्चेज़वान के साथ",tm:60}]},
      {n:"Green Thai Curry Veg",sub:"Veg",steps:[{t:"Paste",i:"ग्रीन थाई पेस्ट + लेमनग्रास + कफ़िर लाइम भूनें",tm:300},{t:"Coconut milk",i:"नारियल दूध डालें, उबालें",tm:600},{t:"Vegetables",i:"सब्ज़ियां डालें, 10 मिनट पकाएं",tm:600,ccp:"सब्ज़ी क्रंची रहे"},{t:"Season",i:"फिश सॉस (veg: soy) + गुड़/चीनी + नींबू रस",tm:180},{t:"Serve",i:"स्टीम्ड राइस के साथ",tm:60}]},
      {n:"Chicken Red Thai Curry",sub:"Non-Veg",steps:[{t:"Paste",i:"रेड थाई पेस्ट + तेल में भूनें",tm:300},{t:"Chicken",i:"चिकन डालें, सील करें",tm:600,ccp:"चिकन 74°C"},{t:"Coconut milk",i:"नारियल दूध डालें, 15 मिनट सिमर",tm:900},{t:"Season",i:"फिश सॉस + गुड़ + बेसिल + नींबू रस",tm:180},{t:"Serve",i:"जैस्मीन राइस के साथ",tm:60}]},
      {n:"Veg Hakka Noodles",sub:"Veg",steps:[{t:"Boil noodles",i:"नूडल्स al dente उबालें, ठंडे पानी से धोएं, तेल लगाएं",tm:480,ccp:"ओवरकुक नहीं — चिपकेंगे"},{t:"Stir fry",i:"वॉक में तेल + सब्ज़ियां हाई फ्लेम पर भूनें",tm:300},{t:"Noodles",i:"नूडल्स + सोया + विनेगर + सॉस + काली मिर्च टॉस करें",tm:300,ccp:"हाई फ्लेम — तेज़ आंच पर 2 मिनट"},{t:"Serve",i:"स्प्रिंग अनियन + चिली सॉस",tm:60}]},
      {n:"Garlic Onion Fried Rice",sub:"Veg",steps:[{t:"Rice prep",i:"चावल पहले पकाएं, ठंडा करें — ताज़ा चावल नहीं",tm:1800,ccp:"चावल एकदम ठंडा हो — नहीं तो चिपकेगा"},{t:"Stir fry",i:"वॉक में तेल + लहसुन + प्याज हाई फ्लेम पर भूनें",tm:300},{t:"Add rice",i:"ठंडा चावल डालें, तेज आंच पर टॉस करें",tm:300,ccp:"हाई फ्लेम — wok hei के लिए"},{t:"Season",i:"सोया सॉस + काली मिर्च + नमक + सिरका",tm:120},{t:"Serve",i:"स्प्रिंग अनियन से गार्निश",tm:60}]}
    ],
    beverages:[
      {n:"Green Tea",sub:"Hot",steps:[{t:"Heat water",i:"पानी 80°C तक गरम करें — उबलता पानी नहीं",tm:180,ccp:"80°C — उबलते पानी में ग्रीन टी कड़वी होती है"},{t:"Steep",i:"टी बैग डालें — ठीक 2-3 मिनट",tm:150,ccp:"3 मिनट से ज्यादा नहीं — कसैला होगा"},{t:"Finish",i:"शहद + नींबू रस मिलाएं",tm:30},{t:"Serve",i:"सॉसर में रखकर ताज़ा सर्व करें",tm:30,ccp:"हर बार ताज़ा बनाएं — बैच ब्रू न करें"}]},
      {n:"Masala Chai",sub:"Hot",steps:[{t:"Spice prep",i:"अदरक कुचलें, इलायची फोड़ें, दालचीनी तोड़ें",tm:120},{t:"Boil",i:"पानी + मसाले उबालें, 3-4 मिनट सिमर",tm:360},{t:"Tea",i:"चाय पत्ती डालें, 1 मिनट",tm:60,ccp:"ज्यादा न उबालें — कसैली होगी"},{t:"Milk",i:"दूध डालें, उबाल आने दें, 2 मिनट",tm:180},{t:"Strain + serve",i:"छानकर कुल्हड़ में तुरंत सर्व",tm:30,ccp:"15 मिनट से ज्यादा न रखें — दोबारा उबाली चाय का स्वाद जाता है"}]},
      {n:"Virgin Mojito",sub:"Mocktail",steps:[{t:"Muddle",i:"ग्लास में नींबू + पुदीना + शुगर सिरप मडल करें",tm:60},{t:"Ice",i:"क्रश्ड बर्फ भरें",tm:30},{t:"Top up",i:"सोडा भरें, हल्के से स्टिर करें",tm:30},{t:"Garnish",i:"पुदीना + नींबू वेज",tm:30,ccp:"तुरंत सर्व — सोडा फ्लैट होता है"}]},
      {n:"Jaljeera",sub:"Mocktail",steps:[{t:"Base prep",i:"जलजीरा मसाला + इमली पानी + पुदीना + ब्लैक सॉल्ट पेस्ट बनाएं",tm:300},{t:"Mix",i:"ठंडे पानी में बेस मिलाएं, स्वाद एडजस्ट करें",tm:120},{t:"Serve",i:"बर्फ के साथ छोटे गिलास में, पुदीना + बूंदी गार्निश",tm:60}]},
      {n:"Shikanji",sub:"Mocktail",steps:[{t:"Mix",i:"नींबू रस + चीनी + काला नमक + भुना जीरा पाउडर मिलाएं",tm:60},{t:"Water",i:"ठंडा पानी + बर्फ डालें",tm:30},{t:"Serve",i:"पुदीना पत्ते से गार्निश",tm:30}]},
      {n:"Mango Michelada",sub:"Mocktail",steps:[{t:"Rim glass",i:"ग्लास रिम पर चिली सॉल्ट लगाएं",tm:30},{t:"Mix",i:"आम प्यूरी + नींबू रस + मसाला + बर्फ मिलाएं",tm:60},{t:"Top up",i:"सोडा डालें",tm:30},{t:"Serve",i:"आम के टुकड़े + नींबू से गार्निश",tm:30}]},
      {n:"Spicy Jamun Shots",sub:"Mocktail",steps:[{t:"Mix",i:"जामुन प्यूरी + नींबू रस + जलजीरा पाउडर + काला नमक मिलाएं",tm:60},{t:"Chill",i:"बर्फ के साथ शेक करें",tm:30},{t:"Serve",i:"शॉट ग्लास में — रिम पर चाट मसाला",tm:30}]},
      {n:"Caribbean Citrus Cooler",sub:"Mocktail",steps:[{t:"Mix",i:"संतरे का रस + अनानास रस + नींबू रस + ग्रेनाडाइन मिलाएं",tm:60},{t:"Ice",i:"ग्लास में बर्फ भरें",tm:20},{t:"Top",i:"सोडा डालें",tm:20},{t:"Garnish",i:"संतरे की स्लाइस + पुदीना",tm:30}]}
    ],
    indian:[
      {n:"Paneer Lababdar",sub:"Veg",steps:[{t:"Mesa",i:"टमाटर-काजू पेस्ट तैयार करें। प्याज़ बारीक काटें। सभी मसाले मापकर रखें।",tm:900},{t:"Gravy base",i:"तेल+मक्खन गरम करें, प्याज़ सुनहरा भूनें, अदरक-लहसुन पेस्ट डालें",tm:900,ccp:"प्याज़ हल्का सुनहरा हो"},{t:"Paste + cook",i:"टमाटर-काजू पेस्ट डालें, खोया+चीज़ मिलाएं, तेल अलग होने तक पकाएं",tm:900},{t:"Cream + paneer",i:"दूध+क्रीम डालें, पनीर के टुकड़े मिलाएं",tm:600,ccp:"लगातार चलाएं — फटे नहीं"},{t:"Finishing",i:"गरम मसाला, कसूरी मेथी, चीनी, हरा धनिया डालें। नमक एडजस्ट करें।",tm:300},{t:"Garnish",i:"ऊपर से क्रीम स्वर्ल, मक्खन और हरा धनिया",tm:120}]},
      {n:"Dal-E-Ambria",sub:"Veg",steps:[{t:"Soaking",i:"उड़द+मूंग दाल धोकर रात भर (8-10 घंटे) भिगोएं",tm:36000},{t:"Pressure cook",i:"भीगी दाल को नमक+हल्दी के साथ 7-8 सीटी तक उबालें, मैश करें",tm:3600,ccp:"दाल पूरी तरह गली हो"},{t:"Tadka base",i:"तेल+मक्खन गरम करें, प्याज़ सुनहरा भूनें, अदरक-लहसुन पेस्ट+मसाले भूनें",tm:900},{t:"Slow cook",i:"दाल को तड़के में मिलाएं, धीमी आंच पर 30-40 मिनट पकाएं",tm:2400,ccp:"लगातार चलाएं — नीचे न लगे"},{t:"Finishing",i:"फ्रेश क्रीम, मक्खन, कसूरी मेथी डालें। नमक एडजस्ट करें।",tm:300,ccp:"क्रीम आखिर में — फटे नहीं"},{t:"Garnish",i:"मक्खन का टुकड़ा, क्रीम स्वर्ल, हरा धनिया",tm:120}]},
      {n:"Palak Paneer",sub:"Veg",steps:[{t:"Mesa",i:"पालक धोकर ब्लांच करें, बर्फ के पानी में डालें, पीस लें",tm:900},{t:"Gravy base",i:"तेल+घी में प्याज़ भूनें, अदरक-लहसुन+टमाटर पेस्ट डालें",tm:900},{t:"Palak mix",i:"पालक प्यूरी डालें, मसाले मिलाएं, 10-15 मिनट पकाएं",tm:900,ccp:"ज्यादा न पकाएं — रंग बना रहे"},{t:"Paneer add",i:"पनीर टुकड़े डालें, 5 मिनट धीमी आंच पर पकाएं",tm:300},{t:"Finishing",i:"क्रीम, कसूरी मेथी, गरम मसाला डालें",tm:180}]},
      {n:"Diwan-e-Handi",sub:"Veg",steps:[{t:"Mesa",i:"सब्ज़ियां काटें, पनीर क्यूब करें, काजू भिगोकर पेस्ट बनाएं",tm:900},{t:"Gravy",i:"प्याज़ सुनहरा भूनें, टमाटर+काजू पेस्ट डालें, पकाएं",tm:900},{t:"Cooking",i:"सब्ज़ियां+पनीर डालें, क्रीम मिलाएं, ढककर दम पर पकाएं",tm:1200,ccp:"सब्ज़ी गली न हो"},{t:"Finishing",i:"गरम मसाला, कसूरी मेथी, घी डालें",tm:180}]},
      {n:"Malai Kofta",sub:"Veg",steps:[{t:"Kofta prep",i:"पनीर+आलू+मेवा मिलाकर गोले बनाएं, ठंडा करें",tm:1200},{t:"Frying",i:"गोले गरम तेल में सुनहरे तलें",tm:900,ccp:"तेल 160°C — धीमी आंच"},{t:"Gravy",i:"प्याज़-काजू-टमाटर ग्रेवी बनाएं, क्रीम+खोया मिलाएं",tm:1200},{t:"Assembly",i:"सर्विंग बाउल में ग्रेवी डालें, कोफ़्ते ऊपर रखें",tm:300,ccp:"कोफ़्ते ग्रेवी में आखिर में डालें"},{t:"Garnish",i:"क्रीम स्वर्ल, कसूरी मेथी, धनिया",tm:120}]},
      {n:"Dum Aloo Kashmiri",sub:"Veg",steps:[{t:"Mesa",i:"आलू उबालें, छीलें, चाकू से चीरा लगाएं",tm:1800},{t:"Frying",i:"आलू तलें जब तक सुनहरे हों",tm:900,ccp:"बाहर कुरकुरे, अंदर नरम"},{t:"Gravy",i:"दही+कश्मीरी मसाला ग्रेवी बनाएं",tm:900},{t:"Dum cook",i:"आलू ग्रेवी में डालें, ढककर दम पर 20 मिनट पकाएं",tm:1200,ccp:"आलू में मसाला अंदर तक जाए"},{t:"Finishing",i:"केसर दूध, गरम मसाला, धनिया डालें",tm:180}]},
      {n:"Kadhi Pakoda",sub:"Veg",steps:[{t:"Pakoda batter",i:"बेसन+प्याज़+पालक+मसाले मिलाकर घोल बनाएं",tm:600},{t:"Fry pakodas",i:"गरम तेल में पकोड़े सुनहरे तलें",tm:900,ccp:"तेल 180°C"},{t:"Kadhi prep",i:"बेसन+दही का घोल फेंटें, उबालें, 20 मिनट पकाएं",tm:1500},{t:"Assembly",i:"पकोड़े कढ़ी में डालें, 10 मिनट सिमर करें",tm:600},{t:"Tadka",i:"घी में जीरा+करी पत्ता+सूखी मिर्च का तड़का लगाएं",tm:180}]},
      {n:"Amritsari Pindi Choley",sub:"Veg",steps:[{t:"Soaking",i:"छोले रात भर टी बैग के साथ भिगोएं",tm:36000},{t:"Pressure cook",i:"छोले प्रेशर कुकर में नरम होने तक उबालें",tm:2400},{t:"Masala prep",i:"प्याज़ सुनहरा भूनें, टमाटर+छोले मसाला+अमचूर डालें",tm:900},{t:"Cooking",i:"छोले मसाले में मिलाएं, 30 मिनट धीमी आंच पर पकाएं",tm:1800,ccp:"गाढ़ा ग्रेवी बने"},{t:"Garnish",i:"अदरक जुलिएन, हरा धनिया, नींबू",tm:120}]},
      {n:"Sarson Ka Saag",sub:"Veg",steps:[{t:"Blanch greens",i:"सरसों+पालक+बथुआ धोकर उबालें, पीस लें",tm:1800},{t:"Cooking",i:"मक्की आटा मिलाकर धीमी आंच पर 45 मिनट पकाएं",tm:2700,ccp:"लगातार चलाएं"},{t:"Tadka",i:"घी में लहसुन+अदरक+सूखी मिर्च का तड़का",tm:300},{t:"Finishing",i:"मक्खन का टुकड़ा ऊपर, मक्की रोटी के साथ सर्व",tm:120}]},
      {n:"Butter Chicken",sub:"Non-Veg",steps:[{t:"Marination",i:"चिकन को दही+मसाले में 4 घंटे मैरिनेट करें",tm:14400},{t:"Tandoor cook",i:"तंदूर/ग्रिल में चिकन पकाएं",tm:900,ccp:"अंदर का तापमान 74°C"},{t:"Makhani gravy",i:"टमाटर-काजू ग्रेवी बनाएं, मक्खन+क्रीम मिलाएं",tm:1200},{t:"Combine",i:"तंदूरी चिकन ग्रेवी में मिलाएं, 15 मिनट सिमर",tm:900},{t:"Finishing",i:"शहद, क्रीम, कसूरी मेथी डालें",tm:180}]},
      {n:"Mutton Beliram",sub:"Non-Veg",steps:[{t:"Mesa",i:"मटन धोकर साफ करें, प्याज़ बारीक काटें, मसाले तैयार रखें",tm:900},{t:"Sear mutton",i:"तेल में मटन सील करें, प्याज़ भूनें",tm:1200},{t:"Slow cook",i:"दही+मसाले डालें, ढककर 90 मिनट धीमी आंच पर पकाएं",tm:5400,ccp:"मटन अंदर तक गला हो — 71°C"},{t:"Finishing",i:"गरम मसाला, तली प्याज़, हरा धनिया",tm:300}]},
      {n:"Mutton Rogan Josh",sub:"Non-Veg",steps:[{t:"Mesa",i:"मटन साफ करें, कश्मीरी मिर्च भिगोकर पेस्ट बनाएं",tm:900},{t:"Brown mutton",i:"तेल में मटन भूनें, प्याज़+अदरक-लहसुन डालें",tm:1200},{t:"Slow cook",i:"दही+रोगन जोश मसाला डालें, 90 मिनट धीमी आंच पर पकाएं",tm:5400,ccp:"मटन गला हो — 71°C"},{t:"Finishing",i:"गरम मसाला, केसर, हरा धनिया",tm:180}]},
      {n:"Murgh Lababdar",sub:"Non-Veg",steps:[{t:"Marination",i:"चिकन दही+मसाले में 2 घंटे मैरिनेट करें",tm:7200},{t:"Gravy prep",i:"टमाटर-काजू ग्रेवी बनाएं",tm:900},{t:"Cook chicken",i:"मैरिनेटेड चिकन पकाएं, ग्रेवी डालें, 20 मिनट सिमर",tm:1200,ccp:"चिकन 74°C"},{t:"Finishing",i:"क्रीम, शिमला मिर्च, कसूरी मेथी डालें",tm:300}]},
      {n:"Hyderabadi Subz Biryani",sub:"Veg",steps:[{t:"Rice prep",i:"चावल धोकर 30 मिनट भिगोएं, 70% उबालें",tm:2400},{t:"Masala prep",i:"सब्ज़ी+दही+बिरयानी मसाला ग्रेवी बनाएं",tm:1200},{t:"Layering",i:"हांडी में ग्रेवी → चावल → तली प्याज़ → केसर दूध लेयर करें",tm:600},{t:"Dum cook",i:"आटे से सील कर 45 मिनट दम दें",tm:2700,ccp:"धीमी आंच — चावल न टूटे"},{t:"Serve",i:"गेंती मारें, रायता+मिर्च सलन के साथ सर्व",tm:300}]},
      {n:"Mirch Ka Salan",sub:"Veg",steps:[{t:"Mesa",i:"मिर्च धोकर चीरा लगाएं, मूंगफली+तिल+नारियल भूनकर पीस लें",tm:900},{t:"Fry chillies",i:"तेल में मिर्च हल्की भूनें",tm:600},{t:"Gravy",i:"प्याज़ भूनें, पेस्ट+इमली+गुड़ डालें, 15 मिनट पकाएं",tm:900},{t:"Combine",i:"मिर्च ग्रेवी में डालें, 10 मिनट सिमर",tm:600}]},
      {n:"Chicken Dum Biryani",sub:"Non-Veg",steps:[{t:"Marination",i:"चिकन दही+बिरयानी मसाला+कश्मीरी मिर्च में 4 घंटे मैरिनेट",tm:14400},{t:"Rice prep",i:"चावल धोकर भिगोएं, 70% उबालें, छानें",tm:2400},{t:"Cook chicken",i:"मैरिनेटेड चिकन आधा पकाएं",tm:1200,ccp:"चिकन कच्चा न रहे"},{t:"Layering",i:"हांडी में चिकन → चावल → तली प्याज़ → केसर दूध → घी",tm:600},{t:"Dum cook",i:"आटे से सील कर 45 मिनट दम दें",tm:2700,ccp:"धीमी आंच, चावल न टूटे"},{t:"Serve",i:"गेंती मारकर सर्व — रायता+मिर्च सलन साथ में",tm:300}]},
      {n:"Bhindi Do Pyaza",sub:"Veg",steps:[{t:"Mesa",i:"भिंडी धोकर सुखाएं, काटें। प्याज़ रिंग्स काटें।",tm:900,ccp:"भिंडी पूरी सूखी हो"},{t:"Fry bhindi",i:"तेल में भिंडी कुरकुरी तलें",tm:1200,ccp:"चिपचिपी न हो"},{t:"Masala",i:"प्याज़ भूनें, मसाले+टमाटर डालें",tm:600},{t:"Combine",i:"तली भिंडी मसाले में मिलाएं, 5 मिनट पकाएं",tm:300}]},
      {n:"Gobhi Masala",sub:"Veg",steps:[{t:"Mesa",i:"गोभी फूल तोड़ें, धोएं। प्याज़-टमाटर काटें।",tm:600},{t:"Fry gobhi",i:"गोभी हल्की तलें या तवे पर भूनें",tm:900},{t:"Masala",i:"प्याज़ भूनें, टमाटर+मसाले डालें, पकाएं",tm:600},{t:"Cooking",i:"गोभी मसाले में मिलाएं, ढककर 10 मिनट पकाएं",tm:600,ccp:"गोभी गली न हो"},{t:"Finishing",i:"गरम मसाला, हरा धनिया, हरी मिर्च",tm:120}]},
      {n:"Aloo Methi",sub:"Veg",steps:[{t:"Mesa",i:"आलू उबालकर काटें, मेथी धोकर काटें",tm:1200},{t:"Cooking",i:"तेल में जीरा+आलू भूनें, मेथी+मसाले डालें",tm:900},{t:"Finish",i:"ढककर 10 मिनट धीमी आंच, अमचूर+गरम मसाला",tm:600}]},
      {n:"Subz Miloni",sub:"Veg",steps:[{t:"Mesa",i:"सब्ज़ियां काटें (गाजर, बीन्स, मटर, शिमला मिर्च)",tm:900},{t:"Gravy",i:"प्याज़ भूनें, टमाटर+मसाले डालें, पकाएं",tm:900},{t:"Cooking",i:"सब्ज़ियां डालें, ढककर 15 मिनट पकाएं",tm:900,ccp:"सब्ज़ी क्रंची रहे"},{t:"Finishing",i:"क्रीम, गरम मसाला, धनिया",tm:180}]},
      {n:"Dhaba Chicken",sub:"Non-Veg",steps:[{t:"Mesa",i:"चिकन साफ करें, प्याज़-टमाटर काटें",tm:600},{t:"Sear",i:"तेल में चिकन सील करें, निकालें",tm:600,ccp:"बाहर सुनहरा"},{t:"Masala",i:"प्याज़ गहरा भूनें, टमाटर+ढाबा मसाला डालें",tm:900},{t:"Cook",i:"चिकन वापस डालें, 25 मिनट पकाएं",tm:1500,ccp:"चिकन 74°C"},{t:"Finishing",i:"कसूरी मेथी, घी, धनिया",tm:180}]},
      {n:"Egg Curry",sub:"Non-Veg",steps:[{t:"Boil eggs",i:"अंडे उबालें, छीलें, चाकू से चीरा लगाएं",tm:900},{t:"Gravy",i:"प्याज़ भूनें, टमाटर+मसाले डालें, ग्रेवी बनाएं",tm:900},{t:"Combine",i:"अंडे ग्रेवी में डालें, 10 मिनट सिमर",tm:600},{t:"Finishing",i:"गरम मसाला, धनिया",tm:120}]},
      {n:"Dal Tarka",sub:"Veg",steps:[{t:"Wash + cook",i:"दाल धोकर प्रेशर कुकर में नरम उबालें",tm:2400},{t:"Mash",i:"दाल मैश करें, पानी से कंसिस्टेंसी एडजस्ट",tm:300},{t:"Tadka",i:"घी में जीरा+लहसुन+सूखी मिर्च+करी पत्ता+प्याज़ तड़का",tm:600},{t:"Combine",i:"तड़का दाल में डालें, 10 मिनट उबालें",tm:600},{t:"Garnish",i:"हरा धनिया, नींबू रस",tm:60}]},
      {n:"Steamed Rice",sub:"Veg",steps:[{t:"Wash + soak",i:"चावल धोकर 20 मिनट भिगोएं",tm:1200},{t:"Boil",i:"पानी+नमक+तेज पत्ता में चावल उबालें",tm:900,ccp:"चावल खिले-खिले — ओवरकुक न हो"},{t:"Drain + steam",i:"छानें, 5 मिनट दम दें",tm:300},{t:"Finishing",i:"जीरा घी का तड़का, धनिया गार्निश",tm:180}]},
      {n:"Fish Goan Curry",sub:"Non-Veg",steps:[{t:"Mesa",i:"मछली साफ करें, टुकड़े करें, नमक+हल्दी लगाएं",tm:600},{t:"Masala",i:"प्याज़+लहसुन भूनें, नारियल+कश्मीरी मिर्च पेस्ट डालें",tm:900},{t:"Gravy",i:"नारियल दूध+इमली पानी डालें, 10 मिनट उबालें",tm:600},{t:"Cook fish",i:"मछली ग्रेवी में डालें, 10 मिनट सिमर",tm:600,ccp:"मछली 63°C — ज्यादा न पकाएं"},{t:"Finishing",i:"करी पत्ता, धनिया, नींबू रस",tm:120}]}
    ],
    sweets:[
      {n:"Gajar Ka Halwa",sub:"Hot",steps:[{t:"Mesa",i:"गाजर धोकर छीलें और कद्दूकस करें",tm:900},{t:"Cooking",i:"कढ़ाही में कसी गाजर + दूध डालें, मध्यम आँच पर 30-35 मिनट पकाएं",tm:2100,ccp:"बीच-बीच में चलाते रहें"},{t:"Sugar",i:"दूध गाढ़ा होने पर चीनी डालें, लगातार चलाएं",tm:600},{t:"Ghee roast",i:"घी डालकर धीमी आँच पर भूनें जब तक घी अलग न हो जाए",tm:900,ccp:"जलने न दें"},{t:"Khoya",i:"खोया डालकर अच्छे से मिक्स करें",tm:300},{t:"Garnish",i:"काजू, इलायची पाउडर डालें, अंतिम बार भूनें",tm:180,ccp:"टेक्सचर स्मूद और चमकदार हो"}]},
      {n:"Moong Dal Halwa",sub:"Hot",steps:[{t:"Soaking",i:"मूंग दाल को 10-15 मिनट भिगोएं, दरदरा पीस लें",tm:1200},{t:"Roasting",i:"कढ़ाही में घी गरम करें, पिसी दाल 35-40 मिनट भूनें",tm:2400,ccp:"कच्ची दाल की खुशबू खत्म होनी चाहिए"},{t:"Sugar + water",i:"चीनी और पानी डालें, उबालें, गाढ़ा होने तक पकाएं",tm:1200,ccp:"लगातार चलाते रहें"},{t:"Garnish",i:"काजू और इलायची पाउडर डालकर मिक्स करें",tm:120}]},
      {n:"Anjeer Halwa",sub:"Hot",steps:[{t:"Mesa",i:"अंजीर धोकर बारीक काट लें",tm:600,ccp:"अंजीर ज्यादा सूखे न हों"},{t:"Roasting",i:"कढ़ाही में घी गरम करें, अंजीर धीमी आंच पर भूनें",tm:900},{t:"Khoya",i:"खोया डालें, अच्छी तरह मिलाएं",tm:300,ccp:"हलवा चिपकने न पाए"},{t:"Sugar",i:"चीनी डालकर गाढ़ा होने तक पकाएं",tm:600,ccp:"घी पर्याप्त हो"},{t:"Garnish",i:"इलायची डालकर मिश्रण तैयार करें, पिस्ता से गार्निश",tm:120}]},
      {n:"Apple Halwa",sub:"Hot",steps:[{t:"Mesa",i:"सेब धोकर छीलें और कद्दूकस करें",tm:600},{t:"Cooking",i:"कढ़ाही में घी गरम कर सेब डालें, दूध डालकर नरम होने तक पकाएं",tm:1500,ccp:"सेब जलने न पाए"},{t:"Khoya",i:"मावा डालकर लगातार चलाएं",tm:600,ccp:"लगातार चलाते रहें"},{t:"Sugar",i:"चीनी डालें, गाढ़ा होने दें",tm:600,ccp:"हलवा कढ़ाही न छोड़े"},{t:"Garnish",i:"इलायची, काजू, पिस्ता डालकर मिलाएं",tm:120}]},
      {n:"Mirch Ka Halwa",sub:"Hot",steps:[{t:"Mesa",i:"मिर्च धोकर बीज निकालें और बारीक पीस लें",tm:600},{t:"Cooking",i:"कढ़ाही में घी गरम करें, मिर्च पेस्ट धीमी आंच पर पकाएं",tm:1200,ccp:"मिर्च का कड़वापन न रहे"},{t:"Khoya",i:"खोया डालकर लगातार चलाएं",tm:600,ccp:"मिर्च अच्छी तरह पकनी चाहिए"},{t:"Sugar",i:"चीनी डालें, गाढ़ा करें",tm:600,ccp:"संतुलित मिठास रखें"},{t:"Garnish",i:"इलायची मिलाएं, काजू से गार्निश",tm:120}]},
      {n:"Ghewar",sub:"Hot",steps:[{t:"Batter prep",i:"मैदा में घी डालकर मोयन तैयार करें, दूध से पतला घोल बनाएं",tm:900,ccp:"घोल बहुत गाढ़ा न हो"},{t:"Frying",i:"कढ़ाही में घी गरम करें, ऊँचाई से घोल डालें — जालीदार बने",tm:1200,ccp:"तेल बहुत तेज गरम न हो"},{t:"Syrup",i:"चीनी, पानी, केसर से एक तार की चाशनी बनाएं",tm:600,ccp:"चाशनी एक तार की हो"},{t:"Soaking",i:"तले घेवर को गर्म चाशनी में डुबोकर निकालें",tm:300},{t:"Garnish",i:"पिस्ता और वर्क से गार्निश करें",tm:120}]},
      {n:"Gulab Jamun",sub:"Hot",steps:[{t:"Dough prep",i:"खोया + छैना + मैदा + बेकिंग पाउडर मिलाकर गूंधें, 10 मिनट आराम दें",tm:900,ccp:"मिश्रण में दरार न हो"},{t:"Shaping",i:"समान साइज के चिकने गोले बनाएं",tm:600,ccp:"गोले चिकने हों, दरार न हो"},{t:"Frying",i:"धीमी आंच पर घी में सुनहरे भूरे होने तक तलें (15 मिनट)",tm:900,ccp:"धीमी आंच — 130°C"},{t:"Syrup",i:"चीनी + पानी + इलायची + गुलाब जल से चाशनी बनाएं",tm:600,ccp:"हल्की 1 तार चाशनी"},{t:"Soaking",i:"गरम जामुन गरम चाशनी में 30+ मिनट भिगोएं",tm:1800,ccp:"कम से कम 30 मिनट भिगोएं"}]},
      {n:"Ras Malai",sub:"Cold",steps:[{t:"Chhena prep",i:"दूध उबालकर फाड़ें, छैना निकालें, मलमल में निचोड़ें",tm:1200,ccp:"छैना बिल्कुल स्मूद हो"},{t:"Shaping",i:"छैना से चपटे गोले बनाएं (240 pcs / 200 pax)",tm:600,ccp:"गोले एक समान हों"},{t:"Sugar syrup cook",i:"चीनी-पानी की चाशनी में गोले 15-20 मिनट उबालें",tm:1200,ccp:"गोले फूलने चाहिए"},{t:"Rabri prep",i:"दूध को गाढ़ा करें, केसर + इलायची + चीनी डालें",tm:1800,ccp:"रबड़ी गाढ़ी हो"},{t:"Assembly",i:"उबले गोले रबड़ी में भिगोएं, ठंडा करें",tm:7200,ccp:"कम से कम 2 घंटे ठंडा करें"}]},
      {n:"Gulab Kheer",sub:"Cold",steps:[{t:"Rice prep",i:"चावल भिगोएं और दरदरे पीस लें",tm:1800},{t:"Cooking",i:"दूध उबालें, पिसे चावल डालें, धीमी आंच पर गाढ़ा करें",tm:2400,ccp:"लगातार चलाएं, नीचे न लगे"},{t:"Sugar",i:"चीनी + इलायची + गुलाब जल डालें",tm:180},{t:"Garnish",i:"पिस्ता, बादाम, गुलाब पंखुड़ियों से सजाएं",tm:120},{t:"Chilling",i:"ठंडा करके सर्व करें",tm:3600,ccp:"ठंडा परोसें"}]},
      {n:"Orange Rabri",sub:"Cold",steps:[{t:"Rabri prep",i:"दूध उबालकर गाढ़ा करें, मलाई की परतें बनाएं",tm:2400,ccp:"लगातार चलाएं"},{t:"Orange prep",i:"संतरे छीलें, रस निकालें, छिलके का ज़ेस्ट करें",tm:600},{t:"Mixing",i:"रबड़ी में संतरे का रस + ज़ेस्ट + चीनी मिलाएं",tm:300,ccp:"संतुलित मिठास"},{t:"Garnish",i:"संतरे की फांकों और पिस्ता से सजाएं",tm:120},{t:"Chilling",i:"ठंडा करके सर्व करें",tm:3600}]},
      {n:"Paan Mousse",sub:"Cold",steps:[{t:"Paan prep",i:"पान के पत्ते धोएं, गुलकंद + सौंफ तैयार करें",tm:600,ccp:"पत्ते ताज़े हों"},{t:"Cream whip",i:"क्रीम को फेंटें, पान पेस्ट मिलाएं",tm:600,ccp:"ओवर-व्हिप न करें"},{t:"Assembly",i:"ग्लास में लेयर करें — मूस + गुलकंद + चेरी",tm:600},{t:"Chilling",i:"फ्रिज में 2-3 घंटे सेट करें",tm:10800,ccp:"सेट होना ज़रूरी"},{t:"Garnish",i:"पान के पत्ते और चेरी से गार्निश",tm:120}]},
      {n:"Bread Jam Pudding",sub:"Hot",steps:[{t:"Bread prep",i:"ब्रेड के किनारे काटें, जैम लगाकर लेयर करें",tm:600},{t:"Custard",i:"दूध + अंडे + चीनी + वनीला से कस्टर्ड बनाएं",tm:600,ccp:"गांठ न बने"},{t:"Assembly",i:"ब्रेड लेयर पर कस्टर्ड डालें, 30 मिनट भिगोएं",tm:1800,ccp:"अच्छी तरह भीगे"},{t:"Baking",i:"180°C पर 35-40 मिनट बेक करें",tm:2400,ccp:"ऊपर सुनहरा हो"},{t:"Garnish",i:"आइसिंग शुगर और जैम से सजाएं",tm:120}]},
      {n:"Beetroot Halwa",sub:"Hot",steps:[{t:"Mesa",i:"चुकंदर छीलकर कद्दूकस करें",tm:600,ccp:"रंग बना रहे"},{t:"Cooking",i:"कढ़ाही में घी गरम कर चुकंदर पकाएं, नमी सुखाएं",tm:1200,ccp:"ज्यादा पानी न रहे"},{t:"Khoya",i:"मावा डालकर अच्छी तरह मिलाएं",tm:600},{t:"Sugar",i:"चीनी डालें, गाढ़ा होने दें",tm:600,ccp:"हलवा चमकदार दिखे"},{t:"Garnish",i:"इलायची, काजू, पिस्ता से गार्निश",tm:120}]},
      {n:"Doda Barfi Tart",sub:"Cold",steps:[{t:"Tart base",i:"बिस्किट क्रश करें, बटर मिलाकर मोल्ड में दबाएं",tm:600,ccp:"बेस एक समान हो"},{t:"Filling",i:"दोदा बर्फी + क्रीम + इलायची गरम करें, मिक्स करें",tm:900,ccp:"गांठ न बने"},{t:"Assembly",i:"फिलिंग बेस पर डालें, समतल करें",tm:300},{t:"Chilling",i:"फ्रिज में 3-4 घंटे सेट करें",tm:14400,ccp:"पूरी तरह सेट हो"},{t:"Garnish",i:"पिस्ता, बादाम, वर्क से सजाएं",tm:120}]},
      {n:"Chhena Rajbhog",sub:"Hot",steps:[{t:"Chhena prep",i:"दूध फाड़कर छैना बनाएं, मलमल में निचोड़ें",tm:1200,ccp:"छैना बिल्कुल स्मूद हो"},{t:"Stuffing",i:"केसर + इलायची + मेवा का स्टफिंग तैयार करें",tm:300},{t:"Shaping",i:"छैना से बड़े गोले बनाएं, स्टफिंग भरें",tm:600,ccp:"गोले एक समान हों"},{t:"Syrup cook",i:"चाशनी में 20 मिनट उबालें",tm:1200,ccp:"गोले फूलें"},{t:"Soaking",i:"चाशनी में 2 घंटे भिगोएं, केसर डालें",tm:7200,ccp:"पूरा रंग आए"}]},
      {n:"Chhena Mugi",sub:"Hot",steps:[{t:"Chhena prep",i:"दूध फाड़कर छैना बनाएं, अच्छी तरह मथें",tm:1200},{t:"Shaping",i:"लंबी बेलनाकार आकृति बनाएं",tm:300,ccp:"आकार एक समान"},{t:"Syrup cook",i:"चीनी की चाशनी में 15 मिनट पकाएं",tm:900,ccp:"ज्यादा न पकाएं"},{t:"Garnish",i:"इलायची + पिस्ता से सजाएं",tm:120}]},
      {n:"Chhena Cham-Cham",sub:"Hot",steps:[{t:"Chhena prep",i:"दूध फाड़कर छैना बनाएं, अच्छी तरह गूंधें",tm:1200,ccp:"स्मूद हो"},{t:"Shaping",i:"अंडाकार आकृति बनाएं",tm:300},{t:"Syrup cook",i:"चाशनी में 15-20 मिनट पकाएं",tm:1200,ccp:"फूलने चाहिए"},{t:"Coating",i:"खोया + चीनी + इलायची का मिश्रण लगाएं",tm:300},{t:"Garnish",i:"मेवा और केसर से सजाएं",tm:120}]},
      {n:"Rasgulla",sub:"Cold",steps:[{t:"Chhena prep",i:"दूध उबालकर नींबू रस से फाड़ें, छानें, धोएं",tm:1200,ccp:"छैना बिल्कुल स्मूद मसलें"},{t:"Shaping",i:"छोटे चिकने गोले बनाएं, दरार न आए",tm:600,ccp:"गोले एक समान चिकने हों"},{t:"Sugar syrup",i:"पतली चाशनी बनाएं (चीनी:पानी = 1:2)",tm:300,ccp:"पतली चाशनी"},{t:"Cooking",i:"उबलती चाशनी में गोले डालें, ढककर 15-20 मिनट पकाएं",tm:1200,ccp:"ढक्कन न खोलें, गोले फूलें"},{t:"Chilling",i:"ठंडा करें, चाशनी में ही सर्व करें",tm:3600,ccp:"ठंडा परोसें"}]},
      {n:"Badam Halwa",sub:"Hot",steps:[{t:"Soaking",i:"बादाम 4 घंटे भिगोएं, छीलकर पीस लें",tm:14400,ccp:"पेस्ट बिल्कुल मुलायम हो"},{t:"Roasting",i:"कढ़ाही में घी गरम करें, बादाम पेस्ट धीमी आंच पर भूनें",tm:2400,ccp:"लगातार चलाएं"},{t:"Sugar + milk",i:"चीनी + दूध डालकर गाढ़ा करें",tm:900,ccp:"नीचे न लगे"},{t:"Garnish",i:"केसर + इलायची + मेवा से सजाएं",tm:120}]},
      {n:"Pista Halwa",sub:"Hot",steps:[{t:"Soaking",i:"पिस्ता भिगोएं, छीलकर बारीक पीस लें",tm:7200,ccp:"हरा रंग बना रहे"},{t:"Roasting",i:"घी में पिस्ता पेस्ट धीमी आंच पर भूनें",tm:1800,ccp:"रंग न बदले"},{t:"Sugar",i:"चीनी + इलायची डालकर गाढ़ा करें",tm:600},{t:"Garnish",i:"वर्क + पिस्ता स्लाइस से सजाएं",tm:120}]},
      {n:"Jalebi",sub:"Hot",steps:[{t:"Batter",i:"मैदा + दही + पानी से घोल बनाएं, 12 घंटे फर्मेंट करें",tm:43200,ccp:"घोल बहुत गाढ़ा न हो"},{t:"Syrup",i:"चीनी + पानी + केसर + इलायची से चाशनी बनाएं",tm:600,ccp:"एक तार की चाशनी"},{t:"Frying",i:"गोल आकार में गरम तेल/घी में तलें, सुनहरी कुरकुरी बनाएं",tm:600,ccp:"तेल सही तापमान पर हो"},{t:"Soaking",i:"गरम जलेबी गरम चाशनी में डुबोएं",tm:180,ccp:"गरम-गरम डुबोएं"},{t:"Serve",i:"गरम या ठंडा सर्व करें",tm:60}]},
      {n:"Jalebi Rabri",sub:"Hot",steps:[{t:"Rabri",i:"दूध उबालकर 1/3 गाढ़ा करें, मलाई की परतें बनाएं",tm:3600,ccp:"लगातार चलाएं"},{t:"Jalebi",i:"जलेबी बनाएं — घोल तलें, चाशनी में डुबोएं",tm:1200},{t:"Assembly",i:"जलेबी के ऊपर गरम रबड़ी डालकर सर्व करें",tm:120,ccp:"गरम-गरम सर्व करें"}]},
      {n:"Ghewar Rabri",sub:"Hot",steps:[{t:"Ghewar",i:"घेवर बनाएं — मैदा का घोल तलें, चाशनी में डुबोएं",tm:1800},{t:"Rabri",i:"दूध गाढ़ा करें, केसर + इलायची + चीनी मिलाएं",tm:2400,ccp:"रबड़ी गाढ़ी हो"},{t:"Assembly",i:"घेवर के ऊपर रबड़ी और मेवा डालकर सर्व करें",tm:120}]},
      {n:"Shahi Tukda",sub:"Hot",steps:[{t:"Bread prep",i:"ब्रेड स्लाइस काटें, घी में सुनहरा तलें",tm:600,ccp:"बहुत ज्यादा न तलें"},{t:"Syrup soak",i:"तली ब्रेड को चीनी चाशनी में डुबोएं",tm:300},{t:"Rabri",i:"दूध गाढ़ा करें, केसर + इलायची + चीनी मिलाएं",tm:1800,ccp:"रबड़ी गाढ़ी हो"},{t:"Assembly",i:"ब्रेड पर रबड़ी डालें, मेवा + वर्क से सजाएं",tm:300},{t:"Chilling",i:"ठंडा करके सर्व करें",tm:3600}]},
      {n:"Tilla Kulfi",sub:"Cold",steps:[{t:"Milk reduce",i:"दूध को 1/3 गाढ़ा करें, लगातार चलाएं",tm:3600,ccp:"नीचे न लगे"},{t:"Mixing",i:"चीनी + इलायची + केसर + मेवा मिलाएं",tm:300},{t:"Molding",i:"मोल्ड / कुल्हड़ में भरें",tm:300,ccp:"एक समान भरें"},{t:"Freezing",i:"8-10 घंटे फ्रीज़ करें",tm:36000,ccp:"पूरी तरह जमे"},{t:"Serve",i:"मोल्ड से निकालें, पिस्ता + फालूदा से सजाएं",tm:120}]},
      {n:"Kadai Doodh",sub:"Hot",steps:[{t:"Milk boil",i:"कड़ाही में दूध उबालें, मध्यम आंच पर गाढ़ा करें",tm:2400,ccp:"लगातार चलाएं"},{t:"Dry fruits",i:"बादाम + काजू + पिस्ता कतरकर डालें",tm:300},{t:"Sugar",i:"चीनी + इलायची + केसर मिलाएं",tm:180,ccp:"संतुलित मिठास"},{t:"Serve",i:"कड़ाही में ही गरम सर्व करें, मलाई की परत ऊपर",tm:60,ccp:"गरम परोसें"}]},
      {n:"Phirni",sub:"Cold",steps:[{t:"Rice prep",i:"चावल भिगोएं, दरदरे पीस लें",tm:1800},{t:"Cooking",i:"दूध उबालें, पिसे चावल डालें, गाढ़ा करें",tm:1800,ccp:"गांठ न पड़े"},{t:"Sugar",i:"चीनी + इलायची + केसर मिलाएं",tm:180},{t:"Setting",i:"मिट्टी के शिकोरे में भरें, ठंडा करें",tm:7200,ccp:"सेट होना ज़रूरी"},{t:"Garnish",i:"पिस्ता + बादाम + वर्क से सजाएं",tm:120}]},
      {n:"Fruit Cream",sub:"Cold",steps:[{t:"Fruit prep",i:"मौसमी फल धोकर काटें — सेब, अंगूर, अनार, केला",tm:900,ccp:"ताज़े फल ही हों"},{t:"Cream",i:"क्रीम फेंटें, चीनी + वनीला मिलाएं",tm:600,ccp:"ओवर-व्हिप न करें"},{t:"Assembly",i:"फल क्रीम में मिलाएं, ठंडा करें",tm:300},{t:"Serve",i:"ग्लास / कटोरी में सर्व करें, चेरी से गार्निश",tm:120,ccp:"ठंडा ही सर्व करें"}]},
      {n:"Fruit Custard",sub:"Cold",steps:[{t:"Custard",i:"दूध उबालें, कस्टर्ड पाउडर + चीनी घोलकर मिलाएं",tm:900,ccp:"गांठ न पड़े"},{t:"Cooling",i:"कस्टर्ड ठंडा करें",tm:3600,ccp:"पूरी तरह ठंडा हो"},{t:"Fruit prep",i:"मौसमी फल काटें — सेब, अंगूर, अनार, केला, चीकू",tm:600,ccp:"ताज़े फल"},{t:"Assembly",i:"ठंडे कस्टर्ड में फल मिलाएं",tm:300},{t:"Serve",i:"ठंडा सर्व करें, चेरी से गार्निश",tm:120}]},
      {n:"Kaju Katli",sub:"Dry",steps:[{t:"Cashew prep",i:"काजू बारीक पीस लें (पाउडर)",tm:600,ccp:"ऑयली न हो"},{t:"Syrup",i:"चीनी + पानी से एक तार की चाशनी बनाएं",tm:600,ccp:"सही चाशनी ज़रूरी"},{t:"Cooking",i:"चाशनी में काजू पाउडर + इलायची मिलाएं, गाढ़ा करें",tm:900,ccp:"पतलापन एक समान हो"},{t:"Rolling",i:"घी लगी सतह पर बेलें, वर्क लगाएं",tm:600,ccp:"एक समान मोटाई"},{t:"Cutting",i:"हीरे आकार में काटें",tm:300,ccp:"ठंडा होने पर काटें"}]},
      {n:"Boondi Parfait",sub:"Cold",steps:[{t:"Boondi",i:"बेसन का घोल बनाएं, छन्नी से तेल में बूंदी तलें",tm:900,ccp:"गोल बूंदी बने"},{t:"Syrup soak",i:"चाशनी में बूंदी भिगोएं",tm:600},{t:"Cream/Rabri",i:"क्रीम/रबड़ी तैयार करें",tm:900},{t:"Assembly",i:"ग्लास में लेयर — बूंदी + रबड़ी + ड्राई फ्रूट्स",tm:600},{t:"Chilling",i:"ठंडा करके सर्व करें",tm:3600,ccp:"ठंडा ही सर्व करें"}]},
      {n:"Roller Kulfi",sub:"Cold",steps:[{t:"Base",i:"दूध गाढ़ा करें, कॉर्नफ्लोर + चीनी + इलायची मिलाएं",tm:2400,ccp:"गांठ न पड़े"},{t:"Freezing",i:"ठंडा करें, कुल्फी मशीन / फ्लैट प्लेट पर जमाएं",tm:7200,ccp:"सही तापमान"},{t:"Rolling",i:"स्क्रैपर से रोल बनाएं",tm:300,ccp:"एक समान रोल"},{t:"Garnish",i:"पिस्ता + फालूदा + रबड़ी से सजाएं",tm:120},{t:"Serve",i:"तुरंत सर्व करें",tm:60,ccp:"पिघलने से पहले सर्व करें"}]}
    ],
  },
};

function findRecipeForDish(dishName) {
  if(!dishName || typeof RECIPE_DB === "undefined") return null;
  try {
    const all = RECIPE_DB.cats.flatMap(cat => (RECIPE_DB.recipes[cat.id]||[]).map(r=>({...r,cat})));
    const n   = dishName.toLowerCase().trim();
    return all.find(r=>r.n.toLowerCase()===n)
        || all.find(r=>n.includes(r.n.toLowerCase())||r.n.toLowerCase().includes(n))
        || null;
  } catch(e) { return null; }
}

function getStepsForDish(name) {
  try {
    const r = findRecipeForDish(name);
    if(r && r.steps && r.steps.length) return r.steps.map(s=>({t:s.t||"Step",desc:s.i||"",tm:s.tm||null,ccp:s.ccp||null,d1:!!s.d1}));
  } catch(e){}
  return GENERIC_STEPS;
}

// ─── MAIN APP ─────────────────────────────────────────────────────




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

// ─── PREP PLAN COMPONENT ─────────────────────────────────────────────────

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


export { guessSectionForDish, GENERIC_STEPS, RECIPE_INGREDIENTS, RECIPE_DB, findRecipeForDish, getStepsForDish, fmtT, BEV_RE, getFullSteps, getDishImageUrl };
