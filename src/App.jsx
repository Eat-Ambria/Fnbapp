import React, { useState, useRef, useEffect } from "react";

// ─── INJECT GLOBAL STYLES ──────────────────────────────────────
const LUXURY_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

:root {
  --font-display: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
  --font-body: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --ease-luxury: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}

body { font-family: var(--font-body); }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #0A0908; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 6px; }
::-webkit-scrollbar-thumb:hover { background: #555; }

/* Smooth transitions for all interactive elements */
button, select, input, textarea {
  font-family: var(--font-body) !important;
  transition: all 0.2s var(--ease-luxury) !important;
}
button:hover { filter: brightness(1.08); }
button:active { transform: scale(0.97); filter: brightness(0.95); }

select, input, textarea {
  transition: border-color 0.25s ease, box-shadow 0.25s ease !important;
}
input:focus, select:focus, textarea:focus {
  outline: none !important;
  border-color: #D4B44A !important;
  box-shadow: 0 0 0 3px rgba(212,180,74,.12) !important;
}

/* Animations */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .5; }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes glow {
  0%, 100% { box-shadow: 0 0 8px rgba(212,180,74,.15); }
  50% { box-shadow: 0 0 20px rgba(212,180,74,.3); }
}
@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.015); }
}

.fade-in { animation: fadeIn 0.4s var(--ease-luxury) both; }
.fade-in-up { animation: fadeInUp 0.5s var(--ease-luxury) both; }
.slide-in { animation: slideInRight 0.4s var(--ease-luxury) both; }
`;

if(typeof document!=="undefined"&&!document.getElementById("ambria-luxury-css")){
  const s=document.createElement("style");s.id="ambria-luxury-css";s.textContent=LUXURY_CSS;document.head.appendChild(s);
}


const C = {
  navy:"#08070A",
  wine:"#C9A84C",   wineMid:"#A88B30",  wineBg:"#1A1810",   wineBorder:"#332E1E",
  bg:"#0A0908",     surface:"#131210",   surfaceHover:"#1A1918",
  border:"#252320", borderLight:"#1C1B18",
  text:"#F4F0E4",   muted:"#8E8678",     faint:"#5C5850",
  green:"#3EAA68",  greenBg:"#0E1E16",   greenBorder:"#1A3826",
  red:"#D64040",    redBg:"#1E0E0E",     redBorder:"#381A1A",
  amber:"#D4A843",  amberBg:"#1E1A0E",   amberBorder:"#382E16",
  blue:"#5B8FD0",   blueBg:"#0E1420",    blueBorder:"#1A2E42",
  purple:"#8A70C8", purpleBg:"#120E1E",  purpleBorder:"#281E40",
  teal:"#50B0A0",   tealBg:"#0E1E1A",    tealBorder:"#1A3830",
  gold:"#D4B44A",   goldBg:"#1A1710",    goldBorder:"#38321E",
  cream:"#F4F0E4",  darkCard:"#161514",  darkCardHover:"#1E1D1A",
  shadow:"rgba(0,0,0,.6)",
  glow:"rgba(212,180,74,.08)",
  glass:"rgba(20,18,16,.85)",
};

// ─── AMBRIA MENU PACKAGES ─────────────────────────────────────────
// Source: Official Ambria Cuisines menu PDFs (6 packages)
const MENU_PACKAGES = {
  "Multi-Cuisine Veg": [
    "Jaljeera","Shikanji","Aerated Drinks","Virgin Mojito","Pina Colada","Green Apple Cooler","Jamun Shots",
    "Fresh Fruit Counter",
    "Golgappe with Varieties of Water","Crispy Aloo Tikki (Agra Style)","Moonglet","Bhalla Papdi (Haridwar Style)","Matra Kulcha",
    "Paneer Tikka Shashlik","Ananas Tikka","Tandoori Anardana Aloo","Dahi Ke Sholay","Afghani Malai Chaap","Papad Waala Paneer Tikka","Golden Coin","Chilli Garlic Idli","Honey Chilli Potatoes","Kung Pao Paneer","Cigar Roll","Schezwan Mushroom",
    "Lucknowi Galouti Kabab","Dahi Kabab","Corn Kabab","Hara Bhara Kabab","Dim-sum Station","Bruschetta","Mushroom Vol-au-Vents",
    "Tamatar Dhaniya Ka Shorba","Veg Manchow Soup",
    "Ambria Garden Salad","Aloo Chana Chaat","Healthy Sprout Salad","Waldorf Salad","Corn and Sweet Pepper Salad","Kimchi","Sirka Pyaaz",
    "Paneer Lababdar","Dum Aloo Kashmiri","Gobhi Masala","Diwan-e-Handi","Palak Paneer","Dal-E-Ambria","Malai Kofta","Punjabi Kadhi Pakoda","Amritsari Choley with Kulcha",
    "Assorted Vegetables on Tawa","Dal Tadka with Tawa Phulka","Steamed Rice","Hyderabadi Subz Dum Biryani","Mirchi Ka Salan",
    "Tandoori Roti","Lachha Paratha","Mirchi Paratha","Plain/Butter/Garlic Naan","Missi Roti","Kulcha",
    "Vegetable Hakka Noodles","Garlic Onion Fried Rice","Veg Manchurian Gravy","Pasta Counter",
    "Moong Dal Halwa","Gajar Halwa","Gulab Jamun","Nano Jalebi with Rabri","Bikaneri Ghevar Live",
    "Gulab Kheer","Kesari Rasmalai","Assorted Pastries","Tilla Kulfi","Ice Cream Parlour","Assorted Tea / Coffee",
  ],
  "Multi-Cuisine Non-Veg": [
    "Jaljeera","Shikanji","Aerated Drinks","Virgin Mojito","Green Apple Cooler","Jamun Shots",
    "Fresh Fruit Counter",
    "Golgappe with Varieties of Water","Crispy Aloo Tikki","Moonglet","Bhalla Papdi","Matra Kulcha",
    "Paneer Tikka Shashlik","Ananas Tikka","Dahi Ke Sholay","Afghani Malai Chaap","Golden Coin","Honey Chilli Potatoes","Cigar Roll","Schezwan Mushroom",
    "Murgh Malai Tikka","Amritsari Fish","Mutton Seekh Kabab",
    "Lucknowi Galouti Kabab","Dahi Kabab","Hara Bhara Kabab","Dim-sum Station","Bruschetta","Mushroom Vol-au-Vents",
    "Tamatar Dhaniya Ka Shorba","Chicken Hot & Sour Soup",
    "Ambria Garden Salad","Aloo Chana Chaat","Healthy Sprout Salad","Waldorf Salad","Corn and Sweet Pepper Salad","Kimchi","Sirka Pyaaz",
    "Paneer Lababdar","Dum Aloo Kashmiri","Gobhi Masala","Diwan-e-Handi","Palak Paneer","Dal-E-Ambria",
    "Butter Chicken","Mutton Rogan Josh",
    "Assorted Vegetables on Tawa","Dal Tadka with Tawa Phulka","Steamed Rice","Chicken Dum Biryani","Mirchi Ka Salan",
    "Tandoori Roti","Lachha Paratha","Plain/Butter/Garlic Naan","Missi Roti","Kulcha",
    "Vegetable Hakka Noodles","Garlic Onion Fried Rice","Veg Manchurian","Sliced Chicken in Szechuan Sauce",
    "Moong Dal Halwa","Gajar Halwa","Gulab Jamun","Nano Jalebi with Rabri","Bikaneri Ghevar Live",
    "Gulab Kheer","Kesari Rasmalai","Tilla Kulfi","Ice Cream Parlour","Assorted Tea / Coffee",
  ],
  "Magnum Veg": [
    "Aerated Drinks","Virgin Mojito","Sweet Sunrise","Blue Lagoon","Mineral Water 250ml",
    "Paneer Tikka Shashlik","Malai Soya Chaap","Golden Coin","Thai Veg Spring Roll","Honey Chilli Potato",
    "Tamatar Dhaniya Ka Shorba","Veg Manchow Soup","Sweet Corn Soup",
    "Ever-Green Salad","Aloo Chana Chaat","Hara Moong and Moth Salad","Sirka Pyaaz","Lacha Onions",
    "Mixed Vegetable Raita","Achar","Roasted Papad",
    "Paneer Lababdar","Dum Aloo Kashmiri","Dal-E-Ambria (Chef Special)","Gobhi Masala","Subz Miloni","Punjabi Kadhi Pakoda","Steamed Rice",
    "Tandoori Roti","Laccha Paratha","Mirchi Paratha","Plain & Butter Naan","Missi Roti",
    "Veg Manchurian","Garlic Onion Fried Rice","Vegetable Hakka Noodles",
    "Gulab Jamun","Moong Dal Halwa","Gulab Kheer","Assorted Ice Cream","Assorted Tea / Coffee",
  ],
  "Magnum Non-Veg": [
    "Aerated Drinks","Virgin Mojito","Sweet Sunrise","Blue Lagoon","Mineral Water 250ml",
    "Paneer Tikka Shashlik","Malai Soya Chaap","Honey Chilli Potato",
    "Murgh Malai Tikka","Amritsari Fish","Mutton Seekh Kabab",
    "Cream of Tomato Soup","Chicken Hot & Sour Soup",
    "Ever-Green Salad","Aloo Chana Chaat","Hara Moong and Moth Salad","Sirka Pyaaz","Lacha Onions",
    "Mixed Vegetable Raita","Achar","Roasted Papad",
    "Paneer Lababdar","Dum Aloo Kashmiri","Dal-E-Ambria","Gobhi Masala","Amritsari Chole",
    "Butter Chicken","Mutton Rogan Josh",
    "Chicken Dum Biryani","Steamed Rice",
    "Tandoori Roti","Laccha Paratha","Mirchi Paratha","Plain & Butter Naan","Missi Roti","Kulcha",
    "Veg Manchurian","Garlic Onion Fried Rice","Vegetable Hakka Noodles","Sliced Chicken in Szechuan Sauce",
    "Gulab Jamun","Moong Dal Halwa","Gulab Kheer","Assorted Ice Cream","Assorted Tea / Coffee",
  ],
  "Double Magnum Veg": [
    "Aerated Drinks (Coke / Fanta / Sprite)","Assorted Juices (Orange / Pineapple / Mix Fruit)","Virgin Mojito","Sweet Sunrise","Pina Colada","Pink Lady","Mineral Water 250ml",
    "Fresh Fruit Counter (3 Indian & 3 Imported)",
    "Golgappe with Varieties of Water","Crispy Aloo Tikki","Bhalla Papdi",
    "Paneer Tikka Shashlik","Ananas Tikka","Kung Pao Paneer","Malai Soya Chaap","Thai Spring Roll","Honey Chilli Potatoes","Golden Coin",
    "Tamatar Dhaniya Ka Shorba","Hot And Sour Soup","Veg Manchow Soup","Sweet Corn Soup",
    "Ever-Green Salad","Aloo Chana Chaat","Corn And Sweet Pepper Salad","Kimchi","Sirka Pyaaz","Lacha Onions",
    "Assorted Pickle Bar","Papad (Moong / Hing / Urad)","Chutney (Tomato / Mint / Mango)",
    "Mixed Vegetable Raita","Boondi Raita",
    "Paneer Lababdar","Kashmiri Dum Aloo","Gobhi Masala","Subz Miloni","Amritsari Choley with Kulcha","Aloo Methi / Sarson Ka Saag (Seasonal)","Punjabi Kadhi Pakoda","Dal-E-Ambria (Chef's Special)","Dal Tadka with Tawa Phulka",
    "Steamed Rice","Hyderabadi Subz Dum Biryani","Mirch Ka Salan",
    "Tandoori Roti","Laccha Paratha","Mirchi Paratha","Plain / Butter / Garlic Naan","Missi Roti","Kulcha",
    "Veg Manchurian Gravy","Garlic Onion Fried Rice","Vegetable Hakka Noodles",
    "Pasta Live (Penne / Fusilli with Arrabbiata / Béchamel / Pink Sauce)","Exotic Vegetables","Garlic Bread",
    "Gulab Jamun","Moong Dal Halwa","Kesari Rasmalai","Gulab Kheer","Assorted Ice Cream",
    "Assorted Tea / Coffee",
    "Assembly Menu","Phera Menu",
  ],
  "Double Magnum Non-Veg": [
    "Aerated Drinks (Coke / Fanta / Sprite)","Assorted Juices (Orange / Pineapple / Mix Fruit)","Virgin Mojito","Sweet Sunrise","Pina Colada","Pink Lady","Mineral Water 250ml",
    "Fresh Fruit Counter (3 Indian & 3 Imported)",
    "Golgappe with Varieties of Water","Crispy Aloo Tikki","Bhalla Papdi",
    "Paneer Tikka Shashlik","Ananas Tikka","Malai Soya Chaap","Honey Chilli Potatoes","Golden Coin",
    "Murgh Malai Tikka","Amritsari Fish","Mutton Seekh Kebab","Chilli Chicken Dry",
    "Cream of Tomato Soup","Chicken Hot & Sour Soup",
    "Ever-Green Salad","Aloo Chana Chaat","Corn And Sweet Pepper Salad","Kimchi","Sirka Pyaaz","Lacha Onions",
    "Assorted Pickle Bar","Papad (Moong / Hing / Urad)","Chutney (Tomato / Mint / Mango)",
    "Mixed Vegetable Raita","Boondi Raita",
    "Paneer Lababdar","Gobhi Masala","Subz Miloni","Amritsari Choley with Kulcha","Aloo Methi / Sarson Ka Saag (Seasonal)","Dal-E-Ambria (Chef's Special)",
    "Murgh Lababdar","Mutton Rogan Josh",
    "Steamed Rice","Chicken Dum Biryani","Mirch Ka Salan",
    "Tandoori Roti","Laccha Paratha","Mirchi Paratha","Plain / Butter / Garlic Naan","Missi Roti","Kulcha",
    "Sliced Chicken in Schezwan Sauce","Veg Manchurian Gravy","Garlic Onion Fried Rice","Vegetable Hakka Noodles",
    "Pasta Live (Penne / Fusilli with Arrabbiata / Béchamel / Pink Sauce + Chicken)","Exotic Vegetables","Garlic Bread",
    "Gulab Jamun","Moong Dal Halwa","Kesari Rasmalai","Gulab Kheer","Assorted Ice Cream",
    "Assorted Tea / Coffee",
    "Assembly Menu","Phera Menu",
  ],
  "Luxury Veg": [
    "Refreshing Station (Shikanji / Jaljeera / Shaan-e-Sharbat / Fruit Punch)","Fresh Juices","Shakes","Aerated Drinks",
    "Thai Virgin Mojito","Mango Michelada","Caribbean Citrus Colada","Green Apple Cooler","Spicy Jamun Shots","Sex on the Beach",
    "6 Indian & 6 Imported Fruits",
    "Ambala Golgappe with Varieties of Water","Dahi Station (Bhalla Papdi / Mango Bhalla / Gujjiya)","Muradabadi Dal with Biscuit Roti","Matra Kulcha","Agra ki Bharwan Aloo Tikki","Ghaziabad ka Moonglet","Khajoor ki Chaat","Edamame Falafel Chaat","Sabudana Layered Chaat",
    "Paneer Tikka Shashlik","Multani Chutney Stuffed Paneer Tikka","Ananas Tikka","Tandoori Anardana Aloo","Malai Bhutte ki Seekh","Dahi Ke Sholay","Zafrani Malai Soya Chaap","Stuffed Mushroom Tikka",
    "Chilli Paneer","Tempura Fried Baby-corn","Thai Veg Spring Roll","Honey Chilli Potatoes","Schezwan Mushroom","Cigar Roll","Mini Spanakopita","Golden Coin","Peri-Peri Cottage Cheese Bombs",
    "Wood-Fired Thin Crust Pizza (Margherita / Peri-Peri / Truffle Mushroom / Mexican Corn)","Bruschetta","Mushroom Vol-au-Vents",
    "Crystal Dimsum (Steamed Veg / Cottage Cheese & Spinach / Shiitake / Water Chestnut)","Lucknowi Galouti (Beetroot / Rajma / Vegetable)","Basil Scented Dahi Ke Kabab","Hara Bhara Kabab",
    "Sushi Counter (Spicy Avocado / Crunchy Veg / Corn Tempura / Shiitake Mushroom)","Lebanese Mezze (Hummus / Babaganoush / Falafel / Pita)",
    "Broccoli Almond Soup (Chef's Rec)","Mulligatawny","Cream of Tomato","Tamatar Dhaniya Ka Shorba","Wild Truffle Mushroom Soup",
    "Waldorf Salad","Som Tom Raw Papaya Salad","Macaroni with Trio Peppers","Ambria Garden Salad","Aloo Chana Chaat","Healthy Sprout Salad","Kimchi","Sirka Pyaaz",
    "Pickle Bar (Mango / Lemon / Mix)","Boondi Raita","Mixed Vegetable Raita","Plain Yogurt",
    "Paneer Lababdar","Dal-E-Ambria","Palak Paneer","Diwan-E-Handi",
    "Punjabi Kadhi","Amritsari Pindi Choley with Kulcha","Sarson Ka Saag",
    "Hyderabadi Subz Biryani","Mirch Ka Salan","Burani Raita",
    "Bhindi-Do-Pyaza","Gobhi Masala","Yellow Dal Tadka & Tawa Phulka Live","Assorted Vegetable on Tawa Live","Steam Rice / Jeera Rice",
    "Assorted Indian Breads (Tandoori / Laccha / Pudina / Mirchi / Naan / Missi / Kulcha)",
    "Meerut ke Tandoor Se (Bakarkhani / Sheermal / Khandari / Biscuit Roti)",
    "Ram Babu ka Parantha (Paneer / Matar Methi / Aloo / Pyaaz)","Arbi Ka Jhol","Kunda Dahi",
    "Teppanyaki Live","Thai Green Curry","Jasmine Rice","Vegetable Hakka Noodles","Garlic Onion Fried Rice","Veg Manchurian",
    "Pasta (Penne/Fusilli/Spaghetti with choice of sauce)","Garlic Bread","Grilled Cottage Cheese Steak with Chipotle Sauce",
    "Kesari Nano Jalebi with Rabri","Gulab Jamun","Bikaneri Ghevar Live","Anjeer Halwa","Beetroot Halwa","Mirchi ka Halwa","Gajar Halwa / Moong Dal Halwa",
    "Gulab Kheer","Kesari Rasmalai","Orange Rabri","Assorted Dessert on Ice","Tilla Kulfi","Ice Cream Parlour","Roller Kulfi Live / Doodh ki Kadhai Live",
    "Paan Mousse","Boondi Parfait","Doda Barfi Tart",
    "Black Forest Cake","Walnut Brownie","Assorted Pastries","Baked Cheesecake","Tiramisu Live","Mud Chocolate / Bread Jam Pudding",
    "Pushkar Tea / Assorted Tea & Coffee",
    "Assembly Menu","Phera Menu",
  ],
  "Luxury Non-Veg": [
    "Refreshing Station (Shikanji / Jaljeera / Shaan-e-Sharbat / Fruit Punch)","Fresh Juices","Shakes","Aerated Drinks",
    "Thai Virgin Mojito","Mango Michelada","Caribbean Citrus Colada","Green Apple Cooler","Spicy Jamun Shots","Sex on the Beach",
    "6 Indian & 6 Imported Fruits",
    "Ambala Golgappe with Varieties of Water","Dahi Station (Bhalla Papdi / Mango Bhalla / Gujjiya)","Muradabadi Dal with Biscuit Roti","Matra Kulcha","Agra ki Bharwan Aloo Tikki","Khajoor ki Chaat","Edamame Falafel Chaat","Keema Pav",
    "Paneer Tikka Shashlik","Ananas Tikka","Dahi Ke Sholay","Zafrani Malai Soya Chaap",
    "Murgh Malai Tikka","Mutton Seekh Kabab","Lahori Fish Tikka","Fish Amritsari","Chicken Seekh Kabab","Chicken Tangdi Kabab",
    "Chilli Paneer","Honey Chilli Potatoes","Schezwan Mushroom","Chilly Chicken","Cigar Roll","Golden Coin",
    "Wood-Fired Pizza (Margherita / Peri-Peri Cottage Cheese / Truffle Mushroom / BBQ Chicken / Peri-Peri Chicken)","Bruschetta","Chicken Crostini","Mushroom Vol-au-Vents","Chicken Vol-au-Vents",
    "Crystal Dimsum (Steamed Veg / Cottage Cheese & Spinach / Crystal Steamed Chicken / Chicken & Basil Siumai / Sichuan Chicken Mushroom Chestnut)","Lucknowi Galouti (Beetroot / Rajma / Veg / Mutton)","Basil Scented Dahi Ke Kabab","Hara Bhara Kabab",
    "Sushi Counter (Spicy Avocado / Crunchy Veg / Corn Tempura / Nigiri / Uramaki)","Lebanese Mezze (Hummus / Babaganoush / Falafel / Pita / Chicken Shawarma)",
    "Broccoli Almond Soup (Chef's Rec)","Cream of Tomato","Tamatar Dhaniya Ka Shorba","Wild Truffle Mushroom","Chicken Hot & Sour Soup","Chicken Lemon Coriander Soup","Chicken Minestrone",
    "Waldorf Salad","Som Tom Raw Papaya Salad","Ambria Garden Salad","Aloo Chana Chaat","Healthy Sprout Salad","Kimchi","Chicken Hawaiian Salad","Chicken & Corn Salad",
    "Pickle Bar","Yogurt Station","Papad","Chutney",
    "Paneer Lababdar","Dal-E-Ambria","Palak Paneer","Diwan-e-Handi",
    "Punjabi Kadhi","Amritsari Pindi Choley with Kulcha","Sarson Ka Saag","Butter Chicken","Mutton Beliram / Mutton Rogan Josh",
    "Hyderabadi Subz Biryani","Chicken Dum Biryani","Mirch Ka Salan","Burani Raita",
    "Bhindi-Do-Pyaza","Gobhi Masala","Yellow Dal Tadka & Tawa Phulka Live","Dhaba Chicken","Egg Curry","Steam Rice / Jeera Rice",
    "Assorted Indian Breads","Meerut ke Tandoor Se (Bakarkhani / Sheermal / Khandari / Biscuit Roti)","Anda Paratha Live","Tawa Legacy of Bablu (Meerut) Live",
    "Teppanyaki Live (Veg + Chicken)","Thai Green Curry","Chicken Red Thai Curry","Vegetable Hakka Noodles","Garlic Onion Fried Rice","Veg Manchurian","Shredded Chicken in Hot Garlic Sauce",
    "Pasta Counter (with Chicken options)","Garlic Bread","Grilled Fish in Lemon Butter Sauce",
    "Kesari Nano Jalebi with Rabri","Gulab Jamun","Bikaneri Ghevar Live","Anjeer Halwa","Beetroot Halwa","Mirchi ka Halwa","Gajar Halwa / Moong Dal Halwa",
    "Gulab Kheer","Kesari Rasmalai","Orange Rabri","Assorted Dessert on Ice","Tilla Kulfi","Ice Cream Parlour","Roller Kulfi Live / Doodh ki Kadhai Live",
    "Paan Mousse","Boondi Parfait","Doda Barfi Tart",
    "Black Forest Cake","Walnut Brownie","Assorted Pastries","Baked Cheesecake","Tiramisu Live","Mud Chocolate / Bread Jam Pudding",
    "Pushkar Tea / Assorted Tea & Coffee",
    "Assembly Menu","Phera Menu",
  ],
};

const MENU_PACKAGE_NAMES = Object.keys(MENU_PACKAGES);



const AVATAR_COLORS = [
  "#E8961E","#2B7AB8","#C84040","#2B8A50","#7040A8",
  "#C07820","#1A7A6A","#A84060","#406888","#808040",
];

const SECTIONS = ["Indian Curries","Tandoor","Chinese","Chaat","Sweets"];
const ALL_DEPARTMENTS = ["Indian Curries","Tandoor","Chinese","Chaat","Sweets","Beverages","Service","Crockery","Transportation","ODC","Outdoor Staff","Management"];
const SECTION_META = {
  "Indian Curries": {color:"#D4A843", bg:"#1E1A10", dot:"#D4A843", icon:"🍛"},
  "Tandoor":        {color:"#D06040", bg:"#201410", dot:"#D06040", icon:"🔥"},
  "Chinese":        {color:"#8A70C8", bg:"#14101E", dot:"#8A70C8", icon:"🥢"},
  "Chaat":          {color:"#4DAA6A", bg:"#0E1E14", dot:"#4DAA6A", icon:"🌮"},
  "Sweets":         {color:"#D06080", bg:"#1E1014", dot:"#D06080", icon:"🍮"},
  "Beverages":      {color:"#50B0A0", bg:"#0E1E1A", dot:"#50B0A0", icon:"☕"},
  "Service":        {color:"#5B8FD0", bg:"#0E1620", dot:"#5B8FD0", icon:"🍽️"},
  "Crockery":       {color:"#8A70C8", bg:"#14101E", dot:"#8A70C8", icon:"🍶"},
  "Transportation": {color:"#D4A843", bg:"#1A1710", dot:"#D4A843", icon:"🚛"},
  "ODC":            {color:"#D06040", bg:"#201410", dot:"#D06040", icon:"🏕️"},
  "Management":     {color:"#C4A44A", bg:"#1A1710", dot:"#C4A44A", icon:"👑"},
  "Outdoor Staff":  {color:"#E8A040", bg:"#1E1810", dot:"#E8A040", icon:"👷"},
};
// ─── OUTSIDE VENDORS ──────────────────────────────────────────────
const OUTSIDE_VENDORS = [
  {id:"v1", name:"Ramesh Kumar",  specialty:"Indian Curries", phone:"98100-11111", rating:"4.8", rate:2500, active:true},
  {id:"v2", name:"Anil Yadav",    specialty:"Tandoor",        phone:"98200-22222", rating:"4.9", rate:2800, active:true},
  {id:"v3", name:"Suresh Tiwari", specialty:"Beverages",           phone:"98300-33333", rating:"4.5", rate:2200, active:true},
  {id:"v4", name:"Dinesh Sharma", specialty:"Chinese",        phone:"98400-44444", rating:"4.7", rate:2600, active:true},
  {id:"v5", name:"Manoj Gupta",   specialty:"Chaat",          phone:"98500-55555", rating:"4.6", rate:2000, active:true},
  {id:"v6", name:"Priya Caterers",specialty:"Sweets",         phone:"98600-66666", rating:"4.8", rate:3000, active:true},
];

// ─── VEHICLES ─────────────────────────────────────────────────────
const VEHICLES = [
  {id:"DL1LAJ1250", name:"DL1LAJ 1250", icon:"🚛", type:"dry",   note:"Truck open body — main food + equipment runs"},
  {id:"DL1LAN1814", name:"DL1LAN 1814", icon:"🚛", type:"dry",   note:"Truck open body — secondary load carrier"},
  {id:"DL1LAN2125", name:"DL1LAN 2125", icon:"❄🚛",type:"cold",  note:"Truck close body AC — dairy, sweets, cold items"},
  {id:"DL1LW5357",  name:"DL1LW 5357",  icon:"🛺", type:"quick", note:"Chhota Hathi — medium loads, quick runs"},
  {id:"DL9CBD3260",  name:"DL9CBD 3260", icon:"🚙", type:"quick", note:"Eeco — staff + small items transport"},
  {id:"DL9CAR4073",  name:"DL9CAR 4073", icon:"🚙", type:"quick", note:"Eeco — staff + small items transport"},
  {id:"DL4ERB3958",  name:"DL4ERB 3958", icon:"🛺", type:"quick", note:"E-Riksha — local short runs"},
  {id:"DL4ERB4678",  name:"DL4ERB 4678", icon:"🛺", type:"quick", note:"E-Riksha — local short runs"},
];

// ─── COLD ITEMS (require fridge truck) ────────────────────────────
const COLD_ITEMS = [
  "cream","chhena","paneer","rabri","rasmalai","kulfi","ice cream",
  "butter","dairy","milk","curd","raita","lassi","mousse","parfait",
  "cheesecake","tiramisu","gajar halwa","kheer",
];

const STAFF_LIST = [
  {id:1, name:"Gopal",           role:"Head Chef",  section:"Tandoor",        shift:"Morning"},
  {id:2, name:"Yatender",        role:"Head Chef",  section:"Indian Curries", shift:"Evening"},
  {id:3, name:"Caonty",          role:"Chef",       section:"Beverages",           shift:"Morning"},
  {id:4, name:"Rahul",           role:"Chef",       section:"Beverages",           shift:"Morning"},
  {id:5, name:"Kareena",         role:"Chef",       section:"Beverages",           shift:"Morning"},
  {id:6, name:"Noor Alam",       role:"Chef",       section:"Beverages",           shift:"Morning"},
  {id:7, name:"Deepu (Café)",    role:"Chef",       section:"Beverages",           shift:"Evening"},
  {id:8, name:"Devendar",        role:"Chef",       section:"Indian Curries", shift:"Morning"},
  {id:9, name:"Anas",            role:"Chef",       section:"Indian Curries", shift:"Morning"},
  {id:10,name:"Bhopal",          role:"Chef",       section:"Indian Curries", shift:"Morning"},
  {id:11,name:"Jeetu",           role:"Chef",       section:"Indian Curries", shift:"Morning"},
  {id:12,name:"Hina",            role:"Chef",       section:"Indian Curries", shift:"Morning"},
  {id:13,name:"Roshan",          role:"Staff Khana",section:"Indian Curries", shift:"Morning"},
  {id:14,name:"Kishor",          role:"Chef",       section:"Chinese",        shift:"Morning"},
  {id:15,name:"Lokesh",          role:"Chef",       section:"Chinese",        shift:"Morning"},
  {id:16,name:"Monu",            role:"Chef",       section:"Chinese",        shift:"Morning"},
  {id:17,name:"Vichesh",         role:"Chef",       section:"Chinese",        shift:"Morning"},
  {id:18,name:"Sandeep",         role:"Chef",       section:"Chinese",        shift:"Evening"},
  {id:19,name:"Bipin",           role:"Chef",       section:"Tandoor",        shift:"Morning"},
  {id:20,name:"Yetender",        role:"Chef",       section:"Tandoor",        shift:"Morning"},
  {id:21,name:"Rawat",           role:"Chef",       section:"Tandoor",        shift:"Morning"},
  {id:22,name:"Surender",        role:"Chef",       section:"Tandoor",        shift:"Morning"},
  {id:23,name:"Prabhash",        role:"Chef",       section:"Tandoor",        shift:"Evening"},
  {id:24,name:"Kushal Pal",      role:"Chef",       section:"Tandoor",        shift:"Evening"},
  {id:25,name:"Raghvendra",      role:"Chef",       section:"Chaat",          shift:"Morning"},
  {id:26,name:"Purushotam",      role:"Chef",       section:"Chaat",          shift:"Morning"},
  {id:27,name:"Balram",          role:"Chef",       section:"Chaat",          shift:"Morning"},
  {id:28,name:"Ajay",            role:"Chef",       section:"Chaat",          shift:"Morning"},
  {id:29,name:"Golu",            role:"Chef",       section:"Chaat",          shift:"Morning"},
  {id:30,name:"Kuldeep",         role:"Chef",       section:"Chaat",          shift:"Evening"},
  {id:31,name:"Anurag",          role:"Chef",       section:"Chaat",          shift:"Evening"},
  {id:32,name:"Satyendra",       role:"Chef",       section:"Chaat",          shift:"Evening"},
  {id:33,name:"Sahdev",          role:"Chef",       section:"Chaat",          shift:"Evening"},
  {id:34,name:"Badal",           role:"Chef",       section:"Chaat",          shift:"Evening"},
  {id:35,name:"Bachchan",        role:"Chef",       section:"Sweets",         shift:"Morning"},
  {id:36,name:"Anil",            role:"Chef",       section:"Sweets",         shift:"Morning"},
  {id:37,name:"Ramu",            role:"Chef",       section:"Sweets",         shift:"Morning"},
  {id:38,name:"Yogesh",          role:"Chef",       section:"Sweets",         shift:"Morning"},
  {id:39,name:"Vrindhavan",      role:"Chef",       section:"Sweets",         shift:"Morning"},
  {id:40,name:"Radheshyam",      role:"Chef",       section:"Sweets",         shift:"Evening"},
  {id:41,name:"Abhishek",        role:"Chef",       section:"Sweets",         shift:"Evening"},
  {id:42,name:"Deepu (Sweets)",  role:"Chef",       section:"Sweets",         shift:"Evening"},
  {id:43,name:"Saurab",          role:"Chef",       section:"Sweets",         shift:"Evening"},
  // ── SERVICE DEPT ──
  {id:44,name:"Ramesh (Captain)",role:"Captain",    section:"Service",        shift:"Morning"},
  {id:45,name:"Dinesh",          role:"Steward",    section:"Service",        shift:"Morning"},
  {id:46,name:"Mohan",           role:"Steward",    section:"Service",        shift:"Morning"},
  {id:47,name:"Suresh",          role:"Steward",    section:"Service",        shift:"Morning"},
  {id:48,name:"Vikram",          role:"Steward",    section:"Service",        shift:"Morning"},
  {id:49,name:"Pappu",           role:"Steward",    section:"Service",        shift:"Evening"},
  {id:50,name:"Ajay (Service)",  role:"Steward",    section:"Service",        shift:"Evening"},
  {id:51,name:"Rajan",           role:"Steward",    section:"Service",        shift:"Evening"},
  // ── CROCKERY DEPT ──
  {id:52,name:"Mukesh",          role:"Supervisor", section:"Crockery",       shift:"Morning"},
  {id:53,name:"Satish",          role:"Helper",     section:"Crockery",       shift:"Morning"},
  {id:54,name:"Bhola",           role:"Helper",     section:"Crockery",       shift:"Morning"},
  {id:55,name:"Kishan",          role:"Helper",     section:"Crockery",       shift:"Evening"},
  {id:56,name:"Ramu",            role:"Helper",     section:"Crockery",       shift:"Evening"},
  // ── TRANSPORTATION DEPT ──
  {id:57,name:"Harish (Driver)", role:"Driver",     section:"Transportation", shift:"Morning"},
  {id:58,name:"Kamal (Driver)",  role:"Driver",     section:"Transportation", shift:"Morning"},
  {id:59,name:"Sunil (Driver)",  role:"Driver",     section:"Transportation", shift:"Evening"},
  {id:60,name:"Prem (Loader)",   role:"Loader",     section:"Transportation", shift:"Morning"},
  {id:61,name:"Jitender (Loader)",role:"Loader",    section:"Transportation", shift:"Morning"},
  // ── ODC DEPT ──
  {id:62,name:"Akhtar",          role:"Equipment",  section:"ODC",            shift:"Morning"},
  {id:63,name:"Rajender Chef",   role:"Purchasing", section:"ODC",            shift:"Morning"},
  {id:64,name:"Sanjay (ODC)",    role:"Supervisor", section:"ODC",            shift:"Morning"},
  {id:65,name:"Bittu (ODC)",     role:"Helper",     section:"ODC",            shift:"Morning"},
  {id:66,name:"Rahul (ODC)",     role:"Helper",     section:"ODC",            shift:"Evening"},
];

// ─── EMPLOYEE DATABASE ───────────────────────────────────────────
// PIN is 4-digit. Role: admin | headchef | staff
// IDs: AM = Ambria Management, KIT = Kitchen
const EMPLOYEE_DB_INIT = [
  // Management — AM001 keeps admin; everyone else starts as kiosk_gate (no access)
  {id:"AM001",name:"Abhi",             role:"admin",      custom_screens:null, section:"Management",     dept:"Operations",     joining:"2022-01-01",pin:"0000",active:true},
  {id:"AM002",name:"Gopal",            role:"kiosk_gate", custom_screens:null, section:"Tandoor",        dept:"kitchen",        joining:"2019-03-15",pin:"0000",active:true},
  {id:"AM003",name:"Yatender",         role:"kiosk_gate", custom_screens:null, section:"Indian Curries", dept:"kitchen",        joining:"2018-06-01",pin:"0000",active:true},
  // Beverages
  {id:"CAF01",name:"Caonty",           role:"kiosk_gate", custom_screens:null, section:"Beverages",      dept:"Beverages",      joining:"2021-04-10",pin:"0000",active:true},
  {id:"CAF02",name:"Rahul",            role:"kiosk_gate", custom_screens:null, section:"Beverages",      dept:"Beverages",      joining:"2022-07-01",pin:"0000",active:true},
  {id:"CAF03",name:"Kareena",          role:"kiosk_gate", custom_screens:null, section:"Beverages",      dept:"Beverages",      joining:"2023-01-15",pin:"0000",active:true},
  {id:"CAF04",name:"Noor Alam",        role:"kiosk_gate", custom_screens:null, section:"Beverages",      dept:"Beverages",      joining:"2022-11-01",pin:"0000",active:true},
  {id:"CAF05",name:"Deepu (Café)",     role:"kiosk_gate", custom_screens:null, section:"Beverages",      dept:"Beverages",      joining:"2023-05-01",pin:"0000",active:true},
  // Indian Curries
  {id:"IND01",name:"Devendar",         role:"kiosk_gate", custom_screens:null, section:"Indian Curries", dept:"F&B Kitchen",    joining:"2020-02-01",pin:"0000",active:true},
  {id:"IND02",name:"Anas",             role:"kiosk_gate", custom_screens:null, section:"Indian Curries", dept:"F&B Kitchen",    joining:"2021-08-15",pin:"0000",active:true},
  {id:"IND03",name:"Bhopal",           role:"kiosk_gate", custom_screens:null, section:"Indian Curries", dept:"F&B Kitchen",    joining:"2019-12-01",pin:"0000",active:true},
  {id:"IND04",name:"Jeetu",            role:"kiosk_gate", custom_screens:null, section:"Indian Curries", dept:"F&B Kitchen",    joining:"2022-03-01",pin:"0000",active:true},
  {id:"IND05",name:"Hina",             role:"kiosk_gate", custom_screens:null, section:"Indian Curries", dept:"F&B Kitchen",    joining:"2023-02-15",pin:"0000",active:true},
  {id:"IND06",name:"Roshan",           role:"kiosk_gate", custom_screens:null, section:"Indian Curries", dept:"F&B Kitchen",    joining:"2021-06-01",pin:"0000",active:true},
  // Chinese
  {id:"CHN01",name:"Kishor",           role:"kiosk_gate", custom_screens:null, section:"Chinese",        dept:"F&B Kitchen",    joining:"2020-05-01",pin:"0000",active:true},
  {id:"CHN02",name:"Lokesh",           role:"kiosk_gate", custom_screens:null, section:"Chinese",        dept:"F&B Kitchen",    joining:"2019-09-01",pin:"0000",active:true},
  {id:"CHN03",name:"Monu",             role:"kiosk_gate", custom_screens:null, section:"Chinese",        dept:"F&B Kitchen",    joining:"2022-01-15",pin:"0000",active:true},
  {id:"CHN04",name:"Vichesh",          role:"kiosk_gate", custom_screens:null, section:"Chinese",        dept:"F&B Kitchen",    joining:"2021-11-01",pin:"0000",active:true},
  {id:"CHN05",name:"Sandeep",          role:"kiosk_gate", custom_screens:null, section:"Chinese",        dept:"F&B Kitchen",    joining:"2023-04-01",pin:"0000",active:true},
  // Tandoor
  {id:"TAN01",name:"Bipin",            role:"kiosk_gate", custom_screens:null, section:"Tandoor",        dept:"F&B Kitchen",    joining:"2020-08-01",pin:"0000",active:true},
  {id:"TAN02",name:"Yetender",         role:"kiosk_gate", custom_screens:null, section:"Tandoor",        dept:"F&B Kitchen",    joining:"2021-01-15",pin:"0000",active:true},
  {id:"TAN03",name:"Rawat",            role:"kiosk_gate", custom_screens:null, section:"Tandoor",        dept:"F&B Kitchen",    joining:"2019-07-01",pin:"0000",active:true},
  {id:"TAN04",name:"Surender",         role:"kiosk_gate", custom_screens:null, section:"Tandoor",        dept:"F&B Kitchen",    joining:"2022-06-01",pin:"0000",active:true},
  {id:"TAN05",name:"Prabhash",         role:"kiosk_gate", custom_screens:null, section:"Tandoor",        dept:"F&B Kitchen",    joining:"2023-03-01",pin:"0000",active:true},
  {id:"TAN06",name:"Kushal Pal",       role:"kiosk_gate", custom_screens:null, section:"Tandoor",        dept:"F&B Kitchen",    joining:"2023-07-01",pin:"0000",active:true},
  // Chaat
  {id:"CHA01",name:"Raghvendra",       role:"kiosk_gate", custom_screens:null, section:"Chaat",          dept:"F&B Kitchen",    joining:"2020-01-01",pin:"0000",active:true},
  {id:"CHA02",name:"Purushotam",       role:"kiosk_gate", custom_screens:null, section:"Chaat",          dept:"F&B Kitchen",    joining:"2021-03-15",pin:"0000",active:true},
  {id:"CHA03",name:"Balram",           role:"kiosk_gate", custom_screens:null, section:"Chaat",          dept:"F&B Kitchen",    joining:"2022-09-01",pin:"0000",active:true},
  {id:"CHA04",name:"Ajay",             role:"kiosk_gate", custom_screens:null, section:"Chaat",          dept:"F&B Kitchen",    joining:"2021-07-01",pin:"0000",active:true},
  {id:"CHA05",name:"Golu",             role:"kiosk_gate", custom_screens:null, section:"Chaat",          dept:"F&B Kitchen",    joining:"2023-01-01",pin:"0000",active:true},
  {id:"CHA06",name:"Kuldeep",          role:"kiosk_gate", custom_screens:null, section:"Chaat",          dept:"F&B Kitchen",    joining:"2022-04-15",pin:"0000",active:true},
  {id:"CHA07",name:"Anurag",           role:"kiosk_gate", custom_screens:null, section:"Chaat",          dept:"F&B Kitchen",    joining:"2023-06-01",pin:"0000",active:true},
  {id:"CHA08",name:"Satyendra",        role:"kiosk_gate", custom_screens:null, section:"Chaat",          dept:"F&B Kitchen",    joining:"2022-02-01",pin:"0000",active:true},
  {id:"CHA09",name:"Sahdev",           role:"kiosk_gate", custom_screens:null, section:"Chaat",          dept:"F&B Kitchen",    joining:"2021-10-15",pin:"0000",active:true},
  {id:"CHA10",name:"Badal",            role:"kiosk_gate", custom_screens:null, section:"Chaat",          dept:"F&B Kitchen",    joining:"2023-08-01",pin:"0000",active:true},
  // Sweets
  {id:"SWT01",name:"Bachchan",         role:"kiosk_gate", custom_screens:null, section:"Sweets",         dept:"F&B Kitchen",    joining:"2019-11-01",pin:"0000",active:true},
  {id:"SWT02",name:"Anil",             role:"kiosk_gate", custom_screens:null, section:"Sweets",         dept:"F&B Kitchen",    joining:"2020-09-15",pin:"0000",active:true},
  {id:"SWT03",name:"Ramu",             role:"kiosk_gate", custom_screens:null, section:"Sweets",         dept:"F&B Kitchen",    joining:"2021-05-01",pin:"0000",active:true},
  {id:"SWT04",name:"Yogesh",           role:"kiosk_gate", custom_screens:null, section:"Sweets",         dept:"F&B Kitchen",    joining:"2022-08-01",pin:"0000",active:true},
  {id:"SWT05",name:"Vrindhavan",       role:"kiosk_gate", custom_screens:null, section:"Sweets",         dept:"F&B Kitchen",    joining:"2020-12-15",pin:"0000",active:true},
  {id:"SWT06",name:"Radheshyam",       role:"kiosk_gate", custom_screens:null, section:"Sweets",         dept:"F&B Kitchen",    joining:"2021-09-01",pin:"0000",active:true},
  {id:"SWT07",name:"Abhishek",         role:"kiosk_gate", custom_screens:null, section:"Sweets",         dept:"F&B Kitchen",    joining:"2022-05-15",pin:"0000",active:true},
  {id:"SWT08",name:"Deepu (Sweets)",   role:"kiosk_gate", custom_screens:null, section:"Sweets",         dept:"F&B Kitchen",    joining:"2023-02-01",pin:"0000",active:true},
  {id:"SWT09",name:"Saurab",           role:"kiosk_gate", custom_screens:null, section:"Sweets",         dept:"F&B Kitchen",    joining:"2023-09-01",pin:"0000",active:true},
  // Service
  {id:"SRV01",name:"Ramesh (Captain)", role:"kiosk_gate", custom_screens:null, section:"Service",        dept:"Service",        joining:"2022-06-01",pin:"0000",active:true},
  {id:"SRV02",name:"Dinesh",           role:"kiosk_gate", custom_screens:null, section:"Service",        dept:"Service",        joining:"2023-01-15",pin:"0000",active:true},
  {id:"SRV03",name:"Mohan",            role:"kiosk_gate", custom_screens:null, section:"Service",        dept:"Service",        joining:"2023-04-01",pin:"0000",active:true},
  {id:"SRV04",name:"Suresh",           role:"kiosk_gate", custom_screens:null, section:"Service",        dept:"Service",        joining:"2023-07-01",pin:"0000",active:true},
  {id:"SRV05",name:"Vikram",           role:"kiosk_gate", custom_screens:null, section:"Service",        dept:"Service",        joining:"2023-08-01",pin:"0000",active:true},
  {id:"SRV06",name:"Pappu",            role:"kiosk_gate", custom_screens:null, section:"Service",        dept:"Service",        joining:"2023-02-01",pin:"0000",active:true},
  {id:"SRV07",name:"Ajay (Service)",   role:"kiosk_gate", custom_screens:null, section:"Service",        dept:"Service",        joining:"2023-10-01",pin:"0000",active:true},
  {id:"SRV08",name:"Rajan",            role:"kiosk_gate", custom_screens:null, section:"Service",        dept:"Service",        joining:"2024-01-01",pin:"0000",active:true},
  // Crockery
  {id:"CRK01",name:"Mukesh",           role:"kiosk_gate", custom_screens:null, section:"Crockery",       dept:"Crockery",       joining:"2022-03-01",pin:"0000",active:true},
  {id:"CRK02",name:"Satish",           role:"kiosk_gate", custom_screens:null, section:"Crockery",       dept:"Crockery",       joining:"2023-05-01",pin:"0000",active:true},
  {id:"CRK03",name:"Bhola",            role:"kiosk_gate", custom_screens:null, section:"Crockery",       dept:"Crockery",       joining:"2023-06-01",pin:"0000",active:true},
  {id:"CRK04",name:"Kishan",           role:"kiosk_gate", custom_screens:null, section:"Crockery",       dept:"Crockery",       joining:"2024-02-01",pin:"0000",active:true},
  {id:"CRK05",name:"Ramu",             role:"kiosk_gate", custom_screens:null, section:"Crockery",       dept:"Crockery",       joining:"2024-03-01",pin:"0000",active:true},
  // Transportation
  {id:"TRN01",name:"Harish (Driver)",  role:"kiosk_gate", custom_screens:null, section:"Transportation", dept:"Transportation",  joining:"2022-01-01",pin:"0000",active:true},
  {id:"TRN02",name:"Kamal (Driver)",   role:"kiosk_gate", custom_screens:null, section:"Transportation", dept:"Transportation",  joining:"2022-08-01",pin:"0000",active:true},
  {id:"TRN03",name:"Sunil (Driver)",   role:"kiosk_gate", custom_screens:null, section:"Transportation", dept:"Transportation",  joining:"2023-03-01",pin:"0000",active:true},
  {id:"TRN04",name:"Prem (Loader)",    role:"kiosk_gate", custom_screens:null, section:"Transportation", dept:"Transportation",  joining:"2023-11-01",pin:"0000",active:true},
  {id:"TRN05",name:"Jitender (Loader)",role:"kiosk_gate", custom_screens:null, section:"Transportation", dept:"Transportation",  joining:"2024-01-01",pin:"0000",active:true},
  // ODC
  {id:"ODC01",name:"Akhtar",           role:"kiosk_gate", custom_screens:null, section:"ODC",            dept:"ODC",            joining:"2021-06-01",pin:"0000",active:true},
  {id:"ODC02",name:"Rajender Chef",    role:"kiosk_gate", custom_screens:null, section:"ODC",            dept:"ODC",            joining:"2021-06-01",pin:"0000",active:true},
  {id:"ODC03",name:"Sanjay (ODC)",     role:"kiosk_gate", custom_screens:null, section:"ODC",            dept:"ODC",            joining:"2023-04-01",pin:"0000",active:true},
  {id:"ODC04",name:"Bittu (ODC)",      role:"kiosk_gate", custom_screens:null, section:"ODC",            dept:"ODC",            joining:"2023-09-01",pin:"0000",active:true},
  {id:"ODC05",name:"Rahul (ODC)",      role:"kiosk_gate", custom_screens:null, section:"ODC",            dept:"ODC",            joining:"2024-06-01",pin:"0000",active:true},
];

function getEmpByStaffId(empDb, staffListId) {
  const s = STAFF_LIST.find(x=>x.id===staffListId);
  if(!s) return null;
  return empDb.find(e=>e.name===s.name)||null;
}

function yrsOfService(joining) {
  const diff = new Date() - new Date(joining);
  const yrs = Math.floor(diff / (1000*60*60*24*365));
  const mos = Math.floor((diff % (1000*60*60*24*365)) / (1000*60*60*24*30));
  return yrs > 0 ? `${yrs}y ${mos}m` : `${mos} months`;
}


const GROOMING_CHECKS = [
  {id:"uniform",label:"Uniform clean & proper"},
  {id:"hair",   label:"Hair covered / groomed"},
  {id:"shave",  label:"Clean shaven / beard trimmed"},
  {id:"nails",  label:"Hands clean, nails trimmed"},
  {id:"shoes",  label:"Clean shoes / proper footwear"},
];

// ─── DATES (local time — no UTC shift bug) ──────────────────────
function localDateStr(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),dd=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${dd}`;}
const TODAY = localDateStr(new Date());
const TODAY_LABEL = new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const CUR_YEAR = new Date().getFullYear();
function relDate(daysFromToday){
  const d=new Date(); d.setDate(d.getDate()+daysFromToday);
  return localDateStr(d);
}
const TOMORROW = relDate(1);
const DAY_AFTER = relDate(2);

const LIVE_EVENTS_INIT = [
  // ── TOMORROW (Jun 1) ──
  {id:`FP-${CUR_YEAR}-104`,guest:"Gupta Reception",venue:"Ambria Pushpanjali",
    date:TOMORROW,time:"7:00 PM",type:"Reception",pax:500,veg:320,nonveg:180,
    menuPackage:"Multi-Cuisine Non-Veg",menu:MENU_PACKAGES["Multi-Cuisine Non-Veg"]||[],
    special:"Ice cream counter by 9 PM. Bride is lactose intolerant — separate dessert.",
    extras:[{item:"Mocktail Counter (Extra Flavours)",qty:3,type:"Complimentary",by:"Sales Team"}]},
  // ── DAY AFTER (Jun 2) ──
  {id:`FP-${CUR_YEAR}-106`,guest:"Mehra Engagement",venue:"Ambria Pushpanjali",
    date:DAY_AFTER,time:"1:00 PM",type:"Other",pax:300,veg:180,nonveg:120,
    menuPackage:"Magnum Non-Veg",menu:MENU_PACKAGES["Magnum Non-Veg"]||[],
    special:"Dry fruit counter must be premium. Saffron theme decor.",
    extras:[{item:"Dry Fruit Counter",qty:1,type:"Chargeable",rate:12000,by:"Sales Team"}]},
];


// ─── TRANSLATIONS ─────────────────────────────────────────────────
const HI = {
  // NAV
  "Dashboard":"डैशबोर्ड","Event Calendar":"इवेंट कैलेंडर","Team & Attendance":"टीम व हाज़िरी",
  "Kitchen":"रसोई","Menu":"मेनू पैकेज","Transport & Dispatch":"ट्रांसपोर्ट व डिस्पैच",
  "Store & Inventory":"स्टोर व स्टॉक","Vendor Directory":"वेंडर डायरेक्टरी",

  // SECTIONS
  "Indian Curries":"इंडियन करी","Tandoor":"तंदूर","Chinese":"चाइनीज़","Chaat":"चाट",
  "Sweets":"मिठाई","Beverages":"पेय पदार्थ","All":"सभी","Management":"प्रबंधन",

  // KITCHEN TABS
  "📊 Today's Kitchen":"📊 आज की रसोई","📋 Prep Tracking":"📋 तैयारी ट्रैकिंग",
  "📅 Prep Plan":"📅 तैयारी योजना","📖 Recipe SOPs":"📖 रेसिपी एसओपी",
  "Today's Kitchen":"आज की रसोई","Prep Tracking":"तैयारी ट्रैकिंग",
  "Prep Plan":"तैयारी योजना","Recipe SOPs":"रेसिपी एसओपी",

  // KITCHEN STATS
  "Today Functions":"आज के फंक्शन","Today Pax":"आज पैक्स",
  "Tomorrow Events":"कल के इवेंट","Tomorrow Pax":"कल पैक्स",
  "Functions Today":"आज के फंक्शन","Total Pax":"कुल पैक्स",
  "Total Dishes":"कुल व्यंजन","Sections Active":"सक्रिय विभाग",

  // KITCHEN LABELS
  "LIVE TODAY":"आज लाइव","TOMORROW":"कल","TODAY":"आज","In days":"दिन में",
  "Dispatch window":"रवाना समय","Final Preparations":"अंतिम तैयारी",
  "D−1 Advance Preparation":"D−1 अग्रिम तैयारी","Start TODAY":"आज शुरू करें",
  "FP Menu":"FP मेनू","dishes":"व्यंजन","Dispatch by":"रवाना",
  "Special:":"विशेष:","Extras from Sales:":"सेल्स एक्सट्रा:","Extras:":"एक्सट्रा:",
  "veg":"वेज","non-veg":"नॉन-वेज","prep done":"तैयारी हुई",

  // PREP STEPS
  "Mesa":"मेसा","Primary prep":"प्राथमिक तैयारी","Cooking":"खाना बनाना",
  "Final seasoning":"अंतिम मसाला","Garnish & plate":"सजावट व सर्विंग",
  "Chafing & hold":"चेफ़िंग में रखें","Marination & Soaking":"मैरिनेशन व भिगोना",
  "Dough & Batter":"आटा व बैटर","Grinding & Masala":"पीसना व मसाला",
  "Cutting & Chopping":"काटना व कुतरना","Advance Cooking":"पहले से पकाना",

  // PREP PLAN
  "Prep Plan":"तैयारी योजना",
  "Day −1 Prep (Tomorrow)":"कल की D−1 तैयारी","Event Day Final Prep":"इवेंट डे अंतिम तैयारी",
  "Dispatch window":"रवाना का समय","No advance prep required.":"कोई अग्रिम तैयारी नहीं।",
  "No event-day tasks listed.":"इवेंट डे कार्य नहीं।",
  "No functions yet. Add from Dashboard.":"कोई फंक्शन नहीं। डैशबोर्ड से जोड़ें।",

  // TIMER
  "▶ Start":"▶ शुरू करें","▶ Resume":"▶ जारी रखें",
  "Done! Move to next step.":"हो गया! अगले चरण पर जाएं।","SOP time:":"SOP समय:",
  "Time done!":"समय पूरा!","Step":"चरण","steps":"चरण",

  // TEAM
  "✅ Attendance":"✅ उपस्थिति","🌿 Leaves":"🌿 छुट्टी",
  "🤝 Outside Staff & Vendors":"🤝 बाहरी स्टाफ व वेंडर","🪪 Team":"🪪 टीम",
  "Present":"उपस्थित","Absent":"अनुपस्थित","Pending":"लंबित","Approved":"मंज़ूर","Rejected":"अस्वीकृत",
  "Late":"देर से","On Leave":"छुट्टी पर","Not checked in":"चेक-इन नहीं",
  "Apply Leave":"छुट्टी लगाएं","From":"से","To":"तक","Reason":"कारण",
  "✓ Approve":"✓ मंज़ूर","✕ Reject":"✕ अस्वीकार","Add Employee":"कर्मचारी जोड़ें",
  "All Sections":"सभी विभाग","Staff ID":"स्टाफ आईडी",
  "Section":"विभाग","Role":"भूमिका","Phone":"फ़ोन","Active":"सक्रिय","Inactive":"निष्क्रिय",
  "Years of service":"सेवा वर्ष","Years":"वर्ष",

  // KIOSK
  "Welcome! Tap your name to check in":"स्वागत! अपना नाम टैप करें",
  "Already checked in!":"पहले से चेक इन हैं!",
  "Kitchen Gate Kiosk":"रसोई गेट किओस्क",
  "Kitchen gate attendance":"रसोई गेट हाज़िरी",
  "Capture Photo":"फ़ोटो लें","Now sign below to confirm":"नीचे हस्ताक्षर करें",
  "Confirm Check-In":"चेक-इन पक्का करें","Check-in successful!":"चेक-इन सफल!",
  "Launch Kiosk →":"किओस्क खोलें →",
  "Launch Kiosk":"किओस्क खोलें","Kitchen gate attendance":"रसोई गेट हाज़िरी",

  // TRANSPORT
  "📅 Day View":"📅 दिन दृश्य","🗺 Live Map":"🗺 लाइव नक्शा",
  "🚛 Dispatch":"🚛 रवाना","📋 Load/Unload":"📋 लोड/अनलोड","🔧 Fleet":"🔧 बेड़ा",
  "At Base":"बेस पर","En Route":"रास्ते में","At Venue":"वेन्यू पर","Returned":"वापस",
  "Planning":"योजना","Loaded":"लोड","Dispatched":"रवाना","Driver":"ड्राइवर",
  "Dispatch Time":"रवाना समय","Add Vehicle":"+ वाहन जोड़ें",
  "Dry/Open":"सूखा/खुला","Cold Chain":"कोल्ड चेन","Quick/Small":"त्वरित/छोटा",
  "Edit":"संपादित","Remove":"हटाएं","Save":"सहेजें","Cancel":"रद्द करें","Add":"जोड़ें",
  "Loading (Kitchen→Truck)":"लोड (रसोई→ट्रक)","Unloading (Truck→Venue)":"अनलोड (ट्रक→वेन्यू)",

  // STORE
  "📦 Inventory":"📦 स्टॉक","🛒 Orders":"🛒 आर्डर","📋 Event Requirements":"📋 इवेंट ज़रूरतें",
  "Total Items":"कुल आइटम","Low / Out":"कम / ख़त्म","Pending Orders":"लंबित आर्डर",
  "Upcoming Events":"आगामी इवेंट",
  "In Stock":"स्टॉक में","Low Stock":"कम स्टॉक","Out of Stock":"स्टॉक ख़त्म","OK":"ठीक",
  "📦 Add New Inventory Item":"📦 नई सामग्री जोड़ें",
  "📷 Scan Barcode":"📷 बारकोड स्कैन करें",
  "Place Order":"आर्डर करें","✓ Mark Received":"✓ मिला","Order":"आर्डर",
  "Auto-Requirements for Upcoming Events":"आगामी इवेंट की ज़रूरतें",
  "No orders placed yet.":"अभी कोई आर्डर नहीं।",
  "In":"में","Req.":"ज़रूरत","Shortfall":"कमी","Action":"कार्रवाई","Category":"श्रेणी",
  "Item Name *":"आइटम नाम *","Barcode":"बारकोड","Brand":"ब्रांड","Supplier":"सप्लायर",
  "Unit":"इकाई","Min Stock":"न्यूनतम","Per Pax":"प्रति पैक्स","Location":"स्थान",
  "No items found.":"कोई आइटम नहीं।","No upcoming events. Add from Dashboard.":"कोई इवेंट नहीं। डैशबोर्ड से जोड़ें।",

  // VENDOR
  "Vendor Directory":"वेंडर डायरेक्टरी","+ Add Vendor":"+ वेंडर जोड़ें",
  "Outside Chef":"बाहरी शेफ़","Vegetable Supplier":"सब्ज़ी सप्लायर",
  "Dairy Supplier":"डेयरी सप्लायर","Dry Goods Supplier":"किराना सप्लायर",
  "Crockery & Equipment":"बर्तन व उपकरण","Packaging Supplier":"पैकेजिंग सप्लायर",
  "Beverage Supplier":"पेय सप्लायर","Cleaning Supplies":"सफ़ाई सामग्री","Other":"अन्य",
  "Add New Vendor":"नया वेंडर जोड़ें","Search vendors…":"वेंडर खोजें…",
  "Name *":"नाम *","Phone *":"फ़ोन *","Email":"ईमेल","Address":"पता",
  "Added By":"जोड़ा द्वारा","Notes":"नोट","Rating":"रेटिंग",
  "Section Speciality":"विभाग विशेषता","No vendors found.":"कोई वेंडर नहीं।",

  // MENU
  "Menu":"मेनू पैकेज","packages":"पैकेज",
  "items total":"कुल आइटम","Search dishes…":"व्यंजन खोजें…","No items match your search.":"कोई आइटम नहीं मिला।",
  "items":"आइटम","Full catering menus for all events":"सभी इवेंट्स के लिए पूर्ण केटरिंग मेनू","packages":"पैकेज",
  "MENU SOLD":"मेनू बिका","Full Menu Sold":"पूरा मेनू बिका",

  // DASHBOARD
  "Add Function":"फंक्शन जोड़ें","Good morning":"सुप्रभात","Good afternoon":"शुभ अपराह्न","Good evening":"शुभ संध्या",
  "Today's Events":"आज के इवेंट","Live now":"अभी लाइव","pax":"पैक्स",
  "Financial Year Events":"वित्तीय वर्ष इवेंट","Upcoming":"आगामी","Completed":"पूर्ण",
  "Live today":"आज लाइव","No events today":"आज कोई इवेंट नहीं","Coming up next":"आगे आने वाले",
  "No functions scheduled today":"आज कोई फंक्शन नहीं","+ Add Function":"+ फंक्शन जोड़ें",
  "Add New Function":"नया फंक्शन जोड़ें","Guest / Client Name *":"मेहमान / क्लाइंट नाम *",
  "Create Function →":"फंक्शन बनाएं →","prepped":"तैयार",

  // CALENDAR
  "Event Calendar":"इवेंट कैलेंडर","functions":"फंक्शन","Add here":"यहाँ जोड़ें",
  "No functions on this date":"इस तारीख पर कोई फंक्शन नहीं",
  "Calendar integration pending":"कैलेंडर इंटीग्रेशन लंबित",
  "Today":"आज","TMRW":"कल","Delete this function?":"यह फंक्शन हटाएं?",
  "Yes, Delete":"हाँ, हटाएं","Delete":"हटाएं","Edit":"संपादित करें",
  "New Function":"नया फंक्शन","Edit Function":"फंक्शन संपादित करें",
  "Save Changes":"बदलाव सहेजें","Add Function ✓":"फंक्शन जोड़ें ✓",
  "GUEST NAME *":"मेहमान नाम *","VENUE":"वेन्यू","TYPE":"प्रकार",
  "DATE *":"तारीख *","TIME":"समय","TOTAL PAX *":"कुल पैक्स *",
  "VEG":"वेज","NON-VEG":"नॉन-वेज","MENU PACKAGE":"मेनू पैकेज",
  "CUSTOM MENU":"कस्टम मेनू","SPECIAL INSTRUCTIONS":"विशेष निर्देश",

  // TEAM & ATTENDANCE
  "Staff at each property today":"आज प्रत्येक प्रॉपर्टी पर स्टाफ",
  "Staff today":"आज का स्टाफ","Manage →":"प्रबंधित करें →",
  "On Leave":"छुट्टी पर","Pending leave":"लंबित छुट्टी","Grooming":"ग्रूमिंग",
  "All present ✓":"सभी उपस्थित ✓","No leaves today":"आज कोई छुट्टी नहीं",
  "Launch Kiosk →":"किओस्क खोलें →","of":"में से","present":"उपस्थित",
  "on-roll":"ऑन-रोल","checked in":"चेक-इन",

  // KITCHEN NEW
  "D-1 Prep Done":"D-1 तैयारी हुई","Today's Plan of Action":"आज की कार्य योजना",
  "Yesterday's advance work":"कल की अग्रिम तैयारी","Fresh + carry-forward tasks":"ताज़ा + आगे की तैयारी",
  "D-1 Advance Preparation":"D-1 अग्रिम तैयारी","What was done yesterday":"कल क्या किया गया",
  "No advance prep items in this menu":"इस मेनू में कोई अग्रिम तैयारी नहीं",
  "items NOT prepped yesterday":"आइटम कल तैयार नहीं हुए","extra time needed":"अतिरिक्त समय चाहिए",
  "URGENT":"अत्यावश्यक","D-1 Missed":"D-1 छूट गया","Must prep + cook today":"आज तैयारी + पकाना ज़रूरी",
  "D-1 Prep Done — Continue to cook":"D-1 तैयारी हुई — पकाना जारी रखें",
  "Fresh Today — Cook & serve":"आज ताज़ा — पकाओ और परोसो",
  "Execution Checklist":"निष्पादन चेकलिस्ट",
  "Final Cooking":"अंतिम खाना बनाना","Final Seasoning":"अंतिम मसाला",
  "Chafing & Hold":"चेफ़िंग और होल्ड","Pack & Load trucks":"पैक और लोड",
  "Garnishing at venue":"वेन्यू पर सजावट","Head Chef final approval":"हेड शेफ़ अंतिम मंज़ूरी",

  // TRANSPORT NEW
  "📋 Today's Plan":"📋 आज की योजना","🗺 Live Map":"🗺 लाइव नक्शा",
  "🚛 Dispatch":"🚛 रवाना","📦 Load / Unload":"📦 लोड / अनलोड","🔧 Fleet":"🔧 बेड़ा",
  "Dispatch Plan":"रवाना योजना","Menu — Kitchen Status":"मेनू — रसोई स्थिति",
  "Kitchen":"रसोई","KITCHEN":"रसोई","LOADED":"लोड","Ready — tap to mark loaded":"तैयार — लोड चिह्नित करें",
  "Loaded on truck":"ट्रक पर लोड","Cooking…":"पक रहा है…","done":"हो गया",
  "Waiting for kitchen":"रसोई की प्रतीक्षा","items ready from kitchen!":"आइटम रसोई से तैयार!",
  "Chef has marked these as completed":"शेफ़ ने इन्हें पूर्ण चिह्नित किया","Clear to dispatch":"रवाना के लिए तैयार",
  "No functions to load.":"लोड करने के लिए कोई फंक्शन नहीं।",
  "No vehicles assigned yet":"अभी कोई वाहन नहीं","assigned":"नियुक्त",

  // DEPT VIEW
  "Department View":"विभाग दृश्य","Dept View":"विभाग दृश्य",
  "Select Your Department":"अपना विभाग चुनें","staff members":"स्टाफ सदस्य",
  "Each tablet is locked to its department":"प्रत्येक टैबलेट अपने विभाग पर लॉक है",
  "No staff in this section":"इस विभाग में कोई स्टाफ नहीं",
  "Today's Attendance":"आज की उपस्थिति","Checked In":"चेक-इन","Not Yet":"अभी नहीं",
  "Kitchen Tasks":"रसोई कार्य","My Section Dishes":"मेरे विभाग के व्यंजन",
  "dishes to prepare":"व्यंजन तैयार करने हैं","ready":"तैयार","cooking":"पक रहा",
  "waiting":"प्रतीक्षा","Change Dept":"विभाग बदलें","No dishes for this section today":"आज इस विभाग के लिए कोई व्यंजन नहीं",
  "Today's Menu":"आज का मेनू","for":"के लिए",
  "Click a date to see events":"इवेंट देखने के लिए तारीख पर क्लिक करें",
  "Wedding":"शादी","Reception":"रिसेप्शन","Corporate":"कॉर्पोरेट","Birthday":"जन्मदिन","Other":"अन्य",
  "dishes":"व्यंजन","prepped":"तैयार","Add":"जोड़ें",
  "This Month":"इस माह","FY Total":"वार्षिक कुल",
  "⚠ Special Food Tips":"⚠ विशेष भोजन निर्देश","Chef Alerts":"शेफ़ अलर्ट",
  "Special Instructions":"विशेष निर्देश","No special instructions today":"आज कोई विशेष निर्देश नहीं",
  "Action Required":"कार्रवाई आवश्यक","Note":"ध्यान दें","Critical":"गंभीर",
  // REPAIR & MAINTENANCE
  "Repair & Maintenance":"मरम्मत और रखरखाव","Equipment Servicing":"उपकरण सर्विसिंग",
  "Equipment Purchasing":"उपकरण खरीद","Quality / Operations":"गुणवत्ता / संचालन",
  "AP Base Kitchen":"AP बेस किचन","Gas & Burner":"गैस और बर्नर","Refrigeration":"रेफ्रिजरेशन",
  "Exhaust & Chimney":"एग्जॉस्ट और चिमनी","Electrical":"इलेक्ट्रिकल","Plumbing":"प्लंबिंग",
  "Utensils & Crockery":"बर्तन और क्रॉकरी","Vehicle":"वाहन",
  "Open":"खुला","In Progress":"प्रगति में","Pending Approval":"मंज़ूरी लंबित",
  "Resolved":"हल हुआ","Closed":"बंद","High/Urgent":"उच्च/अत्यावश्यक","Total":"कुल",
  "New Request":"नई रिक्वेस्ट","New Repair / Maintenance Request":"नई मरम्मत / रखरखाव रिक्वेस्ट",
  "ISSUE TITLE":"समस्या शीर्षक","Category":"श्रेणी","Priority":"प्राथमिकता",
  "Assign To":"नियुक्त करें","Submit Request":"रिक्वेस्ट भेजें",
  "Updates":"अपडेट","No tickets found":"कोई टिकट नहीं मिला",
  "Low":"कम","Medium":"मध्यम","High":"उच्च","Urgent":"अत्यावश्यक","All":"सभी",
  "Wedding":"शादी","Reception":"रिसेप्शन","Corporate":"कॉर्पोरेट","Outdoor":"आउटडोर","Birthday":"जन्मदिन",
  "Venue":"वेन्यू","Guest":"मेहमान","Menu":"मेनू","Time":"समय","Date":"तारीख","Type":"प्रकार",

  // MISC
  "Sign out":"साइन आउट","Sign In →":"साइन इन →","Signing in…":"साइन इन…",
  "Employee ID":"कर्मचारी आईडी","4-Digit PIN":"4 अंक पिन",
  "Remember me on this device":"इस डिवाइस पर याद रखें",
  "Loading...":"लोड हो रहा है…","No events":"कोई इवेंट नहीं","Search":"खोजें",
  "Off":"बंद","functions today":"फंक्शन आज",
  "Dispatch %":"रवाना %","Delivered %":"डिलीवर %","Delivered ✓":"डिलीवर ✓",
  "Mark Dispatched":"रवाना चिह्नित","Dispatched ✓":"रवाना ✓","Mark Delivered":"डिलीवर करें",
  "Assign chef":"शेफ़ नियुक्त करें",
  "Ambria FnB Operations":"अम्ब्रिया F&B ऑपरेशंस",
  "F&B Kitchen Operations":"F&B रसोई संचालन",
  "F&B Kitchen Operations · Sign in":"F&B रसोई संचालन · साइन इन",
  "Enter your Employee ID":"अपनी कर्मचारी ID दर्ज करें",
  "Enter 4-digit PIN":"4 अंकों का PIN दर्ज करें",
  "Invalid credentials":"गलत क्रेडेंशियल",
  "PIN":"PIN",
  "Sign in":"साइन इन",
  "Loading…":"लोड हो रहा है…",
  "••••":"••••",
  "Sign Out":"साइन आउट",
  "Mark Now →":"अभी चिह्नित करें →",
  "Leave Balance":"छुट्टी शेष",
  "Today's Events at Ambria":"अम्ब्रिया में आज के इवेंट",
  "Re-mark Attendance":"फिर से उपस्थिति चिह्नित करें",
  "Attendance marked!":"उपस्थिति चिह्नित!",
  "Required to mark attendance":"उपस्थिति चिह्नित करना आवश्यक",
  "Confirm your grooming before starting shift:":"शिफ्ट शुरू करने से पहले ग्रूमिंग की पुष्टि करें:",
  "My Leave Requests":"मेरी छुट्टी अनुरोध",
  "Requests go to Yatender for approval.":"अनुरोध यतेंदर को मंज़ूरी के लिए जाएंगे।",
  "No leave requests yet.":"अभी कोई छुट्टी अनुरोध नहीं।",
  "My Profile":"मेरी प्रोफ़ाइल",
  "Reason (optional)":"कारण (वैकल्पिक)",
  "Done":"हो गया",
  "Clean Uniform":"साफ़ यूनिफ़ॉर्म",
  "Hairnet / Cap":"हेयरनेट / टोपी",
  "Trimmed Nails":"कटे नाखून",
  "No Jewelry":"कोई आभूषण नहीं",
  "Closed Shoes":"बंद जूते",
  "Clean Apron":"साफ़ एप्रन",
  "Proceed →":"आगे बढ़ें →",
  "Ambria Cuisines · Kitchen Attendance":"अम्ब्रिया क्यूज़ीन · रसोई उपस्थिति",
  "Select Your Section":"अपना विभाग चुनें",
  "Each tablet is placed at the section entry gate":"प्रत्येक टैबलेट विभाग के प्रवेश द्वार पर लगा है",
  "Show All Sections (Admin)":"सभी विभाग दिखाएं (एडमिन)",
  "Section tablet":"विभाग टैबलेट",
  "Change Section":"विभाग बदलें",
  "Search your name…":"अपना नाम खोजें…",
  "YOUR PHOTO":"आपकी फ़ोटो",
  "SIGN HERE":"यहाँ हस्ताक्षर करें",
  "Draw your signature above":"ऊपर हस्ताक्षर करें",
  "Attendance recorded":"उपस्थिति दर्ज",
  "Photo + Signature saved":"फ़ोटो + हस्ताक्षर सहेजा",
  "Camera":"कैमरा",
  "Retake":"दोबारा लें",
  "Clear":"साफ़ करें",
  "Next →":"आगे →",
  "OK ✓":"ठीक ✓",
  "Team":"टीम",
  "Confirm":"पुष्टि करें",
  "Staff":"स्टाफ",
  "Select staff…":"स्टाफ चुनें…",
  "Admin":"एडमिन",
  "Head Chefs":"हेड शेफ़",
  "Book via Vendor Tab →":"वेंडर टैब से बुक करें →",
  "Vendor Portal View":"वेंडर पोर्टल दृश्य",
  "Vendor Portal":"वेंडर पोर्टल",
  "Select a vendor to place a booking request.":"बुकिंग अनुरोध के लिए वेंडर चुनें।",
  "Booking will be sent to this vendor":"बुकिंग इस वेंडर को भेजी जाएगी",
  "Change ×":"बदलें ×",
  "New Employee":"नया कर्मचारी",
  "Search name or ID…":"नाम या ID खोजें…",
  "Yes, Remove":"हाँ, हटाएं",
  "This will permanently remove the employee record.":"यह कर्मचारी रिकॉर्ड स्थायी रूप से हटा दिया जाएगा।",
  "Vendor Can Send":"वेंडर भेज सकता है",
  "Staff being sent":"स्टाफ भेजा जा रहा है",
  "Staff sent by vendor":"वेंडर द्वारा भेजा गया स्टाफ",
  "Staff Required by Section":"विभाग द्वारा आवश्यक स्टाफ",
  "Total staff requested":"कुल स्टाफ अनुरोधित",
  "Additional Notes for Vendor":"वेंडर के लिए अतिरिक्त नोट",
  "Reporting Time":"रिपोर्टिंग समय",
  "End Time":"समाप्ति समय",
  "Expected Pax":"अपेक्षित पैक्स",
  "Event":"इवेंट",
  "Select event…":"इवेंट चुनें…",
  "No specific event":"कोई विशिष्ट इवेंट नहीं",
  "Chef name":"शेफ़ का नाम",
  "Quantity to order":"ऑर्डर मात्रा",
  "Special requirements…":"विशेष आवश्यकताएं…",
  "No orders placed yet.":"अभी कोई ऑर्डर नहीं।",
  "No orders from kitchen yet.":"रसोई से अभी कोई ऑर्डर नहीं।",
  "Rejection reason…":"अस्वीकृति कारण…",
  "Prep · SOPs · Dispatch":"तैयारी · SOPs · रवानगी",
  "No dishes. Select a menu package when adding a function from Dashboard.":"कोई व्यंजन नहीं। डैशबोर्ड से फंक्शन जोड़ते समय मेनू पैकेज चुनें।",
  "No recipes found.":"कोई रेसिपी नहीं मिली।",
  "Search recipes…":"रेसिपी खोजें…",
  "CCP:":"CCP:",
  "Field notes":"फ़ील्ड नोट",
  "Add note for kitchen":"रसोई के लिए नोट जोड़ें",
  "D−1 done":"D-1 पूर्ण",
  "overall":"कुल मिलाकर",
  "running…":"चल रहा है…",
  "Tomorrow":"कल",
  "Dispatch window:":"रवानगी विंडो:",
  "No events loaded.":"कोई इवेंट लोड नहीं।",
  "No events loaded. Add from Event Calendar.":"कोई इवेंट लोड नहीं। कैलेंडर से जोड़ें।",
  "No functions loaded":"कोई फंक्शन लोड नहीं",
  "Events are pre-loaded. Add more from Dashboard.":"इवेंट पहले से लोड हैं। डैशबोर्ड से और जोड़ें।",
  "OpenStreetMap · 4s updates":"ओपनस्ट्रीटमैप · 4s अपडेट",
  "Route / capacity…":"मार्ग / क्षमता…",
  "Gopal":"गोपाल",
  "Gopal — ODC Lead":"गोपाल — ODC प्रमुख",
  "Yatender":"यतेंदर",
  "AE IN-CHARGE":"AE इंचार्ज",
  "AP Anchor":"AP एंकर",
  "On ODC day venue rounds suspended.":"ODC दिवस पर वेन्यू राउंड स्थगित।",
  "Inventory · Orders · Auto-requirements from events":"इन्वेंटरी · ऑर्डर · इवेंट से ऑटो-आवश्यकताएं",
  "All Categories":"सभी श्रेणियां",
  "Point camera at barcode · or enter manually below":"बारकोड पर कैमरा करें · या नीचे मैन्युअल दर्ज करें",
  "🔍 Search by name, barcode, brand…":"🔍 नाम, बारकोड, ब्रांड से खोजें…",
  "🔍 Search dishes…":"🔍 व्यंजन खोजें…",
  "🔍 Search vendors…":"🔍 वेंडर खोजें…",
  "Dress code, reporting point, special instructions…":"ड्रेस कोड, रिपोर्टिंग पॉइंट, विशेष निर्देश…",
  "Site observations…":"साइट अवलोकन…",
  "Something went wrong":"कुछ गलत हो गया",
  "Select…":"चुनें…",
  "Close":"बंद करें",
  "Back":"वापस",
  "Yes":"हाँ",
  "No":"नहीं",
  "Name":"नाम",
  "Status":"स्थिति",
  "Pax":"पैक्स",
  "Special":"विशेष",
  "Yesterday":"कल",
  "This Week":"इस सप्ताह",
  "Personal":"व्यक्तिगत",
  "Medical":"चिकित्सा",
  "Family emergency":"पारिवारिक आपातकाल",
  "Casual":"कैज़ुअल",
  "Available":"उपलब्ध",
  "Not Available":"उपलब्ध नहीं",
  "Manager":"प्रबंधक",
  "e.g. Sharma Wedding":"जैसे शर्मा शादी",
  "Jain, no onion-garlic…":"जैन, प्याज-लहसुन नहीं…",
  "Dal Makhni, Paneer Tikka…":"दाल मखनी, पनीर टिक्का…",
  "e.g. 500":"जैसे 500",
  "e.g. 3:00 PM":"जैसे 3:00 PM",
  "e.g. 11:00 PM":"जैसे 11:00 PM",
  "e.g. AM001":"जैसे AM001",
  "e.g. Dinner Plates (10 inch)":"जैसे डिनर प्लेट (10 इंच)",
  "Check in":"चेक-इन",
  "Grooming OK":"ग्रूमिंग ठीक",
  "Grooming Failed":"ग्रूमिंग फेल",
  "View All":"सभी देखें",
  "No data":"कोई डेटा नहीं",
  "Loading":"लोड हो रहा है",
  "Refresh":"रिफ्रेश",
  "events":"इवेंट",
  "staff":"स्टाफ",
  "Driver name":"ड्राइवर नाम",
  "Add Vehicle":"वाहन जोड़ें",
  "Normal Truck":"सामान्य ट्रक",
  "Fridge Truck":"फ्रिज ट्रक",
  "Mahindra Pickup":"महिंद्रा पिकअप",
  "Fleet Management":"बेड़ा प्रबंधन",
  "Add New Vehicle":"नया वाहन जोड़ें",
  "Vehicle Name":"वाहन नाम",
  "Dry":"ड्राई",
  "Quick":"क्विक",
  "Cold":"कोल्ड",
  "Inventory":"इन्वेंटरी",
  "Orders":"ऑर्डर",
  "Stock":"स्टॉक",
  "Fresh Vegetables":"ताज़ी सब्ज़ियां",
  "Fresh Fruits":"ताज़े फल",
  "Exotic & Imported":"विदेशी और आयातित",
  "Poultry, Meat & Fish":"मुर्गी, मांस और मछली",
  "Dairy & Fresh":"डेयरी और ताज़ा",
  "Bakery":"बेकरी",
  "Imported Pantry":"आयातित पेंट्री",
  "Indian Dry Store":"भारतीय ड्राई स्टोर",
  "Attendance":"उपस्थिति",
  "Leaves":"छुट्टियां",
  "Directory":"डायरेक्टरी",
  "Outside Chefs":"बाहरी शेफ़",
  "fn":"फं",
  "fns":"फं",
  "Service":"सेवा","Crockery":"क्रॉकरी","Transportation":"ट्रांसपोर्ट",
  "ODC - Outdoor Catering":"ODC - आउटडोर केटरिंग","ODC Lead":"ODC प्रमुख",
  "Service Checklist":"सेवा चेकलिस्ट","Event Briefing":"इवेंट ब्रीफिंग",
  "Requirements":"आवश्यकताएं","Beverage Counters":"पेय काउंटर",
  "Today's Dispatch":"आज की रवानगी","Loading Status":"लोडिंग स्थिति",
  "ODC Events":"ODC इवेंट","Site Checklist":"साइट चेकलिस्ट",
  "packed":"पैक","items remaining":"आइटम शेष","All packed — ready to load":"सब पैक — लोड के लिए तैयार",
  "beverages":"पेय पदार्थ","No beverages in this menu":"इस मेनू में कोई पेय नहीं",
  "No dispatch today":"आज कोई रवानगी नहीं","Dishes":"व्यंजन",
  "Loading status syncs from Transport & Dispatch module":"लोडिंग स्थिति ट्रांसपोर्ट मॉड्यूल से सिंक होती है",
  "Check main Transport section for detailed loading checklists":"विस्तृत लोडिंग चेकलिस्ट के लिए मुख्य ट्रांसपोर्ट सेक्शन देखें",
  "Committed to ODC today":"आज ODC में व्यस्त","in-house venues lose oversight":"इन-हाउस वेन्यू की निगरानी नहीं",
  "Available for in-house venues":"इन-हाउस वेन्यू के लिए उपलब्ध",
  "No ODC events scheduled":"कोई ODC इवेंट शेड्यूल नहीं",
  "No dishes for today":"आज कोई व्यंजन नहीं",
  "Staff roster for this department will be configured":"इस विभाग की स्टाफ सूची कॉन्फ़िगर की जाएगी",
  "Use Kiosk for attendance":"उपस्थिति के लिए किओस्क का उपयोग करें",
  "Launch Kiosk":"किओस्क खोलें","Kiosk":"किओस्क",
  "Site Recce":"साइट रेकी","Equipment":"उपकरण","Food Dispatch":"भोजन रवानगी",
  "On-Site Service":"ऑन-साइट सेवा","Teardown":"टियरडाउन",
  "Venue confirmed & keys received":"वेन्यू कन्फर्म और चाबियां मिलीं",
  "Power supply checked":"बिजली सप्लाई चेक","Water supply available":"पानी सप्लाई उपलब्ध",
  "Vehicle parking identified":"वाहन पार्किंग चिह्नित","Kitchen setup area marked":"किचन सेटअप एरिया चिह्नित",
  "Guest entry/exit flow planned":"अतिथि प्रवेश/निकास प्रवाह नियोजित",
  "Generators positioned & tested":"जनरेटर लगाए और टेस्ट किए","Gas cylinders loaded":"गैस सिलेंडर लोड",
  "Tandoors & burners setup":"तंदूर और बर्नर सेटअप","Fridge truck at site":"फ्रिज ट्रक साइट पर",
  "Tables & counters placed":"टेबल और काउंटर लगाए","Kitchen tent / shade ready":"किचन टेंट / शेड तैयार",
  "Dry items loaded & checked":"ड्राई सामान लोड और चेक","Cold items in fridge truck":"कोल्ड सामान फ्रिज ट्रक में",
  "Crockery loaded per checklist":"क्रॉकरी चेकलिस्ट अनुसार लोड",
  "Gas, coal, napkins, dustbins":"गैस, कोयला, नैपकिन, डस्टबिन","Staff meals packed":"स्टाफ खाना पैक",
  "Buffet counters dressed":"बुफ़े काउंटर सजे","Live counters operational":"लाइव काउंटर चालू",
  "Water & welcome drink ready":"पानी और वेलकम ड्रिंक तैयार","All staff in uniform":"सभी स्टाफ यूनिफ़ॉर्म में",
  "Gopal final walkthrough done":"गोपाल अंतिम निरीक्षण पूर्ण",
  "Leftover food packed":"बचा भोजन पैक","Equipment count verified":"उपकरण गिनती सत्यापित",
  "Crockery count — breakage noted":"क्रॉकरी गिनती — टूट-फूट नोट","Site cleaned":"साइट साफ़",
  "All vehicles loaded & departed":"सभी वाहन लोड और रवाना",
  "Dispatch":"रवानगी",
  "Change Department":"विभाग बदलें","Service Operations":"सेवा संचालन",
  "Crockery Operations":"क्रॉकरी संचालन","Beverage Counters":"पेय काउंटर",
  "ODC Operations":"ODC संचालन","Welcome":"स्वागत",
  "Property Gate Kiosk":"प्रॉपर्टी गेट किओस्क","Guard records attendance for ALL staff at property entrance":"गार्ड प्रॉपर्टी प्रवेश द्वार पर सभी स्टाफ की उपस्थिति दर्ज करता है",

  "Property Gate Attendance":"प्रॉपर्टी गेट उपस्थिति",
  "Select department to mark attendance":"उपस्थिति दर्ज करने के लिए विभाग चुनें",
  "Ambria Cuisines · Property Gate Attendance":"अम्ब्रिया क्यूज़ीन · प्रॉपर्टी गेट उपस्थिति",
  "Show All Staff (Admin)":"सभी स्टाफ दिखाएं (एडमिन)",
  "Captain":"कैप्टन","Steward":"स्टूवर्ड","Supervisor":"सुपरवाइज़र",
  "Helper":"हेल्पर","Driver":"ड्राइवर","Loader":"लोडर","Purchasing":"खरीद","Equipment":"उपकरण",
  "D-1 Prep":"D-1 तैयारी","Today's Plan":"आज की योजना",
  "Prepare these items today for tomorrow's functions":"कल के फंक्शन के लिए आज ये तैयार करें",
  "No upcoming functions for D-1 prep":"D-1 तैयारी के लिए कोई आगामी फंक्शन नहीं",
  "must complete before tomorrow":"कल से पहले पूरा करना ज़रूरी",
  "All D-1 prep done for this function!":"इस फंक्शन की सारी D-1 तैयारी पूर्ण!",
  "verify D-1 was completed":"D-1 पूर्ण हुआ सत्यापित करें",
  "Continue D-1 work + fresh cooking for today's events":"D-1 काम जारी + आज के इवेंट की ताज़ा तैयारी",
  "Standard Operating Procedures for all dishes":"सभी व्यंजनों के लिए मानक संचालन प्रक्रिया",
  "recipes":"रेसिपी","steps":"चरण","All Categories":"सभी श्रेणियां",
  "Start Timer":"टाइमर शुरू करें","Mark Done":"पूर्ण चिह्नित","Ready":"तैयार",
  "Cooking":"पक रहा","Mark as Ready":"तैयार चिह्नित करें",
  "Ready for Dispatch":"रवानगी के लिए तैयार","Notify Transport Team":"ट्रांसपोर्ट टीम को सूचित करें",
  "Dispatch notified at":"रवानगी सूचित किया","Transport team updated":"ट्रांसपोर्ट टीम अपडेट",
  "Kitchen says: Ready for Dispatch!":"किचन कहता है: रवानगी के लिए तैयार!",
  "dishes ready from kitchen":"व्यंजन किचन से तैयार","Notified at":"सूचित किया",
  "Time up!":"समय पूरा!","left":"बाकी","Done":"पूर्ण","Dispatched":"रवाना",
  "Collect from Store":"स्टोर से सामान लें",
  "Collect all ingredients from store as per recipe":"रेसिपी अनुसार स्टोर से सभी सामान लें",
  "Beverages — Store Requirement Only":"पेय — केवल स्टोर आवश्यकता",
  "Beverages are made LIVE at the function. Only store requirements are raised on D-1.":"पेय फंक्शन पर लाइव बनाए जाते हैं। D-1 पर केवल स्टोर आवश्यकता भेजी जाती है।",
  "Kitchen Prep":"किचन तैयारी","Prep":"तैयारी",
  "Collect ingredients from store":"स्टोर से सामान लें",
  "Live at function":"फंक्शन पर लाइव",
  "dishes cooking parallelly":"व्यंजन समानांतर पक रहे हैं",
  "Timers auto-running · Progress auto-saved":"टाइमर ऑटो-चालू · प्रगति ऑटो-सेव",
  "auto-completes":"ऑटो-पूर्ण","Start":"शुरू",
  "Start":"शुरू","Previous step must finish first":"पिछला चरण पहले पूरा होना चाहिए",
  "Tap any dish to start. Multiple dishes run in parallel.":"कोई भी व्यंजन शुरू करने के लिए टैप करें। कई व्यंजन एक साथ चलते हैं।",
  "Kitchen Prep Items":"किचन तैयारी आइटम",
  "Beverage Store Requirements":"पेय स्टोर आवश्यकताएं",
  "Send to store for collection. Beverages are prepared LIVE at function.":"स्टोर से कलेक्शन के लिए भेजें। पेय फंक्शन पर लाइव तैयार किए जाते हैं।",
  "Prep for tomorrow + send store requirements for beverages":"कल की तैयारी + पेय के लिए स्टोर आवश्यकताएं भेजें",
  "No functions tomorrow":"कल कोई फंक्शन नहीं",
  "All Packages":"सभी पैकेज","sections":"विभाग",
  "Mesa":"मेसा",
  "Enter your unique PIN to verify identity":"पहचान सत्यापित करने के लिए अपना PIN डालें",
  "Wrong PIN. Try again.":"गलत PIN। दोबारा प्रयास करें।",
  "Employee not found in database":"कर्मचारी डेटाबेस में नहीं मिला",
  "Verify & Continue":"सत्यापित करें और जारी रखें",
  "Apply for Leave":"छुट्टी के लिए आवेदन",
  "PIN Verified":"PIN सत्यापित","Look at the camera for attendance photo":"उपस्थिति फोटो के लिए कैमरे को देखें",
  "Starting camera…":"कैमरा शुरू हो रहा है…",
  "Camera not available. Tap below to mark without photo.":"कैमरा उपलब्ध नहीं। बिना फोटो के चिह्नित करने के लिए नीचे टैप करें।",
  "Capture & Mark Attendance":"फोटो लें और उपस्थिति दर्ज करें",
  "Mark Attendance":"उपस्थिति दर्ज करें",
  "Attendance Recorded":"उपस्थिति दर्ज","Returning in 4 seconds…":"4 सेकंड में वापसी…",
  "Submit Leave Request":"छुट्टी अनुरोध भेजें",
  "No staff checked in yet. Attendance is marked at Property Gate Kiosk.":"अभी कोई स्टाफ चेक-इन नहीं। उपस्थिति प्रॉपर्टी गेट किओस्क पर दर्ज की जाती है।",
  "Tap your name to check in":"चेक-इन के लिए अपना नाम टैप करें",
  "Mesa prep for tomorrow's functions. Cooking happens on live day.":"कल के फंक्शन के लिए मेसा तैयारी। खाना बनाना लाइव दिन पर होगा।",
  "Total prep items":"कुल तैयारी आइटम","Mesa Complete":"मेसा पूर्ण",
  "Create Your PIN":"अपना PIN बनाएं","First time login":"पहली बार लॉगिन",
  "Create a unique 4-digit PIN that only you know":"एक अद्वितीय 4 अंकों का PIN बनाएं जो केवल आप जानते हैं",
  "New PIN":"नया PIN","Confirm PIN":"PIN पुष्टि","PIN must be 4 digits":"PIN 4 अंकों का होना चाहिए",
  "PINs do not match":"PIN मेल नहीं खाते","Cannot use 0000. Choose a unique PIN.":"0000 का उपयोग नहीं कर सकते। अद्वितीय PIN चुनें।",
  "Save PIN & Continue":"PIN सहेजें और जारी रखें",
  "Show PINs":"PIN दिखाएं","Hide PINs":"PIN छुपाएं",
  "Mesa prep for tomorrow's functions. Cooking happens on live day.":"कल के फंक्शन के लिए मेसा तैयारी। खाना बनाना लाइव दिन पर होगा।",
  "D-1 Store Req":"D-1 स्टोर आवश्यकता","Live Prep":"लाइव तैयारी",
  "D-1 Store Requirements":"D-1 स्टोर आवश्यकताएं",
  "Collect these from store today for tomorrow's functions":"कल के फंक्शन के लिए आज स्टोर से कलेक्ट करें",
  "No beverage requirements for tomorrow":"कल के लिए कोई पेय आवश्यकता नहीं",
  "Live Beverage Prep":"लाइव पेय तैयारी",
  "Tap any beverage to start prep. Timers run until complete.":"किसी भी पेय पर टैप करें तैयारी शुरू करने के लिए। टाइमर पूरा होने तक चलता है।",
  "No beverages in today's functions":"आज के फंक्शन में कोई पेय नहीं",
  "unique dishes":"अद्वितीय व्यंजन","total pax":"कुल पैक्स",
  "Consolidated Mesa prep across all functions":"सभी फंक्शन के लिए समेकित मेसा तैयारी",
  "Consolidated cooking — one batch per dish for all functions":"समेकित खाना बनाना — सभी फंक्शन के लिए प्रति व्यंजन एक बैच",
  "dishes ready":"व्यंजन तैयार","Dispatch by function":"फंक्शन अनुसार रवानगी",
  "Fruit Counter":"फ्रूट काउंटर","Fresh Fruit Counter":"ताज़ा फल काउंटर",
  "Wash & sort fruits":"फल धोएं और छांटें","Peel & slice":"छीलें और काटें",
  "Arrange on platter":"प्लैटर पर सजाएं","Serve fresh":"ताज़ा परोसें",
  "Jain":"जैन","No Onion/Garlic":"प्याज/लहसुन नहीं",
  "Collect ingredients from Store":"स्टोर से सामान कलेक्ट करें",
  "Setup counter at venue":"वेन्यू पर काउंटर सेटअप","Prepare base mix":"बेस मिक्स तैयार करें",
  "Ice & garnish prep":"बर्फ और गार्निश तैयारी","Serve fresh on order":"ऑर्डर पर ताज़ा परोसें",
  "Boil water & brew":"पानी उबालें और काढ़ा बनाएं","Strain & serve":"छानें और परोसें",
  "Blend & mix":"ब्लेंड और मिक्स","Chill & serve":"ठंडा करें और परोसें",
  "Chill & arrange":"ठंडा करें और सजाएं","Serve on demand":"मांग पर परोसें",
  "Collect ingredients":"सामान कलेक्ट करें","Muddling":"मडलिंग","Mixing":"मिक्सिंग",
  "Primary prep":"प्राथमिक तैयारी","Final seasoning":"अंतिम मसाला","Garnish & plate":"गार्निश और प्लेट",
  "Masala prep":"मसाला तैयारी","Shaping":"आकार देना","Tandoor cook":"तंदूर पकाना",
  "Frying":"तलना","Sauce toss":"सॉस में टॉस","Stir fry":"स्टर फ्राई","Seasoning":"मसाला",
  "Boiling":"उबालना","Sauce":"सॉस","Final Cooking":"अंतिम पकाना",
  "Final Seasoning":"अंतिम मसाला","Chafing & Hold":"चेफ़िंग और होल्ड",
  "Pack & Load trucks":"पैक और ट्रक में लोड","Garnishing at venue":"वेन्यू पर गार्निश",
  "Head Chef final approval":"हेड शेफ अंतिम अनुमोदन",
  "Execution Checklist":"निष्पादन चेकलिस्ट",
  "D-1 Missed":"D-1 छूट गया","URGENT":"अत्यावश्यक",
  "D-1 Prep Done — Continue to cook":"D-1 तैयारी पूर्ण — खाना बनाना जारी रखें",
  "Fresh Today — Cook & serve":"आज ताज़ा — पकाएं और परोसें",
  "Kitchen Tasks":"किचन कार्य","Upcoming":"आगामी",
  "Click a date to see events":"इवेंट देखने के लिए तारीख पर क्लिक करें",
  "No functions on this date":"इस तारीख पर कोई फंक्शन नहीं",
  "Add Function":"फंक्शन जोड़ें","New Function":"नया फंक्शन","Edit Function":"फंक्शन संपादित करें",
  "GUEST NAME *":"अतिथि नाम *","VENUE":"वेन्यू","TYPE":"प्रकार","DATE *":"तारीख *",
  "TIME":"समय","TOTAL PAX *":"कुल पैक्स *","VEG":"शाकाहारी","NON-VEG":"मांसाहारी",
  "MENU PACKAGE":"मेनू पैकेज","CUSTOM MENU":"कस्टम मेनू","SPECIAL INSTRUCTIONS":"विशेष निर्देश",
  "Save Changes":"परिवर्तन सहेजें","Add Function ✓":"फंक्शन जोड़ें ✓",
  "Live today":"आज लाइव","Edit":"संपादित","Delete":"हटाएं",
  "Are you sure?":"क्या आप सुनिश्चित हैं?","Yes, Delete":"हाँ, हटाएं",
  "This Month":"इस महीने","FY Total":"वित्त वर्ष कुल",
  "Critical":"गंभीर","Action Required":"कार्रवाई आवश्यक","Note":"नोट","TMRW":"कल",
  "⚠ Special Food Tips":"⚠ विशेष भोजन सुझाव","Chef Alerts":"शेफ अलर्ट",
  "Jain Food":"जैन भोजन","No Eggs":"अंडा नहीं","Nut Allergy":"मेवा एलर्जी",
  "Lactose Free":"लैक्टोज फ्री","Gluten Free":"ग्लूटन फ्री",
  "Search recipes…":"रेसिपी खोजें…","No recipes found.":"कोई रेसिपी नहीं मिली।",
  "Search name or ID…":"नाम या आईडी खोजें…","Add Employee":"कर्मचारी जोड़ें",
  "Full catering menus for all events":"सभी इवेंट के लिए पूर्ण केटरिंग मेनू",
  "All Packages":"सभी पैकेज","Sign out":"साइन आउट","Loading…":"लोड हो रहा है…",
  "Dashboard":"डैशबोर्ड","Kitchen":"किचन","Menu":"मेनू पैकेज",
  "Team & Attendance":"टीम और उपस्थिति","Store & Inventory":"स्टोर और इन्वेंटरी",
  "Transport & Dispatch":"ट्रांसपोर्ट और रवानगी","Repair & Maintenance":"मरम्मत और रखरखाव",
  "Vendor Directory":"वेंडर डायरेक्टरी","Recipe SOPs":"रेसिपी SOP",
  "Attendance":"उपस्थिति","Directory":"डायरेक्टरी","Leaves":"छुट्टियां",
  "Approve":"स्वीकृत","Reject":"अस्वीकार","Pending":"लंबित","Approved":"स्वीकृत","Rejected":"अस्वीकृत",
  "Personal":"व्यक्तिगत","Medical":"चिकित्सा","Family emergency":"पारिवारिक आपातकाल","Casual":"सामान्य",
  "From":"से","To":"तक","Reason":"कारण","Cancel":"रद्द करें","Close":"बंद करें",
  "Search your name…":"अपना नाम खोजें…","Change Dept":"विभाग बदलें",
  "Requests go to Yatender for approval.":"अनुरोध यातेंदर को अनुमोदन के लिए जाते हैं।",
  "Returning in 4 seconds…":"4 सेकंड में वापसी…",
  "Completed":"पूर्ण","Pending":"लंबित",
  "All advance prep was done yesterday. Continue with cooking steps below.":"सारी एडवांस तैयारी कल हो गई थी। नीचे खाना बनाने के चरण जारी रखें।",
  "Mesa prep not done on D-1. Start from Mesa steps first.":"D-1 पर मेसा तैयारी नहीं हुई। पहले मेसा चरणों से शुरू करें।",
  "Mark as Complete":"पूर्ण चिह्नित करें","In-house — no dispatch needed":"इन-हाउस — रवानगी की ज़रूरत नहीं",
  "Needs dispatch to venue":"वेन्यू पर रवानगी ज़रूरी","Ready for Dispatch":"रवानगी के लिए तैयार",
  "Mark as Complete":"पूर्ण चिह्नित करें","In-house — no dispatch needed":"इन-हाउस — रवानगी की जरूरत नहीं",
  "Needs dispatch to venue":"वेन्यू पर रवानगी आवश्यक",
  "All advance prep was done yesterday. Continue with cooking steps below.":"कल की सारी अग्रिम तैयारी हो चुकी। नीचे खाना बनाने के चरण जारी रखें।",
  "Mesa prep not done on D-1. Start from Mesa steps first.":"D-1 पर मेसा तैयारी नहीं हुई। पहले मेसा चरण से शुरू करें।",
  "Beverage Operations":"पेय संचालन","upcoming":"आगामी",
  "Submit Request":"अनुरोध भेजें","Vendor Portal View":"वेंडर पोर्टल दृश्य",
  "Booking will be sent to this vendor":"बुकिंग इस वेंडर को भेजी जाएगी",
  "No specific event":"कोई विशिष्ट इवेंट नहीं","Reporting Time":"रिपोर्टिंग समय",
  "End Time":"समाप्ति समय","Expected Pax":"अपेक्षित पैक्स",
  "Staff Required by Section":"विभाग अनुसार स्टाफ आवश्यक",
  "Total staff requested":"कुल स्टाफ अनुरोधित","Additional Notes for Vendor":"वेंडर के लिए अतिरिक्त नोट्स",
  "Staff sent by vendor":"वेंडर द्वारा भेजा गया स्टाफ","Vendor Portal":"वेंडर पोर्टल",
  "Staff being sent":"भेजा जा रहा स्टाफ","Vendor Can Send":"वेंडर भेज सकता है",
  "All Sections":"सभी विभाग","Head Chefs":"हेड शेफ","New Employee":"नया कर्मचारी",
  "Add Employee":"कर्मचारी जोड़ें","No vehicles assigned yet":"अभी तक कोई वाहन असाइन नहीं",
  "Field notes":"फ़ील्ड नोट्स","No data":"कोई डेटा नहीं",
  "Repair & Maintenance":"मरम्मत और रखरखाव","Transport & Dispatch":"ट्रांसपोर्ट और रवानगी",
  "Open":"खुला","In Progress":"प्रगति में","Pending Approval":"अनुमोदन लंबित","Resolved":"हल","Closed":"बंद",
  "Store & Inventory":"स्टोर और इन्वेंटरी","Vendor Directory":"वेंडर डायरेक्टरी",
  "Select department to mark attendance":"उपस्थिति दर्ज करने के लिए विभाग चुनें",
  "Each tablet is locked to its department":"हर टैबलेट अपने विभाग पर लॉक है",
  "Property Gate Attendance":"प्रॉपर्टी गेट उपस्थिति",
  "Signing in…":"साइन इन हो रहा है…","Sign In →":"साइन इन →",
  "Ambria FnB Operations":"अम्ब्रिया F&B ऑपरेशंस","Employee ID":"कर्मचारी आईडी",
  "PIN":"पिन","Remember me":"मुझे याद रखें","Forgot PIN?":"पिन भूल गए?",
  "Contact Yatender":"यातेंदर से संपर्क करें",
  "Report":"रिपोर्ट","Create Ticket":"टिकट बनाएं","New Ticket":"नया टिकट",
  "Category":"श्रेणी","Priority":"प्राथमिकता","Description":"विवरण",
  "Assigned To":"को सौंपा","Status":"स्थिति","Created":"बनाया","Updated":"अपडेट",
  "No tickets":"कोई टिकट नहीं","Low":"कम","Medium":"मध्यम","High":"उच्च",
  "Vendor":"वेंडर","Specialty":"विशेषता","Rating":"रेटिंग","Rate":"दर",
  "Book Vendor":"वेंडर बुक करें","Bookings":"बुकिंग",
  "Punch In":"पंच इन","Punch Out":"पंच आउट","Punch In Recorded":"पंच इन दर्ज",
  "Punch Out Recorded":"पंच आउट दर्ज","Shift Complete":"शिफ्ट पूर्ण","Total Hours":"कुल घंटे",
  "Punched In at":"पंच इन समय","Enter PIN to Punch Out":"पंच आउट के लिए PIN दर्ज करें",
  "Verify & Punch Out":"सत्यापित करें और पंच आउट","Photo for punch-out verification":"पंच आउट सत्यापन के लिए फोटो",
  "Capture & Punch Out":"फोटो लें और पंच आउट","Shift Done":"शिफ्ट पूर्ण",
  "Punched In":"पंच इन हो चुका","Tap to Punch Out":"पंच आउट के लिए टैप करें",
  "Tap to Punch In":"पंच इन के लिए टैप करें","Morning":"सुबह","Evening":"शाम",
  "Chef":"शेफ","Steward":"स्टीवर्ड","Helper":"हेल्पर","Driver":"ड्राइवर","Supervisor":"सुपरवाइज़र",
  "Staff Allocation":"स्टाफ आवंटन","Auto-calculated based on menu package and guest count":"मेनू पैकेज और अतिथि संख्या के आधार पर स्वचालित गणना",
  "No events today or tomorrow":"आज या कल कोई इवेंट नहीं","staff needed":"स्टाफ आवश्यक",
  "Base":"आधार","Extra":"अतिरिक्त","Total":"कुल","staff":"स्टाफ",
  "Scale":"स्केल","staff per":"स्टाफ प्रति","Luxury rate":"लक्ज़री दर",
  "Grand Total Service Staff":"कुल सर्विस स्टाफ","No allocation data for this menu":"इस मेनू के लिए आवंटन डेटा नहीं",
  "Custom":"कस्टम","Tomorrow":"कल","Service Checklist":"सर्विस चेकलिस्ट","Event Briefing":"इवेंट ब्रीफिंग",
  "In":"इन","Out":"आउट","No staff checked in yet. Attendance is marked at Property Gate Kiosk.":"अभी तक कोई स्टाफ चेक-इन नहीं हुआ। उपस्थिति प्रॉपर्टी गेट कियोस्क पर दर्ज होती है।",
  "Staff roster for this department will be configured":"इस विभाग का स्टाफ रोस्टर कॉन्फ़िगर किया जाएगा",
  "Use Kiosk for attendance":"उपस्थिति के लिए कियोस्क का उपयोग करें",
  "Live Transport View":"लाइव ट्रांसपोर्ट दृश्य","Track all vehicles in real-time":"सभी वाहनों को रियल-टाइम में ट्रैक करें",
  "Total Fleet":"कुल बेड़ा","At Base":"बेस पर","Events Today":"आज के इवेंट",
  "Start Loading":"लोडिंग शुरू","Arrived":"पहुंच गए","Return":"वापसी",
  "Assign to event…":"इवेंट असाइन करें…","Driver name":"ड्राइवर का नाम","Driver":"ड्राइवर",
  "No dispatch today":"आज कोई रवानगी नहीं","Live Transport":"लाइव ट्रांसपोर्ट",
  "Today's Tasks":"आज के कार्य","D-1 Tomorrow Prep":"D-1 कल की तैयारी",
  "dishes had D-1 Mesa prep done yesterday":"व्यंजनों की D-1 मेसा तैयारी कल हो चुकी",
  "Those steps are marked D-1 ✅ below — team can skip to cooking":"वो चरण नीचे D-1 ✅ चिह्नित हैं — टीम सीधे खाना बनाना शुरू करे",
  "No D-1 prep was done yesterday":"कल कोई D-1 तैयारी नहीं हुई",
  "All steps including Mesa must be completed today":"सभी चरण मेसा सहित आज पूरे करने होंगे",
  "Mesa prep for tomorrow. Cooking will happen on live day.":"कल के लिए मेसा तैयारी। खाना बनाना लाइव दिन पर होगा।",
  "Kitchen Pickup":"किचन पिकअप","Kitchen Pickup Status":"किचन पिकअप स्थिति",
  "Real-time sync with Kitchen. Dishes marked ready by chefs appear here.":"किचन के साथ रियल-टाइम सिंक। शेफ द्वारा तैयार चिह्नित व्यंजन यहां दिखते हैं।",
  "Ready for Pickup":"पिकअप के लिए तैयार","Picked Up":"पिक अप हो गया","Cooking":"पक रहा है",
  "All dishes ready! Coordinate pickup with Kitchen.":"सभी व्यंजन तैयार! किचन से पिकअप समन्वय करें।",
  "In-house venue — no transport needed":"इन-हाउस वेन्यू — ट्रांसपोर्ट की जरूरत नहीं",
  "Loading Checklist":"लोडिंग चेकलिस्ट","Check off items as they are loaded into vehicles":"वाहनों में लोड होते समय आइटम चेक करें",
  "No venues need dispatch today":"आज किसी वेन्यू को रवानगी की जरूरत नहीं",
  "loaded":"लोड हुए","Waiting — Kitchen preparing":"प्रतीक्षा — किचन तैयार कर रहा",
  "Ready from Kitchen":"किचन से तैयार","All items loaded — vehicle ready to depart":"सभी आइटम लोड — वाहन रवाना होने को तैयार",
  "Chafing dishes & stands":"चेफ़िंग डिश और स्टैंड","Fuel / Sterno cans":"ईंधन / स्टर्नो कैन",
  "Crockery & Cutlery":"क्रॉकरी और कटलरी","Napkins & dustbins":"नैपकिन और डस्टबिन",
  "Gas cylinders":"गैस सिलेंडर","Ice & cold packs":"बर्फ और कोल्ड पैक",
  "Dispatched at":"रवाना हुआ",
  "Add Vehicle":"वाहन जोड़ें","Add vehicle to start dispatch plan":"रवाना योजना शुरू करने के लिए वाहन जोड़ें",
  "Editable by":"संपादन योग्य","Menu — Kitchen Status":"मेनू — रसोई स्थिति",
  "Ready":"तैयार","Dispatched":"रवाना","Today's Plan":"आज की योजना","Live Map":"लाइव मैप",
  "Load":"लोड","Unload":"अनलोड","LOADING":"लोडिंग","UNLOADING":"अनलोडिंग",
  "Search dishes…":"व्यंजन खोजें…","Dishes Checklist":"व्यंजन चेकलिस्ट",
  "Loaded":"लोड हुआ","Unloaded":"अनलोड हुआ","Vehicles":"वाहन","No events loaded":"कोई इवेंट लोड नहीं",
  "Select Function":"फंक्शन चुनें",
  "Outdoor / Daily Wages Staff":"आउटडोर / दैनिक वेतन स्टाफ","Outdoor Staff":"आउटडोर स्टाफ",
  "Enter details for attendance":"उपस्थिति के लिए विवरण दर्ज करें",
  "Already Checked In":"पहले से चेक इन","New Staff Entry":"नया स्टाफ एंट्री",
  "Full Name":"पूरा नाम","Enter full name":"पूरा नाम दर्ज करें","Phone":"फोन",
  "Role":"भूमिका","Vendor / Agency":"वेंडर / एजेंसी","Optional":"वैकल्पिक",
  "Continue to Photo":"फोटो के लिए जारी रखें",
  "Helper":"हेल्पर","Cook":"रसोइया","Service Staff":"सर्विस स्टाफ",
  "Cleaner":"सफाईकर्मी","Loader":"लोडर","Electrician":"इलेक्ट्रीशियन",
  "Plumber":"प्लंबर","Decorator":"डेकोरेटर","Other":"अन्य",
  "Coming soon — actual SOPs will be added in next phase":"जल्द आ रहा है — अगले चरण में वास्तविक SOP जोड़े जाएंगे",
  "alerts":"अलर्ट",
  "ODC Bookings":"ODC बुकिंग","Total ODC":"कुल ODC","Total Pax":"कुल अतिथि",
  "Menu Breakdown":"मेनू विवरण","Kitchen Status for ODC":"ODC के लिए किचन स्थिति",
  "Real-time sync with Kitchen team":"किचन टीम के साथ रियल-टाइम सिंक",
  "No ODC events today/tomorrow":"आज/कल कोई ODC इवेंट नहीं","Sent":"भेजा",
  "ODC Transport Status":"ODC ट्रांसपोर्ट स्थिति",
  "Vehicle assignment and dispatch tracking for ODC":"ODC के लिए वाहन और रवानगी ट्रैकिंग",
  "Vehicles assigned via Transport & Dispatch module":"वाहन ट्रांसपोर्ट मॉड्यूल से असाइन होंगे",
  "Site Checklist":"साइट चेकलिस्ट","Kitchen Status":"किचन स्थिति",

  "Add Function":"फंक्शन जोड़ें","Add":"जोड़ें","Camera":"कैमरा","Delete":"हटाएं",
  "Dispatch":"रवानगी","Dispatched":"रवाना","Edit":"संपादन",
  "Equipment":"उपकरण","Gas cylinders":"गैस सिलेंडर",
  "In":"अंदर","Lead":"प्रमुख",
  "Live Fleet Map":"लाइव फ्लीट मैप","Loading / Unloading Checklist":"लोडिंग / अनलोडिंग चेकलिस्ट",
  "Menu":"मेनू","No events today":"आज कोई इवेंट नहीं","PIN":"पिन",
  "Pending":"लंबित","Procedures in Hindi":"हिंदी में विधि",
  "Punch In":"पंच इन","Punch Out":"पंच आउट","Punched In":"पंच इन हो चुका",
  "Real-time tracking":"रियल-टाइम ट्रैकिंग","Reason":"कारण",
  "Service Staff Allocation":"सर्विस स्टाफ आवंटन","Start":"शुरू",
  "Today's Plan":"आज की योजना","Total":"कुल","Upcoming":"आगामी",
  "Vehicle":"वाहन","Vendor Portal":"वेंडर पोर्टल","Venue":"वेन्यू",
  "dishes ready":"व्यंजन तैयार","staff":"स्टाफ",
  "Scan Barcode":"बारकोड स्कैन करें","Stock In":"स्टॉक इन","Stock Out":"स्टॉक आउट",
  "Master Data":"मास्टर डेटा","Inventory":"इन्वेंटरी","Barcode":"बारकोड",
  "Product Name":"उत्पाद का नाम","Category":"श्रेणी","Unit":"इकाई",
  "Current Stock":"वर्तमान स्टॉक","Min Stock":"न्यूनतम स्टॉक",
  "Add New Item":"नया आइटम जोड़ें","Scan to add":"स्कैन करके जोड़ें",
  "Item added successfully":"आइटम सफलतापूर्वक जोड़ा गया",
  "Stock updated":"स्टॉक अपडेट हुआ","Qty":"मात्रा",
  "Search items…":"आइटम खोजें…","All Categories":"सभी श्रेणियां",
  "Low Stock":"कम स्टॉक","In Stock":"स्टॉक में","Out of Stock":"स्टॉक खत्म",
  "Transaction History":"लेन-देन इतिहास","No items found":"कोई आइटम नहीं मिला",
  "Scanning…":"स्कैन हो रहा है…","Point camera at barcode":"बारकोड पर कैमरा करें",
  "Product found!":"उत्पाद मिला!","Not in database":"डेटाबेस में नहीं",
  "Brand":"ब्रांड","MRP":"एमआरपी","Weight":"वज़न",
  "Save to Master Data":"मास्टर डेटा में सेव करें",
  "kg":"किलो","g":"ग्राम","L":"लीटर","ml":"मिली","pcs":"पीस","pkt":"पैकेट","box":"बॉक्स","dozen":"दर्जन",
  "Store & Inventory":"स्टोर और इन्वेंटरी","items":"आइटम",
  "Kitchen Tasks":"किचन कार्य","Site Checklist":"साइट चेकलिस्ट",
  "ODC Bookings":"ODC बुकिंग",
  "Scan & Stock":"स्कैन और स्टॉक","Stock In":"स्टॉक इन","Stock Out":"स्टॉक आउट",
  "Point camera at barcode":"बारकोड पर कैमरा करें","Scan":"स्कैन","Stop":"रुकें",
  "No transactions yet. Scan an item to begin.":"अभी कोई लेन-देन नहीं। शुरू करने के लिए आइटम स्कैन करें।",
  "Purchase":"खरीद","Return":"वापसी","Transfer In":"ट्रांसफर इन","Opening Stock":"ओपनिंग स्टॉक",
  "Event Use":"इवेंट उपयोग","Damage":"टूट-फूट","Expired":"एक्सपायर्ड","Transfer Out":"ट्रांसफर आउट","Correction":"सुधार",
  "📦 Inventory":"📦 इन्वेंटरी","📷 Scan & Stock":"📷 स्कैन और स्टॉक",
  "🛒 Orders":"🛒 ऑर्डर","📋 Event Requirements":"📋 इवेंट आवश्यकताएं",
  "Smart Issue":"स्मार्ट इश्यू","🧮 Smart Issue":"🧮 स्मार्ट इश्यू",
  "Auto-calculated ingredient bags per kitchen section based on event menus and pax":"इवेंट मेनू और पैक्स के आधार पर किचन सेक्शन वार ऑटो-गणना सामग्री बैग",
  "issued":"जारी","Events":"इवेंट","Sections":"सेक्शन","Items":"आइटम",
  "All Issued":"सब जारी","Issue All":"सब जारी करें","Item":"आइटम",
  "Not in inventory":"इन्वेंटरी में नहीं","In Stock":"स्टॉक में",
  "No events with recipe data. Add recipes with ingredients to enable Smart Issue.":"रेसिपी डेटा वाले कोई इवेंट नहीं। स्मार्ट इश्यू के लिए सामग्री वाली रेसिपी जोड़ें।",
  "Tap stock number to edit":"स्टॉक संख्या पर टैप करें संपादन के लिए",
  "Out":"खत्म","Low":"कम","OK":"ठीक","Order":"ऑर्डर",
  "pending orders":"लंबित ऑर्डर","Add Item":"आइटम जोड़ें",
  "Save to Inventory":"इन्वेंटरी में सेव करें","Looking up in product databases…":"प्रोडक्ट डेटाबेस में खोज रहे हैं…",
  "Found in your inventory":"आपकी इन्वेंटरी में मिला","Product not found":"प्रोडक्ट नहीं मिला",
  "Barcode scanning not supported on this browser. Enter barcode manually.":"इस ब्राउज़र में बारकोड स्कैन नहीं होगा। मैन्युअल बारकोड दर्ज करें।",
  "Halwai & Savoury":"Halwai & Savoury","Indian Tandoor":"Indian Tandoor","Chinese & Pan-Asian":"Chinese & Pan-Asian","Indian Main Course":"Indian Main Course","Indian Desserts":"Indian Desserts",
  "Dish Ready!":"व्यंजन तैयार!","Take a photo of the completed dish before marking as done":"मार्क करने से पहले तैयार व्यंजन की फोटो लें",
  "Capture Photo":"फोटो लें","Retake":"दोबारा लें","Confirm Ready":"तैयार पुष्टि करें",
  "Starting camera…":"कैमरा शुरू हो रहा है…",
  "Go Collect Items":"सामान लेने जाएं","1 hr timer":"1 घंटे का टाइमर",
  "Done Collecting":"कलेक्शन पूरा","elapsed":"बीत गया","remaining of 1 hr limit":"1 घंटे की सीमा में शेष",
  "Quality Remarks":"गुणवत्ता टिप्पणी",
  "e.g. Paneer fresh, tomatoes slightly overripe, onion good quality…":"जैसे: पनीर ताज़ा, टमाटर थोड़े पके, प्याज़ अच्छी गुणवत्ता…",
  "Collected":"कलेक्ट किया","Ingredients collected":"सामग्री कलेक्ट की","Done":"पूरा",
  "Excellent":"उत्कृष्ट","Good":"अच्छा","Average":"ठीक-ठाक","Poor Quality":"खराब गुणवत्ता","Items Missing":"सामान गायब",
  "D-1 Prep":"D-1 तैयारी","Event Day":"इवेंट दिन","Prepping for":"की तैयारी",
  "These are advance prep steps — Mesa, marination, grinding, cutting, dough. Actual cooking will happen on the event day":"ये अग्रिम तैयारी के चरण हैं — मेसा, मैरिनेशन, पीसना, काटना, आटा। असली खाना इवेंट के दिन बनेगा",
  "No events today — focus on D-1 prep below":"आज कोई इवेंट नहीं — नीचे D-1 तैयारी पर ध्यान दें",
  "Today is a D-1 prep day.":"आज D-1 तैयारी का दिन है।",
  "Switch to the D-1 tab to see all advance prep tasks for tomorrow's function.":"कल के फंक्शन की सभी अग्रिम तैयारी देखने के लिए D-1 टैब पर जाएं।",
  "Go to D-1 Prep":"D-1 तैयारी पर जाएं",
  "Event day cooking for":"इवेंट दिन खाना बनाना","No functions tomorrow":"कल कोई फंक्शन नहीं",
  "for":"के लिए","Event Day":"इवेंट डे",
  "Event Closure Report":"इवेंट क्लोज़र रिपोर्ट","Dishes Ready":"व्यंजन तैयार","Dispatched":"रवाना",
  "Staff Present":"स्टाफ उपस्थित","Kitchen Summary":"किचन सारांश","Staff on Duty":"ड्यूटी पर स्टाफ",
  "staff present today":"स्टाफ आज उपस्थित","Attendance not marked yet":"अभी उपस्थिति नहीं ली",
  "Head Chef Remarks":"हेड शेफ की टिप्पणी","Overall Rating":"कुल रेटिंग","Needs Work":"सुधार ज़रूरी",
  "Overall quality, timing, issues, improvements needed…":"कुल गुणवत्ता, समय, समस्याएं, सुधार…",
  "Download Report":"रिपोर्ट डाउनलोड","Event Details":"इवेंट विवरण","Total Dishes":"कुल व्यंजन",
  "Staff Today":"आज का स्टाफ","Low Stock":"कम स्टॉक","Open Issues":"खुले मुद्दे",
  "items need reorder":"आइटम को रीऑर्डर चाहिए","repair tickets":"रिपेयर टिकट",
  "Upcoming Functions":"आगामी फंक्शन","Tomorrow":"कल","of":"में से",
  "Pax Scaling":"पैक्स स्केलिंग","Pax Scaling Logic Panel":"पैक्स स्केलिंग लॉजिक पैनल",
  "Ingredient quantities auto-calculated from SOP base. Chefs can edit any cell.":"SOP बेस से ऑटो-कैलकुलेट। शेफ कोई भी सेल एडिट कर सकते हैं।",
  "Base: 1100 pax (highlighted). All other columns scale proportionally. Tap any quantity to override it.":"बेस: 1100 पैक्स। बाकी कॉलम अनुपात में। किसी भी मात्रा पर टैप करें।",
  "Select a dish to scale":"स्केल करने के लिए व्यंजन चुनें","Ingredient":"सामग्री",
  "Ingredient Scaling Table":"सामग्री स्केलिंग टेबल",
  "Select a dish above to see ingredient quantities across all pax columns.":"ऊपर से व्यंजन चुनें।",
  "SOP base is 1100 pax":"SOP बेस 1100 पैक्स है","All other columns auto-calculate.":"बाकी कॉलम ऑटो-कैलकुलेट।",
  "Tap any quantity to override — for custom event requirements.":"किसी भी मात्रा पर टैप करें — कस्टम इवेंट के लिए।",
  "Reset to SOP values":"SOP वैल्यू पर रीसेट करें",
  "Select a dish":"व्यंजन चुनें","Select dishes":"व्यंजन चुनें","Clear":"साफ करें",
  "dishes will be shown":"व्यंजन दिखेंगे","in package":"पैकेज में",
  "Select a dish to see its scaling table":"स्केलिंग टेबल देखने के लिए व्यंजन चुनें",
  "Select dishes from the package to scale":"पैकेज से व्यंजन चुनें",
  "Select a menu package to scale all dishes":"सभी व्यंजन स्केल करने के लिए मेनू पैकेज चुनें",
  "All columns auto-calculate":"सभी कॉलम ऑटो-कैलकुलेट","Reset":"रीसेट",
  "Menu Applicability by Pax":"मेनू पैक्स अनुसार उपयुक्तता",
  "Menu Package":"मेनू पैकेज","Code":"कोड","Type":"प्रकार","Applicable":"लागू",
  "Not recommended":"अनुशंसित नहीं","Tap any":"किसी भी",
  "to load that menu's ingredient scaling":"पर टैप करें उस मेनू की स्केलिंग देखने के लिए",
  "Ingredient Scaling":"सामग्री स्केलिंग","Menu applicability matrix + ingredient quantities. Base: 1100 pax":"मेनू उपयुक्तता मैट्रिक्स + सामग्री मात्रा। बेस: 1100 पैक्स",
  "D-1 Prep Day":"D-1 तैयारी दिन",
  "Repair & Maintenance":"रिपेयर और मेंटेनेंस","Shared pool — all departments":"साझा पूल — सभी विभाग",
  "All Depts":"सभी विभाग","Raise From Dept":"विभाग से उठाएं",
  "Issue Title":"समस्या का शीर्षक","Timeline":"टाइमलाइन",
  "Add update, comment or action taken…":"अपडेट, टिप्पणी या की गई कार्रवाई लिखें…",
  "Ticket will be visible to all departments":"टिकट सभी विभागों को दिखेगा",
  "Reassign":"पुनः सौंपें","Update Status":"स्टेटस अपडेट करें",
  "Post":"पोस्ट","Submit Request":"अनुरोध भेजें","Yesterday":"कल",
  "Furniture & Civil":"फर्नीचर और सिविल","IT / Software":"आईटी/सॉफ्टवेयर",
  "Final Cooking":"फाइनल कुकिंग","No Event":"कोई इवेंट नहीं",
  "Parallel work today":"आज का समानांतर काम","Final cooking for":"के लिए फाइनल कुकिंग",
  "see Event Day tab":"इवेंट डे टैब देखें","D-1 prep for":"के लिए D-1 तैयारी",
  "this tab":"यह टैब","function":"फंक्शन",
  "Continue":"कंटिन्यू","Final Cooking":"फाइनल कुकिंग",
  "Collective":"कुल मिलाकर","Showing":"दिखा रहे हैं","function dishes only":"फंक्शन के व्यंजन",
  "Show all":"सभी दिखाएं",

  // ── ACCESS MANAGER ──
  "Changes saved":"परिवर्तन सहेजे गए",
  "Has Access":"एक्सेस है",
  "No Access":"कोई एक्सेस नहीं",
  "screens active":"स्क्रीन सक्रिय",
  "No app access":"कोई ऐप एक्सेस नहीं",
  "Set Access":"एक्सेस दें",
  "Edit Access":"एक्सेस संपादित करें",
  "Suspend":"निलंबित करें",
  "Restore":"पुनर्स्थापित करें",
  "Suspended":"निलंबित",
  "PIN Management":"PIN प्रबंधन",
  "Showing role defaults":"डिफ़ॉल्ट भूमिका दिखा रहे हैं",
  "Search staff by name or ID…":"स्टाफ नाम या ID से खोजें…",
  "Staff":"स्टाफ",
  "Access Manager":"एक्सेस मैनेजर",
  "Manage staff accounts, roles & permissions — Admin only":"स्टाफ खाते, भूमिकाएं व अनुमतियां प्रबंधित करें — केवल एडमिन",
  "+ Add Staff":"+ स्टाफ जोड़ें",
  "Admins":"एडमिन",
  "Tablets":"टैबलेट",
  "Search by name or ID…":"नाम या ID से खोजें…",
  "All Roles":"सभी भूमिकाएं",
  "Edit Staff":"स्टाफ संपादित करें",
  "Add New Staff":"नया स्टाफ जोड़ें",
  "Staff ID *":"स्टाफ ID *",
  "Full Name *":"पूरा नाम *",
  "Role / Access Level":"भूमिका / एक्सेस स्तर",
  "Change PIN":"PIN बदलें",
  "New 4-digit PIN":"नया 4 अंकों का PIN",
  "PIN must be exactly 4 digits":"PIN बिल्कुल 4 अंकों का होना चाहिए",
  "Status:":"स्थिति:",
  "✓ Add Staff Member":"✓ स्टाफ सदस्य जोड़ें",
  "Permanently Delete Staff?":"स्टाफ को स्थायी रूप से हटाएं?",
  "This removes their login access forever.":"इससे उनकी लॉगिन एक्सेस हमेशा के लिए हटेगी।",
  "💡 Prefer Deactivate to block login while keeping their records.":"💡 रिकॉर्ड सुरक्षित रखते हुए लॉगिन ब्लॉक करने के लिए डीएक्टिवेट करें।",
  "Type DELETE to confirm:":"पुष्टि के लिए DELETE टाइप करें:",
  "Type DELETE here":"यहाँ DELETE टाइप करें",
  "🗑 Confirm Delete":"🗑 हटाने की पुष्टि करें",
  "Screen Access":"स्क्रीन एक्सेस",
  "🔑 Edit Permissions":"🔑 अनुमतियां संपादित करें",
  "No staff found":"कोई स्टाफ नहीं मिला",
  "← Back":"← वापस",
  "🔑 Screen Permissions":"🔑 स्क्रीन अनुमतियां",
  "⚡ Role Templates — Quick Apply":"⚡ भूमिका टेम्पलेट — त्वरित लागू",
  "✓ Apply This Template":"✓ यह टेम्पलेट लागू करें",
  "👁 Access Preview":"👁 एक्सेस पूर्वावलोकन",
  "will access:":"एक्सेस कर सकेगा:",
  "will have NO screen access.":"की कोई स्क्रीन एक्सेस नहीं होगी।",
  "Will NOT see:":"नहीं देखेगा:",
  "✓ Save Permissions":"✓ अनुमतियां सहेजें",
  "Admin only — always locked":"केवल एडमिन — हमेशा लॉक",
  "Preview —":"पूर्वावलोकन —",
  // Screen group headings
  "KITCHEN & OPS":"रसोई व संचालन",
  "MANAGEMENT":"प्रबंधन",
  "DEPARTMENTS":"विभाग",
  "ADMIN ONLY":"केवल एडमिन",
  // Screen labels (short)
  "Kitchen Hub":"किचन हब",
  "Menu Packages":"मेनू पैकेज",
  "Repair & Maint.":"मरम्मत व रखरखाव",
  "Service Ops":"सेवा संचालन",
  "Crockery Ops":"क्रॉकरी संचालन",
  "Beverages Ops":"पेय संचालन",
  // Screen descriptions
  "Prep tracking & live kitchen ops":"तैयारी ट्रैकिंग और लाइव किचन",
  "Stock levels, issue & receive items":"स्टॉक स्तर और आइटम जारी करें",
  "Event menus, packages & recipes":"इवेंट मेनू, पैकेज और रेसिपी",
  "Dispatch & delivery tracking":"रवानगी और डिलीवरी ट्रैकिंग",
  "Outside dining & catering ops":"बाहरी खाना और केटरिंग",
  "Event overview, alerts & KPIs":"इवेंट अवलोकन, अलर्ट और KPIs",
  "Attendance, leaves & staff records":"उपस्थिति, छुट्टियां और स्टाफ",
  "Supplier contacts & orders":"सप्लायर संपर्क और ऑर्डर",
  "Equipment repairs & tickets":"उपकरण मरम्मत और टिकट",
  "Front-of-house & banquet service":"फ्रंट-ऑफ-हाउस और बैंक्वेट",
  "Crockery inventory & breakage":"क्रॉकरी इन्वेंटरी और टूट-फूट",
  "Beverage planning & bar ops":"पेय योजना और बार",
  "Staff accounts, roles & permissions":"स्टाफ खाते, भूमिकाएं और अनुमतियां",
  // Role option labels (full strings used in ROLE_OPTIONS)
  "👑 Admin — Full Access":"👑 एडमिन — पूर्ण एक्सेस",
  "👨‍🍳 Head Chef":"👨‍🍳 हेड शेफ",
  "🥢 Chinese Section":"🥢 चाइनीज़ विभाग",
  "🍛 Indian Curries":"🍛 इंडियन करी",
  "🔥 Tandoor":"🔥 तंदूर",
  "🍝 Continental":"🍝 कॉन्टिनेंटल",
  "🍮 Sweets":"🍮 मिठाई",
  "🥗 Chaat":"🥗 चाट",
  "🍽 Service":"🍽 सेवा",
  "🍶 Crockery":"🍶 क्रॉकरी",
  "🥤 Beverages":"🥤 पेय पदार्थ",
  "🚛 Transport":"🚛 ट्रांसपोर्ट",
  "🏛 Gate Kiosk":"🏛 गेट किओस्क",

  // ── VENDOR DIRECTORY (gaps) ──
  "Outside chefs, suppliers, service partners":"बाहरी शेफ, सप्लायर, सेवा भागीदार",
  "+ Add Vendor":"+ वेंडर जोड़ें",
  "✓ Add Vendor":"✓ वेंडर जोड़ें",
  "Added By":"जोड़ा:",
  "Added by":"जोड़ा:",
  "Edit —":"संपादित —",
  "Remove":"हटाएं",

  // ── REPAIR & MAINTENANCE (gaps) ──
  "⏱ Date":"⏱ तारीख",
  "⚠ Priority":"⚠ प्राथमिकता",
};
// T() — translate string if Hindi mode
function T(key, lang) {
  if(!key || typeof key !== "string") return key || "";
  if(lang==="hi") { try { return HI[key] || key; } catch(e) { return key; } }
  return key;
}

// ─── SAFE UTILITIES (crash prevention) ───────────────────────────
function safeArr(v) { return Array.isArray(v) ? v : []; }
function safeObj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function safeStr(v) { return typeof v === "string" ? v : String(v || ""); }
function safeNum(v, fallback=0) { const n = Number(v); return isNaN(n) ? fallback : n; }
function safePct(num, den) { return den > 0 ? Math.round((num / den) * 100) : 0; }
function safeDivide(a, b, fallback=0) { return b !== 0 ? a / b : fallback; }
function safeJSON(str, fallback=null) { try { return JSON.parse(str); } catch(e) { return fallback; } }
function safeStorage(key, fallback=null) { return fallback; }
function safeStorageSet(key, val) { /* no-op in artifact */ }


// ─── ERROR BOUNDARY ──────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={hasError:false,error:null,errorInfo:null}; }
  static getDerivedStateFromError(e){ return {hasError:true,error:e}; }
  componentDidCatch(e,info){
    console.error("Ambria App Error:",e,info);
    this.setState({errorInfo:info});
    // Log to crash report (future: send to server)
    // crash logged to console
  }
  render(){
    if(this.state.hasError){
      const lang = this.props.lang||"en";
      const isHi = lang==="hi";
      return (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",padding:40,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
          <div style={{fontSize:18,fontWeight:700,color:C.gold,marginBottom:8}}>{isHi?"कुछ गलत हो गया":"Something went wrong"}</div>
          <div style={{fontSize:12,color:"#888",marginBottom:8,maxWidth:400}}>{this.state.error?.message||"An unexpected error occurred."}</div>
          <div style={{fontSize:10,color:"#aaa",marginBottom:20}}>{isHi?"चिंता न करें, आपका डेटा सुरक्षित है।":"Don't worry, your data is safe."}</div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>this.setState({hasError:false,error:null,errorInfo:null})} style={{padding:"10px 24px",borderRadius:9,background:"#6B1818",color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>↺ {isHi?"पुनः प्रयास":"Retry"}</button>
            <button onClick={()=>{this.setState({hasError:false,error:null,errorInfo:null});try{window.location.reload();}catch(e){}}} style={{padding:"10px 24px",borderRadius:9,background:"#F2F1EE",color:"#444",border:"1px solid #ddd",fontSize:13,cursor:"pointer"}}>{isHi?"ऐप रिफ्रेश":"Refresh App"}</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


const NAV_ADMIN = [
  {id:"dashboard",  label:"Dashboard",           icon:"📊"},
  {id:"team",       label:"Team & Attendance",    icon:"👥"},
  {id:"kitchen",    label:"Kitchen",              icon:"👨‍🍳"},
  {id:"menus",      label:"Menu",        icon:"📜"},
  {id:"transport",  label:"Transport & Dispatch", icon:"🚛"},
  {id:"store",      label:"Store & Inventory",    icon:"📦"},
  {id:"repair",     label:"Repair & Maintenance",  icon:"🔧"},
  {id:"vendors",    label:"Vendor Directory",      icon:"🤝"},
];
const NAV = NAV_ADMIN;


// ─── VENUE DATA FROM PPT ──────────────────────────────────────────
const AMBRIA_VENUES = [
  {id:"ap",  code:"AP",  name:"Ambria Pushpanjali", location:"Dwarka, Delhi",
   capacity:1500, area:"3 Acres", banquet:"14,000 sq.ft", lawn:"40,000 sq.ft",
   parking:"125+ cars", color:C.gold, bg:C.redBg,
   sections:["Indoor Banquet","Grand Lawn","Walkway (120 ft)"],
   highlight:"Exclusive single-event · Near IGI Airport"},
  {id:"am",  code:"AM",  name:"Ambria Manaktala",   location:"Kapasher, Delhi",
   capacity:2500, area:"3 Acres", banquet:"24,000 sq.ft", lawn:"43,000 sq.ft",
   parking:"250+ cars", color:"#185FA5", bg:"#EEF4FD",
   sections:["Emerald Lawn (Glasshouse + Lawn)","Alstonia Lawn (Open + Covered)","Hanger (8,000 sq.ft)"],
   highlight:"Two venues · 400 ft driveway · Valet parking"},
  {id:"ae",  code:"AE",  name:"Ambria Exotica",     location:"Dwarka, Delhi",
   capacity:1800, area:"4 Acres", banquet:"20,500 sq.ft", lawn:"35,000 sq.ft",
   parking:"300–350 cars", color:"#854F0B", bg:C.goldBg,
   sections:["Aura (Glasshouse + Lawn + Porch)","Valencia (Glasshouse + Lawn + Poolside)"],
   highlight:"Two glasshouses · Poolside venue · 20,000 sq.ft walkway"},
  {id:"ar",  code:"AR",  name:"Ambria Restro",      location:"Dwarka, Delhi",
   capacity:400, area:"0.75 Acres", banquet:"1,500 sq.ft", lawn:"8,000 sq.ft",
   parking:"100+ cars", color:"#0F6E56", bg:"#0E1E1A",
   sections:["Glasshouse (8,000 sq.ft)","Lawn (1,500 sq.ft)","Rooftop","Café / Restro","Pickle Ball Court"],
   highlight:"Rooftop · Café · Pickle Ball Court · Intimate events"},
  {id:"odc", code:"ODC", name:"Outdoor Catering",   location:"Client location",
   capacity:null, area:"Varies", banquet:"N/A", lawn:"N/A",
   parking:"N/A", color:"#5A3FA0", bg:"#F0EDFC",
   sections:["Off-premise events","Client farmhouses","Corporate venues","Banquet halls"],
   highlight:"Gopal leads all ODC events personally"},
];

// ─── REUSABLE ─────────────────────────────────────────────────
function Avatar({name,size=34,index=0}) {
  const bg=AVATAR_COLORS[index%AVATAR_COLORS.length];
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:size*0.38,fontWeight:700,color:"#fff",flexShrink:0,fontFamily:"var(--font-display)"}}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function DonutChart({pct=0,color="#2B8A50",size=80,icon="🍽️"}) {
  const r=30, circ=2*Math.PI*r;
  const dash=circ*(pct/100), gap=circ-dash;
  return (
    <div style={{position:"relative",width:size,height:size,margin:"0 auto"}}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#2A2824" strokeWidth="7"/>
        {pct>0&&<circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"
          transform="rotate(-90 40 40)" style={{transition:"stroke-dasharray .5s"}}/>}
        <circle cx="40" cy="40" r="3" fill={color} opacity={pct>0?1:0}
          transform={`rotate(${(pct/100)*360-90} 40 40) translate(30 0)`}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
        <span style={{fontSize:14}}>{icon}</span>
        <span style={{fontSize:12,fontWeight:700,color:pct>0?color:C.muted}}>{pct}%</span>
      </div>
    </div>
  );
}

function Chip({label,color=C.muted,bg=C.darkCard,size=11}) {
  return <span style={{display:"inline-block",fontSize:size,fontWeight:500,padding:"2px 9px",borderRadius:20,background:bg,color,whiteSpace:"nowrap"}}>{label}</span>;
}

function STag({name}) {
  const m=SECTION_META[name]||{bg:C.darkCard,color:C.muted,icon:""};
  return <span style={{fontSize:11,fontWeight:500,padding:"2px 9px",borderRadius:20,background:m.bg,color:m.color,border:`1px solid ${m.color}20`}}>{m.icon} {name}</span>;
}

function Card({children,style={},className=""}) {
  return <div className={"fade-in-up "+className} style={{
    background:`linear-gradient(145deg, ${C.surface} 0%, ${C.darkCard} 100%)`,
    border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 22px",
    boxShadow:`0 8px 32px ${C.shadow}, 0 0 1px ${C.glow}, inset 0 1px 0 rgba(255,255,255,.03)`,
    backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",
    transition:"all .3s cubic-bezier(.23,1,.32,1)",
    ...style
  }}>{children}</div>;
}

function Btn({children,onClick,color=C.gold,textColor="#0E0D0B",border="none",style={}}) {
  return <button onClick={onClick} style={{
    padding:"9px 18px",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",
    background:color,color:textColor,border,letterSpacing:.4,
    boxShadow:`0 2px 8px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.15)`,
    transition:"all .25s cubic-bezier(.23,1,.32,1)",
    minHeight:40,
    ...style
  }}>{children}</button>;
}

function SectionHeader({icon,title}) {
  return <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:14,display:"flex",alignItems:"center",gap:8,fontFamily:"var(--font-display)",letterSpacing:.5}}>{icon} {title}</div>;
}

// ─── SELFIE CAPTURE ────────────────────────────────────────────
function SelfieCapture({onCapture,onRetake,captured,lang="en"}) {
  const T2 = s => T(s, lang);
  const vRef=useRef(null), cRef=useRef(null);
  const [streaming,setStreaming]=useState(false);
  const [err,setErr]=useState(null);
  const [loading,setLoading]=useState(false);
  useEffect(()=>()=>{vRef.current?.srcObject?.getTracks().forEach(t=>t.stop());},[]);
  async function start(){
    setLoading(true);setErr(null);
    try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}});vRef.current.srcObject=s;await vRef.current.play();setStreaming(true);}
    catch{setErr("Camera access denied.");}
    setLoading(false);
  }
  function snap(){
    const cv=cRef.current,vd=vRef.current;
    cv.width=vd.videoWidth;cv.height=vd.videoHeight;
    cv.getContext("2d").drawImage(vd,0,0);
    vd.srcObject?.getTracks().forEach(t=>t.stop());setStreaming(false);
    onCapture(cv.toDataURL("image/jpeg",.8));
  }
  if(captured) return (
    <div style={{textAlign:"center"}}>
      <img src={captured} alt="selfie" style={{width:160,height:120,objectFit:"cover",borderRadius:10,border:`2px solid ${C.greenBorder}`,marginBottom:8}}/>
      <div><Chip label="✓ Photo captured" color={C.green} bg={C.greenBg}/></div>
      <button onClick={()=>{onRetake();start();}} style={{marginTop:8,fontSize:11,background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",color:C.muted}}>{T2("Retake")}</button>
    </div>
  );
  return (
    <div style={{textAlign:"center"}}>
      <div style={{width:160,height:120,borderRadius:10,overflow:"hidden",background:C.bg,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>
        <video ref={vRef} style={{width:"100%",height:"100%",objectFit:"cover",display:streaming?"block":"none"}}/>
        {!streaming&&<div style={{color:C.muted,fontSize:13}}>📷<br/>{T2("Camera")}</div>}
      </div>
      <canvas ref={cRef} style={{display:"none"}}/>
      {err&&<div style={{fontSize:11,color:C.red,marginBottom:6}}>{err}</div>}
      {!streaming
        ?<Btn onClick={start} style={{fontSize:12}}>{loading?"Starting…":"Open Camera"}</Btn>
        :<Btn onClick={snap} color={C.green} style={{fontSize:12}}>📸 Capture</Btn>
      }
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────
// ─── LOGIN SCREEN ─────────────────────────────────────────────────
// ─── LOGIN SCREEN ─────────────────────────────────────────────────
function LoginScreen({ empDb, onLogin, lang="en" }) {
  const T2 = s => T(s, lang);
  const safeDb = safeArr(empDb);
  const [empId,  setEmpId]  = useState("");
  const [pin,    setPin]    = useState("");
  const [error,  setError]  = useState("");
  const [loading,setLoading]= useState(false);
  const [remember,setRemember]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const [rid,rpin,rrem]=await Promise.all([
          window.storage?.get("ambria_emp_id"),
          window.storage?.get("ambria_pin"),
          window.storage?.get("ambria_remember"),
        ]);
        if(rrem?.value==="true" && rid?.value && rpin?.value){
          const id  = rid.value.trim().toUpperCase();
          const pin2 = rpin.value.trim();
          const emp  = (empDb||[]).find(e=>(e.staffListId||e.staff_id||String(e.id||"")).toUpperCase()===id);
          if(emp && emp.active!==false && emp.is_active!==false && String(emp.pin)===pin2){
            // credentials valid — auto-login immediately
            const sl = STAFF_LIST.find(s=>s.name===emp.name);
            onLogin({...emp, staffListId:sl?.id||null});
            return;
          }
          // credentials saved but not valid (e.g. PIN changed) — just pre-fill
          setEmpId(id);
          setPin(pin2);
          setRemember(true);
        }
      }catch(e){}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function handleLogin(){
    setError(""); setLoading(true);
    const id  = empId.trim().toUpperCase();
    const emp = safeDb.find(e=>(e.staffListId||e.staff_id||String(e.id||"")).toUpperCase()===id);
    if(!emp){setError("Employee ID not found.");setLoading(false);return;}
    if(emp.active===false||emp.is_active===false){setError("Account inactive. Contact manager.");setLoading(false);return;}
    if(String(emp.pin)!==pin.trim()){setError("Incorrect PIN.");setLoading(false);return;}
    try{
      if(remember){
        await Promise.all([window.storage?.set("ambria_emp_id",id),window.storage?.set("ambria_pin",pin.trim()),window.storage?.set("ambria_remember","true")]);
      } else {
        await Promise.all([window.storage?.delete("ambria_emp_id"),window.storage?.delete("ambria_pin"),window.storage?.delete("ambria_remember")]);
      }
    }catch(e){}
    const sl = STAFF_LIST.find(s=>s.name===emp.name);
    onLogin({...emp, staffListId:sl?.id||null});
    setLoading(false);
  }

  return (
    <div style={{minHeight:"100vh",background:`radial-gradient(ellipse at 30% 20%, #18150E 0%, #0A0908 50%, #06050A 100%)`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      {/* Background decorative elements */}
      <div style={{position:"absolute",top:"-20%",right:"-10%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle, rgba(212,180,74,.04) 0%, transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"-15%",left:"-5%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle, rgba(212,180,74,.03) 0%, transparent 70%)",pointerEvents:"none"}}/>

      <div className="fade-in-up" style={{background:`linear-gradient(160deg, ${C.surface} 0%, #0E0D0B 100%)`,borderRadius:24,padding:"48px 44px",width:400,boxShadow:`0 32px 80px rgba(0,0,0,.5), 0 0 1px ${C.glow}, inset 0 1px 0 rgba(255,255,255,.04)`,border:`1px solid ${C.border}`,position:"relative"}}>
        {/* Subtle top gold line */}
        <div style={{position:"absolute",top:0,left:"15%",right:"15%",height:1,background:`linear-gradient(90deg, transparent, ${C.gold}40, transparent)`}}/>

        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:64,height:64,borderRadius:16,background:`linear-gradient(135deg, ${C.gold}, #8B6A14)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:700,color:"#fff",margin:"0 auto 16px",boxShadow:`0 8px 24px rgba(212,180,74,.25)`,letterSpacing:1,fontFamily:"var(--font-display)"}}>A</div>
          <div style={{fontSize:26,fontWeight:600,color:C.text,fontFamily:"var(--font-display)",letterSpacing:2}}>{T2("Ambria FnB Operations")}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:6,letterSpacing:1.5,textTransform:"uppercase",fontWeight:500}}>{T2("F&B Kitchen Operations")}</div>
        </div>

        {/* Form */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:1.2}}>{T2("Employee ID")}</div>
          <input
            value={empId}
            onChange={e=>setEmpId(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            placeholder={T2("e.g. AM001")}
            style={{width:"100%",padding:"13px 16px",borderRadius:12,border:`1.5px solid ${error?C.red:C.border}`,fontSize:15,color:C.text,background:C.bg,outline:"none",boxSizing:"border-box"}}
            autoFocus
          />
        </div>
        <div style={{marginBottom:22}}>
          <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:1.2}}>4-Digit PIN</div>
          <input
            type="password"
            value={pin}
            onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,4))}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            placeholder={T2("••••")}
            maxLength={4}
            style={{width:"100%",padding:"13px 16px",borderRadius:12,border:`1.5px solid ${error?C.red:C.border}`,fontSize:20,color:C.text,background:C.bg,outline:"none",boxSizing:"border-box",letterSpacing:8}}
          />
        </div>

        {error&&<div className="fade-in" style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.red,marginBottom:16}}>{error}</div>}

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24,cursor:"pointer"}} onClick={()=>setRemember(r=>!r)}>
          <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${remember?C.gold:C.border}`,background:remember?C.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {remember&&<span style={{color:"#0A0908",fontSize:11,fontWeight:700}}>✓</span>}
          </div>
          <span style={{fontSize:12,color:C.muted}}>{T2("Remember me on this device")}</span>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading||!empId||pin.length<4}
          style={{width:"100%",padding:"14px",borderRadius:14,background:(!empId||pin.length<4)?C.border:`linear-gradient(135deg, ${C.gold}, #A8891E)`,color:(!empId||pin.length<4)?C.muted:"#0A0908",border:"none",fontSize:15,fontWeight:700,cursor:(!empId||pin.length<4)?"not-allowed":"pointer",fontFamily:"var(--font-display)",letterSpacing:1.5,boxShadow:(!empId||pin.length<4)?"none":`0 4px 16px rgba(212,180,74,.3)`}}>
          {loading?T2("Signing in…"):T2("Sign In →")}
        </button>

        <div style={{textAlign:"center",marginTop:20,fontSize:11,color:C.faint,letterSpacing:.5}}>
          Ambria Cuisines · Get Your Venue Events Pvt Ltd
        </div>
      </div>
    </div>
  );
}


// ─── DEPARTMENT VIEW (for section tablets) ───────────────────────
function calcDispatch(time){
  if(!time) return "TBD";
  const parts=time.split(":");const h=parseInt(parts[0])||0;const m=parseInt(parts[1])||0;
  const dH=h-2;
  return `${String(dH<0?dH+24:dH).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function DeptView({attendance, setAttendance, events, kitchenTracking, setKitchenTracking, lang="en", setLang, onSelectDept, onLogout, currentUser, forceDept, leaves, setLeaves, empDb, setEmpDb}) {
  const T2 = s => T(s, lang);
  const [selDept, setSelDept] = useState(forceDept||null);
  const [deptTab, setDeptTab] = useState(null); // null = auto-pick first tab
  const [kioskMode, setKioskMode] = useState(false);
  const [time, setTime] = useState(new Date());
  const [svcChecks, setSvcChecks] = useState({});
  const [crockChecks, setCrockChecks] = useState({});
  const [bevChecks, setBevChecks] = useState({});
  const [expandedDish, setExpandedDish] = useState(null);
  const [bevTick, setBevTick] = useState(0);
  const [vehStatus, setVehStatus] = useState({});
  const [loadChecks, setLoadChecks] = useState({});
  const [selOdcId, setSelOdcId] = useState(null);
  useEffect(()=>{const t2=setInterval(()=>setBevTick(k=>k+1),1000);return()=>clearInterval(t2);},[]);
  const [odcChecks, setOdcChecks] = useState({});
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),30000);return()=>clearInterval(t);},[]);
  useEffect(()=>{if(forceDept){setSelDept(forceDept);setDeptTab(null);}},[forceDept]);

  const todayAtts = safeArr(attendance).filter(a=>a.date===TODAY);
  const todayEvs = safeArr(events).filter(e=>e.date===TODAY);
  const tomorrowEvs = safeArr(events).filter(e=>e.date===TOMORROW);

  // 6 Departments
  const DEPTS = [
    {id:"kitchen",name:"Kitchen",icon:"👨‍🍳",color:"#D4A843",bg:"#1E1A10",
      desc:"Food preparation across all sections",descHi:"सभी विभागों में भोजन तैयारी",
      sections:SECTIONS, staffFilter:s=>SECTIONS.includes(s.section)},
    {id:"service",name:"Service",icon:"🍽️",color:"#5B8FD0",bg:"#EEF4FD",
      desc:"Guest service, table setup, event coordination",descHi:"अतिथि सेवा, टेबल सेटअप, इवेंट समन्वय",
      sections:["Service"], staffFilter:s=>s.section==="Service"},
    {id:"crockery",name:"Crockery",icon:"🍶",color:"#8A70C8",bg:"#14101E",
      desc:"Plates, glasses, cutlery, chafing dishes",descHi:"प्लेट, ग्लास, कटलरी, चेफ़िंग डिश",
      sections:["Crockery"], staffFilter:s=>s.section==="Crockery"},
    {id:"beverages",name:"Beverages",icon:"🥤",color:"#50B0A0",bg:"#0E1E1A",
      desc:"Mocktails, juices, tea/coffee, water service",descHi:"मॉकटेल, जूस, चाय/कॉफी, पानी सेवा",
      sections:[], staffFilter:s=>s.section==="Beverages"},
    {id:"transport",name:"Transportation",icon:"🚛",color:"#D4A843",bg:"#1A1610",
      desc:"Vehicle dispatch, loading, route management",descHi:"वाहन रवानगी, लोडिंग, मार्ग प्रबंधन",
      sections:["Transportation"], staffFilter:s=>s.section==="Transportation"},
    {id:"odc",name:"ODC - Outdoor Catering",icon:"🏕️",color:C.gold,bg:C.redBg,
      desc:"Full event execution at external venues",descHi:"बाहरी वेन्यू पर पूर्ण इवेंट निष्पादन",
      sections:["ODC"], staffFilter:s=>s.section==="ODC"},
  ];

  // Crockery items per pax
  const CROCKERY_ITEMS = [
    {name:"Dinner Plate 10\"",h:"डिनर प्लेट 10\"",perPax:1.2,icon:"🍽"},
    {name:"Quarter Plate 7\"",h:"क्वार्टर प्लेट 7\"",perPax:1,icon:"🍽"},
    {name:"Soup Bowl",h:"सूप बाउल",perPax:0.8,icon:"🥣"},
    {name:"Sweet Bowl",h:"मिठाई कटोरी",perPax:1,icon:"🍮"},
    {name:"Water Glass",h:"पानी ग्लास",perPax:1.5,icon:"🥛"},
    {name:"Juice Glass",h:"जूस ग्लास",perPax:0.8,icon:"🧃"},
    {name:"Mocktail Glass",h:"मॉकटेल ग्लास",perPax:0.5,icon:"🍹"},
    {name:"Tea Cup & Saucer",h:"चाय कप और सॉसर",perPax:0.6,icon:"☕"},
    {name:"Serving Spoon Large",h:"सर्विंग चम्मच बड़ा",perPax:0.05,icon:"🥄"},
    {name:"Serving Spoon Small",h:"सर्विंग चम्मच छोटा",perPax:0.08,icon:"🥄"},
    {name:"Chafing Dish Full",h:"चेफ़िंग डिश फुल",perPax:0.02,icon:"🍲"},
    {name:"Chafing Dish Half",h:"चेफ़िंग डिश हाफ",perPax:0.03,icon:"🍲"},
    {name:"Fork",h:"काँटा",perPax:1.2,icon:"🍴"},
    {name:"Spoon",h:"चम्मच",perPax:1.5,icon:"🥄"},
    {name:"Knife",h:"छुरी",perPax:0.5,icon:"🔪"},
    {name:"Napkin (Cloth)",h:"नैपकिन (कपड़ा)",perPax:1,icon:"🧻"},
    {name:"Table Cloth",h:"टेबल कवर",perPax:0.02,icon:"🧵"},
    {name:"Tray Round",h:"ट्रे गोल",perPax:0.03,icon:"🫕"},
    {name:"Water Jug",h:"पानी जग",perPax:0.05,icon:"🫗"},
  ];

  // Service checklist template
  const SERVICE_CHECKLIST = [
    {id:"briefing",label:"Event Briefing Done",h:"इवेंट ब्रीफिंग पूर्ण",icon:"📋"},
    {id:"table_setup",label:"Tables & Chairs Setup",h:"टेबल और कुर्सी सेटअप",icon:"🪑"},
    {id:"linen",label:"Linen & Table Covers",h:"लिनन और टेबल कवर",icon:"🧵"},
    {id:"buffet_setup",label:"Buffet Counter Setup",h:"बुफ़े काउंटर सेटअप",icon:"🍽"},
    {id:"live_counter",label:"Live Counters Ready",h:"लाइव काउंटर तैयार",icon:"🔥"},
    {id:"water_station",label:"Water Station Placed",h:"पानी स्टेशन लगा",icon:"💧"},
    {id:"napkins",label:"Napkins & Cutlery Set",h:"नैपकिन और कटलरी सेट",icon:"🍴"},
    {id:"dustbins",label:"Dustbins Placed",h:"डस्टबिन लगाए",icon:"🗑"},
    {id:"staff_uniform",label:"Staff Uniform Check",h:"स्टाफ यूनिफ़ॉर्म चेक",icon:"👔"},
    {id:"vip_table",label:"VIP / Host Table Ready",h:"VIP / होस्ट टेबल तैयार",icon:"⭐"},
    {id:"final_walkthrough",label:"Final Walkthrough Done",h:"अंतिम निरीक्षण पूर्ण",icon:"✅"},
  ];

  // ── KIOSK OVERLAY ──
  if(kioskMode) return (
    <KioskAttendance staffList={STAFF_LIST} attendance={attendance} setAttendance={setAttendance} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} onClose={()=>setKioskMode(false)} lang={lang}/>
  );

  // ── DEPARTMENT SELECTOR ──
  if(!selDept && !forceDept) return (
    <div style={{minHeight:"100vh",background:`linear-gradient(145deg,#0A0A0F 0%,#161514 50%,#0E0D0B 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px"}}>
      {/* Top bar */}
      <div style={{position:"absolute",top:16,left:24,right:24,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff",fontWeight:700}}>A</div>
          <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>Ambria Cuisines</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>{if(setLang)setLang(l=>l==="en"?"hi":"en");}} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,color:C.gold,fontSize:12,padding:"8px 14px",cursor:"pointer",fontWeight:600,minHeight:44}}>
            {lang==="en"?"🇮🇳 हिंदी":"🇬🇧 English"}
          </button>
          {onLogout&&<button onClick={onLogout} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:12,padding:"8px 14px",cursor:"pointer",minHeight:44}}>{T2("Sign out")}</button>}
        </div>
      </div>

      {currentUser&&<div style={{fontSize:14,color:C.muted,marginBottom:4}}>{T2("Welcome")}, <strong>{currentUser.name}</strong></div>}
      <div style={{fontSize:26,fontWeight:800,color:C.text,fontFamily:"var(--font-display)",marginBottom:6}}>{T2("Select Your Department")}</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:32}}>{T2("Each tablet is locked to its department")}</div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,maxWidth:780,width:"100%"}}>
        {DEPTS.map(dept=>{
          const odcCount = todayEvs.filter(e=>(e.venue||"").includes("ODC")).length;
          return (
            <button key={dept.id} onClick={()=>{if(onSelectDept) onSelectDept(dept.id); else setSelDept(dept.id);}}
              style={{background:C.darkCard,border:`1px solid ${dept.color}30`,borderRadius:20,padding:"28px 18px",cursor:"pointer",textAlign:"center",boxShadow:"0 4px 20px rgba(0,0,0,.4)",transition:"all .15s",minHeight:180}}>
              <div style={{fontSize:44,marginBottom:10}}>{dept.icon}</div>
              <div style={{fontSize:17,fontWeight:700,color:C.text}}>{T2(dept.name)}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:6,lineHeight:1.5}}>{lang==="hi"?dept.descHi:dept.desc}</div>
              <div style={{fontSize:12,color:dept.color,fontWeight:600,marginTop:10}}>
                {dept.id==="odc"?`${odcCount} ODC ${T2("Today")}`:
                 `${todayEvs.length} ${T2("events")} ${T2("Today")}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Gate Kiosk — for property entrance guard */}
      <div style={{marginTop:28,maxWidth:780,width:"100%"}}>
        <div style={{background:`linear-gradient(155deg,#06060A 0%,#12100A 40%,#0A0908 100%)`,borderRadius:16,padding:"18px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:"#fff"}}> 🖥 {T2("Property Gate Kiosk")}</div>
            <div style={{fontSize:11,color:"rgba(196,164,74,.6)",marginTop:3}}>{T2("Guard records attendance for ALL staff at property entrance")}</div>
          </div>
          <button onClick={()=>setKioskMode(true)} style={{padding:"12px 28px",borderRadius:12,background:C.gold,color:"#0A0A0F",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",flexShrink:0,minHeight:48}}>
            {T2("Launch Kiosk")} →
          </button>
        </div>
      </div>
    </div>
  );

  // ── DEPARTMENT DATA ──
  const dept = DEPTS.find(d=>d.id===selDept)||DEPTS[0];

  // Kitchen section staff
  const kitchenStaff = STAFF_LIST.filter(s=>SECTIONS.includes(s.section));
  const bevStaff = STAFF_LIST.filter(s=>s.section==="Beverages");
  const odcEvs = todayEvs.filter(e=>(e.venue||"").includes("ODC"));
  const tomorrowOdc = tomorrowEvs.filter(e=>(e.venue||"").includes("ODC"));

  // Tabs per department
  const DEPT_TABS = {
    kitchen:  [{v:"attendance",l:`✅ ${T2("Attendance")}`},{v:"kitchen",l:`👨‍🍳 ${T2("Kitchen Tasks")}`},{v:"menu",l:`📜 ${T2("Menu")}`},{v:"repair",l:`🔧 ${T2("Repair")}`}],
    service:  [{v:"attendance",l:`✅ ${T2("Attendance")}`},{v:"staffing",l:`👥 ${T2("Staff Allocation")}`},{v:"checklist",l:`📋 ${T2("Service Checklist")}`},{v:"repair",l:`🔧 ${T2("Repair")}`}],
    crockery: [{v:"attendance",l:`✅ ${T2("Attendance")}`},{v:"requirements",l:`📦 ${T2("Requirements")}`},{v:"dispatch",l:`🚛 ${T2("Dispatch")}`},{v:"repair",l:`🔧 ${T2("Repair")}`}],
    beverages:[{v:"store_req",l:`📦 ${T2("D-1 Store Req")}`},{v:"live_prep",l:`🥤 ${T2("Live Prep")}`},{v:"menu",l:`📜 ${T2("Menu")}`},{v:"repair",l:`🔧 ${T2("Repair")}`}],
    transport:[{v:"live",l:`📍 ${T2("Live Transport")}`},{v:"pickup",l:`🔔 ${T2("Kitchen Pickup")}`},{v:"checklist",l:`📋 ${T2("Loading Checklist")}`},{v:"repair",l:`🔧 ${T2("Repair")}`}],
    odc:      [{v:"bookings",l:`🏕️ ${T2("ODC Bookings")}`},{v:"kitchen",l:`👨‍🍳 ${T2("Kitchen Tasks")}`},{v:"checklist",l:`📋 ${T2("Site Checklist")}`},{v:"repair",l:`🔧 ${T2("Repair")}`}],
  };
  const tabs = DEPT_TABS[selDept]||DEPT_TABS.kitchen;
  const activeTab = (deptTab && tabs.some(t=>t.v===deptTab)) ? deptTab : (tabs[0]?.v || "attendance");

  return (
    <div style={{padding:"4px 0"}}>
      {/* ── DEPT HEADER ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:48,height:48,borderRadius:14,background:dept.color+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{dept.icon}</div>
          <div>
            <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{T2(dept.name)}</div>
            <div style={{fontSize:12,color:C.muted}}>{lang==="hi"?dept.descHi:dept.desc}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{textAlign:"right",marginRight:8}}>
            <div style={{fontSize:16,fontWeight:700,color:C.text}}>{time.toLocaleTimeString(lang==="hi"?"hi-IN":"en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
            <div style={{fontSize:12,color:C.muted}}>{TODAY_LABEL}</div>
          </div>
          <button onClick={()=>{setSelDept(null);setDeptTab(null);}} style={{padding:"10px 16px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:44}}>🔄 {T2("Change Dept")}</button>
        </div>
      </div>

      {/* ── TABS (tablet: large touch targets) ── */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {tabs.map(t=>(
          <button key={t.v} onClick={()=>setDeptTab(t.v)} style={{padding:"10px 18px",borderRadius:24,fontSize:13,fontWeight:600,cursor:"pointer",background:activeTab===t.v?dept.color:"transparent",color:activeTab===t.v?"#fff":C.muted,border:`2px solid ${activeTab===t.v?dept.color:C.border}`,minHeight:44,transition:"all .15s"}}>{t.l}</button>
        ))}
      </div>

      {/* ══════ ATTENDANCE TAB (shared across all depts) ══════ */}
      {activeTab==="attendance"&&(()=>{
        const curDeptConfig = DEPTS.find(d=>d.id===selDept);
        const deptStaff = curDeptConfig ? STAFF_LIST.filter(curDeptConfig.staffFilter) : [];
        const deptPresent = todayAtts.filter(a=>a.status==="Present"&&deptStaff.some(s=>String(s.id)===String(a.staffId)));
        return (
          <div>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"10px 18px",display:"flex",alignItems:"center",gap:8}}>
                <div style={{fontSize:24,fontWeight:700,color:C.green}}>{deptPresent.length}</div>
                <div style={{fontSize:11,color:C.green,fontWeight:600}}>/ {deptStaff.length} {T2("Present")}</div>
              </div>
            </div>
            {deptPresent.length>0?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {deptPresent.map((att,i)=>{
                  const staff = deptStaff.find(s=>String(s.id)===String(att.staffId));
                  return (
                    <div key={i} style={{background:att.punchOut?C.surface:C.greenBg,border:`1px solid ${att.punchOut?C.border:C.greenBorder}`,borderRadius:12,padding:"12px",display:"flex",gap:10,alignItems:"center"}}>
                      {att.photo?<img src={att.photo} style={{width:40,height:40,borderRadius:10,objectFit:"cover"}}/>
                        :<div style={{width:40,height:40,borderRadius:10,background:C.green+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:C.green}}>✓</div>}
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.text}}>{att.staffName||staff?.name}</div>
                        <div style={{fontSize:11,color:C.green}}>✅ {T2("In")}: {att.time}</div>
                        {att.punchOut&&<div style={{fontSize:11,color:"#D06040"}}>👋 {T2("Out")}: {att.punchOut}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ):(
              <div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>
                {deptStaff.length>0?T2("No staff checked in yet. Attendance is marked at Property Gate Kiosk."):T2("Staff roster for this department will be configured")+". "+T2("Use Kiosk for attendance")+"."}
              </div>
            )}
          </div>
        );
      })()}

      {/* ══════ KITCHEN: Kitchen Tasks ══════ */}
      {selDept==="kitchen"&&activeTab==="kitchen"&&(()=>{
        const secDishes = {};
        todayEvs.forEach(ev=>{
          (ev.menu||[]).forEach((name,idx)=>{
            if(guessSectionForDish(name)==="Beverages") return; // beverages handled by Beverages dept
            const sec = guessSectionForDish(name);
            if(!secDishes[sec]) secDishes[sec]=[];
            const dId = ev.id+"|"+idx;
            const kt = safeObj(kitchenTracking);
            const tracked = safeObj(kt[ev.id])?.[dId];
            const steps = tracked?.steps || getStepsForDish(name);
            const done = safeArr(tracked?.done);
            secDishes[sec].push({name,ev:ev.guest,evTime:ev.time,pct:safePct(done.length,steps.length)});
          });
        });
        return (
          <div>
            {Object.entries(secDishes).map(([sec,dishes])=>{
              const m = SECTION_META[sec]||{icon:"🍽",color:C.muted};
              const ready = dishes.filter(d=>d.pct===100).length;
              return (
                <Card key={sec} style={{marginBottom:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:13,fontWeight:700,color:m.color}}>{m.icon} {T2(sec)}</span>
                    <span style={{fontSize:10,fontWeight:600,color:ready===dishes.length?C.green:C.amber}}>{ready}/{dishes.length} ✓</span>
                  </div>
                  {dishes.map((d,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:i<dishes.length-1?`1px solid ${C.borderLight}`:"none"}}>
                      <div style={{width:20,height:20,borderRadius:3,background:d.pct===100?C.green:d.pct>0?C.amber+"30":"transparent",border:`1.5px solid ${d.pct===100?C.green:d.pct>0?C.amber:C.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {d.pct===100&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,color:d.pct===100?C.green:C.text}}>{d.name}</div>
                        <div style={{fontSize:11,color:C.muted}}>{d.ev} · {d.evTime}</div>
                      </div>
                      <span style={{fontSize:10,color:d.pct===100?C.green:d.pct>0?C.amber:C.muted}}>{d.pct}%</span>
                    </div>
                  ))}
                </Card>
              );
            })}
            {Object.keys(secDishes).length===0&&<div style={{textAlign:"center",padding:24,background:C.bg,borderRadius:10,color:C.muted,fontSize:12}}>{T2("No dishes for today")}</div>}
          </div>
        );
      })()}

      {/* ══════ KITCHEN: Menu ══════ */}
      {selDept==="kitchen"&&activeTab==="menu"&&(
        <div>
          {todayEvs.map(ev=>(
            <Card key={ev.id} style={{marginBottom:10,padding:"12px 14px"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>{ev.guest} — {ev.menuPackage||"Custom"}</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{ev.time} · {ev.pax} {T2("pax")} · {(ev.menu||[]).filter(d=>guessSectionForDish(d)!=="Beverages").length} {T2("dishes")}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {(ev.menu||[]).filter(d=>guessSectionForDish(d)!=="Beverages").map((d,i)=>{const sec=guessSectionForDish(d);const m=SECTION_META[sec]||{color:C.muted};return <span key={i} style={{fontSize:10,padding:"5px 10px",borderRadius:8,background:m.color+"10",border:`1px solid ${m.color}25`,color:m.color}}>{d}</span>;})}
              </div>
            </Card>
          ))}
          {todayEvs.length===0&&<div style={{textAlign:"center",padding:24,background:C.bg,borderRadius:10,color:C.muted,fontSize:12}}>{T2("No events today")}</div>}
        </div>
      )}

      {/* ══════ SERVICE: Staff Allocation ══════ */}
      {selDept==="service"&&activeTab==="staffing"&&(()=>{
        // Staff allocation reference table
        const ALLOC_BASE = {
          "Magnum Veg":        {ref:[{pax:100,staff:17},{pax:200,staff:26}],per100:6,per50:3},
          "Magnum Non-Veg":    {ref:[{pax:100,staff:18},{pax:200,staff:28}],per100:6,per50:3},
          "Double Magnum Veg": {ref:[{pax:100,staff:20},{pax:200,staff:29}],per100:6,per50:3},
          "Double Magnum Non-Veg":{ref:[{pax:100,staff:21},{pax:200,staff:29}],per100:6,per50:3},
          "Multi-Cuisine Veg": {ref:[{pax:300,staff:36},{pax:400,staff:42},{pax:500,staff:49}],per100:6,per50:3},
          "Multi-Cuisine Non-Veg":{ref:[{pax:300,staff:37},{pax:400,staff:43},{pax:500,staff:49}],per100:6,per50:3},
          "Luxury Veg":        {ref:[{pax:300,staff:46},{pax:400,staff:53},{pax:500,staff:60}],per100:7,per50:4},
          "Luxury Non-Veg":    {ref:[{pax:300,staff:47},{pax:400,staff:54},{pax:500,staff:61}],per100:7,per50:4},
        };
        function calcStaff(pkg,pax){
          const ab=ALLOC_BASE[pkg];if(!ab)return{staff:null,note:T2("No allocation data for this menu")};
          const refs=ab.ref.sort((a,b)=>a.pax-b.pax);
          // Find closest reference point
          let base=refs[0];
          for(const r of refs){if(pax>=r.pax)base=r;else break;}
          const diff=pax-base.pax;
          const extra100=Math.floor(diff/100)*ab.per100;
          const remainder=diff%100;
          const extra50=remainder>=50?ab.per50:Math.round(remainder/100*ab.per100);
          const total=base.staff+extra100+extra50;
          return{staff:total,base:base.staff,basePax:base.pax,extraPax:diff,extraStaff:extra100+extra50,per100:ab.per100,per50:ab.per50};
        }
        const allEvs=[...todayEvs,...tomorrowEvs];
        let grandTotal=0;
        return(
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>{T2("Service Staff Allocation")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{T2("Auto-calculated based on menu package and guest count")}</div>
            {allEvs.length===0&&<div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>{T2("No events today or tomorrow")}</div>}
            {allEvs.map(ev=>{
              const pkg=ev.menuPackage||"";
              const pax=+ev.pax||0;
              const result=calcStaff(pkg,pax);
              if(result.staff)grandTotal+=result.staff;
              const isToday=ev.date===TODAY;
              return(
                <Card key={ev.id} style={{marginBottom:10,padding:0,overflow:"hidden"}}>
                  <div style={{padding:"14px 16px",background:C.bg,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:12,fontWeight:700,color:isToday?C.gold:C.amber}}>{isToday?T2("Today"):T2("Tomorrow")}</span>
                        <span style={{fontSize:14,fontWeight:700,color:C.text}}>{ev.guest}</span>
                      </div>
                      <div style={{fontSize:12,color:C.muted,marginTop:2}}>{ev.venue} · {ev.time} · {pax} {T2("pax")} · 📜 {pkg||T2("Custom")}</div>
                      {ev.special&&<div style={{fontSize:11,color:C.amber,marginTop:2}}>⚠ {ev.special}</div>}
                    </div>
                    <div style={{textAlign:"center",flexShrink:0}}>
                      <div style={{fontSize:28,fontWeight:800,color:result.staff?C.gold:C.muted}}>{result.staff||"—"}</div>
                      <div style={{fontSize:10,color:C.muted}}>{T2("staff needed")}</div>
                    </div>
                  </div>
                  {result.staff&&(
                    <div style={{padding:"12px 16px"}}>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>
                        <div style={{background:C.bg,borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
                          <div style={{fontSize:10,color:C.muted}}>{T2("Base")}</div>
                          <div style={{fontSize:16,fontWeight:700,color:C.text}}>{result.base}</div>
                          <div style={{fontSize:10,color:C.muted}}>@ {result.basePax} {T2("pax")}</div>
                        </div>
                        <div style={{background:C.bg,borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
                          <div style={{fontSize:10,color:C.muted}}>{T2("Extra")}</div>
                          <div style={{fontSize:16,fontWeight:700,color:C.amber}}>+{result.extraStaff}</div>
                          <div style={{fontSize:10,color:C.muted}}>+{result.extraPax} {T2("pax")}</div>
                        </div>
                        <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
                          <div style={{fontSize:10,color:C.gold}}>{T2("Total")}</div>
                          <div style={{fontSize:20,fontWeight:800,color:C.gold}}>{result.staff}</div>
                          <div style={{fontSize:10,color:C.gold}}>{T2("staff")}</div>
                        </div>
                      </div>
                      <div style={{fontSize:11,color:C.muted,background:C.bg,borderRadius:8,padding:"8px 12px"}}>
                        📊 {T2("Scale")}: +{result.per100} {T2("staff per")} 100 {T2("pax")} · +{result.per50} {T2("staff per")} 50 {T2("pax")}
                        {/luxury/i.test(pkg)&&<span style={{color:C.gold,marginLeft:6}}>★ {T2("Luxury rate")}</span>}
                      </div>
                    </div>
                  )}
                  {!result.staff&&<div style={{padding:"12px 16px",fontSize:12,color:C.muted}}>{result.note}</div>}
                </Card>
              );
            })}
            {allEvs.length>1&&grandTotal>0&&(
              <Card style={{padding:"14px 18px",background:C.goldBg,border:`2px solid ${C.gold}40`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:14,fontWeight:700,color:C.gold}}>{T2("Grand Total Service Staff")}</span>
                  <span style={{fontSize:24,fontWeight:800,color:C.gold}}>{grandTotal}</span>
                </div>
              </Card>
            )}
          </div>
        );
      })()}

      {/* ══════ SERVICE: Checklist ══════ */}
      {selDept==="service"&&activeTab==="checklist"&&(
        <div>
          {todayEvs.map(ev=>{
            const checks = svcChecks[ev.id]||{};
            const doneCt = SERVICE_CHECKLIST.filter(c=>checks[c.id]).length;
            return (
              <Card key={ev.id} style={{marginBottom:10,padding:0,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",background:C.bg,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{ev.guest}</div><div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")}</div></div>
                  <span style={{fontSize:12,fontWeight:700,color:doneCt===SERVICE_CHECKLIST.length?C.green:C.amber}}>{doneCt}/{SERVICE_CHECKLIST.length}</span>
                </div>
                <div style={{padding:"12px 16px"}}>
                  {SERVICE_CHECKLIST.map(item=>{
                    const done = !!checks[item.id];
                    return (
                      <div key={item.id} onClick={()=>setSvcChecks(p=>({...p,[ev.id]:{...(p[ev.id]||{}),[item.id]:!done}}))}
                        style={{display:"flex",gap:10,alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer"}}>
                        <div style={{width:24,height:24,borderRadius:4,border:`2px solid ${done?C.green:C.border}`,background:done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {done&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                        </div>
                        <span style={{fontSize:14,flexShrink:0}}>{item.icon}</span>
                        <span style={{fontSize:12,color:done?C.green:C.text,textDecoration:done?"line-through":"none"}}>{lang==="hi"?item.h:item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
          {todayEvs.length===0&&<div style={{textAlign:"center",padding:24,background:C.bg,borderRadius:10,color:C.muted,fontSize:12}}>{T2("No events today")}</div>}
        </div>
      )}

      {/* ══════ CROCKERY: Requirements ══════ */}
      {selDept==="crockery"&&activeTab==="requirements"&&(
        <div>
          {todayEvs.map(ev=>{
            const checks = crockChecks[ev.id]||{};
            const packed = CROCKERY_ITEMS.filter(c=>checks[c.name]).length;
            return (
              <Card key={ev.id} style={{marginBottom:10,padding:0,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",background:C.bg,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{ev.guest}</div><div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.pax} {T2("pax")}</div></div>
                  <span style={{fontSize:12,fontWeight:700,color:packed===CROCKERY_ITEMS.length?C.green:C.amber}}>{packed}/{CROCKERY_ITEMS.length} {T2("packed")}</span>
                </div>
                <div style={{padding:"12px 16px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {CROCKERY_ITEMS.map(item=>{
                      const qty = Math.ceil(ev.pax * item.perPax);
                      const done = !!checks[item.name];
                      return (
                        <div key={item.name} onClick={()=>setCrockChecks(p=>({...p,[ev.id]:{...(p[ev.id]||{}),[item.name]:!done}}))}
                          style={{display:"flex",gap:8,alignItems:"center",padding:"6px 8px",borderRadius:8,cursor:"pointer",background:done?C.greenBg:"transparent",border:`1px solid ${done?C.greenBorder:C.borderLight}`}}>
                          <div style={{width:20,height:20,borderRadius:3,border:`2px solid ${done?C.green:C.border}`,background:done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {done&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                          </div>
                          <span style={{fontSize:12,flexShrink:0}}>{item.icon}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,color:done?C.green:C.text}}>{lang==="hi"?item.h:item.name}</div>
                          </div>
                          <span style={{fontSize:12,fontWeight:700,color:dept.color,flexShrink:0}}>{qty}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
          {todayEvs.length===0&&<div style={{textAlign:"center",padding:24,background:C.bg,borderRadius:10,color:C.muted,fontSize:12}}>{T2("No events today")}</div>}
        </div>
      )}

      {/* ══════ CROCKERY: Dispatch ══════ */}
      {selDept==="crockery"&&activeTab==="dispatch"&&(
        <div>
          {todayEvs.map(ev=>{
            const checks = crockChecks[ev.id]||{};
            const packed = CROCKERY_ITEMS.filter(c=>checks[c.name]).length;
            const pct = safePct(packed, CROCKERY_ITEMS.length);
            return (
              <Card key={ev.id} style={{marginBottom:10,padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{ev.guest}</div><div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.time}</div></div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontWeight:700,color:pct===100?C.green:C.amber}}>{pct}%</div>
                    <div style={{fontSize:11,color:C.muted}}>{T2("packed")}</div>
                  </div>
                </div>
                <div style={{height:8,background:C.border,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:pct===100?C.green:C.amber,borderRadius:3,transition:"width .4s"}}/>
                </div>
                {pct===100&&<div style={{marginTop:8,fontSize:11,color:C.green,fontWeight:600}}>✅ {T2("All packed — ready to load")}</div>}
                {pct<100&&<div style={{marginTop:8,fontSize:11,color:C.amber}}>⏳ {CROCKERY_ITEMS.length-packed} {T2("items remaining")}</div>}
              </Card>
            );
          })}
        </div>
      )}

      {/* ══════ BEVERAGES: Counters ══════ */}
      {/* ══════ BEVERAGES: D-1 Store Requirements ══════ */}
      {selDept==="beverages"&&activeTab==="store_req"&&(
        <div>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>{T2("D-1 Store Requirements")}</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:14}}>{T2("Collect these from store today for tomorrow's functions")}</div>
          {tomorrowEvs.map(ev=>{
            const bevItems = safeArr(ev.menu).filter(d=>guessSectionForDish(d)==="Beverages");
            if(bevItems.length===0) return null;
            return (
              <Card key={ev.id} style={{marginBottom:10,padding:"14px 16px"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>{ev.guest}</div>
                <div style={{fontSize:12,color:C.muted,marginBottom:10}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")} · {bevItems.length} {T2("beverages")}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {bevItems.map((d,i)=>{
                    const ck = bevChecks[ev.id+"_bev"]||{};
                    const done = !!ck[d];
                    return (
                      <div key={i} onClick={()=>setBevChecks(p=>({...p,[ev.id+"_bev"]:{...(p[ev.id+"_bev"]||{}),[d]:!done}}))}
                        style={{display:"flex",gap:8,padding:"8px 10px",borderRadius:8,cursor:"pointer",background:done?C.greenBg:C.surface,border:`1px solid ${done?C.greenBorder:C.border}`,alignItems:"center",minHeight:40}}>
                        <div style={{width:22,height:22,borderRadius:4,border:`2px solid ${done?C.green:C.border}`,background:done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {done&&<span style={{color:"#0A0A0F",fontSize:12,fontWeight:700}}>✓</span>}
                        </div>
                        <span style={{fontSize:11,color:done?C.green:C.text}}>🥤 {d}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
          {tomorrowEvs.filter(ev=>safeArr(ev.menu).some(d=>guessSectionForDish(d)==="Beverages")).length===0&&(
            <div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>{T2("No beverage requirements for tomorrow")}</div>
          )}
        </div>
      )}

      {/* ══════ BEVERAGES: Live Prep (Today — with timers) ══════ */}
      {selDept==="beverages"&&activeTab==="live_prep"&&(
        <div>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>🥤 {T2("Live Beverage Prep")}</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:14}}>{T2("Tap any beverage to start prep. Timers run until complete.")}</div>
          {todayEvs.map(ev=>{
            const menu = safeArr(ev.menu);
            const bevItems = menu.map((d,i)=>({name:d,idx:i})).filter(x=>guessSectionForDish(x.name)==="Beverages");
            if(bevItems.length===0) return null;
            const bevReady = bevItems.filter(b=>{const bk=`bev_${ev.id}_${b.idx}`;return bevChecks[bk]?.ready;}).length;
            return (
              <div key={ev.id} style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,padding:"12px 16px",background:C.surface,borderRadius:12,border:`1px solid ${C.border}`}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.text}}>{ev.guest}</div>
                    <div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")}</div>
                  </div>
                  <div style={{fontSize:16,fontWeight:700,color:bevReady===bevItems.length?C.green:C.amber}}>{bevReady}/{bevItems.length}</div>
                </div>
                {bevItems.map(b=>{
                  const bk = `bev_${ev.id}_${b.idx}`;
                  const bd = bevChecks[bk]||{};
                  const steps = getFullSteps(b.name);
                  const isExp = expandedDish===bk;
                  const runSi = steps.findIndex((_,si)=>bd.starts?.[si]&&!(bd.manual?.[si])&&!(bd.starts?.[si]&&steps[si].tm&&Math.floor((Date.now()-bd.starts[si])/1000)>=steps[si].tm));
                  const doneSi = steps.filter((_,si)=>{return !!(bd.manual?.[si])||(bd.starts?.[si]&&steps[si].tm&&Math.floor((Date.now()-bd.starts[si])/1000)>=steps[si].tm);}).length;

                  return (
                    <div key={bk} style={{marginBottom:6,background:C.surface,border:`1.5px solid ${bd.ready?C.greenBorder:runSi>=0?C.amberBorder:C.border}`,borderRadius:12,overflow:"hidden"}}>
                      <div onClick={()=>setExpandedDish(isExp?null:bk)} style={{padding:"12px 16px",cursor:"pointer",display:"flex",gap:12,alignItems:"center"}}>
                        <div style={{width:32,height:32,borderRadius:8,background:bd.ready?C.green:runSi>=0?C.amber:C.darkCard,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:bd.ready||runSi>=0?"#0A0A0F":C.muted,flexShrink:0}}>
                          {bd.ready?"✓":runSi>=0?"⏱":"🥤"}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600,color:bd.ready?C.green:C.text}}>{b.name}</div>
                          <div style={{fontSize:12,color:C.muted}}>{doneSi}/{steps.length} {T2("steps")} {bd.readyAt?"· ✅ "+bd.readyAt:""}</div>
                        </div>
                        {runSi>=0&&(()=>{const el3=Math.floor((Date.now()-(bd.starts?.[runSi]||Date.now()))/1000);const tm3=steps[runSi]?.tm||0;const rem3=Math.max(0,tm3-el3);return <div style={{fontSize:14,fontWeight:700,color:C.amber,flexShrink:0}}>{fmtT(rem3)}</div>;})()}
                        <span style={{fontSize:16,color:C.muted,transform:isExp?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▾</span>
                      </div>
                      {isExp&&(
                        <div style={{padding:"10px 16px",borderTop:`1px solid ${C.border}`}}>
                          {steps.map((step,si)=>{
                            const sRunning = !!(bd.starts?.[si])&&!(bd.manual?.[si])&&!(bd.starts?.[si]&&step.tm&&Math.floor((Date.now()-bd.starts[si])/1000)>=step.tm);
                            const sDone = !!(bd.manual?.[si])||(bd.starts?.[si]&&step.tm&&Math.floor((Date.now()-bd.starts[si])/1000)>=step.tm);
                            const sEl = sRunning?Math.floor((Date.now()-bd.starts[si])/1000):0;
                            const sTm = step.tm||0;
                            const sRem = Math.max(0,sTm-sEl);
                            const sPct = sTm>0?Math.min(100,Math.round(sEl/sTm*100)):(sDone?100:0);
                            const prevOk2 = si===0||!!(bd.manual?.[(si-1)])||(bd.starts?.[(si-1)]&&steps[si-1].tm&&Math.floor((Date.now()-(bd.starts[si-1]||0))/1000)>=steps[si-1].tm);
                            return (
                              <div key={si} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:si<steps.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"flex-start"}}>
                                <div style={{width:32,height:32,borderRadius:8,background:sDone?C.green:sRunning?C.amber:C.darkCard,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:sDone||sRunning?"#0A0A0F":C.muted,flexShrink:0}}>{sDone?"✓":si+1}</div>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:12,fontWeight:700,color:sDone?C.green:C.text}}>{step.t}{step.store?" 🏪":""}{step.live?" 🔴":""}</div>
                                  {step.i&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>{step.i}</div>}
                                  {sTm>0&&<div style={{marginTop:6}}>
                                    <div style={{height:8,background:C.border,borderRadius:3,overflow:"hidden",marginBottom:3}}>
                                      <div style={{height:"100%",width:sPct+"%",background:sDone?C.green:C.amber,borderRadius:3,transition:"width .5s"}}/>
                                    </div>
                                    <div style={{fontSize:11,color:sRunning?C.amber:sDone?C.green:C.muted}}>
                                      {sRunning?`⏱ ${fmtT(sEl)} / ${fmtT(sTm)} — ${fmtT(sRem)} ${T2("left")}`:sDone?`✓ ${fmtT(sTm)}`:`⏱ ${fmtT(sTm)}`}
                                    </div>
                                  </div>}
                                  {!sRunning&&!sDone&&sTm>0&&prevOk2&&<button onClick={(e)=>{e.stopPropagation();setBevChecks(p=>({...p,[bk]:{...(p[bk]||{}),starts:{...((p[bk]||{}).starts||{}),[si]:Date.now()}}}));}} style={{marginTop:6,padding:"8px 16px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>▶ {T2("Start")} — {fmtT(sTm)}</button>}
                                  {!sRunning&&!sDone&&!sTm&&prevOk2&&!step.live&&<button onClick={(e)=>{e.stopPropagation();setBevChecks(p=>({...p,[bk]:{...(p[bk]||{}),manual:{...((p[bk]||{}).manual||{}),[si]:true}}}));}} style={{marginTop:6,padding:"8px 16px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>✓ {T2("Mark Done")}</button>}
                                  {!sRunning&&!sDone&&!prevOk2&&<div style={{marginTop:4,fontSize:11,color:C.faint}}>⏸ {T2("Previous step must finish first")}</div>}
                                </div>
                              </div>
                            );
                          })}
                          {steps.every((_,si)=>{return !!(bd.manual?.[si])||(bd.starts?.[si]&&steps[si].tm&&Math.floor((Date.now()-bd.starts[si])/1000)>=steps[si].tm);})&&!bd.ready&&(
                            <button onClick={(e)=>{e.stopPropagation();setBevChecks(p=>({...p,[bk]:{...(p[bk]||{}),ready:true,readyAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}}));}}
                              style={{width:"100%",padding:"14px",borderRadius:12,background:`linear-gradient(135deg,${C.green},#2A7A4A)`,color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:8,minHeight:48}}>
                              ✅ {T2("Mark as Ready")} — {b.name}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {todayEvs.every(ev=>!safeArr(ev.menu).some(d=>guessSectionForDish(d)==="Beverages"))&&(
            <div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>{T2("No beverages in today's functions")}</div>
          )}
        </div>
      )}

      {/* ══════ BEVERAGES: Menu ══════ */}
      {selDept==="beverages"&&activeTab==="menu"&&(
        <div>
          {todayEvs.map(ev=>{
            const bevItems = safeArr(ev.menu).filter(d=>guessSectionForDish(d)==="Beverages");
            if(bevItems.length===0) return null;
            return (
              <Card key={ev.id} style={{marginBottom:10,padding:"14px 16px"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>{ev.guest}</div>
                <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")} · {bevItems.length} {T2("beverages")}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {bevItems.map((d,i)=><span key={i} style={{fontSize:11,padding:"6px 12px",borderRadius:8,background:C.teal+"15",border:`1px solid ${C.teal}30`,color:C.teal}}>🥤 {d}</span>)}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ══════ TRANSPORT: Live Transport View ══════ */}
      {selDept==="transport"&&activeTab==="live"&&(()=>{
        const STATUSES=["🏠 At Base","📦 Loading","🚛 En Route","📍 At Venue","↩ Returning"];
        const STATUS_COLORS={"🏠 At Base":C.muted,"📦 Loading":C.amber,"🚛 En Route":C.gold,"📍 At Venue":C.green,"↩ Returning":"#5B8FD0"};
        function setVeh(vId,data){setVehStatus(p=>({...p,[vId]:{...(p[vId]||{status:"🏠 At Base",event:"",driver:"",trips:[]}),...data}}));}
        function logTrip(vId,action){setVehStatus(p=>{const v=p[vId]||{trips:[]};return{...p,[vId]:{...v,trips:[...safeArr(v.trips),{action,time:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}]}};});}

        const activeVeh = VEHICLES.filter(v=>(vehStatus[v.id]?.status||"🏠 At Base")!=="🏠 At Base").length;
        return(
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>📍 {T2("Live Transport View")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{T2("Track all vehicles in real-time")}</div>

            {/* Fleet summary */}
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 16px"}}><div style={{fontSize:20,fontWeight:700,color:C.text}}>{VEHICLES.length}</div><div style={{fontSize:11,color:C.muted}}>{T2("Total Fleet")}</div></div>
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"10px 16px"}}><div style={{fontSize:20,fontWeight:700,color:C.green}}>{activeVeh}</div><div style={{fontSize:11,color:C.green}}>{T2("Active")}</div></div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 16px"}}><div style={{fontSize:20,fontWeight:700,color:C.muted}}>{VEHICLES.length-activeVeh}</div><div style={{fontSize:11,color:C.muted}}>{T2("At Base")}</div></div>
              <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"10px 16px"}}><div style={{fontSize:20,fontWeight:700,color:C.gold}}>{todayEvs.length}</div><div style={{fontSize:11,color:C.gold}}>{T2("Events Today")}</div></div>
            </div>

            {/* Vehicle cards */}
            {VEHICLES.map(v=>{
              const vs=vehStatus[v.id]||{status:"🏠 At Base",event:"",driver:"",trips:[]};
              const stColor=STATUS_COLORS[vs.status]||C.muted;
              const isActive=vs.status!=="🏠 At Base";
              
              return(
                <Card key={v.id} style={{marginBottom:8,padding:0,overflow:"hidden",border:`1.5px solid ${isActive?stColor+"60":C.border}`}}>
                  <div style={{padding:"14px 16px",display:"flex",gap:12,alignItems:"center"}}>
                    <div style={{fontSize:28,flexShrink:0}}>{v.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:14,fontWeight:700,color:C.text}}>{v.name}</span>
                        <span style={{fontSize:11,padding:"3px 10px",borderRadius:8,background:stColor+"15",color:stColor,fontWeight:600}}>{vs.status}</span>
                      </div>
                      <div style={{fontSize:11,color:C.muted,marginTop:2}}>{v.note}</div>
                      {vs.event&&<div style={{fontSize:12,color:C.gold,marginTop:3}}>📋 {vs.event}</div>}
                      {vs.driver&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>🧑 {T2("Driver")}: {vs.driver}</div>}
                    </div>
                    {/* Status buttons */}
                    <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
                      {vs.status==="🏠 At Base"&&<button onClick={()=>{setVeh(v.id,{status:"📦 Loading"});logTrip(v.id,"Loading started");}} style={{padding:"8px 14px",borderRadius:8,background:C.amber,color:"#0A0A0F",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",minHeight:36}}>📦 {T2("Start Loading")}</button>}
                      {vs.status==="📦 Loading"&&<button onClick={()=>{setVeh(v.id,{status:"🚛 En Route"});logTrip(v.id,"Departed for venue");}} style={{padding:"8px 14px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",minHeight:36}}>🚛 {T2("Dispatch")}</button>}
                      {vs.status==="🚛 En Route"&&<button onClick={()=>{setVeh(v.id,{status:"📍 At Venue"});logTrip(v.id,"Arrived at venue");}} style={{padding:"8px 14px",borderRadius:8,background:C.green,color:"#fff",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",minHeight:36}}>📍 {T2("Arrived")}</button>}
                      {vs.status==="📍 At Venue"&&<button onClick={()=>{setVeh(v.id,{status:"↩ Returning"});logTrip(v.id,"Returning to base");}} style={{padding:"8px 14px",borderRadius:8,background:"#5B8FD0",color:"#fff",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",minHeight:36}}>↩ {T2("Return")}</button>}
                      {vs.status==="↩ Returning"&&<button onClick={()=>{setVeh(v.id,{status:"🏠 At Base",event:"",driver:""});logTrip(v.id,"Back at base");}} style={{padding:"8px 14px",borderRadius:8,background:C.surface,color:C.text,border:`1px solid ${C.border}`,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:36}}>🏠 {T2("At Base")}</button>}
                    </div>
                  </div>

                  {/* Assign event & driver (when loading) */}
                  {(vs.status==="📦 Loading"||vs.status==="🏠 At Base")&&!vs.event&&todayEvs.length>0&&(
                    <div style={{padding:"8px 16px",borderTop:`1px solid ${C.border}`,background:C.bg,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <select value={vs.event||""} onChange={e=>setVeh(v.id,{event:e.target.value})} style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:36}}>
                        <option value="">{T2("Assign to event…")}</option>
                        {todayEvs.map(ev=><option key={ev.id} value={ev.guest+" · "+ev.venue}>{ev.guest} — {ev.venue}</option>)}
                      </select>
                      <input placeholder={T2("Driver name")} value={vs.driver||""} onChange={e=>setVeh(v.id,{driver:e.target.value})} style={{width:140,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:36}}/>
                    </div>
                  )}

                  {/* Trip log */}
                  {safeArr(vs.trips).length>0&&(
                    <div style={{padding:"8px 16px",borderTop:`1px solid ${C.border}`,background:C.bg}}>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {safeArr(vs.trips).map((trip,ti)=>(
                          <span key={ti} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:C.surface,border:`1px solid ${C.border}`,color:C.muted}}>
                            {trip.time} — {trip.action}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* ══════ TRANSPORT: Kitchen Pickup (synced with Kitchen) ══════ */}
      {selDept==="transport"&&activeTab==="pickup"&&(()=>{
        const kt=kitchenTracking&&typeof kitchenTracking==="object"?kitchenTracking:{};
        // Only show events at venues needing dispatch (not base kitchens)
        const dispatchEvs=todayEvs.filter(ev=>!/pushpanjali|exotica/i.test(ev.venue));
        const allEvs=todayEvs;
        return(
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>🔔 {T2("Kitchen Pickup Status")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{T2("Real-time sync with Kitchen. Dishes marked ready by chefs appear here.")}</div>

            {allEvs.length===0&&<div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>{T2("No events today")}</div>}

            {allEvs.map(ev=>{
              const menu=safeArr(ev.menu).filter(d=>guessSectionForDish(d)!=="Beverages");
              const needsDispatch=!/pushpanjali|exotica/i.test(ev.venue);
              const readyItems=menu.filter((_,idx)=>{const d=kt[ev.id]?.[`d_${idx}`];return d?.ready;});
              const dispatchedItems=menu.filter((_,idx)=>{const d=kt[ev.id]?.[`d_${idx}`];return d?.dispatchReady;});
              const allReady=readyItems.length===menu.length&&menu.length>0;
              const fullDispatched=!!(kt[ev.id]?.__dispatch_ready);

              return(
                <Card key={ev.id} style={{marginBottom:12,padding:0,overflow:"hidden",border:`1.5px solid ${fullDispatched?C.greenBorder:allReady?C.gold+"60":C.border}`}}>
                  <div style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:C.text}}>{ev.guest}</div>
                      <div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")} · {T2("Dispatch")}: {calcDispatch(ev.time)}</div>
                      {!needsDispatch&&<div style={{fontSize:11,color:C.green,marginTop:2}}>✅ {T2("In-house venue — no transport needed")}</div>}
                    </div>
                    <div style={{textAlign:"center",flexShrink:0}}>
                      <div style={{fontSize:20,fontWeight:700,color:allReady?C.green:readyItems.length>0?C.amber:C.muted}}>{readyItems.length}/{menu.length}</div>
                      <div style={{fontSize:10,color:C.muted}}>{T2("ready")}</div>
                    </div>
                  </div>

                  {needsDispatch&&<div style={{padding:"10px 16px"}}>
                    {menu.map((name,idx)=>{
                      const d=kt[ev.id]?.[`d_${idx}`]||{};
                      const isReady=!!d.ready;
                      const isDispatched=!!d.dispatchReady;
                      const sec=guessSectionForDish(name);
                      const m2=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                      return(
                        <div key={idx} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:idx<menu.length-1?`1px solid ${C.borderLight}`:"none"}}>
                          <div style={{width:28,height:28,borderRadius:8,background:isDispatched?C.green:isReady?C.amber:C.darkCard,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:isDispatched||isReady?"#0A0A0F":C.muted,flexShrink:0}}>
                            {isDispatched?"🚛":isReady?"✓":"⏳"}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:600,color:isDispatched?C.green:isReady?C.amber:C.text}}>{name}</div>
                            <div style={{fontSize:11,color:C.muted}}>{m2.icon} {sec} {isReady&&d.readyAt?`· ✅ ${T2("Ready")} ${d.readyAt}`:""} {isDispatched&&d.dispatchAt?`· 🚛 ${d.dispatchAt}`:""}</div>
                          </div>
                          {isReady&&!isDispatched&&<span style={{fontSize:11,padding:"4px 12px",borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontWeight:600,animation:"pulse 1.5s infinite"}}>🔔 {T2("Ready for Pickup")}</span>}
                          {isDispatched&&<span style={{fontSize:11,padding:"4px 12px",borderRadius:8,background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green,fontWeight:600}}>🚛 {T2("Picked Up")}</span>}
                          {!isReady&&<span style={{fontSize:11,color:C.muted}}>⏳ {T2("Cooking")}</span>}
                        </div>
                      );
                    })}

                    {allReady&&!fullDispatched&&(
                      <div style={{marginTop:10,padding:"10px 14px",background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,textAlign:"center"}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.amber}}>🔔 {T2("All dishes ready! Coordinate pickup with Kitchen.")}</div>
                      </div>
                    )}
                    {fullDispatched&&(
                      <div style={{marginTop:10,padding:"10px 14px",background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,textAlign:"center"}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.green}}>🚛 {T2("Dispatched at")} {kt[ev.id]?.__dispatch_time||""}</div>
                      </div>
                    )}
                  </div>}
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* ══════ TRANSPORT: Loading Checklist (per function menu) ══════ */}
      {selDept==="transport"&&activeTab==="checklist"&&(()=>{
        const kt=kitchenTracking&&typeof kitchenTracking==="object"?kitchenTracking:{};
        const dispatchEvs=todayEvs.filter(ev=>!/pushpanjali|exotica/i.test(ev.venue));
        return(
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>📋 {T2("Loading Checklist")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{T2("Check off items as they are loaded into vehicles")}</div>

            {dispatchEvs.length===0&&<div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>{T2("No venues need dispatch today")}</div>}

            {dispatchEvs.map(ev=>{
              const menu=safeArr(ev.menu).filter(d=>guessSectionForDish(d)!=="Beverages");
              const ck=loadChecks[ev.id]||{};
              const loaded=Object.values(ck).filter(Boolean).length;
              const hasCold=menu.some(d=>COLD_ITEMS.some(ci=>d.toLowerCase().includes(ci.toLowerCase())));
              const extras=[
                {id:"chafing",name:T2("Chafing dishes & stands"),cat:"🔧"},
                {id:"fuel",name:T2("Fuel / Sterno cans"),cat:"🔧"},
                {id:"crockery",name:T2("Crockery & Cutlery"),cat:"🍽"},
                {id:"napkins",name:T2("Napkins & dustbins"),cat:"🧹"},
                {id:"gas",name:T2("Gas cylinders"),cat:"🔥"},
              ];
              if(hasCold) extras.push({id:"ice",name:T2("Ice & cold packs"),cat:"❄"});
              const allItems=[...menu.map((d,i)=>({id:"food_"+i,name:d,cat:"🍽",isFood:true})),...extras];
              const totalLoaded=allItems.filter(item=>ck[item.id]).length;

              return(
                <Card key={ev.id} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
                  <div style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",background:C.bg,borderBottom:`1px solid ${C.border}`}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:C.text}}>{ev.guest}</div>
                      <div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")}</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:totalLoaded===allItems.length?C.green:C.amber}}>{totalLoaded}/{allItems.length}</div>
                      <div style={{fontSize:10,color:C.muted}}>{T2("loaded")}</div>
                    </div>
                  </div>
                  <div style={{padding:"10px 16px"}}>
                    {allItems.map(item=>{
                      const checked=!!ck[item.id];
                      const foodReady=item.isFood?!!(kt[ev.id]?.[`d_${item.id.replace("food_","")}`]?.ready):true;
                      return(
                        <div key={item.id} onClick={()=>{if(!item.isFood||foodReady)setLoadChecks(p=>({...p,[ev.id]:{...(p[ev.id]||{}),[item.id]:!checked}}));}}
                          style={{display:"flex",gap:10,alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.borderLight}`,cursor:(!item.isFood||foodReady)?"pointer":"default",opacity:item.isFood&&!foodReady?.4:1}}>
                          <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${checked?C.green:C.border}`,background:checked?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {checked&&<span style={{color:"#0A0A0F",fontSize:10,fontWeight:700}}>✓</span>}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:checked?400:600,color:checked?C.green:C.text,textDecoration:checked?"line-through":"none"}}>{item.cat} {item.name}</div>
                            {item.isFood&&!foodReady&&<div style={{fontSize:10,color:C.amber}}>⏳ {T2("Waiting — Kitchen preparing")}</div>}
                            {item.isFood&&foodReady&&!checked&&<div style={{fontSize:10,color:C.green}}>✅ {T2("Ready from Kitchen")}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {totalLoaded===allItems.length&&(
                    <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,background:C.greenBg,textAlign:"center"}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.green}}>✅ {T2("All items loaded — vehicle ready to depart")}</div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* ══════ ODC: Events ══════ */}
      {selDept==="odc"&&activeTab==="bookings"&&(()=>{
        const allOdcEvs = safeArr(events).filter(e=>/outdoor|odc/i.test(e.venue));
        const todayOdc2 = allOdcEvs.filter(e=>e.date===TODAY);
        const tomorrowOdc2 = allOdcEvs.filter(e=>e.date===TOMORROW);
        const upcomingOdc = allOdcEvs.filter(e=>e.date>TOMORROW).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
        const kt=kitchenTracking&&typeof kitchenTracking==="object"?kitchenTracking:{};
        const selOdcEv = allOdcEvs.find(e=>e.id===selOdcId)||(selOdcId?null:todayOdc2[0]||tomorrowOdc2[0]||upcomingOdc[0]||null);
        const activeOdcId = selOdcEv?.id||null;

        return(
          <div>
            {/* Gopal status */}
            <Card style={{marginBottom:12,padding:"12px 14px",background:C.darkCard,border:"1px solid #E8D5A3"}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div style={{width:40,height:40,borderRadius:10,background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,fontWeight:700}}>G</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>Gopal — {T2("ODC Lead")}</div>
                  <div style={{fontSize:10,color:todayOdc2.length>0?C.red:C.green}}>{todayOdc2.length>0?`🔴 ${T2("Committed to ODC today")} — ${T2("in-house venues lose oversight")}`:`✅ ${T2("Available for in-house venues")}`}</div>
                </div>
                <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:C.gold}}>{allOdcEvs.length}</div><div style={{fontSize:10,color:C.muted}}>{T2("Total ODC")}</div></div>
              </div>
            </Card>

            {/* Summary tiles */}
            <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:80,background:todayOdc2.length>0?C.redBg:C.surface,border:`1px solid ${todayOdc2.length>0?C.redBorder:C.border}`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:700,color:todayOdc2.length>0?C.red:C.text}}>{todayOdc2.length}</div>
                <div style={{fontSize:10,color:C.muted}}>{T2("Today")}</div>
              </div>
              <div style={{flex:1,minWidth:80,background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:700,color:C.amber}}>{tomorrowOdc2.length}</div>
                <div style={{fontSize:10,color:C.muted}}>{T2("Tomorrow")}</div>
              </div>
              <div style={{flex:1,minWidth:80,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:700,color:C.text}}>{upcomingOdc.length}</div>
                <div style={{fontSize:10,color:C.muted}}>{T2("Upcoming")}</div>
              </div>
              <div style={{flex:1,minWidth:80,background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:700,color:C.gold}}>{allOdcEvs.reduce((s,e)=>s+(+e.pax||0),0)}</div>
                <div style={{fontSize:10,color:C.muted}}>{T2("Total Pax")}</div>
              </div>
            </div>

            {allOdcEvs.length===0&&<div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,color:C.muted,fontSize:13}}>{T2("No ODC events scheduled")}</div>}

            {/* Booking list */}
            {[{label:T2("Today"),evs:todayOdc2,color:C.red},{label:T2("Tomorrow"),evs:tomorrowOdc2,color:C.amber},{label:T2("Upcoming"),evs:upcomingOdc,color:C.muted}].map(group=>{
              if(group.evs.length===0) return null;
              return(
                <div key={group.label} style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:group.color,marginBottom:8,textTransform:"uppercase"}}>{group.label} ({group.evs.length})</div>
                  {group.evs.map(ev=>{
                    const isSel=activeOdcId===ev.id;
                    const menu=safeArr(ev.menu).filter(d=>guessSectionForDish(d)!=="Beverages");
                    const readyCount=menu.filter((_,i)=>{const d=kt[ev.id]?.[`d_${i}`];return d?.ready||d?.dispatchReady;}).length;
                    return(
                      <Card key={ev.id} onClick={()=>setSelOdcId(isSel?null:ev.id)} style={{marginBottom:8,padding:0,overflow:"hidden",cursor:"pointer",border:`2px solid ${isSel?C.gold:C.border}`}}>
                        <div style={{padding:"14px 16px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                            <div>
                              <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{ev.guest}</div>
                              <div style={{fontSize:12,color:C.muted,marginTop:3}}>📍 {ev.venue} · ⏰ {ev.time} · 👥 {ev.pax} {T2("pax")}</div>
                              <div style={{fontSize:12,color:C.muted}}>{ev.menuPackage||"Custom"} · {menu.length} {T2("dishes")} · 🚛 {T2("Dispatch")}: {calcDispatch(ev.time)}</div>
                              {ev.date>TODAY&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>📅 {ev.date}</div>}
                            </div>
                            <div style={{textAlign:"center",flexShrink:0}}>
                              <div style={{fontSize:18,fontWeight:700,color:readyCount===menu.length&&menu.length>0?C.green:readyCount>0?C.amber:C.muted}}>{readyCount}/{menu.length}</div>
                              <div style={{fontSize:10,color:C.muted}}>{T2("ready")}</div>
                            </div>
                          </div>
                          {ev.special&&<div style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:8,padding:"6px 10px",fontSize:11,color:C.red,marginTop:8}}>⚠ {ev.special}</div>}
                        </div>

                        {/* Expanded detail */}
                        {isSel&&(
                          <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 16px",background:C.bg}}>
                            {/* Menu breakdown by section */}
                            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8}}>🍽 {T2("Menu Breakdown")}</div>
                            {(()=>{
                              const bySec={};
                              menu.forEach((n,i)=>{const s=guessSectionForDish(n);if(!bySec[s])bySec[s]=[];bySec[s].push({name:n,idx:i});});
                              return Object.entries(bySec).map(([sec,items])=>{
                                const m2=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                                const rd=items.filter(d=>{const dk=kt[ev.id]?.[`d_${d.idx}`];return dk?.ready||dk?.dispatchReady;}).length;
                                return(
                                  <div key={sec} style={{marginBottom:6}}>
                                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                                      <span style={{fontSize:12,fontWeight:600,color:m2.color}}>{m2.icon} {sec}</span>
                                      <span style={{fontSize:11,color:rd===items.length?C.green:C.muted}}>{rd}/{items.length}</span>
                                    </div>
                                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                      {items.map((d,di)=>{
                                        const rdy=!!(kt[ev.id]?.[`d_${d.idx}`]?.ready||kt[ev.id]?.[`d_${d.idx}`]?.dispatchReady);
                                        return <span key={di} style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:rdy?C.greenBg:C.surface,border:`1px solid ${rdy?C.greenBorder:C.border}`,color:rdy?C.green:C.text}}>{rdy?"✓ ":""}{d.name}</span>;
                                      })}
                                    </div>
                                  </div>
                                );
                              });
                            })()}

                            {/* Key info grid */}
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
                              <div style={{background:C.surface,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                                <div style={{fontSize:11,color:C.muted}}>{T2("Venue")}</div>
                                <div style={{fontSize:12,fontWeight:600,color:C.text}}>{ev.venue}</div>
                              </div>
                              <div style={{background:C.surface,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                                <div style={{fontSize:11,color:C.muted}}>{T2("Lead")}</div>
                                <div style={{fontSize:12,fontWeight:600,color:C.gold}}>Gopal</div>
                              </div>
                              <div style={{background:C.surface,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                                <div style={{fontSize:11,color:C.muted}}>{T2("Dispatch")}</div>
                                <div style={{fontSize:12,fontWeight:600,color:C.gold}}>{calcDispatch(ev.time)}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ══════ ODC: Kitchen Tasks (full KitchenHub for ODC events) ══════ */}
      {selDept==="odc"&&activeTab==="kitchen"&&(
        <KitchenHub events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} odcOnly={true}/>
      )}

      {/* ══════ ODC: Site Checklist ══════ */}
      {selDept==="odc"&&activeTab==="checklist"&&(()=>{
        const ODC_PHASES = [
          {phase:"site",label:T2("Site Recce"),icon:"📍",checks:[
            {id:"venue_confirm",l:T2("Venue confirmed & keys received")},{id:"power",l:T2("Power supply checked")},{id:"water",l:T2("Water supply available")},{id:"parking",l:T2("Vehicle parking identified")},{id:"kitchen_area",l:T2("Kitchen setup area marked")},{id:"guest_flow",l:T2("Guest entry/exit flow planned")}]},
          {phase:"equipment",label:T2("Equipment"),icon:"🔧",checks:[
            {id:"generators",l:T2("Generators positioned & tested")},{id:"gas_cylinders",l:T2("Gas cylinders loaded")},{id:"tandoors",l:T2("Tandoors & burners setup")},{id:"fridge",l:T2("Fridge truck at site")},{id:"tables",l:T2("Tables & counters placed")},{id:"tent",l:T2("Kitchen tent / shade ready")}]},
          {phase:"food",label:T2("Food Dispatch"),icon:"🍛",checks:[
            {id:"dry_load",l:T2("Dry items loaded & checked")},{id:"cold_load",l:T2("Cold items in fridge truck")},{id:"crockery",l:T2("Crockery loaded per checklist")},{id:"consumables",l:T2("Gas, coal, napkins, dustbins")},{id:"staff_food",l:T2("Staff meals packed")}]},
          {phase:"service",label:T2("On-Site Service"),icon:"🍽️",checks:[
            {id:"buffet_ready",l:T2("Buffet counters dressed")},{id:"live_counters",l:T2("Live counters operational")},{id:"water_station",l:T2("Water & welcome drink ready")},{id:"staff_uniform",l:T2("All staff in uniform")},{id:"gopal_walkthrough",l:T2("Gopal final walkthrough done")}]},
          {phase:"teardown",label:T2("Teardown"),icon:"📦",checks:[
            {id:"food_packed",l:T2("Leftover food packed")},{id:"equipment_count",l:T2("Equipment count verified")},{id:"crockery_count",l:T2("Crockery count — breakage noted")},{id:"site_clean",l:T2("Site cleaned")},{id:"vehicles_loaded",l:T2("All vehicles loaded & departed")}]},
        ];
        const allOdc = [...odcEvs,...tomorrowOdc];
        return (
          <div>
            {allOdc.map(ev=>{
              const evChecks = odcChecks[ev.id]||{};
              return (
                <Card key={ev.id} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",background:C.wineBg,borderBottom:`1px solid ${C.wineBorder}`}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.gold}}>{ev.guest}</div>
                    <div style={{fontSize:12,color:C.muted}}>{ev.date===TODAY?T2("Today"):T2("Tomorrow")} · {ev.time} · {ev.pax} {T2("pax")}</div>
                  </div>
                  {ODC_PHASES.map(phase=>{
                    const doneCt = phase.checks.filter(c=>evChecks[phase.phase+"_"+c.id]).length;
                    return (
                      <div key={phase.phase} style={{padding:"12px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                          <span style={{fontSize:12,fontWeight:700,color:C.text}}>{phase.icon} {phase.label}</span>
                          <span style={{fontSize:10,fontWeight:600,color:doneCt===phase.checks.length?C.green:C.muted}}>{doneCt}/{phase.checks.length}</span>
                        </div>
                        {phase.checks.map(c=>{
                          const key = phase.phase+"_"+c.id;
                          const done = !!evChecks[key];
                          return (
                            <div key={c.id} onClick={()=>setOdcChecks(p=>({...p,[ev.id]:{...(p[ev.id]||{}),[key]:!done}}))}
                              style={{display:"flex",gap:8,alignItems:"center",padding:"4px 0",cursor:"pointer"}}>
                              <div style={{width:20,height:20,borderRadius:3,border:`2px solid ${done?C.green:C.border}`,background:done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                {done&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                              </div>
                              <span style={{fontSize:11,color:done?C.green:C.text,textDecoration:done?"line-through":"none"}}>{c.l}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </Card>
              );
            })}
            {allOdc.length===0&&<div style={{textAlign:"center",padding:24,background:C.bg,borderRadius:10,color:C.muted,fontSize:12}}>{T2("No ODC events scheduled")}</div>}
          </div>
        );
      })()}

      {/* ══════ REPAIR & MAINTENANCE TAB (all depts) ══════ */}
      {activeTab==="repair"&&<RepairMaintenance lang={lang} currentDept={selDept||forceDept||"kitchen"}/>}

    </div>
  );
}
function StaffView({user, attendance, setAttendance, leaves, setLeaves, onLogout, lang="en"}) {
  const T2 = s => T(s, lang);
  if(!user || !user.id) return <div style={{padding:40,textAlign:"center",color:"#888"}}>No user session. Please log in.</div>;
  const [tab,setTab]       = useState("home");
  const [selfie,setSelfie] = useState(null);
  const [grooming,setGrooming] = useState({});
  const [note,setNote]     = useState("");
  const [attStep,setAttStep] = useState("check");  // check | capture | done
  const [leaveForm,setLeaveForm] = useState({from:"",to:"",reason:""});

  const todayRec = (attendance||[]).find(a=>a.staffId===user.staffListId&&a.date===TODAY);
  const myLeaves = (leaves||[]).filter(l=>l.staffName===user.name);
  const staffIdx = STAFF_LIST.findIndex(s=>s.id===user.staffListId);
  const allOk    = GROOMING_CHECKS.every(c=>grooming[c.id]);

  function submitAtt(status) {
    setAttendance(p=>[...p.filter(a=>!(a.staffId===user.staffListId&&a.date===TODAY)),
      {id:Date.now(),staffId:user.staffListId,staffName:user.name,section:user.section,date:TODAY,
       time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
       status,selfie,grooming,groomingFailed:!allOk,note,role:user.role}
    ]);
    setAttStep("done");
  }

  function submitLeave() {
    if(!leaveForm.from||!leaveForm.to)return;
    setLeaves(p=>[...p,{...leaveForm,id:Date.now(),staffName:user.name,staffSection:user.section,staffId:user.id,status:"Pending"}]);
    setLeaveForm({from:"",to:"",reason:""});
  }

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif"}}>
      {/* Top bar */}
      <div style={{background:C.gold,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Avatar name={user.name} size={36} index={staffIdx>=0?staffIdx:0}/>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{user.name}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>{user.id} · {user.section} · {user.dept}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{background:"rgba(196,164,74,.2)",border:"1px solid rgba(255,255,255,.3)",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 14px",cursor:"pointer"}}>{T2("Sign Out")}</button>
      </div>

      {/* Tab bar */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",display:"flex",gap:6}}>
        {[{id:"home",l:"🏠 Home"},{id:"attendance",l:"✅ Attendance"},{id:"leaves",l:"🌿 My Leaves"},{id:"profile",l:"👤 Profile"}].map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);if(t.id==="attendance")setAttStep("check");}} style={{
            padding:"12px 16px",border:"none",borderBottom:`2.5px solid ${tab===t.id?C.wine:"transparent"}`,
            background:"transparent",fontSize:12,fontWeight:tab===t.id?600:400,
            color:tab===t.id?C.wine:C.muted,cursor:"pointer",
          }}>{lang==="hi"&&t.hi?t.hi:t.l}</button>
        ))}
      </div>

      <div style={{padding:"20px",maxWidth:640,margin:"0 auto"}}>

        {/* ── HOME ── */}
        {tab==="home"&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:14}}>Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, {(user.name||"").split(" ")[0]} 👋</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div style={{background:todayRec?.status==="Present"?C.greenBg:C.redBg,borderRadius:12,padding:"14px 16px",border:`1px solid ${todayRec?.status==="Present"?C.greenBorder:C.redBorder}`}}>
                <div style={{fontSize:12,fontWeight:600,color:todayRec?.status==="Present"?C.green:C.red,marginBottom:4}}>Today's Attendance</div>
                <div style={{fontSize:18,fontWeight:700,color:todayRec?.status==="Present"?C.green:C.red}}>{todayRec?todayRec.status:"Not marked"}</div>
                {todayRec&&<div style={{fontSize:12,color:C.muted,marginTop:3}}>Marked at {todayRec.time}</div>}
                {!todayRec&&<button onClick={()=>setTab("attendance")} style={{marginTop:8,padding:"5px 12px",borderRadius:7,background:"linear-gradient(135deg,#C4A44A,#8B6914)",color:"#0A0A0F",border:"none",fontSize:11,cursor:"pointer"}}>Mark Now →</button>}
              </div>
              <div style={{background:C.blueBg,borderRadius:12,padding:"14px 16px",border:`1px solid ${C.blueBorder}`}}>
                <div style={{fontSize:12,fontWeight:600,color:C.blue,marginBottom:4}}>{T2("Leave Balance")}</div>
                <div style={{fontSize:18,fontWeight:700,color:C.blue}}>{myLeaves.filter(l=>l.status==="Approved").length} taken</div>
                <div style={{fontSize:12,color:C.muted,marginTop:3}}>{myLeaves.filter(l=>l.status==="Pending").length} pending approval</div>
              </div>
            </div>
            <Card>
              <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>Today's Events at Ambria</div>
              {LIVE_EVENTS_INIT.slice(0,2).map((ev,i)=>(
                <div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                  <div style={{fontSize:12,fontWeight:500,color:C.text}}>{ev.guest}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{ev.date} · {ev.time} · {ev.pax} pax · {ev.venue}</div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── ATTENDANCE ── */}
        {tab==="attendance"&&(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:14}}>Mark Attendance — {TODAY_LABEL}</div>

            {todayRec&&attStep==="check"&&(
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:12,padding:"16px",marginBottom:14,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>✅</div>
                <div style={{fontSize:15,fontWeight:700,color:C.green}}>Already marked — {todayRec.status}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>Checked in at {todayRec.time}</div>
                {todayRec.selfie&&<img src={todayRec.selfie} alt="" style={{width:80,height:60,objectFit:"cover",borderRadius:8,border:`2px solid ${C.greenBorder}`,marginTop:10}}/>}
                <div style={{marginTop:12}}>
                  <button onClick={()=>setAttStep("capture")} style={{padding:"7px 16px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:12,cursor:"pointer"}}>Re-mark Attendance</button>
                </div>
              </div>
            )}

            {attStep==="done"&&(
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:12,padding:"24px",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:10}}>✅</div>
                <div style={{fontSize:16,fontWeight:700,color:C.green}}>{T2("Attendance marked!")}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>{TODAY} · {new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                {!allOk&&<div style={{marginTop:10,padding:"8px 12px",background:C.amberBg,borderRadius:8,fontSize:12,color:C.amber}}>⚠ Some grooming checks were incomplete — supervisor notified</div>}
                <button onClick={()=>setAttStep("check")} style={{marginTop:14,padding:"8px 18px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:12,cursor:"pointer"}}>Done</button>
              </div>
            )}

            {(attStep==="capture"||(!todayRec&&attStep==="check"))&&(
              <div>
                <Card style={{marginBottom:12}}>
                  <SectionHeader icon="📷" title="Take a Selfie"/>
                  <SelfieCapture captured={selfie} onCapture={setSelfie} onRetake={()=>setSelfie(null)} lang={lang}/>
                  {!selfie&&<div style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:8}}>{T2("Required to mark attendance")}</div>}
                </Card>
                <Card style={{marginBottom:12}}>
                  <SectionHeader icon="✓" title="Grooming Self-Check"/>
                  <div style={{fontSize:11,color:C.muted,marginBottom:10}}>{T2("Confirm your grooming before starting shift:")}</div>
                  {GROOMING_CHECKS.map(c=>(
                    <label key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer"}}>
                      <input type="checkbox" checked={!!grooming[c.id]} onChange={e=>setGrooming(p=>({...p,[c.id]:e.target.checked}))} style={{width:20,height:20,accentColor:C.wine,cursor:"pointer"}}/>
                      <span style={{fontSize:13,color:C.text}}>{c.label}</span>
                      {grooming[c.id]&&<span style={{marginLeft:"auto",fontSize:11,color:C.green,fontWeight:500}}>✓</span>}
                    </label>
                  ))}
                  {!allOk&&<div style={{marginTop:8,padding:"10px 14px",background:C.amberBg,borderRadius:7,fontSize:11,color:C.amber}}>{GROOMING_CHECKS.filter(c=>!grooming[c.id]).length} items pending — supervisor will be notified</div>}
                </Card>
                <div style={{display:"flex",gap:8}}>
                  <Btn onClick={()=>{if(!selfie){alert("Please capture selfie first");return;}submitAtt("Present");}} color={C.wine} style={{flex:1,padding:"12px",fontSize:14,fontWeight:600}}>✓ Mark Present</Btn>
                  <Btn onClick={()=>submitAtt(T2("Late"))} color={C.amberBg} textColor={C.amber} border={`1px solid ${C.amberBorder}`} style={{padding:"12px 16px",fontSize:13}}>Late</Btn>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LEAVES ── */}
        {tab==="leaves"&&(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:14}}>{T2("My Leave Requests")}</div>
            <Card style={{marginBottom:14}}>
              <SectionHeader icon="+" title="Request Leave"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:4}}>From</div>
                  <input type="date" value={leaveForm.from} onChange={e=>setLeaveForm(p=>({...p,from:e.target.value}))} style={{width:"100%",padding:"8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:4}}>To</div>
                  <input type="date" value={leaveForm.to} onChange={e=>setLeaveForm(p=>({...p,to:e.target.value}))} style={{width:"100%",padding:"8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
                </div>
              </div>
              <input value={leaveForm.reason} onChange={e=>setLeaveForm(p=>({...p,reason:e.target.value}))} placeholder={T2("Reason (optional)")}
                style={{width:"100%",padding:"8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,marginBottom:10,boxSizing:"border-box"}}/>
              <Btn onClick={submitLeave} style={{width:"100%",padding:"10px",fontSize:13}}>{T2("Submit Request")}</Btn>
              <div style={{marginTop:8,fontSize:11,color:C.muted}}>Requests go to Yatender for approval.</div>
            </Card>
            {myLeaves.length===0&&<div style={{fontSize:13,color:C.muted,textAlign:"center",padding:20}}>No leave requests yet.</div>}
            {myLeaves.map((l,i)=>(
              <div key={l.id||i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text}}>{l.from} → {l.to}</div>
                    {l.reason&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{l.reason}</div>}
                    {l.rejectReason&&<div style={{fontSize:11,color:C.red,marginTop:2}}>Reason: {l.rejectReason}</div>}
                  </div>
                  <Chip label={l.status==="Approved"?"✓ Approved":l.status==="Rejected"?"✗ Rejected":"⏳ Pending"}
                    color={l.status==="Approved"?C.green:l.status==="Rejected"?C.red:C.amber}
                    bg={l.status==="Approved"?C.greenBg:l.status==="Rejected"?C.redBg:C.amberBg}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PROFILE ── */}
        {tab==="profile"&&(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:14}}>{T2("My Profile")}</div>
            <Card style={{marginBottom:12}}>
              <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:16}}>
                <Avatar name={user.name} size={64} index={staffIdx>=0?staffIdx:0}/>
                <div>
                  <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{user.name}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:3}}>{user.section} · {user.dept}</div>
                  <Chip label={user.role==="headchef"?"Head Chef":user.role==="admin"?"Admin":"Kitchen Staff"} color={C.wine} bg={C.wineBg} size={11}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  {l:"Employee ID",v:user.id},
                  {l:"Section",v:user.section},
                  {l:"Department",v:user.dept},
                  {l:"Joining Date",v:user.joining},
                  {l:"Service",v:yrsOfService(user.joining)},
                  {l:"Venue",v:"Ambria Pushpanjali / Exotica"},
                ].map(f=>(
                  <div key={f.l} style={{background:C.bg,borderRadius:8,padding:"9px 12px"}}>
                    <div style={{fontSize:12,color:C.muted}}>{f.l}</div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,marginTop:2}}>{f.v}</div>
                  </div>
                ))}
              </div>
            </Card>
            <div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"10px 0"}}>
              To update PIN or profile details, contact Efficiency Manager (Abhi) · ID: AM001
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EMPLOYEE MANAGEMENT (admin only) ─────────────────────────────




function Dashboard({attendance,events,setEvents,leaves,setScreen,kitchenTracking,repairs=[],lang="en"}) {
  const T2 = s => T(s, lang);
  const safeEvs = Array.isArray(events)?events.filter(e=>e&&typeof e.date==="string"&&e.date.length===10):[];
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = TODAY; // use the app-level TODAY constant (local date, not UTC-shifted)
  const MO_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const VENUES = ["Ambria Pushpanjali","Ambria Exotica","Manaktala Farm","Outdoor Catering (ODC)"];
  const pad = n => String(n).padStart(2,"0");

  const VP = {
    "Ambria Pushpanjali":{code:"AP",c:"#D06040",bg:C.redBg},
    "Ambria Exotica":{code:"AE",c:"#C08A15",bg:C.goldBg},
    "Manaktala Farm":{code:"MKT",c:"#D4A843",bg:"#1A1610"},
    "Ambria Restro":{code:"AR",c:"#50B0A0",bg:"#0E1E1A"},
    "Outdoor Catering (ODC)":{code:"ODC",c:"#8A70C8",bg:"#14101E"},
    "Ambria Manaktala":{code:"AM",c:"#B05A10",bg:"#1A1610"},
    "Ambria Cuisine":{code:"AC",c:"#185FA5",bg:"#EEF4FD"},
  };
  const gp = v => VP[v]||{code:"EV",c:C.wine,bg:C.wineBg};
  const TYPE_ICONS={"Wedding":"💍","Reception":"🥂","Corporate":"💼","Outdoor":"🌿","Birthday":"🎂","Other":"🎉"};

  // State
  const [yr, setYr] = useState(today.getFullYear());
  const [mo, setMo] = useState(today.getMonth());
  const [sel, setSel] = useState(todayStr);
  const [openEv, setOpenEv] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [venFil, setVenFil] = useState("All");
  const [form, setForm] = useState({guest:"",venue:"Ambria Pushpanjali",date:"",time:"7:30 PM",type:"Wedding",pax:"",veg:"",nonveg:"",menuPackage:"",menu:"",special:""});
  const [closureEv, setClosureEv] = useState(null);
  const [closureRemark, setClosureRemark] = useState("");
  const [closureRating, setClosureRating] = useState("");

  // FY
  const FY_START=`${today.getFullYear()}-04-01`, FY_END=`${today.getFullYear()+1}-03-31`;
  const fyEvs=safeEvs.filter(ev=>ev.date>=FY_START&&ev.date<=FY_END);
  const fyUpcoming=fyEvs.filter(ev=>ev.date>=todayStr);
  const fyPast=fyEvs.filter(ev=>ev.date<todayStr);

  // Calendar
  const filtered = venFil==="All"?safeEvs:safeEvs.filter(e=>e.venue===venFil);
  const first = new Date(yr,mo,1).getDay();
  const dim = new Date(yr,mo+1,0).getDate();
  const prevDim = new Date(yr,mo,0).getDate();
  const cells=[];
  for(let i=first-1;i>=0;i--) cells.push({d:prevDim-i,c:false});
  for(let i=1;i<=dim;i++) cells.push({d:i,c:true});
  while(cells.length<42) cells.push({d:cells.length-first-dim+1,c:false});
  const cd = cell=>cell.c?`${yr}-${pad(mo+1)}-${pad(cell.d)}`:null;
  const eod = d=>filtered.filter(e=>e.date===d);
  const prev = ()=>{if(mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1);};
  const next = ()=>{if(mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1);};

  const selEvs = sel?eod(sel):[];
  const todayEvs = eod(todayStr);
  const upcoming = filtered.filter(e=>e.date>todayStr).sort((a,b)=>a.date.localeCompare(b.date));
  const monthEvs = filtered.filter(e=>(e.date||"").startsWith(`${yr}-${pad(mo+1)}`));
  const monthPax = monthEvs.reduce((s,e)=>s+(+e.pax||0),0);

  function genId(){const ns=safeEvs.map(e=>+(e.id||"").replace(/\D/g,"")).filter(Boolean);return `FP-${new Date().getFullYear()}-${String(Math.max(0,...ns)+1).padStart(3,"0")}`;}
  function openAdd(dt){setForm({guest:"",venue:"Ambria Pushpanjali",date:dt||"",time:"7:30 PM",type:"Wedding",pax:"",veg:"",nonveg:"",menuPackage:"",menu:"",special:""});setEditId(null);setShowForm(true);}
  function openEdit(ev){setForm({guest:ev.guest||"",venue:ev.venue||"Ambria Pushpanjali",date:ev.date||"",time:ev.time||"7:30 PM",type:ev.type||"Wedding",pax:String(ev.pax||""),veg:String(ev.veg||""),nonveg:String(ev.nonveg||""),menuPackage:ev.menuPackage||"",menu:(ev.menu||[]).join(", "),special:ev.special||""});setEditId(ev.id);setShowForm(true);}
  function saveForm(){
    if(!form.guest||!form.date||!form.pax)return;
    const mi=form.menuPackage&&MENU_PACKAGES[form.menuPackage]?MENU_PACKAGES[form.menuPackage]:(form.menu||"").split(",").map(s=>s.trim()).filter(Boolean);
    const d={...form,pax:+form.pax,veg:+form.veg||0,nonveg:+form.nonveg||0,menu:mi};
    if(editId){setEvents(p=>(p||[]).map(e=>e.id!==editId?e:{...e,...d}));}else{setEvents(p=>[...(p||[]),{id:genId(),...d,extras:[]}]);}
    setShowForm(false);setEditId(null);setSel(form.date);
  }
  function delEv(id){setEvents(p=>(p||[]).filter(e=>e.id!==id));setDeleteId(null);setOpenEv(null);}
  const fld={width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"};

  return (
    <div>
      {/* ── Delete modal ── */}
      {deleteId&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.surface,borderRadius:14,padding:"22px 26px",maxWidth:320,textAlign:"center"}}>
            <div style={{fontSize:26,marginBottom:6}}>🗑</div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:14}}>{T2("Delete this function?")} {(()=>{const ev=safeEvs.find(e=>e.id===deleteId)||{};return ev.venue?gp(ev.venue).code+" · "+ev.type:"";})()}</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <Btn onClick={()=>delEv(deleteId)} color={C.red} style={{fontSize:12,padding:"7px 18px"}}>{T2("Delete")}</Btn>
              <Btn onClick={()=>setDeleteId(null)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>{T2("Cancel")}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit modal ── */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:520,maxHeight:"88vh",overflow:"auto"}}>
            <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.surface,zIndex:1}}>
              <span style={{fontSize:14,fontWeight:700,color:C.text}}>{editId?`✏️ ${T2("Edit Function")}`:`➕ ${T2("New Function")}`}</span>
              <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.muted}}>×</button>
            </div>
            <div style={{padding:"14px 18px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:10}}>
                <div style={{gridColumn:"1/-1"}}><div style={{fontSize:11,color:C.muted,marginBottom:2,fontWeight:600}}>{T2("GUEST NAME *")}</div><input value={form.guest} onChange={e=>setForm(p=>({...p,guest:e.target.value}))} placeholder="e.g. Sharma Wedding" style={fld} autoFocus/></div>
                {[{l:T2("VENUE"),k:"venue",t:"sel",o:VENUES},{l:T2("TYPE"),k:"type",t:"sel",o:["Wedding","Reception","Corporate","Birthday","Other"]},{l:T2("DATE *"),k:"date",t:"date"},{l:T2("TIME"),k:"time",ph:"7:30 PM"},{l:T2("TOTAL PAX *"),k:"pax",t:"number",ph:"500"},{l:T2("VEG"),k:"veg",t:"number",ph:"300"},{l:T2("NON-VEG"),k:"nonveg",t:"number",ph:"200"},{l:T2("MENU PACKAGE"),k:"menuPackage",t:"sel",o:["(Custom)",...Object.keys(MENU_PACKAGES)]}].map(f=>(
                  <div key={f.k}><div style={{fontSize:11,color:C.muted,marginBottom:2,fontWeight:600}}>{f.l}</div>
                    {f.t==="sel"?<select value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={fld}>{f.o.map(o=><option key={o}>{o}</option>)}</select>
                    :<input type={f.t||"text"} value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={fld}/>}
                  </div>
                ))}
                {form.menuPackage&&form.menuPackage!=="(Custom)"&&<div style={{gridColumn:"1/-1",background:C.wineBg,borderRadius:8,padding:"6px 10px",fontSize:11,color:C.gold}}>📋 {(MENU_PACKAGES[form.menuPackage]||[]).length} {T2("dishes")} — {form.menuPackage}</div>}
                {(!form.menuPackage||form.menuPackage==="(Custom)")&&<div style={{gridColumn:"1/-1"}}><div style={{fontSize:11,color:C.muted,marginBottom:2,fontWeight:600}}>{T2("CUSTOM MENU")}</div><textarea value={form.menu} onChange={e=>setForm(p=>({...p,menu:e.target.value}))} placeholder="Dal Makhni, Paneer Tikka…" style={{...fld,height:44,resize:"none"}}/></div>}
                <div style={{gridColumn:"1/-1"}}><div style={{fontSize:11,color:C.muted,marginBottom:2,fontWeight:600}}>{T2("SPECIAL INSTRUCTIONS")}</div><input value={form.special} onChange={e=>setForm(p=>({...p,special:e.target.value}))} placeholder="Jain, no onion-garlic…" style={fld}/></div>
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <Btn onClick={()=>{setShowForm(false);setEditId(null);}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>{T2("Cancel")}</Btn>
                <Btn onClick={saveForm} color={C.wine} style={{fontSize:12,padding:"8px 20px"}} disabled={!form.guest||!form.date||!form.pax}>{editId?T2("Save Changes"):T2("Add Function ✓")}</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ OPERATIONAL KPI TILES ══ */}
      {(()=>{
        const staffToday = Object.values(attendance||{}).filter(r=>r.date===TODAY&&r.status==="Present").length;
        const allStaff = Object.keys(attendance||{}).length||1;
        const lowStockCount = (typeof INIT!=="undefined"?INIT:[]).filter(i=>i.inStock<=i.minStock&&i.inStock>=0).length;
        const todayPax = todayEvs.reduce((s,e)=>s+(+e.pax||0),0);
        const kitchenKt = kitchenTracking&&typeof kitchenTracking==="object"?kitchenTracking:{};
        const readyDishes = Object.values(kitchenKt).reduce((s,ev)=>s+Object.values(ev||{}).filter(d=>d&&d.ready).length,0);
        const openRepairs = safeArr(repairs).filter(t=>t.status==="Open"||t.status==="In Progress").length;
        return(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
            {[
              {icon:"🎉",l:T2("Today"),v:todayEvs.length,sub:todayPax?`${todayPax.toLocaleString()} pax`:`${upcoming.slice(0,1).map(e=>`${VP[e.venue]?.code||"EV"} · ${e.type}`).join("")||T2("No events")}`,c:C.gold,bg:C.goldBg,bdr:C.goldBorder,action:()=>setScreen&&setScreen("kitchen")},
              {icon:"📋",l:T2("This Month"),v:monthEvs.length,sub:`${monthPax.toLocaleString()} pax`,c:C.blue,bg:C.blueBg,bdr:C.blueBorder},
              {icon:"📅",l:T2("FY Total"),v:fyEvs.length,sub:`${fyUpcoming.length} ${T2("upcoming")}`,c:C.purple,bg:C.purpleBg,bdr:C.purpleBorder},
              {icon:"👨‍🍳",l:T2("Staff Today"),v:staffToday,sub:`${T2("of")} ${allStaff} ${T2("total")}`,c:staffToday>0?C.green:C.red,bg:staffToday>0?C.greenBg:C.redBg,bdr:staffToday>0?C.greenBorder:C.redBorder,action:()=>setScreen&&setScreen("team")},
              {icon:"📦",l:T2("Low Stock"),v:lowStockCount,sub:T2("items need reorder"),c:lowStockCount>0?C.amber:C.green,bg:lowStockCount>0?C.amberBg:C.greenBg,bdr:lowStockCount>0?C.amberBorder:C.greenBorder,action:()=>setScreen&&setScreen("store")},
              {icon:"🔧",l:T2("Open Issues"),v:openRepairs,sub:T2("repair tickets"),c:openRepairs>0?C.red:C.green,bg:openRepairs>0?C.redBg:C.greenBg,bdr:openRepairs>0?C.redBorder:C.greenBorder,action:()=>setScreen&&setScreen("repair")},
            ].map(s=>(
              <div key={s.l} onClick={s.action||null} style={{background:s.bg,borderRadius:14,padding:"16px 14px",border:`1px solid ${s.bdr}`,cursor:s.action?"pointer":"default",transition:"all .2s"}}>
                <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                <div style={{fontSize:26,fontWeight:800,color:s.c,lineHeight:1,letterSpacing:-1}}>{s.v}</div>
                <div style={{fontSize:12,fontWeight:600,color:C.muted,marginTop:5}}>{s.l}</div>
                {s.sub&&<div style={{fontSize:11,color:s.c,marginTop:2}}>{s.sub}</div>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ══ UPCOMING EVENTS STRIP ══ */}
      {upcoming.length>0&&(
        <Card style={{marginBottom:16,padding:"14px 18px"}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10,fontFamily:"var(--font-display)",letterSpacing:.4}}>📅 {T2("Upcoming Functions")} <span style={{fontSize:11,color:C.muted,fontWeight:400}}>({upcoming.length})</span></div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {upcoming.slice(0,4).map(ev=>{
              const vp=gp(ev.venue);const daysDiff=Math.round((new Date(ev.date+"T00:00")-new Date(TODAY+"T00:00"))/(864e5));
              return(
                <div key={ev.id} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",background:C.darkCard,borderRadius:10,border:`1px solid ${C.border}`}}>
                  <div style={{width:38,height:38,borderRadius:10,background:vp.c+"15",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <div style={{fontSize:14,fontWeight:800,color:vp.c,lineHeight:1}}>{new Date(ev.date+"T00:00").getDate()}</div>
                    <div style={{fontSize:9,color:vp.c}}>{new Date(ev.date+"T00:00").toLocaleString("en",{month:"short"})}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{vp.code} · {ev.type} · {ev.pax} pax</div>
                    <div style={{fontSize:11,color:C.muted}}>{ev.venue} · {ev.time}</div>
                  </div>
                  <div style={{textAlign:"center",flexShrink:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:daysDiff===1?C.amber:vp.c}}>{daysDiff===1?"Tomorrow":daysDiff+"d"}</div>
                    <div style={{fontSize:10,color:C.muted}}>{ev.menuPackage?.split(" ").slice(0,2).join(" ")||"Custom"}</div>
                  </div>
                </div>
              );
            })}
            {upcoming.length>4&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"6px 0"}}>+{upcoming.length-4} {T2("more")}</div>}
          </div>
        </Card>
      )}

      {/* ══ CALENDAR ══ */}
      <Card style={{marginBottom:20,padding:0,overflow:"hidden"}}>
        {/* Month nav */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={prev} style={{background:C.darkCard,border:`1px solid ${C.border}`,borderRadius:10,width:40,height:40,cursor:"pointer",fontSize:16,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
            <div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:"var(--font-display)",minWidth:180,textAlign:"center"}}>{MO_FULL[mo]} {yr}</div>
            <button onClick={next} style={{background:C.darkCard,border:`1px solid ${C.border}`,borderRadius:10,width:40,height:40,cursor:"pointer",fontSize:16,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={()=>{setYr(today.getFullYear());setMo(today.getMonth());setSel(todayStr);}} style={{padding:"8px 14px",borderRadius:10,background:C.wineBg,border:`1px solid ${C.wineBorder}`,color:C.gold,fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>{T2("Today")}</button>
            <button onClick={()=>openAdd(sel||todayStr)} style={{padding:"8px 16px",borderRadius:10,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>+ {T2("Add")}</button>
          </div>
        </div>
        {/* Venue filter */}
        <div style={{display:"flex",gap:6,padding:"10px 18px",borderBottom:`1px solid ${C.border}`,flexWrap:"wrap"}}>
          {["All",...VENUES].map(v=>{
            const p=v==="All"?{c:C.text}:gp(v);const on=venFil===v;
            return <button key={v} onClick={()=>setVenFil(v)} style={{padding:"6px 14px",borderRadius:10,fontSize:12,fontWeight:on?700:400,cursor:"pointer",background:on?p.c+"20":"transparent",color:on?p.c:C.muted,border:`1.5px solid ${on?p.c:C.border}`,minHeight:36}}>{v==="All"?"All":(VP[v]||{}).code||v.slice(0,3)}</button>;
          })}
        </div>
        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {DY.map(d=><div key={d} style={{textAlign:"center",fontSize:13,fontWeight:700,color:C.muted,padding:"8px 0",background:C.bg}}>{d}</div>)}
        </div>
        {/* Cells */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {cells.map((cell,i)=>{
            const dt=cd(cell);const evs2=dt?eod(dt):[];const isT=dt===todayStr;const isS=dt===sel;
            const row=Math.floor(i/7);
            const vCols=[...new Set(evs2.map(e=>gp(e.venue).c))];
            return (
              <div key={i} onClick={()=>{if(!dt)return;setSel(isS?null:dt);setOpenEv(null);}} onDoubleClick={()=>{if(dt)openAdd(dt);}}
                style={{height:64,padding:"6px 8px",cursor:dt?"pointer":"default",
                  borderBottom:row<5?`1px solid ${C.borderLight}`:"none",borderRight:(i%7)<6?`1px solid ${C.borderLight}`:"none",
                  background:isS?C.wine+"20":isT?C.wine+"08":"transparent",opacity:cell.c?1:.15}}>
                <div style={{fontSize:14,fontWeight:isT||isS?800:500,color:isS?C.wine:isT?C.gold:C.text}}>{cell.d}</div>
                {vCols.length>0&&<div style={{display:"flex",gap:3,marginTop:4}}>{vCols.slice(0,4).map((col,ci)=><div key={ci} style={{width:8,height:8,borderRadius:"50%",background:col}}/>)}</div>}
                {evs2.length>1&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{evs2.length} fn</div>}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{display:"flex",gap:10,padding:"8px 18px",borderTop:`1px solid ${C.border}`}}>
          {Object.entries(VP).filter(([k])=>VENUES.includes(k)).map(([v,p])=>(
            <div key={v} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:p.c}}/><span style={{fontSize:11,color:C.muted}}>{p.code}</span></div>
          ))}
        </div>
      </Card>

      {/* ══ SELECTED DATE EVENTS (below calendar, full width) ══ */}
      {sel&&(
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:16,fontWeight:800,color:C.text}}>{new Date(sel+"T00:00").toLocaleDateString(lang==="hi"?"hi-IN":"en-IN",{weekday:"long",day:"numeric",month:"long"})}</div>
              {sel===todayStr&&<span style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:C.gold,color:"#fff",fontWeight:700}}>{T2("Today")}</span>}
            </div>
            <button onClick={()=>openAdd(sel)} style={{padding:"10px 18px",borderRadius:10,background:C.gold,color:"#0A0A0F",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>+ {T2("Add Function")}</button>
          </div>
          {selEvs.length===0?(
            <div style={{background:C.surface,borderRadius:12,padding:20,textAlign:"center",fontSize:13,color:C.muted,border:`1px solid ${C.border}`}}>{T2("No functions on this date")}</div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:selEvs.length===1?"1fr":"1fr 1fr",gap:10}}>
              {selEvs.map(ev=>{
                const p=gp(ev.venue);const isO=openEv===ev.id;
                return (
                  <div key={ev.id} style={{background:C.surface,border:`2px solid ${isO?p.c:C.border}`,borderRadius:14,overflow:"hidden"}}>
                    <div onClick={()=>setOpenEv(isO?null:ev.id)} style={{padding:"14px 16px",cursor:"pointer",borderLeft:`4px solid ${p.c}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:15,fontWeight:700,color:C.text}}>{p.code} · {TYPE_ICONS[ev.type]||"🎉"} {ev.type}</div>
                          <div style={{fontSize:12,color:C.muted,marginTop:3}}>⏰ {ev.time} · 👥 {ev.pax} {T2("pax")} · 📍 {ev.venue}</div>
                        </div>
                        <span style={{fontSize:13,fontWeight:700,padding:"4px 10px",borderRadius:8,background:p.bg,color:p.c}}>{p.code}</span>
                      </div>
                      {ev.menuPackage&&<div style={{fontSize:12,color:C.gold,marginTop:4}}>📜 {ev.menuPackage}</div>}
                      {ev.special&&<div style={{fontSize:12,color:C.amber,marginTop:3}}>⚠ {ev.special}</div>}
                    </div>
                    {isO&&(
                      <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,background:C.bg}}>
                        <div style={{fontSize:12,color:C.text,marginBottom:8}}>📍 {ev.venue} · {TYPE_ICONS[ev.type]||"🎉"} {T2(ev.type)} · {T2("VEG")}:{ev.veg||ev.pax} / {T2("NON-VEG")}:{ev.nonveg||0} · ID: {ev.id}</div>
                        {ev.menuPackage&&<div style={{fontSize:12,color:C.muted,marginBottom:8}}>🍽 {(ev.menu||[]).filter(d=>guessSectionForDish(d)!=="Beverages").length} {T2("dishes")}</div>}
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>openEdit(ev)} style={{flex:1,padding:"10px",borderRadius:10,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>✏ {T2("Edit")}</button>
                          <button onClick={()=>setDeleteId(ev.id)} style={{padding:"10px 14px",borderRadius:10,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>🗑</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ TODAY'S LIVE EVENTS ══ */}
      {todayEvs.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:800,color:C.text,fontFamily:"var(--font-display)",marginBottom:12}}>🔴 {T2("Live today")} — {todayEvs.length} {T2("functions")}</div>
          <div style={{display:"grid",gridTemplateColumns:todayEvs.length===1?"1fr":"1fr 1fr",gap:12}}>
            {todayEvs.map(ev=>{
              const p=gp(ev.venue);
              return (
                <div key={ev.id} style={{background:C.surface,border:`2px solid ${p.c}40`,borderRadius:14,overflow:"hidden"}}>
                  <div style={{height:4,background:p.c}}/>
                  <div style={{padding:"16px 18px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <span style={{fontSize:12,fontWeight:700,padding:"4px 10px",borderRadius:8,background:p.bg,color:p.c}}>{p.code}</span>
                        <div style={{fontSize:16,fontWeight:800,color:C.text,marginTop:6}}>{TYPE_ICONS[ev.type]||"🎉"} {ev.type}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:20,fontWeight:700,color:p.c}}>{ev.pax}</div>
                        <div style={{fontSize:12,color:C.muted}}>{T2("pax")}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:12,color:C.muted}}>
                      <span>⏰ {ev.time}</span>
                      <span>📍 {ev.venue}</span>
                      {ev.menuPackage&&<span style={{color:C.gold}}>📜 {ev.menuPackage}</span>}
                    </div>
                    {ev.special&&<div style={{marginTop:6,fontSize:12,color:C.amber}}>⚠ {ev.special}</div>}
                    {/* Event Closure Report button */}
                    <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                      <button onClick={()=>setClosureEv(closureEv?.id===ev.id?null:ev)} style={{width:"100%",padding:"10px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>
                        📊 {T2("Event Closure Report")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ EVENT CLOSURE REPORT MODAL ══ */}
      {closureEv&&(()=>{
        const ev=closureEv;
        const kt=kitchenTracking&&typeof kitchenTracking==="object"?kitchenTracking:{};
        const menu=(ev.menu||[]).filter(d=>{const sec=guessSectionForDish?.(d)||"";return sec!=="Beverages";});
        const readyDishes=menu.filter((_,i)=>{const d=kt[ev.id]?.[`d_${i}`];return d?.ready;});
        const dispatchDishes=menu.filter((_,i)=>{const d=kt[ev.id]?.[`d_${i}`];return d?.dispatchReady;});
        const notReady=menu.filter((_,i)=>{const d=kt[ev.id]?.[`d_${i}`];return !d?.ready;});
        const allStaffToday=Object.values(attendance||{}).filter(r=>r.date===TODAY&&r.status==="Present");
        const issues=["RM-001","RM-002","RM-003"].length; // open tickets
        return(
          <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
            <div style={{background:C.surface,borderRadius:20,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto",border:`1px solid ${C.goldBorder}`,boxShadow:"0 32px 80px rgba(0,0,0,.7)"}}>
              {/* Header */}
              <div style={{position:"sticky",top:0,background:C.surface,padding:"18px 22px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:1}}>
                <div>
                  <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>📊 {T2("Event Closure Report")}</div>
                  <div style={{fontSize:12,color:C.gold,marginTop:2}}>{gp(ev.venue).code} · {ev.type} · {ev.date} · {ev.pax} pax</div>
                </div>
                <button onClick={()=>setClosureEv(null)} style={{background:"none",border:"none",fontSize:22,color:C.muted,cursor:"pointer",padding:4}}>✕</button>
              </div>

              <div style={{padding:"18px 22px"}}>
                {/* Summary tiles */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18}}>
                  {[
                    {l:T2("Dishes Ready"),v:readyDishes.length,t:menu.length,c:readyDishes.length===menu.length?C.green:C.amber},
                    {l:T2("Dispatched"),v:dispatchDishes.length,t:menu.length,c:C.blue},
                    {l:T2("Staff Present"),v:allStaffToday.length,t:"",c:C.teal},
                  ].map(s=>(
                    <div key={s.l} style={{background:C.darkCard,borderRadius:12,padding:"12px 10px",textAlign:"center",border:`1px solid ${s.c}20`}}>
                      <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}{s.t?"/"+s.t:""}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:3}}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Event details */}
                <Card style={{marginBottom:12,padding:"14px 16px",background:C.darkCard}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>📋 {T2("Event Details")}</div>
                  {[
                    {l:T2("Venue"),v:ev.venue},
                    {l:T2("Time"),v:ev.time},
                    {l:T2("Total Pax"),v:ev.pax+" pax ("+T2("Veg")+": "+(ev.veg||0)+", "+T2("Non-Veg")+": "+(ev.nonveg||0)+")"},
                    {l:T2("Menu Package"),v:ev.menuPackage||"Custom"},
                    {l:T2("Total Dishes"),v:menu.length+" dishes"},
                  ].map(r=>(
                    <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.borderLight}`,fontSize:12}}>
                      <span style={{color:C.muted}}>{r.l}</span>
                      <span style={{color:C.text,fontWeight:600,textAlign:"right",maxWidth:"60%"}}>{r.v}</span>
                    </div>
                  ))}
                </Card>

                {/* Kitchen status */}
                <Card style={{marginBottom:12,padding:"14px 16px",background:C.darkCard}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>👨‍🍳 {T2("Kitchen Summary")}</div>
                  <div style={{display:"flex",gap:8,marginBottom:8}}>
                    <div style={{flex:1,background:C.greenBg,borderRadius:8,padding:"8px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:C.green}}>{readyDishes.length}</div>
                      <div style={{fontSize:10,color:C.green}}>✅ {T2("Ready")}</div>
                    </div>
                    <div style={{flex:1,background:C.blueBg,borderRadius:8,padding:"8px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:C.blue}}>{dispatchDishes.length}</div>
                      <div style={{fontSize:10,color:C.blue}}>🚛 {T2("Dispatched")}</div>
                    </div>
                    <div style={{flex:1,background:C.redBg,borderRadius:8,padding:"8px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:C.red}}>{notReady.length}</div>
                      <div style={{fontSize:10,color:C.red}}>⏳ {T2("Pending")}</div>
                    </div>
                  </div>
                  {notReady.length>0&&<div style={{fontSize:11,color:C.amber,background:C.amberBg,borderRadius:8,padding:"6px 10px"}}>⚠ {T2("Pending")}: {notReady.slice(0,3).join(", ")}{notReady.length>3?` +${notReady.length-3} more`:""}</div>}
                </Card>

                {/* Staff summary */}
                <Card style={{marginBottom:12,padding:"14px 16px",background:C.darkCard}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>👥 {T2("Staff on Duty")}</div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>{allStaffToday.length} {T2("staff present today")}</div>
                  {allStaffToday.length>0?(
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {allStaffToday.slice(0,8).map((s,i)=>(
                        <span key={i} style={{fontSize:11,padding:"3px 10px",borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,color:C.text}}>{s.name||s.staffName||"Staff"}</span>
                      ))}
                      {allStaffToday.length>8&&<span style={{fontSize:11,color:C.muted}}>+{allStaffToday.length-8} {T2("more")}</span>}
                    </div>
                  ):<div style={{fontSize:11,color:C.muted}}>{T2("Attendance not marked yet")}</div>}
                </Card>

                {/* Special instructions outcome */}
                {ev.special&&(
                  <Card style={{marginBottom:12,padding:"14px 16px",background:C.amberBg,border:`1px solid ${C.amberBorder}`}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:4}}>⚠ {T2("Special Instructions")}</div>
                    <div style={{fontSize:12,color:C.text}}>{ev.special}</div>
                  </Card>
                )}

                {/* Closure remarks */}
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>📝 {T2("Head Chef Remarks")}</div>
                  <textarea value={closureRemark} onChange={e=>setClosureRemark(e.target.value)} placeholder={T2("Overall quality, timing, issues, improvements needed…")} rows={3}
                    style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.bg,resize:"none",boxSizing:"border-box"}}/>
                </div>

                {/* Rating */}
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>⭐ {T2("Overall Rating")}</div>
                  <div style={{display:"flex",gap:8}}>
                    {[{v:"excellent",l:"🌟 "+T2("Excellent")},{v:"good",l:"✅ "+T2("Good")},{v:"average",l:"🟡 "+T2("Average")},{v:"needswork",l:"🔴 "+T2("Needs Work")}].map(r=>(
                      <button key={r.v} onClick={()=>setClosureRating(closureRating===r.v?"":r.v)}
                        style={{flex:1,padding:"10px 6px",borderRadius:10,border:`2px solid ${closureRating===r.v?C.gold:C.border}`,background:closureRating===r.v?C.goldBg:"transparent",color:closureRating===r.v?C.gold:C.muted,fontSize:11,fontWeight:closureRating===r.v?700:400,cursor:"pointer",minHeight:44}}>
                        {r.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>{
                    const report=`EVENT CLOSURE REPORT\n${"=".repeat(40)}\nVenue: ${ev.venue} (${gp(ev.venue).code})\nType: ${ev.type}\nDate: ${ev.date} · Time: ${ev.time}\nPax: ${ev.pax}\nMenu: ${ev.menuPackage||"Custom"}\n\nKITCHEN\nDishes Ready: ${readyDishes.length}/${menu.length}\nDispatched: ${dispatchDishes.length}/${menu.length}\n${notReady.length>0?"Pending: "+notReady.join(", ")+"\n":""}\nSTAFF\nPresent Today: ${allStaffToday.length}\n\nRATING: ${closureRating?.toUpperCase()||"Not rated"}\nREMARKS: ${closureRemark||"None"}\n\nGenerated: ${new Date().toLocaleString("en-IN")}`;
                    const blob=new Blob([report],{type:"text/plain"});
                    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Closure_${gp(ev.venue).code}_${ev.date}.txt`;a.click();
                  }} style={{flex:1,padding:"14px",borderRadius:12,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:48,fontFamily:"var(--font-display)"}}>
                    ⬇ {T2("Download Report")}
                  </button>
                  <button onClick={()=>{setClosureEv(null);setClosureRemark("");setClosureRating("");}}
                    style={{padding:"14px 18px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",minHeight:48}}>✕</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


    </div>
  );
}



// ─── TEAM, ATTENDANCE & DIRECTORY ────────────────────────────────

// ─── KIOSK ATTENDANCE ─────────────────────────────────────────────
function KioskAttendance({ staffList, attendance, setAttendance, onClose, leaves, setLeaves, empDb, setEmpDb, lang="en" }) {
  const T2 = s => T(s, lang);
  const allStaff = safeArr(staffList);
  const todayAtt = safeArr(attendance).filter(a=>a.date===TODAY);

  const [phase, setPhase] = useState("dept");   // dept | select | verify | create_pin | photo | done | leave | outdoor
  const [lockedSection, setLockedSection] = useState(null);
  const [picked, setPicked] = useState(null);
  const [punchAction, setPunchAction] = useState("in"); // "in" or "out"
  const [pinInput, setPinInput] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [photo, setPhoto] = useState(null);
  const [search, setSearch] = useState("");
  const [outdoorForm, setOutdoorForm] = useState({name:"",phone:"",role:"Helper",vendor:""});

  // Leave form
  const [leaveForm, setLeaveForm] = useState({from:"",to:"",reason:"Personal"});

  // Camera refs
  const vRef = useRef(null);
  const cRef = useRef(null);
  const [camReady, setCamReady] = useState(false);
  const [camErr, setCamErr] = useState(false);

  function startCam(){
    setCamErr(false); setCamReady(false);
    navigator.mediaDevices?.getUserMedia({video:{facingMode:"user",width:320,height:240}})
      .then(stream=>{if(vRef.current){vRef.current.srcObject=stream;vRef.current.onloadedmetadata=()=>{vRef.current.play();setCamReady(true);};}})
      .catch(()=>setCamErr(true));
  }
  function stopCam(){try{vRef.current?.srcObject?.getTracks().forEach(t=>t.stop());}catch(e){}}
  function capturePhoto(){
    if(!vRef.current||!cRef.current)return null;
    const c=cRef.current;c.width=320;c.height=240;
    c.getContext("2d").drawImage(vRef.current,0,0,320,240);
    return c.toDataURL("image/jpeg",0.7);
  }

  // Staff for current section
  const sectionStaff = lockedSection ? allStaff.filter(s=>s.section===lockedSection) : allStaff;
  const filteredStaff = search ? sectionStaff.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())) : sectionStaff;
  const presentToday = todayAtt.filter(a=>a.status==="Present");

  function getStaffAtt(staff){ return todayAtt.find(a=>String(a.staffId)===String(staff.id)&&a.status==="Present"); }

  function handlePickStaff(staff){
    const att = getStaffAtt(staff);
    if(att && att.punchOut){
      // Already punched in AND out — show done (shift complete)
      setPicked(staff); setPunchAction("done_shift"); setPhase("done"); return;
    }
    if(att && !att.punchOut){
      // Punched in but NOT out — offer punch out
      setPicked(staff); setPunchAction("out"); setPinInput(""); setPinError(""); setPhase("verify"); return;
    }
    // Not punched in — punch in
    setPicked(staff); setPunchAction("in"); setPinInput(""); setPinError(""); setPhase("verify");
  }

  function verifyPin(){
    if(!picked) return;
    const emp = safeArr(empDb).find(e=>e.name===picked.name || String(e.id)===String(picked.id));
    if(!emp){ setPinError(T2("Employee not found in database")); return; }
    if(String(emp.pin)==="0000" && pinInput.trim()==="0000"){
      // First login — force PIN creation
      setNewPin(""); setConfirmPin(""); setPinError("");
      setPhase("create_pin");
      return;
    }
    if(String(emp.pin)!==pinInput.trim()){ setPinError(T2("Wrong PIN. Try again.")); return; }
    // PIN verified — go to photo
    setPhase("photo");
    setTimeout(startCam, 300);
  }

  function saveNewPin(){
    if(newPin.length<4){ setPinError(T2("PIN must be 4 digits")); return; }
    if(newPin!==confirmPin){ setPinError(T2("PINs do not match")); return; }
    if(newPin==="0000"){ setPinError(T2("Cannot use 0000. Choose a unique PIN.")); return; }
    // Update PIN in empDb
    if(setEmpDb) setEmpDb(prev=>safeArr(prev).map(e=>(e.name===picked.name||String(e.id)===String(picked.id))?{...e,pin:newPin}:e));
    setPinError("");
    setPhase("photo");
    setTimeout(startCam, 300);
  }

  function confirmAttendance(){
    const snap = capturePhoto();
    stopCam();
    setPhoto(snap);
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});

    if(punchAction==="out"){
      // Punch OUT — update existing record (match by staffId OR staffName for outdoor)
      setAttendance(prev=>safeArr(prev).map(a=>
        (String(a.staffId)===String(picked.id)||a.staffName===picked.name)&&a.date===TODAY&&a.status==="Present"&&!a.punchOut
          ? {...a, punchOut:timeStr, punchOutPhoto:snap}
          : a
      ));
    } else {
      // Punch IN — create new record
      const isOutdoor = picked.section==="Outdoor Staff";
      const rec = {
        staffId: String(picked.id), staffName: picked.name, staffSection: picked.section,
        date: TODAY, time: timeStr, status: "Present", photo: snap,
        pinVerified: !isOutdoor, isOutdoor,
        role: picked.role||"", phone: picked.phone||"", vendor: picked.vendor||"",
        punchOut: null, punchOutPhoto: null
      };
      setAttendance(prev=>[...safeArr(prev), rec]);
    }
    setPhase("done");
  }

  function submitLeave(){
    if(!picked||!leaveForm.from||!leaveForm.to) return;
    const newLeave = {
      id: Date.now(), staffId: String(picked.id), staffName: picked.name, staffSection: picked.section,
      from: leaveForm.from, to: leaveForm.to, reason: leaveForm.reason, status: "Pending"
    };
    if(setLeaves) setLeaves(prev=>[...safeArr(prev), newLeave]);
    setLeaveForm({from:"",to:"",reason:"Personal"});
    setPhase("done");
  }

  function reset(){ setPicked(null);setPunchAction("in");setPinInput("");setPinError("");setPhoto(null);setSearch("");setOutdoorForm({name:"",phone:"",role:"Helper",vendor:""});stopCam();setPhase(lockedSection?"select":"dept"); }

  // Auto-reset after done — handled by <AutoReset/> inside the "done" phase JSX

  const bg = {minHeight:"100vh",background:"#0A0A0F",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",color:"#F0ECE0"};
  const cardStyle = {background:"#161514",borderRadius:20,border:`1px solid #2A2824`,padding:"28px 32px",maxWidth:600,width:"100%",boxShadow:"0 8px 40px rgba(0,0,0,.5)"};
  const inputStyle = {width:"100%",padding:"14px 16px",borderRadius:12,border:`1px solid #2A2824`,fontSize:14,color:"#F0ECE0",background:"#1A1918",boxSizing:"border-box",minHeight:48};
  const goldBtn = {padding:"14px 28px",borderRadius:12,background:`linear-gradient(135deg,#C4A44A,#8B6914)`,color:"#0A0A0F",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:52,width:"100%"};

  return (
    <div style={bg}>
      {/* Close button */}
      <button onClick={()=>{stopCam();onClose();}} style={{position:"absolute",top:20,right:24,background:"rgba(255,255,255,.06)",border:"1px solid #2A2824",borderRadius:10,color:"#8A8476",fontSize:13,padding:"10px 18px",cursor:"pointer",minHeight:44}}>✕ {T2("Close")}</button>

      {/* ═══ PHASE: DEPT SELECTOR ═══ */}
      {phase==="dept"&&(
        <div style={{textAlign:"center",maxWidth:800,width:"100%"}}>
          <div style={{fontSize:14,color:"#8A8476",marginBottom:4}}>Ambria Cuisines</div>
          <div style={{fontSize:28,fontWeight:700,fontFamily:"var(--font-display)",marginBottom:6,color:"#C4A44A"}}>{T2("Property Gate Attendance")}</div>
          <div style={{fontSize:13,color:"#5A5750",marginBottom:28}}>{T2("Select department to mark attendance")}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {ALL_DEPARTMENTS.filter(d=>d!=="Management").map(sec=>{
              const meta = SECTION_META[sec]||{icon:"🍽️",color:"#C4A44A"};
              const secStaff2 = allStaff.filter(s=>s.section===sec);
              const secPres = todayAtt.filter(a=>a.status==="Present"&&a.staffSection===sec).length;
              return (
                <button key={sec} onClick={()=>{if(sec==="Outdoor Staff"){setLockedSection(sec);setPhase("outdoor");}else{setLockedSection(sec);setPhase("select");}}}
                  style={{background:"#1A1918",border:`1.5px solid ${meta.color}40`,borderRadius:16,padding:"18px 12px",cursor:"pointer",textAlign:"center",minHeight:100}}>
                  <div style={{fontSize:28,marginBottom:6}}>{meta.icon}</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#F0ECE0"}}>{T2(sec)}</div>
                  <div style={{fontSize:10,color:"#5A5750",marginTop:4}}>{secStaff2.length} {T2("staff")} · {secPres} ✓</div>
                  <div style={{height:3,width:"70%",margin:"6px auto 0",background:"#2A2824",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${safePct(secPres,secStaff2.length)}%`,background:meta.color,borderRadius:2}}/>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ PHASE: SELECT STAFF ═══ */}
      {phase==="select"&&(
        <div style={cardStyle}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div>
              <div style={{fontSize:18,fontWeight:700,color:"#C4A44A",fontFamily:"var(--font-display)"}}>{T2(lockedSection||"All Staff")}</div>
              <div style={{fontSize:11,color:"#5A5750"}}>{T2("Tap your name to check in")}</div>
            </div>
            <button onClick={()=>{setLockedSection(null);setPhase("dept");}} style={{background:"#1A1918",border:"1px solid #2A2824",borderRadius:8,color:"#8A8476",fontSize:11,padding:"8px 14px",cursor:"pointer",minHeight:44}}>{T2("Change Dept")}</button>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={T2("Search your name…")} style={{...inputStyle,marginBottom:14}}/>
          <div style={{maxHeight:400,overflowY:"auto"}}>
            {filteredStaff.map(s=>{
              const att = todayAtt.find(a=>String(a.staffId)===String(s.id)&&a.status==="Present");
              const punchedIn = !!att;
              const punchedOut = att?.punchOut;
              const shiftDone = punchedIn && punchedOut;
              return (
                <button key={s.id} onClick={()=>handlePickStaff(s)} disabled={shiftDone}
                  style={{display:"flex",gap:12,alignItems:"center",width:"100%",padding:"12px 14px",
                    background:shiftDone?"#181716":punchedIn?"#12201A":"#181716",
                    border:`1px solid ${shiftDone?"#272420":punchedIn?C.greenBorder:"#272420"}`,
                    borderRadius:12,marginBottom:4,cursor:shiftDone?"default":"pointer",textAlign:"left",minHeight:52,opacity:shiftDone?.4:1}}>
                  <div style={{width:36,height:36,borderRadius:8,background:shiftDone?"#272420":punchedIn?C.green+"20":"#272420",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:shiftDone?C.muted:punchedIn?C.green:"#8A8476"}}>
                    {shiftDone?"🏁":punchedIn?"✓":"👤"}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:shiftDone?C.muted:punchedIn?C.green:C.text}}>{s.name}</div>
                    <div style={{fontSize:11,color:"#5A5750"}}>{T2(s.role)} · {T2(s.shift)}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    {shiftDone&&<div>
                      <div style={{fontSize:10,color:C.muted}}>🏁 {T2("Shift Done")}</div>
                      <div style={{fontSize:10,color:C.muted}}>{att.time} → {att.punchOut}</div>
                    </div>}
                    {punchedIn&&!punchedOut&&<div>
                      <div style={{fontSize:10,color:C.green}}>✅ {T2("Punched In")} {att.time}</div>
                      <div style={{fontSize:10,color:"#D06040",fontWeight:600,marginTop:2}}>👋 {T2("Tap to Punch Out")}</div>
                    </div>}
                    {!punchedIn&&<div style={{fontSize:10,color:"#5A5750"}}>{T2("Tap to Punch In")}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ PHASE: OUTDOOR / DAILY WAGES STAFF ═══ */}
      {phase==="outdoor"&&(
        <div style={cardStyle}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:36,marginBottom:8}}>👷</div>
            <div style={{fontSize:20,fontWeight:700,color:"#E8A040",fontFamily:"var(--font-display)"}}>{T2("Outdoor / Daily Wages Staff")}</div>
            <div style={{fontSize:12,color:"#5A5750",marginTop:4}}>{T2("Enter details for attendance")}</div>
          </div>

          {/* Show already registered outdoor staff for today - for punch out */}
          {(()=>{
            const outdoorAtt = todayAtt.filter(a=>a.staffSection==="Outdoor Staff"&&a.status==="Present");
            if(outdoorAtt.length===0) return null;
            return(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"#E8A040",marginBottom:8}}>{T2("Already Checked In")} ({outdoorAtt.length})</div>
                <div style={{maxHeight:200,overflowY:"auto"}}>
                  {outdoorAtt.map((att,i)=>{
                    const done=!!att.punchOut;
                    return(
                      <div key={i} onClick={()=>{
                        if(done) return;
                        setPicked({id:"OUT_"+att.staffName,name:att.staffName,section:"Outdoor Staff",role:att.role||"Helper"});
                        setPunchAction("out");
                        setPhase("photo");setTimeout(startCam,300);
                      }} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",borderRadius:10,marginBottom:4,cursor:done?"default":"pointer",
                        background:done?"#181716":"#1E1810",border:`1px solid ${done?C.border:"#E8A04040"}`,opacity:done?.5:1}}>
                        {att.photo?<img src={att.photo} style={{width:36,height:36,borderRadius:8,objectFit:"cover"}}/>
                          :<div style={{width:36,height:36,borderRadius:8,background:"#E8A04020",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👷</div>}
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{att.staffName}</div>
                          <div style={{fontSize:11,color:"#5A5750"}}>{att.role||"Helper"} {att.vendor?`· ${att.vendor}`:""}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          {done?<div style={{fontSize:10,color:C.muted}}>🏁 {att.time}→{att.punchOut}</div>
                            :<div><div style={{fontSize:10,color:"#4DAA6A"}}>✅ {att.time}</div><div style={{fontSize:10,color:"#D06040",fontWeight:600}}>👋 {T2("Tap to Punch Out")}</div></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{height:1,background:C.border,margin:"12px 0"}}/>
              </div>
            );
          })()}

          {/* New outdoor staff form */}
          <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>{T2("New Staff Entry")}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <div style={{fontSize:11,color:"#5A5750",marginBottom:3}}>{T2("Full Name")} *</div>
              <input value={outdoorForm.name} onChange={e=>setOutdoorForm(p=>({...p,name:e.target.value}))} placeholder={T2("Enter full name")}
                style={{...inputStyle,fontSize:14}}/>
            </div>
            <div>
              <div style={{fontSize:11,color:"#5A5750",marginBottom:3}}>{T2("Phone")}</div>
              <input value={outdoorForm.phone} onChange={e=>setOutdoorForm(p=>({...p,phone:e.target.value}))} placeholder="98100-XXXXX"
                style={inputStyle}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div>
              <div style={{fontSize:11,color:"#5A5750",marginBottom:3}}>{T2("Role")}</div>
              <select value={outdoorForm.role} onChange={e=>setOutdoorForm(p=>({...p,role:e.target.value}))}
                style={{...inputStyle,appearance:"auto"}}>
                {["Helper","Cook","Tandoor","Service Staff","Cleaner","Loader","Driver","Electrician","Plumber","Decorator","Other"].map(r=>
                  <option key={r} value={r}>{T2(r)}</option>
                )}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,color:"#5A5750",marginBottom:3}}>{T2("Vendor / Agency")}</div>
              <input value={outdoorForm.vendor} onChange={e=>setOutdoorForm(p=>({...p,vendor:e.target.value}))} placeholder={T2("Optional")}
                style={inputStyle}/>
            </div>
          </div>
          <button onClick={()=>{
            if(!outdoorForm.name.trim()) return;
            setPicked({id:"OUT_"+Date.now(),name:outdoorForm.name.trim(),section:"Outdoor Staff",role:outdoorForm.role,phone:outdoorForm.phone,vendor:outdoorForm.vendor});
            setPunchAction("in");
            setPhase("photo");setTimeout(startCam,300);
          }} disabled={!outdoorForm.name.trim()}
            style={{...goldBtn,background:"linear-gradient(135deg,#E8A040,#8B6014)",opacity:outdoorForm.name.trim()?1:.4,cursor:outdoorForm.name.trim()?"pointer":"not-allowed"}}>
            📸 {T2("Continue to Photo")} →
          </button>
          <button onClick={reset} style={{width:"100%",padding:"12px",borderRadius:10,background:"transparent",border:`1px solid ${C.border}`,color:"#8A8476",fontSize:12,cursor:"pointer",marginTop:8,minHeight:44}}>{T2("Back")}</button>
        </div>
      )}

      {/* ═══ PHASE: VERIFY PIN ═══ */}
      {phase==="verify"&&picked&&(
        <div style={cardStyle}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:36,marginBottom:8}}>{punchAction==="out"?"👋":"🔐"}</div>
            <div style={{fontSize:18,fontWeight:700,color:C.text}}>{picked.name}</div>
            <div style={{fontSize:12,color:"#5A5750"}}>{T2(picked.section)} · {picked.role}</div>
            {punchAction==="out"&&(()=>{
              const att=getStaffAtt(picked);
              return att?<div style={{marginTop:8,padding:"6px 14px",borderRadius:10,background:C.greenBg,border:`1px solid ${C.greenBorder}`,display:"inline-block"}}>
                <span style={{fontSize:12,color:C.green}}>✅ {T2("Punched In at")} {att.time}</span>
              </div>:null;
            })()}
          </div>
          <div style={{fontSize:13,fontWeight:600,color:punchAction==="out"?"#D06040":C.gold,marginBottom:8,textAlign:"center"}}>
            {punchAction==="out"?T2("Enter PIN to Punch Out"):T2("Enter your unique PIN to verify identity")}
          </div>
          <input type="password" value={pinInput} onChange={e=>setPinInput(e.target.value.replace(/\D/g,"").slice(0,4))}
            onKeyDown={e=>e.key==="Enter"&&verifyPin()} placeholder="• • • •" autoFocus maxLength={4}
            style={{...inputStyle,textAlign:"center",fontSize:28,letterSpacing:16,marginBottom:12}}/>
          {pinError&&<div style={{background:"#201212",border:"1px solid #3A1E1E",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#D64545",marginBottom:12,textAlign:"center"}}>{pinError}</div>}
          <button onClick={verifyPin} disabled={pinInput.length<4} style={{...goldBtn,opacity:pinInput.length<4?.4:1,cursor:pinInput.length<4?"not-allowed":"pointer",background:punchAction==="out"?"linear-gradient(135deg,#D06040,#8B3020)":"linear-gradient(135deg,#D4B44A,#8B6914)"}}>
            {punchAction==="out"?`👋 ${T2("Verify & Punch Out")}`:`${T2("Verify & Continue")} →`}
          </button>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            {punchAction==="in"&&<button onClick={()=>{setPhase("leave");}} style={{flex:1,padding:"12px",borderRadius:10,background:"#181716",border:"1px solid #272420",color:"#D4A843",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>📋 {T2("Apply for Leave")}</button>}
            <button onClick={reset} style={{flex:1,padding:"12px",borderRadius:10,background:"#181716",border:"1px solid #272420",color:"#8A8476",fontSize:12,cursor:"pointer",minHeight:44}}>{T2("Cancel")}</button>
          </div>
        </div>
      )}

      {/* ═══ PHASE: PHOTO CAPTURE ═══ */}
      {phase==="photo"&&picked&&(
        <div style={cardStyle}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:punchAction==="out"?"#D06040":C.green}}>
              {punchAction==="out"?`👋 ${T2("Punch Out")} — ${picked.name}`:`✅ ${T2("PIN Verified")} — ${picked.name}`}
            </div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,marginTop:6}}>
              {punchAction==="out"?T2("Photo for punch-out verification"):T2("Look at the camera for attendance photo")}
            </div>
          </div>
          <div style={{position:"relative",width:280,height:210,margin:"0 auto 16px",borderRadius:16,overflow:"hidden",background:"#0A0A0F",border:"3px solid #C4A44A"}}>
            <video ref={vRef} style={{width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)"}} playsInline muted/>
            <canvas ref={cRef} style={{display:"none"}}/>
            {!camReady&&!camErr&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#C4A44A",fontSize:13}}>{T2("Starting camera…")}</div>}
            {camErr&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#D64545",fontSize:12,textAlign:"center",padding:20}}>{T2("Camera not available. Tap below to mark without photo.")}</div>}
            {/* Face guide overlay */}
            {camReady&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
              <div style={{width:140,height:180,border:"2px dashed rgba(196,164,74,.4)",borderRadius:"50%"}}/>
            </div>}
          </div>
          <button onClick={confirmAttendance} style={goldBtn}>
            {punchAction==="out"
              ?`👋 ${camReady?T2("Capture & Punch Out"):T2("Punch Out")}`
              :`📸 ${camReady?T2("Capture & Mark Attendance"):T2("Mark Attendance")}`}
          </button>
          <button onClick={()=>{stopCam();reset();}} style={{width:"100%",padding:"10px",borderRadius:10,background:"transparent",border:"1px solid #2A2824",color:"#8A8476",fontSize:12,cursor:"pointer",marginTop:8,minHeight:40}}>{T2("Cancel")}</button>
        </div>
      )}

      {/* ═══ PHASE: DONE ═══ */}
      {phase==="done"&&picked&&(
        <div style={cardStyle}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>{punchAction==="out"?"👋":punchAction==="done_shift"?"🏁":"✅"}</div>
            <div style={{fontSize:22,fontWeight:700,color:punchAction==="out"?"#D06040":C.green,fontFamily:"var(--font-display)"}}>
              {punchAction==="out"?T2("Punch Out Recorded"):punchAction==="done_shift"?T2("Shift Complete"):T2("Punch In Recorded")}
            </div>
            <div style={{fontSize:16,color:C.text,marginTop:8,fontWeight:600}}>{picked.name}</div>
            <div style={{fontSize:12,color:"#5A5750",marginTop:4}}>{T2(picked.section)}</div>
            {/* Show punch-in and punch-out times */}
            {(()=>{
              const att=getStaffAtt(picked);
              return (
                <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:14}}>
                  {att&&<div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"10px 16px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:C.green}}>{T2("Punch In")}</div>
                    <div style={{fontSize:16,fontWeight:700,color:C.green}}>{att.time}</div>
                  </div>}
                  {(punchAction==="out"||att?.punchOut)&&<div style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:10,padding:"10px 16px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:"#D06040"}}>{T2("Punch Out")}</div>
                    <div style={{fontSize:16,fontWeight:700,color:"#D06040"}}>{att?.punchOut||new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
                  </div>}
                  {punchAction==="done_shift"&&att&&att.punchOut&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 16px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:C.muted}}>{T2("Total Hours")}</div>
                    <div style={{fontSize:16,fontWeight:700,color:C.text}}>{(()=>{
                      try{const [h1,m1]=att.time.split(":").map(Number);const [h2,m2]=(att.punchOut||"").split(":").map(Number);const diff=((h2*60+m2)-(h1*60+m1));return Math.floor(diff/60)+"h "+String(diff%60).padStart(2,"0")+"m";}catch(e){return"—";}
                    })()}</div>
                  </div>}
                </div>
              );
            })()}
            {photo&&<img src={photo} style={{width:120,height:90,borderRadius:12,objectFit:"cover",marginTop:14,border:`2px solid ${punchAction==="out"?"#D06040":C.green}`}}/>}
            <AutoReset delay={4000} onReset={reset}/>
          </div>
        </div>
      )}

      {/* ═══ PHASE: CREATE PIN (first login) ═══ */}
      {phase==="create_pin"&&picked&&(
        <div style={cardStyle}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:36,marginBottom:8}}>🔑</div>
            <div style={{fontSize:18,fontWeight:700,color:C.gold}}>{T2("Create Your PIN")}</div>
            <div style={{fontSize:12,color:"#5A5750",marginTop:4}}>{picked.name} — {T2("First time login")}</div>
            <div style={{fontSize:11,color:"#8A8476",marginTop:8}}>{T2("Create a unique 4-digit PIN that only you know")}</div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,color:"#8A8476",marginBottom:4,fontWeight:600}}>{T2("New PIN")} *</div>
            <input type="password" value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,"").slice(0,4))}
              placeholder="• • • •" autoFocus maxLength={4}
              style={{...inputStyle,textAlign:"center",fontSize:28,letterSpacing:16}}/>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,color:"#8A8476",marginBottom:4,fontWeight:600}}>{T2("Confirm PIN")} *</div>
            <input type="password" value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\D/g,"").slice(0,4))}
              onKeyDown={e=>e.key==="Enter"&&saveNewPin()} placeholder="• • • •" maxLength={4}
              style={{...inputStyle,textAlign:"center",fontSize:28,letterSpacing:16}}/>
          </div>
          {pinError&&<div style={{background:"#201212",border:"1px solid #3A1E1E",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#D64545",marginBottom:12,textAlign:"center"}}>{pinError}</div>}
          <button onClick={saveNewPin} disabled={newPin.length<4||confirmPin.length<4}
            style={{...goldBtn,opacity:(newPin.length<4||confirmPin.length<4)?.4:1,cursor:(newPin.length<4||confirmPin.length<4)?"not-allowed":"pointer"}}>
            🔑 {T2("Save PIN & Continue")}
          </button>
          <button onClick={reset} style={{width:"100%",padding:"10px",borderRadius:10,background:"transparent",border:"1px solid #2A2824",color:"#8A8476",fontSize:12,cursor:"pointer",marginTop:8,minHeight:40}}>{T2("Cancel")}</button>
        </div>
      )}

      {/* ═══ PHASE: LEAVE APPLICATION ═══ */}
      {phase==="leave"&&picked&&(
        <div style={cardStyle}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:32,marginBottom:6}}>📋</div>
            <div style={{fontSize:18,fontWeight:700,color:"#F0ECE0"}}>{T2("Apply for Leave")}</div>
            <div style={{fontSize:12,color:"#5A5750"}}>{picked.name} · {T2(picked.section)}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div>
              <div style={{fontSize:10,color:"#8A8476",marginBottom:4,fontWeight:600}}>{T2("From")} *</div>
              <input type="date" value={leaveForm.from} onChange={e=>setLeaveForm(p=>({...p,from:e.target.value}))} style={inputStyle}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"#8A8476",marginBottom:4,fontWeight:600}}>{T2("To")} *</div>
              <input type="date" value={leaveForm.to} onChange={e=>setLeaveForm(p=>({...p,to:e.target.value}))} style={inputStyle}/>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#8A8476",marginBottom:4,fontWeight:600}}>{T2("Reason")}</div>
            <select value={leaveForm.reason} onChange={e=>setLeaveForm(p=>({...p,reason:e.target.value}))} style={inputStyle}>
              {["Personal","Medical","Family emergency","Casual"].map(r=><option key={r} value={r}>{T2(r)}</option>)}
            </select>
          </div>
          <button onClick={submitLeave} disabled={!leaveForm.from||!leaveForm.to}
            style={{...goldBtn,opacity:(!leaveForm.from||!leaveForm.to)?.4:1,cursor:(!leaveForm.from||!leaveForm.to)?"not-allowed":"pointer"}}>
            📋 {T2("Submit Leave Request")}
          </button>
          <div style={{fontSize:10,color:"#5A5750",textAlign:"center",marginTop:8}}>{T2("Requests go to Yatender for approval.")}</div>
          <button onClick={()=>setPhase("verify")} style={{width:"100%",padding:"10px",borderRadius:10,background:"transparent",border:"1px solid #2A2824",color:"#8A8476",fontSize:12,cursor:"pointer",marginTop:8,minHeight:40}}>← {T2("Back")}</button>
        </div>
      )}

      {/* ── Present today strip ── */}
      {(phase==="dept"||phase==="select")&&presentToday.length>0&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#12201A",borderTop:"1px solid #1E3A28",padding:"10px 24px",display:"flex",gap:12,alignItems:"center",overflowX:"auto"}}>
          <div style={{fontSize:11,color:"#4DAA6A",fontWeight:700,flexShrink:0}}>✅ {presentToday.length} {T2("Present")}:</div>
          {presentToday.slice(0,15).map((a,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              {a.photo?<img src={a.photo} style={{width:24,height:24,borderRadius:8,objectFit:"cover"}}/>
                :<div style={{width:24,height:24,borderRadius:8,background:"#4DAA6A20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#4DAA6A"}}>✓</div>}
              <span style={{fontSize:10,color:"#4DAA6A"}}>{a.staffName}</span>
            </div>
          ))}
          {presentToday.length>15&&<span style={{fontSize:10,color:"#5A5750"}}>+{presentToday.length-15}</span>}
        </div>
      )}
    </div>
  );
}
function AutoReset({delay, onReset}){
  const total = Math.round(delay/1000);
  const [count,setCount] = useState(total);
  useEffect(()=>{
    const t = setInterval(()=>setCount(c=>{ if(c<=1){clearInterval(t);onReset();return 0;} return c-1; }),1000);
    return()=>clearInterval(t);
  },[]);
  const r=28, circ=2*Math.PI*r, pct=count/total;
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginTop:20,gap:6}}>
      <div style={{position:"relative",width:72,height:72}}>
        <svg width={72} height={72} style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)"}}>
          <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={5}/>
          <circle cx={36} cy={36} r={r} fill="none" stroke="#4DAA6A" strokeWidth={5}
            strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} style={{transition:"stroke-dashoffset .9s linear"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,color:"#fff"}}>{count}</div>
      </div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>Returning in {count}s…</div>
    </div>
  );
}

function TeamHub({attendance,setAttendance,leaves,setLeaves,empDb,setEmpDb,events,lang="en",activeDept}) {
  const [tab,setTab]             = useState("attendance");
  const T2 = s => T(s, lang);

  // Department-to-section mapping for filtering
  const DEPT_SECTIONS_MAP = {kitchen:["Indian Curries","Tandoor","Chinese","Chaat","Sweets"],service:["Service"],crockery:["Crockery"],beverages:["Beverages"],transport:["Transportation"],odc:["ODC"]};
  const deptSections = activeDept && DEPT_SECTIONS_MAP[activeDept] ? DEPT_SECTIONS_MAP[activeDept] : null;

  const [secFilter,setSecFilter] = useState("All");
  const [leaveTab,setLeaveTab]   = useState("pending");
  const [leaveForm,setLeaveForm] = useState({staffId:"",from:"",to:"",reason:""});
  const [rejectId,setRejectId]   = useState(null);
  const [rejectReason,setRejectReason] = useState("");
  const [vendorOrders,setVendorOrders] = useState([]);
  const [vendorSubTab,setVendorSubTab] = useState("book");
  const [bookingForm,setBookingForm]   = useState({vendorId:"",vendorName:"",eventId:"",eventName:"",venue:"",date:"",time:"",endTime:"",pax:"",staffReqs:{},notes:""});
  const [editingOrderId,setEditingOrderId] = useState(null); // which order is vendor editing
  const [showAddStaff,setShowAddStaff] = useState(false);
  const [newStaffForm,setNewStaffForm] = useState({name:"",section:"Beverages",role:"staff"});
  const [dirSearch,setDirSearch] = useState("");
  const [dirFilter,setDirFilter] = useState("All");
  const [showAddEmp,setShowAddEmp] = useState(false);
  const [showPins,setShowPins] = useState(false);
  const [selEmp,setSelEmp]       = useState(null);
  const [editEmpForm,setEditEmpForm] = useState(null);
  const [deleteConfirm,setDeleteConfirm] = useState(null);
  const [newEmpForm,setNewEmpForm] = useState({name:"",section:"Indian Curries",dept:"F&B Kitchen",role:"staff",pin:"0000",joining:TODAY,active:true});
  const [exportMonth, setExportMonth] = useState(new Date().getMonth()+1);
  const [exportYear,  setExportYear]  = useState(new Date().getFullYear());

  function exportAttendanceExcel(){
    const staff = safeArr(empDb).filter(s=>s.is_active!==false&&s.active!==false);
    const daysInMonth = new Date(exportYear, exportMonth, 0).getDate();
    const dates = Array.from({length:daysInMonth},(_,i)=>{
      const d=i+1;
      return `${exportYear}-${String(exportMonth).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    });
    const headers = ["Staff ID","Name","Section","Role",...dates.map(d=>new Date(d+"T00:00").getDate()),"Present","Absent","Leave","Half Day","Daily Wages Days","Daily Wages Amt (Rs)"];
    const rows = staff.map(s=>{
      const sId = s.staffListId||s.staff_id||String(s.id||"");
      const dayStatuses = dates.map(date=>{
        const rec = safeArr(attendance).find(a=>(a.staffId===sId||a.staffId===String(s.id)||a.staffName===s.name)&&a.date===date);
        if(!rec) return "";
        if(rec.status==="Present") return "P";
        if(rec.status==="Absent")  return "A";
        if(rec.status==="Leave")   return "L";
        if(rec.status==="Half Day")return "H";
        return rec.status?.charAt(0)||"";
      });
      const present2 = dayStatuses.filter(x=>x==="P").length;
      const absent2  = dayStatuses.filter(x=>x==="A").length;
      const leave2   = dayStatuses.filter(x=>x==="L").length;
      const half2    = dayStatuses.filter(x=>x==="H").length;
      const wages    = safeArr(attendance).filter(a=>(a.staffId===sId||a.staffName===s.name)&&a.is_daily_wages&&dates.includes(a.date));
      const wagesAmt = wages.reduce((sum,a)=>sum+(Number(a.wages_amount)||0),0);
      return [sId,s.name,s.section||"",s.role||"",...dayStatuses,present2,absent2,leave2,half2,wages.length,wagesAmt];
    });
    const csvRows = [headers,...rows].map(row=>row.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(","));
    const csv = "﻿"+csvRows.join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`Ambria_Attendance_${exportYear}_${String(exportMonth).padStart(2,"0")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // Computed — filtered by active department
  const deptStaffList = deptSections ? STAFF_LIST.filter(s=>deptSections.includes(s.section)) : STAFF_LIST;
  const deptEmpDb = deptSections ? safeArr(empDb).filter(e=>deptSections.includes(e.section)) : safeArr(empDb);
  const deptStaffIds = new Set(deptStaffList.map(s=>String(s.id)));
  const todayRecs  = (attendance||[]).filter(a=>a.date===TODAY && (!deptSections || deptStaffIds.has(String(a.staffId))));
  const deptLeaves = deptSections ? safeArr(leaves).filter(l=>deptSections.includes(l.staffSection)) : safeArr(leaves);
  const pending    = deptLeaves.filter(l=>l.status==="Pending");
  const approved   = deptLeaves.filter(l=>l.status==="Approved");
  const rejected   = deptLeaves.filter(l=>l.status==="Rejected");
  const allSecs    = deptSections ? ["All",...deptSections] : ["All",...ALL_DEPARTMENTS];
  const filtered   = secFilter==="All" ? deptStaffList : deptStaffList.filter(s=>s.section===secFilter);
  const present    = todayRecs.filter(a=>a.status==="Present").length;
  const dirFiltered = deptEmpDb.filter(e=>{
    const ms = dirFilter==="All"||e.section===dirFilter||e.role===dirFilter;
    const mt = !dirSearch.trim()||e.name.toLowerCase().includes(dirSearch.toLowerCase())||e.id.toLowerCase().includes(dirSearch.toLowerCase());
    return ms&&mt;
  });

  // Coverage alerts for approved leaves
  const coverageAlerts = approved.reduce((out,l)=>{
    if(!l.staffSection||out.some(x=>x.section===l.staffSection)) return out;
    const total = deptStaffList.filter(s=>s.section===l.staffSection).length;
    const onLeave = approved.filter(x=>x.staffSection===l.staffSection&&x.from<=TODAY&&x.to>=TODAY).length;
    const remaining = total - onLeave;
    const min = 2;
    if(remaining < min) {
      const shortage = min - remaining;
      out.push({section:l.staffSection, remaining, min, shortage,
        vendors: OUTSIDE_VENDORS.filter(v=>v.specialty===l.staffSection).slice(0,3)});
    }
    return out;
  },[]);

  // Leave helpers
  function addLeave(){
    if(!leaveForm.staffId||!leaveForm.from||!leaveForm.to) return;
    const s = deptStaffList.find(x=>x.id===+leaveForm.staffId);
    if(!s) return;
    setLeaves(p=>[...p,{id:Date.now(),staffId:s.id,staffName:s.name,staffSection:s.section,from:leaveForm.from,to:leaveForm.to,reason:leaveForm.reason,status:"Pending"}]);
    setLeaveForm({staffId:"",from:"",to:"",reason:""});
  }
  function approveLeave(id){setLeaves(p=>p.map(l=>l.id!==id?l:{...l,status:"Approved"}));}
  function rejectLeave(id,reason){setLeaves(p=>p.map(l=>l.id!==id?l:{...l,status:"Rejected",rejectReason:reason}));setRejectId(null);setRejectReason("");}

  // Employee helpers
  function addEmployee(){
    if(!newEmpForm.name.trim()) return;
    const newId="AM"+String(Date.now()).slice(-3);
    setEmpDb(p=>[...p,{...newEmpForm,id:newId}]);
    setNewEmpForm({name:"",section:"Indian Curries",dept:"F&B Kitchen",role:"staff",pin:"0000",joining:TODAY,active:true});
    setShowAddEmp(false);
  }
  function saveEmpEdit(){
    if(!editEmpForm) return;
    setEmpDb(p=>p.map(e=>e.id!==selEmp.id?e:{...e,...editEmpForm}));
    setSelEmp(null);setEditEmpForm(null);
  }
  function deleteEmployee(){
    if(!deleteConfirm) return;
    setEmpDb(p=>p.filter(e=>e.id!==deleteConfirm.id));
    setDeleteConfirm(null);
  }

  const TABS = [
    {id:"attendance", l:"✅ Attendance"},
    {id:"leaves",     l:"🌿 Leaves"},
    {id:"chefs",      l:"🤝 Outside Staff & Vendors"},
    {id:"directory",  l:"🪪 Team"},
  ];

  return (
    <div>

      {/* ── STAFF TODAY SUMMARY ── */}
      <Card style={{marginBottom:14,padding:"14px 18px"}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>👥 Staff today — {TODAY_LABEL}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"10px 13px"}}>
            <div style={{fontSize:22,fontWeight:700,color:C.green}}>{present}</div>
            <div style={{fontSize:12,color:C.green,fontWeight:600}}>{T2("Present")}</div>
          </div>
          <div style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:10,padding:"10px 13px"}}>
            <div style={{fontSize:22,fontWeight:700,color:C.red}}>{deptStaffList.length-present}</div>
            <div style={{fontSize:12,color:C.red,fontWeight:600}}>{T2("Absent")}</div>
            {deptStaffList.length-present===0&&<div style={{fontSize:12,color:C.green,marginTop:2}}>All present ✓</div>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,padding:"10px 13px"}}>
            <div style={{fontSize:22,fontWeight:700,color:C.amber}}>{deptLeaves.filter(l=>l.status==="Approved"&&l.from<=TODAY&&l.to>=TODAY).length}</div>
            <div style={{fontSize:12,color:C.amber,fontWeight:600}}>{T2("On Leave")}</div>
            {deptLeaves.filter(l=>l.status==="Approved"&&l.from<=TODAY&&l.to>=TODAY).map((l,i)=><div key={i} style={{fontSize:12,color:C.amber,marginTop:1}}>• {l.staffName}</div>)}
          </div>
          <div style={{background:C.wineBg,border:`1px solid ${C.wineBorder}`,borderRadius:10,padding:"10px 13px"}}>
            <div style={{fontSize:22,fontWeight:700,color:C.gold}}>{pending.length}</div>
            <div style={{fontSize:10,color:C.gold,fontWeight:600}}>{T2("Pending leave")}</div>
            {pending.map((l,i)=><div key={i} style={{fontSize:10,color:C.gold,marginTop:1}}>• {l.staffName}</div>)}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${(deptSections||ALL_DEPARTMENTS.filter(d=>d!=="Management")).length>5?5:Math.max((deptSections||[]).length,3)},1fr)`,gap:10}}>
          {(deptSections||ALL_DEPARTMENTS.filter(d=>d!=="Management")).map(s=>{
            const m=SECTION_META[s]||{color:C.muted,icon:"🍽"};
            const total=deptStaffList.filter(x=>x.section===s).length;
            const pres2=todayRecs.filter(a=>a.status==="Present"&&deptStaffList.find(x=>String(x.id)===String(a.staffId))?.section===s).length;
            const pct=safePct(pres2,total);
            return (
              <div key={s} style={{textAlign:"center",background:C.bg,borderRadius:9,padding:"8px 4px"}}>
                <DonutChart pct={pct} color={m.color} icon={m.icon} size={48}/>
                <div style={{fontSize:10,fontWeight:600,color:C.text,marginTop:4}}>{T2(s).split(" ")[0]}</div>
                <div style={{fontSize:12,color:C.muted}}>{pres2}/{total}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>👥 Team</div>
          <div style={{fontSize:13,color:C.muted,marginTop:3}}>{TODAY_LABEL} · {present}/{deptStaffList.length} present</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{background:C.greenBg,borderRadius:9,padding:"8px 14px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:C.green}}>{present}</div>
            <div style={{fontSize:11,color:C.green}}>{T2("Present")}</div>
          </div>
          <div style={{background:C.redBg,borderRadius:9,padding:"8px 14px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:C.red}}>{todayRecs.filter(a=>a.status==="Absent").length}</div>
            <div style={{fontSize:11,color:C.red}}>{T2("Absent")}</div>
          </div>
          <div style={{background:C.wineBg,borderRadius:9,padding:"8px 14px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:C.gold}}>{pending.length}</div>
            <div style={{fontSize:11,color:C.gold}}>Pending</div>
          </div>
        </div>
      </div>

      {/* Coverage alerts */}
      {coverageAlerts.map((a,i)=>(
        <div key={i} style={{background:C.amberBg,border:`1.5px solid ${C.amberBorder}`,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.amber}}>⚠ Coverage gap — {a.section}</div>
              <div style={{fontSize:11,color:C.amber,marginTop:2}}>{a.remaining} remaining · need {a.shortage} outside chef{a.shortage>1?"s":""}</div>
            </div>
            <STag name={a.section}/>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {a.vendors.map((v,vi)=>(
              <div key={vi} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 11px",flex:"1 0 130px"}}>
                <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:5}}>
                  <Avatar name={v.name} size={26} index={vi+6}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:C.text}}>{v.name}</div>
                    <div style={{fontSize:12,color:C.muted}}>★ {v.rating} · {v.specialty}</div>
                  </div>
                </div>
                <button onClick={()=>setTab("chefs")} style={{width:"100%",padding:"4px",borderRadius:8,fontSize:11,fontWeight:500,cursor:"pointer",background:C.gold,color:"#fff",border:"none"}}>Book via Vendor Tab →</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Tab bar */}
      <div style={{display:"flex",gap:6,marginBottom:16,borderBottom:`1px solid ${C.border}`,paddingBottom:10,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",flexShrink:0,
            background:tab===t.id?C.wine:"transparent",color:tab===t.id?"#fff":C.muted,
            border:`1.5px solid ${tab===t.id?C.wine:C.border}`
          }}>{lang==="hi"&&t.hi?t.hi:t.l}</button>
        ))}
      </div>

      {/* ── ATTENDANCE ── */}
      {tab==="attendance" && (
        <div>
          {/* Export bar — admin/head chef only */}
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,padding:"10px 14px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:C.muted,fontWeight:600,marginRight:4}}>📥 Export:</span>
            <select value={exportMonth} onChange={e=>setExportMonth(+e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,color:C.text,fontSize:12,cursor:"pointer"}}>
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={exportYear} onChange={e=>setExportYear(+e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,color:C.text,fontSize:12,cursor:"pointer"}}>
              {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={exportAttendanceExcel} style={{padding:"7px 16px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:34}}>📥 Export Attendance (.csv)</button>
            <span style={{fontSize:10,color:C.faint,marginLeft:4}}>P=Present · A=Absent · L=Leave · H=Half Day</span>
          </div>

          {/* Section filter */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
            {allSecs.map(s=>(
              <button key={s} onClick={()=>setSecFilter(s)} style={{padding:"4px 11px",borderRadius:20,fontSize:11,cursor:"pointer",background:secFilter===s?C.wine:"transparent",color:secFilter===s?"#fff":C.muted,border:`1px solid ${secFilter===s?C.wine:C.border}`}}>{s}</button>
            ))}
          </div>

          {/* Present staff only */}
          {(()=>{
            const presentStaff = filtered.filter(s=>todayRecs.some(r=>r.staffId===String(s.id)&&r.status==="Present"));
            return presentStaff.length>0?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                {presentStaff.map((s,i)=>{
                  const rec = todayRecs.find(r=>r.staffId===String(s.id)&&r.status==="Present");
                  const m = SECTION_META[s.section]||{color:C.muted};
                  return (
                    <div key={s.id} style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"11px 12px"}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                        {rec?.photo
                          ? <img src={rec.photo} style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",border:`2px solid ${C.green}`}}/>
                          : <Avatar name={s.name} size={32} index={i}/>
                        }
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                          <div style={{fontSize:11,color:m.color,fontWeight:500}}>{T2(s.section)}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:10,fontWeight:600,padding:"5px 10px",borderRadius:10,background:C.green,color:"#0A0A0F"}}>
                          ✓ {rec?.time}
                        </span>
                        {rec?.pinVerified&&<span style={{fontSize:12,color:C.green}}>🔐</span>}
                        {rec?.photo&&<span style={{fontSize:12,color:C.green}}>📸</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ):(
              <div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>
                {T2("No staff checked in yet. Attendance is marked at Property Gate Kiosk.")}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── LEAVES ── */}
      {tab==="leaves" && (
        <div>
          {/* Apply leave form */}
          <Card style={{marginBottom:14,padding:"14px 16px"}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>{T2("Apply Leave")}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>
              <div>
                <div style={{fontSize:12,color:C.muted,marginBottom:3}}>Staff</div>
                <select value={leaveForm.staffId} onChange={e=>setLeaveForm(p=>({...p,staffId:e.target.value}))} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>
                  <option value="">Select staff…</option>
                  {deptStaffList.map(s=><option key={s.id} value={s.id}>{s.name} ({s.section})</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:12,color:C.muted,marginBottom:3}}>From</div>
                <input type="date" value={leaveForm.from} onChange={e=>setLeaveForm(p=>({...p,from:e.target.value}))} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:12,color:C.muted,marginBottom:3}}>To</div>
                <input type="date" value={leaveForm.to} onChange={e=>setLeaveForm(p=>({...p,to:e.target.value}))} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:12,color:C.muted,marginBottom:3}}>Reason</div>
                <input value={leaveForm.reason} onChange={e=>setLeaveForm(p=>({...p,reason:e.target.value}))} placeholder={T2("Reason")} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
              </div>
            </div>
            <Btn onClick={addLeave} color={C.wine} style={{fontSize:12,padding:"6px 16px"}}>{T2("Apply Leave")}</Btn>
          </Card>

          {/* Leave sub-tabs */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {[{v:"pending",l:"Pending",count:pending.length},{v:"approved",l:"Approved",count:approved.length},{v:"rejected",l:"Rejected",count:rejected.length}].map(t=>(
              <button key={t.v} onClick={()=>setLeaveTab(t.v)} style={{padding:"5px 14px",borderRadius:20,fontSize:12,cursor:"pointer",background:leaveTab===t.v?C.wine:"transparent",color:leaveTab===t.v?"#fff":C.muted,border:`1.5px solid ${leaveTab===t.v?C.wine:C.border}`}}>
                {t.l} {t.count>0&&<span style={{fontSize:10,opacity:.8}}>({t.count})</span>}
              </button>
            ))}
          </div>

          {/* Leave list */}
          {(leaveTab==="pending"?pending:leaveTab==="approved"?approved:rejected).map((l,i)=>{
            const idx = deptStaffList.findIndex(s=>s.id===l.staffId||s.name===l.staffName);
            return (
              <div key={l.id} style={{padding:"10px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                <div style={{display:"flex",gap:9,alignItems:"flex-start"}}>
                  <Avatar name={l.staffName||"?"} size={32} index={idx>=0?idx:i}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.text}}>{l.staffName}</div>
                    <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
                      <STag name={l.staffSection||"—"}/>
                      <Chip label={`${l.from} → ${l.to}`} color={C.muted} bg={C.bg} size={10}/>
                    </div>
                    {l.reason&&<div style={{fontSize:10,color:C.faint,marginTop:3}}>{l.reason}</div>}
                    {rejectId===l.id&&(
                      <div style={{marginTop:7,display:"flex",gap:6,alignItems:"center"}}>
                        <input value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Rejection reason…" style={{flex:1,padding:"5px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg}}/>
                        <Btn onClick={()=>rejectLeave(l.id,rejectReason)} color={C.red} style={{fontSize:11,padding:"5px 10px"}}>Confirm</Btn>
                        <Btn onClick={()=>{setRejectId(null);setRejectReason("");}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:11,padding:"5px 10px"}}>Cancel</Btn>
                      </div>
                    )}
                    {rejectId!==l.id&&(
                      <div style={{display:"flex",gap:5,flexShrink:0,marginTop:6}}>
                        {leaveTab==="pending"&&(
                          <>
                            <Btn onClick={()=>approveLeave(l.id)} color={C.green} style={{fontSize:10,padding:"6px 12px"}}>✓ Approve</Btn>
                            <Btn onClick={()=>setRejectId(l.id)} color={C.red} style={{fontSize:10,padding:"6px 12px"}}>✕ Reject</Btn>
                          </>
                        )}
                        {leaveTab==="rejected"&&l.rejectReason&&<div style={{fontSize:12,color:C.red}}>{l.rejectReason}</div>}
                      </div>
                    )}
                  </div>
                  <span style={{fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:20,
                    background:l.status==="Approved"?C.greenBg:l.status==="Rejected"?C.redBg:C.amberBg,
                    color:l.status==="Approved"?C.green:l.status==="Rejected"?C.red:C.amber}}>
                    {l.status}
                  </span>
                </div>
              </div>
            );
          })}
          {(leaveTab==="pending"?pending:leaveTab==="approved"?approved:rejected).length===0&&(
            <div style={{textAlign:"center",padding:24,color:C.muted,fontSize:12}}>No {leaveTab} leaves.</div>
          )}
        </div>
      )}

      {/* ── OUTSIDE STAFF & VENDORS ── */}
      {tab==="chefs" && (
        <div>
          {/* Manager / Vendor toggle */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",gap:6}}>
              {[{v:"book",l:"📋 Book Staff"},{v:"orders",l:"📦 Orders & Attendance"}].map(t=>(
                <button key={t.v} onClick={()=>setVendorSubTab(t.v)} disabled={vendorSubTab==="portal"}
                  style={{padding:"7px 16px",borderRadius:20,fontSize:12,fontWeight:500,cursor:vendorSubTab==="portal"?"not-allowed":"pointer",
                    background:vendorSubTab===t.v?C.wine:"transparent",color:vendorSubTab===t.v?"#fff":vendorSubTab==="portal"?C.faint:C.muted,
                    border:`1.5px solid ${vendorSubTab===t.v?C.wine:C.border}`,opacity:vendorSubTab==="portal"?.5:1}}>{lang==="hi"&&t.hi?t.hi:t.l}</button>
              ))}
            </div>
            {/* Vendor Portal toggle */}
            <button onClick={()=>setVendorSubTab(vendorSubTab==="portal"?"book":"portal")}
              style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",borderRadius:10,cursor:"pointer",transition:"all .2s",
                background:vendorSubTab==="portal"?C.wine:C.wineBg,
                border:`1.5px solid ${C.gold}`,color:vendorSubTab==="portal"?"#fff":C.wine,fontWeight:600,fontSize:12}}>
              <span style={{fontSize:14}}>🏢</span>
              {vendorSubTab==="portal" ? "← Exit Vendor Portal" : "Open Vendor Portal"}
              {vendorSubTab!=="portal" && vendorOrders.filter(o=>o.status==="Pending").length > 0 &&
                <span style={{background:C.gold,color:"#fff",fontSize:12,fontWeight:700,padding:"1px 6px",borderRadius:10,marginLeft:2}}>
                  {vendorOrders.filter(o=>o.status==="Pending").length}
                </span>
              }
            </button>
          </div>
          {/* Vendor Portal banner */}
          {vendorSubTab==="portal" && (
            <div style={{background:`linear-gradient(155deg,#06060A 0%,#12100A 40%,#0A0908 100%)`,borderRadius:12,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:24}}>🏢</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#fff",fontFamily:"var(--font-display)"}}>{T2("Vendor Portal View")}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>You are viewing as a vendor. Accept, edit or reject bookings sent from kitchen management.</div>
              </div>
            </div>
          )}

          {/* BOOK STAFF */}
          {vendorSubTab==="book" && (
            <div>
              {!bookingForm.vendorId ? (
                <div>
                  <div style={{fontSize:13,color:C.muted,marginBottom:14}}>Select a vendor to place a booking request.</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                    {OUTSIDE_VENDORS.map(v=>(
                      <div key={v.id} onClick={()=>setBookingForm(p=>({...p,vendorId:v.id,vendorName:v.name}))} style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"16px",cursor:"pointer"}}>
                        <div style={{width:40,height:40,borderRadius:10,background:C.wineBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,marginBottom:10}}>🏢</div>
                        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>{v.name}</div>
                        <STag name={v.specialty}/>
                        <div style={{fontSize:11,color:C.muted,marginTop:6}}>{v.phone}</div>
                        <div style={{display:"flex",gap:1,marginTop:5}}>
                          {[1,2,3,4,5].map(s=><span key={s} style={{fontSize:11,color:s<=+(v.rating||0)?"#F59E0B":"#D1D5DB"}}>★</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  {/* Vendor selected */}
                  <div style={{background:C.wineBg,border:`1.5px solid ${C.wineBorder}`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <div style={{width:36,height:36,borderRadius:9,background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff"}}>🏢</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:C.gold}}>{bookingForm.vendorName}</div>
                        <div style={{fontSize:11,color:C.gold,opacity:.7}}>Booking will be sent to this vendor</div>
                      </div>
                    </div>
                    <button onClick={()=>setBookingForm(p=>({...p,vendorId:"",vendorName:""}))} style={{fontSize:11,color:C.gold,background:"none",border:`1px solid ${C.wineBorder}`,borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>Change ×</button>
                  </div>

                  {/* Event + logistics */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Event</div>
                      <select value={bookingForm.eventId} onChange={e=>{const ev=(events||[]).find(x=>x.id===e.target.value);setBookingForm(p=>({...p,eventId:e.target.value,eventName:ev?.guest||""}));}} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}>
                        <option value="">Select event…</option>
                        {(events||[]).map(ev=><option key={ev.id} value={ev.id}>{ev.guest} · {ev.date}</option>)}
                        <option value="none">No specific event</option>
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Venue</div>
                      <select value={bookingForm.venue} onChange={e=>setBookingForm(p=>({...p,venue:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}>
                        <option value="">Select…</option>
                        {["Ambria Pushpanjali","Ambria Exotica","Manaktala Farm","Ambria Restro","Outdoor Catering (ODC)"].map(o=><option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Date</div>
                      <input type="date" value={bookingForm.date} onChange={e=>setBookingForm(p=>({...p,date:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Reporting Time</div>
                      <input value={bookingForm.time} onChange={e=>setBookingForm(p=>({...p,time:e.target.value}))} placeholder="e.g. 3:00 PM" style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>End Time</div>
                      <input value={bookingForm.endTime} onChange={e=>setBookingForm(p=>({...p,endTime:e.target.value}))} placeholder="e.g. 11:00 PM" style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Expected Pax</div>
                      <input type="number" value={bookingForm.pax} onChange={e=>setBookingForm(p=>({...p,pax:e.target.value}))} placeholder="e.g. 500" style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                    </div>
                  </div>

                  {/* Section qty table */}
                  <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>Staff Required by Section</div>
                  <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:14}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 110px 1fr",background:C.bg,padding:"8px 14px",borderBottom:`1px solid ${C.border}`}}>
                      {["Section","Qty",T2("Notes")].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>{h}</div>)}
                    </div>
                    {SECTIONS.map(sec=>{
                      const m   = SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                      const qty = bookingForm.staffReqs?.[sec]?.qty||0;
                      const note= bookingForm.staffReqs?.[sec]?.note||"";
                      function setQty(n){setBookingForm(p=>({...p,staffReqs:{...(p.staffReqs||{}),[sec]:{...(p.staffReqs?.[sec]||{}),qty:Math.max(0,n)}}}));}
                      function setNote(n){setBookingForm(p=>({...p,staffReqs:{...(p.staffReqs||{}),[sec]:{...(p.staffReqs?.[sec]||{}),note:n}}}));}
                      return (
                        <div key={sec} style={{display:"grid",gridTemplateColumns:"1fr 110px 1fr",padding:"12px 16px",borderBottom:`1px solid ${C.borderLight}`,alignItems:"center"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:14}}>{m.icon}</span>
                            <span style={{fontSize:12,fontWeight:500,color:C.text}}>{sec}</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
                            <button onClick={()=>setQty(qty-1)} style={{width:26,height:26,borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                            <span style={{fontSize:14,fontWeight:600,color:qty>0?C.wine:C.muted,minWidth:18,textAlign:"center"}}>{qty}</span>
                            <button onClick={()=>setQty(qty+1)} style={{width:26,height:26,borderRadius:8,background:qty>0?C.wineBg:C.bg,border:`1px solid ${qty>0?C.wineBorder:C.border}`,color:qty>0?C.wine:C.text,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                          </div>
                          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Special requirements…" style={{padding:"5px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg,width:"100%",boxSizing:"border-box"}}/>
                        </div>
                      );
                    })}
                    <div style={{padding:"8px 14px",background:C.bg,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:12,color:C.muted}}>Total staff requested</span>
                      <span style={{fontSize:14,fontWeight:700,color:C.gold}}>{Object.values(bookingForm.staffReqs||{}).reduce((a,r)=>a+(r.qty||0),0)} people</span>
                    </div>
                  </div>

                  {/* Notes + send */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Additional Notes for Vendor</div>
                    <textarea value={bookingForm.notes||""} onChange={e=>setBookingForm(p=>({...p,notes:e.target.value}))} placeholder="Dress code, reporting point, special instructions…" style={{width:"100%",padding:"9px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,resize:"none",height:60,fontFamily:"inherit",boxSizing:"border-box"}}/>
                  </div>
                  <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                    <Btn onClick={()=>setBookingForm({vendorId:"",vendorName:"",eventId:"",eventName:"",venue:"",date:"",time:"",endTime:"",pax:"",staffReqs:{},notes:""})} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>{T2("Clear")}</Btn>
                    <Btn onClick={()=>{
                      const total=Object.values(bookingForm.staffReqs||{}).reduce((a,r)=>a+(r.qty||0),0);
                      if(!bookingForm.vendorId||!bookingForm.date||total===0) return;
                      setVendorOrders(p=>[...p,{id:"ORD-"+Date.now(),vendorId:bookingForm.vendorId,vendorName:bookingForm.vendorName,eventId:bookingForm.eventId,eventName:bookingForm.eventName,venue:bookingForm.venue,date:bookingForm.date,time:bookingForm.time,endTime:bookingForm.endTime,pax:bookingForm.pax,staffReqs:bookingForm.staffReqs,notes:bookingForm.notes,status:"Pending",vendorNote:"",confirmedStaff:[]}]);
                      setBookingForm({vendorId:"",vendorName:"",eventId:"",eventName:"",venue:"",date:"",time:"",endTime:"",pax:"",staffReqs:{},notes:""});
                      setVendorSubTab("orders");
                    }} style={{fontSize:12,padding:"9px 22px"}}>📤 Send to Vendor →</Btn>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ORDERS & ATTENDANCE */}
          {vendorSubTab==="orders" && (
            <div>
              {vendorOrders.length===0 ? (
                <div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,fontSize:13,color:C.muted}}>No orders placed yet. Use "Book Staff" to send your first request.</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[...vendorOrders].reverse().map(order=>{
                    const totalReq=Object.values(order.staffReqs||{}).reduce((a,r)=>a+(r.qty||0),0);
                    const scol=order.status==="Confirmed"?C.green:order.status==="Rejected"?C.red:order.status==="Edited"?C.amber:C.muted;
                    const sbg =order.status==="Confirmed"?C.greenBg:order.status==="Rejected"?C.redBg:order.status==="Edited"?C.amberBg:C.bg;
                    return (
                      <Card key={order.id} style={{padding:"14px 18px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                          <div>
                            <div style={{fontSize:14,fontWeight:700,color:C.text}}>{order.vendorName}</div>
                            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{order.date} · {order.time}{order.endTime?" – "+order.endTime:""} · {order.venue||"Venue TBD"}{order.pax?" · "+order.pax+" pax":""}</div>
                            {order.eventName&&<div style={{fontSize:11,color:C.gold,marginTop:1}}>📋 {order.eventName}</div>}
                          </div>
                          <span style={{fontSize:12,fontWeight:700,padding:"4px 11px",borderRadius:20,background:sbg,color:scol}}>{order.status}</span>
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:order.vendorNote?8:0}}>
                          {Object.entries(order.staffReqs||{}).filter(([,r])=>r.qty>0).map(([sec,r])=>{
                            const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                            return <div key={sec} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,background:m.color+"15",border:"1px solid "+m.color+"30"}}><span style={{fontSize:11}}>{m.icon}</span><span style={{fontSize:12,fontWeight:600,color:m.color}}>{r.qty}× {sec}</span></div>;
                          })}
                          <div style={{padding:"6px 12px",borderRadius:20,background:C.bg,border:`1px solid ${C.border}`}}><span style={{fontSize:11,color:C.muted}}>{totalReq} total</span></div>
                        </div>
                        {order.vendorNote&&<div style={{background:C.amberBg,borderRadius:8,padding:"10px 14px",fontSize:11,color:C.amber,marginBottom:8}}>💬 {order.vendorNote}</div>}
                        {order.status==="Edited"&&order.editedReqs&&Object.keys(order.editedReqs).length>0&&(
                          <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:8,padding:"8px 12px",marginBottom:8}}>
                            <div style={{fontSize:10,fontWeight:600,color:C.amber,marginBottom:6}}>✏ VENDOR'S REVISED PROPOSAL — Awaiting your acceptance</div>
                            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                              {Object.entries(order.editedReqs).filter(([,r])=>(r.qty||0)>0).map(([sec,r])=>{
                                const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                                const orig=order.staffReqs?.[sec]?.qty||0;
                                return <div key={sec} style={{display:"flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:20,background:m.color+"15",border:"1px solid "+m.color+"30"}}>
                                  <span style={{fontSize:10}}>{m.icon}</span>
                                  <span style={{fontSize:10,fontWeight:600,color:m.color}}>{r.qty}× {sec}</span>
                                  {r.qty!==orig&&<span style={{fontSize:11,color:C.amber}}>(was {orig})</span>}
                                </div>;
                              })}
                            </div>
                            <div style={{display:"flex",gap:6,marginTop:8}}>
                              <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Confirmed",staffReqs:{...(o.staffReqs||{}),...Object.fromEntries(Object.entries(o.editedReqs||{}).map(([k,v])=>[k,{...(o.staffReqs?.[k]||{}),qty:v.qty}]))},confirmedStaff:o.confirmedStaff||[]}))}
                                style={{padding:"5px 14px",borderRadius:7,background:C.green,color:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>✓ Accept Revised</button>
                              <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Rejected"}))}
                                style={{padding:"5px 12px",borderRadius:7,background:C.redBg,color:C.red,border:`1px solid ${C.redBorder}`,fontSize:11,cursor:"pointer"}}>✕ Reject</button>
                            </div>
                          </div>
                        )}
                        {order.status==="Confirmed"&&(order.confirmedStaff||[]).length>0&&(
                          <div style={{marginTop:10,borderTop:`1px solid ${C.borderLight}`,paddingTop:10}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>Staff sent by vendor</div>
                            {order.confirmedStaff.map((staff,si)=>(
                              <div key={si} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                  <Avatar name={staff.name} size={26} index={si+5}/>
                                  <div>
                                    <div style={{fontSize:12,fontWeight:500,color:C.text}}>{staff.name}</div>
                                    <STag name={staff.section||"—"}/>
                                  </div>
                                </div>
                                {staff.checkIn
                                  ? <Chip label={"✓ "+staff.checkIn} color={C.green} bg={C.greenBg} size={10}/>
                                  : <input type="time" onChange={e=>{if(e.target.value){setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:o.confirmedStaff.map((st,i)=>i!==si?st:{...st,checkIn:e.target.value})}));}}} style={{padding:"4px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}/>
                                }
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VENDOR PORTAL */}
          {vendorSubTab==="portal" && (
            <div>
              <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:11,color:C.amber,lineHeight:1.6}}>
                ℹ <strong>{T2("Vendor Portal")}</strong> — this is the view vendors use to accept/reject/edit booking orders placed by kitchen management.
              </div>
              {vendorOrders.length===0 ? (
                <div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,fontSize:13,color:C.muted}}>No orders from kitchen yet.</div>
              ) : (
                <div>
                  {Object.entries(vendorOrders.reduce((acc,o)=>{
                    if(!acc[o.vendorId]) acc[o.vendorId]={name:o.vendorName,orders:[]};
                    acc[o.vendorId].orders.push(o);
                    return acc;
                  },{})).map(([vid,grp])=>(
                    <div key={vid} style={{marginBottom:20}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"12px 16px",background:C.wineBg,borderRadius:10,border:`1px solid ${C.wineBorder}`}}>
                        <div style={{width:36,height:36,borderRadius:9,background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff"}}>🏢</div>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:C.gold}}>{grp.name}</div>
                          <div style={{fontSize:11,color:C.gold,opacity:.7}}>{grp.orders.length} order{grp.orders.length!==1?"s":""} · {grp.orders.filter(o=>o.status==="Pending").length} pending</div>
                        </div>
                      </div>
                      {grp.orders.map(order=>{
                        const totalReq=Object.values(order.staffReqs||{}).reduce((a,r)=>a+(r.qty||0),0);
                        const scol=order.status==="Confirmed"?C.green:order.status==="Rejected"?C.red:order.status==="Edited"?C.amber:C.muted;
                        const sbg =order.status==="Confirmed"?C.greenBg:order.status==="Rejected"?C.redBg:order.status==="Edited"?C.amberBg:C.bg;
                        return (
                          <Card key={order.id} style={{marginBottom:10,marginLeft:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                              <div>
                                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{order.date} · {order.time}{order.endTime?" – "+order.endTime:""}</div>
                                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{order.venue||"Venue TBD"}{order.pax?" · "+order.pax+" pax":""}{order.eventName?" · "+order.eventName:""}</div>
                                <div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap"}}>
                                  {Object.entries(order.staffReqs||{}).filter(([,r])=>r.qty>0).map(([sec,r])=>{
                                    const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                                    return <div key={sec} style={{display:"flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:20,background:m.color+"15",border:"1px solid "+m.color+"30"}}><span style={{fontSize:10}}>{m.icon}</span><span style={{fontSize:10,fontWeight:600,color:m.color}}>{r.qty}× {sec}</span></div>;
                                  })}
                                  <span style={{fontSize:11,color:C.muted,padding:"6px 12px",background:C.bg,borderRadius:20,border:`1px solid ${C.border}`}}>{totalReq} total</span>
                                </div>
                                {order.notes&&<div style={{fontSize:11,color:C.muted,marginTop:5}}>📝 {order.notes}</div>}
                              </div>
                              <span style={{fontSize:12,fontWeight:700,padding:"4px 11px",borderRadius:20,background:sbg,color:scol}}>{order.status}</span>
                            </div>
                            <textarea value={order.vendorNote||""} onChange={e=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,vendorNote:e.target.value}))} placeholder="Add note for kitchen (e.g. sending 2 instead of 3 for Tandoor, different timing)…" style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,resize:"none",height:50,fontFamily:"inherit",boxSizing:"border-box",marginBottom:10}}/>
                            {order.status==="Confirmed" && (
                              <div style={{marginBottom:10}}>
                                <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:6}}>Staff being sent</div>
                                {(order.confirmedStaff||[]).map((st,si)=>(
                                  <div key={si} style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
                                    <input value={st.name||""} onChange={e=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:o.confirmedStaff.map((s2,i)=>i!==si?s2:{...s2,name:e.target.value})}))} placeholder="Chef name" style={{flex:1,padding:"5px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg}}/>
                                    <select value={st.section||""} onChange={e=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:o.confirmedStaff.map((s2,i)=>i!==si?s2:{...s2,section:e.target.value})}))} style={{padding:"5px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg}}>
                                      <option value="">Section</option>
                                      {SECTIONS.map(s=><option key={s}>{s}</option>)}
                                    </select>
                                    <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:o.confirmedStaff.filter((_,i)=>i!==si)}))} style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:8,color:C.red,fontSize:11,padding:"4px 7px",cursor:"pointer"}}>×</button>
                                  </div>
                                ))}
                                <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:[...(o.confirmedStaff||[]),{name:"",section:""}]}))} style={{padding:"5px 12px",borderRadius:8,background:"none",border:`1px dashed ${C.border}`,fontSize:11,color:C.muted,cursor:"pointer"}}>+ Add staff member</button>
                              </div>
                            )}
                            {/* Vendor edits section - qty editing + reason */}
                            {editingOrderId===order.id && (
                              <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                                <div style={{fontSize:12,fontWeight:600,color:C.amber,marginBottom:10}}>✏ Edit Staff Requirements — send revised proposal to kitchen</div>
                                <div style={{border:`1px solid ${C.amberBorder}`,borderRadius:8,overflow:"hidden",marginBottom:8}}>
                                  <div style={{display:"grid",gridTemplateColumns:"1fr 110px",background:"rgba(192,112,16,.1)",padding:"6px 12px",borderBottom:`1px solid ${C.amberBorder}`}}>
                                    <span style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase"}}>Section</span>
                                    <span style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",textAlign:"center"}}>Vendor Can Send</span>
                                  </div>
                                  {SECTIONS.map(sec=>{
                                    const orig = order.staffReqs?.[sec]?.qty||0;
                                    const edited = (order.editedReqs?.[sec]?.qty !== undefined) ? order.editedReqs[sec].qty : orig;
                                    const m = SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                                    if(orig===0 && edited===0) return null;
                                    return (
                                      <div key={sec} style={{display:"grid",gridTemplateColumns:"1fr 110px",padding:"8px 12px",borderBottom:`1px solid ${C.amberBorder}`,alignItems:"center"}}>
                                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                                          <span style={{fontSize:13}}>{m.icon}</span>
                                          <div>
                                            <div style={{fontSize:12,color:C.text}}>{sec}</div>
                                            <div style={{fontSize:12,color:C.muted}}>Kitchen asked: {orig}</div>
                                          </div>
                                        </div>
                                        <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
                                          <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,editedReqs:{...(o.editedReqs||{}),[sec]:{qty:Math.max(0,(o.editedReqs?.[sec]?.qty!==undefined?o.editedReqs[sec].qty:orig)-1)}}}))}                                            style={{width:26,height:26,borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:14,cursor:"pointer",fontWeight:700}}>−</button>
                                          <span style={{fontSize:14,fontWeight:700,color:edited!==orig?C.amber:C.text,minWidth:20,textAlign:"center"}}>{edited}</span>
                                          <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,editedReqs:{...(o.editedReqs||{}),[sec]:{qty:(o.editedReqs?.[sec]?.qty!==undefined?o.editedReqs[sec].qty:orig)+1}}}))}
                                            style={{width:26,height:26,borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:14,cursor:"pointer",fontWeight:700}}>+</button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                                  <button onClick={()=>setEditingOrderId(null)} style={{padding:"7px 14px",borderRadius:8,fontSize:11,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted}}>Cancel</button>
                                  <button onClick={()=>{
                                    setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Edited",editedReqs:o.editedReqs||{}}));
                                    setEditingOrderId(null);
                                  }} style={{padding:"7px 16px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",background:C.amber,color:"#fff",border:"none"}}>
                                    📤 Send Revised Proposal
                                  </button>
                                </div>
                              </div>
                            )}
                            <div style={{display:"flex",gap:8}}>
                              <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Confirmed",confirmedStaff:o.confirmedStaff&&o.confirmedStaff.length?o.confirmedStaff:[]}))} style={{flex:1,padding:"8px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",border:"none",background:order.status==="Confirmed"?C.green:C.greenBg,color:order.status==="Confirmed"?"#fff":C.green}}>✓ {order.status==="Confirmed"?"Confirmed":"Accept"}</button>
                              <button onClick={()=>setEditingOrderId(editingOrderId===order.id?null:order.id)} style={{flex:1,padding:"8px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",border:"none",background:editingOrderId===order.id||order.status==="Edited"?C.amber:C.amberBg,color:editingOrderId===order.id||order.status==="Edited"?"#fff":C.amber}}>✏ {editingOrderId===order.id?"Close Edit":order.status==="Edited"?"Edited ✓":"Propose Edit"}</button>
                              <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Rejected"}))} style={{flex:1,padding:"8px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",border:"none",background:order.status==="Rejected"?C.red:C.redBg,color:order.status==="Rejected"?"#fff":C.red}}>✕ {order.status==="Rejected"?"Rejected":"Reject"}</button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TEAM DIRECTORY ── */}
      {tab==="directory" && (
        <div style={{position:"relative"}}>
          {deleteConfirm && (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{background:C.surface,borderRadius:16,padding:"28px 32px",maxWidth:380,width:"90%",textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:12}}>🗑</div>
                <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6}}>Remove {deleteConfirm.name}?</div>
                <div style={{fontSize:12,color:C.muted,marginBottom:20}}>This will permanently remove the employee record.</div>
                <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                  <Btn onClick={deleteEmployee} color={C.red} style={{fontSize:12,padding:"8px 20px"}}>Yes, Remove</Btn>
                  <Btn onClick={()=>setDeleteConfirm(null)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12,padding:"8px 16px"}}>Cancel</Btn>
                </div>
              </div>
            </div>
          )}

          {/* Search + filter + add + PIN toggle */}
          <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
            <input value={dirSearch} onChange={e=>setDirSearch(e.target.value)} placeholder={T2("Search name or ID…")} style={{flex:1,minWidth:160,padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
            <button onClick={()=>setShowPins(!showPins)} style={{padding:"7px 12px",borderRadius:8,background:showPins?C.gold:C.surface,color:showPins?"#0A0A0F":C.muted,border:`1px solid ${showPins?C.gold:C.border}`,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>🔐 {showPins?T2("Hide PINs"):T2("Show PINs")}</button>
            <select value={dirFilter} onChange={e=>setDirFilter(e.target.value)} style={{padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}>
              <option value="All">{T2("All Sections")}</option>
              {ALL_DEPARTMENTS.map(s=><option key={s}>{s}</option>)}
              <option value="admin">Admin</option>
              <option value="headchef">{T2("Head Chefs")}</option>
            </select>
            <Btn onClick={()=>setShowAddEmp(s=>!s)} color={showAddEmp?"transparent":C.wine} textColor={showAddEmp?C.muted:"#fff"} border={showAddEmp?`1px solid ${C.border}`:"none"} style={{fontSize:12,padding:"7px 14px"}}>{showAddEmp?"× Cancel":"+ Add Employee"}</Btn>
          </div>

          {showAddEmp && (
            <div style={{background:C.wineBg,border:`1px solid ${C.wineBorder}`,borderRadius:12,padding:"14px 16px",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:600,color:C.gold,marginBottom:10}}>{T2("New Employee")}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:10}}>
                {[{l:"Full Name",k:"name",ph:"Full name"},{l:"Section",k:"section",type:"sel",opts:ALL_DEPARTMENTS},{l:"Role",k:"role",type:"sel",opts:["staff","headchef","admin"]},{l:"PIN (4 digits)",k:"pin",max:4,ph:"0000"},{l:"Joining Date",k:"joining",dt:"date"},{l:"Dept",k:"dept",ph:"F&B Kitchen"}].map(f=>(
                  <div key={f.k}>
                    <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{f.l}</div>
                    {f.type==="sel"
                      ? <select value={newEmpForm[f.k]} onChange={e=>setNewEmpForm(p=>({...p,[f.k]:e.target.value}))} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>{f.opts.map(o=><option key={o}>{o}</option>)}</select>
                      : <input type={f.dt||"text"} value={newEmpForm[f.k]} onChange={e=>setNewEmpForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} maxLength={f.max} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                    }
                  </div>
                ))}
              </div>
              <Btn onClick={addEmployee} color={C.wine} style={{fontSize:11,padding:"6px 16px"}}>{T2("Add Employee")}</Btn>
            </div>
          )}

          {/* Employee cards */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {dirFiltered.map((emp,i)=>{
              const isEdit = selEmp?.id===emp.id;
              return (
                <div key={emp.id} style={{background:C.surface,border:`1px solid ${isEdit?C.wine:C.border}`,borderRadius:10,padding:"11px 13px",opacity:emp.active?1:.65}}>
                  {isEdit&&editEmpForm ? (
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>Edit — {emp.name}</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:8}}>
                        {[{l:"Name",k:"name"},{l:"PIN",k:"pin",max:4},{l:"Joining",k:"joining",dt:"date"}].map(f=>(
                          <div key={f.k}>
                            <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{f.l}</div>
                            <input type={f.dt||"text"} value={editEmpForm[f.k]||""} onChange={e=>setEditEmpForm(p=>({...p,[f.k]:e.target.value}))} maxLength={f.max} style={{width:"100%",padding:"5px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                          </div>
                        ))}
                        <div>
                          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Role</div>
                          <select value={editEmpForm.role} onChange={e=>setEditEmpForm(p=>({...p,role:e.target.value}))} style={{width:"100%",padding:"5px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>
                            {[{v:"staff",l:"Staff"},{v:"headchef",l:"HC"},{v:"admin",l:"Admin"}].map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <Btn onClick={saveEmpEdit} color={C.wine} style={{fontSize:11,padding:"5px 12px"}}>Save</Btn>
                        <Btn onClick={()=>{setSelEmp(null);setEditEmpForm(null);}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:11,padding:"5px 10px"}}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{display:"flex",gap:9,alignItems:"center"}}>
                          <Avatar name={emp.name} size={34} index={i}/>
                          <div>
                            <div style={{fontSize:12,fontWeight:600,color:C.text}}>{emp.name}</div>
                            <div style={{fontSize:10,color:C.gold,fontWeight:600}}>{emp.id}</div>
                            <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
                              <STag name={emp.section}/>
                              <Chip label={emp.role==="admin"?"Admin":emp.role==="headchef"?"HC":"Staff"} color={emp.role!=="staff"?C.wine:C.muted} bg={emp.role!=="staff"?C.wineBg:"#F2F1EE"} size={9}/>
                            </div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                          <button onClick={()=>{setSelEmp(emp);setEditEmpForm({name:emp.name,pin:emp.pin,joining:emp.joining,role:emp.role});}} style={{padding:"6px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,fontSize:10,cursor:"pointer",color:C.text}}>Edit</button>
                          <button onClick={()=>setEmpDb(p=>p.map(e=>e.id!==emp.id?e:{...e,active:!e.active}))} style={{padding:"6px 12px",borderRadius:8,fontSize:10,cursor:"pointer",border:"none",background:emp.active?C.greenBg:C.redBg,color:emp.active?C.green:C.red}}>{emp.active?T2("Active"):T2("Off")}</button>
                          <button onClick={()=>setDeleteConfirm(emp)} style={{padding:"6px 10px",borderRadius:8,fontSize:10,cursor:"pointer",border:`1px solid ${C.redBorder}`,background:C.redBg,color:C.red}}>🗑</button>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:8}}>
                        <div style={{background:C.bg,borderRadius:8,padding:"4px 7px"}}><div style={{fontSize:12,color:C.muted}}>JOINED</div><div style={{fontSize:10,fontWeight:500,color:C.text}}>{emp.joining}</div></div>
                        <div style={{background:C.bg,borderRadius:8,padding:"4px 7px"}}><div style={{fontSize:12,color:C.muted}}>SERVICE</div><div style={{fontSize:10,fontWeight:500,color:C.text}}>{yrsOfService(emp.joining)}</div></div>
                        <div style={{background:showPins?(emp.pin==="0000"?C.amberBg:C.greenBg):C.bg,borderRadius:8,padding:"4px 7px"}}><div style={{fontSize:10,color:showPins?(emp.pin==="0000"?C.amber:C.green):C.muted}}>{T2("PIN")}</div><div style={{fontSize:12,fontWeight:700,color:showPins?(emp.pin==="0000"?C.amber:C.green):C.muted}}>{showPins?(emp.pin==="0000"?"⚠ 0000":emp.pin):"••••"}</div></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}



// ─── CALENDAR MODULE ──────────────────────────────────────────────

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
  {t:"Mesa",desc:"Wash, cut, measure all ingredients",tm:600,ccp:null},
  {t:"Primary prep",desc:"Prepare base masala / paste / batter",tm:480,ccp:null},
  {t:"Cooking",desc:"Cook the dish as per standard method",tm:900,ccp:null},
  {t:"Final seasoning",desc:"Adjust salt, spice, garnish",tm:120,ccp:null},
  {t:"Garnish & plate",desc:"Garnish and transfer to serving vessel",tm:60,ccp:null},
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
    if(r && r.steps && r.steps.length) return r.steps.map(s=>({t:s.t||"Step",desc:s.i||"",tm:s.tm||null,ccp:s.ccp||null}));
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

function KitchenHub({ events, kitchenTracking, setKitchenTracking, lang="en", odcOnly=false }) {
  const T2 = s => T(s, lang);
  const evList0 = safeArr(events);
  const evList = odcOnly ? evList0.filter(e=>/outdoor|odc/i.test(e.venue)) : evList0;
  const kt = kitchenTracking && typeof kitchenTracking === "object" ? kitchenTracking : {};
  const todayEvs = evList.filter(e=>e.date===TODAY).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
  const tomorrowEvs = evList.filter(e=>e.date===TOMORROW).sort((a,b)=>(a.time||"").localeCompare(b.time||""));

  const [tab, setTab] = useState(()=>todayEvs.length>0?"today":"d1");
  const [expandedDish, setExpandedDish] = useState(null); // "evId|idx"
  const [expandedSecs, setExpandedSecs] = useState({});
  const [specialOpen, setSpecialOpen] = useState(null); // "today_Indian Curries" etc
  const toggleSec = (sec)=>setExpandedSecs(p=>({...p,[sec]:p[sec]===false?true:(p[sec]===undefined?false:!p[sec])}));
  const isSecOpen = (sec)=>expandedSecs[sec]!==false; // default open
  const [sopCat, setSopCat] = useState(null);
  const [sopRecipe, setSopRecipe] = useState(null);
  const [sopSearch, setSopSearch] = useState("");
  const [scaleDish, setScaleDish] = useState("");
  const [scaleMode, setScaleMode] = useState("single");
  const [scalePkg, setScalePkg] = useState("");
  const [scaleMultiSel, setScaleMultiSel] = useState({});
  const [scaleOverrides, setScaleOverrides] = useState({});
  const [scaleEditing, setScaleEditing] = useState(null);
  const [scalePercent, setScalePercent] = useState(100); // % multiplier
  const [scaleEventId, setScaleEventId] = useState("manual"); // "manual" | eventId
  const [appliedScales, setAppliedScales] = useState({}); // {evId: {percent, appliedAt, dishes[]}}
  const [d1View, setD1View] = useState("all"); // "all" | "cont" | "new"
  // Helper: get effective scaling % for an event
  function getEventScale(evId){return appliedScales[evId]?.percent||100;}
  // Apply scaling to a raw per-pax quantity
  function applyScale(q, evId){return q*(getEventScale(evId)/100);}
  const [tick, setTick] = useState(0);

  // ── Chef Photo on Mark as Complete ──
  const [readyModal, setReadyModal] = useState(null); // {evId,idx,dishName}
  const [readyPhoto, setReadyPhoto] = useState(null);
  const [readyCamOn, setReadyCamOn] = useState(false);
  const readyVidRef = useRef(null);
  const readyStreamRef = useRef(null);
  function startReadyCam(){
    setReadyCamOn(true);
    setTimeout(()=>{
      navigator.mediaDevices?.getUserMedia({video:{facingMode:"user",width:480,height:360}})
        .then(s=>{readyStreamRef.current=s;if(readyVidRef.current){readyVidRef.current.srcObject=s;readyVidRef.current.play();}})
        .catch(()=>{setReadyCamOn(false);});
    },200);
  }
  function stopReadyCam(){if(readyStreamRef.current){readyStreamRef.current.getTracks().forEach(t=>t.stop());readyStreamRef.current=null;}setReadyCamOn(false);}
  function snapReady(){
    if(!readyVidRef.current||!readyCamOn) return null;
    const c=document.createElement("canvas");c.width=320;c.height=240;
    c.getContext("2d").drawImage(readyVidRef.current,0,0,320,240);
    return c.toDataURL("image/jpeg",0.7);
  }

  // ── Store Step: stoppable timer + quality remarks ──
  const [storeRemarks, setStoreRemarks] = useState({}); // {"evId_idx_si": {rating:"",text:""}}
  function stopStoreStep(evId,idx,si){
    const d=ds(evId,idx);
    setDs(evId,idx,{manual:{...(d.manual||{}),[si]:true},storeEndAt:{...(d.storeEndAt||{}),[si]:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}});
  }
  function saveStoreRemark(key,field,val){setStoreRemarks(p=>({...p,[key]:{...(p[key]||{rating:"",text:""}),[field]:val}}))}

  // Global 1-second tick drives all running timers
  useEffect(()=>{const t=setInterval(()=>setTick(k=>k+1),1000);return()=>clearInterval(t);},[]);

  // ── State helpers (auto-save to kitchenTracking) ──
  function dk(evId,idx){return evId+"|"+idx;}
  function ds(evId,idx){return kt[evId]?.[dk(evId,idx)]||{};}
  function setDs(evId,idx,upd){
    setKitchenTracking(p=>{const o=p&&typeof p==="object"?{...p}:{};const k2=dk(evId,idx);o[evId]={...(o[evId]||{}),[k2]:{...(o[evId]?.[k2]||{}),...upd}};return o;});
  }
  function setEvMeta(evId,key,val){
    setKitchenTracking(p=>{const o=p&&typeof p==="object"?{...p}:{};o[evId]={...(o[evId]||{}),[key]:val};return o;});
  }

  // ── Timer logic ──
  function startStep(evId,idx,si,tm){
    const d=ds(evId,idx);
    const starts={...(d.starts||{})};
    starts[si]=Date.now();
    setDs(evId,idx,{starts,stepTm:{...(d.stepTm||{}),[si]:tm}});
  }
  function elapsed(d,si){return d.starts?.[si]?Math.floor((Date.now()-d.starts[si])/1000):0;}
  function stepDone(d,si){
    if(d.manual?.[si]) return true;
    // If Mesa was completed on D-1, first 2 steps (Store + Mesa) are auto-done
    if(d.mesaDone && si <= 1) return true;
    if(!d.starts?.[si]) return false;
    const el=elapsed(d,si);const tm=d.stepTm?.[si]||0;
    return tm>0&&el>=tm;
  }
  function isD1Step(d,si){ return d.mesaDone && si <= 1; }
  function markManual(evId,idx,si){
    const d=ds(evId,idx);
    setDs(evId,idx,{manual:{...(d.manual||{}),[si]:true}});
  }
  function markComplete(evId,idx){setDs(evId,idx,{complete:true,completeAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})});}
  function markReady(evId,idx,dishName){setReadyModal({evId,idx,dishName});setReadyPhoto(null);setTimeout(startReadyCam,100);}
  function markDishDispatch(evId,idx){setDs(evId,idx,{dispatchReady:true,dispatchAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})});}
  function markDispatch(evId){setEvMeta(evId,"__dispatch_ready",true);setEvMeta(evId,"__dispatch_time",new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));}
  // Venues that need dispatch (not base kitchen)
  const DISPATCH_VENUES=["Manaktala Farm","Ambria Restro","Ambria Cuisine","Outdoor Catering (ODC)"];
  function evStats(ev){
    const menu=safeArr(ev.menu);
    const kitchenMenu=menu.filter(n=>guessSectionForDish(n)!=="Beverages");
    let rdy=0;
    kitchenMenu.forEach((n,i)=>{const realIdx=menu.indexOf(n);if(ds(ev.id,realIdx).ready)rdy++;});
    return{rdy,total:kitchenMenu.length,allRdy:rdy===kitchenMenu.length&&kitchenMenu.length>0,dispatched:!!(kt[ev.id]?.__dispatch_ready)};
  }

  const tomorrowLabel = new Date(TOMORROW+"T00:00").toLocaleDateString(lang==="hi"?"hi-IN":"en-IN",{day:"numeric",month:"short"});
  const todayLabel2   = new Date(TODAY+"T00:00").toLocaleDateString(lang==="hi"?"hi-IN":"en-IN",{day:"numeric",month:"short"});
  const dayAfterLabel = new Date(DAY_AFTER+"T00:00").toLocaleDateString(lang==="hi"?"hi-IN":"en-IN",{day:"numeric",month:"short"});
  const hasTodayEvs   = todayEvs.length > 0;
  const hasTomorrowEvs = tomorrowEvs.length > 0;
  const hasDayAfterEvs = evList.filter(e=>e.date===DAY_AFTER).length > 0;

  const tomorrowEv0 = tomorrowEvs[0];
  const dayAfterEv0 = evList.find(e=>e.date===DAY_AFTER);

  // Tab 1:
  // No event today  → "🔥 31 May — D-1 for 1 Jun"
  // Event today     → "🔥 1 Jun  — Final Cooking"
  const todayTabL = hasTodayEvs
    ? `🔥 ${todayLabel2} — ${T2("Final Cooking")} (${todayEvs.reduce((s,e)=>s+(+e.pax||0),0)} pax)`
    : `🔥 ${todayLabel2} — D-1 ${T2("for")} ${tomorrowLabel} (${tomorrowEvs.reduce((s,e)=>s+(+e.pax||0),0)} pax)`;

  // Tab 2:
  // No event today  → "Continue of 31 May D-1 & D-1 for 2 Jun"  (Jun 1 event day = continuation + new D-1 for Jun 2)
  // Event today     → "Continue of [today] D-1 & D-1 for [dayAfter]"
  const contDate    = hasTodayEvs ? todayLabel2 : todayLabel2;
  const nextD1Date  = hasTodayEvs ? dayAfterLabel : dayAfterLabel;
  const nextD1Ev    = hasTodayEvs ? dayAfterEv0 : dayAfterEv0;
  const d1ForDate   = hasTodayEvs ? DAY_AFTER : TOMORROW;
  const d1ForLabel  = hasTodayEvs ? dayAfterLabel : tomorrowLabel;
  const d1Ev        = hasTodayEvs ? dayAfterEv0 : tomorrowEv0;

  const contPax  = hasTodayEvs ? todayEvs.reduce((s,e)=>s+(+e.pax||0),0) : tomorrowEvs.reduce((s,e)=>s+(+e.pax||0),0);
  const newD1Pax = evList.filter(e=>e.date===DAY_AFTER).reduce((s,e)=>s+(+e.pax||0),0);
  const d1TabL = `📋 ${T2("Continue")} ${todayLabel2} D-1 (${contPax} pax) & D-1 ${T2("for")} ${dayAfterLabel}${newD1Pax?` (${newD1Pax} pax)`:""}`;

  const TABS=[
    {v:"today", l:todayTabL},
    {v:"d1",    l:d1TabL},
    {v:"scale", l:`⚖️ ${T2("Pax Scaling")}`},
    {v:"sops",  l:`📖 ${T2("Recipe SOPs")}`},
    {v:"menus", l:`📜 ${T2("Menu")}`},
  ];

  // ── Inline dish card (shows live progress) ──

  return(
    <div style={{position:"relative"}}>

      {/* ── Chef Photo Modal ── */}
      {readyModal&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:C.surface,borderRadius:20,padding:"28px 24px",maxWidth:400,width:"100%",border:`2px solid ${C.greenBorder}`,boxShadow:"0 32px 80px rgba(0,0,0,.7)"}}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:32,marginBottom:8}}>📸</div>
              <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:.5}}>{T2("Dish Ready!")}</div>
              <div style={{fontSize:14,color:C.gold,marginTop:4,fontWeight:600}}>{readyModal.dishName}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{T2("Take a photo of the completed dish before marking as done")}</div>
            </div>
            <div style={{borderRadius:14,overflow:"hidden",background:"#000",marginBottom:14,minHeight:200,position:"relative"}}>
              {!readyPhoto?<video ref={readyVidRef} autoPlay playsInline muted style={{width:"100%",height:200,objectFit:"cover",display:"block"}}/>
                          :<img src={readyPhoto} alt="dish" style={{width:"100%",height:200,objectFit:"cover",display:"block"}}/>}
              {!readyCamOn&&!readyPhoto&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:13}}>📷 {T2("Starting camera…")}</div>}
            </div>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              {!readyPhoto
                ?<button onClick={()=>{const s=snapReady();if(s){setReadyPhoto(s);stopReadyCam();}}} style={{flex:1,padding:"12px",borderRadius:12,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:46}}>📸 {T2("Capture Photo")}</button>
                :<button onClick={()=>{setReadyPhoto(null);startReadyCam();}} style={{flex:1,padding:"12px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:46}}>🔄 {T2("Retake")}</button>
              }
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{
                const {evId,idx}=readyModal;
                setDs(evId,idx,{ready:true,readyAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),readyPhoto:readyPhoto||null});
                stopReadyCam();setReadyModal(null);setReadyPhoto(null);
              }} style={{flex:1,padding:"14px",borderRadius:12,background:`linear-gradient(135deg,${C.green},#1E6634)`,color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",minHeight:50,fontFamily:"var(--font-display)",letterSpacing:.5}}>
                ✅ {T2("Confirm Ready")}
              </button>
              <button onClick={()=>{stopReadyCam();setReadyModal(null);setReadyPhoto(null);}} style={{padding:"14px 18px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:14,cursor:"pointer",minHeight:50}}>✕</button>
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{display:"flex",gap:8,marginBottom:18}}>
        {TABS.map(t=>(
          <button key={t.v} onClick={()=>setTab(s=>{if(s!==t.v&&(t.v==="d1"||s==="d1"))setD1View("all");return t.v;})} style={{padding:"14px 24px",borderRadius:24,fontSize:15,fontWeight:600,cursor:"pointer",minHeight:48,background:tab===t.v?C.gold:"transparent",color:tab===t.v?"#0A0A0F":C.muted,border:`2px solid ${tab===t.v?C.gold:C.border}`}}>{t.l}</button>
        ))}
      </div>

      {/* ═══ D-1 PREP ═══ */}
      {/* ═══ D-1 PREP — CONSOLIDATED ═══ */}
      {tab==="today"&&(()=>{
        // If no event today → this tab IS the D-1 prep for tomorrow's function
        if(!hasTodayEvs) {
          const evs=tomorrowEvs;
          if(evs.length===0) return <Card style={{padding:"32px 24px",textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>📋</div><div style={{fontSize:14,color:C.muted}}>{T2("No upcoming functions to prep for")}</div></Card>;
          const byDish={};
          evs.forEach(ev=>{
            const sp=ev.special||"";
            const isSpecial=/no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
            safeArr(ev.menu).forEach((name,idx)=>{
              if(guessSectionForDish(name)==="Beverages") return;
              if(!byDish[name])byDish[name]={sec:guessSectionForDish(name),totalPax:0,fns:[],fEvId:ev.id,fIdx:idx,specials:[]};
              byDish[name].totalPax+=ev.pax||0;
              byDish[name].fns.push({evId:ev.id,g:ev.guest,v:ev.venue,p:ev.pax,idx,special:sp,isSpecial});
              if(isSpecial) byDish[name].specials.push({guest:ev.guest,pax:ev.pax,instruction:sp});
            });
          });
          const bySec={};Object.entries(byDish).forEach(([n,info])=>{if(!bySec[info.sec])bySec[info.sec]=[];bySec[info.sec].push({name:n,...info});});
          const secKeys=Object.keys(bySec).sort();const totalU=Object.keys(byDish).length;
          return(
            <div>
              <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>
                📋 D-1 {T2("for")} {tomorrowLabel} — {evs.map(e=>e.guest).join(" · ")}
              </div>
              <div style={{fontSize:12,color:C.muted,marginBottom:6}}>{evs.map(e=>`${e.pax} pax`).join(" + ")} · {T2("Advance prep today")}</div>
              <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:18}}>💡</span>
                <div style={{fontSize:12,color:C.gold}}>{T2("These are advance prep steps — Mesa, marination, grinding, cutting, dough. Actual cooking will happen on the event day")} ({tomorrowLabel}).</div>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"8px 14px"}}><div style={{fontSize:18,fontWeight:700,color:C.gold}}>{totalU}</div><div style={{fontSize:11,color:C.muted}}>{T2("unique dishes")}</div></div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px"}}><div style={{fontSize:18,fontWeight:700,color:C.text}}>{evs.reduce((s,e)=>s+(e.pax||0),0)}</div><div style={{fontSize:11,color:C.muted}}>{T2("total pax")}</div></div>
              </div>
              {secKeys.map(sec=>{
                const items=bySec[sec];const m2=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                const mesaDone2=items.filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length;
                const d1Pct=Math.round(mesaDone2/items.length*100);
                const d1Open=isSecOpen("d1t_"+sec);
                const d1Specials=[...new Map(items.flatMap(d=>d.specials||[]).map(sp=>[sp.guest+"|"+sp.instruction,sp])).values()];
                return(<Card key={sec} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
                  <div onClick={()=>toggleSec("d1t_"+sec)} style={{padding:"14px 16px",background:m2.color+"10",borderBottom:d1Open?`1px solid ${C.border}`:"none",cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:14,fontWeight:700,color:m2.color}}>{m2.icon} {T2(sec)}</span>
                        <span style={{fontSize:11,color:C.muted}}>{items.length} {T2("dishes")}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:48,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:d1Pct+"%",background:mesaDone2===items.length?C.green:C.amber,borderRadius:3}}/></div>
                        <span style={{fontSize:13,fontWeight:700,color:mesaDone2===items.length?C.green:d1Pct>0?C.amber:C.muted,minWidth:40,textAlign:"right"}}>{d1Pct}%</span>
                        {d1Specials.length>0&&<span onClick={e=>{e.stopPropagation();setSpecialOpen(specialOpen==="d1t_"+sec?null:"d1t_"+sec);}} style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,cursor:"pointer",fontWeight:700}}>🚫 {d1Specials.length}</span>}
                        <span style={{fontSize:14,color:C.muted,transform:d1Open?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                      </div>
                    </div>
                  </div>
                  {specialOpen==="d1t_"+sec&&d1Specials.length>0&&<div style={{padding:"10px 16px",background:C.redBg+"80",borderBottom:`1px solid ${C.redBorder}`}} onClick={e=>e.stopPropagation()}>
                    {d1Specials.map((sp,si)=><div key={si} style={{fontSize:12,color:C.red,padding:"6px 0",borderBottom:si<d1Specials.length-1?`1px solid ${C.redBorder}40`:"none"}}>🚫 <b>{sp.pax} {T2("pax")}</b> — {sp.guest}: {sp.instruction}</div>)}
                  </div>}
                  {d1Open&&<div style={{padding:"10px 16px"}}>{items.map((dish,di)=>{
                    const cKey=`d1t_${dish.fEvId}_${dish.fIdx}`;const isExp2=expandedDish===cKey;const d2=ds(dish.fEvId,dish.fIdx);
                    const allStepsTmp=getStepsForDish(dish.name);
                    const steps2=allStepsTmp.length>0?allStepsTmp:[{t:"Mesa",i:"Wash, cut, measure all ingredients as per recipe",tm:600},{t:"Primary prep",i:"Prepare base masala / paste / marinade",tm:480}];
                    const allDone2=!!d2.mesaDone;
                    return(<div key={di} style={{marginBottom:6}}>
                      <div onClick={()=>setExpandedDish(isExp2?null:cKey)} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 8px",borderRadius:10,cursor:"pointer",background:allDone2?C.greenBg:C.surface,border:`1px solid ${allDone2?C.greenBorder:C.border}`}}>
                        <div style={{width:28,height:28,borderRadius:8,border:`2px solid ${allDone2?C.green:C.border}`,background:allDone2?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{allDone2&&<span style={{color:"#0A0A0F",fontSize:10,fontWeight:700}}>✓</span>}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:allDone2?C.green:C.text}}>{dish.name}</div>
                          <div style={{fontSize:12,color:C.gold}}>{dish.totalPax} {T2("pax")} · {steps2.length} {T2("mesa steps")}</div>
                          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{dish.fns.map(f=>`${f.g} (${f.p})`).join(" · ")}</div>
                        </div>
                        <span style={{fontSize:14,color:C.muted,transform:isExp2?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                      </div>
                      {isExp2&&(<div style={{padding:"8px 8px 8px 44px"}}>{steps2.map((step,si)=>{
                        const running2=!!(d2.starts?.[`mesa_${si}`])&&!(d2.manual?.[`mesa_${si}`])&&!(d2.starts?.[`mesa_${si}`]&&step.tm&&(Math.floor((Date.now()-d2.starts[`mesa_${si}`])/1000)>=step.tm));
                        const sDone2=!!(d2.manual?.[`mesa_${si}`])||(d2.starts?.[`mesa_${si}`]&&step.tm&&(Math.floor((Date.now()-(d2.starts[`mesa_${si}`]||0))/1000)>=step.tm));
                        const el3=running2?Math.floor((Date.now()-d2.starts[`mesa_${si}`])/1000):0;const rem2=Math.max(0,(step.tm||0)-el3);
                        const pct3=step.tm>0?Math.min(100,Math.round(el3/step.tm*100)):(sDone2?100:0);
                        const prevOk2=si===0||!!(d2.manual?.[`mesa_${si-1}`])||(d2.starts?.[`mesa_${si-1}`]&&steps2[si-1]?.tm&&(Math.floor((Date.now()-(d2.starts[`mesa_${si-1}`]||0))/1000)>=steps2[si-1].tm));
                        return(<div key={si} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:si<steps2.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"center"}}>
                          <div style={{width:26,height:26,borderRadius:8,background:sDone2?C.green:running2?C.amber:C.darkCard,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:sDone2||running2?"#0A0A0F":C.muted,flexShrink:0}}>{sDone2?"✓":si+1}</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:600,color:sDone2?C.green:C.text}}>{step.t}</div>
                            {(step.i||step.desc)&&<div style={{fontSize:11,color:C.muted}}>{step.i||step.desc}</div>}
                            {step.ccp&&<div style={{fontSize:11,color:C.red,marginTop:2}}>🔴 CCP: {step.ccp}</div>}
                            {step.tm>0&&<div style={{height:6,background:C.border,borderRadius:2,marginTop:4,overflow:"hidden"}}><div style={{height:"100%",width:pct3+"%",background:sDone2?C.green:C.amber,borderRadius:2,transition:"width .5s"}}/></div>}
                            {running2&&<div style={{fontSize:11,color:C.amber,marginTop:2}}>⏱ {fmtT(el3)}/{fmtT(step.tm)} — {fmtT(rem2)} {T2("left")}</div>}
                          </div>
                          {!running2&&!sDone2&&step.tm>0&&prevOk2&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{starts:{...(d2.starts||{}),[`mesa_${si}`]:Date.now()}});}} style={{padding:"6px 12px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:10,fontWeight:600,cursor:"pointer",minHeight:40}}>▶ {fmtT(step.tm)}</button>}
                          {!running2&&!sDone2&&!step.tm&&prevOk2&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2.manual||{}),[`mesa_${si}`]:true}});}} style={{padding:"6px 12px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:10,fontWeight:600,cursor:"pointer",minHeight:40}}>✓</button>}
                        </div>);})}
                        {steps2.every((_,si)=>!!(d2.manual?.[`mesa_${si}`])||(d2.starts?.[`mesa_${si}`]&&steps2[si]?.tm&&(Math.floor((Date.now()-(d2.starts[`mesa_${si}`]||0))/1000)>=steps2[si].tm)))&&!allDone2&&(
                          <button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{mesaDone:true});}} style={{width:"100%",padding:"10px",borderRadius:10,background:`linear-gradient(135deg,${C.green},#2A7A4A)`,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",marginTop:6,minHeight:40}}>✅ {T2("Mesa Complete")} — {dish.name} ({dish.totalPax} {T2("pax")})</button>
                        )}
                      </div>)}
                    </div>);
                  })}</div>}
                </Card>);
              })}
            </div>
          );
        }

        // Event today → show full cooking tasks
        const evs=todayEvs;
        const byDish={};
        evs.forEach(ev=>{
          const sp=ev.special||"";
          const isSpecial=/no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
          safeArr(ev.menu).forEach((name,idx)=>{
            if(guessSectionForDish(name)==="Beverages") return;
            if(!byDish[name])byDish[name]={sec:guessSectionForDish(name),totalPax:0,fns:[],fEvId:ev.id,fIdx:idx,specials:[]};
            byDish[name].totalPax+=ev.pax||0;
            byDish[name].fns.push({evId:ev.id,g:ev.guest,v:ev.venue,p:ev.pax,idx,special:sp,isSpecial});
            if(isSpecial) byDish[name].specials.push({guest:ev.guest,pax:ev.pax,instruction:sp});
          });
        });
        const bySec={};Object.entries(byDish).forEach(([n,info])=>{if(!bySec[info.sec])bySec[info.sec]=[];bySec[info.sec].push({name:n,...info});});
        const secKeys=Object.keys(bySec).sort();const totalU=Object.keys(byDish).length;
        const totalReady=Object.values(byDish).filter(d=>ds(d.fEvId,d.fIdx).ready).length;
        const allDishesReady=totalReady===totalU&&totalU>0;
        return(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>🔥 {T2("Today's Tasks")} — {TODAY_LABEL}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:6}}>
              {evs.length>0?`${T2("Event day cooking for")} ${evs.map(e=>e.guest).join(" · ")} (${evs.reduce((s,e)=>s+(+e.pax||0),0)} ${T2("pax")})`:T2("No events today — focus on D-1 prep below")}
            </div>
            {(()=>{const d1Count=Object.values(byDish).filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length;const d1Total=totalU;return d1Count>0?(
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:18}}>✅</span>
                <div><div style={{fontSize:12,fontWeight:700,color:C.green}}>{d1Count}/{d1Total} {T2("dishes had D-1 Mesa prep done yesterday")}</div>
                <div style={{fontSize:11,color:C.green}}>{T2("Those steps are marked D-1 ✅ below — team can skip to cooking")}</div></div>
              </div>
            ):(
              <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:18}}>⚠</span>
                <div><div style={{fontSize:12,fontWeight:700,color:C.amber}}>{T2("No D-1 prep was done yesterday")}</div>
                <div style={{fontSize:11,color:C.amber}}>{T2("All steps including Mesa must be completed today")}</div></div>
              </div>
            );})()}
            <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"8px 14px"}}><div style={{fontSize:18,fontWeight:700,color:C.gold}}>{totalReady}/{totalU}</div><div style={{fontSize:11,color:C.muted}}>{T2("dishes ready")}</div></div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px"}}><div style={{fontSize:18,fontWeight:700,color:C.text}}>{evs.length}</div><div style={{fontSize:11,color:C.muted}}>{T2("functions")}</div></div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px"}}><div style={{fontSize:18,fontWeight:700,color:C.text}}>{evs.reduce((s,e)=>s+(e.pax||0),0)}</div><div style={{fontSize:11,color:C.muted}}>{T2("total pax")}</div></div>
            </div>
            {secKeys.length===0&&(
              <Card style={{padding:"32px 24px",textAlign:"center",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:36,marginBottom:12}}>📋</div>
                <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:6}}>{T2("No events today")}</div>
                <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>{T2("Today is a D-1 prep day.")}<br/>{T2("Switch to the D-1 tab to see all advance prep tasks for tomorrow's function.")}</div>
                <button onClick={()=>setTab("d1")} style={{marginTop:16,padding:"12px 24px",borderRadius:12,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>
                  📋 {T2("Go to D-1 Prep")} →
                </button>
              </Card>
            )}
            {secKeys.map(sec=>{const items=bySec[sec];const m2=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
              const secReady=items.filter(d=>ds(d.fEvId,d.fIdx).ready).length;
              const secPct=Math.round(secReady/items.length*100);
              const secOpen=isSecOpen("today_"+sec);
              const secSpecials=[...new Map(items.flatMap(d=>d.specials||[]).map(sp=>[sp.guest+"|"+sp.instruction,sp])).values()];
              return(<Card key={sec} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
                <div onClick={()=>toggleSec("today_"+sec)} style={{padding:"14px 16px",background:m2.color+"10",borderBottom:secOpen?`1px solid ${C.border}`:"none",cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:14,fontWeight:700,color:m2.color}}>{m2.icon} {T2(sec)}</span>
                      <span style={{fontSize:11,color:C.muted}}>{items.length} {T2("dishes")}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:48,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:secPct+"%",background:secReady===items.length?C.green:C.amber,borderRadius:3}}/></div>
                      <span style={{fontSize:13,fontWeight:700,color:secReady===items.length?C.green:secPct>0?C.amber:C.muted,minWidth:40,textAlign:"right"}}>{secPct}%</span>
                      {secSpecials.length>0&&<span onClick={(e)=>{e.stopPropagation();setSpecialOpen(specialOpen==="today_"+sec?null:"today_"+sec);}} style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,cursor:"pointer",fontWeight:700}}>🚫 {secSpecials.length}</span>}
                      <span style={{fontSize:14,color:C.muted,transform:secOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                    </div>
                  </div>
                </div>
                {specialOpen==="today_"+sec&&secSpecials.length>0&&<div style={{padding:"10px 16px",background:C.redBg+"80",borderBottom:`1px solid ${C.redBorder}`}} onClick={e=>e.stopPropagation()}>
                  {secSpecials.map((sp,si)=><div key={si} style={{fontSize:12,color:C.red,padding:"6px 0",borderBottom:si<secSpecials.length-1?`1px solid ${C.redBorder}40`:"none"}}>🚫 <b>{sp.pax} {T2("pax")}</b> — {sp.guest}: {sp.instruction}</div>)}
                </div>}
                {secOpen&&<div style={{padding:"8px 12px"}}>{items.map((dish,di)=>{
                  const d3=ds(dish.fEvId,dish.fIdx);const steps3=getFullSteps(dish.name);
                  const runSi=steps3.findIndex((_,si)=>d3.starts?.[si]&&!stepDone(d3,si));
                  const doneSi=steps3.filter((_,si)=>stepDone(d3,si)).length;const pctA=safePct(doneSi,steps3.length);
                  const isExp3=expandedDish===dk(dish.fEvId,dish.fIdx);
                  const imgUrl=getDishImageUrl(dish.name);
                  return(<div key={di} style={{marginBottom:8,border:`1.5px solid ${d3.ready?C.greenBorder:runSi>=0?C.amberBorder:C.border}`,borderRadius:14,overflow:"hidden",boxShadow:"0 4px 16px rgba(0,0,0,.4)"}}>
                    <div onClick={()=>setExpandedDish(isExp3?null:dk(dish.fEvId,dish.fIdx))} style={{cursor:"pointer",position:"relative",minHeight:72}}>
                      {/* Dish image background */}
                      <div style={{position:"absolute",inset:0,backgroundImage:`url(${imgUrl})`,backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(.35) saturate(.8)"}}/>
                      <div style={{position:"absolute",inset:0,background:`linear-gradient(90deg, rgba(10,9,8,.92) 45%, rgba(10,9,8,.4) 100%)`}}/>
                      {/* Content over image */}
                      <div style={{position:"relative",padding:"12px 16px",display:"flex",gap:12,alignItems:"center"}}>
                        <div style={{width:36,height:36,borderRadius:10,background:d3.ready?C.green:runSi>=0?C.amber:C.darkCard+"CC",border:`2px solid ${d3.ready?C.green:runSi>=0?C.amber:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:d3.ready||runSi>=0?"#0A0A0F":C.muted,flexShrink:0,backdropFilter:"blur(4px)"}}>{d3.ready?"✓":runSi>=0?"⏱":di+1}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:700,color:d3.ready?C.green:C.cream,letterSpacing:.2,textShadow:"0 1px 4px rgba(0,0,0,.5)"}}>{dish.name}</div>
                          <div style={{fontSize:11,color:C.gold,marginTop:2,textShadow:"0 1px 3px rgba(0,0,0,.4)"}}>{dish.totalPax} {T2("pax")} · {dish.fns.map(f=>f.g+" ("+f.p+")").join(" · ")}</div>
                          <div style={{fontSize:11,color:d3.readyAt?C.green:C.muted,marginTop:1}}>{doneSi}/{steps3.length} {T2("steps")} {d3.readyAt?"· ✅ "+d3.readyAt:""}</div>
                          {!d3.ready&&<div style={{height:3,background:"rgba(255,255,255,.1)",borderRadius:2,marginTop:5,overflow:"hidden"}}><div style={{height:"100%",width:pctA+"%",background:runSi>=0?C.amber:C.muted,borderRadius:2,transition:"width .5s"}}/></div>}
                        </div>
                        {runSi>=0&&(()=>{const el4=elapsed(d3,runSi);const tm4=d3.stepTm?.[runSi]||0;return <div style={{fontSize:16,fontWeight:700,color:C.amber,flexShrink:0,textShadow:"0 1px 4px rgba(0,0,0,.5)"}}>{fmtT(Math.max(0,tm4-el4))}</div>;})()}
                        <span style={{fontSize:16,color:"rgba(255,255,255,.5)",transform:isExp3?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▾</span>
                      </div>
                    </div>
                    {isExp3&&(<div style={{padding:"10px 16px",borderTop:`1px solid ${C.border}`}}>
                      {/* D-1 Mesa Status */}
                      {(()=>{
                        const mesaAllSteps=getStepsForDish(dish.name);
                        const mesaDone2=!!d3.mesaDone;
                        const mesaCount=mesaAllSteps.length||1;
                        return (
                          <div style={{background:mesaDone2?C.greenBg:C.amberBg,border:`1px solid ${mesaDone2?C.greenBorder:C.amberBorder}`,borderRadius:10,padding:"10px 14px",marginBottom:10}}>
                            <div style={{fontSize:12,fontWeight:700,color:mesaDone2?C.green:C.amber}}>{mesaDone2?"✅":"⏳"} D-1 Mesa: {mesaDone2?T2("Completed"):T2("Pending")}</div>
                            <div style={{fontSize:11,color:C.muted,marginTop:3}}>{mesaDone2?T2("All advance prep was done yesterday. Continue with cooking steps below."):T2("Mesa prep not done on D-1. Start from Mesa steps first.")}</div>
                            {mesaDone2&&mesaAllSteps.length>0&&<div style={{fontSize:11,color:C.green,marginTop:4}}>{mesaAllSteps.filter(s=>/mesa|prep|marin|grind|dough|cut/i.test(s.t||"")).map(s=>s.t).join(" → ")} ✓</div>}
                          </div>
                        );
                      })()}

                      {/* All Steps with timers */}
                      {steps3.map((step,si)=>{const running3=!!(d3.starts?.[si])&&!stepDone(d3,si);const done3=stepDone(d3,si);const d1Done=isD1Step(d3,si);const el5=running3?elapsed(d3,si):0;const tm5=step.tm||0;const rem3=Math.max(0,tm5-el5);const pct4=tm5>0?Math.min(100,Math.round(el5/tm5*100)):(done3?100:0);const prevOk3=si===0||stepDone(d3,si-1);
                        return(<div key={si} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:si<steps3.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"flex-start",opacity:d1Done?.6:1}}>
                          <div style={{width:32,height:32,borderRadius:8,background:done3?C.green:running3?C.amber:C.darkCard,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:done3||running3?"#0A0A0F":C.muted,flexShrink:0}}>{done3?"✓":si+1}</div>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <span style={{fontSize:12,fontWeight:700,color:done3?C.green:step.store?C.gold:C.text}}>{step.t}{step.store?" 🏪":""}{step.live?" 🔴":""}</span>
                              {d1Done&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green}}>D-1 ✅</span>}
                              {step.store&&done3&&d3.storeEndAt?.[si]&&<span style={{fontSize:10,color:C.green,marginLeft:4}}>⏹ {d3.storeEndAt[si]}</span>}
                            </div>
                            {step.i&&<div style={{fontSize:12,color:C.muted,marginTop:2,lineHeight:1.4}}>{step.i}</div>}
                            {step.ccp&&<div style={{fontSize:11,color:C.red,background:C.redBg,padding:"6px 10px",borderRadius:4,display:"inline-block",marginTop:3}}>🔴 CCP: {step.ccp}</div>}

                            {step.store?(
                              <div style={{marginTop:8}}>
                                {/* Scaling badge if applied */}
                                {(()=>{
                                  const evScale=appliedScales[dish.fEvId]||appliedScales["manual"];
                                  if(evScale&&evScale.percent!==100&&evScale.dishes.includes(dish.name)){
                                    return(
                                      <div style={{background:evScale.percent<100?C.amberBg:C.greenBg,border:`1px solid ${evScale.percent<100?C.amberBorder:C.greenBorder}`,borderRadius:8,padding:"6px 12px",marginBottom:8,fontSize:11,display:"flex",gap:8,alignItems:"center"}}>
                                        <span style={{fontWeight:700,color:evScale.percent<100?C.amber:C.green}}>📐 {evScale.percent}% scaling applied</span>
                                        <span style={{color:C.muted}}>· {evScale.eventName||"Manual"} · {evScale.appliedAt}</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                                {/* Scaled ingredient list */}
                                {RECIPE_INGREDIENTS[dish.name]&&(()=>{
                                  const evPct=(appliedScales[dish.fEvId]||appliedScales["manual"])?.percent||100;
                                  const ev=evList.find(e=>e.id===dish.fEvId);
                                  const pax=ev?+ev.pax:0;
                                  const ing=RECIPE_INGREDIENTS[dish.name];
                                  if(!pax) return null;
                                  return(
                                    <div style={{background:C.bg,borderRadius:8,padding:"8px 12px",marginBottom:8,border:`1px solid ${C.border}`}}>
                                      <div style={{fontSize:11,fontWeight:700,color:C.gold,marginBottom:6}}>🧺 {T2("Items to collect")} — {pax} pax {evPct!==100?`@ ${evPct}%`:""}</div>
                                      <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px"}}>
                                        {ing.filter(i=>i.q>0).map((i,ii)=>{
                                          const raw=i.q*pax*(evPct/100);
                                          const qty=i.u==="g"?raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" kg":Math.round(raw)+" g":i.u==="ml"?raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" ml":i.u==="pcs"?Math.ceil(raw)+" pcs":Math.round(raw)+" "+i.u;
                                          return <span key={ii} style={{fontSize:11,color:C.text}}>{i.n}: <strong style={{color:C.gold}}>{qty}</strong></span>;
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}
                                {!running3&&!done3&&prevOk3&&<button onClick={e=>{e.stopPropagation();startStep(dish.fEvId,dish.fIdx,si,3600);}} style={{padding:"12px 20px",borderRadius:12,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:48,display:"flex",gap:8,alignItems:"center"}}>🏃 {T2("Go Collect Items")} — {T2("1 hr timer")}</button>}
                                {running3&&<div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:12,padding:"14px 16px"}}>
                                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                                    <div>
                                      <div style={{fontSize:15,fontWeight:700,color:C.amber}}>⏱ {fmtT(el5)} {T2("elapsed")}</div>
                                      <div style={{fontSize:11,color:C.muted}}>{fmtT(Math.max(0,3600-el5))} {T2("remaining of 1 hr limit")}</div>
                                    </div>
                                    <button onClick={e=>{e.stopPropagation();stopStoreStep(dish.fEvId,dish.fIdx,si);}} style={{padding:"10px 18px",borderRadius:10,background:C.green,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>✅ {T2("Done")}</button>
                                  </div>
                                  <div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden",marginBottom:10}}>
                                    <div style={{height:"100%",width:Math.min(100,Math.round(el5/3600*100))+"%",background:el5>3000?C.red:C.amber,borderRadius:3,transition:"width 1s"}}/>
                                  </div>
                                  <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:8}}>📝 {T2("Quality Remarks")}</div>
                                  {/* Quality rating buttons */}
                                  {(()=>{
                                    const rKey=dish.fEvId+"_"+dish.fIdx+"_"+si;
                                    const rm=storeRemarks[rKey]||{rating:"",text:""};
                                    const RATINGS=[
                                      {v:"excellent",l:"🌟 "+T2("Excellent"),c:"#22C55E",bg:"#052E16"},
                                      {v:"good",l:"✅ "+T2("Good"),c:C.green,bg:C.greenBg},
                                      {v:"average",l:"🟡 "+T2("Average"),c:C.amber,bg:C.amberBg},
                                      {v:"poor",l:"🔴 "+T2("Poor Quality"),c:C.red,bg:C.redBg},
                                      {v:"missing",l:"⚠️ "+T2("Items Missing"),c:"#F97316",bg:"#2D1B00"},
                                    ];
                                    return(
                                      <div>
                                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                                          {RATINGS.map(r=>(
                                            <button key={r.v} onClick={e=>{e.stopPropagation();saveStoreRemark(rKey,"rating",rm.rating===r.v?"":r.v);}}
                                              style={{padding:"8px 12px",borderRadius:10,border:`2px solid ${rm.rating===r.v?r.c:C.border}`,background:rm.rating===r.v?r.bg:"transparent",color:rm.rating===r.v?r.c:C.muted,fontSize:12,fontWeight:rm.rating===r.v?700:400,cursor:"pointer",minHeight:38}}>
                                              {r.l}
                                            </button>
                                          ))}
                                        </div>
                                        <textarea value={rm.text||""} onChange={e=>{e.stopPropagation();saveStoreRemark(rKey,"text",e.target.value);}} onClick={e=>e.stopPropagation()} placeholder={T2("e.g. Paneer fresh, tomatoes slightly overripe, onion good quality…")} rows={2} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.bg,resize:"none",boxSizing:"border-box"}}/>
                                      </div>
                                    );
                                  })()}
                                </div>}
                                {done3&&<div style={{marginTop:4}}>
                                  <span style={{fontSize:12,color:C.green}}>✅ {T2("Collected")} {d3.storeEndAt?.[si]?"· "+d3.storeEndAt[si]:""}</span>
                                  {(()=>{
                                    const rKey=dish.fEvId+"_"+dish.fIdx+"_"+si;
                                    const rm=storeRemarks[rKey]||{};
                                    if(!rm.rating&&!rm.text) return null;
                                    const RATING_COLORS={excellent:"#22C55E",good:C.green,average:C.amber,poor:C.red,missing:"#F97316"};
                                    const RATING_LABELS={excellent:"🌟 Excellent",good:"✅ Good",average:"🟡 Average",poor:"🔴 Poor Quality",missing:"⚠️ Items Missing"};
                                    return(
                                      <div style={{background:C.surface,borderRadius:10,padding:"8px 12px",marginTop:6,border:`1px solid ${C.border}`}}>
                                        {rm.rating&&<span style={{fontSize:11,fontWeight:700,color:RATING_COLORS[rm.rating]||C.muted,marginRight:8}}>{RATING_LABELS[rm.rating]||rm.rating}</span>}
                                        {rm.text&&<span style={{fontSize:11,color:C.muted}}>— {rm.text}</span>}
                                      </div>
                                    );
                                  })()}
                                </div>}
                              </div>
                            ):(
                              <div>
                                {tm5>0&&<div style={{marginTop:6}}><div style={{height:8,background:C.border,borderRadius:3,overflow:"hidden",marginBottom:3}}><div style={{height:"100%",width:pct4+"%",background:done3?C.green:C.amber,borderRadius:3,transition:"width .5s"}}/></div><div style={{fontSize:11,color:running3?C.amber:done3?C.green:C.muted}}>{running3?`⏱ ${fmtT(el5)} / ${fmtT(tm5)} — ${fmtT(rem3)} ${T2("left")}`:done3?`✓ ${fmtT(tm5)}`:`⏱ ${fmtT(tm5)}`}</div></div>}
                                {!running3&&!done3&&tm5>0&&prevOk3&&<button onClick={e=>{e.stopPropagation();startStep(dish.fEvId,dish.fIdx,si,tm5);}} style={{marginTop:6,padding:"8px 16px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>▶ {T2("Start")} — {fmtT(tm5)}</button>}
                                {!running3&&!done3&&!tm5&&prevOk3&&!step.live&&<button onClick={e=>{e.stopPropagation();markManual(dish.fEvId,dish.fIdx,si);}} style={{marginTop:6,padding:"8px 16px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>✓ {T2("Mark Done")}</button>}
                                {!running3&&!done3&&!prevOk3&&<div style={{marginTop:4,fontSize:11,color:C.faint}}>⏸ {T2("Previous step must finish first")}</div>}
                              </div>
                            )}
                          </div>
                        </div>);
                      })}

                      {/* Mark as Complete */}
                      {steps3.every((_,si)=>stepDone(d3,si))&&!d3.ready&&(
                        <button onClick={e=>{e.stopPropagation();markReady(dish.fEvId,dish.fIdx,dish.name);}}
                          style={{width:"100%",padding:"16px",borderRadius:12,background:`linear-gradient(135deg,${C.green},#2A7A4A)`,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",marginTop:10,minHeight:52}}>
                          ✅ {T2("Mark as Complete")} — {dish.name}
                        </button>
                      )}

                      {/* Ready for Dispatch — per function that needs delivery */}
                      {d3.ready&&(
                        <div style={{marginTop:10}}>
                          {dish.fns.map((fn,fi)=>{
                            const needsDispatch=!/pushpanjali|exotica/i.test(fn.v);
                            const dKey=`dish_dispatch_${dish.fEvId}_${dish.fIdx}_${fn.evId}`;
                            const dispatched=!!d3[dKey];
                            if(!needsDispatch) return (
                              <div key={fi} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,marginBottom:4}}>
                                <span style={{fontSize:12,color:C.green}}>✅ {fn.g} — {fn.v} ({fn.p} {T2("pax")}) · {T2("In-house — no dispatch needed")}</span>
                              </div>
                            );
                            return (
                              <div key={fi} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:dispatched?C.greenBg:C.surface,border:`1px solid ${dispatched?C.greenBorder:C.amberBorder}`,borderRadius:10,marginBottom:4}}>
                                <div>
                                  <div style={{fontSize:12,fontWeight:600,color:C.text}}>{fn.g} — {fn.v}</div>
                                  <div style={{fontSize:11,color:C.muted}}>{fn.p} {T2("pax")} · {T2("Needs dispatch to venue")}</div>
                                </div>
                                {dispatched?
                                  <span style={{fontSize:11,color:C.green,fontWeight:700}}>🚛 ✅ {T2("Dispatched")}</span>:
                                  <button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{[dKey]:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})});}}
                                    style={{padding:"10px 18px",borderRadius:10,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:44}}>
                                    🚛 {T2("Ready for Dispatch")}
                                  </button>
                                }
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>)}
                  </div>);})}</div>}
              </Card>);
            })}
            {/* Dispatch per event */}
            {allDishesReady&&(<div style={{marginTop:12}}>
              <div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:8}}>🚛 {T2("Dispatch by function")}</div>
              {evs.map(ev=>{const dispatched=!!(kt[ev.id]?.__dispatch_ready);return(
                <div key={ev.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:dispatched?C.greenBg:C.surface,border:`1px solid ${dispatched?C.greenBorder:C.border}`,borderRadius:10,marginBottom:6}}>
                  <div><div style={{fontSize:13,fontWeight:600,color:C.text}}>{ev.guest}</div><div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")}</div></div>
                  {dispatched?<span style={{fontSize:11,color:C.green,fontWeight:700}}>🚛 {kt[ev.id]?.__dispatch_time}</span>:<button onClick={()=>markDispatch(ev.id)} style={{padding:"8px 16px",borderRadius:10,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>🚛 {T2("Dispatch")}</button>}
                </div>);
              })}
            </div>)}
          </div>
        );
      })()}
      {tab==="d1"&&(()=>{
        // D-1 logic: if today has an event, prep for DAY_AFTER. If no event today, prep for TOMORROW.
        // Section 1: Continuation of today's D-1 = tomorrowEvs (event day cooking)
        // Section 2: New D-1 prep = dayAfterEvs (advance prep for day-after)
        const continuationEvs = hasTodayEvs ? todayEvs : tomorrowEvs;
        const newD1Evs = hasTodayEvs
          ? evList.filter(e=>e.date===DAY_AFTER)
          : evList.filter(e=>e.date===DAY_AFTER);
        const d1ForLabel = hasTodayEvs ? dayAfterLabel : dayAfterLabel;
        const contLabel = hasTodayEvs ? todayLabel2 : tomorrowLabel;
        const newD1Label = dayAfterLabel;

        // Build dishes for Section 1 (continuation - final cooking)
        const byDishCont={};
        continuationEvs.forEach(ev=>{
          const sp=ev.special||"";
          const isSpecial=/no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
          safeArr(ev.menu).forEach((name,idx)=>{
            if(guessSectionForDish(name)==="Beverages") return;
            if(!byDishCont[name])byDishCont[name]={sec:guessSectionForDish(name),totalPax:0,fns:[],fEvId:ev.id,fIdx:idx,specials:[]};
            byDishCont[name].totalPax+=ev.pax||0;
            byDishCont[name].fns.push({evId:ev.id,g:ev.guest,v:ev.venue,p:ev.pax,idx,special:sp,isSpecial});
            if(isSpecial)byDishCont[name].specials.push({guest:ev.guest,pax:ev.pax,instruction:sp});
          });
        });

        // Build dishes for Section 2 (new D-1 prep)
        const byDishNew={};
        newD1Evs.forEach(ev=>{
          const sp=ev.special||"";
          const isSpecial=/no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
          safeArr(ev.menu).forEach((name,idx)=>{
            if(guessSectionForDish(name)==="Beverages") return;
            if(!byDishNew[name])byDishNew[name]={sec:guessSectionForDish(name),totalPax:0,fns:[],fEvId:ev.id,fIdx:idx,specials:[]};
            byDishNew[name].totalPax+=ev.pax||0;
            byDishNew[name].fns.push({evId:ev.id,g:ev.guest,v:ev.venue,p:ev.pax,idx,special:sp,isSpecial});
            if(isSpecial) byDishNew[name].specials.push({guest:ev.guest,pax:ev.pax,instruction:sp});
          });
        });
        const bySecCont={};Object.entries(byDishCont).forEach(([n,info])=>{if(!bySecCont[info.sec])bySecCont[info.sec]=[];bySecCont[info.sec].push({name:n,...info});});
        const bySecNew={};Object.entries(byDishNew).forEach(([n,info])=>{if(!bySecNew[info.sec])bySecNew[info.sec]=[];bySecNew[info.sec].push({name:n,...info});});
        const secKeysCont=Object.keys(bySecCont).sort();
        const secKeysNew=Object.keys(bySecNew).sort();
        // ── Merge dishes from both sources by section ──
        const allSecs = [...new Set([
          ...Object.keys(bySecCont),
          ...Object.keys(bySecNew)
        ])].sort();

        const totalContDone = Object.values(byDishCont).filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length;
        const totalNewDone  = Object.values(byDishNew).filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length;
        const totalCont = Object.keys(byDishCont).length;
        const totalNew  = Object.keys(byDishNew).length;

        return(
          <div>
            {/* ── Header strip ── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.amber,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>🔥 {T2("Continue")} {todayLabel2} D-1</div>
                <div style={{fontSize:20,fontWeight:800,color:C.amber,lineHeight:1}}>{contPax} <span style={{fontSize:11,fontWeight:400}}>pax</span></div>
                <div style={{fontSize:11,color:C.muted,marginTop:3}}>{totalContDone}/{totalCont} {T2("dishes done")}</div>
                <div style={{height:4,background:C.border,borderRadius:2,marginTop:6,overflow:"hidden"}}><div style={{height:"100%",width:totalCont>0?Math.round(totalContDone/totalCont*100)+"%":"0%",background:C.amber,borderRadius:2}}/></div>
              </div>
              <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.gold,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>📋 D-1 {T2("for")} {dayAfterLabel}</div>
                <div style={{fontSize:20,fontWeight:800,color:C.gold,lineHeight:1}}>{newD1Pax||"—"} <span style={{fontSize:11,fontWeight:400}}>pax</span></div>
                <div style={{fontSize:11,color:C.muted,marginTop:3}}>{totalNewDone}/{totalNew} {T2("dishes done")}</div>
                <div style={{height:4,background:C.border,borderRadius:2,marginTop:6,overflow:"hidden"}}><div style={{height:"100%",width:totalNew>0?Math.round(totalNewDone/totalNew*100)+"%":"0%",background:C.gold,borderRadius:2}}/></div>
              </div>
            </div>

            {/* ── 3-column header: Cont D-1 | D-1 New | Collective ── */}
            {(()=>{
              const totalCollectivePax=(contPax||0)+(newD1Pax||0);
              const totalCollDone=totalContDone+totalNewDone;
              const totalColl=totalCont+totalNew;
              return(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
                  {[
                    {label:`🔥 ${T2("Continue")} ${todayLabel2} D-1`,pax:contPax,done:totalContDone,total:totalCont,c:C.amber,bg:C.amberBg,bdr:C.amberBorder,view:"cont"},
                    {label:`📋 D-1 ${T2("for")} ${dayAfterLabel}`,pax:newD1Pax,done:totalNewDone,total:totalNew,c:C.gold,bg:C.goldBg,bdr:C.goldBorder,view:"new"},
                    {label:`📦 ${T2("Collective")}`,pax:totalCollectivePax,done:totalCollDone,total:totalColl,c:C.blue,bg:C.blueBg,bdr:C.blueBorder,view:"all"},
                  ].map(h=>{
                    const pct=h.total>0?Math.round(h.done/h.total*100):0;
                    const isSel=d1View===h.view;
                    return(
                      <div key={h.view} onClick={()=>setD1View(h.view)}
                        style={{background:isSel?h.bg:"transparent",border:`2px solid ${isSel?h.c:C.border}`,borderRadius:12,padding:"12px 10px",cursor:"pointer",transition:"all .2s"}}>
                        <div style={{fontSize:9,fontWeight:700,color:isSel?h.c:C.faint,textTransform:"uppercase",letterSpacing:.8,marginBottom:4,lineHeight:1.3}}>{h.label}</div>
                        <div style={{fontSize:20,fontWeight:800,color:isSel?h.c:C.muted,lineHeight:1}}>{h.pax||"—"} <span style={{fontSize:10,fontWeight:400}}>pax</span></div>
                        <div style={{fontSize:10,color:isSel?h.c:C.faint,marginTop:3}}>{h.done}/{h.total} done</div>
                        <div style={{height:3,background:C.border,borderRadius:2,marginTop:5,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:isSel?h.c:C.border,borderRadius:2,transition:"width .3s"}}/></div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── Filter info ── */}
            {d1View!=="all"&&<div style={{fontSize:11,color:C.muted,marginBottom:10,padding:"6px 12px",background:C.darkCard,borderRadius:8,border:`1px solid ${C.border}`}}>
              {d1View==="cont"?`🔥 ${T2("Showing")} ${tomorrowLabel} ${T2("function dishes only")}`:
                               `📋 ${T2("Showing")} ${dayAfterLabel} ${T2("function dishes only")}`}
              &nbsp;<span style={{color:C.gold,cursor:"pointer",fontWeight:700}} onClick={()=>setD1View("all")}>→ {T2("Show all")}</span>
            </div>}

            {/* ── Section-wise view ── */}
            {allSecs.map(sec=>{
              const contItems = bySecCont[sec]||[];
              const newItems  = bySecNew[sec]||[];
              const m2 = SECTION_META[sec]||{color:C.muted,icon:"🍽"};
              const secOpen = isSecOpen("d1sec_"+sec);

              // Filter dish names based on selected view
              const activeDishNames = d1View==="cont" ? contItems.map(d=>d.name)
                                    : d1View==="new"  ? newItems.map(d=>d.name)
                                    : [...new Set([...contItems.map(d=>d.name),...newItems.map(d=>d.name)])];
              const allDishNames = [...new Set(activeDishNames)];

              if(allDishNames.length===0) return null;

              // Progress counts for header — based on active view only
              const activeContItems = d1View!=="new" ? contItems : [];
              const activeNewItems  = d1View!=="cont" ? newItems  : [];
              const doneCount = [...activeContItems,...activeNewItems].filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length;
              const totalCount = allDishNames.length;

              return(
                <Card key={sec} style={{marginBottom:10,padding:0,overflow:"hidden"}}>
                  {/* Section header */}
                  <div onClick={()=>toggleSec("d1sec_"+sec)} style={{padding:"12px 16px",background:m2.color+"12",cursor:"pointer",borderBottom:secOpen?`1px solid ${C.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:14,fontWeight:700,color:m2.color}}>{m2.icon} {T2(sec)}</span>
                      <span style={{fontSize:11,color:C.muted}}>{allDishNames.length} {T2("dishes")}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {d1View!=="new"&&<span style={{fontSize:11,color:C.amber}}>{contItems.filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length}/{contItems.length}</span>}
                      {d1View==="all"&&<span style={{fontSize:11,color:C.faint}}>|</span>}
                      {d1View!=="cont"&&<span style={{fontSize:11,color:C.gold}}>{newItems.filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length}/{newItems.length}</span>}
                      <span style={{fontSize:11,color:C.gold}}>{newItems.filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length}/{newItems.length}</span>
                      <span style={{fontSize:13,color:C.muted,transform:secOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                    </div>
                  </div>

                  {secOpen&&<div style={{padding:"8px 12px"}}>
                    {allDishNames.map(dishName=>{
                      const cDish = contItems.find(d=>d.name===dishName);
                      const nDish = newItems.find(d=>d.name===dishName);
                      const inBoth = cDish && nDish;
                      const cKey = `d1dish_${dishName.replace(/\s/g,"_")}`;
                      const isExp = expandedDish===cKey;

                      // Get steps for this dish
                      const allStepsFn = getStepsForDish(dishName);
                      const steps = allStepsFn.length>0?allStepsFn:[{t:"Mesa",i:"Wash, cut, measure all ingredients",tm:600},{t:"Primary prep",i:"Prepare base masala / paste",tm:480}];

                      const cDone = cDish ? !!ds(cDish.fEvId,cDish.fIdx).mesaDone : null;
                      const nDone = nDish ? !!ds(nDish.fEvId,nDish.fIdx).mesaDone : null;

                      return(
                        <div key={dishName} style={{marginBottom:6}}>
                          {/* Dish row — side by side pax */}
                          <div onClick={()=>setExpandedDish(isExp?null:cKey)} style={{cursor:"pointer",borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                            {/* Top: dish name */}
                            <div style={{padding:"9px 14px",background:C.darkCard,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <div style={{fontSize:12,fontWeight:700,color:C.text}}>{dishName}</div>
                              <span style={{fontSize:13,color:C.muted,transform:isExp?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                            </div>
                            {/* Side-by-side pax columns — only show relevant columns */}
                            <div style={{display:"grid",gridTemplateColumns:d1View==="all"?"1fr 1fr":d1View==="cont"?"1fr":"1fr",gap:0}}>
                              {/* Left: Continue D-1 — only if view is cont or all */}
                              {d1View!=="new"&&(
                              <div style={{padding:"8px 12px",background:cDish?C.amberBg+"40":"transparent",borderRight:d1View==="all"?`1px solid ${C.border}`:"none"}}>
                                {cDish?(
                                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                                    <div style={{width:18,height:18,borderRadius:5,background:cDone?C.green:C.amber,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                      {cDone&&<span style={{fontSize:9,fontWeight:700,color:"#0A0A0F"}}>✓</span>}
                                    </div>
                                    <div>
                                      <div style={{fontSize:11,fontWeight:700,color:cDone?C.green:C.amber}}>{cDish.totalPax} pax</div>
                                      <div style={{fontSize:9,color:C.faint}}>{tomorrowLabel}</div>
                                    </div>
                                  </div>
                                ):<div style={{fontSize:10,color:C.faint}}>—</div>}
                              </div>
                              )}
                              {/* Right: New D-1 — only if view is new or all */}
                              {d1View!=="cont"&&(
                              <div style={{padding:"8px 12px",background:nDish?C.goldBg+"40":"transparent"}}>
                                {nDish?(
                                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                                    <div style={{width:18,height:18,borderRadius:5,background:nDone?C.green:C.gold,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                      {nDone&&<span style={{fontSize:9,fontWeight:700,color:"#0A0A0F"}}>✓</span>}
                                    </div>
                                    <div>
                                      <div style={{fontSize:11,fontWeight:700,color:nDone?C.green:C.gold}}>{nDish.totalPax} pax</div>
                                      <div style={{fontSize:9,color:C.faint}}>{dayAfterLabel}</div>
                                    </div>
                                  </div>
                                ):<div style={{fontSize:10,color:C.faint}}>—</div>}
                              </div>
                              )}
                            </div>
                            {/* Collective row if in both */}
                            {inBoth&&<div style={{padding:"6px 12px",background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <span style={{fontSize:10,color:C.muted}}>📦 {T2("Collective")}</span>
                              <span style={{fontSize:11,fontWeight:700,color:C.text}}>{(cDish.totalPax||0)+(nDish.totalPax||0)} pax {T2("total")}</span>
                            </div>}
                          </div>

                          {/* Expanded steps */}
                          {isExp&&(
                            <div style={{padding:"8px 12px",borderRadius:"0 0 10px 10px",background:C.surface,border:`1px solid ${C.border}`,borderTop:"none"}}>
                              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>📋 {T2("Steps")} — {steps.length}</div>
                              {steps.map((step,si)=>{
                                // Use cDish tracking if available, else nDish
                                const trackDish = cDish||nDish;
                                const d2 = trackDish?ds(trackDish.fEvId,trackDish.fIdx):{};
                                const done = !!(d2.manual?.[`mesa_${si}`])||(d2.starts?.[`mesa_${si}`]&&step.tm&&Math.floor((Date.now()-(d2.starts[`mesa_${si}`]||0))/1000)>=step.tm);
                                const isD1s = /mesa|masala|prep|mix|shap|boil|soak|marin|grind|batter|dough|cut|chop|blanch|peel/i.test(step.t||"");
                                return(
                                  <div key={si} style={{display:"flex",gap:8,padding:"7px 0",borderBottom:si<steps.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"center"}}>
                                    <div style={{width:24,height:24,borderRadius:6,background:done?C.green:isD1s?C.amber:C.darkCard,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:done?"#0A0A0F":C.muted,flexShrink:0}}>{done?"✓":si+1}</div>
                                    <div style={{flex:1}}>
                                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                                        <span style={{fontSize:12,fontWeight:600,color:done?C.green:C.text}}>{step.t}</span>
                                        {isD1s&&!done&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:C.amberBg,color:C.amber,border:`1px solid ${C.amberBorder}`}}>D-1</span>}
                                      </div>
                                      {(step.i||step.desc)&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{step.i||step.desc}</div>}
                                      {step.ccp&&<div style={{fontSize:10,color:C.red,marginTop:2}}>🔴 {step.ccp}</div>}
                                      {step.tm&&<div style={{fontSize:10,color:C.amber}}>⏱ {fmtT(step.tm)}</div>}
                                    </div>
                                    {!done&&trackDish&&<button onClick={e=>{e.stopPropagation();setDs(trackDish.fEvId,trackDish.fIdx,{manual:{...(ds(trackDish.fEvId,trackDish.fIdx).manual||{}),[`mesa_${si}`]:true}});}} style={{padding:"5px 10px",borderRadius:7,background:C.gold,color:"#0A0908",border:"none",fontSize:10,fontWeight:600,cursor:"pointer",minHeight:32}}>✓</button>}
                                  </div>
                                );
                              })}
                              {/* Mark all done buttons — only for active view */}
                              <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                                {d1View!=="new"&&cDish&&!cDone&&<button onClick={e=>{e.stopPropagation();setDs(cDish.fEvId,cDish.fIdx,{mesaDone:true});}} style={{flex:1,padding:"8px",borderRadius:8,background:`linear-gradient(135deg,${C.amber},#A05010)`,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:36}}>✅ {tomorrowLabel} — {cDish.totalPax} pax</button>}
                                {d1View!=="cont"&&nDish&&!nDone&&<button onClick={e=>{e.stopPropagation();setDs(nDish.fEvId,nDish.fIdx,{mesaDone:true});}} style={{flex:1,padding:"8px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:36}}>✅ {dayAfterLabel} — {nDish.totalPax} pax</button>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>}
                </Card>
              );
            })}

            {allSecs.length===0&&<Card style={{padding:"24px",textAlign:"center"}}><div style={{fontSize:12,color:C.muted}}>{T2("No dishes to prep")}</div></Card>}
          </div>
        );
      })()}

      {/* ═══ PAX SCALING LOGIC PANEL ═══ */}
      {tab==="scale"&&(()=>{
        const MENU_APPLICABILITY={
          "Magnum Veg":           {code:"MVM",  ranges:[{min:50,max:250}],label:"50–250 pax",  color:"#3EAA68",type:"Veg"},
          "Magnum Non-Veg":       {code:"MNVM", ranges:[{min:50,max:250}],label:"50–250 pax",  color:"#3EAA68",type:"Non-Veg"},
          "Double Magnum Veg":    {code:"DMVM", ranges:[{min:100,max:250}],label:"100–250 pax", color:"#5B8FD0",type:"Veg"},
          "Double Magnum Non-Veg":{code:"DMNVM",ranges:[{min:100,max:250}],label:"100–250 pax", color:"#5B8FD0",type:"Non-Veg"},
          "Multi-Cuisine Veg":    {code:"MCVM", ranges:[{min:250,max:9999}],label:"250+ pax",  color:"#D4B44A",type:"Veg"},
          "Multi-Cuisine Non-Veg":{code:"MCNVM",ranges:[{min:250,max:9999}],label:"250+ pax",  color:"#D4B44A",type:"Non-Veg"},
          "Luxury Veg":           {code:"LVM",  ranges:[{min:300,max:9999}],label:"300+ pax",  color:"#C084FC",type:"Veg"},
          "Luxury Non-Veg":       {code:"LNVM", ranges:[{min:300,max:9999}],label:"300+ pax",  color:"#C084FC",type:"Non-Veg"},
        };
        const PAX_BANDS=[{v:100},{v:200},{v:250},{v:300},{v:400},{v:500},{v:600},{v:700},{v:800},{v:900},{v:1000},{v:1100}];
        const PAX_COLS=[100,200,300,400,500,600,700,800,900,1000,1100];
        const BASE_PAX=1100;
        function isApplicable(pkg,pax){const m=MENU_APPLICABILITY[pkg];return m?m.ranges.some(r=>pax>=r.min&&pax<=r.max):false;}
        function fmtScaled(q,u,pax,pct){
          if(!q||q===0) return "—";
          const raw=q*pax*(( pct||100)/100);
          if(u==="g") return raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" kg":Math.round(raw)+" g";
          if(u==="ml") return raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" ml";
          if(u==="pcs") return Math.ceil(raw)+" pcs";
          return Math.round(raw)+" "+u;
        }

        // Effective % from selected event or manual
        const allEvs=[...todayEvs,...tomorrowEvs,...evList.filter(e=>e.date===DAY_AFTER)];
        const linkedEv = scaleEventId!=="manual" ? allEvs.find(e=>e.id===scaleEventId) : null;
        const autoPercent = linkedEv ? Math.round((+linkedEv.pax/BASE_PAX)*100) : null;
        const effectivePct = scaleEventId==="manual" ? (scalePercent||100) : (autoPercent||100);
        const pctLabel = scaleEventId==="manual" ? `${effectivePct}%` : `${effectivePct}% (auto from ${linkedEv?.guest||""} · ${linkedEv?.pax||0} pax)`;

        const mode=scaleMode||"single";
        const pkgNames=Object.keys(MENU_PACKAGES);
        const selPkg=scalePkg||pkgNames[0];
        const pkgDishes=(MENU_PACKAGES[selPkg]||[]).filter(d=>RECIPE_INGREDIENTS[d]);
        const multiSel=scaleMultiSel||{};
        const activeDishes=mode==="single"?(scaleDish&&RECIPE_INGREDIENTS[scaleDish]?[scaleDish]:[]):mode==="multi"?Object.keys(multiSel).filter(d=>multiSel[d]):pkgDishes;

        return(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>⚖️ {T2("Pax Scaling")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:14}}>{T2("Menu applicability matrix + ingredient quantities. Base: 1100 pax")} <span style={{color:"#FF6B35"}}>★</span></div>

            {/* ── % SCALING CONTROL PANEL ── */}
            <Card style={{marginBottom:16,padding:"16px 18px",border:`1px solid ${C.goldBorder}`,background:C.goldBg}}>
              <div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:10}}>📐 {T2("Scaling Control")}</div>

              {/* Source: Event or Manual */}
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>{T2("Scale based on")}</div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                <button onClick={()=>setScaleEventId("manual")} style={{padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:scaleEventId==="manual"?700:400,cursor:"pointer",background:scaleEventId==="manual"?C.gold:C.surface,color:scaleEventId==="manual"?"#0A0908":C.muted,border:`1.5px solid ${scaleEventId==="manual"?C.gold:C.border}`,minHeight:38}}>
                  ✏️ {T2("Manual %")}
                </button>
                {allEvs.map(ev=>{
                  const autoPct=Math.round((+ev.pax/BASE_PAX)*100);
                  const isSel=scaleEventId===ev.id;
                  return(
                    <button key={ev.id} onClick={()=>{setScaleEventId(ev.id);setScalePercent(autoPct);}}
                      style={{padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:isSel?700:400,cursor:"pointer",background:isSel?C.gold:C.surface,color:isSel?"#0A0908":C.muted,border:`1.5px solid ${isSel?C.gold:C.border}`,minHeight:38}}>
                      📅 {ev.guest.split(" ")[0]} · {ev.pax} pax → {autoPct}%
                    </button>
                  );
                })}
              </div>

              {/* % input (only for manual mode) */}
              {scaleEventId==="manual"&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>{T2("Scaling %")}</div>
                  {/* Quick buttons */}
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
                    {[25,50,75,80,100,110,120,125,150].map(p=>(
                      <button key={p} onClick={()=>setScalePercent(p)}
                        style={{padding:"7px 14px",borderRadius:10,fontSize:13,fontWeight:scalePercent===p?800:400,cursor:"pointer",background:scalePercent===p?(p<100?C.amberBg:p>100?C.greenBg:C.goldBg):"transparent",color:scalePercent===p?(p<100?C.amber:p>100?C.green:C.gold):C.muted,border:`1.5px solid ${scalePercent===p?(p<100?C.amber:p>100?C.green:C.gold):C.border}`,minHeight:38}}>
                        {p}%
                      </button>
                    ))}
                    <input type="number" value={scalePercent} onChange={e=>setScalePercent(Math.max(1,Math.min(500,+e.target.value||100)))} min={1} max={500}
                      style={{width:72,padding:"8px 10px",borderRadius:10,border:`1px solid ${C.gold}`,fontSize:14,fontWeight:700,color:C.gold,background:C.bg,textAlign:"center",minHeight:38}}/>
                    <span style={{fontSize:12,color:C.muted}}>%</span>
                  </div>
                  {/* Drag slider */}
                  <div style={{position:"relative",marginTop:4}}>
                    <input type="range" min={10} max={200} step={5} value={Math.min(200,scalePercent)}
                      onChange={e=>setScalePercent(+e.target.value)}
                      style={{width:"100%",accentColor:scalePercent<100?C.amber:scalePercent>100?C.green:C.gold,height:6,cursor:"pointer"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:2,fontSize:9,color:C.faint}}>
                      <span>10%</span><span style={{color:C.gold,fontWeight:700}}>100%</span><span>200%</span>
                    </div>
                    {/* Tick at 100% */}
                    <div style={{position:"absolute",left:"47.4%",top:0,width:2,height:14,background:C.gold+"60",borderRadius:1,pointerEvents:"none"}}/>
                  </div>
                </div>
              )}

              {/* Effective % display */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.bg,borderRadius:10,padding:"10px 14px"}}>
                <div>
                  <div style={{fontSize:11,color:C.muted}}>{T2("Active scaling")}</div>
                  <div style={{fontSize:16,fontWeight:800,color:effectivePct<100?C.amber:effectivePct>100?C.green:C.gold}}>{effectivePct}%</div>
                  {linkedEv&&<div style={{fontSize:11,color:C.muted}}>auto from {linkedEv.guest} · {linkedEv.pax} pax ÷ 1100</div>}
                </div>
                {effectivePct!==100&&activeDishes.length>0&&(
                  <button onClick={()=>{
                    const evId=scaleEventId==="manual"?null:scaleEventId;
                    // Save scaling to appliedScales + kitchenTracking
                    const entry={percent:effectivePct,appliedAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),dishes:activeDishes,eventId:evId,eventName:linkedEv?.guest||"Manual"};
                    setAppliedScales(p=>({...p,[evId||"manual"]:entry}));
                    if(evId&&setKitchenTracking){
                      setKitchenTracking(p=>{const o=p&&typeof p==="object"?{...p}:{};o[evId]={...(o[evId]||{}),__scaling:{percent:effectivePct,dishes:activeDishes,appliedAt:entry.appliedAt}};return o;});
                    }
                  }} style={{padding:"10px 18px",borderRadius:10,background:`linear-gradient(135deg,${C.green},#1A5030)`,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>
                    ✅ {T2("Apply to D-1 & Event Day")}
                  </button>
                )}
                {effectivePct===100&&<div style={{fontSize:11,color:C.faint}}>{T2("100% = SOP quantities (no change)")}</div>}
              </div>

              {/* Applied scaling badges */}
              {Object.values(appliedScales).length>0&&(
                <div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>
                  {Object.values(appliedScales).map((s,i)=>(
                    <div key={i} style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:s.percent<100?C.amberBg:C.greenBg,border:`1px solid ${s.percent<100?C.amberBorder:C.greenBorder}`,color:s.percent<100?C.amber:C.green}}>
                      ✅ {s.eventName} — {s.percent}% · {s.dishes.length} dishes · {s.appliedAt}
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card style={{marginBottom:16,padding:0,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>📊 {T2("Menu Applicability by Pax")}</div>
                <div style={{fontSize:10,color:C.muted}}>✅ {T2("Applicable")} · — {T2("Not recommended")}</div>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",fontSize:11,minWidth:"100%"}}>
                  <thead>
                    <tr style={{background:C.darkCard}}>
                      <th style={{padding:"9px 12px",textAlign:"left",color:C.muted,fontWeight:700,position:"sticky",left:0,background:C.darkCard,borderRight:`1px solid ${C.border}`,minWidth:150}}>{T2("Menu")}</th>
                      <th style={{padding:"9px 8px",textAlign:"center",color:C.muted,fontWeight:600,borderLeft:`1px solid ${C.border}`,minWidth:48}}>Code</th>
                      <th style={{padding:"9px 8px",textAlign:"center",color:C.muted,fontWeight:600,borderLeft:`1px solid ${C.border}`,minWidth:42}}>V/NV</th>
                      {PAX_BANDS.map(b=><th key={b.v} style={{padding:"9px 6px",textAlign:"center",color:C.muted,fontWeight:600,borderLeft:`1px solid ${C.border}`,minWidth:46}}>{b.v}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(MENU_APPLICABILITY).map(([pkg,meta],ri)=>(
                      <tr key={pkg} style={{borderTop:`1px solid ${C.borderLight}`,background:ri%2===0?C.surface:C.darkCard}}>
                        <td style={{padding:"9px 12px",position:"sticky",left:0,background:ri%2===0?C.surface:C.darkCard,borderRight:`1px solid ${C.border}`,fontWeight:600,color:meta.color,fontSize:11}}>{pkg}</td>
                        <td style={{padding:"8px 6px",textAlign:"center",borderLeft:`1px solid ${C.borderLight}`}}>
                          <span style={{fontSize:10,fontWeight:700,color:meta.color,background:meta.color+"15",padding:"2px 7px",borderRadius:6}}>{meta.code}</span>
                        </td>
                        <td style={{padding:"8px 6px",textAlign:"center",borderLeft:`1px solid ${C.borderLight}`}}>
                          <span style={{fontSize:11,color:meta.type==="Veg"?C.green:C.amber}}>{meta.type==="Veg"?"🌿":"🍗"}</span>
                        </td>
                        {PAX_BANDS.map(b=>{
                          const ok=isApplicable(pkg,b.v);
                          return(
                            <td key={b.v} onClick={ok?()=>{setScalePkg(pkg);setScaleMode("bulk");}:undefined}
                              style={{padding:"8px 4px",textAlign:"center",borderLeft:`1px solid ${C.borderLight}`,cursor:ok?"pointer":"default",background:ok?meta.color+"12":"transparent"}}>
                              {ok?<span style={{fontSize:14,color:meta.color}}>✅</span>:<span style={{color:C.faint}}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{padding:"7px 14px",borderTop:`1px solid ${C.border}`,fontSize:10,color:C.muted}}>💡 {T2("Tap any ✅ to load that menu's scaling below")}</div>
            </Card>

            {/* ── Mode selector ── */}
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>⚖️ {T2("Ingredient Scaling")}</div>
            <div style={{display:"flex",gap:0,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`,marginBottom:14}}>
              {[{v:"single",l:"🍽 Single"},{v:"multi",l:"📋 Multiple"},{v:"bulk",l:"📦 Full Menu"}].map(m=>(
                <button key={m.v} onClick={()=>{setScaleMode(m.v);if(m.v==="single")setScaleDish("");if(m.v!=="single")setScaleMultiSel({});}}
                  style={{flex:1,padding:"11px 8px",border:"none",cursor:"pointer",borderLeft:m.v!=="single"?`1px solid ${C.border}`:"none",background:mode===m.v?C.goldBg:"transparent"}}>
                  <div style={{fontSize:12,fontWeight:mode===m.v?700:400,color:mode===m.v?C.gold:C.muted}}>{m.l}</div>
                </button>
              ))}
            </div>

            {mode==="single"&&(
              <select value={scaleDish||""} onChange={e=>setScaleDish(e.target.value)} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:46,marginBottom:14}}>
                <option value="">— {T2("Select a dish")} —</option>
                {pkgNames.map(pkg=>(
                  <optgroup key={pkg} label={"📦 "+pkg+" ("+MENU_APPLICABILITY[pkg]?.code+")"}>
                    {(MENU_PACKAGES[pkg]||[]).filter(d=>RECIPE_INGREDIENTS[d]).map(d=><option key={d} value={d}>{d}</option>)}
                  </optgroup>
                ))}
              </select>
            )}
            {(mode==="multi"||mode==="bulk")&&(
              <div style={{marginBottom:14}}>
                <select value={scalePkg||pkgNames[0]} onChange={e=>{setScalePkg(e.target.value);setScaleMultiSel({});}} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:46,marginBottom:mode==="multi"?8:0}}>
                  {pkgNames.map(p=><option key={p} value={p}>{MENU_APPLICABILITY[p]?.code||p} — {p} · {MENU_APPLICABILITY[p]?.label} · {(MENU_PACKAGES[p]||[]).filter(d=>RECIPE_INGREDIENTS[d]).length} dishes</option>)}
                </select>
                {mode==="multi"&&(
                  <div style={{background:C.darkCard,borderRadius:12,padding:"12px",border:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{fontSize:11,color:C.muted}}>{Object.values(multiSel).filter(Boolean).length} {T2("selected")}</div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setScaleMultiSel(Object.fromEntries(pkgDishes.map(d=>[d,true])))} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold,cursor:"pointer"}}>{T2("All")}</button>
                        <button onClick={()=>setScaleMultiSel({})} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:C.surface,border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer"}}>{T2("Clear")}</button>
                      </div>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {pkgDishes.map(d=><button key={d} onClick={()=>setScaleMultiSel(p=>({...p,[d]:!p[d]}))} style={{padding:"5px 10px",borderRadius:8,fontSize:10,cursor:"pointer",background:multiSel[d]?C.goldBg:C.surface,border:`1.5px solid ${multiSel[d]?C.gold:C.border}`,color:multiSel[d]?C.gold:C.muted,fontWeight:multiSel[d]?700:400}}>{multiSel[d]?"✓ ":""}{d}</button>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Scaling tables ── */}
            {activeDishes.map(dish=>{
              const ingr=RECIPE_INGREDIENTS[dish]||[];
              return(
                <div key={dish} style={{marginBottom:18}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:6,fontFamily:"var(--font-display)",display:"flex",gap:8,alignItems:"center"}}>
                    {dish}
                    {Object.keys(scaleOverrides).some(k=>k.startsWith(dish+"|"))&&<button onClick={()=>setScaleOverrides(p=>{const n={...p};Object.keys(n).filter(k=>k.startsWith(dish+"|")).forEach(k=>delete n[k]);return n;})} style={{fontSize:9,padding:"2px 7px",borderRadius:5,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,cursor:"pointer"}}>↺</button>}
                  </div>
                  <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.border}`}}>
                    <table style={{borderCollapse:"collapse",fontSize:10,minWidth:"100%"}}>
                      <thead>
                        <tr style={{background:C.darkCard}}>
                          <th style={{padding:"8px 10px",textAlign:"left",color:C.muted,position:"sticky",left:0,background:C.darkCard,borderRight:`1px solid ${C.border}`,minWidth:120}}>Ingredient</th>
                          {PAX_COLS.map(p=><th key={p} style={{padding:"8px 6px",textAlign:"center",fontWeight:p===BASE_PAX?800:500,color:p===BASE_PAX?"#FF6B35":C.muted,background:p===BASE_PAX?"#2A0D00":C.darkCard,borderLeft:`1px solid ${C.border}`,minWidth:58,whiteSpace:"nowrap"}}>{p===BASE_PAX?`★${p}`:p}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {ingr.map((ing,ii)=>{
                          const isAcc=!ing.q||ing.q===0;
                          return(
                            <tr key={ii} style={{borderTop:`1px solid ${C.borderLight}`,background:ii%2===0?C.surface:C.darkCard}}>
                              <td style={{padding:"8px 10px",position:"sticky",left:0,background:ii%2===0?C.surface:C.darkCard,borderRight:`1px solid ${C.border}`}}>
                                <div style={{fontWeight:600,color:C.text}}>{ing.n}</div>
                                {ing.h&&<div style={{fontSize:9,color:C.faint}}>{ing.h}</div>}
                                {isAcc&&<div style={{fontSize:9,color:C.amber}}>acc. to taste</div>}
                              </td>
                              {PAX_COLS.map(p=>{
                                const ovKey=`${dish}|${ing.n}|${p}`;
                                const isBase=p===BASE_PAX;
                                const hasOv=scaleOverrides[ovKey]!==undefined;
                                const dv=isAcc?"—":(hasOv?scaleOverrides[ovKey]:fmtScaled(ing.q,ing.u,p,effectivePct));
                                return(
                                  <td key={p} style={{padding:"5px 3px",textAlign:"center",background:isBase?"#2A0D0080":undefined,borderLeft:`1px solid ${C.borderLight}`}}>
                                    {isAcc?<span style={{color:C.faint}}>—</span>:scaleEditing===ovKey
                                      ?<input autoFocus type="text" defaultValue={dv} onBlur={e=>{setScaleOverrides(p2=>({...p2,[ovKey]:e.target.value}));setScaleEditing(null);}} onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape"){setScaleOverrides(p2=>({...p2,[ovKey]:e.target.value}));setScaleEditing(null);}}} style={{width:52,padding:"2px 3px",borderRadius:4,border:`1px solid ${C.gold}`,fontSize:10,color:C.text,background:C.bg,textAlign:"center"}}/>
                                      :<span onClick={()=>setScaleEditing(ovKey)} style={{display:"block",padding:"3px 2px",cursor:"pointer",color:isBase?"#FF6B35":hasOv?C.amber:C.text,fontWeight:isBase?700:hasOv?600:400,minWidth:50,borderRadius:3}}>{dv}</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {activeDishes.length===0&&<Card style={{padding:"24px",textAlign:"center"}}><div style={{fontSize:28,marginBottom:8}}>⚖️</div><div style={{fontSize:13,color:C.muted}}>{mode==="single"?T2("Select a dish above"):mode==="multi"?T2("Select dishes from the package"):T2("Select a menu package")}</div></Card>}
          </div>
        );
      })()}

      {/* ═══ RECIPE SOPs TAB ═══ */}
      {tab==="sops"&&(
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:6}}>📖 {T2("Recipe SOPs")}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>97 {T2("recipes")} · 6 {T2("categories")} · {T2("Procedures in Hindi")}</div>
          <input value={sopSearch} onChange={e=>setSopSearch(e.target.value)} placeholder={T2("Search recipes…")} style={{width:"100%",padding:"12px 16px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.surface,boxSizing:"border-box",marginBottom:16,minHeight:48}}/>
          {!sopRecipe?(
            !sopCat?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
                {safeArr(RECIPE_DB.cats).map(cat=>{const recipes=safeArr(RECIPE_DB.recipes[cat.id]);const f2=sopSearch?recipes.filter(r=>r.n.toLowerCase().includes(sopSearch.toLowerCase())):recipes;if(sopSearch&&f2.length===0)return null;return(
                  <button key={cat.id} onClick={()=>setSopCat(cat.id)} style={{background:C.darkCard,border:`1px solid ${C.border}`,borderRadius:14,padding:"20px 14px",cursor:"pointer",textAlign:"center",minHeight:100}}>
                    <div style={{fontSize:28,marginBottom:6}}>{cat.icon}</div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{T2(cat.name)}</div><div style={{fontSize:11,color:C.muted,marginTop:4}}>{sopSearch?f2.length:recipes.length} {T2("recipes")}</div>
                  </button>);})}
              </div>
            ):(
              <div>
                <button onClick={()=>{setSopCat(null);setSopSearch("");}} style={{padding:"8px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",marginBottom:14,minHeight:40}}>← {T2("All Categories")}</button>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {safeArr(RECIPE_DB.recipes[sopCat]).filter(r=>!sopSearch||r.n.toLowerCase().includes(sopSearch.toLowerCase())).map((recipe,ri)=>(
                    <button key={ri} onClick={()=>setSopRecipe(recipe)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",textAlign:"left",minHeight:60}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>{recipe.n}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>{recipe.sub} · {safeArr(recipe.steps).length} {T2("steps")}</div>
                    </button>))}
                </div>
              </div>
            )
          ):(
            <div>
              <button onClick={()=>setSopRecipe(null)} style={{padding:"8px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",marginBottom:14,minHeight:40}}>← {T2("Back")}</button>
              <Card style={{padding:"20px 24px"}}>
                <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>{sopRecipe.n}</div>
                <div style={{fontSize:12,color:C.gold,marginBottom:16}}>{sopRecipe.sub} · {safeArr(sopRecipe.steps).length} {T2("steps")}</div>
                {safeArr(sopRecipe.steps).map((step,si)=>(
                  <div key={si} style={{display:"flex",gap:14,padding:"14px 0",borderBottom:si<sopRecipe.steps.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"flex-start"}}>
                    <div style={{width:32,height:32,borderRadius:8,background:C.gold+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.gold,flexShrink:0}}>{si+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:3}}>{step.t}</div>
                      <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>{step.i||step.desc||""}</div>
                      {step.tm&&<span style={{fontSize:12,color:C.amber,background:C.amberBg,padding:"5px 10px",borderRadius:8,display:"inline-block",marginTop:6}}>⏱ {fmtT(step.tm)}</span>}
                      {step.ccp&&<span style={{fontSize:12,color:C.red,background:C.redBg,padding:"5px 10px",borderRadius:8,display:"inline-block",marginTop:6,marginLeft:6}}>🔴 CCP: {step.ccp}</span>}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ═══ MENU TAB ═══ */}
      {tab==="menus"&&<MenuPackagesView lang={lang}/>}

    </div>
  );
}
function TransportDispatch({events, kitchenTracking={}, lang="en"}) {
  const T2 = s => T(s, lang||"en");
  const safeEvs = Array.isArray(events) ? events : [];
  const kt = kitchenTracking && typeof kitchenTracking === "object" ? kitchenTracking : {};
  const VCOL = {dry:"#C07010", cold:"#185FA5", quick:"#2B8A50"};

  function buildChecklist(ev, vehicleId) {
    const v = VEHICLES.find(x=>x.id===vehicleId);
    const menuItems = (ev.menu||[]).map(name=>({
      id:`${name}-menu`.replace(/\s+/g,"-"), name, category:"🍽 Food",
      source: ["Sweets","Chaat"].includes(guessSectionForDish(name))?"AE Kitchen":"AP Kitchen",
      cold: COLD_ITEMS.some(ci=>name.toLowerCase().includes(ci.toLowerCase())), checked:false,
    }));
    if(v?.type==="cold") return [...menuItems.filter(i=>i.cold),{id:"dairy-cold",name:"Dairy & cold items",category:"❄ Cold",source:"AE Kitchen",cold:true,checked:false}];
    if(v?.type==="dry")  return [...menuItems.filter(i=>!i.cold),
      {id:"chafing",name:"Chafing dishes + stands",category:"🔧 Equipment",source:"AP Kitchen",cold:false,checked:false},
      {id:"fuel",   name:"Fuel cans / sterno",      category:"🔧 Equipment",source:"AP Kitchen",cold:false,checked:false},
      {id:"crockery",name:"Crockery & cutlery",     category:"🍽 Crockery", source:"AP Kitchen",cold:false,checked:false},
    ];
    return menuItems;
  }

  function autoVehicles(ev){
    const menu=safeArr(ev.menu);
    const hasCold=menu.some(d=>COLD_ITEMS.some(ci=>d.toLowerCase().includes(ci.toLowerCase())));
    const pax=+ev.pax||0;
    const vids=[];
    vids.push("DL1LAJ1250");
    if(hasCold) vids.push("DL1LAN2125");
    if(pax>400) vids.push("DL1LAN1814");
    return vids;
  }

  function makeManifest(ev,vid){
    const menu=safeArr(ev.menu);
    const v=VEHICLES.find(x=>x.id===vid);
    if(v?.type==="cold") return menu.filter(d=>COLD_ITEMS.some(ci=>d.toLowerCase().includes(ci.toLowerCase())));
    return menu.filter(d=>!COLD_ITEMS.some(ci=>d.toLowerCase().includes(ci.toLowerCase())));
  }

  const initDispatches = () => safeEvs.map(ev=>({
    evId:ev.id, evGuest:ev.guest, evDate:ev.date, evTime:ev.time, evVenue:ev.venue, menu:ev.menu||[],
    assignments: autoVehicles(ev).map(vid=>({
      vehicleId:vid, driver:"", dispatchTime:calcDispatch(ev.time), status:T2("Planning"),
      manifest:makeManifest(ev,vid), loadingList:buildChecklist(ev,vid),
      unloadingList:buildChecklist(ev,vid).map(i=>({...i,id:"u-"+i.id,checked:false})),
    })),
  }));

  const [dispatches, setDispatches] = useState(initDispatches);
  const [dishLU, setDishLU] = useState({});
  const [selFnId, setSelFnId] = useState(safeEvs[0]?.id||null);
  const [tdSearch, setTdSearch] = useState("");
  const [tdSecOpen, setTdSecOpen] = useState({});
  const [selEvId,    setSelEvId]    = useState(safeEvs[0]?.id||null);
  const [activeTab,  setActiveTab]  = useState("todayplan");
  const [selDate,    setSelDate]    = useState(safeEvs[0]?.date||"");
  const [expandedFn, setExpandedFn] = useState(null); // for load/unload function expand
  const [gps,        setGps]        = useState({
    "DL1LAJ1250":{lat:28.5921,lng:77.0460,status:"At Base",  speed:0, lastUpdate:"Just now"},
    "DL1LAN1814":{lat:28.5910,lng:77.0465,status:"At Base",  speed:0, lastUpdate:"Just now"},
    "DL1LAN2125":{lat:28.5900,lng:77.0490,status:"En Route", speed:28,lastUpdate:"Just now"},
    "DL1LW5357": {lat:28.5895,lng:77.0480,status:"At Base",  speed:0, lastUpdate:"Just now"},
    "DL9CBD3260":{lat:28.5880,lng:77.0520,status:"At Venue", speed:0, lastUpdate:"Just now"},
    "DL9CAR4073":{lat:28.5885,lng:77.0510,status:"At Base",  speed:0, lastUpdate:"Just now"},
    "DL4ERB3958":{lat:28.5870,lng:77.0500,status:"At Base",  speed:0, lastUpdate:"Just now"},
    "DL4ERB4678":{lat:28.5875,lng:77.0505,status:"At Base",  speed:0, lastUpdate:"Just now"},
  });
  const [fleetList,   setFleetList]   = useState(VEHICLES.map(v=>({...v})));
  const [showAddVeh,  setShowAddVeh]  = useState(false);
  const [editVehId,   setEditVehId]   = useState(null);
  const [vehForm,     setVehForm]     = useState({id:"",name:"",icon:"🚛",type:"dry",note:""});
  const [delVehId,    setDelVehId]    = useState(null);
  const [clSrch,      setClSrch]      = useState("");
  const mapIframeRef = useRef(null);

  useEffect(()=>{
    const t=setInterval(()=>{
      setGps(p=>{
        const n={};
        Object.keys(p).forEach(id=>{
          const v=p[id];
          n[id]={...v,
            lat:v.status==="En Route"?v.lat+(Math.random()-.4)*.003:v.lat+(Math.random()-.5)*.0003,
            lng:v.status==="En Route"?v.lng+(Math.random()-.3)*.003:v.lng+(Math.random()-.5)*.0003,
            speed:v.status==="En Route"?Math.round(18+Math.random()*20):0,
            lastUpdate:"Just now",
          };
        });
        return n;
      });
    },4000);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    if(!mapIframeRef.current) return;
    const veh=VEHICLES.map(v=>{const p=gps[v.id]||{lat:28.592,lng:77.047,status:"At Base",speed:0};return{id:v.id,name:v.name,icon:v.icon,lat:p.lat,lng:p.lng,status:p.status,speed:p.speed};});
    try{mapIframeRef.current.contentWindow?.postMessage({type:"vehicles",vehicles:veh},"*");}catch(e){}
  },[gps]);

  function updAsgn(evId,ai,field,val){setDispatches(p=>p.map(d=>d.evId!==evId?d:{...d,assignments:d.assignments.map((a,i)=>i!==ai?a:{...a,[field]:val})}));}
  function toggleCheck(evId,ai,key,idx){setDispatches(p=>p.map(d=>d.evId!==evId?d:{...d,assignments:d.assignments.map((a,i)=>i!==ai?a:{...a,[key]:a[key].map((item,j)=>j!==idx?item:{...item,checked:!item.checked})})}));}
  function addVehicle(evId){
    const ev=safeEvs.find(e=>e.id===evId);
    const used=new Set((dispatches.find(d=>d.evId===evId)?.assignments||[]).map(a=>a.vehicleId));
    const vid=(VEHICLES.find(v=>!used.has(v.id))||VEHICLES[0])?.id;
    if(!vid) return;
    setDispatches(p=>p.map(d=>d.evId!==evId?d:{...d,assignments:[...d.assignments,{vehicleId:vid,driver:"",dispatchTime:calcDispatch(ev?.time||""),status:T2("Planning"),manifest:makeManifest(ev||{},vid),loadingList:buildChecklist(ev||{},vid),unloadingList:buildChecklist(ev||{},vid).map(i=>({...i,id:"u-"+i.id,checked:false}))}]}));
  }

  const allDates  = [...new Set(safeEvs.map(e=>e.date).filter(Boolean))].sort();
  const dayEvs    = safeEvs.filter(e=>e.date===selDate);
  const selDispatch = dispatches.find(d=>d.evId===selEvId)||null;

  const PROP = {
    "Ambria Pushpanjali":{code:"AP",c:"#D4A843",bg:C.goldBg},
    "Ambria Exotica":    {code:"AE",c:"#854F0B",bg:C.goldBg},
    "Manaktala Farm":    {code:"AM",c:"#B05A10",bg:"#1A1610"},
    "Ambria Restro":     {code:"AR",c:"#0F6E56",bg:"#0E1E1A"},
  };
  const gp = v => PROP[v]||{code:"EV",c:C.wine,bg:C.wineBg};

  const venues=[{name:"AP",lat:28.5921,lng:77.0460,color:C.gold},{name:"AE",lat:28.5890,lng:77.0495,color:"#854F0B"},{name:"MKT",lat:28.5960,lng:77.0520,color:"#B05A10"},{name:"AR",lat:28.5902,lng:77.0440,color:"#0F6E56"}];
  const vehForMap=VEHICLES.map(v=>{const p=gps[v.id]||{lat:28.592,lng:77.047,status:"At Base",speed:0};return{id:v.id,name:v.name,icon:v.icon,lat:p.lat,lng:p.lng,status:p.status,speed:p.speed};});
  const mapHtml=`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"><script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><\/script><style>*{margin:0;padding:0;}html,body,#map{width:100%;height:100%;}</style></head><body><div id="map"></div><script>var map=L.map("map",{center:[28.592,77.047],zoom:15});L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap",maxZoom:19}).addTo(map);var venues=${JSON.stringify(venues)};venues.forEach(function(v){L.marker([v.lat,v.lng],{icon:L.divIcon({className:"",html:'<div style="background:'+v.color+';color:#fff;padding:4px 9px;border-radius:7px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid #fff">'+v.name+'<\/div>',iconAnchor:[18,14]})}).addTo(map).bindPopup(v.name);});var SC={"En Route":"#1B5EAB",T2("At Venue"):"#2B8A50","At Base":"#888"};var mk={};function render(vl){vl.forEach(function(v){var col=SC[v.status]||"#888";var lbl=v.icon+" "+v.id.slice(-6)+(v.speed>0?" · "+v.speed+"km/h":"");var html='<div style="background:'+col+';color:#fff;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4);border:1.5px solid #fff">'+lbl+'<\/div>';var ic=L.divIcon({className:"",html:html,iconAnchor:[30,12]});if(mk[v.id]){mk[v.id].setLatLng([v.lat,v.lng]);mk[v.id].setIcon(ic);}else{mk[v.id]=L.marker([v.lat,v.lng],{icon:ic}).addTo(map).bindPopup(v.name+"<br>"+v.status);}});}render(${JSON.stringify(vehForMap)});window.addEventListener("message",function(e){if(e.data&&e.data.type==="vehicles")render(e.data.vehicles);});<\/script></body></html>`;

  const TABS=[{v:"todayplan",l:`📋 ${T2("Today's Plan")}`},{v:"gps",l:`🗺 ${T2("Live Map")}`}];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>🚛 Transport & Dispatch</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>Fleet: {fleetList.length} vehicles · {safeEvs.length} events</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {[{c:"#1B5EAB",l:"En Route"},{c:"#2B8A50",l:T2("At Venue")},{c:"#888",l:"At Base"}].map(s=>(
            <div key={s.l} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"transparent",borderRadius:20,border:`1px solid ${s.c}40`}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:s.c}}/><span style={{fontSize:10,color:s.c,fontWeight:600}}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── KITCHEN DISPATCH NOTIFICATIONS ── */}
      {(()=>{
        const notifications = safeEvs.filter(ev => ev.date===TODAY).map(ev => {
          const evKt = kt[ev.id] || {};
          const dispatched = !!evKt.__dispatch_ready;
          const dispatchTime = evKt.__dispatch_time || "";
          const menu = safeArr(ev.menu);
          let readyCount = 0;
          menu.forEach((name, idx) => {
            const dk = ev.id+"|"+idx;
            if(evKt[dk]?.ready) readyCount++;
          });
          return {ev, dispatched, dispatchTime, readyCount, total: menu.length};
        }).filter(n => n.readyCount > 0);
        if(notifications.length === 0) return null;
        return (
          <div style={{marginBottom:14}}>
            {notifications.map(n => (
              <div key={n.ev.id} style={{background:n.dispatched?C.greenBg:C.amberBg,border:`1.5px solid ${n.dispatched?C.greenBorder:C.amberBorder}`,borderRadius:12,padding:"12px 16px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>{n.dispatched?"🚛":"🍳"}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:n.dispatched?C.green:C.amber}}>
                      {n.dispatched?`${n.ev.guest} — ${T2("Kitchen says: Ready for Dispatch!")}`:`${n.ev.guest} — ${n.readyCount}/${n.total} ${T2("dishes ready from kitchen")}`}
                    </div>
                    <div style={{fontSize:12,color:C.muted}}>{n.ev.venue} · {n.ev.time}{n.dispatchTime?` · ${T2("Notified at")} ${n.dispatchTime}`:""}</div>
                  </div>
                </div>
                <div style={{textAlign:"center",flexShrink:0}}>
                  <div style={{fontSize:18,fontWeight:700,color:n.dispatched?C.green:C.amber}}>{n.readyCount}/{n.total}</div>
                  <div style={{fontSize:12,color:C.muted}}>{T2("ready")}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}       <div style={{display:"flex",gap:6,marginBottom:14,borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>
        {TABS.map(t=>(
          <button key={t.v} onClick={()=>setActiveTab(t.v)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",background:activeTab===t.v?C.wine:"transparent",color:activeTab===t.v?"#fff":C.muted,border:`1.5px solid ${activeTab===t.v?C.wine:C.border}`}}>{t.l}</button>
        ))}
      </div>

      {activeTab==="todayplan"&&(()=>{
        const todayEvs = safeEvs.filter(e=>e.date===TODAY).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
        const tomorrowEvs = safeEvs.filter(e=>e.date===TOMORROW).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
        const laterEvs = safeEvs.filter(e=>e.date>TOMORROW).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
        const allEvs = [...todayEvs,...tomorrowEvs,...laterEvs];

        function isDishReady(evId, dishName, dishIdx){
          // Check both state formats
          const dk2 = kt[evId]?.[`d_${dishIdx}`];
          if(dk2?.ready) return true;
          const dId = evId+"|"+dishIdx;
          const d = (kt[evId]||{})[dId];
          if(!d||!Array.isArray(d.steps)||!d.steps.length) return false;
          return Array.isArray(d.done) && d.done.length >= d.steps.length;
        }
        function isDishDispatched(evId, dishIdx){
          return !!(kt[evId]?.[`d_${dishIdx}`]?.dispatchReady);
        }
        function getDishReadyTime(evId, dishIdx){
          return kt[evId]?.[`d_${dishIdx}`]?.readyAt||"";
        }
        function getDishDispatchTime(evId, dishIdx){
          return kt[evId]?.[`d_${dishIdx}`]?.dispatchAt||"";
        }
        function dishProgress(evId, dishName, dishIdx){
          const dId = evId+"|"+dishIdx;
          const d = (kt[evId]||{})[dId];
          if(!d||!Array.isArray(d.steps)||!d.steps.length) return 0;
          return safePct(Array.isArray(d.done)?d.done.length:0,safeArr(d.steps).length);
        }

        function renderCard(ev, showDate){
          const p = gp(ev.venue);
          const dispatch = dispatches.find(d=>d.evId===ev.id)||{assignments:[]};
          const bySec={};
          (ev.menu||[]).forEach((n,i)=>{const s=guessSectionForDish(n);if(!bySec[s])bySec[s]=[];bySec[s].push({name:n,idx:i});});
          const totalDishes = (ev.menu||[]).length;
          const readyDishes = (ev.menu||[]).filter((n,i)=>isDishReady(ev.id,n,i)).length;
          const readyPct = safePct(readyDishes,totalDishes);
          const allVehicles = dispatch.assignments.map(a=>fleetList.find(v=>v.id===a.vehicleId)||{name:a.vehicleId,icon:"🚛"});

          return (
            <Card style={{marginBottom:14,padding:0,overflow:"hidden",border:`2px solid ${p.c}18`}}>
              {/* Header */}
              <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,background:p.bg}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                      <span style={{fontSize:12,fontWeight:700,padding:"2px 10px",borderRadius:20,background:p.c,color:"#fff"}}>{p.code}</span>
                      <span style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{ev.guest}</span>
                    </div>
                    <div style={{fontSize:11,color:C.muted}}>{ev.venue} · {ev.type}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontWeight:700,color:p.c}}>{ev.time}</div>
                    {showDate&&<div style={{fontSize:12,color:C.muted}}>{ev.date}</div>}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
                  {[
                    {icon:"👥",label:"Pax",value:ev.pax,sub:`V:${ev.veg||ev.pax} NV:${ev.nonveg||0}`},
                    {icon:"📜",label:"Package",value:ev.menuPackage||"Custom"},
                    {icon:"🍽",label:"Dishes",value:`${readyDishes}/${totalDishes} ready`,pct:readyPct},
                    {icon:"🚛",label:"Vehicles",value:`${allVehicles.length} assigned`},
                  ].map((s,i)=>(
                    <div key={i} style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"6px 10px",minWidth:100,flex:"1 1 100px"}}>
                      <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>{s.icon} {s.label}</div>
                      <div style={{fontSize:12,fontWeight:700,color:C.text}}>{s.value}</div>
                      {s.sub&&<div style={{fontSize:11,color:C.muted}}>{s.sub}</div>}
                      {s.pct!==undefined&&(
                        <div style={{height:5,background:C.border,borderRadius:2,marginTop:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${s.pct}%`,background:s.pct===100?C.green:s.pct>50?C.amber:C.red,borderRadius:2,transition:"width .4s"}}/>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Dispatch Plan — editable by Pushpander / Raj Kumar */}
              <div style={{padding:"10px 18px",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>🚛 {T2("Dispatch Plan")}</div>
                  <button onClick={()=>addVehicle(ev.id)} style={{padding:"5px 12px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",minHeight:32}}>+ {T2("Add Vehicle")}</button>
                </div>
                {dispatch.assignments.map((asgn,ai)=>{
                  const v=fleetList.find(x=>x.id===asgn.vehicleId)||{name:asgn.vehicleId,icon:"🚛",type:"dry"};
                  const loadDone=asgn.loadingList.filter(i=>i.checked).length;
                  const loadTot=asgn.loadingList.length;
                  const sc=asgn.status==="Dispatched"||asgn.status==="At Venue"?C.green:asgn.status==="Loaded"?C.amber:C.muted;
                  return (
                    <div key={ai} style={{background:C.bg,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.border}`,marginBottom:6}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:16}}>{v.icon}</span>
                        <select value={asgn.vehicleId} onChange={e=>{
                          setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,vehicleId:e.target.value})}));
                        }} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36}}>
                          {fleetList.map(fv=><option key={fv.id} value={fv.id}>{fv.icon} {fv.name}</option>)}
                        </select>
                        <input value={asgn.driver} placeholder={T2("Driver name")} onChange={e=>{
                          setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,driver:e.target.value})}));
                        }} style={{flex:1,minWidth:120,padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36}}/>
                        <span style={{fontSize:12,fontWeight:700,color:C.gold}}>{asgn.dispatchTime}</span>
                        <button onClick={()=>{setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.filter((_,i2)=>i2!==ai)}));}} style={{padding:"6px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,cursor:"pointer",minHeight:32}}>✕</button>
                      </div>
                      <div style={{display:"flex",gap:10,alignItems:"center",marginTop:6}}>
                        <span style={{fontSize:11,fontWeight:700,color:sc,padding:"2px 8px",borderRadius:8,background:sc+"15"}}>{asgn.status}</span>
                        <span style={{fontSize:11,color:C.muted}}>{loadDone}/{loadTot} {T2("loaded")}</span>
                      </div>
                    </div>
                  );
                })}
                {dispatch.assignments.length===0&&<div style={{fontSize:12,color:C.faint,padding:"8px 0"}}>🚛 {T2("No vehicles assigned yet")} — {T2("Add vehicle to start dispatch plan")}</div>}
                <div style={{fontSize:10,color:C.muted,marginTop:4}}>✏ {T2("Editable by")} Pushpander / Raj Kumar</div>
              </div>

              {/* Menu by Section — kitchen progress */}
              <div style={{padding:"10px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>🍽 {T2("Menu — Kitchen Status")}</span>
                  <div style={{display:"flex",gap:16}}>
                    <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>{T2("Status")}</span>
                    <span style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",minWidth:40,textAlign:"center"}}>📦 {T2("Load")}</span>
                    <span style={{fontSize:10,fontWeight:700,color:"#5B8FD0",textTransform:"uppercase",minWidth:40,textAlign:"center"}}>📤 {T2("Unload")}</span>
                  </div>
                </div>
                <div>
                  {Object.entries(bySec).map(([sec,dishes])=>{
                    const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                    const secReady=dishes.filter(d=>isDishReady(ev.id,d.name,d.idx)).length;
                    return (
                      <div key={sec} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <span style={{fontSize:12,fontWeight:700,color:m.color}}>{m.icon} {T2(sec)}</span>
                          <span style={{fontSize:12,fontWeight:600,color:secReady===dishes.length?C.green:C.muted}}>{secReady}/{dishes.length}</span>
                        </div>
                        {dishes.map((d,di)=>{
                          const ready=isDishReady(ev.id,d.name,d.idx);
                          const dispatched=isDishDispatched(ev.id,d.idx);
                          const readyTime=getDishReadyTime(ev.id,d.idx);
                          const dispatchTime=getDishDispatchTime(ev.id,d.idx);
                          const luKey=ev.id+"_"+d.idx;
                          const lu=dishLU[luKey]||{};
                          const isLoaded=!!lu.loaded;
                          const isUnloaded=!!lu.unloaded;
                          return (
                            <div key={di} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 6px",borderBottom:`1px solid ${C.borderLight}`,background:isUnloaded?C.greenBg+"40":isLoaded?C.amberBg+"20":dispatched?C.greenBg+"60":ready?C.amberBg+"40":"transparent"}}>
                              {/* Kitchen status icon */}
                              <div style={{width:20,height:20,borderRadius:6,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                                background:dispatched?C.green:ready?C.amber:"transparent",
                                border:`2px solid ${dispatched?C.green:ready?C.amber:C.border}`}}>
                                {(ready||dispatched)&&<span style={{color:"#0A0A0F",fontSize:10,fontWeight:700}}>✓</span>}
                              </div>
                              {/* Dish name */}
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:500,color:C.text}}>{d.name}</div>
                              </div>
                              {/* Status badge */}
                              <div style={{flexShrink:0,minWidth:80}}>
                                {dispatched&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.green,color:"#0A0A0F",fontWeight:700}}>🚛 {dispatchTime}</span>}
                                {ready&&!dispatched&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.amber,color:"#0A0A0F",fontWeight:700}}>✅ {readyTime}</span>}
                                {!ready&&!dispatched&&<span style={{fontSize:10,color:C.muted}}>⏳</span>}
                              </div>
                              {/* LOAD checkbox */}
                              <div onClick={(e)=>{e.stopPropagation();setDishLU(p=>({...p,[luKey]:{...(p[luKey]||{}),loaded:!isLoaded}}));}}
                                style={{width:32,height:32,borderRadius:8,border:`2px solid ${isLoaded?C.amber:C.border}`,background:isLoaded?C.amber:"transparent",
                                  display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                                {isLoaded&&<span style={{color:"#0A0A0F",fontSize:14,fontWeight:700}}>✓</span>}
                              </div>
                              {/* UNLOAD checkbox */}
                              <div onClick={(e)=>{e.stopPropagation();if(isLoaded)setDishLU(p=>({...p,[luKey]:{...(p[luKey]||{}),unloaded:!isUnloaded}}));}}
                                style={{width:32,height:32,borderRadius:8,border:`2px solid ${isUnloaded?"#5B8FD0":C.border}`,background:isUnloaded?"#5B8FD0":"transparent",
                                  display:"flex",alignItems:"center",justifyContent:"center",cursor:isLoaded?"pointer":"default",opacity:isLoaded?1:.35,flexShrink:0}}>
                                {isUnloaded&&<span style={{color:"#fff",fontSize:14,fontWeight:700}}>✓</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Special instructions */}
              {ev.special&&(
                <div style={{padding:"8px 18px 12px",borderTop:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.amber}}>⚠ {ev.special}</div>
                </div>
              )}

              {/* Loading / Unloading Checklist */}
              {(()=>{
                const loadKey="load_"+ev.id;
                const ld=dispatches.find(d2=>d2.evId===ev.id);
                if(!ld||ld.assignments.length===0) return null;
                return(
                  <div style={{padding:"10px 18px 14px",borderTop:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8}}>📦 {T2("Loading / Unloading Checklist")}</div>
                    {ld.assignments.map((asgn,ai)=>{
                      const v2=fleetList.find(x=>x.id===asgn.vehicleId)||{name:asgn.vehicleId,icon:"🚛"};
                      const loadDone=asgn.loadingList.filter(i=>i.checked).length;
                      const unloadDone=asgn.unloadingList.filter(i=>i.checked).length;
                      return(
                        <div key={ai} style={{marginBottom:10,background:C.bg,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`}}>
                          <div style={{padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
                            <div style={{display:"flex",gap:8,alignItems:"center"}}>
                              <span style={{fontSize:16}}>{v2.icon}</span>
                              <span style={{fontSize:12,fontWeight:700,color:C.text}}>{v2.name}</span>
                              <span style={{fontSize:11,color:C.gold,fontWeight:600}}>{asgn.dispatchTime}</span>
                            </div>
                            <div style={{display:"flex",gap:8}}>
                              <span style={{fontSize:11,color:loadDone===asgn.loadingList.length?C.green:C.amber}}>📦 {loadDone}/{asgn.loadingList.length}</span>
                              <span style={{fontSize:11,color:unloadDone===asgn.unloadingList.length?C.green:C.muted}}>📤 {unloadDone}/{asgn.unloadingList.length}</span>
                            </div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:40}}>
                            {/* Loading */}
                            <div style={{padding:"8px 10px",borderRight:`1px solid ${C.border}`}}>
                              <div style={{fontSize:10,fontWeight:700,color:C.amber,marginBottom:6}}>📦 {T2("LOADING")}</div>
                              {asgn.loadingList.map((item,li)=>(
                                <div key={li} onClick={()=>{
                                  setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,loadingList:a2.loadingList.map((ll,lli)=>lli!==li?ll:{...ll,checked:!ll.checked})})}));
                                }} style={{display:"flex",gap:6,alignItems:"center",padding:"4px 0",cursor:"pointer"}}>
                                  <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${item.checked?C.green:C.border}`,background:item.checked?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                    {item.checked&&<span style={{color:"#0A0A0F",fontSize:8,fontWeight:700}}>✓</span>}
                                  </div>
                                  <span style={{fontSize:11,color:item.checked?C.green:C.text,textDecoration:item.checked?"line-through":"none"}}>{item.name}</span>
                                </div>
                              ))}
                            </div>
                            {/* Unloading */}
                            <div style={{padding:"8px 10px"}}>
                              <div style={{fontSize:10,fontWeight:700,color:C.blue||"#5B8FD0",marginBottom:6}}>📤 {T2("UNLOADING")}</div>
                              {asgn.unloadingList.map((item,li)=>(
                                <div key={li} onClick={()=>{
                                  setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,unloadingList:a2.unloadingList.map((ll,lli)=>lli!==li?ll:{...ll,checked:!ll.checked})})}));
                                }} style={{display:"flex",gap:6,alignItems:"center",padding:"4px 0",cursor:"pointer"}}>
                                  <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${item.checked?"#5B8FD0":C.border}`,background:item.checked?"#5B8FD0":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                    {item.checked&&<span style={{color:"#fff",fontSize:8,fontWeight:700}}>✓</span>}
                                  </div>
                                  <span style={{fontSize:11,color:item.checked?"#5B8FD0":C.text,textDecoration:item.checked?"line-through":"none"}}>{item.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Card>
          );
        }

        return (
          <div>
            {/* ── Function Dropdown Selector ── */}
            {allEvs.length===0&&<div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,color:C.muted,fontSize:13}}>{T2("No events loaded")}</div>}
            {allEvs.length>0&&(()=>{
              const selEv=allEvs.find(e=>e.id===selFnId)||allEvs[0];
              const p=gp(selEv.venue);
              const menu2=(selEv.menu||[]).filter(d=>guessSectionForDish(d)!=="Beverages");
              const lc=menu2.filter((_,i)=>dishLU[selEv.id+"_"+i]?.loaded).length;
              const uc=menu2.filter((_,i)=>dishLU[selEv.id+"_"+i]?.unloaded).length;
              return(
                <div style={{marginBottom:14}}>
                  {/* Dropdown */}
                  <select value={selFnId||""} onChange={e=>setSelFnId(e.target.value)}
                    style={{width:"100%",padding:"14px 16px",borderRadius:12,border:`2px solid ${p.c}`,fontSize:14,fontWeight:700,color:C.text,background:C.surface,appearance:"auto",cursor:"pointer",minHeight:48,marginBottom:10}}>
                    {allEvs.map(ev=>{
                      const isT=ev.date===TODAY;
                      return <option key={ev.id} value={ev.id}>{isT?"🟢 Today":"📅 "+ev.date} — {ev.guest} · {ev.venue} · {ev.time} · {ev.pax} pax</option>;
                    })}
                  </select>
                  {/* Summary bar */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:p.c+"10",borderRadius:12,border:`1px solid ${p.c}30`}}>
                    <div>
                      <div style={{fontSize:16,fontWeight:700,color:C.text}}>{selEv.guest}</div>
                      <div style={{fontSize:12,color:C.muted}}>📍 {selEv.venue} · ⏰ {selEv.time} · 👥 {selEv.pax} {T2("pax")} · 🚛 {T2("Dispatch")}: {calcDispatch(selEv.time)}</div>
                      {selEv.special&&<div style={{fontSize:12,color:C.amber,marginTop:3}}>⚠ {selEv.special}</div>}
                    </div>
                    <div style={{display:"flex",gap:14,flexShrink:0}}>
                      <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:C.amber}}>{lc}</div><div style={{fontSize:10,color:C.amber}}>📦 {T2("Loaded")}</div></div>
                      <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:"#5B8FD0"}}>{uc}</div><div style={{fontSize:10,color:"#5B8FD0"}}>📤 {T2("Unloaded")}</div></div>
                      <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:C.text}}>{menu2.length}</div><div style={{fontSize:10,color:C.muted}}>{T2("dishes")}</div></div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Selected Function Detail ── */}
            {selFnId&&(()=>{
              const ev=allEvs.find(e=>e.id===selFnId);
              if(!ev) return null;
              const p=gp(ev.venue);
              const menu=(ev.menu||[]).filter(d=>guessSectionForDish(d)!=="Beverages");
              const dispatch=dispatches.find(d=>d.evId===ev.id)||{assignments:[]};

              // Group by section
              const bySec2={};
              menu.forEach((n,i)=>{const s=guessSectionForDish(n);if(!bySec2[s])bySec2[s]=[];bySec2[s].push({name:n,idx:i});});

              // Search filter
              const q=tdSearch.toLowerCase().trim();
              const secKeys2=Object.keys(bySec2).sort();

              return(
                <div>
                  {/* Search box */}
                  <div style={{marginBottom:12}}>
                    <input value={tdSearch} onChange={e=>setTdSearch(e.target.value)} placeholder={`🔍 ${T2("Search dishes…")}`}
                      style={{width:"100%",padding:"12px 16px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:44}}/>
                  </div>

                  {/* Vehicle assignment */}
                  <Card style={{marginBottom:12,padding:"12px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:C.muted}}>🚛 {T2("Vehicles")}</span>
                      <button onClick={()=>addVehicle(ev.id)} style={{padding:"6px 14px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:36}}>+ {T2("Add Vehicle")}</button>
                    </div>
                    {dispatch.assignments.map((asgn,ai)=>{
                      const v=fleetList.find(x=>x.id===asgn.vehicleId)||{name:asgn.vehicleId,icon:"🚛"};
                      return(
                        <div key={ai} style={{display:"flex",gap:8,alignItems:"center",padding:"8px 0",borderBottom:ai<dispatch.assignments.length-1?`1px solid ${C.borderLight}`:"none",flexWrap:"wrap"}}>
                          <span style={{fontSize:18}}>{v.icon}</span>
                          <select value={asgn.vehicleId} onChange={e=>setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,vehicleId:e.target.value})}))}
                            style={{padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36}}>
                            {fleetList.map(fv=><option key={fv.id} value={fv.id}>{fv.icon} {fv.name}</option>)}
                          </select>
                          <input value={asgn.driver} placeholder={T2("Driver name")} onChange={e=>setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,driver:e.target.value})}))}
                            style={{flex:1,minWidth:100,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36}}/>
                          <span style={{fontSize:12,fontWeight:700,color:C.gold}}>{asgn.dispatchTime}</span>
                          <button onClick={()=>setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.filter((_,i2)=>i2!==ai)}))}
                            style={{padding:"6px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,cursor:"pointer",minHeight:36}}>✕</button>
                        </div>
                      );
                    })}
                    {dispatch.assignments.length===0&&<div style={{fontSize:12,color:C.faint,padding:"6px 0"}}>🚛 {T2("No vehicles assigned yet")}</div>}
                    <div style={{fontSize:10,color:C.muted,marginTop:6}}>✏ {T2("Editable by")} Pushpander / Raj Kumar</div>
                  </Card>

                  {/* Section-wise collapsible checklist */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>🍽 {T2("Dishes Checklist")}</span>
                    <div style={{display:"flex",gap:16}}>
                      <span style={{fontSize:10,fontWeight:700,color:C.muted}}>{T2("Status")}</span>
                      <span style={{fontSize:10,fontWeight:700,color:C.amber}}>📦</span>
                      <span style={{fontSize:10,fontWeight:700,color:"#5B8FD0"}}>📤</span>
                    </div>
                  </div>

                  {secKeys2.map(sec=>{
                    const items=bySec2[sec];
                    const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                    const filtered=q?items.filter(d=>d.name.toLowerCase().includes(q)):items;
                    if(filtered.length===0) return null;
                    const secLoaded=filtered.filter(d=>dishLU[ev.id+"_"+d.idx]?.loaded).length;
                    const secUnloaded=filtered.filter(d=>dishLU[ev.id+"_"+d.idx]?.unloaded).length;
                    const secKey="td_"+ev.id+"_"+sec;
                    const secOpen2=tdSecOpen[secKey]!==false;

                    return(
                      <Card key={sec} style={{marginBottom:8,padding:0,overflow:"hidden"}}>
                        <div onClick={()=>setTdSecOpen(p=>({...p,[secKey]:!secOpen2}))}
                          style={{padding:"12px 16px",background:m.color+"10",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",borderBottom:secOpen2?`1px solid ${C.border}`:"none"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:14,fontWeight:700,color:m.color}}>{m.icon} {T2(sec)}</span>
                            <span style={{fontSize:12,color:C.muted}}>{filtered.length} {T2("dishes")}</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:12,color:secLoaded===filtered.length?C.green:C.amber}}>📦 {secLoaded}/{filtered.length}</span>
                            <span style={{fontSize:12,color:secUnloaded===filtered.length?C.green:C.muted}}>📤 {secUnloaded}/{filtered.length}</span>
                            <span style={{fontSize:14,color:C.muted,transform:secOpen2?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                          </div>
                        </div>
                        {secOpen2&&<div style={{padding:"6px 12px"}}>
                          {filtered.map((d,di)=>{
                            const ready=isDishReady(ev.id,d.name,d.idx);
                            const dispatched2=isDishDispatched(ev.id,d.idx);
                            const readyTime=getDishReadyTime(ev.id,d.idx);
                            const dispatchTime=getDishDispatchTime(ev.id,d.idx);
                            const luKey=ev.id+"_"+d.idx;
                            const lu=dishLU[luKey]||{};
                            const isLoaded=!!lu.loaded;
                            const isUnloaded=!!lu.unloaded;
                            return(
                              <div key={di} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 4px",borderBottom:di<filtered.length-1?`1px solid ${C.borderLight}`:"none",background:isUnloaded?C.greenBg+"40":isLoaded?C.amberBg+"20":"transparent"}}>
                                <div style={{width:22,height:22,borderRadius:6,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                                  background:dispatched2?C.green:ready?C.amber:"transparent",border:`2px solid ${dispatched2?C.green:ready?C.amber:C.border}`}}>
                                  {(ready||dispatched2)&&<span style={{color:"#0A0A0F",fontSize:10,fontWeight:700}}>✓</span>}
                                </div>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:13,fontWeight:500,color:C.text}}>{d.name}</div>
                                </div>
                                <div style={{flexShrink:0,minWidth:70}}>
                                  {dispatched2&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.green,color:"#0A0A0F",fontWeight:700}}>🚛 {dispatchTime}</span>}
                                  {ready&&!dispatched2&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.amber,color:"#0A0A0F",fontWeight:700}}>✅ {readyTime}</span>}
                                  {!ready&&!dispatched2&&<span style={{fontSize:10,color:C.muted}}>⏳</span>}
                                </div>
                                <div onClick={(e)=>{e.stopPropagation();setDishLU(p=>({...p,[luKey]:{...(p[luKey]||{}),loaded:!isLoaded}}));}}
                                  style={{width:32,height:32,borderRadius:8,border:`2px solid ${isLoaded?C.amber:C.border}`,background:isLoaded?C.amber:"transparent",
                                    display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                                  {isLoaded&&<span style={{color:"#0A0A0F",fontSize:14,fontWeight:700}}>✓</span>}
                                </div>
                                <div onClick={(e)=>{e.stopPropagation();if(isLoaded)setDishLU(p=>({...p,[luKey]:{...(p[luKey]||{}),unloaded:!isUnloaded}}));}}
                                  style={{width:32,height:32,borderRadius:8,border:`2px solid ${isUnloaded?"#5B8FD0":C.border}`,background:isUnloaded?"#5B8FD0":"transparent",
                                    display:"flex",alignItems:"center",justifyContent:"center",cursor:isLoaded?"pointer":"default",opacity:isLoaded?1:.35,flexShrink:0}}>
                                  {isUnloaded&&<span style={{color:"#fff",fontSize:14,fontWeight:700}}>✓</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>}
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {activeTab==="gps"&&(
        <div>
          <Card style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>🗺 {T2("Live Fleet Map")} — Dwarka, Delhi</div>
              <span style={{fontSize:12,color:C.muted}}>{T2("Real-time tracking")}</span>
            </div>
            <div style={{position:"relative",width:"100%",height:380,background:"#0E1218",overflow:"hidden"}}>
              <svg width="100%" height="100%" style={{position:"absolute",inset:0}}>
                {[0,1,2,3,4,5,6,7,8].map(i=><line key={"h"+i} x1="0" y1={i*47.5} x2="100%" y2={i*47.5} stroke="#1A2030" strokeWidth="1"/>)}
                {[0,1,2,3,4,5,6,7,8,9,10].map(i=><line key={"v"+i} x1={i*10+"%"} y1="0" x2={i*10+"%"} y2="100%" stroke="#1A2030" strokeWidth="1"/>)}
                <path d="M 35% 40% L 20% 65%" stroke="#333" strokeWidth="2" strokeDasharray="6 4" fill="none"/>
                <path d="M 35% 40% L 65% 35%" stroke="#333" strokeWidth="2" strokeDasharray="6 4" fill="none"/>
                <path d="M 65% 35% L 75% 70%" stroke="#333" strokeWidth="2" strokeDasharray="6 4" fill="none"/>
                <path d="M 35% 40% L 75% 70%" stroke="#333" strokeWidth="2" strokeDasharray="6 4" fill="none"/>
              </svg>
              {[{name:"AP",x:35,y:40,color:"#D06040"},{name:"AE",x:65,y:35,color:"#5B8FD0"},{name:"MKT",x:20,y:65,color:"#2B8A50"},{name:"Restro",x:75,y:70,color:"#8A70C8"}].map(v=>(
                <div key={v.name} style={{position:"absolute",left:v.x+"%",top:v.y+"%",transform:"translate(-50%,-50%)"}}>
                  <div style={{width:14,height:14,borderRadius:"50%",background:v.color,border:"3px solid #fff",boxShadow:`0 0 12px ${v.color}80`}}/>
                  <div style={{position:"absolute",top:18,left:"50%",transform:"translateX(-50%)",whiteSpace:"nowrap",fontSize:11,fontWeight:700,color:v.color,textShadow:"0 1px 4px #000"}}>{v.name}</div>
                </div>
              ))}
              {VEHICLES.map((v,vi)=>{
                const g=gps[v.id]||{status:"At Base",speed:0};
                const sc=g.status==="En Route"?"#D4B44A":g.status==="At Venue"?"#2B8A50":"#555";
                const px=g.status==="En Route"?(20+vi*8)%80+10:g.status==="At Venue"?([20,65,75,20][vi%4]):35+vi*4;
                const py=g.status==="En Route"?(30+vi*6)%60+15:g.status==="At Venue"?([65,35,70,65][vi%4]):40+vi*3;
                return(
                  <div key={v.id} style={{position:"absolute",left:px+"%",top:py+"%",transform:"translate(-50%,-100%)",transition:"all 1s ease",zIndex:10}}>
                    <div style={{background:sc,color:"#fff",padding:"4px 8px",borderRadius:12,fontSize:10,fontWeight:700,whiteSpace:"nowrap",boxShadow:`0 2px 8px ${sc}60`,border:"1.5px solid #fff",display:"flex",gap:4,alignItems:"center"}}>
                      <span>{v.icon}</span><span>{v.name.slice(-4)}</span>{g.speed>0&&<span style={{opacity:.8}}>{g.speed}km/h</span>}
                    </div>
                    <div style={{width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:`6px solid ${sc}`,margin:"0 auto"}}/>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:12,padding:"10px 16px",borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
              {[{c:"#D4B44A",l:"En Route"},{c:"#2B8A50",l:"At Venue"},{c:"#555",l:"At Base"}].map(s=>(
                <div key={s.l} style={{display:"flex",gap:4,alignItems:"center"}}><div style={{width:10,height:10,borderRadius:"50%",background:s.c}}/><span style={{fontSize:11,color:C.muted}}>{T2(s.l)}</span></div>
              ))}
              {[{c:"#D06040",l:"AP"},{c:"#5B8FD0",l:"AE"},{c:"#2B8A50",l:"MKT"},{c:"#8A70C8",l:"Restro"}].map(s=>(
                <div key={s.l} style={{display:"flex",gap:4,alignItems:"center"}}><div style={{width:8,height:8,borderRadius:"50%",background:s.c,border:"1.5px solid #fff"}}/><span style={{fontSize:11,color:C.muted}}>{s.l}</span></div>
              ))}
            </div>
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:12}}>
            {VEHICLES.map(v=>{
              const p2=gps[v.id]||{status:"Unknown",speed:0};
              const sc2=p2.status==="En Route"?C.gold:p2.status==="At Venue"?C.green:C.muted;
              return (
                <div key={v.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:18}}>{v.icon}</span>
                    <div style={{fontSize:11,fontWeight:700,color:C.text}}>{v.name}</div>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:sc2}}>{p2.status}</div>
                  {p2.speed>0&&<div style={{fontSize:11,color:C.muted}}>{p2.speed} km/h</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}


    </div>
  );
}

function ODCModule() {
  const [odcs]=useState([{id:`ODC-${CUR_YEAR}-01`,guest:"Malhotra Wedding",date:relDate(4),time:"7:30 PM",pax:800,distance:"12 km",special:"Generator required.",checks:{site:{},equipment:{},dispatch:{},onsite:{},teardown:{}},notes:"",inchargeAE:"Raghvendra"}]);
  const [sel]=useState(`ODC-${CUR_YEAR}-01`);
  const [phase,setPhase]=useState("site");
  const [checks,setChecks]=useState({});
  const [note,setNote]=useState("");
  const odc=odcs.find(o=>o.id===sel);
  const PC={site:C.green,equipment:C.amber,dispatch:C.blue,onsite:C.wine,teardown:C.purple};
  function toggle(ph,id){setChecks(p=>({...p,[`${ph}-${id}`]:!p[`${ph}-${id}`]}));}
  function pct(ph){const items=ODC_CL[ph];return Math.round(items.filter(c=>checks[`${ph}-${c.id}`]).length/items.length*100);}
  const overallPct=Math.round(Object.keys(ODC_CL).reduce((a,ph)=>a+(ODC_CL[ph].filter(c=>checks[`${ph}-${c.id}`]).length),0)/Object.keys(ODC_CL).reduce((a,ph)=>a+ODC_CL[ph].length,0)*100);
  if(!odc) return null;
  return (
    <div>
      <div style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:4,fontFamily:"var(--font-display)"}}>🏕 Outdoor Catering</div>
      <div style={{background:C.wineBg,border:`1.5px solid ${C.wineBorder}`,borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
        <Avatar name="Gopal" size={36} index={0}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.gold}}>Gopal — ODC Lead</div><div style={{fontSize:11,color:C.gold,opacity:.8}}>On ODC day venue rounds suspended.</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:12,color:C.muted}}>AP Anchor</div><div style={{fontSize:12,fontWeight:600,color:C.text}}>Yatender</div></div>
      </div>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
          <div><div style={{fontSize:15,fontWeight:700,color:C.text}}>{odc.guest}</div><div style={{fontSize:11,color:C.muted}}>{odc.date} · {odc.time} · {odc.pax} pax · {odc.distance}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:700,color:C.gold}}>{overallPct}%</div><div style={{fontSize:11,color:C.muted}}>overall</div></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div style={{background:C.wineBg,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:11,color:C.gold,fontWeight:600}}>LEAD</div><div style={{fontSize:12,fontWeight:600,color:C.gold}}>Gopal</div></div>
          <div style={{background:C.amberBg,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:11,color:C.amber,fontWeight:600}}>AE IN-CHARGE</div><div style={{fontSize:12,fontWeight:600,color:C.amber}}>{odc.inchargeAE}</div></div>
        </div>
        <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
          {Object.keys(ODC_CL).map(p=>{const p2=pct(p);const col=PC[p];const active=phase===p;return(
            <button key={p} onClick={()=>setPhase(p)} style={{padding:"6px 12px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",background:active?col:"transparent",color:active?"#fff":C.muted,border:`1.5px solid ${active?col:C.border}`,display:"flex",alignItems:"center",gap:3}}>
              {ODC_PL[p]}<span style={{fontSize:11,padding:"1px 5px",borderRadius:10,background:active?"rgba(255,255,255,.25)":p2===100?C.greenBg:C.bg,color:active?"#fff":p2===100?C.green:C.muted}}>{p2}%</span>
            </button>
          );})}
        </div>
        <div style={{height:8,background:C.border,borderRadius:2,marginBottom:10,overflow:"hidden"}}><div style={{height:"100%",width:`${pct(phase)}%`,background:PC[phase],borderRadius:2,transition:"width .3s"}}/></div>
        {ODC_CL[phase].map(item=>{const done=!!checks[`${phase}-${item.id}`];return(
          <label key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer"}}>
            <input type="checkbox" checked={done} onChange={()=>toggle(phase,item.id)} style={{width:20,height:20,accentColor:PC[phase],cursor:"pointer"}}/>
            <span style={{fontSize:12,color:done?C.muted:C.text,textDecoration:done?"line-through":"none",flex:1}}>{item.label}</span>
            {done&&<Chip label="✓" color={C.green} bg={C.greenBg} size={10}/>}
          </label>
        );})}
        <div style={{marginTop:10}}><div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:4}}>Field notes</div><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Site observations…" style={{width:"100%",padding:"8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,resize:"none",height:60,fontFamily:"inherit",color:C.text,background:C.surface,boxSizing:"border-box"}}/></div>
      </Card>
    </div>
  );
}

// ─── EQUIPMENT & STORE ───────────────────────────────────────────


function StoreModule({events, lang="en"}) {
  const T2 = s => T(s, lang||"en");
  const safeEvs = (Array.isArray(events)?events:[]).filter(e=>e&&e.date);
  const CATEGORIES = [T2("Fresh Vegetables"),T2("Fresh Fruits"),T2("Exotic & Imported"),T2("Poultry, Meat & Fish"),T2("Dairy & Fresh"),T2("Bakery"),T2("Imported Pantry"),T2("Indian Dry Store")];

  const INIT = [
  // 746 real items — Ambria Pushpanjali Store (AP)
    {id:"i1",name:"Hill Potatoes",h:"पहाड़ी आलू",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i2",name:"Hill Red Potatoes",h:"पहाड़ी लाल आलू",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i3",name:"Onion Big",h:"प्याज वडा",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i4",name:"Tomato Salad",h:"सलाद वाला टमाटर",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i5",name:"Tomato Gravy",h:"ग्रेव़ी टमाटर",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i6",name:"Cucumber",h:"ख़ीरा",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i7",name:"Cabbage",h:"बंद गोभ़ी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i8",name:"Red Carrots",h:"लाल गाजर",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i9",name:"Cauliflower",h:"फूलगोभ़ी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i10",name:"Beans",h:"बीन्स",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i11",name:"Green Chilli",h:"हरी मिर्च",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i12",name:"Coriander Leaves",h:"धशनया पत्ता",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i13",name:"Ginger BIG SIZE",h:"अदरक",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i14",name:"Garlic",h:"लहसुन",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i15",name:"Lemon",h:"नींबू",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i16",name:"Radish",h:"मूल़ी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i17",name:"Beetroot",h:"चुकंदर",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i18",name:"Mint Green",h:"पुदीना हरा",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i19",name:"Bottle Gourd",h:"लोक़ी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i20",name:"Ladyfinger",h:"भिंडी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i21",name:"Bitter Gourd",h:"करेला",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i22",name:"Brinjal Big",h:"वेगन वडा",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i23",name:"Brinjal Small",h:"वेगन छोटा",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i24",name:"Pumpkin",h:"स़ीताफल",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i25",name:"Spinach",h:"पालक",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i26",name:"Arbi",h:"अरव़ी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i27",name:"Mushroom Fresh",h:"मशरूम फ्रेश",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i28",name:"Frozen Green Peas (SAFAL)",h:"सफल मटर",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i29",name:"Peeled Garlic CHINEES",h:"शछला लहसुन",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i30",name:"Tinda",h:"टिंडा",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i31",name:"Parval",h:"परवल",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i32",name:"Mustard Leaves",h:"सरसों पत्ता",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i33",name:"Bathua",h:"बथुआ",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i34",name:"Lotus Cucumber",h:"कमल ककड़ी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i35",name:"Turnip",h:"शलजम",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i36",name:"Green Onions",h:"हरा प्याज",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i37",name:"Fenugreek Leaves (मेथ़ी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i38",name:"Curry Leaves",h:"कड़ी पत्ता",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i39",name:"Banana Flower",h:"केले का फूल",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i40",name:"Banana Leaf",h:"केले का पत्ता",cat:"Fresh Vegetables",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i41",name:"Jugni Green",h:"जुगऩी हऱी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i42",name:"Jugni Yellow",h:"जुगऩी प़ील़ी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i43",name:"Cluster Beans",h:"ग्वार फल़ी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i44",name:"Small Potato",h:"छोटा आलू",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i45",name:"Black Carrot",h:"काल़ी गाजर",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i46",name:"Orange Carrot",h:"गाजर संतऱी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i47",name:"Soy Leaves",h:"सोया पत्ता",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i48",name:"Achari Mirch",h:"अचारी मिर्च",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i49",name:"Red Radish Round",h:"लाल मूल़ी गोल",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i50",name:"Yam",h:"जिमीकंद",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i51",name:"Red Cabbage",h:"लाल बंद गोभ़ी",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i52",name:"Red Capsicum",h:"लाल शिमला शमर्च",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i53",name:"Yellow Capsicum",h:"प़ील़ी शिमला शमर्च",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i54",name:"Green Capsicum",h:"हऱी शिमला शमर्च",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i55",name:"Basil",h:"बेसिल",cat:"Fresh Vegetables",unit:"gm",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i56",name:"Lettuce",h:"सलाद पत्ता",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i57",name:"Chinese Cabbage",h:"चाइनीज गोभी",cat:"Fresh Vegetables",unit:"bng",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i58",name:"Pok Choi",h:"पोकचोई",cat:"Fresh Vegetables",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i59",name:"Apple",h:"सेब",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i60",name:"Yellow Banana",h:"केला",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i61",name:"Papaya",h:"पप़ीता",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i62",name:"Pineapple",h:"पाइनएप्पल",cat:"Fresh Fruits",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i63",name:"Kiwi",h:"क़ीव़ी",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i64",name:"Strawberry",h:"स्ट्रॉबेऱी",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i65",name:"Coconut",h:"नारियल",cat:"Fresh Fruits",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i66",name:"Green Grapes",h:"हरा अंगूर",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i67",name:"Black Grapes",h:"काला अंगूर",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i68",name:"Watermelon",h:"तरबूज",cat:"Fresh Fruits",unit:"box",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i69",name:"Muskmelon",h:"खरबूजा",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i70",name:"Sharda",h:"शारदा",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i71",name:"Pomegranate",h:"अनार",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i72",name:"Chikoo",h:"चीकू",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i73",name:"Mango",h:"आम",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i74",name:"Pear",h:"बाबूगोसा",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i75",name:"Guava",h:"अमरूद",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i76",name:"Litchi",h:"लीची",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i77",name:"Sweet Potato",h:"शकरकंदी",cat:"Fresh Fruits",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i78",name:"Cherry Tomatoes",h:"चेरी टमाटर",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i79",name:"Awa Kado",h:"आवा काडो",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i80",name:"Thai Ginger",h:"थाई जिंजर",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i81",name:"Leek",h:"ल़ीक",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i82",name:"Lemon",h:"नींबू",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i83",name:"Lemon Grass",h:"लेमन ग्रास",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i84",name:"Lemon Leaf",h:"लेमन ल़ीफ",cat:"Exotic & Imported",unit:"gm",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i85",name:"Lolo Roso",h:"लोलो रासो",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i86",name:"Chana Sprouts",h:"चना स्प्राउट",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i87",name:"Moong Sprouts",h:"स्प्राउट",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i88",name:"Mix Sprout",h:"स्प्राउट",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i89",name:"Asparagus",h:"अस्पैरागस",cat:"Exotic & Imported",unit:"bng",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i90",name:"Chinese Cucumber",h:"चाइनीज खीरा",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i91",name:"Raw Banana",h:"कच्चा केला",cat:"Exotic & Imported",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i92",name:"Raw Papaya",h:"कच्चा पप़ीता",cat:"Exotic & Imported",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i93",name:"Chhalia",h:"छालिया",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i94",name:"Baby Corn",h:"बेबी कॉर्न",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i95",name:"Broccoli",h:"ब्रोकल़ी",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i96",name:"Beans Sprout",h:"स्प्राउट",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i97",name:"Salary",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i98",name:"Salad Iceberg",h:"सलाद",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i99",name:"Romaine Lettuce",h:"रोमन सलाद",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i100",name:"Parsley",h:"पार्सले",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i101",name:"China garlic",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i102",name:"Sirka Onion",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i103",name:"WHOLE CORN (BHUTTA)",cat:"Exotic & Imported",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i104",name:"DRUMSTICK",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i105",name:"PAN PATTA",cat:"Exotic & Imported",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i106",name:"MALTA",cat:"Exotic & Imported",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i107",name:"Tandoori Chicken",h:"तंदूरी मिकन",cat:"Poultry, Meat & Fish",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i108",name:"Thai Chicken",h:"थाई मिकन",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i109",name:"Tangri",h:"टंगडी",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i110",name:"Chicken Bees",h:"मिकन बीस",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i111",name:"Chicken Breast",h:"मिकन ब्रेस्ट",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i112",name:"Mutton Curry Cut",h:"मटन करी कट",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i113",name:"Mutton Boneless",h:"मटन ब नलेस",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i114",name:"Fate",h:"फेट",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i115",name:"Mutton Keema",h:"मटन कीमा",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i116",name:"Anus",h:"गुदे",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i117",name:"Kapoor",h:"कपूर",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i118",name:"Liver",h:"कलेजी",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i119",name:"Brain",h:"ब्रेन",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i120",name:"Mutton Leg (2 KG )",h:"मटन लेग",cat:"Poultry, Meat & Fish",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i121",name:"Basha Fish",h:"बाशा मफश",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i122",name:"River Soul",h:"ररवर स ल",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i123",name:"Salmon Fish",h:"सेलमान मफश",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i124",name:"Tandoori Chicken With Skin",cat:"Poultry, Meat & Fish",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i125",name:"Chicken Lolipop",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i126",name:"BHETKI FISH ( WITH OUT SCREEN )",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i127",name:"KATLA FISH",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i128",name:"PRAWN FISH ( C GRADE )",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i129",name:"Bater (frozen)-15 pc",cat:"Poultry, Meat & Fish",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i130",name:"MUTTON FAT",cat:"Poultry, Meat & Fish",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i131",name:"Full Cream Milk",h:"फुल क्रीम ममल्क",cat:"Dairy & Fresh",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i132",name:"Toned Milk...",h:"टोंड मिल्क",cat:"Dairy & Fresh",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i133",name:"Tikka Paneer",h:"मटक्का पनीर",cat:"Dairy & Fresh",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i134",name:"Malai Paneer",h:"मलाई पनीर",cat:"Dairy & Fresh",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i135",name:"Curd.",h:"दही.",cat:"Dairy & Fresh",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i136",name:"Cone Dana",h:"कॉने दाना",cat:"Dairy & Fresh",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i137",name:"Green Peas",h:"हरी मटर",cat:"Dairy & Fresh",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i138",name:"Soya Chaap",h:"सोया चाप",cat:"Dairy & Fresh",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i139",name:"Khoya Pindi",h:"ख या मपंडी",cat:"Dairy & Fresh",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i140",name:"Lost Dhap",h:"ख या धाप",cat:"Dairy & Fresh",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i141",name:"Noodle",h:"नूडल",cat:"Dairy & Fresh",unit:"pkt",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i142",name:"Chhena",h:"छेना",cat:"Dairy & Fresh",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i143",name:"Danadar Khoya",cat:"Dairy & Fresh",unit:"kg",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i145",name:"Jammu Bread White",h:"जम्मू ब्रेड व्हाइट",cat:"Bakery",unit:"pkt",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i146",name:"Jammu Bread Brown",h:"जम्मू ब्रेड ब्राउन",cat:"Bakery",unit:"pkt",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i147",name:"Harvest Bread White",h:"हावेस्ट ब्रेड व्हाइट",cat:"Bakery",unit:"pkt",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i148",name:"Egg",h:"अंडा",cat:"Bakery",unit:"tray",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i149",name:"Pizza Base",h:"मपज़्जा बेस",cat:"Bakery",unit:"pkt",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i150",name:"French Bread",h:"फ्रेंच ब्रेड",cat:"Bakery",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i151",name:"Mushroom Volvo",h:"मशरूम व ल्व",cat:"Bakery",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i152",name:"Lovelace",h:"लवलस",cat:"Bakery",unit:"pkt",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i153",name:"Pita Bread",h:"मपता ब्रेड",cat:"Bakery",unit:"pkt",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i154",name:"Soup Stick",h:"सूप स्टस्टक",cat:"Bakery",unit:"pkt",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i155",name:"French Fries",h:"फ्रेंच फ्राई",cat:"Bakery",unit:"pkt",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i156",name:"8 TO 8 SAUCE 200GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i157",name:"ARBORIO RICE ( 1 KG )",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i158",name:"AROMAT POWER (500GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i159",name:"BAKED BLACK BEANS SAUCE 450GM ( Tin )",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i160",name:"BAKING POWDER (100GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i161",name:"BALASMIC VINEGAR 500ML",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i162",name:"BAMBOO SHOOT (24*425GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i163",name:"BBQ Sauce AG -510 GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i164",name:"BHUIRA TOMATO CHUTNEY 460GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i165",name:"BISCOFF COOKIE 225 GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i166",name:"BISCOFF CREAMY PEST 400GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i167",name:"Black Beans Sauce( 226GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i168",name:"Black Fungus",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i169",name:"BLACK MUSHROOM 1KG",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i170",name:"Black Olives Pitted (Luxeapers440gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i171",name:"BORBOUN BISCULT",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i172",name:"BURATTA",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i173",name:"BURRATA CREAM FILLED",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i174",name:"Chicken Broth Powder(100Gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i175",name:"Chilli Flex 1 Kg",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i176",name:"Chilli Garlic Sauce 226gm/pcs",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i177",name:"CHILLY FLAKES LOSE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i178",name:"Chilly Flakes Premium (500GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i179",name:"CHILLY PICKEL",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i180",name:"Chinese Cooking Wine (640 ML)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i181",name:"CHIPOTLE PEPERS 198 GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i182",name:"CHOCO CHIPS",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i183",name:"CHOCOLATE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i184",name:"Chocolate Powder(100Gm Classic0",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i185",name:"CHOCOLATE FRAPPE 1KG",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i186",name:"CHOCOLATE POWDER",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i187",name:"Chocolate Syrup (600GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i188",name:"Chocolate Syrup 1.3kg",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i189",name:"Cocktail Onion in Vinegar( 350 Gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i190",name:"COCO POWDER",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i191",name:"COCO POWDER (VAN HOUTEN)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i192",name:"Coconut Milk Powder(1Kg)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i193",name:"Coconut Cream (400ML)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i194",name:"Coconut MILK (Chaokoh)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i195",name:"COOKING VINEGR HT-640ML",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i196",name:"COOKNG VINEGER (CHINA WINE)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i197",name:"Corn Flakes (1KG)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i198",name:"CORN FLAKES 500GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i199",name:"CORN STARCH",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i200",name:"CRAMBREEY SYRUP",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i201",name:"cranberry moonshine",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i202",name:"CRISTAL SUGAR",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i203",name:"DAIRY CRAFT ENGLISH CHEDDAR 500",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i204",name:"Dark Soya Sauce",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i205",name:"DARK SOYA SAUCE (1LTR TOPS)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i206",name:"Dried Masroom \ Stay Stic",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i207",name:"Dry Dates(500gm )",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i208",name:"DRY MASROOM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i209",name:"Dry Yeast (500gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i210",name:"FINE SPICE (65GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i211",name:"FIVE SPICE POWDER",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i212",name:"FLOUR TORTILA",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i213",name:"FOOD COLOUR CAFE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i214",name:"FRENCH FRIES 9MM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i215",name:"Fruit Cocktail (Golden Crown) 850 Gm",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i216",name:"FRUIT JAM (475GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i217",name:"FURTIN VINGER 700ML",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i218",name:"GARLIC PICKLE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i219",name:"GARLIC POWDER (400GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i220",name:"GELATINE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i221",name:"GERLIC POWDER",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i222",name:"Gherkins in Vinegar ( Golden Crown) 670 GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i223",name:"GINGER POWDER",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i224",name:"Glass Vermicelli (Noodls) 500 Gm",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i225",name:"GLUCOSE LEQUID",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i226",name:"GOLDEN CHINESE RICE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i227",name:"GOLDEN CROWN MAYONNAISE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i228",name:"Green Chili Pickel(1kg)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i229",name:"GREEN CURRY PASTE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i230",name:"Green Cury Pest ( 1kg)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i231",name:"Green Olives Pited (Luxeapers 440gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i232",name:"HARMIT COFFEE BENS",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i233",name:"HERSHEY CHOCOLATE SYRUP 1.3KG",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i234",name:"HOISIN SAUCE (240 GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i235",name:"HOISIN SAUCE 2.2KG",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i236",name:"Hoision Sauce (240Gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i237",name:"Hot Szechuan Paste 310gm",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i238",name:"HP Sauce(255Gm) Original",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i239",name:"Ice Corn",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i240",name:"INDIA GATE SUPER RICE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i241",name:"INDIAN GATE RICE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i242",name:"Jalapeno Slices",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i243",name:"JAM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i244",name:"JAPANESE COOKING OIL (1.5LTR)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i245",name:"JAPANESE MAYONISE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i246",name:"Jasmin Rice MBK",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i247",name:"KHAS SYRUP (750ML)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i248",name:"KIKOMAN COOKING SAUCE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i249",name:"Kikomen Soya Sauce (1ltr)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i250",name:"KRISH CRESS BERRY KAMBUCHA",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i251",name:"KRISHI CRESS MICROGREEN MIX",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i252",name:"Lea & Perrins",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i253",name:"Lea & Perrins Worcestershire Sauce",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i254",name:"Lea Perrins Sauce",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i255",name:"LEMON SEASING PASTE (500GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i256",name:"LICHI COKETEL",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i257",name:"LICHI CRUSH (1.250 LTR)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i258",name:"LICHI SYRUP (850 GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i259",name:"Light Soya Sauce (500ML)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i260",name:"LIME SEASONING KNOW 500GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i261",name:"LOVAS (PKT)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i262",name:"Lp Sauce(290ml)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i263",name:"LYCHEE IN SYRUP (800GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i264",name:"MAGGI SAUCE 200ML",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i265",name:"Maggi Seasing (500gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i266",name:"MANGO COKETEL",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i267",name:"MANGO PANNA DRINK",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i268",name:"Mango Pulp (850gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i269",name:"MANGO SYRUP",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i270",name:"MASA FLOUR",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i271",name:"mayonnaise 1KG",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i272",name:"Mccain Aloo Tikki",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i273",name:"MCCAIN FRENCH FRIES",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i274",name:"MCCAIN VEG NUGGETS",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i275",name:"MEGGI (70gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i276",name:"MEGGI SOUCE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i277",name:"Microni Pasta",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i278",name:"Microni Pasta (500gm/pkt)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i279",name:"Monin Concomber ( 1ltr) Green",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i280",name:"MULTIGRAINS FLAT BREAD",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i281",name:"MUSHROOM SHELL",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i282",name:"MUSTRAD DIJON",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i283",name:"MUTTI PELATI",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i284",name:"NESCAFE COFFEE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i285",name:"NOORI SHEET",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i286",name:"NUGETS",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i287",name:"Olive Black Pitted 440gm/pcs",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i288",name:"Olive Green Pitted 440gm/pcs",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i289",name:"OLIVE OIL (1LTR)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i290",name:"ONION POWDER(400GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i291",name:"OYSTER SAUCE (500ML)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i292",name:"Oyster Sauce (Panda Brand 510Gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i293",name:"Paprika Powder(400Gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i294",name:"PARLE MONACO PIRI PIRI",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i295",name:"PARMESAN ARTISAN CHEEZ",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i296",name:"Pasta Speghitte",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i297",name:"PATHER KE PHOOL",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i298",name:"PEANUT BUTTER (500GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i299",name:"PENNA PASTA",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i300",name:"Peprica Powder",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i301",name:"PERI PERI MARINADE 1KG",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i302",name:"Peri Peri Sauce(Veeba300Gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i303",name:"PERMISON",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i304",name:"PICKLE GINGER 1.5KG",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i305",name:"Pineapple Crush(Golden Crown 1LTR)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i306",name:"Pineapple Slice( Golden Crown 850Gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i307",name:"PIZZA PASTA SEASONING (70GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i308",name:"PIZZA SEASONING",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i309",name:"PIZZA SPICE MIX PREMIUM 500GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i310",name:"PIZZA TOPPING 1KG",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i311",name:"pomegranate syrup",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i312",name:"Potato Starch (500gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i313",name:"Red Chilli Sauce ( Tops 700Gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i314",name:"Red Curry Paste ( 1kg )",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i315",name:"Red Curry Thai",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i316",name:"RED KIDNEY 400GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i317",name:"RED WINE VINGER",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i318",name:"REGGIA SPAGHETTI",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i319",name:"Rice Cooking Wine",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i320",name:"Rice Stick(Chinese 5MM) 500Gm",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i321",name:"Rose Essence",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i322",name:"Rose Mary (1kg)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i323",name:"RYORISHU JAPANSES COOKING SEASING",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i324",name:"SAKE COOKING 1.8 LTR",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i325",name:"SAKE WINE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i326",name:"SAKEMIREN 1.8LTR",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i327",name:"Sapegtchi",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i328",name:"Schezwan Sauce (1kg Dr Oetker",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i329",name:"SCHEZWAN SAUCE (KG)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i330",name:"Seame Oil (500gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i331",name:"Seasosing Sauce",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i332",name:"SESAME OIL",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i333",name:"Sesame Seeds Oil( 458 Gm) Til Oil",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i334",name:"SHITAKE MUSHROOM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i335",name:"Sirazo Chilli Sauce",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i336",name:"SMOKED POWDER",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i337",name:"SOBA NOODLE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i338",name:"SOUR CREAM 200GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i339",name:"Soy Sauce (Premium Dark) 500ML",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i340",name:"SOYA LITE SAUCE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i341",name:"Soya Sauce (Tops 740 Gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i342",name:"SOYA SAUCE LEEKOM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i343",name:"Soyabeen Sauce (Golden Crown) 850Gm",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i344",name:"Spaghetti Pasta (500gm/pkt)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i345",name:"Speghetti (1kg)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i346",name:"SPEGHETTI PASTA 500GM AGNESI",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i347",name:"Sriracha (Chilli Garlic Sauce) (200GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i348",name:"SRIRACHA CHILLI SAUCE -580 ML",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i349",name:"STROWBERRY SYRUP (750ML)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i350",name:"Strwaberry Colour",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i351",name:"Sttake Mashroom",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i352",name:"SUGAR CRUSTED GINGER",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i353",name:"Sugar Double Filter",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i354",name:"SUGAR FREE 500 PCS",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i355",name:"Suger Byra",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i356",name:"SUGER FREE (100PCS/BOX)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i357",name:"Sumac Powder(500Gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i358",name:"SUMAK POWDER 500 GM",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i359",name:"SUMUDARI JHAG",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i360",name:"SUSHI MET",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i361",name:"SUSHI RICE (2KG PKT)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i362",name:"SUSHI RICE 1KG",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i363",name:"SUSHI VINEGAR 1.8LTR (SAKURA)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i364",name:"SUSHIRI SHEET WOODEN",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i365",name:"SWEAT CHILLY SUACE (980 GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i366",name:"Sweet Chili Sauce( 980Gm)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i367",name:"SZECHUN PAPPER 1KG",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i368",name:"Tabasco Pepper Sauce( 60ML)Taransco",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i369",name:"TAHINA PEST (650GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i370",name:"TAPSCO",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i371",name:"TEMPTING BITES MANGO CHUTNEY",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i372",name:"TEMPURA POWDER",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i373",name:"TERIYAKI SAUCE (250GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i374",name:"TOMATO PELATE TIN",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i375",name:"Tops Soya Sauce 1.3kg",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i376",name:"TRUFFLE OIL",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i377",name:"TYPHOO PURE GREEN TEA LEAF",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i378",name:"VANILA POWDER",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i379",name:"VANILLA FRAPPE POWDER 1KG",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i380",name:"VEEBA SWEET ONION SAUCE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i381",name:"VINEGAR SYNTHETIC 24*700 ML",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i382",name:"VINEGAR SYNTHETIC 600ML",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i383",name:"WAFER",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i384",name:"WARCHESTER SHINE SOUSE (325GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i385",name:"WASABI",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i386",name:"Washabi Pest(43 GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i387",name:"Water Chestnuts",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i388",name:"White Chocolate Compaund",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i389",name:"WHITE WINE",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i390",name:"Worcestershir Sauce (295GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i391",name:"Yellow Curry Paste(1 Kg)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i392",name:"Yellow Mustared (English Sauce)Amrican (250GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i393",name:"Yellow Mustared PASTE (200GM)",cat:"Imported Pantry",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i394",name:"AAMCHOR POWDER NO.1",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i395",name:"AATA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i396",name:"Agra Sev Namkin ( Haldiram )",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i397",name:"Ajinomoto (500 Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i398",name:"Ajwain SABUT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i399",name:"Amchoor Powder 1Kg",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i400",name:"Amchoor Sabot Lose",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i401",name:"Anar Dana Powder(100Gm)OMJI",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i402",name:"Anar Dana Sabut",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i403",name:"ANJEER",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i404",name:"Ararot (Corn Flor)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i405",name:"Arhar Dal",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i406",name:"ATTA ASHIRVAAD",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i407",name:"Atta Lose",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i408",name:"ATTA MAKKI",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i409",name:"ATTA SINGHARA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i410",name:"Badi Elachi (Lose Black)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i411",name:"BADMI ATTA (500GM/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i412",name:"BAG BAKRI CHAI (100PCS)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i413",name:"Bajra (Lose/ SABHUT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i414",name:"Bajra ATTA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i415",name:"BARIK BESAN",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i416",name:"BARIK NAMAK",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i417",name:"BASMATI BIRYANI SPL",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i418",name:"Basmati Rice Kitchen Champion",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i419",name:"Basmati Tukda (Staff Rice)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i420",name:"Bay Leaf (Tej Patta)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i421",name:"Bedmi Puri Aata (1kg/pkt)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i422",name:"Besan Lose",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i423",name:"BHANG",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i424",name:"BIG CHIEF RICE TENDER",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i425",name:"Black Masoor (Sabut0",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i426",name:"Black Paper Powder (100 Gm ) Mdh",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i427",name:"Black Pepper Whole",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i428",name:"Black Salt(1kg)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i429",name:"Black Sarso (Lose)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i430",name:"Black Til",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i431",name:"Boondi (200gm/pkt)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i432",name:"BOONDI LOSE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i433",name:"Boora (Lose)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i434",name:"BREAD CREAM LUCIAA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i435",name:"Bread Crumbs (Golden Crown )1kg",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i436",name:"CHAAT MASALA LOSE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i437",name:"Chaat Masala Powder(100Gm) MDH",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i438",name:"Chana Dal",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i439",name:"CHANA JOR GARAM",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i440",name:"Chana MasalaPowder(100Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i441",name:"CHANA SATTU (500GM/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i442",name:"Channa Masala (50gm/pcs)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i443",name:"CHIA SEED",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i444",name:"Chicken Masala (100gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i445",name:"CHOLE MASALA NO.1",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i446",name:"CHOLE TF",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i447",name:"Chole White (Whole)Kabuli",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i448",name:"Coconut Powder (1Kg)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i449",name:"COFFE 500G",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i450",name:"Coffee (100gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i451",name:"COFFEE 200GM PKT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i452",name:"COFFEE BEG",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i453",name:"Dal Chini (Stick)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i454",name:"DALDA GHEE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i455",name:"Dalda(Ghee 15 Kg/tin)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i456",name:"Daliya",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i457",name:"DARJELING LEAF TEA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i458",name:"DAWAT RICE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i459",name:"Deggi Mirch Powder(100Gm)MDH",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i460",name:"Desi Ghee 15 Kg Partap (15kg/tin)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i461",name:"Desi Ghee Partap (Local) 1 KG",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i462",name:"DEV BHOOMI RICE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i463",name:"Dhaniya Powder (Lose T)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i464",name:"DHANIYA POWDER NO.1",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i465",name:"Dhaniya Powder(100GM)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i466",name:"Dhaniya Powder(500Gm)MDH",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i467",name:"Dhaniya Whole / SABUT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i468",name:"DHOKLA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i469",name:"DHRUV REFIND TIN 15 KG",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i470",name:"Double Basmati Rice (30kg/katta) (GOLDEN SELA)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i471",name:"Double Chabi Rice",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i472",name:"ELAICHI DANA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i473",name:"ELAICHI POWDER (50GM/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i474",name:"Emali",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i475",name:"ENO (100GM/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i476",name:"Everyday Milk (1kg/pkt)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i477",name:"FAT CREAM",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i478",name:"FRY PAPAD",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i479",name:"Funtop Sauce 5 Ltr",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i480",name:"GAP SHAP PEANUTS (200GM/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i481",name:"Garam Masala (TANDER)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i482",name:"GARAM MASALA NO.1",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i483",name:"Garam Masala Powder (100Gm) MDH",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i484",name:"Gram Masala Whole",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i485",name:"Green Chilli Sauce (Tops 1.15KG)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i486",name:"Green Chilli Sauce (Tops 650Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i487",name:"Green Chilli Sauce (TOPS 1LTR)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i488",name:"Green Colour",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i489",name:"Green Colour Anuja",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i490",name:"Green Elachi (500gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i491",name:"GREEN ELACHI LOSE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i492",name:"Green Elaichi Powder",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i493",name:"GREEN TEA BAG (TATLEY 100PCS)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i494",name:"Green Tea Bag(LIPTON 25PCS)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i495",name:"GREEN TEA LEAF LOSE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i496",name:"Gud",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i497",name:"Guest Basmati Rice",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i498",name:"Gulab Pata",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i499",name:"Gulab Water (250 ML)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i500",name:"Gulkand (400GM)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i501",name:"GUP SHUP NAMKEEN",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i502",name:"Gup Shup Namkeen (Rs.10)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i503",name:"GURE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i504",name:"HALDI POWDER (TANDER)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i505",name:"HALDI NO 1",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i506",name:"Haldi Powder (500Gm)MDH",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i507",name:"HALDI POWDER 500GM NO.1",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i508",name:"Haldi Powder(250 Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i509",name:"HALDI RAM CHANA NUTS",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i510",name:"HALDI RAM SALTED PEANUTS",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i511",name:"HALDI WHOLE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i512",name:"HALDIRAM ALOO BHUJIA 42GM",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i513",name:"HALDIRAM CHIPS CLASSIC SALTED 33GM",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i514",name:"Hing (10Gm)MDH",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i515",name:"HING (T)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i516",name:"HING OM FOR TENDER",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i517",name:"HOLLAND GOUDA CHEESE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i518",name:"Honey (Dabur 1Kg)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i519",name:"Imli Lose",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i520",name:"JAIPHAL LOSE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i521",name:"Jal Jeera Powder(100Gm)MDH",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i522",name:"Javetri SABHUT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i523",name:"Jeera Powder(100Gm)MDH",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i524",name:"JEERA SABUT (T)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i525",name:"Jeera Whole/ SABUT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i526",name:"KABAB CHINI",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i527",name:"KABULI CHANA SMALL DANA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i528",name:"KACHRI",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i529",name:"KACHRI POWDER",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i530",name:"KAIR",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i531",name:"KAJU 2 PCS",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i532",name:"KAJU 8PCS",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i533",name:"Kaju Tukda/ KAJU 4PCS",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i534",name:"Kaju Whole/ KAJU SABUT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i535",name:"Kala Chana Lose /black Channa",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i536",name:"Kala Khatta Syrup (750ML)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i537",name:"KALI MASOOR",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i538",name:"Kali Mirch Powder (100gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i539",name:"KALI MIRCH SABUT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i540",name:"Kali Urad (Whole)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i541",name:"Kali Urad Dal Chilka",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i542",name:"KALONJI",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i543",name:"KASHMIRI MIRCH SABUT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i544",name:"KASMIRI LAL MIRCH NO.1",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i545",name:"Kasoori Methi (100g) Mdh",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i546",name:"Kasoori Methi 25GM",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i547",name:"Kastoori Methi Lose",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i548",name:"Kesar(Saffron)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i549",name:"Kewda Water(250ML)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i550",name:"KHADE MASALA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i551",name:"Khand(1 Kg)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i552",name:"Kharbuja Biz",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i553",name:"Khas Khas ( Popee Seed)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i554",name:"KHASH KI JAD",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i555",name:"KHATTA MITHA NAMKIN (RS.5)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i556",name:"Kismis",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i557",name:"Kitchen King Powder (100Gm)MDH",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i558",name:"Kulfi Brush",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i559",name:"KULFI SALT LOSE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i560",name:"KULFI STICK",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i561",name:"Kutu Ka Aata",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i562",name:"LAL MIRCH KUTTI",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i563",name:"Lal Mirch Kutti Powder(1kg)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i564",name:"Lal Mirch Powder (500Gm/pkt) MDH",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i565",name:"LAL MIRCH POWDER (TANDER)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i566",name:"LAL MIRCH POWDER 200 GM MDH",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i567",name:"LAL MIRCH POWDER NO.1",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i568",name:"LAL MIRCH SABUT ( RED CHILLY)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i569",name:"LAYS CHIPS",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i570",name:"LIME PIC KLE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i571",name:"LOBHIYA TF",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i572",name:"Long (Whole)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i573",name:"MAGAJ",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i574",name:"Maggi",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i575",name:"Maida Lose",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i576",name:"Makhana(250Gm) Pkt",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i577",name:"MAKHANE LOSE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i578",name:"Makki KA ATTA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i579",name:"Mango Pickel (1kg)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i580",name:"MANGO CHATNI",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i581",name:"Masoor Dal Lose",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i582",name:"Mattar (Yellow Pease)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i583",name:"Meat Masala Powder(100Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i584",name:"Meetha Soda Powder(Lose)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i585",name:"Methi Dana",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i586",name:"METHI KI CHATNI (100GM)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i587",name:"METHI KI CHATNI(200GM/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i588",name:"Milk Powder",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i589",name:"Mirch Kutti (Lose T)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i590",name:"MISRI DANA LOSE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i591",name:"MIX DAL",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i592",name:"Mix PICKEL (1KG BT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i593",name:"Mix Pickle (5kg)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i594",name:"MIX PICKLE 4.5KG",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i595",name:"MOONG DAL FLOUR",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i596",name:"MOONG DAL PAPAD",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i597",name:"Moong Dal Whole (Green)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i598",name:"Moong Dhuli (30KG Katta)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i599",name:"Moongfali Dana",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i600",name:"MOOV OINTMENT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i601",name:"MORMORA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i602",name:"MOTA ATTA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i603",name:"Mota Besan",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i604",name:"MOTA NAMAK",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i605",name:"Motichor Besan",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i606",name:"MURMURA 500GM",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i607",name:"Mustared Oil (1ltr ) Fortune",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i608",name:"Nachao (Namkin ) (200gm/pkt)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i609",name:"NAMAK PARA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i610",name:"Nav Bahar Masala (500gm/pkt)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i611",name:"NUT CRACKER PEANUTS (200GM/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i612",name:"NUTCRACKER",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i613",name:"OATS",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i614",name:"Oil Fortune 1 Ltr",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i615",name:"Orange",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i616",name:"Orange Colour",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i617",name:"Papad (Lijjit) 200Gm",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i618",name:"Pasta Fusli (500gm/pkt)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i619",name:"Pav Bhaji Powder(100Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i620",name:"PEANUT (100GM)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i621",name:"PEANUT (200GM/PKT) HALDI RAM",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i622",name:"PEANUT (500GM/PKT) HALDI RAM",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i623",name:"PEANUT 400GM HALDIRAM",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i624",name:"PEANUT LOSE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i625",name:"Peanut Masala",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i626",name:"PICKLE MANGO",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i627",name:"Pista Hara (250Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i628",name:"Pista Lose Hara",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i629",name:"Poha LOSE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i630",name:"POHA 500GM\PKT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i631",name:"Poha Rajdhani",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i632",name:"Rai Dana (Lose)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i633",name:"Raita Boondi (400Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i634",name:"Rajma (Chitra)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i635",name:"RAJMA KASMIR",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i636",name:"RAJMA MASALA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i637",name:"Rajma Powder (100gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i638",name:"RANGKAAT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i639",name:"RATANJYOT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i640",name:"RAVA IDLI MTR (500GM/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i641",name:"Red Chilly Whole",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i642",name:"Red Colour",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i643",name:"RED MASOOR",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i644",name:"RED MIRCHI POWER / RED CHILL POWER (500GM)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i645",name:"Reetha",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i646",name:"Refind 15ltr (15ltr/tin) Fortune",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i647",name:"REFIND 1LTR FORTUNE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i648",name:"Rice Basmati Classic",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i649",name:"RICE BASMATI JYOTI",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i650",name:"RICE BASMATI KARTIK",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i651",name:"Rice Papad",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i652",name:"Rice Powder",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i653",name:"Ritha Whole",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i654",name:"Roasted Peenut",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i655",name:"Rose Petals (1kg)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i656",name:"ROSTED CHANA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i657",name:"ROSTED CRUSHED PEANUTS (200GM/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i658",name:"ROSTED PAPAD",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i659",name:"ROUND PAPAD",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i660",name:"RUSK BISCUIT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i661",name:"SABODANA MOTA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i662",name:"Sabudana",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i663",name:"Saburdana Papad (6PCS/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i664",name:"Sabut Dania",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i665",name:"SAGARI",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i666",name:"Salt (1Kg) PKT (Tata)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i667",name:"SALTED PEANUTS (250GM/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i668",name:"Sama Rice",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i669",name:"SAMAK RICE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i670",name:"Samber Masala Powder(100Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i671",name:"SANGRI",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i672",name:"SARSO DANA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i673",name:"Satri",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i674",name:"SATU (500GM/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i675",name:"Saunf (Whole)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i676",name:"Saunf Powder(100Gm) OM JI",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i677",name:"Sauth Powder (100Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i678",name:"Sauth Wole",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i679",name:"Schezwan Paper Whole(1kg)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i680",name:"SEDHA SALT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i681",name:"Semiya Roasted(800Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i682",name:"Semiya Roasted (150 Gm) Long",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i683",name:"Senda Salt",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i684",name:"Sev Bhujiya (1kg)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i685",name:"Shaan Masala",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i686",name:"SHAHI JEERA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i687",name:"singhare wheat / singhare ka aata",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i688",name:"Sonth Powder",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i689",name:"SONTH SABUT",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i690",name:"Sooji (500Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i691",name:"SOOJI (500GM/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i692",name:"Sot Powder (100gm/pkt)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i693",name:"SOTH WHOLE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i694",name:"SOUNF POWDER",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i695",name:"SOYA BARI",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i696",name:"Soya Bari Chura",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i697",name:"SOYA CHOORA FORTUNE",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i698",name:"Soya Chura (Lose)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i699",name:"Staff Rice (30 Kg) Bag",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i700",name:"Staff Tea ( Bagh Bakri) 1 Kg Bag",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i701",name:"Star Anis (500gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i702",name:"STAR ANISE/ STAR FRUIT DRY",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i703",name:"Sugar (NOT USE)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i704",name:"Sugar Candy",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i705",name:"Sugar Sachets (100pcs/pkt)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i706",name:"Sugar Sese(Pouch)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i707",name:"Sugarcan Katori (50pcs/pkt)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i708",name:"Suji (500gm/pkt)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i709",name:"SUJI (500PCS/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i710",name:"Tea Leaf (250gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i711",name:"Tetley Tea Bags (100 Bags Per Box)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i712",name:"Tetley Tea Bags (25 PCS/PKT)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i713",name:"TOAMTO SAUCE 6KG",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i714",name:"TOMATO CHUTNEY",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i715",name:"TOMATO KETCHUP (900GM)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i716",name:"Tomato Ketchup Pouch (08 Gm) (1296)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i717",name:"Tomato Puree 1ltr",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i718",name:"Tomato Puree(Golden Crown 825Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i719",name:"TOMATO SAUCE 6KG",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i720",name:"Tomota Catup Kissan (930gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i721",name:"TULSI GREEN TEA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i722",name:"URAD CHILKA TF",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i723",name:"URAD DAL PAPAD",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i724",name:"Urad Dhuli(30kg Katta)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i725",name:"Urad Dhully Sabat",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i726",name:"URAD PAPAD",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i727",name:"URAD WADIA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i728",name:"URAD WSH GOATA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i729",name:"Uttam Sugar Sachet (10kg)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i730",name:"VANASPATI GHEE (15KG/TIN)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i731",name:"Veg Broth Powder (50Gm Aromat)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i732",name:"VINEGAR 640ML",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i733",name:"VINEGER (1LTR)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i734",name:"WAG BAKRI LEAF TEA POUCH",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i735",name:"WAGH BAKRI SPICE TEA",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i736",name:"White Pepper Powder(100Gm)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i737",name:"White Sugar (Sechet)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i738",name:"White Til( Lose)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i739",name:"Yellow Chilli Powder (100GM)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i740",name:"Yellow Chilly Sabut (Kg)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i741",name:"Yellow Colour",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i742",name:"YELLOW MIRCHI POWDER (100GM)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i743",name:"YELLOW MUSTARD 227GM",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i744",name:"YELLOW SARSO",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i745",name:"Zero Filter Floor(Maida)",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
    {id:"i746",name:"ZERO FLITER FLOOUR",cat:"Indian Dry Store",unit:"pcs",inStock:0,minStock:0,perPax:0,location:"AP Store"},
  ];

  const [items,    setItems]    = useState(INIT);
  const [orders,   setOrders]   = useState([]);
  const [tab,      setTab]      = useState("inventory");
  const [catFil,   setCatFil]   = useState("All");
  const [search,   setSearch]   = useState("");
  const [showAdd,  setShowAdd]  = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult,setScanResult]=useState("");
  const [scanError,setScanError]=useState("");
  const scanVideoRef  = useRef(null);
  const scanStreamRef = useRef(null);
  const scanAnimRef   = useRef(null);
  const [showOrder,setShowOrder]=useState(null);
  const [orderQty, setOrderQty] =useState("");
  const [editStock,setEditStock]=useState(null);
  const [editVal,  setEditVal]  =useState("");
  const [transactions, setTransactions] = useState([]); // [{id,itemId,itemName,type:"in"|"out",qty,reason,time}]
  const [scanMode, setScanMode] = useState("in"); // "in" or "out"
  const [scanItem, setScanItem] = useState(null); // matched item after scan
  const [scanQty, setScanQty] = useState("");
  const [scanReason, setScanReason] = useState("Purchase");
  const [scanLookup, setScanLookup] = useState(null); // {name,brand,image,energy,weight,source}
  const [issueDate, setIssueDate] = useState("all");
  const [issuedItems, setIssuedItems] = useState({});
  const [newItem,  setNewItem]  =useState({name:"",barcode:"",brand:"",supplier:"",cat:"Dry Goods",unit:"pcs",inStock:0,minStock:10,perPax:0,location:"Store A"});

  function stopScan(){
    if(scanAnimRef.current) cancelAnimationFrame(scanAnimRef.current);
    scanStreamRef.current?.getTracks().forEach(t=>t.stop());
    scanStreamRef.current=null; setScanning(false);
  }
  async function startScan(){
    setScanError(""); setScanResult("");
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
      scanStreamRef.current=stream; setScanning(true);
      setTimeout(()=>{
        if(scanVideoRef.current){scanVideoRef.current.srcObject=stream;scanVideoRef.current.play();}
        if(window.BarcodeDetector){
          const det=new window.BarcodeDetector({formats:["ean_13","ean_8","qr_code","code_128","upc_a","upc_e","itf","code_39"]});
          function detect(){
            if(!scanVideoRef.current||!scanStreamRef.current) return;
            det.detect(scanVideoRef.current).then(codes=>{
              if(codes.length>0){
                const bc=codes[0].rawValue;
                setScanResult(bc);
                setNewItem(p=>({...p,barcode:bc}));
                stopScan();

                // 1. Check master data first
                const found=items.find(i=>(i.barcode||"")===bc);
                if(found){setScanItem(found);setScanError("✅ Found in your inventory: "+found.name);return;}

                // 2. Try multiple product databases in cascade
                setScanError("🔍 Looking up in product databases…");

                async function lookupProduct(barcode){
                  // A. Open Food Facts (global food database — 3M+ products)
                  try{
                    const r1=await fetch("https://world.openfoodfacts.org/api/v2/product/"+barcode+".json",{signal:AbortSignal.timeout(5000)});
                    const d1=await r1.json();
                    if(d1.status===1&&d1.product){
                      const p=d1.product;
                      const nm=p.product_name||p.product_name_en||p.generic_name||"";
                      if(nm){
                        const br=p.brands||"";
                        const wt=p.quantity||p.net_weight||"";
                        const cat=p.categories_tags?.[0]?.replace("en:","").replace(/-/g," ")||"";
                        const nutr=p.nutriments||{};
                        return {
                          name:nm,brand:br,barcode,
                          unit:wt.toLowerCase().includes("ml")||wt.toLowerCase().includes("litre")?"ml":wt.toLowerCase().includes("kg")?"kg":wt.toLowerCase().includes("g")?"g":"pcs",
                          cat:guessCategory(nm,cat),
                          weight:wt,
                          image:p.image_thumb_url||p.image_url||"",
                          source:"Open Food Facts",
                          energy:nutr["energy-kcal_100g"]?""+Math.round(nutr["energy-kcal_100g"])+" kcal/100g":"",
                        };
                      }
                    }
                  }catch(e){}

                  // B. UPC Item DB (US/Global barcode database)
                  try{
                    const r2=await fetch("https://api.upcitemdb.com/prod/trial/lookup?upc="+barcode,{signal:AbortSignal.timeout(5000)});
                    const d2=await r2.json();
                    if(d2.code==="OK"&&d2.items?.length>0){
                      const item=d2.items[0];
                      return {
                        name:item.title||"",brand:item.brand||"",barcode,
                        unit:guessUnit(item.title||""),
                        cat:guessCategory(item.title||"",item.category||""),
                        weight:item.size||"",
                        image:item.images?.[0]||"",
                        source:"UPC Item DB",
                        energy:"",
                      };
                    }
                  }catch(e){}

                  return null;
                }

                function guessUnit(name){
                  const n=name.toLowerCase();
                  if(n.includes(" ml")||n.includes("litre")||n.includes("liter")) return "ml";
                  if(n.includes(" kg")||n.includes("kilogram")) return "kg";
                  if(n.includes(" gm")||n.includes(" g ")||n.includes("gram")) return "g";
                  if(n.includes(" l ")||n.includes(" ltr")) return "L";
                  if(n.includes("dozen")||n.includes("pack of")) return "pcs";
                  return "pcs";
                }

                function guessCategory(name,cat){
                  const n=(name+" "+cat).toLowerCase();
                  if(n.includes("chicken")||n.includes("mutton")||n.includes("fish")||n.includes("meat")||n.includes("prawn")) return "Meat & Poultry";
                  if(n.includes("milk")||n.includes("paneer")||n.includes("cream")||n.includes("butter")||n.includes("cheese")||n.includes("curd")||n.includes("yogurt")||n.includes("ghee")||n.includes("khoya")) return "Dairy";
                  if(n.includes("oil")||n.includes("atta")||n.includes("flour")||n.includes("rice")||n.includes("dal")||n.includes("lentil")||n.includes("sugar")||n.includes("salt")||n.includes("spice")||n.includes("masala")) return "Dry Goods";
                  if(n.includes("onion")||n.includes("tomato")||n.includes("potato")||n.includes("carrot")||n.includes("vegetable")||n.includes("sabzi")) return "Fresh Vegetables";
                  if(n.includes("apple")||n.includes("mango")||n.includes("banana")||n.includes("fruit")) return "Fruits";
                  if(n.includes("juice")||n.includes("drink")||n.includes("water")||n.includes("soda")||n.includes("cold drink")) return "Beverages";
                  if(n.includes("soap")||n.includes("detergent")||n.includes("cleaner")||n.includes("sanitizer")) return "Cleaning & Hygiene";
                  if(n.includes("foil")||n.includes("plastic")||n.includes("wrap")||n.includes("bag")||n.includes("box")||n.includes("pack")) return "Packaging";
                  if(n.includes("gas")||n.includes("cylinder")||n.includes("fuel")) return "Gas & Fuel";
                  return "Dry Goods";
                }

                lookupProduct(bc).then(result=>{
                  if(result&&result.name){
                    setNewItem(prev=>({...prev,name:result.name,brand:result.brand,barcode:bc,unit:result.unit,cat:result.cat}));
                    setScanLookup(result);
                    setScanError("✅ "+result.source+": "+result.name+(result.brand?" · "+result.brand:"")+(result.weight?" · "+result.weight:""));
                  } else {
                    setScanError("❌ Product not found. Fill details manually.");
                    setScanLookup(null);
                  }
                });
              }
              else scanAnimRef.current=requestAnimationFrame(detect);
            }).catch(()=>{scanAnimRef.current=requestAnimationFrame(detect);});
          }
          scanAnimRef.current=requestAnimationFrame(detect);
        } else { setScanError("Barcode scanning not supported on this browser. Enter barcode manually."); }
      },300);
    } catch(e){ setScanError("Camera access denied. Enter barcode manually."); setScanning(false); }
  }
  function addItem(){
    if(!newItem.name.trim()) return;
    setItems(p=>[...p,{...newItem,id:"it-"+Date.now(),inStock:+newItem.inStock||0,minStock:+newItem.minStock||0,perPax:+newItem.perPax||0}]);
    setNewItem({name:"",barcode:"",brand:"",supplier:"",cat:"Dry Goods",unit:"pcs",inStock:0,minStock:10,perPax:0,location:"Store A"});
    setScanResult(""); setScanError(""); stopScan(); setShowAdd(false);
  }

  const upcoming  = safeEvs.filter(e=>e.date>=TODAY);
  const totalPax  = upcoming.reduce((s,e)=>s+(+e.pax||0),0);
  const fld = {width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"};

  const filteredItems = items.filter(i=>{
    const mc=catFil==="All"||i.cat===catFil;
    const ms=!search.trim()||i.name.toLowerCase().includes(search.toLowerCase())||(i.h||"").includes(search)||(i.barcode||"").includes(search)||(i.brand||"").toLowerCase().includes(search.toLowerCase());
    return mc&&ms;
  });

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:22,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:.5}}>📦 {T2("Store & Inventory")}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:3}}>{items.length} {T2("items")} · {orders.filter(o=>o.status==="Ordered").length} {T2("pending orders")}</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)} color={showAdd?C.muted:C.gold} style={{fontSize:12,padding:"10px 18px",borderRadius:12}}>{showAdd?"✕ Cancel":"+ "+T2("Add Item")}</Btn>
      </div>

      {/* Add form */}
      {showAdd&&(
        <div style={{background:C.wineBg,border:`1px solid ${C.wineBorder}`,borderRadius:12,padding:"14px 18px",marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:10}}>📦 Add New Inventory Item</div>
          {/* Scanner */}
          <div style={{background:"rgba(107,24,24,.06)",borderRadius:9,padding:"9px 12px",marginBottom:10,border:`1px dashed ${C.wineBorder}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:scanning?8:0}}>
              <div><div style={{fontSize:12,fontWeight:600,color:C.gold}}>📷 Scan Barcode</div><div style={{fontSize:12,color:C.muted}}>Point camera at barcode · or enter manually below</div></div>
              {!scanning?<button onClick={startScan} style={{padding:"5px 12px",borderRadius:7,background:C.gold,color:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>📷 Scan</button>
                        :<button onClick={stopScan}  style={{padding:"5px 10px",borderRadius:7,background:C.red, color:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>✕</button>}
            </div>
            {scanning&&<video ref={scanVideoRef} autoPlay playsInline muted style={{width:"100%",maxHeight:160,borderRadius:7,objectFit:"cover",background:"#000",display:"block"}}/>}
            {scanResult&&<div style={{marginTop:5,fontSize:12,fontWeight:600,color:C.green}}>✓ Scanned: {scanResult}</div>}
            {scanError&&<div style={{marginTop:4,fontSize:12,color:C.amber}}>{scanError}</div>}
          </div>
          {/* Fields */}
          <div style={{marginBottom:7}}>
            <div style={{fontSize:11,color:C.gold,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>Item Name *</div>
            <input value={newItem.name} onChange={e=>setNewItem(p=>({...p,name:e.target.value}))} placeholder="e.g. Dinner Plates (10 inch)" style={{...fld,fontSize:12}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:7}}>
            {[{l:"Barcode",k:"barcode",ph:"Auto or manual"},{l:"Brand",k:"brand",ph:"Brand name"},{l:"Supplier",k:"supplier",ph:"Supplier name"}].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:11,color:C.gold,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>{f.l}</div>
                <input value={newItem[f.k]||""} onChange={e=>setNewItem(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={fld}/>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 80px 110px",gap:8,marginBottom:10}}>
            <div>
              <div style={{fontSize:11,color:C.gold,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>Category</div>
              <select value={newItem.cat} onChange={e=>setNewItem(p=>({...p,cat:e.target.value}))} style={fld}>
                {CATEGORIES.map(ct=><option key={ct}>{ct}</option>)}
              </select>
            </div>
            {[{l:"Unit",k:"unit",ph:"pcs"},{l:"In Stock",k:"inStock",t:"number"},{l:"Min Stock",k:"minStock",t:"number"},{l:"Per Pax",k:"perPax",t:"number"},{l:"Location",k:"location",ph:"Store A"}].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:11,color:C.gold,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>{f.l}</div>
                <input type={f.t||"text"} value={newItem[f.k]||""} onChange={e=>setNewItem(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph||"0"} style={fld}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>{setShowAdd(false);stopScan();setScanResult("");setScanError("");}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
            <Btn onClick={addItem} color={C.gold} style={{fontSize:12,padding:"8px 20px"}}>✓ Add to Inventory</Btn>
          </div>
        </div>
      )}

      {/* Order modal */}
      {showOrder&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.surface,borderRadius:14,padding:"28px 32px",width:340}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>🛒 Place Order</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:12}}>{items.find(i=>i.id===showOrder)?.name}</div>
            <input type="number" value={orderQty} onChange={e=>setOrderQty(e.target.value)} placeholder="Quantity to order" autoFocus
              style={{width:"100%",padding:"9px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box",marginBottom:12}}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <Btn onClick={()=>{setShowOrder(null);setOrderQty("");}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
              <Btn onClick={()=>{
                const item=items.find(i=>i.id===showOrder);
                if(!item||!orderQty||+orderQty<=0) return;
                setOrders(p=>[...p,{id:"ORD-"+Date.now(),itemId:item.id,itemName:item.name,cat:item.cat,qty:+orderQty,unit:item.unit,status:"Ordered",orderedAt:new Date().toLocaleString("en-IN"),receivedQty:0}]);
                setShowOrder(null);setOrderQty("");
              }} color={C.wine} style={{fontSize:12,padding:"8px 20px"}}>{T2("Place Order")}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:16,paddingBottom:10,borderBottom:`1px solid ${C.border}`,overflowX:"auto"}}>
        {[{v:"inventory",l:T2("📦 Inventory")},{v:"scan",l:T2("📷 Scan & Stock")},{v:"issue",l:T2("🧮 Smart Issue")},{v:"orders",l:T2("🛒 Orders")},{v:"requirements",l:T2("📋 Event Requirements")}].map(t=>(
          <button key={t.v} onClick={()=>setTab(t.v)} style={{padding:"10px 18px",borderRadius:12,fontSize:12,fontWeight:tab===t.v?600:400,cursor:"pointer",whiteSpace:"nowrap",minHeight:40,
            background:tab===t.v?C.gold+"15":"transparent",color:tab===t.v?C.gold:C.muted,border:`1.5px solid ${tab===t.v?C.gold+"40":C.border}`,
            boxShadow:tab===t.v?`0 2px 8px ${C.gold}10`:"none"}}>{lang==="hi"&&t.hi?t.hi:t.l}</button>
        ))}
      </div>

      {/* ── INVENTORY ── */}
      {tab==="inventory"&&(
        <div>
          {/* Search + filter row */}
          <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200,position:"relative"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={T2("Search items…")}
                style={{width:"100%",padding:"12px 16px 12px 40px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:44}}/>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:15,color:C.muted,pointerEvents:"none"}}>🔍</span>
            </div>
            <select value={catFil} onChange={e=>setCatFil(e.target.value)} style={{padding:"10px 16px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:44,appearance:"auto"}}>
              <option value="All">{T2("All Categories")} ({items.length})</option>
              {CATEGORIES.map(ct=><option key={ct}>{ct} ({items.filter(i=>i.cat===ct).length})</option>)}
            </select>
          </div>

          {/* Quick stats bar */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[
              {l:T2("Total"),v:filteredItems.length,c:C.text,bg:C.surface},
              {l:T2("In Stock"),v:filteredItems.filter(i=>i.inStock>0&&i.inStock>i.minStock).length,c:C.green,bg:C.greenBg},
              {l:T2("Low Stock"),v:filteredItems.filter(i=>i.inStock>0&&i.inStock<=i.minStock).length,c:C.amber,bg:C.amberBg},
              {l:T2("Out of Stock"),v:filteredItems.filter(i=>i.inStock<=0).length,c:C.red,bg:C.redBg},
            ].map(s=>(
              <div key={s.l} style={{flex:1,background:s.bg,borderRadius:10,padding:"8px 12px",textAlign:"center",border:`1px solid ${s.c}20`}}>
                <div style={{fontSize:16,fontWeight:700,color:s.c}}>{s.v}</div>
                <div style={{fontSize:10,color:C.muted}}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Items list — clean card rows */}
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {filteredItems.map((item,idx)=>{
              const low=item.inStock>0&&item.inStock<=item.minStock;
              const out=item.inStock<=0;
              const sc=out?C.red:low?C.amber:C.green;
              const isEditing=editStock===item.id;
              return (
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:idx%2===0?C.surface:C.darkCard,borderRadius:12,border:`1px solid ${C.border}`,minHeight:52}}>
                  {/* Status dot */}
                  <div style={{width:8,height:8,borderRadius:"50%",background:sc,flexShrink:0,boxShadow:`0 0 6px ${sc}50`}}/>

                  {/* Name + meta */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}{item.h&&<span style={{fontSize:11,color:C.muted,marginLeft:6}}>({item.h})</span>}</div>
                    <div style={{fontSize:11,color:C.faint,marginTop:1}}>{item.cat}{item.brand?" · "+item.brand:""}</div>
                  </div>

                  {/* Stock display or edit */}
                  {isEditing?(
                    <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                      <input type="number" value={editVal} onChange={e=>setEditVal(e.target.value)} autoFocus
                        style={{width:60,padding:"8px 10px",borderRadius:10,border:`2px solid ${C.gold}`,fontSize:14,fontWeight:700,color:C.text,background:C.bg,textAlign:"center"}}/>
                      <button onClick={()=>{setItems(p=>p.map(i=>i.id!==item.id?i:{...i,inStock:+editVal||0}));setEditStock(null);}}
                        style={{width:36,height:36,borderRadius:10,background:C.green,color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✓</button>
                      <button onClick={()=>setEditStock(null)}
                        style={{width:36,height:36,borderRadius:10,background:C.surface,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                    </div>
                  ):(
                    <div onClick={()=>{setEditStock(item.id);setEditVal(String(item.inStock));}}
                      style={{minWidth:70,textAlign:"right",cursor:"pointer",flexShrink:0,padding:"6px 10px",borderRadius:8,background:sc+"10",border:`1px solid ${sc}20`}}>
                      <div style={{fontSize:15,fontWeight:700,color:sc}}>{item.inStock}</div>
                      <div style={{fontSize:10,color:C.muted}}>{item.unit}</div>
                    </div>
                  )}

                  {/* Status badge */}
                  <div style={{flexShrink:0,minWidth:44,textAlign:"center"}}>
                    <span style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:8,background:out?C.redBg:low?C.amberBg:C.greenBg,color:sc,border:`1px solid ${sc}20`}}>{out?T2("Out"):low?T2("Low"):T2("OK")}</span>
                  </div>

                  {/* Order button */}
                  <button onClick={()=>{setShowOrder(item.id);setOrderQty(String(Math.max(item.minStock-item.inStock,item.minStock)));}}
                    style={{padding:"8px 14px",borderRadius:10,fontSize:11,fontWeight:600,cursor:"pointer",background:"transparent",color:C.gold,border:`1px solid ${C.gold}30`,minHeight:36,flexShrink:0}}>{T2("Order")}</button>
                </div>
              );
            })}
            {filteredItems.length===0&&<div style={{textAlign:"center",padding:40,background:C.surface,borderRadius:12,color:C.muted,fontSize:13}}>{T2("No items found.")}</div>}
          </div>

          <div style={{marginTop:12,fontSize:11,color:C.faint,textAlign:"center"}}>{T2("Tap stock number to edit")} · {filteredItems.length} {T2("items")}</div>
        </div>
      )}

      {/* ── SCAN & STOCK IN/OUT ── */}
      {tab==="scan"&&(
        <div>
          {/* Mode toggle */}
          <div style={{display:"flex",gap:0,marginBottom:14,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`}}>
            <button onClick={()=>setScanMode("in")} style={{flex:1,padding:"12px",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",
              background:scanMode==="in"?"#1A3A1A":"transparent",color:scanMode==="in"?C.green:C.muted}}>📥 {T2("Stock In")}</button>
            <button onClick={()=>setScanMode("out")} style={{flex:1,padding:"12px",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",
              background:scanMode==="out"?"#3A1A1A":"transparent",color:scanMode==="out"?C.red:C.muted}}>📤 {T2("Stock Out")}</button>
          </div>

          {/* Scanner */}
          <Card style={{marginBottom:12,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:scanning?10:0}}>
              <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>📷 {T2("Scan Barcode")}</div><div style={{fontSize:12,color:C.muted}}>{T2("Point camera at barcode")}</div></div>
              {!scanning?<button onClick={()=>{setScanItem(null);setScanResult("");setScanError("");startScan();}} style={{padding:"8px 16px",borderRadius:10,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>📷 {T2("Scan")}</button>
                        :<button onClick={stopScan} style={{padding:"8px 14px",borderRadius:10,background:C.red,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>✕ {T2("Stop")}</button>}
            </div>
            {scanning&&<video ref={scanVideoRef} autoPlay playsInline muted style={{width:"100%",maxHeight:200,borderRadius:10,objectFit:"cover",background:"#000",display:"block",marginBottom:8}}/>}
            {scanning&&<div style={{fontSize:12,color:C.amber,textAlign:"center"}}>📡 {T2("Scanning…")}</div>}
          </Card>

          {/* Manual search fallback */}
          <div style={{marginBottom:12}}>
            <input value={search} onChange={e=>{setSearch(e.target.value);setScanItem(null);}} placeholder={T2("Search items…")+" / "+T2("Barcode")}
              style={{width:"100%",padding:"12px 16px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:44}}/>
            {search.trim()&&!scanItem&&(
              <div style={{maxHeight:200,overflowY:"auto",background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,marginTop:6}}>
                {items.filter(i=>i.name.toLowerCase().includes(search.toLowerCase())||(i.h||"").includes(search)||(i.barcode||"").includes(search)).slice(0,10).map(i=>(
                  <div key={i.id} onClick={()=>{setScanItem(i);setSearch("");}} style={{padding:"10px 14px",borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer",display:"flex",justifyContent:"space-between"}}>
                    <div><div style={{fontSize:12,fontWeight:600,color:C.text}}>{i.name}{i.h?<span style={{fontSize:10,color:C.muted,marginLeft:4}}>({i.h})</span>:""}</div>
                    <div style={{fontSize:11,color:C.muted}}>{i.cat} · {i.barcode||"No barcode"}</div></div>
                    <div style={{fontSize:12,fontWeight:700,color:i.inStock>0?C.green:C.red}}>{i.inStock} {i.unit}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scanned / Selected item */}
          {scanItem&&(
            <Card style={{marginBottom:12,padding:"16px",border:`2px solid ${scanMode==="in"?C.green:C.red}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:C.text}}>{scanItem.name}</div>
                  <div style={{fontSize:12,color:C.muted}}>{scanItem.h||""} · {scanItem.cat} · {scanItem.barcode||"No barcode"}</div>
                </div>
                <div style={{textAlign:"center",padding:"8px 14px",borderRadius:10,background:scanItem.inStock>0?C.greenBg:C.redBg}}>
                  <div style={{fontSize:20,fontWeight:700,color:scanItem.inStock>0?C.green:C.red}}>{scanItem.inStock}</div>
                  <div style={{fontSize:10,color:C.muted}}>{scanItem.unit} {T2("Current Stock")}</div>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{T2("Qty")} *</div>
                  <input type="number" value={scanQty} onChange={e=>setScanQty(e.target.value)} placeholder="0"
                    style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:16,fontWeight:700,color:C.text,background:C.surface,boxSizing:"border-box",textAlign:"center",minHeight:44}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{T2("Reason")}</div>
                  <select value={scanReason} onChange={e=>setScanReason(e.target.value)}
                    style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,appearance:"auto",minHeight:44}}>
                    {scanMode==="in"
                      ?["Purchase","Return","Transfer In","Opening Stock","Correction"].map(r=><option key={r} value={r}>{T2(r)}</option>)
                      :["Event Use","Damage","Expired","Transfer Out","Correction"].map(r=><option key={r} value={r}>{T2(r)}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={()=>{
                const qty=+scanQty;if(!qty||qty<=0) return;
                const newStock=scanMode==="in"?scanItem.inStock+qty:Math.max(0,scanItem.inStock-qty);
                setItems(p=>p.map(i=>i.id!==scanItem.id?i:{...i,inStock:newStock}));
                setTransactions(p=>[{id:"tx-"+Date.now(),itemId:scanItem.id,itemName:scanItem.name,type:scanMode,qty,reason:scanReason,time:new Date().toLocaleString("en-IN"),newStock},...p]);
                setScanItem({...scanItem,inStock:newStock});setScanQty("");
              }} disabled={!scanQty||+scanQty<=0}
                style={{width:"100%",padding:"14px",borderRadius:12,border:"none",fontSize:14,fontWeight:700,cursor:scanQty&&+scanQty>0?"pointer":"not-allowed",minHeight:48,
                  background:scanMode==="in"?`linear-gradient(135deg,${C.green},#1A5A30)`:`linear-gradient(135deg,${C.red},#5A1A1A)`,
                  color:"#fff",opacity:scanQty&&+scanQty>0?1:.4}}>
                {scanMode==="in"?`📥 ${T2("Stock In")} +${scanQty||0} ${scanItem.unit}`:`📤 ${T2("Stock Out")} −${scanQty||0} ${scanItem.unit}`}
              </button>
            </Card>
          )}

          {/* Scan result for new items */}
          {scanResult&&!scanItem&&(
            <Card style={{marginBottom:12,padding:0,overflow:"hidden",border:`1px solid ${scanLookup?C.greenBorder:C.amberBorder}`}}>
              {/* Product image + details from API */}
              {scanLookup&&(
                <div style={{display:"flex",gap:0}}>
                  {scanLookup.image&&<img src={scanLookup.image} alt={scanLookup.name} style={{width:90,height:90,objectFit:"cover",flexShrink:0}} onError={e=>e.target.style.display="none"}/>}
                  <div style={{flex:1,padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.text}}>{scanLookup.name}</div>
                        {scanLookup.brand&&<div style={{fontSize:12,color:C.gold,marginTop:2}}>{scanLookup.brand}</div>}
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
                          {scanLookup.weight&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.surface,border:`1px solid ${C.border}`,color:C.muted}}>📦 {scanLookup.weight}</span>}
                          {scanLookup.energy&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.surface,border:`1px solid ${C.border}`,color:C.muted}}>🔥 {scanLookup.energy}</span>}
                          <span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green}}>✅ {scanLookup.source}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {!scanLookup&&<div style={{padding:"12px 14px",background:C.amberBg}}>
                <div style={{fontSize:12,fontWeight:700,color:C.amber}}>🔍 {T2("Barcode")}: {scanResult}</div>
                <div style={{fontSize:11,color:C.amber,marginTop:3}}>{scanError}</div>
              </div>}
              {scanLookup&&<div style={{fontSize:11,color:C.green,padding:"0 14px 6px",fontStyle:"italic"}}>{scanError}</div>}
              <div style={{padding:"10px 14px",borderTop:scanLookup?`1px solid ${C.border}`:"none",display:"flex",gap:8}}>
                <button onClick={()=>{setShowAdd(true);}} style={{flex:1,padding:"10px 14px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>+ {T2("Save to Inventory")}</button>
                <button onClick={()=>{setScanResult("");setScanLookup(null);setScanItem(null);setScanError("");}} style={{padding:"10px 14px",borderRadius:10,background:C.surface,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:40}}>✕</button>
              </div>
            </Card>
          )}

          {/* Recent transactions */}
          <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase"}}>{T2("Transaction History")} ({transactions.length})</div>
          {transactions.length===0&&<div style={{textAlign:"center",padding:20,background:C.bg,borderRadius:12,color:C.muted,fontSize:12}}>{T2("No transactions yet. Scan an item to begin.")}</div>}
          {transactions.slice(0,20).map(tx=>(
            <div key={tx.id} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 14px",background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,marginBottom:4}}>
              <div style={{width:32,height:32,borderRadius:8,background:tx.type==="in"?C.greenBg:C.redBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                {tx.type==="in"?"📥":"📤"}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:C.text}}>{tx.itemName}</div>
                <div style={{fontSize:11,color:C.muted}}>{tx.reason} · {tx.time}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:14,fontWeight:700,color:tx.type==="in"?C.green:C.red}}>{tx.type==="in"?"+":"-"}{tx.qty}</div>
                <div style={{fontSize:10,color:C.muted}}>→ {tx.newStock}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SMART ISSUE — auto-calculate dept-wise ingredient bags ── */}
      {tab==="issue"&&(()=>{
        const issueEvs = safeEvs.filter(e=>e.date===TODAY||e.date===TOMORROW).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
        const filtEvs = issueDate==="all"?issueEvs:issueEvs.filter(e=>e.date===issueDate);

        // Calculate all ingredients needed, grouped by kitchen section
        const sectionBags = {};
        filtEvs.forEach(ev=>{
          const pax = +ev.pax||0;
          safeArr(ev.menu).forEach(dishName=>{
            const sec = guessSectionForDish(dishName);
            if(sec==="Beverages") return;
            const ingr = RECIPE_INGREDIENTS[dishName];
            if(!ingr) return;
            if(!sectionBags[sec]) sectionBags[sec] = {items:{},events:[],totalPax:0};
            if(!sectionBags[sec].events.find(e=>e.id===ev.id)) sectionBags[sec].events.push(ev);
            sectionBags[sec].totalPax += pax;
            ingr.forEach(ing=>{
              const key = ing.n;
              if(!sectionBags[sec].items[key]) sectionBags[sec].items[key] = {name:ing.n,hindi:ing.h||"",unit:ing.u,totalQty:0,dishes:[]};
              const qty = ing.q * pax;
              sectionBags[sec].items[key].totalQty += qty;
              sectionBags[sec].items[key].dishes.push({dish:dishName,pax,qty});
            });
          });
        });

        function fmtQty(q, u){
          if(u==="g"&&q>=1000) return (q/1000).toFixed(1)+" kg";
          if(u==="ml"&&q>=1000) return (q/1000).toFixed(1)+" L";
          return Math.round(q)+" "+u;
        }

        const secKeys = Object.keys(sectionBags).sort();
        const totalIngredients = secKeys.reduce((s,k)=>s+Object.keys(sectionBags[k].items).length,0);
        const totalIssued = Object.values(issuedItems).filter(Boolean).length;

        return(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>🧮 {T2("Smart Issue")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:14}}>{T2("Auto-calculated ingredient bags per kitchen section based on event menus and pax")}</div>

            {/* Date filter */}
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {[{v:"all",l:T2("All")},{v:TODAY,l:T2("Today")},{v:TOMORROW,l:T2("Tomorrow")}].map(d=>(
                <button key={d.v} onClick={()=>setIssueDate(d.v)} style={{padding:"8px 16px",borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:36,
                  background:issueDate===d.v?C.gold+"20":"transparent",color:issueDate===d.v?C.gold:C.muted,border:`1px solid ${issueDate===d.v?C.gold:C.border}`}}>{d.l}</button>
              ))}
              <div style={{flex:1}}/>
              <div style={{fontSize:12,color:C.green,fontWeight:700,padding:"8px 14px",borderRadius:10,background:C.greenBg}}>{totalIssued}/{totalIngredients} {T2("issued")}</div>
            </div>

            {/* Summary */}
            <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:80,background:C.surface,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.border}`,textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:700,color:C.gold}}>{filtEvs.length}</div><div style={{fontSize:10,color:C.muted}}>{T2("Events")}</div>
              </div>
              <div style={{flex:1,minWidth:80,background:C.surface,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.border}`,textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:700,color:C.text}}>{filtEvs.reduce((s,e)=>s+(+e.pax||0),0)}</div><div style={{fontSize:10,color:C.muted}}>{T2("Total Pax")}</div>
              </div>
              <div style={{flex:1,minWidth:80,background:C.surface,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.border}`,textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:700,color:C.text}}>{secKeys.length}</div><div style={{fontSize:10,color:C.muted}}>{T2("Sections")}</div>
              </div>
              <div style={{flex:1,minWidth:80,background:C.surface,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.border}`,textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:700,color:C.text}}>{totalIngredients}</div><div style={{fontSize:10,color:C.muted}}>{T2("Items")}</div>
              </div>
            </div>

            {secKeys.length===0&&<div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,color:C.muted,fontSize:13}}>{T2("No events with recipe data. Add recipes with ingredients to enable Smart Issue.")}</div>}

            {/* Section-wise bags */}
            {secKeys.map(sec=>{
              const bag = sectionBags[sec];
              const m2 = SECTION_META[sec]||{color:C.muted,icon:"🍽"};
              const ingList = Object.values(bag.items).sort((a,b)=>b.totalQty-a.totalQty);
              const secIssued = ingList.filter(ing=>issuedItems[sec+"_"+ing.name]).length;
              const allDone = secIssued===ingList.length;

              return(
                <Card key={sec} style={{marginBottom:12,padding:0,overflow:"hidden",border:allDone?`2px solid ${C.green}`:`1px solid ${C.border}`}}>
                  {/* Section header */}
                  <div style={{padding:"14px 16px",background:m2.color+"10",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:16,fontWeight:700,color:m2.color}}>{m2.icon} {T2(sec)}</span>
                        {allDone&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:C.green,color:"#0A0A0F",fontWeight:700}}>✅ {T2("All Issued")}</span>}
                      </div>
                      <div style={{fontSize:11,color:C.muted,marginTop:2}}>{bag.events.map(e=>e.guest+"("+e.pax+")").join(" + ")} = {bag.totalPax} pax</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:16,fontWeight:700,color:allDone?C.green:C.amber}}>{secIssued}/{ingList.length}</div>
                      <div style={{fontSize:10,color:C.muted}}>{T2("issued")}</div>
                    </div>
                  </div>

                  {/* Ingredient list */}
                  <div style={{padding:"8px 12px"}}>
                    <div style={{display:"grid",gridTemplateColumns:"32px 1fr 100px 32px",gap:4,padding:"6px 4px",borderBottom:`1px solid ${C.border}`,marginBottom:4}}>
                      <span/>
                      <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>{T2("Item")}</span>
                      <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",textAlign:"right"}}>{T2("Qty")}</span>
                      <span style={{fontSize:10,fontWeight:700,color:C.muted,textAlign:"center"}}>✓</span>
                    </div>
                    {ingList.map((ing,ii)=>{
                      const key=sec+"_"+ing.name;
                      const done=!!issuedItems[key];
                      const storeItem=items.find(i=>i.name.toLowerCase().includes(ing.name.split(" ")[0].toLowerCase())||(i.h||"").includes(ing.hindi));
                      const hasStock=storeItem&&storeItem.inStock>0;
                      return(
                        <div key={ii} style={{display:"grid",gridTemplateColumns:"32px 1fr 100px 32px",gap:4,padding:"8px 4px",borderBottom:ii<ingList.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"center",background:done?C.greenBg+"40":"transparent"}}>
                          <div style={{fontSize:12,color:C.muted,textAlign:"center"}}>{ii+1}</div>
                          <div>
                            <div style={{fontSize:12,fontWeight:done?400:600,color:done?C.green:C.text,textDecoration:done?"line-through":"none"}}>{ing.name} {ing.hindi?<span style={{fontSize:10,color:C.muted}}>({ing.hindi})</span>:""}</div>
                            {storeItem&&<div style={{fontSize:10,color:hasStock?C.green:C.red}}>{T2("In Stock")}: {storeItem.inStock} {storeItem.unit}</div>}
                            {!storeItem&&<div style={{fontSize:10,color:C.amber}}>⚠ {T2("Not in inventory")}</div>}
                          </div>
                          <div style={{textAlign:"right",fontSize:13,fontWeight:700,color:done?C.green:C.text}}>{fmtQty(ing.totalQty,ing.unit)}</div>
                          <div onClick={()=>setIssuedItems(p=>({...p,[key]:!done}))}
                            style={{width:28,height:28,borderRadius:6,border:`2px solid ${done?C.green:C.border}`,background:done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",margin:"0 auto"}}>
                            {done&&<span style={{color:"#0A0A0F",fontSize:12,fontWeight:700}}>✓</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Issue all button */}
                  {!allDone&&(
                    <div style={{padding:"10px 16px",borderTop:`1px solid ${C.border}`}}>
                      <button onClick={()=>{const up={};ingList.forEach(ing=>{up[sec+"_"+ing.name]=true;});setIssuedItems(p=>({...p,...up}));}}
                        style={{width:"100%",padding:"10px",borderRadius:10,background:`linear-gradient(135deg,${m2.color},${m2.color}80)`,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>
                        ✅ {T2("Issue All")} — {sec} ({ingList.length} {T2("items")})
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* ── ORDERS ── */}
      {tab==="orders"&&(
        <div>
          {orders.length===0&&<div style={{textAlign:"center",padding:36,background:C.bg,borderRadius:12,fontSize:12,color:C.muted}}>{T2("No orders placed yet.")}</div>}
          {[...orders].reverse().map(ord=>{
            const sc=ord.status==="Received"?C.green:C.amber;
            const sb=ord.status==="Received"?C.greenBg:C.amberBg;
            return (
              <Card key={ord.id} style={{padding:"12px 16px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:ord.status==="Ordered"?8:0}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{ord.itemName}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{ord.qty} {ord.unit} · Ordered: {ord.orderedAt}</div>
                    {ord.receivedAt&&<div style={{fontSize:12,color:C.green,marginTop:1}}>✓ Received {ord.receivedQty} at {ord.receivedAt}</div>}
                  </div>
                  <span style={{fontSize:12,fontWeight:700,padding:"6px 12px",borderRadius:20,background:sb,color:sc}}>{ord.status}</span>
                </div>
                {ord.status==="Ordered"&&(
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input type="number" placeholder={`Max ${ord.qty}`} defaultValue={ord.qty} id={"rcv-"+ord.id}
                      style={{width:110,padding:"5px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}/>
                    <Btn onClick={()=>{
                      const qty=+(document.getElementById("rcv-"+ord.id)?.value||0);
                      if(qty<=0) return;
                      setItems(p=>p.map(i=>i.id!==ord.itemId?i:{...i,inStock:i.inStock+qty}));
                      setOrders(p=>p.map(o=>o.id!==ord.id?o:{...o,status:"Received",receivedQty:qty,receivedAt:new Date().toLocaleString("en-IN")}));
                    }} color={C.green} style={{fontSize:11,padding:"5px 12px"}}>{T2("✓ Mark Received")}</Btn>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── EVENT REQUIREMENTS ── */}
      {tab==="requirements"&&(
        <div>
          <div style={{background:C.wineBg,border:`1px solid ${C.wineBorder}`,borderRadius:10,padding:"12px 16px",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:C.gold,fontFamily:"var(--font-display)",marginBottom:2}}>📋 Auto-Requirements for Upcoming Events</div>
            <div style={{fontSize:11,color:C.gold,opacity:.8}}>{upcoming.length} events · {totalPax.toLocaleString()} total pax</div>
          </div>
          {upcoming.length===0&&<div style={{textAlign:"center",padding:28,background:C.bg,borderRadius:10,fontSize:12,color:C.muted}}>No upcoming events. Add from Dashboard.</div>}
          {upcoming.length>0&&(
            <div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {upcoming.map(ev=>(
                  <div key={ev.id} style={{padding:"6px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:9}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.text}}>{ev.guest}</div>
                    <div style={{fontSize:12,color:C.muted}}>{ev.date} · {ev.pax} pax</div>
                  </div>
                ))}
              </div>
              <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 90px 90px 90px 90px",background:C.bg,padding:"7px 14px",borderBottom:`1px solid ${C.border}`}}>
                  {["Item","In Stock","Required","Shortfall","Action"].map(h=><div key={h} style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>{h}</div>)}
                </div>
                {items.filter(i=>i.perPax>0).map((item,idx)=>{
                  const req=Math.ceil(item.perPax*totalPax);
                  const short=Math.max(0,req-item.inStock);
                  return (
                    <div key={item.id} style={{display:"grid",gridTemplateColumns:"2fr 90px 90px 90px 90px",padding:"8px 14px",borderBottom:`1px solid ${C.borderLight}`,alignItems:"center",background:idx%2===0?C.surface:"#FAFAFA"}}>
                      <div><div style={{fontSize:12,fontWeight:500,color:C.text}}>{item.name}</div><div style={{fontSize:11,color:C.muted}}>{item.perPax}× per pax</div></div>
                      <div style={{fontSize:12,fontWeight:600,color:item.inStock>=req?C.green:C.red}}>{item.inStock}</div>
                      <div style={{fontSize:12,fontWeight:600,color:C.text}}>{req}</div>
                      <div style={{fontSize:12,fontWeight:700,color:short>0?C.red:C.green}}>{short>0?`−${short}`:"✓"}</div>
                      {short>0
                        ?<button onClick={()=>{setShowOrder(item.id);setOrderQty(String(short));}}
                            style={{padding:"4px 9px",borderRadius:8,fontSize:10,fontWeight:600,cursor:"pointer",background:C.red,color:"#fff",border:"none"}}>Order {short}</button>
                        :<span style={{fontSize:12,color:C.green,fontWeight:600}}>{T2("OK ✓")}</span>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}


function MenuPackagesView({lang="en"}) {
  const T2 = s => T(s, lang);
  const pkgNames = Object.keys(MENU_PACKAGES);
  const [selPkg, setSelPkg] = useState(null);

  const PKG_META = {
    "Multi-Cuisine Veg":    {icon:"🌱",c:"#4DAA6A",bg:C.greenBg},
    "Multi-Cuisine Non-Veg":{icon:"🍗",c:"#D06040",bg:C.redBg},
    "Magnum Veg":           {icon:"⭐",c:"#D4A843",bg:C.goldBg},
    "Magnum Non-Veg":       {icon:"🌟",c:"#D06040",bg:C.redBg},
    "Double Magnum Veg":    {icon:"🏆",c:"#50B0A0",bg:C.tealBg},
    "Double Magnum Non-Veg":{icon:"🏅",c:"#5B8FD0",bg:C.blueBg},
    "Luxury Veg":           {icon:"👑",c:"#8A70C8",bg:C.purpleBg},
    "Luxury Non-Veg":       {icon:"💎",c:"#5B8FD0",bg:C.blueBg},
  };

  // ── Package list (default view) ──
  if(!selPkg) return (
    <div>
      <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>📜 {T2("Menu")}</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:20}}>{pkgNames.length} {T2("packages")} · {T2("Full catering menus for all events")}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        {pkgNames.map(pkg=>{
          const m=PKG_META[pkg]||{icon:"📋",c:C.gold,bg:C.goldBg};
          const items=(MENU_PACKAGES[pkg]||[]).filter(d=>guessSectionForDish(d)!=="Beverages");
          return (
            <button key={pkg} onClick={()=>setSelPkg(pkg)}
              style={{background:C.surface,border:`2px solid ${m.c}30`,borderRadius:16,padding:"20px 18px",cursor:"pointer",textAlign:"left",display:"flex",gap:14,alignItems:"center",minHeight:80,transition:"all .15s"}}>
              <div style={{fontSize:32,flexShrink:0}}>{m.icon}</div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>{pkg}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:3}}>{items.length} {T2("dishes")}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Selected package detail ──
  const pm = PKG_META[selPkg]||{icon:"📋",c:C.gold,bg:C.goldBg};
  const menu = (MENU_PACKAGES[selPkg]||[]).filter(d=>guessSectionForDish(d)!=="Beverages");
  const bySection = {};
  menu.filter(d=>guessSectionForDish(d)!=="Beverages").forEach(d=>{const sec=guessSectionForDish(d);if(!bySection[sec])bySection[sec]=[];bySection[sec].push(d);});

  return (
    <div>
      <button onClick={()=>setSelPkg(null)} style={{padding:"10px 18px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",marginBottom:16,minHeight:44}}>← {T2("All Packages")}</button>

      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:40}}>{pm.icon}</div>
        <div>
          <div style={{fontSize:22,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{selPkg}</div>
          <div style={{fontSize:13,color:pm.c,marginTop:3}}>{menu.length} {T2("dishes")} · {Object.keys(bySection).length} {T2("sections")}</div>
        </div>
      </div>

      {Object.entries(bySection).filter(([sec])=>sec!=="Beverages").map(([sec,dishes])=>{
        const m2=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
        return (
          <div key={sec} style={{marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:m2.color,marginBottom:8}}>{m2.icon} {T2(sec)} ({dishes.length})</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {dishes.map((d,i)=>(
                <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",fontSize:12,color:C.text}}>
                  {d}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RepairMaintenance({lang="en", currentUser=null, currentDept="kitchen"}) {
  const T2 = s => T(s, lang);

  // ─── Master config ───────────────────────────────────────────────
  const ASSIGN_POOL = [
    {id:"akhtar",     name:"Akhtar",        role:"Equipment Servicing", dept:"maintenance", icon:"🔧", color:"#185FA5", phone:"98100-10001"},
    {id:"rajender",   name:"Rajender Chef", role:"Equipment Purchasing",dept:"maintenance", icon:"🛒", color:"#B05A10", phone:"98100-10002"},
    {id:"gopal",      name:"Gopal",         role:"Quality / Operations",dept:"kitchen",     icon:"📋", color:"#1A7A42", phone:"98100-10003"},
    {id:"yatender",   name:"Yatender",      role:"AP Base Kitchen",     dept:"kitchen",     icon:"🏠", color:C.gold,    phone:"98100-10004"},
    {id:"lokesh",     name:"Lokesh",        role:"Chinese Section",     dept:"kitchen",     icon:"🥢", color:"#C084FC", phone:"98100-10005"},
    {id:"pushpander", name:"Pushpander",    role:"Transport",           dept:"transport",   icon:"🚛", color:C.teal,    phone:"98100-10006"},
    {id:"self",       name:"Self / Manager",role:"Self-assigned",       dept:"all",         icon:"👤", color:C.muted,   phone:""},
  ];
  const CATEGORIES = [
    {v:"Gas & Burner",         icon:"🔥"}, {v:"Refrigeration",    icon:"❄️"},
    {v:"Exhaust & Chimney",    icon:"💨"}, {v:"Tandoor",          icon:"🫓"},
    {v:"Electrical",           icon:"⚡"}, {v:"Plumbing",         icon:"🚿"},
    {v:"Utensils & Crockery",  icon:"🍽"}, {v:"Vehicle",          icon:"🚛"},
    {v:"Furniture & Civil",    icon:"🪑"}, {v:"IT / Software",    icon:"💻"},
    {v:"Other",                icon:"📦"},
  ];
  const DEPT_LABELS = {kitchen:"Kitchen",service:"Service",crockery:"Crockery",beverages:"Beverages",transport:"Transport",odc:"ODC",management:"Management"};
  const PRI = [{v:"Low",c:C.green},{v:"Medium",c:C.amber},{v:"High",c:C.red},{v:"Urgent",c:"#E05030"}];
  const STATUS_FLOW = ["Open","In Progress","Pending Approval","Resolved","Closed"];
  const STATUS_COLORS = {"Open":C.red,"In Progress":C.amber,"Pending Approval":"#8A70C8","Resolved":C.green,"Closed":C.faint};
  const VENUES_R = ["Ambria Pushpanjali","Ambria Exotica","Manaktala Farm","Ambria Restro","All Properties"];

  const [tickets, setTickets] = useState([
    {id:"RM-001",title:"Tandoor #2 clay lining cracked",cat:"Tandoor",venue:"Ambria Pushpanjali",priority:"High",assignTo:"akhtar",status:"In Progress",dept:"kitchen",createdBy:"Lokesh",date:relDate(-2),notes:"Crack visible on inner wall. Not safe for use above 200°C.",updates:[{by:"Akhtar",date:relDate(-1),msg:"Ordered new clay lining. ETA 2 days."}]},
    {id:"RM-002",title:"Walk-in fridge compressor noise",cat:"Refrigeration",venue:"Ambria Pushpanjali",priority:"Urgent",assignTo:"akhtar",status:"Open",dept:"kitchen",createdBy:"Bipin",date:relDate(-1),notes:"Loud grinding noise from compressor. Temperature fluctuating.",updates:[]},
    {id:"RM-003",title:"Chinese wok burner low flame",cat:"Gas & Burner",venue:"Ambria Pushpanjali",priority:"Medium",assignTo:"akhtar",status:"Open",dept:"kitchen",createdBy:"Lokesh",date:TODAY,notes:"Wok station #3 flame too low for stir-fry. Gas pressure issue.",updates:[]},
    {id:"RM-004",title:"Need 20 new copper handi",cat:"Utensils & Crockery",venue:"All Properties",priority:"Low",assignTo:"rajender",status:"Pending Approval",dept:"crockery",createdBy:"Gopal",date:relDate(-3),notes:"Current copper handis dented and discolored. Need for luxury functions.",updates:[{by:"Rajender",date:relDate(-2),msg:"Got 3 vendor quotes. Best: ₹850/pc from Rewari supplier."}]},
    {id:"RM-005",title:"Fridge truck AC not cooling properly",cat:"Vehicle",venue:"All Properties",priority:"High",assignTo:"akhtar",status:"In Progress",dept:"transport",createdBy:"Abhi",date:relDate(-1),notes:"Temperature not holding below 4°C during transport.",updates:[{by:"Akhtar",date:TODAY,msg:"Mechanic visiting tomorrow morning. Gas refill needed."}]},
    {id:"RM-006",title:"Service station exhaust fan broken",cat:"Exhaust & Chimney",venue:"Ambria Exotica",priority:"Medium",assignTo:"akhtar",status:"Open",dept:"service",createdBy:"Raghvendra",date:TODAY,notes:"Fan not running. Kitchen getting smoky during service.",updates:[]},
  ]);
  const [showNew, setShowNew]   = useState(false);
  const [selId, setSelId]       = useState(null);
  const [updMsg, setUpdMsg]     = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDept, setFilterDept]     = useState("All");
  const [filterAssign, setFilterAssign] = useState("All");
  const [sortBy, setSortBy]     = useState("date"); // "date" | "priority"
  const [newT, setNewT] = useState({
    title:"", cat:"Gas & Burner", venue:"Ambria Pushpanjali",
    priority:"Medium", assignTo:"akhtar", dept:currentDept||"kitchen", notes:"",
  });

  function addTicket(){
    if(!newT.title.trim()) return;
    const id=`RM-${String(Date.now()).slice(-4)}`;
    setTickets(p=>[{id,title:newT.title.trim(),cat:newT.cat,venue:newT.venue,priority:newT.priority,
      assignTo:newT.assignTo,status:"Open",dept:newT.dept,
      createdBy:currentUser?.name||"Staff",date:TODAY,notes:newT.notes,updates:[]},...p]);
    setNewT({title:"",cat:"Gas & Burner",venue:"Ambria Pushpanjali",priority:"Medium",assignTo:"akhtar",dept:currentDept||"kitchen",notes:""});
    setShowNew(false);
  }
  function updStatus(id, st){ setTickets(p=>p.map(t=>t.id===id?{...t,status:st}:t)); }
  function addUpdate(id){
    if(!updMsg.trim()) return;
    setTickets(p=>p.map(t=>t.id!==id?t:{...t,updates:[...t.updates,{by:currentUser?.name||"Staff",date:TODAY,msg:updMsg.trim()}]}));
    setUpdMsg("");
  }
  function reassign(id, assignTo){ setTickets(p=>p.map(t=>t.id===id?{...t,assignTo}:t)); }

  // Filtering + sorting
  let visible = tickets.filter(t=>
    (filterStatus==="All"||t.status===filterStatus)&&
    (filterDept==="All"||t.dept===filterDept)&&
    (filterAssign==="All"||t.assignTo===filterAssign)
  );
  if(sortBy==="priority"){
    const pri_order={"Urgent":0,"High":1,"Medium":2,"Low":3};
    visible=[...visible].sort((a,b)=>(pri_order[a.priority]||3)-(pri_order[b.priority]||3));
  } else {
    visible=[...visible].sort((a,b)=>b.date.localeCompare(a.date));
  }

  const openCt   = tickets.filter(t=>t.status==="Open").length;
  const ipCt     = tickets.filter(t=>t.status==="In Progress").length;
  const urgCt    = tickets.filter(t=>t.priority==="Urgent"||t.priority==="High").length;
  const resolCt  = tickets.filter(t=>t.status==="Resolved"||t.status==="Closed").length;

  const fld={width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:40};

  return(
    <div>
      {/* ── Header ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:.4}}>🔧 {T2("Repair & Maintenance")}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{T2("Shared pool — all departments")}</div>
        </div>
        <button onClick={()=>setShowNew(!showNew)} style={{padding:"11px 18px",borderRadius:12,background:showNew?C.surface:`linear-gradient(135deg,${C.gold},#A8891E)`,color:showNew?C.muted:"#0A0908",border:showNew?`1px solid ${C.border}`:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>
          {showNew?"✕ Cancel":"+ "+T2("New Request")}
        </button>
      </div>

      {/* ── Stats tiles ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[{l:T2("Open"),v:openCt,c:C.red,bg:C.redBg},{l:T2("In Progress"),v:ipCt,c:C.amber,bg:C.amberBg},{l:T2("High/Urgent"),v:urgCt,c:"#E05030",bg:C.redBg},{l:T2("Resolved"),v:resolCt,c:C.green,bg:C.greenBg}].map(s=>(
          <div key={s.l} onClick={()=>setFilterStatus(s.l===T2("Open")?"Open":s.l===T2("In Progress")?"In Progress":s.l===T2("High/Urgent")?"All":s.l===T2("Resolved")?"Resolved":"All")}
            style={{background:s.bg,borderRadius:12,padding:"12px 10px",textAlign:"center",border:`1px solid ${s.c}20`,cursor:"pointer"}}>
            <div style={{fontSize:22,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:10,color:s.c,fontWeight:600,marginTop:4}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── New Request Form ── */}
      {showNew&&(
        <Card style={{marginBottom:14,padding:"18px 20px",border:`2px solid ${C.goldBorder}`,background:C.goldBg+"80"}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:12}}>🔧 {T2("New Repair / Maintenance Request")}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Issue Title")} *</div>
              <input value={newT.title} onChange={e=>setNewT(p=>({...p,title:e.target.value}))} placeholder={lang==="hi"?"समस्या का विवरण लिखें…":"e.g. Tandoor #2 clay lining cracked"} style={{...fld,fontSize:13}} autoFocus/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Category")}</div>
              <select value={newT.cat} onChange={e=>setNewT(p=>({...p,cat:e.target.value}))} style={fld}>{CATEGORIES.map(c=><option key={c.v} value={c.v}>{c.icon} {T2(c.v)}</option>)}</select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Venue")}</div>
              <select value={newT.venue} onChange={e=>setNewT(p=>({...p,venue:e.target.value}))} style={fld}>{VENUES_R.map(v=><option key={v}>{v}</option>)}</select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Priority")}</div>
              <select value={newT.priority} onChange={e=>setNewT(p=>({...p,priority:e.target.value}))} style={fld}>{PRI.map(p=><option key={p.v}>{T2(p.v)}</option>)}</select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Raise From Dept")}</div>
              <select value={newT.dept} onChange={e=>setNewT(p=>({...p,dept:e.target.value}))} style={fld}>
                {Object.entries(DEPT_LABELS).map(([k,v])=><option key={k} value={k}>{T2(v)}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Assign To")}</div>
              <select value={newT.assignTo} onChange={e=>setNewT(p=>({...p,assignTo:e.target.value}))} style={fld}>
                {ASSIGN_POOL.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name} — {a.role}</option>)}
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Notes")}</div>
              <textarea value={newT.notes} onChange={e=>setNewT(p=>({...p,notes:e.target.value}))} placeholder={lang==="hi"?"विवरण लिखें…":"Describe the issue in detail…"} rows={2} style={{...fld,resize:"none",height:60}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button onClick={addTicket} disabled={!newT.title.trim()} style={{padding:"12px 24px",borderRadius:12,background:newT.title.trim()?`linear-gradient(135deg,${C.gold},#A8891E)`:"#333",color:newT.title.trim()?"#0A0908":C.faint,border:"none",fontSize:13,fontWeight:700,cursor:newT.title.trim()?"pointer":"not-allowed",minHeight:44}}>
              ✓ {T2("Submit Request")}
            </button>
            <div style={{fontSize:11,color:C.faint}}>{T2("Ticket will be visible to all departments")}</div>
          </div>
        </Card>
      )}

      {/* ── Filters + Sort ── */}
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        {/* Status filter */}
        <div style={{display:"flex",gap:4,overflowX:"auto"}}>
          {["All",...STATUS_FLOW].map(f=>(
            <button key={f} onClick={()=>setFilterStatus(f)} style={{padding:"7px 12px",borderRadius:10,fontSize:11,fontWeight:filterStatus===f?700:400,cursor:"pointer",whiteSpace:"nowrap",minHeight:36,background:filterStatus===f?C.gold+"20":"transparent",color:filterStatus===f?C.gold:C.muted,border:`1px solid ${filterStatus===f?C.gold+"60":C.border}`}}>{T2(f)}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          {/* Sort */}
          <button onClick={()=>setSortBy(s=>s==="date"?"priority":"date")} style={{padding:"7px 12px",borderRadius:10,fontSize:11,cursor:"pointer",background:C.surface,border:`1px solid ${C.border}`,color:C.muted,minHeight:36}}>
            {sortBy==="date"?T2("⏱ Date"):T2("⚠ Priority")}
          </button>
        </div>
      </div>

      {/* Dept filter pills */}
      <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
        {["All",...Object.keys(DEPT_LABELS)].map(d=>(
          <button key={d} onClick={()=>setFilterDept(d)} style={{padding:"5px 10px",borderRadius:8,fontSize:10,fontWeight:filterDept===d?700:400,cursor:"pointer",background:filterDept===d?C.purple+"20":"transparent",color:filterDept===d?C.purple:C.faint,border:`1px solid ${filterDept===d?C.purple+"50":C.borderLight}`}}>
            {d==="All"?T2("All Depts"):T2(DEPT_LABELS[d]||d)}
          </button>
        ))}
        <div style={{marginLeft:4,display:"flex",gap:4}}>
          {ASSIGN_POOL.slice(0,5).map(a=>(
            <button key={a.id} onClick={()=>setFilterAssign(filterAssign===a.id?"All":a.id)} style={{padding:"5px 10px",borderRadius:8,fontSize:10,fontWeight:filterAssign===a.id?700:400,cursor:"pointer",background:filterAssign===a.id?a.color+"20":"transparent",color:filterAssign===a.id?a.color:C.faint,border:`1px solid ${filterAssign===a.id?a.color+"50":C.borderLight}`}}>
              {a.icon} {a.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ticket list ── */}
      {visible.length===0&&<div style={{textAlign:"center",padding:28,background:C.surface,borderRadius:12,color:C.muted,fontSize:12}}>{T2("No tickets found")}</div>}
      {visible.map(tk=>{
        const isExp=selId===tk.id;
        const assign=ASSIGN_POOL.find(a=>a.id===tk.assignTo)||{name:tk.assignTo,icon:"👤",color:C.muted};
        const cat=CATEGORIES.find(c=>c.v===tk.cat)||{icon:"📦",v:tk.cat};
        const pri=PRI.find(p=>p.v===tk.priority)||{c:C.muted};
        const sc=STATUS_COLORS[tk.status]||C.muted;
        const daysSince=Math.round((new Date(TODAY+"T00:00")-new Date(tk.date+"T00:00"))/(864e5));
        return(
          <Card key={tk.id} style={{marginBottom:8,padding:0,overflow:"hidden",border:`1.5px solid ${isExp?pri.c+"40":C.border}`}}>
            {/* Card header */}
            <div onClick={()=>setSelId(isExp?null:tk.id)} style={{padding:"13px 16px",cursor:"pointer",display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:40,height:40,borderRadius:10,background:pri.c+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:C.faint,fontWeight:600}}>{tk.id}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6,background:pri.c+"18",color:pri.c}}>{T2(tk.priority)}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6,background:sc+"18",color:sc}}>{T2(tk.status)}</span>
                  <span style={{fontSize:10,padding:"2px 7px",borderRadius:6,background:C.purple+"18",color:C.purple}}>{T2(DEPT_LABELS[tk.dept]||tk.dept)}</span>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:3}}>{tk.title}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:11,color:C.muted}}>
                  <span>📍 {tk.venue}</span>
                  <span style={{color:assign.color,fontWeight:600}}>{assign.icon} {assign.name}</span>
                  <span>🧑 {tk.createdBy}</span>
                  <span>{daysSince===0?T2("Today"):daysSince===1?T2("Yesterday"):daysSince+"d ago"}</span>
                </div>
              </div>
              <span style={{fontSize:14,color:C.muted,transform:isExp?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▾</span>
            </div>

            {/* Expanded detail */}
            {isExp&&(
              <div style={{borderTop:`1px solid ${C.border}`,background:C.bg}}>
                {/* Notes */}
                {tk.notes&&<div style={{padding:"10px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>📋 {T2("Notes")}</div>
                  <div style={{fontSize:12,color:C.text,lineHeight:1.6}}>{tk.notes}</div>
                </div>}

                {/* Reassign */}
                <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>🔄 {T2("Reassign")}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {ASSIGN_POOL.map(a=>(
                      <button key={a.id} onClick={()=>reassign(tk.id,a.id)}
                        style={{padding:"7px 12px",borderRadius:10,fontSize:11,fontWeight:tk.assignTo===a.id?700:400,cursor:"pointer",
                          background:tk.assignTo===a.id?a.color+"20":"transparent",color:tk.assignTo===a.id?a.color:C.muted,
                          border:`1.5px solid ${tk.assignTo===a.id?a.color:C.border}`,minHeight:36}}>
                        {a.icon} {a.name.split(" ")[0]}
                        {tk.assignTo===a.id&&<span style={{fontSize:9,marginLeft:3}}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status change */}
                <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>📊 {T2("Update Status")}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {STATUS_FLOW.map(st=>{
                      const stc=STATUS_COLORS[st]||C.muted;
                      return(
                        <button key={st} onClick={()=>updStatus(tk.id,st)}
                          style={{padding:"7px 14px",borderRadius:10,fontSize:11,fontWeight:tk.status===st?700:400,cursor:"pointer",
                            background:tk.status===st?stc+"20":"transparent",color:tk.status===st?stc:C.muted,
                            border:`1.5px solid ${tk.status===st?stc:C.border}`,minHeight:36}}>
                          {tk.status===st?"● ":""}{T2(st)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Updates timeline */}
                {tk.updates.length>0&&(
                  <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.8}}>📅 {T2("Timeline")}</div>
                    {tk.updates.map((u,ui)=>(
                      <div key={ui} style={{display:"flex",gap:10,marginBottom:8,paddingLeft:10,borderLeft:`2px solid ${C.gold}`}}>
                        <div>
                          <div style={{fontSize:11,fontWeight:700,color:C.gold}}>{u.by} <span style={{color:C.faint,fontWeight:400}}>· {u.date}</span></div>
                          <div style={{fontSize:12,color:C.text,marginTop:2,lineHeight:1.5}}>{u.msg}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add update */}
                <div style={{padding:"10px 16px",display:"flex",gap:8}}>
                  <input value={updMsg} onChange={e=>setUpdMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addUpdate(tk.id)} placeholder={T2("Add update, comment or action taken…")}
                    style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:40}}/>
                  <button onClick={()=>addUpdate(tk.id)} disabled={!updMsg.trim()} style={{padding:"10px 16px",borderRadius:10,background:updMsg.trim()?`linear-gradient(135deg,${C.gold},#A8891E)`:"#333",color:updMsg.trim()?"#0A0908":C.faint,border:"none",fontSize:12,fontWeight:700,cursor:updMsg.trim()?"pointer":"not-allowed",minHeight:40}}>
                    {T2("Post")}
                  </button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

const VENDOR_CATEGORIES = ["Outside Chef","Vegetable Supplier","Dairy Supplier","Meat & Poultry","Dry Goods","Ice & Cold Storage","Equipment Rental","Tent & Decor","Flower Vendor","Gas & Fuel","Cleaning & Hygiene","Packaging"];

function VendorDirectory({lang="en"}) {
  const T2 = s => T(s, lang||"en");
  const [vendors,setVendors] = useState([
    {id:"VD001",name:"Ramesh Kumar",    cat:"Outside Chef",      section:"Indian Curries",phone:"98100-11111",email:"",address:"Dwarka Sec 7",rating:5,notes:"Reliable, 5+ yrs",addedBy:"Yatender",date:"2023-06-01",active:true},
    {id:"VD002",name:"Anil Yadav",      cat:"Outside Chef",      section:"Tandoor",       phone:"98200-22222",email:"",address:"Palam",         rating:5,notes:"Best tandoor",      addedBy:"Yatender",date:"2023-08-15",active:true},
    {id:"VD003",name:"Suresh Tiwari",   cat:"Outside Chef",      section:"Beverages",     phone:"98300-33333",email:"",address:"Dwarka Sec 10", rating:4,notes:"Good for beverages",addedBy:"Yatender",date:"2024-01-10",active:true},
    {id:"VD004",name:"Krishna Vegetables",cat:"Vegetable Supplier",section:"—",           phone:"98400-44444",email:"",address:"Azadpur Mandi", rating:4,notes:"Fresh, AM delivery",addedBy:"Abhi",   date:"2024-02-01",active:true},
    {id:"VD005",name:"Garg Dairy",      cat:"Dairy Supplier",    section:"—",             phone:"98500-55555",email:"",address:"Kapashera",      rating:4,notes:"Daily 5AM supply",  addedBy:"Abhi",   date:"2024-03-10",active:true},
  ]);
  const [search,      setSearch]      = useState("");
  const [catFilter,   setCatFilter]   = useState("All");
  const [showAdd,     setShowAdd]     = useState(false);
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const [editId,      setEditId]      = useState(null);
  const [editForm,    setEditForm]    = useState({});
  const [form,        setForm]        = useState({name:"",cat:"Outside Chef",section:"—",phone:"",email:"",address:"",rating:5,notes:"",addedBy:"Yatender"});

  const cats     = ["All",...VENDOR_CATEGORIES];
  const filtered = vendors.filter(v=>(v.name.toLowerCase().includes(search.toLowerCase())||v.cat.includes(search))&&(catFilter==="All"||v.cat===catFilter));

  function nextId(){ const nums=vendors.map(v=>+(v.id.replace("VD",""))).filter(Boolean); return "VD"+String(Math.max(0,...nums)+1).padStart(3,"0"); }
  function addVendor(){ if(!form.name||!form.phone) return; setVendors(p=>[...p,{...form,id:nextId(),date:TODAY,active:true}]); setForm({name:"",cat:"Outside Chef",section:"—",phone:"",email:"",address:"",rating:5,notes:"",addedBy:"Yatender"}); setShowAdd(false); }

  const SECTION_OPTS = ["—",...SECTIONS];
  const fld = {width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"};

  return (
    <div>
      {/* Delete confirm */}
      {deleteConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.surface,borderRadius:14,padding:"28px 32px",maxWidth:340,textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:5}}>{T2("Remove")} {deleteConfirm.name}?</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:14}}>
              <Btn onClick={()=>{setVendors(p=>p.filter(v=>v.id!==deleteConfirm.id));setDeleteConfirm(null);}} color={C.red} style={{fontSize:12,padding:"7px 18px"}}>{T2("Remove")}</Btn>
              <Btn onClick={()=>setDeleteConfirm(null)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>{T2("Cancel")}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>🤝 {T2("Vendor Directory")}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{vendors.length} {lang==="hi"?"वेंडर ·":T2("vendors")} {T2("Outside chefs, suppliers, service partners")}</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)} color={showAdd?C.muted:C.wine} style={{fontSize:12,padding:"7px 16px"}}>{showAdd?"✕ "+T2("Cancel"):T2("+ Add Vendor")}</Btn>
      </div>

      {/* Add form */}
      {showAdd&&(
        <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:12,padding:"14px 18px",marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:10}}>{T2("Add New Vendor")}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            {[
              {l:T2("Name *"),   k:"name",   ph:"Full name"},
              {l:T2("Phone *"),  k:"phone",  ph:"98100-XXXXX"},
              {l:T2("Email"),    k:"email",  ph:"email@example.com"},
              {l:T2("Address"),  k:"address",ph:"Area, Delhi"},
              {l:T2("Added By"), k:"addedBy",ph:"Your name"},
              {l:T2("Notes"),    k:"notes",  ph:"Speciality, experience…"},
            ].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:11,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>{f.l}</div>
                <input value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={fld}/>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 60px",gap:8,marginBottom:10}}>
            <div>
              <div style={{fontSize:11,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>{T2("Category")}</div>
              <select value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))} style={fld}>
                {VENDOR_CATEGORIES.map(ct=><option key={ct}>{ct}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>{T2("Section Speciality")}</div>
              <select value={form.section} onChange={e=>setForm(p=>({...p,section:e.target.value}))} style={fld}>
                {SECTION_OPTS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>{T2("Rating")}</div>
              <select value={form.rating} onChange={e=>setForm(p=>({...p,rating:+e.target.value}))} style={fld}>
                {[5,4,3,2,1].map(r=><option key={r} value={r}>{"★".repeat(r)}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>setShowAdd(false)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>{T2("Cancel")}</Btn>
            <Btn onClick={addVendor} color={C.wine} style={{fontSize:12,padding:"8px 20px"}}>{T2("✓ Add Vendor")}</Btn>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={T2("🔍 Search vendors…")}
          style={{flex:1,minWidth:160,padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
        {cats.map(ct=>(
          <button key={ct} onClick={()=>setCatFilter(ct)} style={{padding:"4px 12px",borderRadius:20,fontSize:11,cursor:"pointer",background:catFilter===ct?C.wine:"transparent",color:catFilter===ct?"#fff":C.muted,border:`1px solid ${catFilter===ct?C.wine:C.border}`}}>{ct}</button>
        ))}
      </div>

      {/* Vendor grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        {filtered.map((v,i)=>(
          <div key={v.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 14px",opacity:v.active?1:.6}}>
            {editId===v.id?(
              <div>
                <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>{T2("Edit —")} {v.name}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
                  {[{l:T2("Phone"),k:"phone"},{l:T2("Email"),k:"email"},{l:T2("Address"),k:"address"},{l:T2("Notes"),k:"notes"}].map(f=>(
                    <div key={f.k}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{f.l}</div>
                      <input value={editForm[f.k]||""} onChange={e=>setEditForm(p=>({...p,[f.k]:e.target.value}))} style={{...fld,padding:"5px 7px"}}/>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:5}}>
                  <Btn onClick={()=>{setVendors(p=>p.map(x=>x.id!==v.id?x:{...x,...editForm}));setEditId(null);}} color={C.wine} style={{fontSize:11,padding:"5px 12px"}}>{T2("Save")}</Btn>
                  <Btn onClick={()=>setEditId(null)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:11,padding:"5px 10px"}}>{T2("Cancel")}</Btn>
                </div>
              </div>
            ):(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{display:"flex",gap:9,alignItems:"center"}}>
                    <Avatar name={v.name} size={34} index={i+10}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>{v.name}</div>
                      <div style={{fontSize:10,color:C.gold,fontWeight:600,marginTop:1}}>{v.id}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>{setEditId(v.id);setEditForm({phone:v.phone,email:v.email,address:v.address,notes:v.notes});}} style={{padding:"6px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,fontSize:10,cursor:"pointer",color:C.text}}>{T2("Edit")}</button>
                    <button onClick={()=>setVendors(p=>p.map(x=>x.id!==v.id?x:{...x,active:!x.active}))} style={{padding:"6px 12px",borderRadius:8,fontSize:10,cursor:"pointer",border:"none",background:v.active?C.greenBg:C.redBg,color:v.active?C.green:C.red}}>{v.active?T2("Active"):T2("Off")}</button>
                    <button onClick={()=>setDeleteConfirm(v)} style={{padding:"3px 7px",borderRadius:8,fontSize:10,cursor:"pointer",border:`1px solid ${C.redBorder}`,background:C.redBg,color:C.red}}>🗑</button>
                  </div>
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                  <Chip label={v.cat} color={C.wine} bg={C.wineBg} size={9}/>
                  {v.section&&v.section!=="—"&&<STag name={v.section}/>}
                </div>
                <div style={{display:"flex",gap:2,marginBottom:5}}>
                  {[1,2,3,4,5].map(s=><span key={s} style={{fontSize:12,color:s<=v.rating?"#F59E0B":"#D1D5DB"}}>★</span>)}
                </div>
                <div style={{fontSize:11,color:C.muted}}>{v.phone}{v.email?" · "+v.email:""}</div>
                {v.address&&<div style={{fontSize:10,color:C.faint,marginTop:2}}>📍 {v.address}</div>}
                {v.notes&&<div style={{marginTop:6,fontSize:11,color:C.muted,lineHeight:1.5}}>{v.notes}</div>}
                <div style={{marginTop:6,fontSize:11,color:C.faint}}>{T2("Added by")} {v.addedBy} · {v.date}</div>
              </div>
            )}
          </div>
        ))}
        {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:32,background:C.bg,borderRadius:10,fontSize:12,color:C.muted}}>{T2("No vendors found.")}</div>}
      </div>
    </div>
  );
}



// ─── ACCESS MANAGER (Admin only) ──────────────────────────────────────────────
function AccessManager({lang="en", empDb, setEmpDb}) {
  const T2 = s => T(s, lang);

  // ── PRESET_ROLES: default screen access per role ──
  const PRESET_ROLES = {
    admin:              {label:"👑 Admin — Full Access",         permissions:{dashboard:true,kitchen:true,store:true,menus:true,transport:true,dept_odc:true,team:true,vendors:true,repair:true,dept_service:true,dept_crockery:true,dept_beverages:true,access:true}},
    head_chef:          {label:"👨‍🍳 Head Chef",                  permissions:{dashboard:true,kitchen:true,store:true,menus:true,transport:true,dept_odc:true,team:true,vendors:false,repair:true,dept_service:false,dept_crockery:false,dept_beverages:false,access:false}},
    section_chinese:    {label:"🥢 Chinese Section",            permissions:{dashboard:false,kitchen:true,store:false,menus:false,transport:false,dept_odc:false,team:false,vendors:false,repair:false,dept_service:false,dept_crockery:false,dept_beverages:false,access:false}},
    section_indian:     {label:"🍛 Indian Curries Section",     permissions:{dashboard:false,kitchen:true,store:false,menus:false,transport:false,dept_odc:false,team:false,vendors:false,repair:false,dept_service:false,dept_crockery:false,dept_beverages:false,access:false}},
    section_tandoor:    {label:"🔥 Tandoor Section",            permissions:{dashboard:false,kitchen:true,store:false,menus:false,transport:false,dept_odc:false,team:false,vendors:false,repair:false,dept_service:false,dept_crockery:false,dept_beverages:false,access:false}},
    section_continental:{label:"🍝 Continental Section",        permissions:{dashboard:false,kitchen:true,store:false,menus:false,transport:false,dept_odc:false,team:false,vendors:false,repair:false,dept_service:false,dept_crockery:false,dept_beverages:false,access:false}},
    section_sweets:     {label:"🍮 Sweets Section",             permissions:{dashboard:false,kitchen:true,store:false,menus:false,transport:false,dept_odc:false,team:false,vendors:false,repair:false,dept_service:false,dept_crockery:false,dept_beverages:false,access:false}},
    section_chaat:      {label:"🥗 Chaat Section",              permissions:{dashboard:false,kitchen:true,store:false,menus:false,transport:false,dept_odc:false,team:false,vendors:false,repair:false,dept_service:false,dept_crockery:false,dept_beverages:false,access:false}},
    service:            {label:"🍽 Service Dept",               permissions:{dashboard:true,kitchen:false,store:false,menus:true,transport:false,dept_odc:false,team:true,vendors:true,repair:true,dept_service:true,dept_crockery:false,dept_beverages:false,access:false}},
    crockery:           {label:"🍶 Crockery Dept",              permissions:{dashboard:true,kitchen:false,store:true,menus:false,transport:false,dept_odc:false,team:true,vendors:false,repair:true,dept_service:false,dept_crockery:true,dept_beverages:false,access:false}},
    beverages:          {label:"🥤 Beverages Dept",             permissions:{dashboard:true,kitchen:false,store:true,menus:true,transport:false,dept_odc:false,team:true,vendors:false,repair:true,dept_service:false,dept_crockery:false,dept_beverages:true,access:false}},
    transport:          {label:"🚛 Transport",                  permissions:{dashboard:true,kitchen:false,store:false,menus:false,transport:true,dept_odc:false,team:false,vendors:false,repair:true,dept_service:false,dept_crockery:false,dept_beverages:false,access:false}},
    kiosk_gate:         {label:"🏛 Gate Kiosk",                permissions:{dashboard:false,kitchen:false,store:false,menus:false,transport:false,dept_odc:false,team:false,vendors:false,repair:false,dept_service:false,dept_crockery:false,dept_beverages:false,access:false}},
  };

  const SCREEN_GROUPS = [
    {label:"KITCHEN & OPS", screens:[
      {key:"kitchen",       label:"Kitchen Hub",      icon:"👨‍🍳", desc:"Prep tracking & live kitchen ops"},
      {key:"store",         label:"Store & Inventory", icon:"📦", desc:"Stock levels, issue & receive items"},
      {key:"menus",         label:"Menu Packages",    icon:"📜", desc:"Event menus, packages & recipes"},
      {key:"transport",     label:"Transport",         icon:"🚛", desc:"Dispatch & delivery tracking"},
      {key:"dept_odc",      label:"ODC Operations",   icon:"🏕️", desc:"Outside dining & catering ops"},
    ]},
    {label:"MANAGEMENT", screens:[
      {key:"dashboard",     label:"Dashboard",         icon:"📊", desc:"Event overview, alerts & KPIs"},
      {key:"team",          label:"Team & Attendance", icon:"👥", desc:"Attendance, leaves & staff records"},
      {key:"vendors",       label:"Vendor Directory",  icon:"📇", desc:"Supplier contacts & orders"},
      {key:"repair",        label:"Repair & Maint.",   icon:"🔧", desc:"Equipment repairs & tickets"},
    ]},
    {label:"DEPARTMENTS", screens:[
      {key:"dept_service",   label:"Service Ops",      icon:"🍽️", desc:"Front-of-house & banquet service"},
      {key:"dept_crockery",  label:"Crockery Ops",     icon:"🍶", desc:"Crockery inventory & breakage"},
      {key:"dept_beverages", label:"Beverages Ops",    icon:"🥤", desc:"Beverage planning & bar ops"},
    ]},
    {label:"ADMIN ONLY", screens:[
      {key:"access", label:"Access Manager", icon:"🔐", desc:"Staff accounts, roles & permissions", locked:true},
    ]},
  ];

  const ALL_SCREEN_KEYS = SCREEN_GROUPS.flatMap(g=>g.screens.map(s=>s.key));
  const screenInfo = key => SCREEN_GROUPS.flatMap(g=>g.screens).find(s=>s.key===key);

  function getPermissions(s) {
    if(s.permissions) return s.permissions;
    return PRESET_ROLES[s.role]?.permissions || PRESET_ROLES.section_indian.permissions;
  }

  const ROLE_OPTIONS = [
    {v:"admin",              l:"👑 Admin — Full Access"},
    {v:"head_chef",          l:"👨‍🍳 Head Chef"},
    {v:"section_chinese",    l:"🥢 Chinese Section"},
    {v:"section_indian",     l:"🍛 Indian Curries"},
    {v:"section_tandoor",    l:"🔥 Tandoor"},
    {v:"section_continental",l:"🍝 Continental"},
    {v:"section_sweets",     l:"🍮 Sweets"},
    {v:"section_chaat",      l:"🥗 Chaat"},
    {v:"service",            l:"🍽 Service"},
    {v:"crockery",           l:"🍶 Crockery"},
    {v:"beverages",          l:"🥤 Beverages"},
    {v:"transport",          l:"🚛 Transport"},
    {v:"kiosk_gate",         l:"🏛 Gate Kiosk"},
  ];
  const SECTION_OPTIONS = ["Management","Indian Curries","Tandoor","Chinese","Chaat","Sweets","Service","Crockery","Beverages","Transportation","ODC","Continental"];
  const fld = {width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:40};

  // ── Helpers ──
  const getSid   = s => String(s.staffListId||s.staff_id||s.id||"");
  const isActive = s => s.is_active!==false && s.active!==false;
  function getPermissions(s) {
    if(s.custom_screens) return s.custom_screens;
    if(s.permissions)    return s.permissions; // backward compat
    return PRESET_ROLES[s.role]?.permissions || {};
  }
  const hasAppAccess = s => Object.values(getPermissions(s)).some(v=>v);
  function roleShort(role) {
    if(!role||role==="kiosk_gate"||role==="staff") return T2("Staff");
    if(role.startsWith("section_")) return lang==="hi"?"शेफ":"Chef";
    const m={admin:"Admin",head_chef:"Head Chef",headchef:"Head Chef",service:"Service",crockery:"Crockery",beverages:"Beverages",transport:"Transport"};
    return T2(m[role]||role);
  }

  // ── State (view-based navigation) ──
  const [view,  setView]  = useState("list"); // "list" | "perms" | "pin" | "edit"
  const [editUser, setEditUser] = useState(null); // staff object being viewed/edited
  const [permsForm, setPermsForm]   = useState({});
  const [templatePreview, setTemplatePreview] = useState(null);
  const [search, setSearch]         = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [pinChangeMode, setPinChangeMode] = useState(false);
  const [newPin, setNewPin]         = useState("");
  const [pinError, setPinError]     = useState("");
  const [editForm, setEditForm]     = useState({});
  const [formError, setFormError]   = useState("");
  const [delId, setDelId]           = useState(null);
  const [toast, setToast]           = useState("");
  const [selected, setSelected]     = useState(new Set());

  // ── Derived data ──
  const allStaff  = safeArr(empDb);
  const hasCnt    = allStaff.filter(hasAppAccess).length;
  const noCnt     = allStaff.length - hasCnt;
  const allSections = ["All",...Array.from(new Set(allStaff.map(s=>s.section).filter(Boolean))).sort()];
  const staffList = allStaff.filter(s=>{
    const sid = getSid(s);
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || sid.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (sectionFilter==="All" || s.section===sectionFilter);
  });

  function showSaved(msg){ setToast(msg||"✅ Saved"); setTimeout(()=>setToast(""), 2500); }

  // ── Actions ──
  function openPerms(s){
    setEditUser(s);
    setPermsForm({...(s.custom_screens || s.permissions || PRESET_ROLES[s.role]?.permissions || {})});
    setTemplatePreview(null);
    setView("perms");
  }
  function savePerms(){
    const sid=getSid(editUser);
    setEmpDb(prev=>prev.map(s=>getSid(s)===sid
      ? {...s, custom_screens:{...permsForm}}
      : s
    ));
    showSaved(); setView("list"); setEditUser(null);
  }
  function applyTemplate(roleKey){
    const tpl=PRESET_ROLES[roleKey]?.permissions; if(!tpl) return;
    setPermsForm({...tpl});
    const sid=getSid(editUser);
    setEmpDb(p=>safeArr(p).map(s=>getSid(s)===sid?{...s,role:roleKey,custom_screens:{...tpl}}:s));
    setTemplatePreview(null);
  }
  function openPin(s){ setEditUser(s); setPinChangeMode(false); setNewPin(""); setPinError(""); setView("pin"); }
  function saveNewPin(){
    if(newPin.length!==4){setPinError(T2("PIN must be exactly 4 digits"));return;}
    const sid=getSid(editUser);
    setEmpDb(p=>safeArr(p).map(s=>getSid(s)===sid?{...s,pin:newPin}:s));
    showSaved(); setView("list"); setEditUser(null);
  }
  function openEdit(s){ setEditUser(s); setEditForm({name:s.name||"",role:s.role||"kiosk_gate",section:s.section||"Management",pin:""}); setFormError(""); setView("edit"); }
  function saveForm(){
    if(!editForm.name?.trim()){setFormError(lang==="hi"?"नाम आवश्यक है":"Name is required");return;}
    if(editForm.pin && editForm.pin.length>0 && editForm.pin.length!==4){setFormError(T2("PIN must be exactly 4 digits"));return;}
    const sid=getSid(editUser);
    setEmpDb(prev=>prev.map(s=>{
      if(getSid(s)!==sid) return s;
      const update={...s, name:editForm.name.trim(), role:editForm.role, section:editForm.section};
      if(editForm.pin && editForm.pin.length===4) update.pin=String(editForm.pin);
      return update;
    }));
    showSaved(); setView("list"); setEditUser(null); setFormError("");
  }
  function toggleActive(sid){
    setEmpDb(prev=>prev.map(s=>
      getSid(s)===sid ? {...s, is_active:!isActive(s), active:!isActive(s)} : s
    ));
    showSaved();
  }
  function deleteStaff(sid){
    setEmpDb(prev=>prev.filter(s=>getSid(s)!==sid));
    setDelId(null); setView("list");
  }
  function handleBulkRemoveAccess(){
    if(!window.confirm(`Remove access for ${selected.size} staff members? They will have no app access.`)) return;
    const n=selected.size;
    setEmpDb(prev=>prev.map(s=>selected.has(getSid(s))?{...s,role:"kiosk_gate",custom_screens:null}:s));
    setSelected(new Set()); showSaved(`✅ Access removed for ${n} staff`);
  }
  function handleBulkDeactivate(){
    if(!window.confirm(`Deactivate ${selected.size} staff members? They will not be able to log in.`)) return;
    const n=selected.size;
    setEmpDb(prev=>prev.map(s=>selected.has(getSid(s))?{...s,is_active:false,active:false}:s));
    setSelected(new Set()); showSaved(`✅ Deactivated ${n} staff`);
  }
  function handleBulkDelete(){
    if(!window.confirm(`Permanently DELETE ${selected.size} staff members? This cannot be undone.`)) return;
    const n=selected.size;
    setEmpDb(prev=>prev.filter(s=>!selected.has(getSid(s))));
    setSelected(new Set()); showSaved(`✅ Deleted ${n} staff`);
  }
  function toggleSelect(sid){
    setSelected(prev=>{ const n=new Set(prev); n.has(sid)?n.delete(sid):n.add(sid); return n; });
  }

  // ── Back button shared style ──
  const backBtn={padding:"10px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:40,fontWeight:600};

  // Shared toast element (rendered in any sub-view)
  const SavedToast = toast ? <div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",background:C.green,color:"#fff",padding:"10px 28px",borderRadius:14,fontSize:13,fontWeight:700,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,.4)",whiteSpace:"nowrap"}}>{toast}</div> : null;

  // ── VIEW: PERMS ──
  if(view==="perms"&&editUser){
    const canKeys=ALL_SCREEN_KEYS.filter(k=>permsForm[k]);
    const cantKeys=ALL_SCREEN_KEYS.filter(k=>!permsForm[k]);
    const previewPerms=templatePreview?PRESET_ROLES[templatePreview]?.permissions:null;
    const isCustom=!!(editUser.custom_screens);
    return(
      <div>{SavedToast}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button onClick={()=>{setView("list");setEditUser(null);setTemplatePreview(null);}} style={backBtn}>{T2("← Back")}</button>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{T2("🔑 Screen Permissions")}</div>
            <div style={{fontSize:12,color:C.muted}}>{editUser.name} · <span style={{color:C.gold}}>{editUser.section}</span></div>
          </div>
        </div>

        {/* Current-access status banner — Fix 3 */}
        <Card style={{marginBottom:14,padding:"14px 16px",border:`1px solid ${canKeys.length>0?C.greenBorder:C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>{editUser.name}</div>
              <div style={{fontSize:11,color:C.muted}}>{editUser.section} · {roleShort(editUser.role)}</div>
            </div>
            <div style={{textAlign:"right"}}>
              {canKeys.length>0
                ? <div style={{fontSize:12,fontWeight:700,color:C.green}}>✅ {canKeys.length} {T2("screens active")}</div>
                : <div style={{fontSize:12,color:C.red}}>🚫 {T2("No app access")}</div>
              }
              {!isCustom&&<div style={{fontSize:10,color:C.amber,marginTop:2}}>{T2("Showing role defaults")}</div>}
            </div>
          </div>
        </Card>

        {/* Role Templates */}
        <Card style={{marginBottom:14,padding:"16px 18px",border:`1px solid ${C.goldBorder}`}}>
          <div style={{fontSize:11,fontWeight:700,color:C.gold,marginBottom:10,textTransform:"uppercase",letterSpacing:.8}}>{T2("⚡ Role Templates — Quick Apply")}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:templatePreview?12:0}}>
            {ROLE_OPTIONS.map(r=>(
              <button key={r.v} onClick={()=>setTemplatePreview(p=>p===r.v?null:r.v)}
                style={{padding:"6px 12px",borderRadius:8,background:templatePreview===r.v?C.gold:C.darkCard,border:`1px solid ${templatePreview===r.v?C.gold:C.border}`,color:templatePreview===r.v?"#0A0908":C.muted,fontSize:11,fontWeight:templatePreview===r.v?700:400,cursor:"pointer"}}>
                {T2(r.l)}
              </button>
            ))}
          </div>
          {templatePreview&&previewPerms&&(
            <div style={{padding:"14px",borderRadius:10,background:C.goldBg,border:`1px solid ${C.goldBorder}`}}>
              <div style={{fontSize:11,color:C.gold,fontWeight:700,marginBottom:8}}>{T2("Preview —")} {T2(ROLE_OPTIONS.find(r=>r.v===templatePreview)?.l||"")}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>
                {ALL_SCREEN_KEYS.map(k=>{const si=screenInfo(k);const on=previewPerms[k];return <span key={k} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:on?C.greenBg:C.darkCard,border:`1px solid ${on?C.greenBorder:C.border}`,color:on?C.green:C.faint}}>{si?.icon} {T2(si?.label||"")}</span>;})}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>applyTemplate(templatePreview)} style={{flex:1,padding:"10px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>{T2("✓ Apply This Template")}</button>
                <button onClick={()=>setTemplatePreview(null)} style={{padding:"10px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer"}}>{T2("Cancel")}</button>
              </div>
            </div>
          )}
        </Card>

        {/* Access preview */}
        <Card style={{marginBottom:14,padding:"14px 16px",border:`1px solid ${C.greenBorder}`,background:C.greenBg+"28"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.green,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>{T2("👁 Access Preview")}</div>
          {canKeys.length>0
            ? <div style={{fontSize:12,color:C.text,marginBottom:4}}><strong>{editUser.name}</strong> {T2("will access:")} <span style={{color:C.green}}>{canKeys.map(k=>T2(screenInfo(k)?.label||k)).join(", ")}</span>.</div>
            : <div style={{fontSize:12,color:C.red,marginBottom:4}}><strong>{editUser.name}</strong> {T2("will have NO screen access.")}</div>
          }
          {cantKeys.length>0&&<div style={{fontSize:12,color:C.faint}}>{T2("Will NOT see:")} {cantKeys.map(k=>T2(screenInfo(k)?.label||k)).join(", ")}.</div>}
        </Card>

        {/* Screen groups */}
        {SCREEN_GROUPS.map(group=>(
          <div key={group.label} style={{marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:1.5,marginBottom:6,textTransform:"uppercase",paddingLeft:2}}>── {T2(group.label)} ──</div>
            <Card style={{padding:"2px 0",overflow:"hidden"}}>
              {group.screens.map((scr,i)=>{
                const isLocked=scr.locked; const isOn=isLocked?false:!!permsForm[scr.key];
                return(
                  <div key={scr.key} onClick={()=>{if(!isLocked)setPermsForm(p=>({...p,[scr.key]:!p[scr.key]}));}}
                    style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",cursor:isLocked?"not-allowed":"pointer",background:isOn?"rgba(62,170,104,.04)":C.darkCard,borderTop:i>0?`1px solid ${C.borderLight}`:"none",minHeight:56,opacity:isLocked?.45:1,transition:"background .15s"}}>
                    <div style={{width:38,height:38,borderRadius:10,background:isOn?C.greenBg:C.surface,border:`1px solid ${isOn?C.greenBorder:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{scr.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:isOn?C.text:C.muted}}>{T2(scr.label)}</div>
                      <div style={{fontSize:11,color:C.faint,marginTop:1}}>{T2(scr.desc)}{isLocked?" · "+T2("Admin only — always locked"):""}</div>
                    </div>
                    <div style={{width:46,height:26,borderRadius:13,background:isOn?C.green:C.border,transition:"background .2s",position:"relative",flexShrink:0}}>
                      <div style={{position:"absolute",top:3,left:isOn?22:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.3)"}}/>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        ))}

        <div style={{display:"flex",gap:10,marginTop:4,marginBottom:24}}>
          <button onClick={savePerms} style={{flex:1,padding:"14px",borderRadius:12,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:48}}>{T2("✓ Save Permissions")}</button>
          <button onClick={()=>{setView("list");setEditUser(null);setTemplatePreview(null);}} style={{padding:"14px 20px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",minHeight:48}}>{T2("Cancel")}</button>
        </div>
      </div>
    );
  }

  // ── VIEW: PIN ──
  if(view==="pin"&&editUser){
    return(
      <div style={{maxWidth:400,margin:"0 auto",paddingTop:20}}>{SavedToast}
        <button onClick={()=>{setView("list");setEditUser(null);}} style={{...backBtn,marginBottom:20}}>{T2("← Back")}</button>
        <Card style={{padding:"32px 28px",textAlign:"center",border:`1px solid ${C.goldBorder}`}}>
          <div style={{fontSize:26,marginBottom:6}}>🔑</div>
          <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:2}}>{editUser.name}</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:24}}>{T2("PIN Management")} · {editUser.section}</div>
          {!pinChangeMode?(
            <>
              <div style={{letterSpacing:14,fontSize:32,color:C.gold,marginBottom:24,fontFamily:"monospace"}}>●●●●</div>
              <button onClick={()=>{setPinChangeMode(true);setNewPin("");}} style={{width:"100%",padding:"12px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",minHeight:44,fontWeight:600}}>{T2("Change PIN")}</button>
            </>
          ):(
            <>
              <input value={newPin} onChange={e=>{setNewPin(e.target.value.replace(/\D/g,"").slice(0,4));setPinError("");}} placeholder={T2("New 4-digit PIN")} maxLength={4} style={{...fld,letterSpacing:10,textAlign:"center",fontSize:22,fontWeight:700,marginBottom:8}} type="password" autoFocus/>
              {pinError&&<div style={{fontSize:11,color:C.red,marginBottom:8}}>{pinError}</div>}
              <button onClick={saveNewPin} style={{width:"100%",padding:"12px",borderRadius:12,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:8,minHeight:44}}>{T2("Save")}</button>
              <button onClick={()=>setPinChangeMode(false)} style={{width:"100%",padding:"10px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer"}}>{T2("Cancel")}</button>
            </>
          )}
        </Card>
      </div>
    );
  }

  // ── VIEW: EDIT (Fix 1) ──
  if(view==="edit"&&editUser){
    const sid=getSid(editUser);
    const canSave=!!editForm.name?.trim();
    return(
      <div style={{maxWidth:560,margin:"0 auto",paddingTop:20}}>{SavedToast}
        <button onClick={()=>{setView("list");setEditUser(null);}} style={{...backBtn,marginBottom:20}}>{T2("← Back")}</button>
        <Card style={{padding:"24px",border:`2px solid ${C.goldBorder}`,background:C.goldBg+"44"}}>
          <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:16}}>✏️ {T2("Edit Staff")} — {editUser.name}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Staff ID *")}</div>
              <input value={sid} disabled style={{...fld,opacity:.55,cursor:"not-allowed"}}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Full Name *")}</div>
              <input value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Ramesh Kumar" style={fld} autoFocus/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Role / Access Level")}</div>
              <select value={editForm.role} onChange={e=>setEditForm(p=>({...p,role:e.target.value}))} style={fld}>
                {ROLE_OPTIONS.map(r=><option key={r.v} value={r.v}>{T2(r.l)}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Section")}</div>
              <select value={editForm.section} onChange={e=>setEditForm(p=>({...p,section:e.target.value}))} style={fld}>
                {SECTION_OPTIONS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>PIN ({lang==="hi"?"खाली रखें = कोई बदलाव नहीं":"leave blank = no change"})</div>
              <input value={editForm.pin||""} onChange={e=>setEditForm(p=>({...p,pin:e.target.value.replace(/\D/g,"").slice(0,4)}))} placeholder="New 4-digit PIN" maxLength={4} type="password" style={{...fld,letterSpacing:8,textAlign:"center",fontSize:18,fontWeight:700}}/>
            </div>
          </div>
          {formError&&<div style={{fontSize:11,color:C.red,marginBottom:8}}>{formError}</div>}
          <div style={{display:"flex",gap:10}}>
            <button onClick={saveForm} disabled={!canSave}
              style={{flex:1,padding:"12px",borderRadius:12,background:canSave?`linear-gradient(135deg,${C.gold},#A8891E)`:"#333",color:canSave?"#0A0908":C.faint,border:"none",fontSize:13,fontWeight:700,cursor:canSave?"pointer":"not-allowed",minHeight:44}}>
              ✓ {T2("Save Changes")}
            </button>
            <button onClick={()=>{setView("list");setEditUser(null);}} style={{padding:"12px 20px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",minHeight:44}}>{T2("Cancel")}</button>
          </div>
        </Card>
      </div>
    );
  }

  // ── VIEW: LIST ──
  return(
    <div>
      {/* Save toast */}
      {SavedToast}

      {/* Delete confirm modal */}
      {delId&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <Card style={{padding:"28px 24px",maxWidth:360,width:"100%",textAlign:"center",border:`2px solid ${C.redBorder}`}}>
            <div style={{fontSize:28,marginBottom:10}}>⚠️</div>
            <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6}}>{T2("Permanently Delete Staff?")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:4}}>{T2("This removes their login access forever.")}</div>
            <div style={{fontSize:11,color:C.amber,marginBottom:16,padding:"8px 10px",borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`}}>{T2("💡 Prefer Deactivate to block login while keeping their records.")}</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>deleteStaff(delId)} style={{flex:1,padding:"12px",borderRadius:12,background:`linear-gradient(135deg,${C.red},#8A1010)`,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>{T2("🗑 Confirm Delete")}</button>
              <button onClick={()=>setDelId(null)} style={{flex:1,padding:"12px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",minHeight:44}}>{T2("Cancel")}</button>
            </div>
          </Card>
        </div>
      )}

      {/* Bulk action bar — fixed bottom */}
      {selected.size>0&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:999,background:C.darkCard,borderTop:`2px solid ${C.gold}`,padding:"14px 20px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{fontSize:13,fontWeight:700,color:C.gold,flex:1}}>{selected.size} {lang==="hi"?"चुने गए":"selected"}</div>
          <button onClick={handleBulkRemoveAccess} style={{padding:"9px 18px",borderRadius:10,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:12,fontWeight:700,cursor:"pointer"}}>🔒 Remove Access</button>
          <button onClick={handleBulkDeactivate}   style={{padding:"9px 18px",borderRadius:10,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,fontWeight:700,cursor:"pointer"}}>🔴 Deactivate</button>
          <button onClick={handleBulkDelete}        style={{padding:"9px 18px",borderRadius:10,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,fontWeight:700,cursor:"pointer"}}>🗑 Delete</button>
          <button onClick={()=>setSelected(new Set())} style={{padding:"9px 14px",borderRadius:10,background:C.surface,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer"}}>✕ Cancel</button>
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>🔐 {T2("Access Manager")}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{T2("Manage staff accounts, roles & permissions — Admin only")}</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
          {staffList.length>0&&<button onClick={()=>setSelected(prev=>prev.size===staffList.length?new Set():new Set(staffList.map(s=>getSid(s))))}
            style={{padding:"7px 12px",borderRadius:9,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:"pointer"}}>
            {selected.size===staffList.length?"☑ Deselect All":"☐ Select All"}
          </button>}
          <button onClick={()=>{if(window.confirm("Reset ALL staff to default permissions? This cannot be undone.")){localStorage.removeItem('ambria_empdb_v2');window.location.reload();}}}
            style={{padding:"8px 14px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.faint,fontSize:11,cursor:"pointer",minHeight:36,whiteSpace:"nowrap"}}>
            ↺ Reset defaults
          </button>
        </div>
      </div>

      {/* Stats: Total | Has Access | No Access */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
        {[
          {l:T2("Total"),      v:allStaff.length, c:C.gold,   bg:C.goldBg},
          {l:T2("Has Access"), v:hasCnt,           c:C.green,  bg:C.greenBg},
          {l:T2("No Access"),  v:noCnt,            c:C.red,    bg:C.redBg},
        ].map(st=>(
          <div key={st.l} style={{background:st.bg,borderRadius:12,padding:"14px 10px",textAlign:"center",border:`1px solid ${st.c}22`}}>
            <div style={{fontSize:28,fontWeight:800,color:st.c,lineHeight:1}}>{st.v}</div>
            <div style={{fontSize:11,color:st.c,fontWeight:600,marginTop:4}}>{st.l}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={T2("Search staff by name or ID…")} style={{...fld,marginBottom:10,fontSize:13}}/>

      {/* Section filter pills */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
        {allSections.map(sec=>(
          <button key={sec} onClick={()=>setSectionFilter(sec)}
            style={{padding:"6px 14px",borderRadius:20,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",
              background:sectionFilter===sec?C.gold:"transparent",color:sectionFilter===sec?"#0A0908":C.muted,
              border:`1px solid ${sectionFilter===sec?C.gold:C.border}`,fontWeight:sectionFilter===sec?700:400,minHeight:32}}>
            {sec==="All"?T2("All"):T2(sec)||sec}
          </button>
        ))}
      </div>

      {/* Staff cards */}
      {staffList.map((s,i)=>{
        const sid=getSid(s);
        const active=isActive(s);
        const hasAccess=hasAppAccess(s);
        const perms=getPermissions(s);
        const canKeys=ALL_SCREEN_KEYS.filter(k=>perms[k]);
        return(
          <Card key={sid||i} style={{marginBottom:8,padding:"14px 16px",opacity:active?1:.55,border:`1px solid ${selected.has(sid)?C.gold:active?C.border:C.redBorder}`}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0}}>
                <input type="checkbox" checked={selected.has(sid)} onChange={()=>toggleSelect(sid)}
                  style={{width:18,height:18,cursor:"pointer",accentColor:C.gold}}/>
                <Avatar name={s.name||"?"} size={36} index={i}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:2}}>
                  <span style={{fontSize:14,fontWeight:700,color:C.text}}>{s.name||"—"}</span>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.gold+"15",color:C.gold,fontWeight:700}}>#{sid}</span>
                  {!active&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:6,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontWeight:600}}>{T2("Suspended")}</span>}
                </div>
                <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{s.section||"—"} · {roleShort(s.role)}</div>
                <div style={{fontSize:12,color:C.gold,fontWeight:700,background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:8,padding:"3px 10px",display:"inline-block",marginBottom:6,letterSpacing:3}}>PIN: {s.pin||"0000"}</div>
                {hasAccess?(
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {canKeys.map(k=>{const si=screenInfo(k);return <span key={k} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green,fontWeight:600}}>{si?.icon} {T2(si?.label||"")}</span>;})}
                  </div>
                ):(
                  <div style={{fontSize:12,color:C.red}}>🚫 {T2("No app access")}</div>
                )}
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",borderTop:`1px solid ${C.borderLight}`,paddingTop:10}}>
              <button onClick={()=>openPerms(s)} style={{padding:"8px 14px",borderRadius:8,background:hasAccess?C.goldBg:C.purpleBg,border:`1px solid ${hasAccess?C.goldBorder:C.purpleBorder}`,color:hasAccess?C.gold:C.purple,fontSize:11,fontWeight:700,cursor:"pointer",minHeight:36}}>
                {hasAccess?"✏️ "+T2("Edit Access"):"🔐 "+T2("Set Access")}
              </button>
              <button onClick={()=>openPin(s)} style={{padding:"8px 14px",borderRadius:8,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold,fontSize:11,fontWeight:700,cursor:"pointer",minHeight:36}}>🔑 PIN</button>
              <button onClick={()=>openEdit(s)} style={{padding:"8px 14px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:"pointer",minHeight:36}}>✏️ {T2("Edit")}</button>
              <button onClick={()=>toggleActive(sid)} style={{padding:"8px 14px",borderRadius:8,background:active?C.amberBg:C.greenBg,border:`1px solid ${active?C.amberBorder:C.greenBorder}`,color:active?C.amber:C.green,fontSize:11,fontWeight:700,cursor:"pointer",minHeight:36}}>
                {active?"⏸ "+T2("Suspend"):"▶ "+T2("Restore")}
              </button>
              <button onClick={()=>setDelId(sid)} style={{padding:"8px 14px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,cursor:"pointer",minHeight:36}}>🗑</button>
            </div>
          </Card>
        );
      })}
      {staffList.length===0&&<div style={{textAlign:"center",padding:28,color:C.faint,fontSize:12}}>{T2("No staff found")}</div>}
    </div>
  );
}

export default function App() {
  const [activeDept, setActiveDept]   = useState(null); // null = dept selector
  const [screen,setScreen]           = useState("dashboard");
  const [lang,setLang]               = useState("en");
  const [repairs,setRepairs]         = useState([]);
  const T2 = s => T(s, lang);
  const [attendance,setAttendance_raw] = useState([]);
  const setAttendance = (updater) => {
    setAttendance_raw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Auto-save day-wise to backend
      try {
        const byDate = {};
        safeArr(next).forEach(a => { if(!byDate[a.date]) byDate[a.date]=[]; byDate[a.date].push(a); });
        Object.entries(byDate).forEach(([date, recs]) => {
          window.storage?.set("att_"+date, JSON.stringify(recs));
        });
      } catch(e) {}
      return next;
    });
  };
  // Load today's attendance from backend on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await window.storage?.get("att_"+TODAY);
        if(stored?.value) { const parsed = JSON.parse(stored.value); if(Array.isArray(parsed) && parsed.length > 0) setAttendance_raw(parsed); }
      } catch(e) {}
    })();
  }, []);
  const LEAVES_INIT = [
    {id:1,staffId:"19",staffName:"Bipin",staffSection:"Tandoor",from:relDate(2),to:relDate(3),reason:"Personal",status:"Approved"},
    {id:2,staffId:"25",staffName:"Raghvendra",staffSection:"Chaat",from:TODAY,to:TODAY,reason:"Family emergency",status:"Approved"},
    {id:3,staffId:"36",staffName:"Anil",staffSection:"Sweets",from:relDate(1),to:relDate(2),reason:"Medical",status:"Pending"},
  ];
  const [leaves,setLeaves_raw]       = useState(LEAVES_INIT);
  const setLeaves = (updater) => {
    setLeaves_raw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { window.storage?.set("ambria_leaves", JSON.stringify(next)); } catch(e) {}
      return next;
    });
  };
  const [events,setEvents]           = useState(LIVE_EVENTS_INIT);
  const [kitchenTracking,setKitchenTracking] = useState({});
  const [outsideChefAtt,setOutsideChefAtt] = useState([]);
  const [currentUser,setCurrentUser] = useState(null);
  const [empDb, setEmpDb] = useState(()=>{
    try {
      const saved = localStorage.getItem('ambria_empdb_v2');
      return saved ? JSON.parse(saved) : EMPLOYEE_DB_INIT;
    } catch(e) { return EMPLOYEE_DB_INIT; }
  });
  const [sessionChecked,setSessionChecked] = useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const su = await window.storage?.get("ambria_session_user");
        if(su?.value){ try { const emp=JSON.parse(su.value); if(emp&&emp.id) setCurrentUser(emp); } catch(e){ console.warn("Session parse failed",e); } }
        // Load saved PINs
        const savedPins = await window.storage?.get("ambria_pins");
        if(savedPins?.value){ try { const pins=JSON.parse(savedPins.value); setEmpDb(prev=>prev.map(e=>pins[e.id]?{...e,pin:pins[e.id]}:e)); } catch(e){} }
        // Load saved leaves
        const savedLeaves = await window.storage?.get("ambria_leaves");
        if(savedLeaves?.value){ try { const lv=JSON.parse(savedLeaves.value); if(Array.isArray(lv)&&lv.length>0) setLeaves_raw(lv); } catch(e){} }
      }catch(e){}
      setSessionChecked(true);
    })();
  },[]);

  // Auto-save empDb to localStorage whenever it changes
  useEffect(()=>{
    try { localStorage.setItem('ambria_empdb_v2', JSON.stringify(empDb)); } catch(e) {}
  }, [empDb]);

  async function handleLogin(emp){
    setCurrentUser(emp);
    try{ await window.storage?.set("ambria_session_user",JSON.stringify(emp)); }catch(e){}
  }
  async function handleLogout(){
    setCurrentUser(null); setActiveDept(null);
    try{ await window.storage?.delete("ambria_session_user"); }catch(e){}
  }

  // ── NAV per department ──
  const DEPT_NAV = {
    kitchen: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"kitchen",label:"Kitchen",icon:"👨‍🍳"},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"store",label:"Store & Inventory",icon:"📦"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
    ],
    service: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_service",label:"Service Operations",icon:"🍽️"},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"vendors",label:"Vendor Directory",icon:"📇"},
      {id:"access",label:"Access Manager",icon:"🔐"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
    ],
    crockery: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_crockery",label:"Crockery Operations",icon:"🍶"},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"store",label:"Store & Inventory",icon:"📦"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
    ],
    beverages: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_beverages",label:"Beverage Operations",icon:"🥤"},
      {id:"menus",label:"Menu",icon:"📜"},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"store",label:"Store & Inventory",icon:"📦"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
    ],
    transport: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"transport",label:"Transport & Dispatch",icon:"🚛"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
    ],
    odc: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_odc",label:"ODC Operations",icon:"🏕️"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
    ],
  };

  const DEPT_META = {
    kitchen:{name:"Kitchen",icon:"👨‍🍳",color:"#D4A843"},
    service:{name:"Service",icon:"🍽️",color:"#5B8FD0"},
    crockery:{name:"Crockery",icon:"🍶",color:"#8A70C8"},
    beverages:{name:"Beverages",icon:"🥤",color:"#50B0A0"},
    transport:{name:"Transportation",icon:"🚛",color:"#D4A843"},
    odc:{name:"ODC",icon:"🏕️",color:C.gold},
  };

  const baseNav = activeDept ? (DEPT_NAV[activeDept]||DEPT_NAV.kitchen) : [];
  const curNav = [
    ...baseNav.filter(item=>item.id!=="access"),
    ...(currentUser?.role==="admin"?[{id:"access",label:"Access Manager",icon:"🔐"}]:[])
  ];
  const curDeptMeta = DEPT_META[activeDept]||{name:"",icon:"",color:C.gold};

  const gAlerts   = attendance.filter(a=>a.date===TODAY&&a.groomingFailed).length;
  const pendingLv = (leaves||[]).filter(l=>l.status==="Pending").length;
  const showStaffView = currentUser&&currentUser.role==="staff";

  // Loading
  if(!sessionChecked) return (<div style={{minHeight:"100vh",background:`linear-gradient(155deg,#06060A 0%,#12100A 40%,#0A0908 100%)`,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(196,164,74,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#fff"}}>A</div>
      <div style={{fontSize:13,color:"rgba(196,164,74,.6)"}}>Loading…</div>
    </div>
  );
  // Login
  if(!currentUser) return <LoginScreen empDb={empDb} onLogin={setCurrentUser} lang={lang}/>;  // Staff self-service
  if(showStaffView) return <StaffView user={currentUser} attendance={attendance} setAttendance={setAttendance} leaves={leaves} setLeaves={setLeaves} onLogout={handleLogout} lang={lang}/>;
  // ── DEPT SELECTOR (first screen for everyone) ──
  if(!activeDept) return (
    <DeptView
      attendance={attendance} setAttendance={setAttendance}
      events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking}
      lang={lang} setLang={setLang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb}
      onSelectDept={(deptId)=>{setActiveDept(deptId);setScreen("dashboard");}}
      onLogout={handleLogout}
      currentUser={currentUser}
    />
  );

  function renderScreen(s){
    switch(s){
      case "dashboard":      return <Dashboard attendance={attendance} events={events} setEvents={setEvents} leaves={leaves} setScreen={setScreen} kitchenTracking={kitchenTracking} repairs={repairs} lang={lang}/>;
      case "team":           return <TeamHub attendance={attendance} setAttendance={setAttendance} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} events={events} lang={lang} activeDept={activeDept}/>;
      case "kitchen":        return <KitchenHub events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang}/>;
      case "menus":          return <MenuPackagesView lang={lang}/>;
      case "transport":      return <TransportDispatch events={events} kitchenTracking={kitchenTracking} lang={lang}/>;
      case "store":          return <StoreModule events={events} lang={lang}/>;
      case "repair":         return <RepairMaintenance lang={lang} currentDept="management"/>;
      case "vendors":        return <VendorDirectory lang={lang}/>;
      case "access":         return <AccessManager lang={lang} empDb={empDb} setEmpDb={setEmpDb}/>;
      case "dept_service":   return <DeptView attendance={attendance} setAttendance={setAttendance} events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} forceDept="service"/>;
      case "dept_crockery":  return <DeptView attendance={attendance} setAttendance={setAttendance} events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} forceDept="crockery"/>;
      case "dept_beverages": return <DeptView attendance={attendance} setAttendance={setAttendance} events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} forceDept="beverages"/>;
      case "dept_odc":       return <DeptView attendance={attendance} setAttendance={setAttendance} events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} forceDept="odc"/>;
      default: return <div style={{padding:40,textAlign:"center",color:"#888"}}><div style={{fontSize:32,marginBottom:8}}>🔍</div><div style={{fontSize:14}}>Screen not found</div><button onClick={()=>setScreen("dashboard")} style={{marginTop:12,padding:"8px 20px",borderRadius:8,background:"#6B1818",color:"#fff",border:"none",cursor:"pointer"}}>Go to Dashboard</button></div>;
    }
  }

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"var(--font-body)",background:C.bg,overflow:"hidden"}}>
      {/* ── SIDEBAR (tablet: 260px, glass effect) ── */}
      <div style={{width:260,background:`linear-gradient(180deg, ${C.surface} 0%, #0C0B0A 100%)`,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,position:"relative"}}>
        {/* Decorative gold accent line */}
        <div style={{position:"absolute",top:0,right:0,width:1,height:"100%",background:`linear-gradient(180deg, ${C.gold}30, transparent 50%, ${C.gold}10)`}}/>

        {/* Dept badge + branding */}
        <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={{width:42,height:42,borderRadius:12,background:`linear-gradient(135deg, ${curDeptMeta.color}, ${curDeptMeta.color}90)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",boxShadow:`0 4px 12px ${curDeptMeta.color}30`}}>{curDeptMeta.icon}</div>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:.5}}>{T2(curDeptMeta.name)}</div>
              <div style={{fontSize:11,color:C.muted,letterSpacing:.3}}>Ambria Cuisines</div>
            </div>
          </div>
          <button onClick={()=>{setActiveDept(null);setScreen("dashboard");}} style={{width:"100%",padding:"12px 14px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,minHeight:44,fontWeight:500}}>
            🔄 {T2("Change Department")}
          </button>
        </div>

        {/* Nav items (tablet: larger touch targets) */}
        <nav style={{flex:1,padding:"10px 12px",overflowY:"auto"}}>
          {curNav.map(item=>{
            const active=screen===item.id;
            const badge=item.id==="team"&&(gAlerts+pendingLv)>0?(gAlerts+pendingLv):0;
            return(
              <button key={item.id} onClick={()=>setScreen(item.id)} style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",
                width:"100%",padding:"13px 16px",borderRadius:12,marginBottom:5,
                cursor:"pointer",textAlign:"left",minHeight:48,
                background:active?curDeptMeta.color+"12":"transparent",
                border:active?`1.5px solid ${curDeptMeta.color}25`:"1.5px solid transparent",
                borderLeft:active?`3px solid ${curDeptMeta.color}`:"3px solid transparent",
                color:active?curDeptMeta.color:C.muted,
                fontSize:13,fontWeight:active?600:400,letterSpacing:.3,
                boxShadow:active?`0 2px 12px ${curDeptMeta.color}10`:"none",
              }}>
                <span style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:17,opacity:active?1:.7}}>{item.icon}</span>{T(item.label,lang)}
                </span>
                {badge>0&&<span style={{background:`linear-gradient(135deg, ${curDeptMeta.color}, ${curDeptMeta.color}80)`,color:"#fff",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:10,boxShadow:`0 2px 6px ${curDeptMeta.color}30`}}>{badge}</span>}
              </button>
            );
          })}
        </nav>

        {/* User + lang + logout */}
        <div style={{padding:"16px 16px",borderTop:`1px solid ${C.borderLight}`}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <Avatar name={currentUser?.name||"A"} size={34} index={0}/>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:C.text,letterSpacing:.3}}>{currentUser?.name}</div>
              <div style={{fontSize:11,color:C.muted}}>{currentUser?.id}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setLang(l=>l==="en"?"hi":"en")} style={{flex:1,background:"none",border:`1px solid ${C.border}`,borderRadius:10,color:curDeptMeta.color,fontSize:11,padding:"10px 10px",cursor:"pointer",fontWeight:600,minHeight:42}}>
              {lang==="en"?"🇮🇳 हिंदी":"🇬🇧 English"}
            </button>
            <button onClick={handleLogout} style={{flex:1,background:"none",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontSize:11,padding:"10px 10px",cursor:"pointer",minHeight:42,fontWeight:500}}>{T("Sign out",lang)}</button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(90deg, ${C.surface}, ${C.darkCard})`,borderBottom:`1px solid ${C.border}`,padding:"16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,boxShadow:`0 2px 12px ${C.shadow}`}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:.5}}>{T(curNav.find(n=>n.id===screen)?.label||"Dashboard",lang)}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:3,letterSpacing:.3}}>{T2(curDeptMeta.name)} · {TODAY_LABEL}</div>
          </div>
          <button onClick={()=>setLang(l=>l==="en"?"hi":"en")} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:10,color:curDeptMeta.color,fontSize:12,padding:"10px 16px",cursor:"pointer",fontWeight:600,minHeight:42,letterSpacing:.3}}>
            {lang==="en"?"🇮🇳 हिंदी":"🇬🇧 English"}
          </button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"28px 32px",scrollBehavior:"smooth"}}>
          <ErrorBoundary key={screen} lang={lang}>{renderScreen(screen)}</ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
