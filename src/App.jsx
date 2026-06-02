import React, { useState, useRef, useEffect } from "react";

const C = {
  navy:"#0F1F3D",
  wine:"#6B1818",   wineMid:"#8B2222",  wineBg:"#FFF0F0",   wineBorder:"#E8C0C0",
  bg:"#F7F6F3",     surface:"#FFFFFF",
  border:"#EBEBEB", borderLight:"#F2F2F0",
  text:"#1A1A1A",   muted:"#888880",     faint:"#BBBBBB",
  green:"#2B8A50",  greenBg:"#EDF7F2",   greenBorder:"#A8D8BC",
  red:"#D63B3B",    redBg:"#FEF0F0",     redBorder:"#F5BABA",
  amber:"#C07010",  amberBg:"#FEF6E8",   amberBorder:"#F0D090",
  blue:"#1B5EAB",   blueBg:"#EEF4FD",    blueBorder:"#B0CCEE",
  purple:"#6040A8", purpleBg:"#F2EEFB",  purpleBorder:"#C8B8F0",
  teal:"#1A7A6A",   tealBg:"#EDFAF6",    tealBorder:"#A0D8D0",
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

const SECTIONS = ["Indian Curries","Tandoor","Chinese","Chaat","Sweets","Beverages"];
const SECTION_META = {
  "Indian Curries": {color:"#C07010", bg:"#FEF6E8", dot:"#E8961E", icon:"🍛"},
  "Tandoor":        {color:"#C84040", bg:"#FEF0F0", dot:"#D63B3B", icon:"🔥"},
  "Chinese":        {color:"#6040A8", bg:"#F2EEFB", dot:"#7040A8", icon:"🥢"},
  "Chaat":          {color:"#2B8A50", bg:"#EDF7F2", dot:"#2B8A50", icon:"🌮"},
  "Sweets":         {color:"#A84060", bg:"#FDF0F4", dot:"#A84060", icon:"🍮"},
  "Beverages":      {color:"#0F6E56", bg:"#E6F4F0", dot:"#0F6E56", icon:"☕"},
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
  {id:1, name:"Gopal",           role:"Head Chef",  section:"Management",     shift:"Morning"},
  {id:2, name:"Yatender",        role:"Head Chef",  section:"Management",     shift:"Evening"},
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
];

// ─── EMPLOYEE DATABASE ───────────────────────────────────────────
// PIN is 4-digit. Role: admin | headchef | staff
// IDs: AM = Ambria Management, KIT = Kitchen
const EMPLOYEE_DB_INIT = [
  // Management
  {id:"AM001",name:"Abhi",          role:"admin",    section:"Management",     dept:"Operations",    joining:"2022-01-01",pin:"1234",active:true},
  {id:"AM002",name:"Gopal",         role:"headchef", section:"Management",     dept:"F&B Kitchen",   joining:"2019-03-15",pin:"5678",active:true},
  {id:"AM003",name:"Yatender",      role:"headchef", section:"Management",     dept:"F&B Kitchen",   joining:"2018-06-01",pin:"9012",active:true},
  // Café
  {id:"CAF01",name:"Caonty",        role:"staff",    section:"Beverages",           dept:"F&B Kitchen",   joining:"2021-04-10",pin:"1111",active:true},
  {id:"CAF02",name:"Rahul",         role:"staff",    section:"Beverages",           dept:"F&B Kitchen",   joining:"2022-07-01",pin:"2222",active:true},
  {id:"CAF03",name:"Kareena",       role:"staff",    section:"Beverages",           dept:"F&B Kitchen",   joining:"2023-01-15",pin:"3333",active:true},
  {id:"CAF04",name:"Noor Alam",     role:"staff",    section:"Beverages",           dept:"F&B Kitchen",   joining:"2022-11-01",pin:"4444",active:true},
  {id:"CAF05",name:"Deepu (Café)",  role:"staff",    section:"Beverages",           dept:"F&B Kitchen",   joining:"2023-05-01",pin:"5555",active:true},
  // Indian Curries
  {id:"IND01",name:"Devendar",      role:"staff",    section:"Indian Curries", dept:"F&B Kitchen",   joining:"2020-02-01",pin:"1112",active:true},
  {id:"IND02",name:"Anas",          role:"staff",    section:"Indian Curries", dept:"F&B Kitchen",   joining:"2021-08-15",pin:"2223",active:true},
  {id:"IND03",name:"Bhopal",        role:"staff",    section:"Indian Curries", dept:"F&B Kitchen",   joining:"2019-12-01",pin:"3334",active:true},
  {id:"IND04",name:"Jeetu",         role:"staff",    section:"Indian Curries", dept:"F&B Kitchen",   joining:"2022-03-01",pin:"4445",active:true},
  {id:"IND05",name:"Hina",          role:"staff",    section:"Indian Curries", dept:"F&B Kitchen",   joining:"2023-02-15",pin:"5556",active:true},
  {id:"IND06",name:"Roshan",        role:"staff",    section:"Indian Curries", dept:"F&B Kitchen",   joining:"2021-06-01",pin:"6667",active:true},
  // Chinese
  {id:"CHN01",name:"Kishor",        role:"staff",    section:"Chinese",        dept:"F&B Kitchen",   joining:"2020-05-01",pin:"1113",active:true},
  {id:"CHN02",name:"Lokesh",        role:"staff",    section:"Chinese",        dept:"F&B Kitchen",   joining:"2019-09-01",pin:"2224",active:true},
  {id:"CHN03",name:"Monu",          role:"staff",    section:"Chinese",        dept:"F&B Kitchen",   joining:"2022-01-15",pin:"3335",active:true},
  {id:"CHN04",name:"Vichesh",       role:"staff",    section:"Chinese",        dept:"F&B Kitchen",   joining:"2021-11-01",pin:"4446",active:true},
  {id:"CHN05",name:"Sandeep",       role:"staff",    section:"Chinese",        dept:"F&B Kitchen",   joining:"2023-04-01",pin:"5557",active:true},
  // Tandoor
  {id:"TAN01",name:"Bipin",         role:"staff",    section:"Tandoor",        dept:"F&B Kitchen",   joining:"2020-08-01",pin:"1114",active:true},
  {id:"TAN02",name:"Yetender",      role:"staff",    section:"Tandoor",        dept:"F&B Kitchen",   joining:"2021-01-15",pin:"2225",active:true},
  {id:"TAN03",name:"Rawat",         role:"staff",    section:"Tandoor",        dept:"F&B Kitchen",   joining:"2019-07-01",pin:"3336",active:true},
  {id:"TAN04",name:"Surender",      role:"staff",    section:"Tandoor",        dept:"F&B Kitchen",   joining:"2022-06-01",pin:"4447",active:true},
  {id:"TAN05",name:"Prabhash",      role:"staff",    section:"Tandoor",        dept:"F&B Kitchen",   joining:"2023-03-01",pin:"5558",active:true},
  {id:"TAN06",name:"Kushal Pal",    role:"staff",    section:"Tandoor",        dept:"F&B Kitchen",   joining:"2023-07-01",pin:"6668",active:true},
  // Chaat
  {id:"CHA01",name:"Raghvendra",    role:"staff",    section:"Chaat",          dept:"F&B Kitchen",   joining:"2020-01-01",pin:"1115",active:true},
  {id:"CHA02",name:"Purushotam",    role:"staff",    section:"Chaat",          dept:"F&B Kitchen",   joining:"2021-03-15",pin:"2226",active:true},
  {id:"CHA03",name:"Balram",        role:"staff",    section:"Chaat",          dept:"F&B Kitchen",   joining:"2022-09-01",pin:"3337",active:true},
  {id:"CHA04",name:"Ajay",          role:"staff",    section:"Chaat",          dept:"F&B Kitchen",   joining:"2021-07-01",pin:"4448",active:true},
  {id:"CHA05",name:"Golu",          role:"staff",    section:"Chaat",          dept:"F&B Kitchen",   joining:"2023-01-01",pin:"5559",active:true},
  {id:"CHA06",name:"Kuldeep",       role:"staff",    section:"Chaat",          dept:"F&B Kitchen",   joining:"2022-04-15",pin:"6669",active:true},
  {id:"CHA07",name:"Anurag",        role:"staff",    section:"Chaat",          dept:"F&B Kitchen",   joining:"2023-06-01",pin:"7770",active:true},
  {id:"CHA08",name:"Satyendra",     role:"staff",    section:"Chaat",          dept:"F&B Kitchen",   joining:"2022-02-01",pin:"8881",active:true},
  {id:"CHA09",name:"Sahdev",        role:"staff",    section:"Chaat",          dept:"F&B Kitchen",   joining:"2021-10-15",pin:"9992",active:true},
  {id:"CHA10",name:"Badal",         role:"staff",    section:"Chaat",          dept:"F&B Kitchen",   joining:"2023-08-01",pin:"1230",active:true},
  // Sweets
  {id:"SWT01",name:"Bachchan",      role:"staff",    section:"Sweets",         dept:"F&B Kitchen",   joining:"2019-11-01",pin:"1116",active:true},
  {id:"SWT02",name:"Anil",          role:"staff",    section:"Sweets",         dept:"F&B Kitchen",   joining:"2020-09-15",pin:"2227",active:true},
  {id:"SWT03",name:"Ramu",          role:"staff",    section:"Sweets",         dept:"F&B Kitchen",   joining:"2021-05-01",pin:"3338",active:true},
  {id:"SWT04",name:"Yogesh",        role:"staff",    section:"Sweets",         dept:"F&B Kitchen",   joining:"2022-08-01",pin:"4449",active:true},
  {id:"SWT05",name:"Vrindhavan",    role:"staff",    section:"Sweets",         dept:"F&B Kitchen",   joining:"2020-12-15",pin:"5550",active:true},
  {id:"SWT06",name:"Radheshyam",    role:"staff",    section:"Sweets",         dept:"F&B Kitchen",   joining:"2021-09-01",pin:"6661",active:true},
  {id:"SWT07",name:"Abhishek",      role:"staff",    section:"Sweets",         dept:"F&B Kitchen",   joining:"2022-05-15",pin:"7772",active:true},
  {id:"SWT08",name:"Deepu (Sweets)",role:"staff",    section:"Sweets",         dept:"F&B Kitchen",   joining:"2023-02-01",pin:"8883",active:true},
  {id:"SWT09",name:"Saurab",        role:"staff",    section:"Sweets",         dept:"F&B Kitchen",   joining:"2023-09-01",pin:"9994",active:true},
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

const TODAY = new Date().toISOString().split("T")[0];
const TODAY_LABEL = new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

const LIVE_EVENTS_INIT = [
  {
    id:"FP-2025-101", guest:"Sharma Wedding", venue:"Ambria Pushpanjali",
    date:TODAY, time:"7:00 PM", type:"Wedding", pax:500, veg:350, nonveg:150,
    menuPackage:"Multi-Cuisine Non-Veg",
    menu:MENU_PACKAGES["Multi-Cuisine Non-Veg"]||[],
    special:"No onion-garlic for 50 Jain guests. Welcome drink mandatory.",
    extras:[
      {item:"Paan Counter",qty:1,type:"Complimentary",by:"Sales Team"},
      {item:"Personalized Menu Cards",qty:500,type:"Chargeable",rate:15,by:"Sales Team"},
    ],
  },
  {
    id:"FP-2025-102", guest:"Gupta Reception", venue:"Ambria Exotica",
    date:new Date(Date.now()+86400000).toISOString().split("T")[0], time:"4:00 PM", type:"Reception", pax:400, veg:280, nonveg:120,
    menuPackage:"Magnum Veg",
    menu:MENU_PACKAGES["Magnum Veg"]||[],
    special:"Ice cream counter to be set up by 6 PM.",
    extras:[
      {item:"Mocktail Counter (Extra Flavours)",qty:3,type:"Complimentary",by:"Sales Team"},
      {item:"Flower Decoration on Tables",qty:1,type:"Chargeable",rate:5000,by:"Sales Team"},
    ],
  },
  {
    id:"FP-2025-103", guest:"Kapoor Anniversary", venue:"Manaktala Farm",
    date:new Date(Date.now()+86400000).toISOString().split("T")[0], time:"6:00 PM", type:"Other", pax:200, veg:200, nonveg:0,
    menuPackage:"Multi-Cuisine Veg",
    menu:MENU_PACKAGES["Multi-Cuisine Veg"]||[],
    special:"Pure Veg event. No non-veg items anywhere on premises.",
    extras:[
      {item:"Live Chaat Counter",qty:1,type:"Complimentary",by:"Sales Team"},
      {item:"Branded Napkins",qty:200,type:"Chargeable",rate:8,by:"Sales Team"},
    ],
  },
];


// ─── TRANSLATIONS ─────────────────────────────────────────────────
const HI = {
  // NAV
  "Dashboard":"डैशबोर्ड","Event Calendar":"इवेंट कैलेंडर","Team & Attendance":"टीम व हाज़िरी",
  "Kitchen":"रसोई","Menu Packages":"मेनू पैकेज","Transport & Dispatch":"ट्रांसपोर्ट व डिस्पैच",
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
  "Mise en place":"सामान तैयार करें","Primary prep":"प्राथमिक तैयारी","Cooking":"खाना बनाना",
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
  "Dispatch Time":"रवाना समय","+ Add Vehicle":"+ वाहन जोड़ें",
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
  "Menu Packages":"मेनू पैकेज","packages":"पैकेज",
  "items total":"कुल आइटम","Search dishes…":"व्यंजन खोजें…","No items match your search.":"कोई आइटम नहीं मिला।",

  // DASHBOARD
  "Add Function":"फंक्शन जोड़ें","Good morning":"सुप्रभात","Good afternoon":"शुभ अपराह्न","Good evening":"शुभ संध्या",
  "Today's Events":"आज के इवेंट","Live now":"अभी लाइव","pax":"पैक्स",
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
};
// T() — translate string if Hindi mode
function T(str, lang){ return (lang==="hi" && HI[str]) ? HI[str] : str; }


// ─── ERROR BOUNDARY ──────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={hasError:false,error:null}; }
  static getDerivedStateFromError(e){ return {hasError:true,error:e}; }
  componentDidCatch(e,info){ console.error("Ambria App Error:",e,info); }
  render(){
    if(this.state.hasError){
      return (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",padding:40,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
          <div style={{fontSize:16,fontWeight:700,color:"#6B1818",marginBottom:8}}>Something went wrong</div>
          <div style={{fontSize:12,color:"#888",marginBottom:20,maxWidth:360}}>{this.state.error?.message||"An unexpected error occurred in this section."}</div>
          <button onClick={()=>this.setState({hasError:false,error:null})} style={{padding:"9px 22px",borderRadius:9,background:"#6B1818",color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>↺ Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}


const NAV_ADMIN = [
  {id:"dashboard",  label:"Dashboard",           icon:"📊"},
  {id:"calendar",   label:"Event Calendar",       icon:"📅"},
  {id:"team",       label:"Team & Attendance",    icon:"👥"},
  {id:"kitchen",    label:"Kitchen",              icon:"👨‍🍳"},
  {id:"menus",      label:"Menu Packages",        icon:"📜"},
  {id:"transport",  label:"Transport & Dispatch", icon:"🚛"},
  {id:"store",      label:"Store & Inventory",    icon:"📦"},
  {id:"vendors",    label:"Vendor Directory",      icon:"🤝"},
];
const NAV = NAV_ADMIN;

// ─── VENUE DATA FROM PPT ──────────────────────────────────────────
const AMBRIA_VENUES = [
  {id:"ap",  code:"AP",  name:"Ambria Pushpanjali", location:"Dwarka, Delhi",
   capacity:1500, area:"3 Acres", banquet:"14,000 sq.ft", lawn:"40,000 sq.ft",
   parking:"125+ cars", color:"#6B1818", bg:"#FFF0F0",
   sections:["Indoor Banquet","Grand Lawn","Walkway (120 ft)"],
   highlight:"Exclusive single-event · Near IGI Airport"},
  {id:"am",  code:"AM",  name:"Ambria Manaktala",   location:"Kapasher, Delhi",
   capacity:2500, area:"3 Acres", banquet:"24,000 sq.ft", lawn:"43,000 sq.ft",
   parking:"250+ cars", color:"#185FA5", bg:"#EEF4FD",
   sections:["Emerald Lawn (Glasshouse + Lawn)","Alstonia Lawn (Open + Covered)","Hanger (8,000 sq.ft)"],
   highlight:"Two venues · 400 ft driveway · Valet parking"},
  {id:"ae",  code:"AE",  name:"Ambria Exotica",     location:"Dwarka, Delhi",
   capacity:1800, area:"4 Acres", banquet:"20,500 sq.ft", lawn:"35,000 sq.ft",
   parking:"300–350 cars", color:"#854F0B", bg:"#FEF6E2",
   sections:["Aura (Glasshouse + Lawn + Porch)","Valencia (Glasshouse + Lawn + Poolside)"],
   highlight:"Two glasshouses · Poolside venue · 20,000 sq.ft walkway"},
  {id:"ar",  code:"AR",  name:"Ambria Restro",      location:"Dwarka, Delhi",
   capacity:400, area:"0.75 Acres", banquet:"1,500 sq.ft", lawn:"8,000 sq.ft",
   parking:"100+ cars", color:"#0F6E56", bg:"#E6F4F0",
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
      fontSize:size*0.38,fontWeight:700,color:"#fff",flexShrink:0,fontFamily:"Georgia,serif"}}>
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
        <circle cx="40" cy="40" r={r} fill="none" stroke="#EBEBEB" strokeWidth="7"/>
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

function Chip({label,color=C.muted,bg="#F2F1EE",size=11}) {
  return <span style={{display:"inline-block",fontSize:size,fontWeight:500,padding:"2px 9px",borderRadius:20,background:bg,color,whiteSpace:"nowrap"}}>{label}</span>;
}

function STag({name}) {
  const m=SECTION_META[name]||{bg:"#F2F1EE",color:C.muted,icon:""};
  return <span style={{fontSize:11,fontWeight:500,padding:"2px 9px",borderRadius:20,background:m.bg,color:m.color}}>{m.icon} {name}</span>;
}

function Card({children,style={}}) {
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px",...style}}>{children}</div>;
}

function Btn({children,onClick,color=C.wine,textColor="#fff",border="none",style={}}) {
  return <button onClick={onClick} style={{padding:"7px 16px",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer",background:color,color:textColor,border,...style}}>{children}</button>;
}

function SectionHeader({icon,title}) {
  return <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:14,display:"flex",alignItems:"center",gap:6}}>{icon} {title}</div>;
}

// ─── SELFIE CAPTURE ────────────────────────────────────────────
function SelfieCapture({onCapture,onRetake,captured}) {
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
      <button onClick={()=>{onRetake();start();}} style={{marginTop:8,fontSize:11,background:"none",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",color:C.muted}}>Retake</button>
    </div>
  );
  return (
    <div style={{textAlign:"center"}}>
      <div style={{width:160,height:120,borderRadius:10,overflow:"hidden",background:C.bg,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>
        <video ref={vRef} style={{width:"100%",height:"100%",objectFit:"cover",display:streaming?"block":"none"}}/>
        {!streaming&&<div style={{color:C.muted,fontSize:13}}>📷<br/>Camera</div>}
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
function LoginScreen({ empDb, onLogin }) {
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
          const emp  = (empDb||[]).find(e=>String(e.id).toUpperCase()===id);
          if(emp && emp.active && String(emp.pin)===pin2){
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
    const emp = (empDb||[]).find(e=>String(e.id).toUpperCase()===id);
    if(!emp){setError("Employee ID not found.");setLoading(false);return;}
    if(!emp.active){setError("Account inactive. Contact manager.");setLoading(false);return;}
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
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${C.wine} 0%,#2d0707 100%)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:C.surface,borderRadius:20,padding:"40px 44px",width:380,boxShadow:"0 24px 60px rgba(0,0,0,.35)"}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:C.wine,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"#fff",margin:"0 auto 14px"}}>A</div>
          <div style={{fontSize:22,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>Ambria Work Force</div>
          <div style={{fontSize:12,color:C.muted,marginTop:4}}>F&B Kitchen Operations · Sign in</div>
        </div>

        {/* Form */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>Employee ID</div>
          <input
            value={empId}
            onChange={e=>setEmpId(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            placeholder="e.g. AM001"
            style={{width:"100%",padding:"11px 14px",borderRadius:10,border:`1.5px solid ${error?C.red:C.border}`,fontSize:14,color:C.text,background:C.bg,outline:"none",boxSizing:"border-box",transition:"border .2s"}}
            autoFocus
          />
        </div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>4-Digit PIN</div>
          <input
            type="password"
            value={pin}
            onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,4))}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            placeholder="••••"
            maxLength={4}
            style={{width:"100%",padding:"11px 14px",borderRadius:10,border:`1.5px solid ${error?C.red:C.border}`,fontSize:18,color:C.text,background:C.bg,outline:"none",boxSizing:"border-box",letterSpacing:6,transition:"border .2s"}}
          />
        </div>

        {error&&<div style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.red,marginBottom:14}}>{error}</div>}

        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,cursor:"pointer"}} onClick={()=>setRemember(r=>!r)}>
          <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${remember?C.wine:C.border}`,background:remember?C.wine:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
            {remember&&<span style={{color:"#fff",fontSize:11,fontWeight:700}}>✓</span>}
          </div>
          <span style={{fontSize:12,color:C.muted}}>Remember me on this device</span>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading||!empId||pin.length<4}
          style={{width:"100%",padding:"13px",borderRadius:11,background:(!empId||pin.length<4)?C.border:C.wine,color:(!empId||pin.length<4)?C.muted:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:(!empId||pin.length<4)?"not-allowed":"pointer",transition:"background .2s",fontFamily:"Georgia,serif"}}>
          {loading?"Signing in…":"Sign In →"}
        </button>

        <div style={{textAlign:"center",marginTop:16,fontSize:11,color:C.faint}}>
          Ambria Cuisines · Get Your Venue Events Pvt Ltd
        </div>
      </div>
    </div>
  );
}


function StaffView({user, attendance, setAttendance, leaves, setLeaves, onLogout}) {
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
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI','DM Sans',sans-serif"}}>
      {/* Top bar */}
      <div style={{background:C.wine,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Avatar name={user.name} size={36} index={staffIdx>=0?staffIdx:0}/>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{user.name}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>{user.id} · {user.section} · {user.dept}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 14px",cursor:"pointer"}}>Sign Out</button>
      </div>

      {/* Tab bar */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",display:"flex",gap:4}}>
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
            <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"Georgia,serif",marginBottom:14}}>Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, {(user.name||"").split(" ")[0]} 👋</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div style={{background:todayRec?.status==="Present"?C.greenBg:C.redBg,borderRadius:12,padding:"14px 16px",border:`1px solid ${todayRec?.status==="Present"?C.greenBorder:C.redBorder}`}}>
                <div style={{fontSize:11,fontWeight:600,color:todayRec?.status==="Present"?C.green:C.red,marginBottom:4}}>Today's Attendance</div>
                <div style={{fontSize:18,fontWeight:700,color:todayRec?.status==="Present"?C.green:C.red}}>{todayRec?todayRec.status:"Not marked"}</div>
                {todayRec&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>Marked at {todayRec.time}</div>}
                {!todayRec&&<button onClick={()=>setTab("attendance")} style={{marginTop:8,padding:"5px 12px",borderRadius:7,background:C.wine,color:"#fff",border:"none",fontSize:11,cursor:"pointer"}}>Mark Now →</button>}
              </div>
              <div style={{background:C.blueBg,borderRadius:12,padding:"14px 16px",border:`1px solid ${C.blueBorder}`}}>
                <div style={{fontSize:11,fontWeight:600,color:C.blue,marginBottom:4}}>Leave Balance</div>
                <div style={{fontSize:18,fontWeight:700,color:C.blue}}>{myLeaves.filter(l=>l.status==="Approved").length} taken</div>
                <div style={{fontSize:10,color:C.muted,marginTop:3}}>{myLeaves.filter(l=>l.status==="Pending").length} pending approval</div>
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
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"Georgia,serif",marginBottom:14}}>Mark Attendance — {TODAY_LABEL}</div>

            {todayRec&&attStep==="check"&&(
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:12,padding:"16px",marginBottom:14,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>✅</div>
                <div style={{fontSize:15,fontWeight:700,color:C.green}}>Already marked — {todayRec.status}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>Checked in at {todayRec.time}</div>
                {todayRec.selfie&&<img src={todayRec.selfie} alt="" style={{width:80,height:60,objectFit:"cover",borderRadius:8,border:`2px solid ${C.greenBorder}`,marginTop:10}}/>}
                <div style={{marginTop:12}}>
                  <button onClick={()=>setAttStep("capture")} style={{padding:"7px 16px",borderRadius:8,background:C.wine,color:"#fff",border:"none",fontSize:12,cursor:"pointer"}}>Re-mark Attendance</button>
                </div>
              </div>
            )}

            {attStep==="done"&&(
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:12,padding:"24px",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:10}}>✅</div>
                <div style={{fontSize:16,fontWeight:700,color:C.green}}>Attendance marked!</div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>{TODAY} · {new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                {!allOk&&<div style={{marginTop:10,padding:"8px 12px",background:C.amberBg,borderRadius:8,fontSize:12,color:C.amber}}>⚠ Some grooming checks were incomplete — supervisor notified</div>}
                <button onClick={()=>setAttStep("check")} style={{marginTop:14,padding:"8px 18px",borderRadius:8,background:C.wine,color:"#fff",border:"none",fontSize:12,cursor:"pointer"}}>Done</button>
              </div>
            )}

            {(attStep==="capture"||(!todayRec&&attStep==="check"))&&(
              <div>
                <Card style={{marginBottom:12}}>
                  <SectionHeader icon="📷" title="Take a Selfie"/>
                  <SelfieCapture captured={selfie} onCapture={setSelfie} onRetake={()=>setSelfie(null)}/>
                  {!selfie&&<div style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:8}}>Required to mark attendance</div>}
                </Card>
                <Card style={{marginBottom:12}}>
                  <SectionHeader icon="✓" title="Grooming Self-Check"/>
                  <div style={{fontSize:11,color:C.muted,marginBottom:10}}>Confirm your grooming before starting shift:</div>
                  {GROOMING_CHECKS.map(c=>(
                    <label key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer"}}>
                      <input type="checkbox" checked={!!grooming[c.id]} onChange={e=>setGrooming(p=>({...p,[c.id]:e.target.checked}))} style={{width:16,height:16,accentColor:C.wine,cursor:"pointer"}}/>
                      <span style={{fontSize:13,color:C.text}}>{c.label}</span>
                      {grooming[c.id]&&<span style={{marginLeft:"auto",fontSize:11,color:C.green,fontWeight:500}}>✓</span>}
                    </label>
                  ))}
                  {!allOk&&<div style={{marginTop:8,padding:"7px 10px",background:C.amberBg,borderRadius:7,fontSize:11,color:C.amber}}>{GROOMING_CHECKS.filter(c=>!grooming[c.id]).length} items pending — supervisor will be notified</div>}
                </Card>
                <div style={{display:"flex",gap:8}}>
                  <Btn onClick={()=>{if(!selfie){alert("Please capture selfie first");return;}submitAtt("Present");}} color={C.wine} style={{flex:1,padding:"12px",fontSize:14,fontWeight:600}}>✓ Mark Present</Btn>
                  <Btn onClick={()=>submitAtt("Late")} color={C.amberBg} textColor={C.amber} border={`1px solid ${C.amberBorder}`} style={{padding:"12px 16px",fontSize:13}}>Late</Btn>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LEAVES ── */}
        {tab==="leaves"&&(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"Georgia,serif",marginBottom:14}}>My Leave Requests</div>
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
              <input value={leaveForm.reason} onChange={e=>setLeaveForm(p=>({...p,reason:e.target.value}))} placeholder="Reason (optional)"
                style={{width:"100%",padding:"8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,marginBottom:10,boxSizing:"border-box"}}/>
              <Btn onClick={submitLeave} style={{width:"100%",padding:"10px",fontSize:13}}>Submit Request</Btn>
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
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"Georgia,serif",marginBottom:14}}>My Profile</div>
            <Card style={{marginBottom:12}}>
              <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:16}}>
                <Avatar name={user.name} size={64} index={staffIdx>=0?staffIdx:0}/>
                <div>
                  <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>{user.name}</div>
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
                    <div style={{fontSize:10,color:C.muted}}>{f.l}</div>
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




function Dashboard({attendance,events,setEvents,leaves,setScreen,kitchenTracking}) {
  const [deleteId,setDeleteId] = useState(null);
  const [showAdd,setShowAdd]   = useState(false);
  const [form,setForm]         = useState({
    guest:"",venue:"Ambria Pushpanjali",date:"",time:"7:30 PM",
    type:"Wedding",pax:"",menuType:"Veg + Non-Veg",menuPackage:"",menu:"",special:"",
  });

  const todayAtt  = (attendance||[]).filter(a=>a.date===TODAY);
  const present   = todayAtt.filter(a=>a.status==="Present");
  const absent    = todayAtt.filter(a=>a.status==="Absent");
  const late      = todayAtt.filter(a=>a.status==="Late");
  const gIssues   = todayAtt.filter(a=>a.groomingFailed);
  const onLeave   = leaves.filter(l=>l.status==="Approved"&&l.from<=TODAY&&l.to>=TODAY);
  const pendingLv = leaves.filter(l=>l.status==="Pending");

  // FY stats
  const FY_START="2026-04-01", FY_END="2027-03-31";
  const fyEvs=(events||[]).filter(ev=>ev.date>=FY_START&&ev.date<=FY_END);
  const fyDone=fyEvs.filter(ev=>{const d=Object.values(kitchenTracking?.[ev.id]||{});return d.length>0&&d.every(di=>Array.isArray(di.done)&&Array.isArray(di.steps)&&di.steps.length>0&&di.done.length>=di.steps.length);});
  const fyUpcoming=fyEvs.filter(ev=>ev.date>=TODAY);
  const fyPast=fyEvs.filter(ev=>ev.date<TODAY);
  const fyPct=fyEvs.length>0?Math.round(fyDone.length/fyEvs.length*100):0;

  // Today's events
  const todayEvs=(events||[]).filter(ev=>ev.date===TODAY);
  const soonEvs=(events||[]).filter(ev=>ev.date>TODAY).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,3);

  const PROP_META={
    "Ambria Pushpanjali":{code:"AP",color:"#6B1818",bg:"#FFF0F0"},
    "Ambria Ballroom A": {code:"AP",color:"#6B1818",bg:"#FFF0F0"},
    "Manaktala Farm":    {code:"AM",color:"#B05A10",bg:"#FEF3E8"},
    "Ambria Manaktala":  {code:"AM",color:"#B05A10",bg:"#FEF3E8"},
    "Ambria Exotica":    {code:"AE",color:"#854F0B",bg:"#FEF6E2"},
    "Ambria Restro":     {code:"AR",color:"#0F6E56",bg:"#E6F4F0"},
    "Ambria Cuisine":    {code:"AC",color:"#185FA5",bg:"#EEF4FD"},
    "Outdoor Catering (ODC)":{code:"ODC",color:"#5A3FA0",bg:"#F0EDFC"},
  };
  const TYPE_ICONS={"Wedding":"💍","Reception":"🥂","Corporate":"💼","Outdoor":"🌿","Birthday":"🎂","Other":"🎉"};
  const VENUE_OPTIONS=["Ambria Pushpanjali","Ambria Manaktala","Ambria Exotica","Ambria Restro","Ambria Cuisine","Outdoor Catering (ODC)"];
  function getProp(v){return PROP_META[v]||{code:"EV",color:C.wine,bg:C.wineBg};}

  function generateFPId(){
    const nums=(events||[]).map(e=>+e.id.replace(/\D/g,"")).filter(Boolean);
    return `FP-${new Date().getFullYear()}-${String(Math.max(0,...nums)+1).padStart(3,"0")}`;
  }
  function addFunction(){
    if(!form.guest||!form.date||!form.pax)return;
    const paxNum=+form.pax||0;
    const veg=form.menuType==="Full Vegetarian"?paxNum:form.menuType==="Non-Vegetarian"?0:Math.round(paxNum*.6);
    // Use package items if a package is selected, else use manual entry
    const menuItems = form.menuPackage && MENU_PACKAGES[form.menuPackage]
      ? MENU_PACKAGES[form.menuPackage]
      : form.menu?form.menu.split(",").map(s=>s.trim()).filter(Boolean):[];
    setEvents(p=>[...p,{
      id:generateFPId(), guest:form.guest, venue:form.venue, date:form.date,
      time:form.time, type:form.type, pax:paxNum, veg, nonveg:paxNum-veg,
      menu:menuItems, menuPackage:form.menuPackage||"",
      special:form.special, syncedAt:"Just added",
    }]);
    setForm({guest:"",venue:"Ambria Pushpanjali",date:"",time:"7:30 PM",type:"Wedding",pax:"",menuType:"Veg + Non-Veg",menuPackage:"",menu:"",special:""});
    setShowAdd(false);
  }
  function deleteEvent(id){setEvents(p=>p.filter(e=>e.id!==id));setDeleteId(null);}

  return (
    <div>
      {/* Delete confirm */}
      {deleteId&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.surface,borderRadius:16,padding:"28px 30px",maxWidth:340,width:"90%",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:10}}>🗑</div>
            <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:5}}>Delete this function?</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{events.find(e=>e.id===deleteId)?.guest}</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>setDeleteId(null)} style={{padding:"8px 18px",borderRadius:8,background:"transparent",color:C.muted,border:`1px solid ${C.border}`,fontSize:13,cursor:"pointer"}}>Cancel</button>
              <button onClick={()=>deleteEvent(deleteId)} style={{padding:"8px 18px",borderRadius:8,background:C.red,color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FY EVENTS BAR ── */}
      <Card style={{marginBottom:14,padding:"14px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>📊 Financial Year Events</div>
            <div style={{display:"flex",gap:6,alignItems:"center",marginTop:1,flexWrap:"wrap"}}><span style={{fontSize:11,color:C.muted}}>April 2026 → March 2027</span><span style={{fontSize:9,padding:"1px 7px",borderRadius:10,background:C.amberBg,color:C.amber,fontWeight:600}}>📅 Calendar sync pending</span></div>
          </div>
          <div style={{fontSize:26,fontWeight:700,color:C.wine}}>{fyEvs.length} <span style={{fontSize:12,fontWeight:400,color:C.muted}}>total</span></div>
        </div>
        <div style={{height:6,background:C.border,borderRadius:3,marginBottom:10,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${fyPct}%`,background:C.wine,borderRadius:3,transition:"width .5s"}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[
            {l:"Upcoming",v:fyUpcoming.length,c:C.blue, bg:C.blueBg},
            {l:"Completed",v:fyPast.length,   c:C.green,bg:C.greenBg},
            {l:"Fully prepped",v:fyDone.length,c:"#0F6E56",bg:"#E6F4F0"},
          ].map(s=>(
            <div key={s.l} style={{background:s.bg,borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,color:s.c,marginTop:1,fontWeight:500}}>{s.l}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── TODAY'S EVENTS ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>
          {todayEvs.length>0?"🔴 Live today":"📅 No events today"}
          {todayEvs.length>0&&<span style={{marginLeft:8,fontSize:11,fontWeight:400,color:C.muted}}>{TODAY_LABEL}</span>}
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)} color={showAdd?"transparent":C.wine} textColor={showAdd?C.muted:"#fff"} border={showAdd?`1px solid ${C.border}`:"none"} style={{fontSize:11,padding:"4px 12px"}}>
          {showAdd?"✕ Cancel":"+ Add Function"}
        </Btn>
      </div>

      {/* Add function inline form */}
      {showAdd&&(
        <Card style={{marginBottom:14,border:`1.5px solid ${C.wine}`,background:"#FFFAF8"}}>
          <div style={{fontSize:14,fontWeight:700,color:C.wine,marginBottom:12,fontFamily:"Georgia,serif"}}>📋 Add New Function</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
            <div style={{gridColumn:"1/3"}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Guest / Client Name *</div>
              <input value={form.guest} onChange={e=>setForm(p=>({...p,guest:e.target.value}))} placeholder="e.g. Sharma Wedding"
                style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
            </div>
            <div>
              <div style={{fontSize:10,color:C.muted,marginBottom:3}}>FP No.</div>
              <div style={{padding:"8px 10px",borderRadius:8,background:C.bg,fontSize:12,fontWeight:600,color:C.wine}}>{generateFPId()}</div>
            </div>
            {[
              {l:"Venue",k:"venue",type:"sel",opts:VENUE_OPTIONS},
              {l:"Date *",k:"date",dt:"date"},
              {l:"Time",k:"time",ph:"7:30 PM"},
              {l:"Function Type",k:"type",type:"sel",opts:["Wedding","Reception","Corporate","Birthday","Outdoor","Other"]},
              {l:"Gathering (pax) *",k:"pax",ph:"e.g. 800",inp:"number"},
              {l:"Menu Type",k:"menuType",type:"sel",opts:["Full Vegetarian","Non-Vegetarian","Veg + Non-Veg"]},
            ].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:10,color:C.muted,marginBottom:3}}>{f.l}</div>
                {f.type==="sel"
                  ?<select value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}>
                    {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                  :<input type={f.dt||f.inp||"text"} value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph}
                    style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
                }
              </div>
            ))}
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Menu items (comma separated)</div>
              <input value={form.menu} onChange={e=>setForm(p=>({...p,menu:e.target.value}))} placeholder="Dal Makhani, Butter Chicken, Paneer Tikka, Gulab Jamun…"
                style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Special instructions</div>
              <textarea value={form.special} onChange={e=>setForm(p=>({...p,special:e.target.value}))} placeholder="Jain covers, live counters, dietary requirements…"
                style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,resize:"none",height:48,fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>setShowAdd(false)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
            <Btn onClick={addFunction} color={!form.guest||!form.date||!form.pax?C.border:C.wine} textColor={!form.guest||!form.date||!form.pax?C.muted:"#fff"} style={{fontSize:12,padding:"8px 20px"}}>Create Function →</Btn>
          </div>
        </Card>
      )}

      {/* Today's event cards */}
      {todayEvs.length===0?(
        <Card style={{marginBottom:14,background:C.bg,border:`1.5px dashed ${C.border}`,padding:"20px",textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:8}}>📭</div>
          <div style={{fontSize:14,fontWeight:600,color:C.muted,marginBottom:4}}>No functions scheduled today</div>
          <div style={{fontSize:12,color:C.faint}}>Use "+ Add Function" to create a new booking</div>
        </Card>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginBottom:14}}>
          {todayEvs.map(ev=>{
            const p=getProp(ev.venue);
            const menuType=ev.veg>0&&ev.nonveg>0?"Veg + Non-Veg":ev.veg>0?"Full Veg":"Non-Veg";
            const mtCol=ev.nonveg===0?C.green:ev.veg===0?C.amber:C.blue;
            const mtBg=ev.nonveg===0?C.greenBg:ev.veg===0?C.amberBg:C.blueBg;
            const evTkDash=kitchenTracking?.[ev.id]||{};
            const evDishes=Object.values(evTkDash);
            const prepPct=evDishes.length>0?Math.round(evDishes.filter(d=>d.checkedSteps?.length>=d.steps?.length&&d.steps?.length>0).length/evDishes.length*100):0;
            return (
              <div key={ev.id} style={{background:C.surface,border:`1.5px solid ${p.color}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{height:4,background:p.color}}/>
                <div style={{padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:4}}>
                        <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:p.bg,color:p.color}}>{p.code}</span>
                        <span style={{fontSize:12}}>{TYPE_ICONS[ev.type]||"🎉"}</span>
                        <span style={{fontSize:11,color:C.muted}}>{ev.type}</span>
                      </div>
                      <div style={{fontSize:15,fontWeight:700,color:C.text}}>{ev.guest}</div>
                    </div>
                    <div style={{display:"flex",gap:5,alignItems:"center"}}>
                      <div style={{textAlign:"right"}}><div style={{fontSize:19,fontWeight:700,color:p.color}}>{ev.pax}</div><div style={{fontSize:9,color:C.muted}}>pax</div></div>
                      <button onClick={()=>setDeleteId(ev.id)} style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:5,color:C.red,fontSize:11,padding:"2px 6px",cursor:"pointer"}}>🗑</button>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,color:C.muted,background:C.bg,padding:"2px 7px",borderRadius:5}}>⏰ {ev.time}</span>
                    <span style={{fontSize:10,color:C.muted,background:C.bg,padding:"2px 7px",borderRadius:5}}>📍 {ev.venue}</span>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:14,background:mtBg,color:mtCol}}>{menuType}</span>
                  </div>
                  {/* Prep bar */}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{flex:1,height:5,background:C.border,borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${prepPct}%`,background:prepPct===100?C.green:C.wine,borderRadius:3,transition:"width .4s"}}/>
                    </div>
                    <span style={{fontSize:10,fontWeight:600,color:prepPct===100?C.green:C.wine,flexShrink:0}}>{prepPct}% prepped</span>
                  </div>
                  {/* Menu preview */}
                  <div style={{background:C.bg,borderRadius:7,padding:"7px 9px"}}>
                    <div style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4}}>Menu · {ev.menu.length} items</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                      {ev.menu.slice(0,5).map((m,i)=><span key={i} style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:C.surface,border:`1px solid ${C.border}`,color:C.text}}>{m}</span>)}
                      {ev.menu.length>5&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:C.wineBg,color:C.wine,fontWeight:600}}>+{ev.menu.length-5}</span>}
                    </div>
                  </div>
                  {ev.special&&<div style={{marginTop:7,fontSize:10,color:C.amber,background:C.amberBg,borderRadius:6,padding:"5px 8px"}}>⚠ {ev.special}</div>}
                  <div style={{marginTop:6,fontSize:9,color:C.faint}}>{ev.id} · {ev.syncedAt}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── COMING SOON ── */}
      {soonEvs.length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>📆 Coming up next</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {soonEvs.map(ev=>{
              const p=getProp(ev.venue);
              return (
                <div key={ev.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:C.text}}>{ev.guest}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:1}}>{ev.date} · {ev.time} · {ev.pax} pax · {p.code}</div>
                    </div>
                  </div>
                  <button onClick={()=>setDeleteId(ev.id)} style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:5,color:C.red,fontSize:10,padding:"2px 6px",cursor:"pointer"}}>🗑</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PROPERTY STAFF SNAPSHOT ── */}
      {(()=>{
        const AP_SECS=["Indian Curries","Tandoor","Chinese","Beverages"];
        const AE_SECS=["Chaat","Sweets"];
        const PROPS=[
          {code:"AP",label:"Ambria Pushpanjali",secs:AP_SECS,color:"#6B1818",bg:"#FFF0F0"},
          {code:"AE",label:"Ambria Exotica",    secs:AE_SECS,color:"#854F0B",bg:"#FEF6E2"},
          {code:"AM",label:"Manaktala Farm",    secs:[],      color:"#B05A10",bg:"#FEF3E8"},
          {code:"AR",label:"Ambria Restro",     secs:[],      color:"#0F6E56",bg:"#E6F4F0"},
        ];
        const todayAtts = attendance.filter(a=>a.date===TODAY);
        const todayEvents = events.filter(ev=>ev.date===TODAY);
        return (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>🏢 Staff at each property today</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {PROPS.map(prop=>{
                const onRoll = STAFF_LIST.filter(s=>prop.secs.includes(s.section)).length;
                const present = todayAtts.filter(a=>{
                  const sl=STAFF_LIST.find(x=>x.id===a.staffId||x.name===a.staffName);
                  return a.status==="Present"&&sl&&prop.secs.includes(sl.section);
                }).length;
                // Outside chefs at this property today
                const eventsHere = todayEvents.filter(ev=>ev.venue&&ev.venue.includes((prop.label||"").split(" ")[0])||ev.venue===prop.label);
                const outsideHere = ([]).filter(oc=>oc.date===TODAY&&eventsHere.some(ev=>ev.id===oc.eventId)).length;
                const total = present + outsideHere;
                return (
                  <div key={prop.code} style={{background:prop.bg,borderRadius:10,padding:"10px 13px",border:`1px solid ${prop.color}30`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                      <span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:10,background:"rgba(0,0,0,.08)",color:prop.color}}>{prop.code}</span>
                      <span style={{fontSize:18,fontWeight:700,color:prop.color}}>{total}</span>
                    </div>
                    <div style={{fontSize:10,fontWeight:600,color:prop.color,marginBottom:2}}>{(prop.label||"").split(" ").slice(1).join(" ")||prop.label}</div>
                    <div style={{fontSize:10,color:prop.color,opacity:.8}}>{present} on-roll present</div>
                    {outsideHere>0&&<div style={{fontSize:10,color:prop.color,opacity:.8}}>+{outsideHere} outside chefs</div>}
                    {onRoll>0&&<div style={{marginTop:5,height:3,background:"rgba(0,0,0,.08)",borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.round(present/onRoll*100)}%`,background:prop.color,borderRadius:2}}/>
                    </div>}
                  </div>
                );
              })}
            </div>
          </div>
      );
      })()}

      {/* ── STAFF STATUS ── */}
      <Card style={{marginBottom:14,padding:"14px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text}}>👥 Staff today — {TODAY_LABEL}</div>
          <Btn onClick={()=>setScreen("team")} color={C.bg} textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:11,padding:"4px 10px"}}>Manage →</Btn>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {/* Present */}
          <div style={{flex:"1 0 100px",background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"10px 13px",cursor:"pointer"}} onClick={()=>setScreen("team")}>
            <div style={{fontSize:20,fontWeight:700,color:C.green}}>{present.length}</div>
            <div style={{fontSize:10,color:C.green,fontWeight:600,marginBottom:4}}>Present</div>
            {present.slice(0,4).map((a,i)=><div key={i} style={{fontSize:10,color:C.green,display:"flex",alignItems:"center",gap:3}}><div style={{width:4,height:4,borderRadius:"50%",background:C.green}}/>{a.staffName}</div>)}
            {present.length>4&&<div style={{fontSize:9,color:C.green,marginTop:2}}>+{present.length-4} more</div>}
          </div>
          {/* Absent */}
          <div style={{flex:"1 0 100px",background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:10,padding:"10px 13px",cursor:"pointer"}} onClick={()=>setScreen("team")}>
            <div style={{fontSize:20,fontWeight:700,color:C.red}}>{absent.length}</div>
            <div style={{fontSize:10,color:C.red,fontWeight:600,marginBottom:4}}>Absent</div>
            {absent.length===0?<div style={{fontSize:10,color:C.red,opacity:.7}}>All present ✓</div>
              :absent.map((a,i)=><div key={i} style={{fontSize:10,color:C.red,display:"flex",alignItems:"center",gap:3}}><div style={{width:4,height:4,borderRadius:"50%",background:C.red}}/>{a.staffName}</div>)}
          </div>
          {/* On Leave */}
          <div style={{flex:"1 0 100px",background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,padding:"10px 13px",cursor:"pointer"}} onClick={()=>setScreen("team")}>
            <div style={{fontSize:20,fontWeight:700,color:C.amber}}>{onLeave.length}</div>
            <div style={{fontSize:10,color:C.amber,fontWeight:600,marginBottom:4}}>On Leave</div>
            {onLeave.length===0?<div style={{fontSize:10,color:C.amber,opacity:.7}}>No leaves today</div>
              :onLeave.map((l,i)=><div key={i} style={{fontSize:10,color:C.amber,display:"flex",alignItems:"center",gap:3}}><div style={{width:4,height:4,borderRadius:"50%",background:C.amber}}/>{l.staffName}</div>)}
          </div>
          {/* Pending leaves */}
          {pendingLv.length>0&&(
            <div style={{flex:"1 0 100px",background:C.wineBg,border:`1px solid ${C.wineBorder}`,borderRadius:10,padding:"10px 13px",cursor:"pointer"}} onClick={()=>setScreen("team")}>
              <div style={{fontSize:20,fontWeight:700,color:C.wine}}>{pendingLv.length}</div>
              <div style={{fontSize:10,color:C.wine,fontWeight:600,marginBottom:4}}>Pending leave</div>
              {pendingLv.map((l,i)=><div key={i} style={{fontSize:10,color:C.wine,display:"flex",alignItems:"center",gap:3}}><div style={{width:4,height:4,borderRadius:"50%",background:C.wine}}/>{l.staffName}</div>)}
            </div>
          )}
          {/* Grooming alerts */}
          {gIssues.length>0&&(
            <div style={{flex:"1 0 100px",background:"#FFF4F4",border:`1px solid ${C.redBorder}`,borderRadius:10,padding:"10px 13px",cursor:"pointer"}} onClick={()=>setScreen("team")}>
              <div style={{fontSize:20,fontWeight:700,color:C.red}}>{gIssues.length}</div>
              <div style={{fontSize:10,color:C.red,fontWeight:600,marginBottom:4}}>Grooming ⚠</div>
              {gIssues.map((a,i)=><div key={i} style={{fontSize:10,color:C.red,display:"flex",alignItems:"center",gap:3}}><div style={{width:4,height:4,borderRadius:"50%",background:C.red}}/>{a.staffName}</div>)}
            </div>
          )}
        </div>
        {/* Section donuts */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6,marginTop:12}}>
          {SECTIONS.map(s=>{
            const m=SECTION_META[s];
            const total=STAFF_LIST.filter(x=>x.section===s).length;
            const pres=todayAtt.filter(a=>a.status==="Present"&&STAFF_LIST.find(x=>x.id===a.staffId)?.section===s).length;
            const pct=total>0?Math.round(pres/total*100):0;
            return (
              <div key={s} style={{textAlign:"center",background:C.bg,borderRadius:9,padding:"8px 4px",cursor:"pointer"}} onClick={()=>setScreen("team")}>
                <DonutChart pct={pct} color={m.color} icon={m.icon} size={56}/>
                <div style={{fontSize:9,fontWeight:600,color:C.text,marginTop:4}}>{s.split(" ")[0]}</div>
                <div style={{fontSize:9,color:C.muted}}>{pres}/{total}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}





// ─── TEAM, ATTENDANCE & DIRECTORY ────────────────────────────────

// ─── KIOSK ATTENDANCE ─────────────────────────────────────────────
function KioskAttendance({ staffList, attendance, setAttendance, onClose, lang="en" }) {
  const T2 = s => T(s, lang);
  const [phase, setPhase]     = useState("select");   // select | photo | sign | done
  const [query, setQuery]     = useState("");
  const [picked, setPicked]   = useState(null);       // staff object
  const [photo,  setPhoto]    = useState(null);       // base64
  const [sig,    setSig]      = useState(null);       // base64 from canvas
  const [time,   setTime]     = useState(new Date());
  const [alreadyIn, setAlreadyIn] = useState(false);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const sigRef    = useRef(null);
  const sigCtxRef = useRef(null);
  const drawing   = useRef(false);
  const streamRef = useRef(null);

  // Clock tick
  useEffect(()=>{
    const t = setInterval(()=>setTime(new Date()), 1000);
    return()=>clearInterval(t);
  },[]);

  // Camera
  useEffect(()=>{
    if(phase==="photo"){
      navigator.mediaDevices?.getUserMedia({video:{facingMode:{ideal:"user"},width:{ideal:640},height:{ideal:480}},audio:false})
        .then(stream=>{
          streamRef.current=stream;
          if(videoRef.current) videoRef.current.srcObject=stream;
        }).catch(()=>{});
    }
    return()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); };
  },[phase]);

  // Signature canvas setup
  useEffect(()=>{
    if(phase==="sign"&&sigRef.current){
      const canvas = sigRef.current;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext("2d");
      ctx.strokeStyle="#1A1A1A";
      ctx.lineWidth=2.5;
      ctx.lineCap="round";
      ctx.lineJoin="round";
      sigCtxRef.current=ctx;
    }
  },[phase]);

  function snap(){
    const v=videoRef.current, c=canvasRef.current;
    if(!v||!c)return;
    c.width=v.videoWidth||320; c.height=v.videoHeight||240;
    c.getContext("2d").drawImage(v,0,0);
    setPhoto(c.toDataURL("image/jpeg",0.7));
    streamRef.current?.getTracks().forEach(t=>t.stop());
    setPhase("sign");
  }

  function sigDown(e){
    drawing.current=true;
    const r=sigRef.current.getBoundingClientRect();
    const pt=e.touches?e.touches[0]:e;
    sigCtxRef.current?.beginPath();
    sigCtxRef.current?.moveTo(pt.clientX-r.left,pt.clientY-r.top);
  }
  function sigMove(e){
    if(!drawing.current)return;
    e.preventDefault();
    const r=sigRef.current.getBoundingClientRect();
    const pt=e.touches?e.touches[0]:e;
    sigCtxRef.current?.lineTo(pt.clientX-r.left,pt.clientY-r.top);
    sigCtxRef.current?.stroke();
  }
  function sigUp(){ drawing.current=false; }
  function clearSig(){
    const c=sigRef.current;
    sigCtxRef.current?.clearRect(0,0,c.width,c.height);
    setSig(null);
  }
  function saveSig(){
    const c=sigRef.current;
    const blank=document.createElement("canvas");
    blank.width=c.width; blank.height=c.height;
    if(c.toDataURL()===blank.toDataURL()){setSig(null);return;}
    setSig(c.toDataURL("image/png",0.5));
  }

  function selectStaff(s){
    const already = attendance.some(a=>a.staffId===String(s.id)&&a.date===TODAY&&a.status==="Present");
    setPicked(s);
    setAlreadyIn(already);
    setPhase("photo");
    setQuery("");
  }

  function submit(){
    if(alreadyIn){ setPhase("done"); return; }
    const now=new Date();
    const timeStr=now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
    setAttendance(p=>[...p.filter(a=>!(a.staffId===String(picked.id)&&a.date===TODAY)),{
      staffId:    String(picked.id),
      staffName:  picked.name,
      staffSection:picked.section,
      date:       TODAY,
      time:       timeStr,
      status:     "Present",
      photo:      photo||null,
      signature:  sig||null,
      groomingFailed: false,
    }]);
    setPhase("done");
  }

  const filtered = (staffList||[]).filter(s=>{
    if(!query.trim()) return true;
    return s.name.toLowerCase().includes(query.toLowerCase()) ||
           s.section.toLowerCase().includes(query.toLowerCase());
  });

  // Group by section
  const bySection = SECTIONS.reduce((acc,sec)=>{
    const list=filtered.filter(s=>s.section===sec);
    if(list.length) acc[sec]=list;
    return acc;
  },{});

  const timeStr = time.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const dateStr = time.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  const SECTION_COLORS = {
    "Café":"#1B5EAB","Indian Curries":"#C07010","Tandoor":"#C84040",
    "Chinese":"#6040A8","Chaat":"#2B8A50","Sweets":"#A84060"
  };

  return (
    <div style={{position:"fixed",inset:0,background:C.navy,zIndex:2000,display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* ── TOP BAR ── */}
      <div style={{background:"rgba(255,255,255,.05)",borderBottom:"1px solid rgba(255,255,255,.1)",padding:"14px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:C.wine,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:700,color:"#fff"}}>A</div>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:"#fff",fontFamily:"Georgia,serif"}}>Ambria Cuisines · Kitchen Attendance</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.55)",marginTop:1}}>{dateStr}</div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:28,fontWeight:700,color:"#fff",fontVariantNumeric:"tabular-nums",letterSpacing:1}}>{timeStr}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:1}}>
            {attendance.filter(a=>a.date===TODAY&&a.status==="Present").length} staff checked in today
          </div>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:8,color:"rgba(255,255,255,.7)",fontSize:12,padding:"6px 14px",cursor:"pointer"}}>
          ← Exit Kiosk
        </button>
      </div>

      {/* ── PHASE: SELECT ── */}
      {phase==="select"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",padding:"24px 32px"}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:28,fontWeight:700,color:"#fff",fontFamily:"Georgia,serif",marginBottom:6}}>{T("Welcome! Tap your name to check in",lang)||"Welcome! Tap your name to check in"}</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)"}}>Your time and photo will be recorded automatically</div>
          </div>

          {/* Search */}
          <div style={{position:"relative",marginBottom:20,maxWidth:480,margin:"0 auto 20px"}}>
            <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"rgba(255,255,255,.4)"}}>🔍</span>
            <input
              value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="Search your name…"
              style={{width:"100%",padding:"12px 14px 12px 40px",borderRadius:12,border:"1.5px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.08)",color:"#fff",fontSize:15,outline:"none",boxSizing:"border-box"}}
            />
          </div>

          {/* Staff grid by section */}
          <div style={{flex:1,overflowY:"auto"}}>
            {Object.entries(bySection).map(([sec,list])=>(
              <div key={sec} style={{marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{height:2,flex:1,background:"rgba(255,255,255,.08)"}}/>
                  <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:".1em",textTransform:"uppercase"}}>{sec}</span>
                  <div style={{height:2,flex:1,background:"rgba(255,255,255,.08)"}}/>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {list.map(s=>{
                    const alr=attendance.some(a=>a.staffId===String(s.id)&&a.date===TODAY&&a.status==="Present");
                    const col=SECTION_COLORS[s.section]||C.wine;
                    return (
                      <button key={s.id} onClick={()=>selectStaff(s)}
                        style={{padding:"10px 18px",borderRadius:12,cursor:"pointer",border:"none",
                          background:alr?"rgba(43,138,80,.25)":"rgba(255,255,255,.07)",
                          color:alr?"#5DD98A":"#fff",
                          outline:`2px solid ${alr?"rgba(43,138,80,.5)":col+"40"}`,
                          fontSize:14,fontWeight:500,
                          display:"flex",alignItems:"center",gap:8,transition:"all .15s"}}>
                        {alr&&<span style={{fontSize:14}}>✓</span>}
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {filtered.length===0&&(
              <div style={{textAlign:"center",padding:60,color:"rgba(255,255,255,.3)",fontSize:15}}>No staff found matching "{query}"</div>
            )}
          </div>
        </div>
      )}

      {/* ── PHASE: PHOTO ── */}
      {phase==="photo"&&picked&&(
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20,padding:24}}>
          {alreadyIn?(
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:60,marginBottom:16}}>✅</div>
              <div style={{fontSize:28,fontWeight:700,color:"#fff",fontFamily:"Georgia,serif",marginBottom:8}}>{T2("Already checked in!")}</div>
              <div style={{fontSize:16,color:"rgba(255,255,255,.6)",marginBottom:28}}>{picked.name} is already marked present today.</div>
              <button onClick={()=>{setPhase("select");setPicked(null);}} style={{padding:"12px 32px",borderRadius:12,background:C.wine,color:"#fff",border:"none",fontSize:15,fontWeight:600,cursor:"pointer"}}>← Back</button>
            </div>
          ):(
            <>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:24,fontWeight:700,color:"#fff",fontFamily:"Georgia,serif",marginBottom:4}}>Hi {picked.name}! 👋</div>
                <div style={{fontSize:14,color:"rgba(255,255,255,.5)"}}>{picked.section} · Check-in time: {timeStr}</div>
              </div>

              {/* Camera */}
              <div style={{position:"relative",borderRadius:16,overflow:"hidden",border:"3px solid rgba(255,255,255,.2)",background:"#000"}}>
                <video ref={videoRef} autoPlay playsInline muted style={{width:400,height:300,display:"block",objectFit:"cover"}}/>
                <canvas ref={canvasRef} style={{display:"none"}}/>
                {/* Overlay guide */}
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                  <div style={{width:140,height:180,border:"2px dashed rgba(255,255,255,.3)",borderRadius:"50% 50% 50% 50% / 40% 40% 60% 60%"}}/>
                </div>
              </div>

              <div style={{display:"flex",gap:12}}>
                <button onClick={()=>{setPhase("select");setPicked(null);streamRef.current?.getTracks().forEach(t=>t.stop());}}
                  style={{padding:"11px 24px",borderRadius:12,background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.2)",fontSize:14,cursor:"pointer"}}>
                  ← Back
                </button>
                <button onClick={snap}
                  style={{padding:"11px 32px",borderRadius:12,background:C.wine,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                  📸 Capture Photo
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PHASE: SIGN ── */}
      {phase==="sign"&&picked&&(
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,padding:24}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:700,color:"#fff",fontFamily:"Georgia,serif",marginBottom:4}}>Now sign below to confirm</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.5)"}}>{picked.name} · {picked.section} · {timeStr}</div>
          </div>

          <div style={{display:"flex",gap:24,alignItems:"flex-start"}}>
            {/* Photo preview */}
            {photo&&<div style={{flexShrink:0}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)",textAlign:"center",marginBottom:6}}>YOUR PHOTO</div>
              <img src={photo} style={{width:120,height:90,borderRadius:10,objectFit:"cover",border:"2px solid rgba(255,255,255,.2)"}}/>
            </div>}

            {/* Signature pad */}
            <div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginBottom:6}}>SIGN HERE</div>
              <div style={{background:"#fff",borderRadius:12,overflow:"hidden",border:"2px solid rgba(255,255,255,.3)",cursor:"crosshair"}}>
                <canvas ref={sigRef}
                  style={{width:380,height:140,display:"block",touchAction:"none"}}
                  onMouseDown={sigDown} onMouseMove={sigMove} onMouseUp={sigUp} onMouseLeave={sigUp}
                  onTouchStart={sigDown} onTouchMove={sigMove} onTouchEnd={sigUp}
                />
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                <button onClick={clearSig} style={{fontSize:11,color:"rgba(255,255,255,.4)",background:"none",border:"none",cursor:"pointer"}}>↺ Clear</button>
                <div style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>Draw your signature above</div>
              </div>
            </div>
          </div>

          <div style={{display:"flex",gap:12}}>
            <button onClick={()=>{setPhase("photo");setSig(null);}}
              style={{padding:"11px 24px",borderRadius:12,background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.2)",fontSize:14,cursor:"pointer"}}>
              ← Retake Photo
            </button>
            <button onClick={()=>{saveSig();submit();}}
              style={{padding:"11px 36px",borderRadius:12,background:C.green,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer"}}>
              ✓ Confirm Check-In
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: DONE ── */}
      {phase==="done"&&picked&&(
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
          <div style={{fontSize:80,animation:"pulse 1s ease"}}>✅</div>
          <div style={{fontSize:32,fontWeight:700,color:"#fff",fontFamily:"Georgia,serif"}}>{T2("Check-in successful!")}</div>
          <div style={{fontSize:18,color:"rgba(255,255,255,.7)"}}>{picked.name} · {picked.section}</div>
          <div style={{fontSize:15,color:"rgba(255,255,255,.5)"}}>Time recorded: {timeStr}</div>
          <div style={{marginTop:12,background:"rgba(255,255,255,.07)",borderRadius:14,padding:"14px 24px",display:"flex",gap:16,alignItems:"center"}}>
            {photo&&<img src={photo} style={{width:60,height:45,borderRadius:8,objectFit:"cover"}}/>}
            <div>
              <div style={{color:"rgba(255,255,255,.9)",fontSize:13,fontWeight:600}}>Attendance recorded</div>
              <div style={{color:"rgba(255,255,255,.4)",fontSize:11,marginTop:2}}>Photo + Signature saved</div>
            </div>
          </div>
          {/* Auto-reset after 3 seconds */}
          <AutoReset delay={3000} onReset={()=>{setPhase("select");setPicked(null);setPhoto(null);setSig(null);setAlreadyIn(false);}}/>
        </div>
      )}
    </div>
  );
}

function AutoReset({delay, onReset}){
  const [count,setCount] = useState(Math.round(delay/1000));
  useEffect(()=>{
    const t = setInterval(()=>setCount(c=>{ if(c<=1){clearInterval(t);onReset();return 0;} return c-1; }),1000);
    return()=>clearInterval(t);
  },[]);
  return <div style={{fontSize:13,color:"rgba(255,255,255,.3)",marginTop:4}}>Returning in {count}s…</div>;
}

function TeamHub({attendance,setAttendance,leaves,setLeaves,empDb,setEmpDb,events,lang="en"}) {
  const [tab,setTab]             = useState("attendance");
  const T2 = s => T(s, lang);
  const [kioskMode,setKioskMode] = useState(false);
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
  const [selEmp,setSelEmp]       = useState(null);
  const [editEmpForm,setEditEmpForm] = useState(null);
  const [deleteConfirm,setDeleteConfirm] = useState(null);
  const [newEmpForm,setNewEmpForm] = useState({name:"",section:"Beverages",dept:"F&B Kitchen",role:"staff",pin:"0000",joining:TODAY,active:true});

  // Computed
  const todayRecs  = (attendance||[]).filter(a=>a.date===TODAY);
  const pending    = (leaves||[]).filter(l=>l.status==="Pending");
  const approved   = (leaves||[]).filter(l=>l.status==="Approved");
  const rejected   = (leaves||[]).filter(l=>l.status==="Rejected");
  const allSecs    = ["All","Management",...SECTIONS];
  const filtered   = secFilter==="All" ? STAFF_LIST : STAFF_LIST.filter(s=>s.section===secFilter);
  const present    = todayRecs.filter(a=>a.status==="Present").length;
  const dirFiltered = (empDb||[]).filter(e=>{
    const ms = dirFilter==="All"||e.section===dirFilter||e.role===dirFilter;
    const mt = !dirSearch.trim()||e.name.toLowerCase().includes(dirSearch.toLowerCase())||e.id.toLowerCase().includes(dirSearch.toLowerCase());
    return ms&&mt;
  });

  // Coverage alerts for approved leaves
  const coverageAlerts = approved.reduce((out,l)=>{
    if(!l.staffSection||out.some(x=>x.section===l.staffSection)) return out;
    const total = STAFF_LIST.filter(s=>s.section===l.staffSection).length;
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
    const s = STAFF_LIST.find(x=>x.id===+leaveForm.staffId);
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
    setNewEmpForm({name:"",section:"Beverages",dept:"F&B Kitchen",role:"staff",pin:"0000",joining:TODAY,active:true});
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
      {/* Kiosk overlay */}
      {kioskMode && (
        <KioskAttendance staffList={STAFF_LIST} attendance={attendance} setAttendance={setAttendance} onClose={()=>setKioskMode(false)}/>
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>👥 Team</div>
          <div style={{fontSize:13,color:C.muted,marginTop:3}}>{TODAY_LABEL} · {present}/{STAFF_LIST.length} present</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{background:C.greenBg,borderRadius:9,padding:"8px 14px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:C.green}}>{present}</div>
            <div style={{fontSize:9,color:C.green}}>Present</div>
          </div>
          <div style={{background:C.redBg,borderRadius:9,padding:"8px 14px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:C.red}}>{todayRecs.filter(a=>a.status==="Absent").length}</div>
            <div style={{fontSize:9,color:C.red}}>Absent</div>
          </div>
          <div style={{background:C.wineBg,borderRadius:9,padding:"8px 14px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:C.wine}}>{pending.length}</div>
            <div style={{fontSize:9,color:C.wine}}>Pending</div>
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
                    <div style={{fontSize:10,color:C.muted}}>★ {v.rating} · {v.specialty}</div>
                  </div>
                </div>
                <button onClick={()=>setTab("chefs")} style={{width:"100%",padding:"4px",borderRadius:6,fontSize:11,fontWeight:500,cursor:"pointer",background:C.wine,color:"#fff",border:"none"}}>Book via Vendor Tab →</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Tab bar */}
      <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:`1px solid ${C.border}`,paddingBottom:10,overflowX:"auto"}}>
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
          {/* Kiosk launch banner */}
          <div style={{background:`linear-gradient(135deg,${C.wine} 0%,#2d0707 100%)`,borderRadius:14,padding:"18px 22px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#fff",fontFamily:"Georgia,serif",marginBottom:3}}>🖥 Kitchen Gate Kiosk</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.65)",lineHeight:1.5}}>Staff tap their name → photo → sign → attendance recorded.<br/>Launch on the screen at the kitchen entrance.</div>
            </div>
            <button onClick={()=>setKioskMode(true)} style={{padding:"12px 28px",borderRadius:12,background:"#fff",color:C.wine,border:"none",fontSize:14,fontWeight:700,cursor:"pointer",flexShrink:0,marginLeft:20}}>Launch Kiosk →</button>
          </div>

          {/* Section filter */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
            {allSecs.map(s=>(
              <button key={s} onClick={()=>setSecFilter(s)} style={{padding:"4px 11px",borderRadius:20,fontSize:11,cursor:"pointer",background:secFilter===s?C.wine:"transparent",color:secFilter===s?"#fff":C.muted,border:`1px solid ${secFilter===s?C.wine:C.border}`}}>{s}</button>
            ))}
          </div>

          {/* Staff grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
            {filtered.map((s,i)=>{
              const rec = todayRecs.find(r=>r.staffId===String(s.id));
              const present2 = rec?.status==="Present";
              const m = SECTION_META[s.section]||{color:C.muted};
              return (
                <div key={s.id} style={{background:present2?C.greenBg:C.surface,border:`1px solid ${present2?C.greenBorder:C.border}`,borderRadius:10,padding:"11px 12px"}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                    {rec?.photo
                      ? <img src={rec.photo} style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",border:`2px solid ${present2?C.green:C.border}`}}/>
                      : <Avatar name={s.name} size={32} index={i}/>
                    }
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                      <div style={{fontSize:9,color:m.color,fontWeight:500}}>{s.section}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:present2?C.green:C.bg,color:present2?"#fff":C.muted}}>
                      {present2 ? "✓ "+rec.time : "Not in"}
                    </span>
                    {rec?.signature && <span style={{fontSize:9,color:C.muted}}>✍</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LEAVES ── */}
      {tab==="leaves" && (
        <div>
          {/* Apply leave form */}
          <Card style={{marginBottom:14,padding:"14px 16px"}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>Apply Leave</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>
              <div>
                <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Staff</div>
                <select value={leaveForm.staffId} onChange={e=>setLeaveForm(p=>({...p,staffId:e.target.value}))} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>
                  <option value="">Select staff…</option>
                  {STAFF_LIST.map(s=><option key={s.id} value={s.id}>{s.name} ({s.section})</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,color:C.muted,marginBottom:3}}>From</div>
                <input type="date" value={leaveForm.from} onChange={e=>setLeaveForm(p=>({...p,from:e.target.value}))} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:C.muted,marginBottom:3}}>To</div>
                <input type="date" value={leaveForm.to} onChange={e=>setLeaveForm(p=>({...p,to:e.target.value}))} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Reason</div>
                <input value={leaveForm.reason} onChange={e=>setLeaveForm(p=>({...p,reason:e.target.value}))} placeholder="Reason" style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
              </div>
            </div>
            <Btn onClick={addLeave} color={C.wine} style={{fontSize:12,padding:"6px 16px"}}>Apply Leave</Btn>
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
            const idx = STAFF_LIST.findIndex(s=>s.id===l.staffId||s.name===l.staffName);
            return (
              <div key={l.id} style={{padding:"10px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                <div style={{display:"flex",gap:9,alignItems:"flex-start"}}>
                  <Avatar name={l.staffName||"?"} size={32} index={idx>=0?idx:i}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.text}}>{l.staffName}</div>
                    <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
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
                            <Btn onClick={()=>approveLeave(l.id)} color={C.green} style={{fontSize:10,padding:"3px 10px"}}>✓ Approve</Btn>
                            <Btn onClick={()=>setRejectId(l.id)} color={C.red} style={{fontSize:10,padding:"3px 10px"}}>✕ Reject</Btn>
                          </>
                        )}
                        {leaveTab==="rejected"&&l.rejectReason&&<div style={{fontSize:10,color:C.red}}>{l.rejectReason}</div>}
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
                border:`1.5px solid ${C.wine}`,color:vendorSubTab==="portal"?"#fff":C.wine,fontWeight:600,fontSize:12}}>
              <span style={{fontSize:14}}>🏢</span>
              {vendorSubTab==="portal" ? "← Exit Vendor Portal" : "Open Vendor Portal"}
              {vendorSubTab!=="portal" && vendorOrders.filter(o=>o.status==="Pending").length > 0 &&
                <span style={{background:C.wine,color:"#fff",fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10,marginLeft:2}}>
                  {vendorOrders.filter(o=>o.status==="Pending").length}
                </span>
              }
            </button>
          </div>
          {/* Vendor Portal banner */}
          {vendorSubTab==="portal" && (
            <div style={{background:`linear-gradient(135deg,${C.wine} 0%,#2d0707 100%)`,borderRadius:12,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:24}}>🏢</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#fff",fontFamily:"Georgia,serif"}}>Vendor Portal View</div>
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
                      <div style={{width:36,height:36,borderRadius:9,background:C.wine,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff"}}>🏢</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:C.wine}}>{bookingForm.vendorName}</div>
                        <div style={{fontSize:11,color:C.wine,opacity:.7}}>Booking will be sent to this vendor</div>
                      </div>
                    </div>
                    <button onClick={()=>setBookingForm(p=>({...p,vendorId:"",vendorName:""}))} style={{fontSize:11,color:C.wine,background:"none",border:`1px solid ${C.wineBorder}`,borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>Change ×</button>
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
                        <div key={sec} style={{display:"grid",gridTemplateColumns:"1fr 110px 1fr",padding:"10px 14px",borderBottom:`1px solid ${C.borderLight}`,alignItems:"center"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:14}}>{m.icon}</span>
                            <span style={{fontSize:12,fontWeight:500,color:C.text}}>{sec}</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
                            <button onClick={()=>setQty(qty-1)} style={{width:22,height:22,borderRadius:5,background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                            <span style={{fontSize:14,fontWeight:600,color:qty>0?C.wine:C.muted,minWidth:18,textAlign:"center"}}>{qty}</span>
                            <button onClick={()=>setQty(qty+1)} style={{width:22,height:22,borderRadius:5,background:qty>0?C.wineBg:C.bg,border:`1px solid ${qty>0?C.wineBorder:C.border}`,color:qty>0?C.wine:C.text,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                          </div>
                          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Special requirements…" style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg,width:"100%",boxSizing:"border-box"}}/>
                        </div>
                      );
                    })}
                    <div style={{padding:"8px 14px",background:C.bg,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:12,color:C.muted}}>Total staff requested</span>
                      <span style={{fontSize:14,fontWeight:700,color:C.wine}}>{Object.values(bookingForm.staffReqs||{}).reduce((a,r)=>a+(r.qty||0),0)} people</span>
                    </div>
                  </div>

                  {/* Notes + send */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Additional Notes for Vendor</div>
                    <textarea value={bookingForm.notes||""} onChange={e=>setBookingForm(p=>({...p,notes:e.target.value}))} placeholder="Dress code, reporting point, special instructions…" style={{width:"100%",padding:"9px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,resize:"none",height:60,fontFamily:"inherit",boxSizing:"border-box"}}/>
                  </div>
                  <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                    <Btn onClick={()=>setBookingForm({vendorId:"",vendorName:"",eventId:"",eventName:"",venue:"",date:"",time:"",endTime:"",pax:"",staffReqs:{},notes:""})} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Clear</Btn>
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
                            {order.eventName&&<div style={{fontSize:11,color:C.wine,marginTop:1}}>📋 {order.eventName}</div>}
                          </div>
                          <span style={{fontSize:11,fontWeight:700,padding:"4px 11px",borderRadius:20,background:sbg,color:scol}}>{order.status}</span>
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:order.vendorNote?8:0}}>
                          {Object.entries(order.staffReqs||{}).filter(([,r])=>r.qty>0).map(([sec,r])=>{
                            const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                            return <div key={sec} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,background:m.color+"15",border:"1px solid "+m.color+"30"}}><span style={{fontSize:11}}>{m.icon}</span><span style={{fontSize:11,fontWeight:600,color:m.color}}>{r.qty}× {sec}</span></div>;
                          })}
                          <div style={{padding:"3px 10px",borderRadius:20,background:C.bg,border:`1px solid ${C.border}`}}><span style={{fontSize:11,color:C.muted}}>{totalReq} total</span></div>
                        </div>
                        {order.vendorNote&&<div style={{background:C.amberBg,borderRadius:8,padding:"7px 11px",fontSize:11,color:C.amber,marginBottom:8}}>💬 {order.vendorNote}</div>}
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
                                  {r.qty!==orig&&<span style={{fontSize:9,color:C.amber}}>(was {orig})</span>}
                                </div>;
                              })}
                            </div>
                            <div style={{display:"flex",gap:6,marginTop:8}}>
                              <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Confirmed",staffReqs:{...(o.staffReqs||{}),...Object.fromEntries(Object.entries(o.editedReqs||{}).map(([k,v])=>[k,{...(o.staffReqs?.[k]||{}),qty:v.qty}]))},confirmedStaff:o.confirmedStaff||[]}))}
                                style={{padding:"5px 14px",borderRadius:7,background:C.green,color:"#fff",border:"none",fontSize:11,fontWeight:600,cursor:"pointer"}}>✓ Accept Revised</button>
                              <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Rejected"}))}
                                style={{padding:"5px 12px",borderRadius:7,background:C.redBg,color:C.red,border:`1px solid ${C.redBorder}`,fontSize:11,cursor:"pointer"}}>✕ Reject</button>
                            </div>
                          </div>
                        )}
                        {order.status==="Confirmed"&&(order.confirmedStaff||[]).length>0&&(
                          <div style={{marginTop:10,borderTop:`1px solid ${C.borderLight}`,paddingTop:10}}>
                            <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:8}}>Staff sent by vendor</div>
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
                                  : <input type="time" onChange={e=>{if(e.target.value){setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:o.confirmedStaff.map((st,i)=>i!==si?st:{...st,checkIn:e.target.value})}));}}} style={{padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}/>
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
              <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:11,color:C.amber,lineHeight:1.6}}>
                ℹ <strong>Vendor Portal</strong> — this is the view vendors use to accept/reject/edit booking orders placed by kitchen management.
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
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"10px 14px",background:C.wineBg,borderRadius:10,border:`1px solid ${C.wineBorder}`}}>
                        <div style={{width:36,height:36,borderRadius:9,background:C.wine,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff"}}>🏢</div>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:C.wine}}>{grp.name}</div>
                          <div style={{fontSize:11,color:C.wine,opacity:.7}}>{grp.orders.length} order{grp.orders.length!==1?"s":""} · {grp.orders.filter(o=>o.status==="Pending").length} pending</div>
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
                                  <span style={{fontSize:11,color:C.muted,padding:"3px 8px",background:C.bg,borderRadius:20,border:`1px solid ${C.border}`}}>{totalReq} total</span>
                                </div>
                                {order.notes&&<div style={{fontSize:11,color:C.muted,marginTop:5}}>📝 {order.notes}</div>}
                              </div>
                              <span style={{fontSize:11,fontWeight:700,padding:"4px 11px",borderRadius:20,background:sbg,color:scol}}>{order.status}</span>
                            </div>
                            <textarea value={order.vendorNote||""} onChange={e=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,vendorNote:e.target.value}))} placeholder="Add note for kitchen (e.g. sending 2 instead of 3 for Tandoor, different timing)…" style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,resize:"none",height:50,fontFamily:"inherit",boxSizing:"border-box",marginBottom:10}}/>
                            {order.status==="Confirmed" && (
                              <div style={{marginBottom:10}}>
                                <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:6}}>Staff being sent</div>
                                {(order.confirmedStaff||[]).map((st,si)=>(
                                  <div key={si} style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
                                    <input value={st.name||""} onChange={e=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:o.confirmedStaff.map((s2,i)=>i!==si?s2:{...s2,name:e.target.value})}))} placeholder="Chef name" style={{flex:1,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg}}/>
                                    <select value={st.section||""} onChange={e=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:o.confirmedStaff.map((s2,i)=>i!==si?s2:{...s2,section:e.target.value})}))} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg}}>
                                      <option value="">Section</option>
                                      {SECTIONS.map(s=><option key={s}>{s}</option>)}
                                    </select>
                                    <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:o.confirmedStaff.filter((_,i)=>i!==si)}))} style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:5,color:C.red,fontSize:11,padding:"4px 7px",cursor:"pointer"}}>×</button>
                                  </div>
                                ))}
                                <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:[...(o.confirmedStaff||[]),{name:"",section:""}]}))} style={{padding:"5px 12px",borderRadius:6,background:"none",border:`1px dashed ${C.border}`,fontSize:11,color:C.muted,cursor:"pointer"}}>+ Add staff member</button>
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
                                            <div style={{fontSize:10,color:C.muted}}>Kitchen asked: {orig}</div>
                                          </div>
                                        </div>
                                        <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
                                          <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,editedReqs:{...(o.editedReqs||{}),[sec]:{qty:Math.max(0,(o.editedReqs?.[sec]?.qty!==undefined?o.editedReqs[sec].qty:orig)-1)}}}))}                                            style={{width:22,height:22,borderRadius:5,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:14,cursor:"pointer",fontWeight:700}}>−</button>
                                          <span style={{fontSize:14,fontWeight:700,color:edited!==orig?C.amber:C.text,minWidth:20,textAlign:"center"}}>{edited}</span>
                                          <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,editedReqs:{...(o.editedReqs||{}),[sec]:{qty:(o.editedReqs?.[sec]?.qty!==undefined?o.editedReqs[sec].qty:orig)+1}}}))}
                                            style={{width:22,height:22,borderRadius:5,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:14,cursor:"pointer",fontWeight:700}}>+</button>
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
                                  }} style={{padding:"7px 16px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",background:C.amber,color:"#fff",border:"none"}}>
                                    📤 Send Revised Proposal
                                  </button>
                                </div>
                              </div>
                            )}
                            <div style={{display:"flex",gap:8}}>
                              <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Confirmed",confirmedStaff:o.confirmedStaff&&o.confirmedStaff.length?o.confirmedStaff:[]}))} style={{flex:1,padding:"8px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",background:order.status==="Confirmed"?C.green:C.greenBg,color:order.status==="Confirmed"?"#fff":C.green}}>✓ {order.status==="Confirmed"?"Confirmed":"Accept"}</button>
                              <button onClick={()=>setEditingOrderId(editingOrderId===order.id?null:order.id)} style={{flex:1,padding:"8px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",background:editingOrderId===order.id||order.status==="Edited"?C.amber:C.amberBg,color:editingOrderId===order.id||order.status==="Edited"?"#fff":C.amber}}>✏ {editingOrderId===order.id?"Close Edit":order.status==="Edited"?"Edited ✓":"Propose Edit"}</button>
                              <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Rejected"}))} style={{flex:1,padding:"8px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",background:order.status==="Rejected"?C.red:C.redBg,color:order.status==="Rejected"?"#fff":C.red}}>✕ {order.status==="Rejected"?"Rejected":"Reject"}</button>
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
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
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

          {/* Search + filter + add */}
          <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
            <input value={dirSearch} onChange={e=>setDirSearch(e.target.value)} placeholder="Search name or ID…" style={{flex:1,minWidth:160,padding:"7px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
            <select value={dirFilter} onChange={e=>setDirFilter(e.target.value)} style={{padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}>
              <option value="All">All Sections</option>
              {["Management",...SECTIONS].map(s=><option key={s}>{s}</option>)}
              <option value="admin">Admin</option>
              <option value="headchef">Head Chefs</option>
            </select>
            <Btn onClick={()=>setShowAddEmp(s=>!s)} color={showAddEmp?"transparent":C.wine} textColor={showAddEmp?C.muted:"#fff"} border={showAddEmp?`1px solid ${C.border}`:"none"} style={{fontSize:12,padding:"7px 14px"}}>{showAddEmp?"× Cancel":"+ Add Employee"}</Btn>
          </div>

          {showAddEmp && (
            <div style={{background:C.wineBg,border:`1px solid ${C.wineBorder}`,borderRadius:12,padding:"14px 16px",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:600,color:C.wine,marginBottom:10}}>New Employee</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:10}}>
                {[{l:"Full Name",k:"name",ph:"Full name"},{l:"Section",k:"section",type:"sel",opts:["Management","Café","Indian Curries","Tandoor","Chinese","Chaat","Sweets"]},{l:"Role",k:"role",type:"sel",opts:["staff","headchef","admin"]},{l:"PIN (4 digits)",k:"pin",max:4,ph:"0000"},{l:"Joining Date",k:"joining",dt:"date"},{l:"Dept",k:"dept",ph:"F&B Kitchen"}].map(f=>(
                  <div key={f.k}>
                    <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{f.l}</div>
                    {f.type==="sel"
                      ? <select value={newEmpForm[f.k]} onChange={e=>setNewEmpForm(p=>({...p,[f.k]:e.target.value}))} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>{f.opts.map(o=><option key={o}>{o}</option>)}</select>
                      : <input type={f.dt||"text"} value={newEmpForm[f.k]} onChange={e=>setNewEmpForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} maxLength={f.max} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                    }
                  </div>
                ))}
              </div>
              <Btn onClick={addEmployee} color={C.wine} style={{fontSize:11,padding:"6px 16px"}}>Add Employee</Btn>
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
                      <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:8}}>Edit — {emp.name}</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:8}}>
                        {[{l:"Name",k:"name"},{l:"PIN",k:"pin",max:4},{l:"Joining",k:"joining",dt:"date"}].map(f=>(
                          <div key={f.k}>
                            <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{f.l}</div>
                            <input type={f.dt||"text"} value={editEmpForm[f.k]||""} onChange={e=>setEditEmpForm(p=>({...p,[f.k]:e.target.value}))} maxLength={f.max} style={{width:"100%",padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                          </div>
                        ))}
                        <div>
                          <div style={{fontSize:9,color:C.muted,marginBottom:2}}>Role</div>
                          <select value={editEmpForm.role} onChange={e=>setEditEmpForm(p=>({...p,role:e.target.value}))} style={{width:"100%",padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>
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
                            <div style={{fontSize:10,color:C.wine,fontWeight:600}}>{emp.id}</div>
                            <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                              <STag name={emp.section}/>
                              <Chip label={emp.role==="admin"?"Admin":emp.role==="headchef"?"HC":"Staff"} color={emp.role!=="staff"?C.wine:C.muted} bg={emp.role!=="staff"?C.wineBg:"#F2F1EE"} size={9}/>
                            </div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:4,flexShrink:0}}>
                          <button onClick={()=>{setSelEmp(emp);setEditEmpForm({name:emp.name,pin:emp.pin,joining:emp.joining,role:emp.role});}} style={{padding:"3px 8px",borderRadius:6,background:C.bg,border:`1px solid ${C.border}`,fontSize:10,cursor:"pointer",color:C.text}}>Edit</button>
                          <button onClick={()=>setEmpDb(p=>p.map(e=>e.id!==emp.id?e:{...e,active:!e.active}))} style={{padding:"3px 8px",borderRadius:6,fontSize:10,cursor:"pointer",border:"none",background:emp.active?C.greenBg:C.redBg,color:emp.active?C.green:C.red}}>{emp.active?"Active":"Off"}</button>
                          <button onClick={()=>setDeleteConfirm(emp)} style={{padding:"3px 6px",borderRadius:6,fontSize:10,cursor:"pointer",border:`1px solid ${C.redBorder}`,background:C.redBg,color:C.red}}>🗑</button>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4,marginTop:8}}>
                        <div style={{background:C.bg,borderRadius:5,padding:"4px 7px"}}><div style={{fontSize:8,color:C.muted}}>JOINED</div><div style={{fontSize:10,fontWeight:500,color:C.text}}>{emp.joining}</div></div>
                        <div style={{background:C.bg,borderRadius:5,padding:"4px 7px"}}><div style={{fontSize:8,color:C.muted}}>SERVICE</div><div style={{fontSize:10,fontWeight:500,color:C.text}}>{yrsOfService(emp.joining)}</div></div>
                        <div style={{background:C.wineBg,borderRadius:5,padding:"4px 7px"}}><div style={{fontSize:8,color:C.wine}}>PIN</div><div style={{fontSize:11,fontWeight:700,color:C.wine}}>{emp.pin}</div></div>
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
function CalendarModule({ events, setEvents }) {
  const safeEvents = (Array.isArray(events) ? events : []).filter(e => e && typeof e.date === "string" && e.date.length === 10);
  const today      = new Date(); today.setHours(0,0,0,0);
  const todayStr   = today.toISOString().split("T")[0];
  const MONTHS     = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS       = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selDate,   setSelDate]   = useState(todayStr);
  const [selEvent,  setSelEvent]  = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [deleteId,  setDeleteId]  = useState(null);
  const [form, setForm] = useState({guest:"",venue:"Ambria Pushpanjali",date:"",time:"7:30 PM",type:"Wedding",pax:"",menuPackage:"",menu:"",special:""});

  const PROP = {
    "Ambria Pushpanjali":{code:"AP",c:"#6B1818",bg:"#FFF0F0"},
    "Ambria Exotica":    {code:"AE",c:"#854F0B",bg:"#FEF6E2"},
    "Manaktala Farm":    {code:"AM",c:"#B05A10",bg:"#FEF3E8"},
    "Ambria Restro":     {code:"AR",c:"#0F6E56",bg:"#E6F4F0"},
    "Outdoor Catering (ODC)":{code:"ODC",c:"#5A3FA0",bg:"#F0EDFC"},
  };
  const gp = v => PROP[v]||{code:"EV",c:C.wine,bg:C.wineBg};
  function pad(n){ return String(n).padStart(2,"0"); }

  // Calendar grid
  const firstDay   = new Date(viewYear,viewMonth,1).getDay();
  const daysInMon  = new Date(viewYear,viewMonth+1,0).getDate();
  const daysInPrev = new Date(viewYear,viewMonth,0).getDate();
  const cells = [];
  for(let i=firstDay-1;i>=0;i--) cells.push({day:daysInPrev-i,cur:false});
  for(let i=1;i<=daysInMon;i++) cells.push({day:i,cur:true});
  const rem=42-cells.length;
  for(let i=1;i<=rem;i++) cells.push({day:i,cur:false});

  function cellDate(cell){ return cell.cur?`${viewYear}-${pad(viewMonth+1)}-${pad(cell.day)}`:null; }
  function evOnDate(d){ return safeEvents.filter(e=>e.date===d); }
  function prevMonth(){ if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); }
  function nextMonth(){ if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); }

  const selDateEvs = selDate ? evOnDate(selDate) : [];
  const upcomingEvs = safeEvents.filter(e=>e.date>=todayStr).sort((a,b)=>(a.date||"").localeCompare(b.date||""));

  function genId(){
    const nums=(events||[]).map(e=>+(e.id||"").replace(/\D/g,"")).filter(Boolean);
    return `FP-${new Date().getFullYear()}-${String(Math.max(0,...nums)+1).padStart(3,"0")}`;
  }
  function openAdd(date){
    setForm({guest:"",venue:"Ambria Pushpanjali",date:date||"",time:"7:30 PM",type:"Wedding",pax:"",menuPackage:"",menu:"",special:""});
    setEditId(null); setShowForm(true);
  }
  function openEdit(ev){
    setForm({guest:ev.guest||"",venue:ev.venue||"Ambria Pushpanjali",date:ev.date||"",time:ev.time||"7:30 PM",type:ev.type||"Wedding",pax:String(ev.pax||""),menuPackage:ev.menuPackage||"",menu:(ev.menu||[]).join(", "),special:ev.special||""});
    setEditId(ev.id); setShowForm(true);
  }
  function saveForm(){
    if(!form.guest||!form.date||!form.pax) return;
    const menuItems = form.menuPackage&&MENU_PACKAGES[form.menuPackage] ? MENU_PACKAGES[form.menuPackage] : (form.menu||"").split(",").map(s=>s.trim()).filter(Boolean);
    if(editId){
      setEvents(p=>(p||[]).map(e=>e.id!==editId?e:{...e,...form,pax:+form.pax,menu:menuItems}));
    } else {
      setEvents(p=>[...(p||[]),{id:genId(),...form,pax:+form.pax,menu:menuItems}]);
    }
    setShowForm(false); setEditId(null); setSelDate(form.date);
  }
  function deleteEvent(id){
    setEvents(p=>(p||[]).filter(e=>e.id!==id));
    setDeleteId(null); setSelEvent(null);
  }

  const fld = {width:"100%",padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"};

  return (
    <div>
      {/* Delete confirm */}
      {deleteId&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.surface,borderRadius:16,padding:"28px 32px",maxWidth:360,textAlign:"center"}}>
            <div style={{fontSize:34,marginBottom:8}}>🗑</div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:5}}>Delete this function?</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:18}}>{(safeEvents.find(e=>e.id===deleteId)||{}).guest}</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <Btn onClick={()=>deleteEvent(deleteId)} color={C.red} style={{fontSize:12,padding:"8px 18px"}}>Yes, Delete</Btn>
              <Btn onClick={()=>setDeleteId(null)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:C.surface,borderRadius:16,width:"100%",maxWidth:560,maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 60px rgba(0,0,0,.2)"}}>
            <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.surface}}>
              <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>{editId?"✏️ Edit Function":"➕ Add Function"}</div>
              <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.muted}}>×</button>
            </div>
            <div style={{padding:"16px 20px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div style={{gridColumn:"1/-1"}}>
                  <div style={{fontSize:9,color:C.muted,marginBottom:3,textTransform:"uppercase",fontWeight:600}}>Guest / Function Name *</div>
                  <input value={form.guest} onChange={e=>setForm(p=>({...p,guest:e.target.value}))} placeholder="e.g. Sharma Wedding" style={fld} autoFocus/>
                </div>
                {[{l:"Venue",k:"venue",type:"sel",opts:["Ambria Pushpanjali","Manaktala Farm","Ambria Exotica","Ambria Restro","Outdoor Catering (ODC)"]},
                  {l:"Type", k:"type", type:"sel",opts:["Wedding","Reception","Corporate","Birthday","Outdoor","Other"]},
                  {l:"Date", k:"date", type:"date"},
                  {l:"Time", k:"time", ph:"7:30 PM"},
                  {l:"Pax",  k:"pax",  type:"number",ph:"500"},
                  {l:"Menu Package",k:"menuPackage",type:"sel",opts:["(Custom)",...Object.keys(MENU_PACKAGES)]},
                ].map(f=>(
                  <div key={f.k}>
                    <div style={{fontSize:9,color:C.muted,marginBottom:3,textTransform:"uppercase",fontWeight:600}}>{f.l}</div>
                    {f.type==="sel"
                      ? <select value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={fld}>{(f.opts||[]).map(o=><option key={o}>{o}</option>)}</select>
                      : <input type={f.type||"text"} value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={fld}/>
                    }
                  </div>
                ))}
                {(!form.menuPackage||form.menuPackage==="(Custom)")&&(
                  <div style={{gridColumn:"1/-1"}}>
                    <div style={{fontSize:9,color:C.muted,marginBottom:3,textTransform:"uppercase",fontWeight:600}}>Custom Menu Items (comma separated)</div>
                    <textarea value={form.menu} onChange={e=>setForm(p=>({...p,menu:e.target.value}))} placeholder="Dal Makhni, Paneer Tikka…" style={{...fld,height:52,resize:"none",fontFamily:"inherit"}}/>
                  </div>
                )}
                {form.menuPackage&&form.menuPackage!=="(Custom)"&&(
                  <div style={{gridColumn:"1/-1",background:C.wineBg,borderRadius:8,padding:"8px 12px",fontSize:11,color:C.wine}}>
                    📋 {(MENU_PACKAGES[form.menuPackage]||[]).length} dishes from <strong>{form.menuPackage}</strong>
                  </div>
                )}
                <div style={{gridColumn:"1/-1"}}>
                  <div style={{fontSize:9,color:C.muted,marginBottom:3,textTransform:"uppercase",fontWeight:600}}>Special Instructions</div>
                  <input value={form.special} onChange={e=>setForm(p=>({...p,special:e.target.value}))} placeholder="Jain food, no onion-garlic…" style={fld}/>
                </div>
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <Btn onClick={()=>{setShowForm(false);setEditId(null);}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
                <Btn onClick={saveForm} color={C.wine} style={{fontSize:12,padding:"9px 22px"}} disabled={!form.guest||!form.date||!form.pax}>
                  {editId?"Save Changes":"Add Function ✓"}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>📅 Event Calendar</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{safeEvents.length} functions · FY {today.getFullYear()}–{String(today.getFullYear()+1).slice(2)}</div>
        </div>
        <Btn onClick={()=>openAdd(selDate||todayStr)} color={C.wine} style={{fontSize:12,padding:"8px 16px"}}>+ Add Function</Btn>
      </div>

      <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
        {/* Calendar grid */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <button onClick={prevMonth} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,width:30,height:30,cursor:"pointer",fontSize:15,color:C.text}}>‹</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>{MONTHS[viewMonth]} {viewYear}</div>
              <div style={{fontSize:10,color:C.muted}}>
                {safeEvents.filter(e=>(e.date||"").startsWith(`${viewYear}-${pad(viewMonth+1)}`)).length} events · double-click to add
              </div>
            </div>
            <button onClick={nextMonth} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,width:30,height:30,cursor:"pointer",fontSize:15,color:C.text}}>›</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
            {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:9,fontWeight:700,color:C.muted,padding:"3px 0",textTransform:"uppercase"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {cells.map((cell,i)=>{
              const d     = cellDate(cell);
              const evs   = d ? evOnDate(d) : [];
              const isToday = d===todayStr;
              const isTmr   = d && d > todayStr && new Date(d+"T00:00:00").getTime()-today.getTime() < 86400001;
              const isSel   = d===selDate;
              return (
                <div key={i} onClick={()=>{if(!d)return;setSelDate(isSel?null:d);setSelEvent(null);}}
                  onDoubleClick={()=>{if(d)openAdd(d);}}
                  style={{minHeight:56,padding:"4px 5px",borderRadius:7,cursor:d?"pointer":"default",
                    background:isSel?C.wine:isToday?"#FFF0F0":isTmr?"#FEF6E2":evs.length>0?"#FFFAF5":cell.cur?C.surface:"transparent",
                    border:`1.5px solid ${isSel?C.wine:isToday?C.wineBorder:isTmr?C.amberBorder:evs.length>0?C.amberBorder:C.borderLight}`,
                    opacity:cell.cur?1:.3}}>
                  <div style={{fontSize:11,fontWeight:isToday||isSel?700:400,color:isSel?"#fff":isToday?C.wine:isTmr?C.amber:C.text,marginBottom:2}}>{cell.day}</div>
                  {evs.slice(0,2).map((ev,ei)=>{
                    const col=gp(ev.venue).c;
                    return <div key={ei} style={{fontSize:8,fontWeight:600,color:isSel?"rgba(255,255,255,.85)":col,background:isSel?"rgba(255,255,255,.15)":col+"18",borderRadius:3,padding:"1px 3px",marginBottom:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{ev.guest}</div>;
                  })}
                  {evs.length>2&&<div style={{fontSize:7,color:isSel?"rgba(255,255,255,.6)":C.muted}}>+{evs.length-2}</div>}
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:6,marginTop:10,alignItems:"center"}}>
            <button onClick={()=>{setViewYear(today.getFullYear());setViewMonth(today.getMonth());setSelDate(todayStr);}} style={{padding:"4px 12px",borderRadius:20,background:C.wineBg,border:`1px solid ${C.wineBorder}`,color:C.wine,fontSize:11,fontWeight:600,cursor:"pointer"}}>Today</button>
            <div style={{display:"flex",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:C.wine}}/><span style={{fontSize:9,color:C.muted}}>Today</span></div>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:C.amber}}/><span style={{fontSize:9,color:C.muted}}>Tomorrow</span></div>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:"#FFFAF5",border:`1px solid ${C.amberBorder}`}}/><span style={{fontSize:9,color:C.muted}}>Has event</span></div>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div style={{width:280,flexShrink:0}}>
          {selDate?(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:700,color:C.text}}>
                  {new Date(selDate+"T00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}
                  {selDate===todayStr&&<span style={{marginLeft:6,fontSize:10,padding:"1px 6px",borderRadius:8,background:C.wine,color:"#fff"}}>TODAY</span>}
                </div>
                <button onClick={()=>openAdd(selDate)} style={{padding:"4px 10px",borderRadius:7,background:C.wine,color:"#fff",border:"none",fontSize:11,fontWeight:600,cursor:"pointer"}}>+ Add</button>
              </div>
              {selDateEvs.length===0?(
                <div style={{background:C.bg,borderRadius:10,padding:"20px 14px",textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:6}}>📋</div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:8}}>No functions on this date</div>
                  <button onClick={()=>openAdd(selDate)} style={{padding:"5px 12px",borderRadius:7,background:C.wine,color:"#fff",border:"none",fontSize:11,cursor:"pointer"}}>Add Function</button>
                </div>
              ):(
                selDateEvs.map(ev=>{
                  const p=gp(ev.venue);
                  const isOpen=selEvent===ev.id;
                  return (
                    <div key={ev.id} style={{background:C.surface,border:`1.5px solid ${isOpen?p.c:C.border}`,borderRadius:10,padding:"11px 13px",marginBottom:8}}>
                      <div onClick={()=>setSelEvent(isOpen?null:ev.id)} style={{cursor:"pointer"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
                          <div style={{fontSize:13,fontWeight:700,color:C.text}}>{ev.guest}</div>
                          <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:p.bg,color:p.c}}>{p.code}</span>
                        </div>
                        <div style={{fontSize:10,color:C.muted}}>{ev.time} · {ev.pax} pax · {ev.id}</div>
                        {ev.special&&<div style={{fontSize:10,color:C.amber,marginTop:3}}>⚠ {ev.special}</div>}
                      </div>
                      {isOpen&&(
                        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.borderLight}`}}>
                          {ev.menuPackage&&<div style={{fontSize:10,color:C.wine,marginBottom:6}}>📋 {ev.menuPackage} · {(ev.menu||[]).length} dishes</div>}
                          {(ev.extras||[]).length>0&&(
                            <div style={{marginBottom:8}}>
                              {(ev.extras||[]).map((ex,i)=><div key={i} style={{fontSize:10,padding:"2px 0",color:C.text}}>{ex.type==="Chargeable"?`💰`:"🎁"} {ex.item}{ex.type==="Chargeable"?` @₹${ex.rate}`:""}</div>)}
                            </div>
                          )}
                          <div style={{display:"flex",gap:6}}>
                            <Btn onClick={()=>openEdit(ev)} color={C.wine} style={{fontSize:10,padding:"5px 12px",flex:1}}>✏ Edit</Btn>
                            <Btn onClick={()=>setDeleteId(ev.id)} color={C.red} style={{fontSize:10,padding:"5px 10px"}}>🗑</Btn>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ):(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:700,color:C.text}}>Upcoming Functions</div>
                <span style={{fontSize:10,color:C.muted}}>{upcomingEvs.length}</span>
              </div>
              {upcomingEvs.slice(0,10).map(ev=>{
                const p=gp(ev.venue);
                const daysAway=ev.date?Math.round((new Date(ev.date+"T00:00")-today)/(1000*60*60*24)):0;
                return (
                  <div key={ev.id} onClick={()=>{const d=ev.date||"";const pts=d.split("-");if(pts[0])setViewYear(+pts[0]);if(pts[1])setViewMonth(+pts[1]-1);setSelDate(d);setSelEvent(ev.id);}}
                    style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer"}}>
                    <div style={{width:36,height:36,borderRadius:7,background:p.bg,border:`1px solid ${p.c}30`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:p.c,lineHeight:1}}>{(ev.date||"").split("-")[2]||"?"}</div>
                      <div style={{fontSize:7,color:p.c,textTransform:"uppercase"}}>{MONTHS[+((ev.date||"").split("-")[1]||1)-1]?.slice(0,3)||""}</div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.guest}</div>
                      <div style={{fontSize:10,color:C.muted}}>{(ev.venue||"").split(" ").slice(0,2).join(" ")} · {ev.pax} pax</div>
                    </div>
                    <div style={{fontSize:11,fontWeight:700,color:daysAway===0?C.wine:daysAway===1?C.amber:C.muted,flexShrink:0}}>{daysAway===0?"TODAY":daysAway===1?"TMRW":daysAway+"d"}</div>
                  </div>
                );
              })}
              {upcomingEvs.length===0&&<div style={{textAlign:"center",padding:20,background:C.bg,borderRadius:9,fontSize:11,color:C.muted}}>No upcoming events.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function guessSectionForDish(name) {
  const n = (name||"").toLowerCase().trim();

  // ── Beverages — checked FIRST (juices/drinks/coolers often have fruit words) ──
  if(/\bjuice|lassi|mocktail|shikanji|jaljeera|\btea\b|lemonade|aerated|mineral water|\bcoke\b|\bfanta\b|\bsprite\b|mojito|pina colada|\bpunch\b|cooler|shots|green apple cooler|sweet sunrise|rose sherbet|\bsodas|virgin|thandai|aam panna|nimbu pani|chaas/i.test(n)) return "Beverages";

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




// ─── PREP PLAN COMPONENT ─────────────────────────────────────────────────
function PrepPlanTab({ evList, kt, lang }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const T2 = s => T(s, lang);

  // Day categories for each dish step
  const D1_STEPS = ["Mise en place","Primary prep","Marination & Soaking","Marination","Soaking","Dough","Batter","Grinding","Masala Prep","Cutting","Chopping","Advance Cooking","Mise en place"];
  const D0_STEPS = ["Cooking","Final seasoning","Garnish & plate","Chafing & hold","Final Cooking","Plating"];

  function getDaysUntil(dateStr) {
    if(!dateStr) return null;
    const d = new Date(dateStr + "T00:00:00");
    return Math.round((d - today) / (1000*60*60*24));
  }

  function catStep(stepTitle) {
    const t = (stepTitle||"").toLowerCase();
    if(/marina|soak|dough|batter|grind|masala|mise|cut|chop|advance|pre.cook|overnight/i.test(t)) return "d1";
    if(/cook|season|garnish|plate|chafing|hold|final/i.test(t)) return "d0";
    return "d1"; // default to prep day
  }

  // Build plan for an event
  function buildPlan(ev) {
    const daysAway = getDaysUntil(ev.date);
    const dishes   = Object.values((kt[ev.id])||{});
    const d1Tasks  = [];
    const d0Tasks  = [];

    dishes.forEach(dish => {
      const steps = Array.isArray(dish.steps) ? dish.steps : [];
      steps.forEach(step => {
        const cat = catStep(step.t);
        const task = { dish: dish.name, step: step.t, desc: step.desc||"", tm: step.tm, ccp: step.ccp, section: dish.section };
        if(cat === "d1") d1Tasks.push(task);
        else             d0Tasks.push(task);
      });
    });

    // If no menu yet, generate generic tasks from section guess
    if(dishes.length === 0 && Array.isArray(ev.menu) && ev.menu.length > 0) {
      ev.menu.forEach(name => {
        const sec = guessSectionForDish(name);
        d1Tasks.push({dish:name, step:"Mise en place", desc:"Gather & weigh all ingredients. Check freshness.", tm:15*60, section:sec});
        d1Tasks.push({dish:name, step:"Primary prep",  desc:"Cutting, chopping, marination.", tm:20*60, section:sec});
        d0Tasks.push({dish:name, step:"Cooking",       desc:"Main cook process.", tm:null, section:sec});
        d0Tasks.push({dish:name, step:"Garnish & plate",desc:"Apply garnishes, portion per pax.", tm:10*60, section:sec});
      });
    }

    return { daysAway, d1Tasks, d0Tasks };
  }

  // Only show upcoming events (today + future)
  const upcoming = evList.filter(ev => {
    const d = getDaysUntil(ev.date);
    return d !== null && d >= 0;
  }).sort((a,b) => a.date.localeCompare(b.date));

  const PROP_META = {
    "Ambria Pushpanjali":{code:"AP",c:"#6B1818",bg:"#FFF0F0"},
    "Ambria Manaktala":  {code:"AM",c:"#B05A10",bg:"#FEF3E8"},
    "Ambria Exotica":    {code:"AE",c:"#854F0B",bg:"#FEF6E2"},
    "Ambria Restro":     {code:"AR",c:"#0F6E56",bg:"#E6F4F0"},
    "Outdoor Catering (ODC)":{code:"ODC",c:"#5A3FA0",bg:"#F0EDFC"},
  };
  const gp = v => PROP_META[v]||{code:"EV",c:C.wine,bg:C.wineBg};
  const ftm = s => { if(!s) return ""; const m=Math.floor(s/60),sc=s%60; return m>0?`${m}m`:`${sc}s`; };

  if(upcoming.length === 0) return (
    <div style={{textAlign:"center",padding:48,background:C.bg,borderRadius:14}}>
      <div style={{fontSize:36,marginBottom:12}}>📅</div>
      <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:6}}>{T2("No functions yet. Add from Dashboard.")}</div>
    </div>
  );

  return (
    <div>
      {/* Legend */}
      <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>{T2("Prep Plan")}</div>
        <div style={{flex:1}}/>
        {[{c:"#854F0B",bg:"#FEF6E2",l:T2("Day −1 Prep (Tomorrow)")},{c:"#6B1818",bg:"#FFF0F0",l:T2("Event Day Final Prep")}].map(x=>(
          <div key={x.l} style={{display:"flex",gap:6,alignItems:"center",padding:"4px 10px",background:x.bg,borderRadius:20,border:`1px solid ${x.c}30`}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:x.c}}/>
            <span style={{fontSize:10,color:x.c,fontWeight:600}}>{x.l}</span>
          </div>
        ))}
      </div>

      {upcoming.map(ev => {
        const p     = gp(ev.venue);
        const plan  = buildPlan(ev);
        const da    = plan.daysAway;
        const label = da===0?"TODAY":da===1?"TOMORROW":`In ${da} days`;
        const labelC= da===0?C.wine:da===1?C.amber:C.blue;
        const labelBg=da===0?C.wineBg:da===1?C.amberBg:C.blueBg;

        // Group d1 tasks by section
        const d1BySec = {};
        plan.d1Tasks.forEach(t => {
          if(!d1BySec[t.section]) d1BySec[t.section]=[];
          d1BySec[t.section].push(t);
        });
        const d0BySec = {};
        plan.d0Tasks.forEach(t => {
          if(!d0BySec[t.section]) d0BySec[t.section]=[];
          d0BySec[t.section].push(t);
        });

        return (
          <div key={ev.id} style={{marginBottom:20,border:`2px solid ${p.c}20`,borderRadius:14,overflow:"hidden"}}>
            {/* Event header */}
            <div style={{background:p.bg,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${p.c}20`}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>{ev.guest}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{ev.id} · {ev.date} · {ev.time} · {ev.pax} pax · {p.code}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,fontWeight:700,padding:"4px 14px",borderRadius:20,background:labelBg,color:labelC,marginBottom:4}}>{label}</div>
                <div style={{fontSize:10,color:C.muted}}>{(ev.menu||[]).length} dishes</div>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
              {/* D-1 Column */}
              <div style={{borderRight:`1px solid ${C.border}`,padding:"12px 14px"}}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:10}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"#854F0B"}}/>
                  <div style={{fontSize:12,fontWeight:700,color:"#854F0B"}}>
                    {da===0?"Yesterday was D−1":da===1?T2("Day −1 Prep (Tomorrow)"):`D−1: ${new Date(new Date(ev.date+"T00:00:00") - 86400000).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}`}
                  </div>
                </div>
                {Object.entries(d1BySec).map(([sec,tasks])=>{
                  const m = SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                  return (
                    <div key={sec} style={{marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:700,color:m.color,marginBottom:5,display:"flex",alignItems:"center",gap:4}}>
                        <span>{m.icon}</span>{T2(sec)||sec}
                      </div>
                      {tasks.map((task,ti)=>(
                        <div key={ti} style={{fontSize:11,color:C.text,padding:"5px 8px",marginBottom:3,background:m.color+"08",borderRadius:6,borderLeft:`3px solid ${m.color}40`}}>
                          <div style={{fontWeight:500}}>{T2(task.step)||task.step} — <span style={{color:C.wine,fontWeight:700}}>{task.dish}</span></div>
                          {task.desc&&<div style={{fontSize:10,color:C.muted,marginTop:1}}>{task.desc}</div>}
                          {task.ccp&&<div style={{fontSize:10,color:C.red,marginTop:2}}>⚠ {task.ccp}</div>}
                          {task.tm&&<div style={{fontSize:9,color:C.muted,marginTop:1}}>⏱ {ftm(task.tm)}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {Object.keys(d1BySec).length===0&&<div style={{fontSize:11,color:C.faint,fontStyle:"italic"}}>{T2("No advance prep required.")}</div>}
              </div>

              {/* D-0 Column */}
              <div style={{padding:"12px 14px",background:da===0?"#FFFAF8":"transparent"}}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:10}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:C.wine}}/>
                  <div style={{fontSize:12,fontWeight:700,color:C.wine}}>
                    {da===0?T2("Event Day Final Prep"):`D−0: ${new Date(ev.date+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",weekday:"short"})}`}
                    {da===0&&<span style={{marginLeft:6,fontSize:9,padding:"2px 7px",borderRadius:10,background:C.wine,color:"#fff"}}>TODAY</span>}
                  </div>
                </div>
                {Object.entries(d0BySec).map(([sec,tasks])=>{
                  const m = SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                  return (
                    <div key={sec} style={{marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:700,color:m.color,marginBottom:5,display:"flex",alignItems:"center",gap:4}}>
                        <span>{m.icon}</span>{T2(sec)||sec}
                      </div>
                      {tasks.map((task,ti)=>(
                        <div key={ti} style={{fontSize:11,color:C.text,padding:"5px 8px",marginBottom:3,background:C.wine+"08",borderRadius:6,borderLeft:`3px solid ${C.wine}40`}}>
                          <div style={{fontWeight:500}}>{T2(task.step)||task.step} — <span style={{color:C.wine,fontWeight:700}}>{task.dish}</span></div>
                          {task.desc&&<div style={{fontSize:10,color:C.muted,marginTop:1}}>{task.desc}</div>}
                          {task.ccp&&<div style={{fontSize:10,color:C.red,marginTop:2}}>⚠ {task.ccp}</div>}
                          {task.tm&&<div style={{fontSize:9,color:C.muted,marginTop:1}}>⏱ {ftm(task.tm)}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {Object.keys(d0BySec).length===0&&<div style={{fontSize:11,color:C.faint,fontStyle:"italic"}}>{T2("No event-day tasks listed.")}</div>}
              </div>
            </div>

            {/* Dispatch reminder */}
            <div style={{background:C.bg,borderTop:`1px solid ${C.border}`,padding:"8px 14px",display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:12}}>🚛</span>
              <div style={{fontSize:11,color:C.muted}}>
                <strong>Dispatch window:</strong> {ev.time ? `${calcDispatch(ev.time)} → ${ev.time}` : "Set event time in Dashboard"} · Chafing dish hold temp: <span style={{color:C.red,fontWeight:600}}>60°C+</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


function KitchenHub({ events, kitchenTracking, setKitchenTracking, lang="en" }) {
  const T2 = s => T(s, lang);
  const evList = Array.isArray(events) ? events : [];
  const kt     = kitchenTracking && typeof kitchenTracking === "object" ? kitchenTracking : {};
  const tmr    = new Date(Date.now()+86400000).toISOString().split("T")[0];
  const sorted = [...evList].sort((a,b)=>{const r=d=>d===TODAY?0:d>TODAY?1:2;return r(a.date)-r(b.date)||a.date.localeCompare(b.date);});

  const [selId,  setSelId]  = useState(sorted[0]?.id||null);
  const [modal,  setModal]  = useState(null);
  const [tab,    setTab]    = useState("prep");
  const [secFil, setSecFil] = useState("All");
  const [catId,  setCatId]  = useState(null);
  const [rIdx,   setRIdx]   = useState(0);
  const [rStep,  setRStep]  = useState(0);
  const [srch,   setSrch]   = useState("");
  const [sub,    setSub]    = useState("All");
  // Per-step timers: { [stepIndex]: { sec: number, running: boolean, done: boolean } }
  const [stepTimers, setStepTimers] = useState({});
  // D-1 prep tracking: {evId: {taskKey: true/false}}
  const [d1Tasks, setD1Tasks]   = useState({});
  const [showD1Plan, setShowD1Plan] = useState(null); // evId of expanded D-1 plan
  const stepTimerRef = useRef(null);
  const [tmSec,  setTmSec]  = useState(0);
  const [tmRun,  setTmRun]  = useState(false);
  const tmRef = useRef(null);

  useEffect(()=>{
    if(tmRun){tmRef.current=setInterval(()=>setTmSec(s=>{if(s<=1){clearInterval(tmRef.current);setTmRun(false);return 0;}return s-1;}),1000);}
    else clearInterval(tmRef.current);
    return()=>clearInterval(tmRef.current);
  },[tmRun]);

  // Step timers — unstoppable: once started, runs every second until SOP time is done
  useEffect(()=>{
    if(!modal) { clearInterval(stepTimerRef.current); return; }
    stepTimerRef.current = setInterval(()=>{
      setStepTimers(prev=>{
        const next={...prev};
        let changed=false;
        Object.keys(next).forEach(k=>{
          if(next[k].running && next[k].sec>0){
            next[k]={...next[k], sec:next[k].sec-1};
            if(next[k].sec<=0) next[k]={...next[k],running:false,done:true};
            changed=true;
          }
        });
        return changed?next:prev;
      });
    },1000);
    return ()=>clearInterval(stepTimerRef.current);
  },[modal]);

  const evKey = evList.map(e=>e.id+":"+(e.menu||[]).length).join("|");
  useEffect(()=>{
    if(!setKitchenTracking||!evList.length) return;
    setKitchenTracking(prev=>{
      const p = prev&&typeof prev==="object"?prev:{};
      let changed=false;
      const next={...p};
      evList.forEach(ev=>{
        if(!next[ev.id]){next[ev.id]={};changed=true;}
        (Array.isArray(ev.menu)?ev.menu:[]).forEach((name,i)=>{
          const dId=ev.id+"|"+i;
          if(!next[ev.id][dId]){
            next[ev.id][dId]={dId,name,chefName:"",steps:getStepsForDish(name),done:[],dispatched:false,delivered:false,section:guessSectionForDish(name)};
            changed=true;
          }
        });
      });
      if(!selId&&evList[0]) setSelId(evList[0].id);
      return changed?next:p;
    });
  },[evKey]); // eslint-disable-line

  const selEv  = sorted.find(e=>e.id===selId)||null;
  const evD    = selEv ? Object.values(kt[selEv.id]||{}) : [];
  const filt   = secFil==="All" ? evD : evD.filter(d=>d.section===secFil);

  const pct  = list=>{ if(!list||!list.length)return 0; return Math.round(list.filter(d=>Array.isArray(d.steps)&&d.steps.length>0&&Array.isArray(d.done)&&d.done.length>=d.steps.length).length/list.length*100); };
  const dpct = list=>{ if(!list||!list.length)return 0; return Math.round(list.filter(d=>d.dispatched).length/list.length*100); };
  const lpct = list=>{ if(!list||!list.length)return 0; return Math.round(list.filter(d=>d.delivered).length/list.length*100); };
  const dpish= d=>{ if(!d||!Array.isArray(d.steps)||!d.steps.length)return 0; return Math.round((Array.isArray(d.done)?d.done.length:0)/d.steps.length*100); };
  function pat(evId,dId,ch){if(!setKitchenTracking)return;setKitchenTracking(p=>{const safe=p&&typeof p==="object"?p:{};const em=safe[evId]||{};const di=em[dId]||{};return{...safe,[evId]:{...em,[dId]:{...di,...ch}}};});}
  function tog(evId,dId,si){const d=(kt[evId]||{})[dId];if(!d)return;const c=Array.isArray(d.done)?d.done:[];pat(evId,dId,{done:c.includes(si)?c.filter(x=>x!==si):[...c,si]});}
  const ftm=s=>{if(!s)return"";const m=Math.floor(s/60),sc=s%60;return m>0?m+"m "+sc+"s":sc+"s";};
  const PCOL={"Ambria Pushpanjali":{code:"AP",c:"#6B1818",bg:"#FFF0F0"},"Ambria Exotica":{code:"AE",c:"#854F0B",bg:"#FEF6E2"},"Manaktala Farm":{code:"AM",c:"#B05A10",bg:"#FEF3E8"},"Ambria Manaktala":{code:"AM",c:"#B05A10",bg:"#FEF3E8"},"Ambria Restro":{code:"AR",c:"#0F6E56",bg:"#E6F4F0"},"Outdoor Catering (ODC)":{code:"ODC",c:"#5A3FA0",bg:"#F0EDFC"}};
  const gp=v=>PCOL[v]||{code:"EV",c:C.wine,bg:C.wineBg};
  const modalDish = modal?(kt[modal.evId]||{})[modal.dId]||null:null;
  const SCOL={boil:"#1756A0",fry:C.red,saute:C.amber,marinate:"#6040A8",grill:C.red,mix:C.green,plate:C.green,cook:C.amber,simmer:"#1756A0",blend:"#6040A8",soak:C.teal};
  const allR = RECIPE_DB.cats.flatMap(c=>(RECIPE_DB.recipes[c.id]||[]).map(r=>({...r,cat:c})));
  const srchR = srch.trim()?allR.filter(r=>r.n.toLowerCase().includes(srch.toLowerCase())):[];
  const cat2 = RECIPE_DB.cats.find(c=>c.id===catId)||null;
  const rList = catId?((RECIPE_DB.recipes[catId]||[]).filter(r=>sub==="All"||!r.sub||r.sub===sub)):[];
  const recipe = rList[rIdx]||null;
  const curSt  = recipe?recipe.steps[rStep]||null:null;
  const scale  = selEv&&selEv.pax?selEv.pax/4:1;

  return (
    <div>
      {/* MODAL */}
      {modal&&modalDish&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
          <div style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:520,maxHeight:"90vh",overflow:"auto",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.surface}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:C.text}}>{modalDish.name}</div>
                  <div style={{display:"flex",gap:5,marginTop:3,alignItems:"center"}}>
                    <STag name={modalDish.section}/>
                    <span style={{fontSize:11,color:dpish(modalDish)===100?C.green:C.amber,fontWeight:600}}>{dpish(modalDish)}%</span>
                  </div>
                </div>
                <button onClick={()=>{setModal(null);setStepTimers({});}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.muted}}>×</button>
              </div>
              <div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${dpish(modalDish)}%`,background:dpish(modalDish)===100?C.green:C.wine,transition:"width .3s",borderRadius:2}}/>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}>
                <span style={{fontSize:11,color:C.muted}}>👨‍🍳</span>
                <input value={modalDish.chefName||""} onChange={e=>pat(modal.evId,modal.dId,{chefName:e.target.value})} placeholder="Assign chef" style={{flex:1,padding:"5px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.bg}}/>
              </div>
            </div>
            <div style={{padding:"12px 18px",flex:1,overflowY:"auto"}}>
              {(modalDish.steps||GENERIC_STEPS).map((step,si)=>{
                const done        = (modalDish.done||[]).includes(si);
                const active      = si===(modalDish.done||[]).length;
                const st          = stepTimers[si] || {sec: step.tm||0, running:false, done:false};
                const isRunning   = st.running;
                const isTimerDone = st.done;
                const dispSec     = st.sec;
                const pctTimer    = step.tm ? Math.round((1 - dispSec/step.tm)*100) : 0;
                const fmtSec      = s=>{const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;return h>0?`${h}:${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}`:m>0?`${m}:${String(sc).padStart(2,"0")}`:`0:${String(sc).padStart(2,"0")}`;};
                function startTimer(){
                  // Start from full SOP time — runs automatically until zero, cannot be stopped
                  setStepTimers(p=>({...p,[si]:{sec:step.tm||0,running:true,done:false}}));
                }
                const borderCol = done ? C.greenBorder : active ? C.wineBorder : C.borderLight;
                const bgCol     = done ? C.greenBg : active ? C.wineBg : C.bg;

                return (
                  <div key={si} style={{marginBottom:10,borderRadius:12,overflow:"hidden",border:`2px solid ${borderCol}`}}>
                    {/* Step header — tap to mark done */}
                    <div onClick={()=>tog(modal.evId,modal.dId,si)}
                      style={{display:"flex",gap:10,padding:"12px 14px",cursor:"pointer",background:bgCol,alignItems:"flex-start"}}>
                      {/* Step number circle */}
                      <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                        background:done?C.green:active?C.wine:C.border,color:done||active?"#fff":C.muted,fontSize:13,fontWeight:700}}>
                        {done?"✓":si+1}
                      </div>
                      <div style={{flex:1}}>
                        {/* Step number + name + SOP time — prominently displayed */}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2}}>
                          <div>
                            <div style={{fontSize:9,fontWeight:700,color:done?C.green:active?C.wine:C.muted,textTransform:"uppercase",letterSpacing:".08em",marginBottom:2}}>
                              Step {si+1} of {(modalDish.steps||[]).length}
                            </div>
                            <span style={{fontSize:14,fontWeight:700,color:done?C.green:active?C.wine:C.muted}}>
                              {step.t}
                            </span>
                          </div>
                          {step.tm&&(
                            <span style={{fontSize:11,fontWeight:600,color:isTimerDone?C.green:isRunning?C.amber:C.muted,
                              padding:"3px 10px",borderRadius:10,background:isTimerDone?C.greenBg:isRunning?C.amberBg:C.bg,
                              flexShrink:0,marginLeft:8}}>
                              {isRunning ? `⏱ ${fmtSec(dispSec)}` : isTimerDone ? "✅ Done" : `SOP: ${Math.floor(step.tm/60)}m`}
                            </span>
                          )}
                        </div>
                        {/* Step description — prominently shown */}
                        {/* Step instructions — always visible for all steps */}
                        {step.desc&&(
                          <div style={{fontSize:11,color:done?C.muted:active?C.text:"#5a5a5a",lineHeight:1.7,marginTop:4,
                            background:active&&!done?"rgba(107,24,24,.05)":"rgba(0,0,0,.02)",
                            padding:"7px 10px",borderRadius:7,
                            borderLeft:active&&!done?`3px solid ${C.wine}`:done?`3px solid ${C.green}`:"3px solid transparent"}}>
                            <span style={{fontSize:9,fontWeight:700,color:done?C.green:active?C.wine:C.muted,textTransform:"uppercase",letterSpacing:".05em",display:"block",marginBottom:2}}>
                              {done?"✓ Completed":active?"📌 Current Step":"Instructions"}
                            </span>
                            {step.desc}
                          </div>
                        )}
                        {/* CCP warning — critical control point */}
                        {step.ccp&&(
                          <div style={{marginTop:6,padding:"5px 9px",background:C.redBg,borderRadius:6,borderLeft:`3px solid ${C.red}`,
                            fontSize:11,color:C.red,display:"flex",gap:5,alignItems:"flex-start"}}>
                            <span style={{fontSize:14,flexShrink:0}}>⚠️</span>
                            <span><strong>CCP:</strong> {step.ccp}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timer section — only for steps with SOP time defined */}
                    {step.tm&&active&&!done&&(
                      <div style={{background:isRunning?"#FFF8ED":isTimerDone?C.greenBg:"#F8F6F3",borderTop:`1px solid ${borderCol}`,padding:"10px 14px"}}>
                        {/* Progress bar */}
                        <div style={{height:6,background:"rgba(0,0,0,.07)",borderRadius:3,marginBottom:10,overflow:"hidden"}}>
                          <div style={{height:"100%",borderRadius:3,transition:"width 1s linear",
                            width:`${isTimerDone?100:pctTimer}%`,
                            background:isTimerDone?C.green:isRunning?C.amber:C.muted}}/>
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          {/* Countdown display */}
                          <div style={{fontSize:24,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:".02em",
                            color:isTimerDone?C.green:isRunning?C.amber:C.text,minWidth:70}}>
                            {fmtSec(dispSec)}
                          </div>
                          {/* Start button — only shows when not running and not done */}
                          {!isTimerDone&&!isRunning&&(
                            <button onClick={e=>{e.stopPropagation();startTimer();}}
                              style={{padding:"10px 22px",borderRadius:20,fontSize:13,fontWeight:700,cursor:"pointer",border:"none",
                                background:C.wine,color:"#fff",display:"flex",alignItems:"center",gap:8,boxShadow:"0 2px 8px rgba(107,24,24,.3)"}}>
                              <span style={{fontSize:14}}>▶</span> Start Prep Timer
                            </button>
                          )}
                          {/* Running indicator — cannot stop */}
                          {isRunning&&(
                            <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:20,background:C.amberBg,border:`1.5px solid ${C.amberBorder}`}}>
                              <div style={{width:8,height:8,borderRadius:"50%",background:C.amber,animation:"none"}}/>
                              <span style={{fontSize:11,fontWeight:700,color:C.amber}}>⏱ Prep in progress — Cannot stop · Auto-completes at 0:00</span>
                            </div>
                          )}
                          {/* Done badge */}
                          {isTimerDone&&(
                            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 14px",borderRadius:20,background:C.greenBg,border:`1px solid ${C.greenBorder}`}}>
                              <span style={{fontSize:14}}>✅</span>
                              <span style={{fontSize:12,fontWeight:700,color:C.green}}>✅ SOP time complete! Tap step to mark donee! Tap step to mark done →</span>
                            </div>
                          )}
                          <div style={{flex:1}}/>
                          <span style={{fontSize:10,color:C.faint}}>SOP: {Math.floor(step.tm/60)}m</span>
                        </div>
                      </div>
                    )}
                    {/* Compact timer for non-active steps that have time */}
                    {step.tm&&(!active||done)&&isRunning&&(
                      <div style={{background:C.amberBg,borderTop:`1px solid ${C.amberBorder}`,padding:"6px 14px",display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.amber}}>{fmtSec(dispSec)}</div>
                        <span style={{fontSize:10,color:C.amber}}>running…</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{padding:"10px 18px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8,position:"sticky",bottom:0,background:C.surface}}>
              <button onClick={()=>pat(modal.evId,modal.dId,{dispatched:!modalDish.dispatched})} style={{flex:1,padding:"8px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",background:modalDish.dispatched?C.blue:C.blueBg,color:modalDish.dispatched?"#fff":C.blue}}>🚛 {modalDish.dispatched?"Dispatched ✓":"Mark Dispatched"}</button>
              <button onClick={()=>pat(modal.evId,modal.dId,{delivered:!modalDish.delivered})} style={{flex:1,padding:"8px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",background:modalDish.delivered?C.green:C.greenBg,color:modalDish.delivered?"#fff":C.green}}>✅ {modalDish.delivered?"Delivered ✓":"Mark Delivered"}</button>
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div><div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>👨‍🍳 Kitchen</div><div style={{fontSize:11,color:C.muted}}>Prep · SOPs · Dispatch</div></div>
        <div style={{display:"flex",gap:6}}>
          {[{v:"overview",l:"📊 Today's Kitchen"},{v:"prep",l:"📋 Prep Tracking"},{v:"plan",l:"📅 Prep Plan"},{v:"sops",l:"📖 Recipe SOPs"}].map(t=>(
            <button key={t.v} onClick={()=>setTab(t.v)} style={{padding:"5px 13px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",background:tab===t.v?C.wine:"transparent",color:tab===t.v?"#fff":C.muted,border:`1.5px solid ${tab===t.v?C.wine:C.border}`}}>{lang==="hi"&&t.hi?t.hi:t.l}</button>
          ))}
        </div>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab==="overview"&&(()=>{
        const T2 = s => T(s, lang);
        const todayEvs = sorted.filter(e=>e.date===TODAY);
        const tmrEvs   = sorted.filter(e=>e.date===tmr);
        const totalPax = todayEvs.reduce((s,e)=>s+(+e.pax||0),0);
        const tmrPax   = tmrEvs.reduce((s,e)=>s+(+e.pax||0),0);
        const allTodayDishes = todayEvs.flatMap(ev=>(ev.menu||[]).map(n=>({name:n,evId:ev.id,guest:ev.guest,venue:ev.venue,pax:+ev.pax||0,section:guessSectionForDish(n)})));
        const allTmrDishes   = tmrEvs.flatMap(ev=>(ev.menu||[]).map(n=>({name:n,evId:ev.id,guest:ev.guest,venue:ev.venue,pax:+ev.pax||0,section:guessSectionForDish(n)})));

        const PROP = {
          "Ambria Pushpanjali":{code:"AP",c:"#6B1818",bg:"#FFF0F0"},
          "Ambria Exotica":    {code:"AE",c:"#854F0B",bg:"#FEF6E2"},
          "Manaktala Farm":    {code:"AM",c:"#B05A10",bg:"#FEF3E8"},
          "Ambria Restro":     {code:"AR",c:"#0F6E56",bg:"#E6F4F0"},
          "Outdoor Catering (ODC)":{code:"ODC",c:"#5A3FA0",bg:"#F0EDFC"},
        };
        const gp2 = v => PROP[v]||{code:"EV",c:C.wine,bg:C.wineBg};

        return (
          <div>
            {/* Stats bar */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
              {[
                {l:T2("Today Functions"),  v:todayEvs.length, c:C.wine, bg:C.wineBg, i:"🎪"},
                {l:T2("Today Pax"),        v:totalPax,        c:C.blue, bg:C.blueBg, i:"👥"},
                {l:T2("Tomorrow Events"),  v:tmrEvs.length,   c:C.amber,bg:C.amberBg,i:"📅"},
                {l:T2("Tomorrow Pax"),     v:tmrPax,          c:C.green,bg:C.greenBg,i:"👥"},
              ].map(m=>(
                <div key={m.l} style={{background:m.bg,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:3}}>{m.i}</div>
                  <div style={{fontSize:24,fontWeight:700,color:m.c,lineHeight:1.1}}>{m.v}</div>
                  <div style={{fontSize:10,color:m.c,fontWeight:500,marginTop:2,opacity:.8}}>{m.l}</div>
                </div>
              ))}
            </div>

            {/* TODAY's events - Full FP Cards */}
            {todayEvs.length>0&&(
              <div style={{marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:C.wine}}/>
                  <div style={{fontSize:14,fontWeight:700,color:C.wine,fontFamily:"Georgia,serif"}}>🔴 TODAY's LIVE EVENTS — Final Preparations</div>
                </div>
                {todayEvs.map(ev=>{
                  const p = gp2(ev.venue);
                  const evDishes = Object.values(kt[ev.id]||{});
                  const prepPct = evDishes.length>0 ? Math.round(evDishes.filter(d=>Array.isArray(d.done)&&Array.isArray(d.steps)&&d.steps.length>0&&d.done.length>=d.steps.length).length/evDishes.length*100) : 0;
                  const bySec = {};
                  (ev.menu||[]).forEach(n=>{const s=guessSectionForDish(n);if(!bySec[s])bySec[s]=[];bySec[s].push(n);});
                  return (
                    <div key={ev.id} style={{border:`2px solid ${p.c}`,borderRadius:14,overflow:"hidden",marginBottom:12}}>
                      {/* FP Header */}
                      <div style={{background:p.bg,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",borderBottom:`1px solid ${p.c}20`}}>
                        <div>
                          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                            <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,background:C.wine,color:"#fff"}}>{T2("LIVE TODAY")}</span>
                            <span style={{fontSize:11,padding:"2px 9px",borderRadius:20,background:p.bg,color:p.c,border:`1px solid ${p.c}30`}}>{p.code}</span>
                            <span style={{fontSize:11,color:C.muted}}>{ev.id}</span>
                          </div>
                          <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>{ev.guest}</div>
                          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{ev.venue} · {ev.time} · <strong>{ev.pax} pax</strong> ({ev.veg||0} veg / {ev.nonveg||0} non-veg)</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:22,fontWeight:700,color:prepPct===100?C.green:C.wine}}>{prepPct}<span style={{fontSize:12}}>%</span></div>
                          <div style={{fontSize:9,color:C.muted}}>prep done</div>
                          <div style={{height:4,width:70,background:C.border,borderRadius:2,marginTop:4,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${prepPct}%`,background:prepPct===100?C.green:C.wine,borderRadius:2}}/>
                          </div>
                        </div>
                      </div>
                      {/* Special + Extras */}
                      {(ev.special||(ev.extras&&ev.extras.length>0))&&(
                        <div style={{background:"#FFFDF5",borderBottom:`1px solid ${C.border}`,padding:"8px 16px",display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-start"}}>
                          {ev.special&&(
                            <div style={{fontSize:11,color:C.amber,display:"flex",gap:5}}>
                              <span>⚠</span><span><strong>{T2("Special:")}</strong> {ev.special}</span>
                            </div>
                          )}
                          {(ev.extras||[]).length>0&&(
                            <div style={{fontSize:11,color:C.blue}}>
                              <strong>{T2("Extras from Sales:")}</strong>{" "}
                              {(ev.extras||[]).map((ex,i)=>(
                                <span key={i} style={{display:"inline-flex",gap:3,alignItems:"center",marginRight:8,padding:"1px 7px",borderRadius:10,background:ex.type==="Chargeable"?C.amberBg:C.greenBg,color:ex.type==="Chargeable"?C.amber:C.green}}>
                                  {ex.item}{ex.type==="Chargeable"?` @ ₹${ex.rate}`:" (Free)"}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Menu by Section */}
                      <div style={{padding:"12px 16px"}}>
                        <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:8}}>📋 Menu — {(ev.menu||[]).length} dishes · Dispatch by {calcDispatch(ev.time)}</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                          {Object.entries(bySec).map(([sec,dishes])=>{
                            const m = SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                            return (
                              <div key={sec} style={{background:m.color+"0C",border:`1px solid ${m.color}25`,borderRadius:8,padding:"8px 10px"}}>
                                <div style={{fontSize:11,fontWeight:700,color:m.color,marginBottom:5,display:"flex",gap:5,alignItems:"center"}}>
                                  <span>{m.icon}</span><span>{sec}</span><span style={{fontWeight:400,opacity:.7}}>({dishes.length})</span>
                                </div>
                                {dishes.map((d,di)=><div key={di} style={{fontSize:10,color:C.text,padding:"2px 0",borderBottom:di<dishes.length-1?`1px solid ${m.color}15`:"none"}}>{d}</div>)}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* D-1 Done Summary + Final Prep Status */}
                      {(()=>{
                        const evD1 = d1Tasks[ev.id]||{};
                        const D1_ALL = [
                          {key:"marination", icon:"🧂", label:"Marination & Soaking"},
                          {key:"mise",       icon:"🔪", label:"Mise en Place"},
                          {key:"grinding",   icon:"⚗️", label:"Grinding & Masalas"},
                          {key:"dough",      icon:"🍞", label:"Dough / Batter"},
                          {key:"advance",    icon:"🥘", label:"Advance Cooking"},
                          {key:"stock",      icon:"🧊", label:"Cold Item Stock-up"},
                          {key:"equipment",  icon:"🔧", label:"Equipment Check"},
                          {key:"dispatch_plan",icon:"🚛",label:"Dispatch Planning"},
                        ];
                        const done = D1_ALL.filter(t=>evD1[t.key]);
                        const missed = D1_ALL.filter(t=>!evD1[t.key]);

                        // Final prep tasks for event day (kitchen + on-site)
                        const FINAL_KITCHEN = [
                          {key:"final_cook",   icon:"🔥", label:"Final Cooking",        desc:"Complete curries, tandoor items, Chinese wok dishes"},
                          {key:"seasoning",    icon:"🧂", label:"Final Seasoning",       desc:"Taste and adjust salt, acid, spice of all dishes"},
                          {key:"chafing",      icon:"🍲", label:"Chafing Dish Setup",    desc:"Transfer to chafing. Hold above 60°C until dispatch"},
                          {key:"packing",      icon:"📦", label:"Pack & Load",           desc:"Load truck. Cross-check against loading checklist"},
                        ];
                        const FINAL_SITE = [
                          {key:"plate_setup",  icon:"🍽", label:"Plating Setup",         desc:"Set up buffet table, warming units at venue"},
                          {key:"garnish",      icon:"🌿", label:"Garnishing (ON-SITE)",  desc:"Apply garnishes, herbs, toppings at venue — NOT in kitchen", onsite:true},
                          {key:"chaat_live",   icon:"🫙", label:"Live Counter Setup",    desc:"Set up chaat, live stations, welcome drink counters at venue", onsite:true},
                          {key:"taste_final",  icon:"✅", label:"Final Taste & GO",      desc:"Head Chef final approval before service starts"},
                        ];
                        const allFinal = [...FINAL_KITCHEN,...FINAL_SITE];
                        const evFinal = (d1Tasks["final_"+ev.id])||{};
                        const finalDone = allFinal.filter(t=>evFinal[t.key]).length;
                        const finalPct  = allFinal.length?Math.round(finalDone/allFinal.length*100):0;

                        function toggleFinal(taskKey){
                          setD1Tasks(p=>({...p,["final_"+ev.id]:{...(p["final_"+ev.id]||{}),[taskKey]:!(p["final_"+ev.id]||{})[taskKey]}}));
                        }

                        return (
                          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                            {/* D-1 recap */}
                            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
                              <span style={{fontSize:11,fontWeight:700,color:C.text}}>D−1 Status:</span>
                              {done.length>0
                                ? done.map(t=><span key={t.key} style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:C.greenBg,color:C.green,display:"flex",gap:4,alignItems:"center"}}>{t.icon} {t.label}</span>)
                                : <span style={{fontSize:11,color:C.red}}>⚠ No D−1 tasks marked done!</span>
                              }
                            </div>
                            {missed.length>0&&(
                              <div style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:8,padding:"7px 12px",marginBottom:10,fontSize:11,color:C.red}}>
                                ⚠ Not completed yesterday: {missed.map(t=>t.icon+" "+t.label).join(" · ")}
                              </div>
                            )}

                            {/* Final prep checklist */}
                            <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>
                              🔥 Event Day Final Preps — {finalDone}/{allFinal.length}
                              <span style={{fontSize:10,fontWeight:400,color:C.muted,marginLeft:8}}>{finalPct}% complete</span>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                              {/* Kitchen tasks */}
                              <div>
                                <div style={{fontSize:10,fontWeight:700,color:C.wine,marginBottom:5,textTransform:"uppercase",letterSpacing:".05em"}}>🏠 Kitchen</div>
                                {FINAL_KITCHEN.map(task=>{
                                  const done2=!!evFinal[task.key];
                                  return (
                                    <div key={task.key} onClick={()=>toggleFinal(task.key)}
                                      style={{display:"flex",gap:8,padding:"7px 10px",marginBottom:4,borderRadius:8,border:`1px solid ${done2?C.greenBorder:C.border}`,background:done2?C.greenBg:C.surface,cursor:"pointer",alignItems:"flex-start"}}>
                                      <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${done2?C.green:C.border}`,background:done2?C.green:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                        {done2&&<span style={{color:"#fff",fontSize:9,fontWeight:700}}>✓</span>}
                                      </div>
                                      <div>
                                        <div style={{fontSize:11,fontWeight:600,color:done2?C.green:C.text,textDecoration:done2?"line-through":"none"}}>{task.icon} {task.label}</div>
                                        <div style={{fontSize:9,color:C.muted,marginTop:1}}>{task.desc}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* On-site tasks */}
                              <div>
                                <div style={{fontSize:10,fontWeight:700,color:"#854F0B",marginBottom:5,textTransform:"uppercase",letterSpacing:".05em"}}>📍 At Venue (On-Site)</div>
                                {FINAL_SITE.map(task=>{
                                  const done2=!!evFinal[task.key];
                                  return (
                                    <div key={task.key} onClick={()=>toggleFinal(task.key)}
                                      style={{display:"flex",gap:8,padding:"7px 10px",marginBottom:4,borderRadius:8,border:`1px solid ${task.onsite?"#E8C080":C.border}`,background:done2?"#F0FAF4":task.onsite?"#FFFBF0":C.surface,cursor:"pointer",alignItems:"flex-start"}}>
                                      <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${done2?C.green:task.onsite?"#C07010":C.border}`,background:done2?C.green:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                        {done2&&<span style={{color:"#fff",fontSize:9,fontWeight:700}}>✓</span>}
                                      </div>
                                      <div>
                                        <div style={{fontSize:11,fontWeight:600,color:done2?C.green:task.onsite?"#854F0B":C.text,textDecoration:done2?"line-through":"none"}}>
                                          {task.icon} {task.label}
                                          {task.onsite&&!done2&&<span style={{marginLeft:5,fontSize:9,padding:"1px 5px",borderRadius:8,background:"#FEF6E2",color:"#854F0B",fontWeight:700}}>VENUE</span>}
                                        </div>
                                        <div style={{fontSize:9,color:C.muted,marginTop:1}}>{task.desc}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TOMORROW's events — D-1 Prep with trackable tasks */}
            {tmrEvs.length>0&&(
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:C.amber}}/>
                  <div style={{fontSize:14,fontWeight:700,color:C.amber,fontFamily:"Georgia,serif"}}>📅 TOMORROW — D−1 Advance Preparation</div>
                </div>
                {tmrEvs.map(ev=>{
                  const p = gp2(ev.venue);
                  const bySec = {};
                  (ev.menu||[]).forEach(n=>{const s=guessSectionForDish(n);if(!bySec[s])bySec[s]=[];bySec[s].push(n);});
                  const isExpanded = showD1Plan===ev.id;

                  // Build D-1 task list from menu
                  const D1_TASK_DEFS = [
                    {key:"marination", icon:"🧂", label:"Marination & Soaking", desc:"Marinate tikka/kebab/chaap, soak rajma/dal/chana overnight", sections:["Tandoor","Indian Curries"]},
                    {key:"mise",       icon:"🔪", label:"Mise en Place",         desc:"Cutting, chopping, measuring and weighing all ingredients", sections:SECTIONS},
                    {key:"grinding",   icon:"⚗️", label:"Grinding & Masalas",    desc:"Grind fresh masala pastes, prepare base gravies", sections:["Indian Curries","Chinese","Chaat"]},
                    {key:"dough",      icon:"🍞", label:"Dough / Batter Prep",   desc:"Prepare dough for breads, batter for snacks and fritters", sections:["Tandoor","Chaat"]},
                    {key:"advance",    icon:"🥘", label:"Advance Cooking",        desc:"Boil dal/rajma, prepare curry bases, makhani base", sections:["Indian Curries","Sweets"]},
                    {key:"stock",      icon:"🧊", label:"Cold Item Stock-up",     desc:"Ensure dairy/chhena/cream are in fridge, cold chain ready", sections:["Sweets","Beverages"]},
                    {key:"equipment",  icon:"🔧", label:"Equipment Check",        desc:"Count chafing dishes, fuel cans, crockery. Report shortfall", sections:["Indian Curries"]},
                    {key:"dispatch_plan",icon:"🚛",label:"Dispatch Planning",     desc:`Brief drivers. Confirm dispatch time: ${calcDispatch(ev.time)}`, sections:["Indian Curries"]},
                  ];
                  // Filter to sections that appear in this event's menu
                  const activeSecs = new Set(Object.keys(bySec));
                  const relevantTasks = D1_TASK_DEFS.filter(t=>t.sections.some(s=>activeSecs.has(s)||s==="Indian Curries"));

                  const evD1 = d1Tasks[ev.id]||{};
                  const doneCt = relevantTasks.filter(t=>evD1[t.key]).length;
                  const pct = relevantTasks.length ? Math.round(doneCt/relevantTasks.length*100) : 0;

                  function toggleD1(taskKey){
                    setD1Tasks(p=>({...p,[ev.id]:{...(p[ev.id]||{}),[taskKey]:!(p[ev.id]||{})[taskKey]}}));
                  }

                  return (
                    <div key={ev.id} style={{border:`2px solid ${C.amber}40`,borderRadius:14,overflow:"hidden",marginBottom:12,background:"#FFFDF5"}}>
                      {/* Header */}
                      <div style={{background:"#FEF6E8",padding:"12px 16px",borderBottom:`1px solid ${C.amber}30`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                          <div>
                            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                              <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,background:C.amber,color:"#fff"}}>TOMORROW</span>
                              <span style={{fontSize:11,padding:"2px 9px",borderRadius:20,background:p.bg,color:p.c,border:`1px solid ${p.c}30`}}>{p.code}</span>
                              <span style={{fontSize:10,color:C.muted}}>{ev.id}</span>
                            </div>
                            <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>{ev.guest}</div>
                            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{ev.venue} · {ev.time} · <strong>{ev.pax} pax</strong> · Dispatch by {calcDispatch(ev.time)}</div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontSize:20,fontWeight:700,color:pct===100?C.green:C.amber}}>{pct}<span style={{fontSize:11}}>%</span></div>
                            <div style={{fontSize:9,color:C.muted}}>D−1 done</div>
                            <div style={{height:4,width:70,background:C.border,borderRadius:2,marginTop:4,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${pct}%`,background:pct===100?C.green:C.amber,borderRadius:2,transition:"width .3s"}}/>
                            </div>
                          </div>
                        </div>
                        {(ev.special||(ev.extras&&ev.extras.length>0))&&(
                          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                            {ev.special&&<div style={{fontSize:11,color:C.amber}}>⚠ <strong>Special:</strong> {ev.special}</div>}
                            {(ev.extras||[]).map((ex,i)=><span key={i} style={{fontSize:10,padding:"1px 8px",borderRadius:10,background:ex.type==="Chargeable"?C.amberBg:C.greenBg,color:ex.type==="Chargeable"?C.amber:C.green}}>{ex.item}{ex.type==="Chargeable"?` @₹${ex.rate}`:" (Free)"}</span>)}
                          </div>
                        )}
                        {/* Toggle D-1 plan */}
                        <button onClick={()=>setShowD1Plan(isExpanded?null:ev.id)}
                          style={{marginTop:10,padding:"6px 16px",borderRadius:8,background:isExpanded?C.amber:"transparent",color:isExpanded?"#fff":C.amber,border:`1.5px solid ${C.amber}`,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                          {isExpanded?"▲ Hide D−1 Checklist":"▼ Show D−1 Prep Checklist"}
                        </button>
                      </div>

                      {/* D-1 Checklist (expandable) */}
                      {isExpanded&&(
                        <div style={{padding:"14px 16px"}}>
                          <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:10}}>✅ D−1 Task Checklist — {doneCt}/{relevantTasks.length} done</div>
                          {relevantTasks.map(task=>{
                            const done = !!evD1[task.key];
                            return (
                              <div key={task.key} onClick={()=>toggleD1(task.key)}
                                style={{display:"flex",gap:10,padding:"10px 12px",marginBottom:6,borderRadius:9,border:`1.5px solid ${done?C.greenBorder:C.amberBorder}`,background:done?C.greenBg:"#FFFDF5",cursor:"pointer",alignItems:"flex-start"}}>
                                <div style={{width:20,height:20,borderRadius:4,border:`2px solid ${done?C.green:C.amber}`,background:done?C.green:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",marginTop:1}}>
                                  {done&&<span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>}
                                </div>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:12,fontWeight:600,color:done?C.green:C.text,textDecoration:done?"line-through":"none"}}>
                                    {task.icon} {task.label}
                                  </div>
                                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{task.desc}</div>
                                </div>
                              </div>
                            );
                          })}
                          {/* Menu by section for reference */}
                          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                            <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:8}}>📋 Menu Reference — {(ev.menu||[]).length} dishes</div>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                              {Object.entries(bySec).map(([sec,dishes])=>{
                                const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                                return (
                                  <div key={sec} style={{background:m.color+"0C",border:`1px solid ${m.color}25`,borderRadius:7,padding:"7px 9px"}}>
                                    <div style={{fontSize:10,fontWeight:700,color:m.color,marginBottom:4}}>{m.icon} {sec} ({dishes.length})</div>
                                    {dishes.slice(0,5).map((d,i)=><div key={i} style={{fontSize:9,color:C.text,padding:"1px 0"}}>{d}</div>)}
                                    {dishes.length>5&&<div style={{fontSize:9,color:C.muted}}>+{dishes.length-5} more</div>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {sorted.length===0&&(
              <div style={{textAlign:"center",padding:48,background:C.bg,borderRadius:14}}>
                <div style={{fontSize:36,marginBottom:12}}>📋</div>
                <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:6}}>No functions loaded</div>
                <div style={{fontSize:12,color:C.muted}}>Events are pre-loaded. Add more from Dashboard.</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ PREP TAB ═══ */}
      {tab==="prep"&&(
        <div>
          {sorted.length===0&&<div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,fontSize:13,color:C.muted}}>No functions yet. Add from Dashboard.</div>}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            {sorted.map(ev=>{
              const p=gp(ev.venue);const ed=Object.values(kt[ev.id]||{});const ep=pct(ed);const isT=ev.date===TODAY;const isM=ev.date===tmr;const act=selId===ev.id;
              return(
                <button key={ev.id} onClick={()=>setSelId(ev.id)} style={{padding:"6px 13px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:5,background:act?p.c:isT?p.bg:"transparent",color:act?"#fff":isT?p.c:C.muted,border:`1.5px solid ${act?p.c:isT?p.c:C.border}`}}>
                  <span>{ev.guest}</span>
                  {isT&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:8,background:act?"rgba(255,255,255,.3)":p.c,color:"#fff"}}>TODAY</span>}
                  {isM&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:8,background:C.amberBg,color:C.amber}}>TMRW</span>}
                  <span style={{fontSize:10,opacity:.8}}>{ep}%</span>
                </button>
              );
            })}
          </div>

          {selEv&&(
            <div>
              <div style={{background:C.surface,border:`2px solid ${gp(selEv.venue).c}`,borderRadius:12,padding:"11px 15px",marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>{selEv.guest}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{selEv.id} · {selEv.date} · {selEv.pax} pax</div></div>
                  <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:gp(selEv.venue).bg,color:gp(selEv.venue).c}}>{gp(selEv.venue).code}</span>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
                {[{l:"Prep",v:pct(evD),c:pct(evD)===100?C.green:C.wine,bg:pct(evD)===100?C.greenBg:C.wineBg,i:"🍳"},{l:"Dispatch",v:dpct(evD),c:C.blue,bg:C.blueBg,i:"🚛"},{l:"Delivered",v:lpct(evD),c:C.green,bg:C.greenBg,i:"✅"}].map(m=>(
                  <div key={m.l} style={{background:m.bg,borderRadius:11,padding:"12px 14px",textAlign:"center"}}>
                    <div style={{fontSize:10,marginBottom:2}}>{m.i}</div>
                    <div style={{fontSize:26,fontWeight:700,color:m.c,lineHeight:1.1}}>{m.v}<span style={{fontSize:12}}>%</span></div>
                    <div style={{fontSize:10,color:m.c,marginTop:2}}>{m.l}</div>
                    <div style={{height:4,background:"rgba(0,0,0,.07)",borderRadius:2,marginTop:7,overflow:"hidden"}}><div style={{height:"100%",width:`${m.v}%`,background:m.c,borderRadius:2}}/></div>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                {SECTIONS.map(sec=>{
                  const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};const sd=evD.filter(d=>d.section===sec);const sp=pct(sd);
                  return(
                    <div key={sec} onClick={()=>setSecFil(secFil===sec?"All":sec)} style={{background:secFil===sec?m.color+"18":C.surface,border:`1.5px solid ${secFil===sec?m.color:C.border}`,borderRadius:9,padding:"8px 11px",cursor:"pointer"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:11,fontWeight:600,color:C.text}}>{m.icon} {(sec||'').split(" ")[0]}</span><span style={{fontSize:12,fontWeight:700,color:sp===100?C.green:m.color}}>{sp}%</span></div>
                      <div style={{height:3,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${sp}%`,background:sp===100?C.green:m.color,borderRadius:2}}/></div>
                      <div style={{fontSize:9,color:C.muted,marginTop:3}}>{sd.filter(d=>dpish(d)===100).length}/{sd.length}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:7}}>{secFil==="All"?"All dishes":secFil}<span style={{fontWeight:400,color:C.muted,marginLeft:6}}>{filt.length} items</span>{secFil!=="All"&&<button onClick={()=>setSecFil("All")} style={{marginLeft:8,fontSize:10,color:C.wine,background:"none",border:"none",cursor:"pointer"}}>Clear</button>}</div>
              {filt.length===0?(
                <div style={{textAlign:"center",padding:20,background:C.bg,borderRadius:10,fontSize:12,color:C.muted}}>No dishes. Select a menu package when adding a function from Dashboard.</div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {filt.map(d=>{
                    const dp=dpish(d);const m=SECTION_META[d.section]||{color:C.muted};
                    return(
                      <div key={d.dId} style={{background:C.surface,border:`1px solid ${dp===100?C.greenBorder:C.border}`,borderRadius:9,padding:"10px 13px",display:"flex",gap:10,alignItems:"center"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                            <span style={{fontSize:12,fontWeight:600,color:C.text}}>{d.name}</span>
                            {d.dispatched&&<Chip label="🚛" color={C.blue} bg={C.blueBg} size={9}/>}
                            {d.delivered&&<Chip label="✅" color={C.green} bg={C.greenBg} size={9}/>}
                          </div>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <div style={{flex:1,height:5,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${dp}%`,background:dp===100?C.green:m.color,borderRadius:2}}/></div>
                            <span style={{fontSize:10,color:dp===100?C.green:C.muted,flexShrink:0}}>{(d.done||[]).length}/{(d.steps||GENERIC_STEPS).length}</span>
                            {d.chefName&&<span style={{fontSize:10,color:C.muted,flexShrink:0}}>👨‍🍳 {d.chefName}</span>}
                          </div>
                        </div>
                        <button onClick={()=>setModal({evId:selEv.id,dId:d.dId})} style={{padding:"6px 13px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",background:dp===100?C.greenBg:C.wineBg,color:dp===100?C.green:C.wine,flexShrink:0}}>{dp===100?"Done ✓":"Track →"}</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ PREP PLAN TAB ═══ */}
      {tab==="plan"&&(
        <PrepPlanTab evList={evList} kt={kt} lang={lang}/>
      )}

      {/* ═══ SOPs TAB ═══ */}
      {tab==="sops"&&(
        <div>
          <div style={{position:"relative",marginBottom:12}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.faint}}>🔍</span>
            <input value={srch} onChange={e=>{setSrch(e.target.value);if(e.target.value)setCatId(null);}} placeholder="Search recipes…" style={{width:"100%",padding:"8px 10px 8px 28px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,outline:"none",boxSizing:"border-box"}}/>
          </div>
          {srch.trim()&&(
            <div>
              {srchR.length===0&&<div style={{fontSize:12,color:C.muted,padding:10}}>No recipes found.</div>}
              {srchR.map((r,i)=>(
                <div key={i} onClick={()=>{setCatId(r.cat.id);setRIdx((RECIPE_DB.recipes[r.cat.id]||[]).findIndex(x=>x.n===r.n));setSrch("");setRStep(0);}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 13px",marginBottom:5,background:C.surface,borderRadius:9,border:`1px solid ${C.border}`,cursor:"pointer"}}>
                  <div><div style={{fontSize:12,fontWeight:600,color:C.text}}>{r.n}</div><div style={{fontSize:11,color:C.muted}}>{r.cat.n}</div></div>
                  <span style={{fontSize:18}}>{r.cat.ic}</span>
                </div>
              ))}
            </div>
          )}
          {!srch&&!catId&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {RECIPE_DB.cats.map(c=>(
                <div key={c.id} onClick={()=>{setCatId(c.id);setRIdx(0);setRStep(0);setSub("All");}} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:11,padding:"13px",cursor:"pointer"}}>
                  <div style={{fontSize:24,marginBottom:5}}>{c.ic}</div>
                  <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:2}}>{c.n}</div>
                  <div style={{fontSize:11,color:C.muted}}>{(RECIPE_DB.recipes[c.id]||[]).length} recipes</div>
                  <div style={{height:3,marginTop:7,borderRadius:2,background:c.ac||C.wine}}/>
                </div>
              ))}
            </div>
          )}
          {catId&&cat2&&!recipe&&(
            <div>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                <button onClick={()=>setCatId(null)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:C.muted}}>←</button>
                <div style={{fontSize:14,fontWeight:600,color:C.text}}>{cat2.ic} {cat2.n}</div>
              </div>
              {cat2.subs&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>{["All",...cat2.subs].map(s=><button key={s} onClick={()=>setSub(s)} style={{padding:"3px 10px",borderRadius:20,fontSize:11,cursor:"pointer",background:sub===s?(cat2.ac||C.wine):"transparent",color:sub===s?"#fff":C.muted,border:`1px solid ${sub===s?(cat2.ac||C.wine):C.border}`}}>{s}</button>)}</div>}
              {rList.map((r,i)=>(<div key={i} onClick={()=>{setRIdx(i);setRStep(0);}} style={{padding:"9px 13px",marginBottom:5,background:C.surface,borderRadius:9,border:`1px solid ${C.border}`,cursor:"pointer"}}><div style={{fontSize:12,fontWeight:600,color:C.text}}>{r.n}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{r.steps&&r.steps.length||0} steps</div></div>))}
            </div>
          )}
          {recipe&&curSt&&(
            <div>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                <button onClick={()=>setRIdx(-1)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:C.muted}}>←</button>
                <div style={{fontSize:14,fontWeight:600,color:C.text}}>{recipe.n}</div>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                {recipe.steps.map((_,si)=>(<button key={si} onClick={()=>setRStep(si)} style={{padding:"3px 11px",borderRadius:20,fontSize:11,cursor:"pointer",background:rStep===si?C.wine:C.bg,color:rStep===si?"#fff":C.muted,border:`1px solid ${rStep===si?C.wine:C.border}`}}>{si+1}</button>))}
              </div>
              <div style={{background:C.surface,border:`2px solid ${SCOL[curSt.tp]||C.wine}`,borderRadius:13,overflow:"hidden"}}>
                <div style={{background:SCOL[curSt.tp]||C.wine,padding:"11px 15px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:"#fff",fontWeight:600,fontSize:13}}>{curSt.t}</span>
                  {curSt.tm&&<span style={{fontSize:11,color:"rgba(255,255,255,.85)",background:"rgba(0,0,0,.15)",padding:"2px 8px",borderRadius:10}}>⏱ {Math.floor(curSt.tm/60)}m</span>}
                </div>
                <div style={{padding:"14px"}}>
                  <p style={{fontSize:12,color:C.text,lineHeight:1.6,margin:"0 0 10px"}}>{curSt.i}</p>
                  {curSt.ccp&&<div style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:7,padding:"7px 11px",fontSize:11,color:C.red,marginBottom:10}}>⚠ {curSt.ccp}</div>}
                  {curSt.g&&curSt.g.length>0&&(
                    <div style={{background:C.bg,borderRadius:8,padding:"8px 11px",marginBottom:10}}>
                      <div style={{fontSize:9,fontWeight:600,color:C.muted,marginBottom:5}}>INGREDIENTS — {selEv&&selEv.pax||4} pax</div>
                      {curSt.g.map((gi,ii)=>{const pts=gi.match(/^(.*?)\s+([\d.]+)\s*(\w+)?$/);if(pts){const[,nm,a,u]=pts;return<div key={ii} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"2px 0",borderBottom:`1px solid ${C.borderLight}`}}><span>{nm.trim()}</span><span style={{fontWeight:500,color:C.wine}}>{u?`${+(parseFloat(a)*scale).toFixed(1)}${u}`:`${Math.round(parseFloat(a)*scale)}`}</span></div>;}return<div key={ii} style={{fontSize:11,color:C.text,padding:"2px 0"}}>{gi}</div>;})}
                    </div>
                  )}
                  <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
                    <button onClick={()=>setRStep(s=>Math.max(0,s-1))} disabled={rStep===0} style={{padding:"6px 14px",borderRadius:8,fontSize:11,cursor:"pointer",background:C.bg,border:`1px solid ${C.border}`,color:C.muted,opacity:rStep===0?.4:1}}>← Prev</button>
                    {curSt.tm&&<button onClick={()=>{setTmSec(curSt.tm);setTmRun(true);}} style={{padding:"6px 14px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",background:tmRun?C.amber:C.wine,border:"none",color:"#fff"}}>{tmRun?ftm(tmSec):"▶ Timer"}</button>}
                    <button onClick={()=>setRStep(s=>Math.min(recipe.steps.length-1,s+1))} disabled={rStep===recipe.steps.length-1} style={{padding:"6px 14px",borderRadius:8,fontSize:11,cursor:"pointer",background:C.wine,border:"none",color:"#fff",opacity:rStep===recipe.steps.length-1?.4:1}}>Next →</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TRANSPORT HELPERS ───────────────────────────────────────────




// ─── TRANSPORT HELPERS ────────────────────────────────────────────
function calcDispatch(eventTime) {
  if(!eventTime) return "12:00 PM";
  try {
    const clean = String(eventTime).replace(/\s*(AM|PM)/i,"");
    let [h,m]   = clean.split(":").map(Number);
    const isPM  = /pm/i.test(eventTime);
    const isAM  = /am/i.test(eventTime);
    if(isPM && h!==12) h+=12;
    if(isAM && h===12) h=0;
    let dh=h-2, dm=(m||0)-30;
    if(dm<0){dm+=60;dh-=1;}
    if(dh<0) dh+=24;
    const suf=dh>=12?"PM":"AM";
    const h12=dh>12?dh-12:dh===0?12:dh;
    return `${h12}:${String(dm).padStart(2,"0")} ${suf}`;
  } catch(e){ return "12:00 PM"; }
}

function autoVehicles(ev) {
  const menu = Array.isArray(ev&&ev.menu)?ev.menu:[];
  const needsCold = menu.some(n=>/cream|chhena|paneer|kulfi|ice.cream|rabri|rasmalai|butter|dairy|mousse|cheesecake/i.test(n));
  const ids = ["DL1LAJ1250"];
  if(needsCold) ids.push("DL1LAN2125");
  return ids;
}

function makeManifest(ev, vehicleId) {
  const menu = Array.isArray(ev&&ev.menu)?ev.menu:[];
  const v    = (typeof VEHICLES!=="undefined"?VEHICLES:[]).find(x=>x.id===vehicleId)||{type:"dry"};
  const items = menu.map(name=>({id:name.replace(/\s+/g,"-").toLowerCase(),name,category:"🍽 Food",qty:1,packed:false}));
  if(v.type!=="cold"){
    items.push(
      {id:"chafing",  name:"Chafing dishes + stands", category:"🔧 Equipment", qty:1, packed:false},
      {id:"fuel",     name:"Fuel cans / sterno",       category:"🔧 Equipment", qty:1, packed:false},
      {id:"crockery", name:"Crockery & cutlery",       category:"🍽 Crockery",  qty:1, packed:false},
    );
  }
  return items;
}



function TransportDispatch({events, lang="en"}) {
  const T2 = s => T(s, lang||"en");
  const safeEvs = Array.isArray(events) ? events : [];
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

  const initDispatches = () => safeEvs.map(ev=>({
    evId:ev.id, evGuest:ev.guest, evDate:ev.date, evTime:ev.time, evVenue:ev.venue, menu:ev.menu||[],
    assignments: autoVehicles(ev).map(vid=>({
      vehicleId:vid, driver:"", dispatchTime:calcDispatch(ev.time), status:"Planning",
      manifest:makeManifest(ev,vid), loadingList:buildChecklist(ev,vid),
      unloadingList:buildChecklist(ev,vid).map(i=>({...i,id:"u-"+i.id,checked:false})),
    })),
  }));

  const [dispatches, setDispatches] = useState(initDispatches);
  const [selEvId,    setSelEvId]    = useState(safeEvs[0]?.id||null);
  const [activeTab,  setActiveTab]  = useState("dayview");
  const [selDate,    setSelDate]    = useState(safeEvs[0]?.date||"");
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
    setDispatches(p=>p.map(d=>d.evId!==evId?d:{...d,assignments:[...d.assignments,{vehicleId:vid,driver:"",dispatchTime:calcDispatch(ev?.time||""),status:"Planning",manifest:makeManifest(ev||{},vid),loadingList:buildChecklist(ev||{},vid),unloadingList:buildChecklist(ev||{},vid).map(i=>({...i,id:"u-"+i.id,checked:false}))}]}));
  }

  const allDates  = [...new Set(safeEvs.map(e=>e.date).filter(Boolean))].sort();
  const dayEvs    = safeEvs.filter(e=>e.date===selDate);
  const selDispatch = dispatches.find(d=>d.evId===selEvId)||null;

  const PROP = {
    "Ambria Pushpanjali":{code:"AP",c:"#6B1818",bg:"#FFF0F0"},
    "Ambria Exotica":    {code:"AE",c:"#854F0B",bg:"#FEF6E2"},
    "Manaktala Farm":    {code:"AM",c:"#B05A10",bg:"#FEF3E8"},
    "Ambria Restro":     {code:"AR",c:"#0F6E56",bg:"#E6F4F0"},
  };
  const gp = v => PROP[v]||{code:"EV",c:C.wine,bg:C.wineBg};

  const venues=[{name:"AP",lat:28.5921,lng:77.0460,color:"#6B1818"},{name:"AE",lat:28.5890,lng:77.0495,color:"#854F0B"},{name:"MKT",lat:28.5960,lng:77.0520,color:"#B05A10"},{name:"AR",lat:28.5902,lng:77.0440,color:"#0F6E56"}];
  const vehForMap=VEHICLES.map(v=>{const p=gps[v.id]||{lat:28.592,lng:77.047,status:"At Base",speed:0};return{id:v.id,name:v.name,icon:v.icon,lat:p.lat,lng:p.lng,status:p.status,speed:p.speed};});
  const mapHtml=`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"><script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><\/script><style>*{margin:0;padding:0;}html,body,#map{width:100%;height:100%;}</style></head><body><div id="map"></div><script>var map=L.map("map",{center:[28.592,77.047],zoom:15});L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap",maxZoom:19}).addTo(map);var venues=${JSON.stringify(venues)};venues.forEach(function(v){L.marker([v.lat,v.lng],{icon:L.divIcon({className:"",html:'<div style="background:'+v.color+';color:#fff;padding:4px 9px;border-radius:7px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid #fff">'+v.name+'<\/div>',iconAnchor:[18,14]})}).addTo(map).bindPopup(v.name);});var SC={"En Route":"#1B5EAB","At Venue":"#2B8A50","At Base":"#888"};var mk={};function render(vl){vl.forEach(function(v){var col=SC[v.status]||"#888";var lbl=v.icon+" "+v.id.slice(-6)+(v.speed>0?" · "+v.speed+"km/h":"");var html='<div style="background:'+col+';color:#fff;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4);border:1.5px solid #fff">'+lbl+'<\/div>';var ic=L.divIcon({className:"",html:html,iconAnchor:[30,12]});if(mk[v.id]){mk[v.id].setLatLng([v.lat,v.lng]);mk[v.id].setIcon(ic);}else{mk[v.id]=L.marker([v.lat,v.lng],{icon:ic}).addTo(map).bindPopup(v.name+"<br>"+v.status);}});}render(${JSON.stringify(vehForMap)});window.addEventListener("message",function(e){if(e.data&&e.data.type==="vehicles")render(e.data.vehicles);});<\/script></body></html>`;

  const TABS=[{v:"dayview",l:"📅 Day View"},{v:"gps",l:"🗺 Live Map"},{v:"dispatch",l:"🚛 Dispatch"},{v:"checklist",l:"📋 Load/Unload"},{v:"fleet",l:"🔧 Fleet"}];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>🚛 Transport & Dispatch</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>Fleet: {fleetList.length} vehicles · {safeEvs.length} events</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {[{c:"#1B5EAB",l:"En Route"},{c:"#2B8A50",l:"At Venue"},{c:"#888",l:"At Base"}].map(s=>(
            <div key={s.l} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 10px",background:"transparent",borderRadius:20,border:`1px solid ${s.c}40`}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:s.c}}/><span style={{fontSize:10,color:s.c,fontWeight:600}}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>
        {TABS.map(t=>(
          <button key={t.v} onClick={()=>setActiveTab(t.v)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",background:activeTab===t.v?C.wine:"transparent",color:activeTab===t.v?"#fff":C.muted,border:`1.5px solid ${activeTab===t.v?C.wine:C.border}`}}>{t.l}</button>
        ))}
      </div>

      {activeTab==="dayview"&&(
        <div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
            <span style={{fontSize:11,fontWeight:600,color:C.muted}}>Date:</span>
            {allDates.map(d=>(
              <button key={d} onClick={()=>setSelDate(d)} style={{padding:"4px 12px",borderRadius:20,fontSize:11,cursor:"pointer",background:selDate===d?C.wine:C.bg,color:selDate===d?"#fff":C.muted,border:`1px solid ${selDate===d?C.wine:C.border}`}}>{d}</button>
            ))}
            {allDates.length===0&&<span style={{fontSize:12,color:C.faint}}>No events loaded.</span>}
          </div>
          {dayEvs.map(ev=>{
            const dispatch=dispatches.find(d=>d.evId===ev.id)||{assignments:[]};
            const p=gp(ev.venue);
            return (
              <Card key={ev.id} style={{marginBottom:12,padding:"14px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.text}}>{ev.guest}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{ev.date} · {ev.time} · {ev.pax} pax · {ev.id}</div>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:p.bg,color:p.c}}>{p.code}</span>
                </div>
                {dispatch.assignments.map((asgn,ai)=>{
                  const v=fleetList.find(x=>x.id===asgn.vehicleId)||{name:asgn.vehicleId,icon:"🚛",type:"dry"};
                  const tc=VCOL[v.type]||C.muted;
                  return (
                    <div key={ai} style={{background:C.bg,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:18}}>{v.icon}</span>
                          <div>
                            <div style={{fontSize:12,fontWeight:600,color:C.text}}>{v.name}</div>
                            <div style={{fontSize:10,color:tc,fontWeight:500}}>{v.type==="cold"?"❄ Cold chain":"Dry load"}</div>
                          </div>
                        </div>
                        <select value={asgn.status} onChange={e=>updAsgn(ev.id,ai,"status",e.target.value)} style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,color:C.text,background:C.surface}}>
                          {["Planning","Loaded","Dispatched","At Venue","Returned"].map(s=><option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div>
                          <div style={{fontSize:9,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>Driver</div>
                          <input value={asgn.driver} onChange={e=>updAsgn(ev.id,ai,"driver",e.target.value)} placeholder="Driver name" style={{width:"100%",padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,boxSizing:"border-box",background:C.surface}}/>
                        </div>
                        <div>
                          <div style={{fontSize:9,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>Dispatch Time</div>
                          <input value={asgn.dispatchTime} onChange={e=>updAsgn(ev.id,ai,"dispatchTime",e.target.value)} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,boxSizing:"border-box",background:C.surface}}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button onClick={()=>addVehicle(ev.id)} style={{padding:"5px 12px",borderRadius:7,background:"none",border:`1px dashed ${C.border}`,fontSize:11,color:C.muted,cursor:"pointer"}}>+ Add Vehicle</button>
              </Card>
            );
          })}
          {dayEvs.length===0&&selDate&&<div style={{textAlign:"center",padding:28,background:C.bg,borderRadius:10,fontSize:12,color:C.muted}}>No events on {selDate}</div>}
        </div>
      )}

      {activeTab==="gps"&&(
        <div>
          <Card style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>🗺 Live Fleet Map — Dwarka / Kapasher, Delhi</div>
              <span style={{fontSize:10,color:C.muted}}>OpenStreetMap · 4s updates</span>
            </div>
            <iframe ref={mapIframeRef} srcDoc={mapHtml} style={{width:"100%",height:420,border:"none",display:"block"}} title="Fleet Map" sandbox="allow-scripts"/>
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:10}}>
            {VEHICLES.map(v=>{
              const p=gps[v.id]||{status:"Unknown",speed:0,lastUpdate:"—"};
              const sc=p.status==="En Route"?C.blue:p.status==="At Venue"?C.green:C.muted;
              return (
                <div key={v.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px"}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:16}}>{v.icon}</span>
                    <div style={{fontSize:10,fontWeight:600,color:C.text}}>{v.name}</div>
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:sc}}>{p.status}</div>
                  {p.speed>0&&<div style={{fontSize:10,color:C.muted}}>{p.speed} km/h</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab==="dispatch"&&(
        <div>
          {dispatches.length===0&&<div style={{textAlign:"center",padding:28,background:C.bg,borderRadius:10,fontSize:12,color:C.muted}}>No events loaded.</div>}
          {dispatches.map(d=>(
            <div key={d.evId} style={{marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8,fontFamily:"Georgia,serif"}}>{d.evGuest} · {d.evDate} · {d.evTime}</div>
              <div style={{border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 100px 110px 100px",background:C.bg,padding:"6px 14px",borderBottom:`1px solid ${C.border}`}}>
                  {["Vehicle","Driver","Dispatch","Status"].map(h=><div key={h} style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>{h}</div>)}
                </div>
                {d.assignments.map((a,ai)=>{
                  const v=fleetList.find(x=>x.id===a.vehicleId)||{name:a.vehicleId,icon:"🚛"};
                  return (
                    <div key={ai} style={{display:"grid",gridTemplateColumns:"1fr 100px 110px 100px",padding:"8px 14px",borderBottom:`1px solid ${C.borderLight}`,alignItems:"center"}}>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}><span>{v.icon}</span><span style={{fontSize:12,color:C.text}}>{v.name}</span></div>
                      <div style={{fontSize:11,color:C.text}}>{a.driver||"—"}</div>
                      <div style={{fontSize:11,fontWeight:600,color:C.wine}}>{a.dispatchTime}</div>
                      <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:C.wineBg,color:C.wine}}>{a.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab==="checklist"&&(
        <div>
          {/* Event selector */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {safeEvs.map(ev=>(
              <button key={ev.id} onClick={()=>setSelEvId(ev.id)} style={{padding:"5px 12px",borderRadius:20,fontSize:11,cursor:"pointer",background:selEvId===ev.id?C.wine:C.bg,color:selEvId===ev.id?"#fff":C.muted,border:`1px solid ${selEvId===ev.id?C.wine:C.border}`}}>{ev.guest}</button>
            ))}
            {safeEvs.length===0&&<span style={{fontSize:12,color:C.faint}}>No events loaded.</span>}
          </div>

          {selDispatch&&(()=>{
            const ev=safeEvs.find(e=>e.id===selEvId);
            const PROP={"Ambria Pushpanjali":{code:"AP",c:"#6B1818",bg:"#FFF0F0"},"Ambria Exotica":{code:"AE",c:"#854F0B",bg:"#FEF6E2"},"Manaktala Farm":{code:"AM",c:"#B05A10",bg:"#FEF3E8"},"Ambria Restro":{code:"AR",c:"#0F6E56",bg:"#E6F4F0"}};
            const p=PROP[ev?.venue]||{code:"EV",c:C.wine,bg:C.wineBg};
            const bySec={};
            (ev?.menu||[]).forEach(n=>{const s=guessSectionForDish(n);if(!bySec[s])bySec[s]=[];bySec[s].push(n);});

            // Build a SET of all items dispatched by OTHER trucks (for this event)
            // An item is "already dispatched" if it's checked in a DIFFERENT vehicle's loadingList
            function getDispatchedByOthers(myAi) {
              const dispatched = new Set();
              selDispatch.assignments.forEach((a,ai)=>{
                if(ai===myAi) return;
                a.loadingList.forEach(item=>{if(item.checked) dispatched.add(item.name.toLowerCase().trim());});
              });
              return dispatched;
            }

            return (
              <div>
                {/* FP Card */}
                <div style={{background:p.bg,border:`2px solid ${p.c}20`,borderRadius:12,padding:"10px 14px",marginBottom:12}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.text}}>{selDispatch.evGuest}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{selDispatch.evId} · {selDispatch.evDate} · {selDispatch.evTime} · {ev?.pax} pax</div>
                  {ev?.special&&<div style={{fontSize:11,color:C.amber,marginTop:4}}>⚠ {ev.special}</div>}
                </div>

                {/* FP Menu by section */}
                {(ev?.menu||[]).length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>📋 FP Menu — {(ev?.menu||[]).length} dishes</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                      {Object.entries(bySec).map(([sec,dishes])=>{
                        const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                        return (
                          <div key={sec} style={{background:m.color+"0C",border:`1px solid ${m.color}25`,borderRadius:8,padding:"8px 10px"}}>
                            <div style={{fontSize:10,fontWeight:700,color:m.color,marginBottom:4}}>{m.icon} {sec} ({dishes.length})</div>
                            {dishes.map((d,i)=><div key={i} style={{fontSize:10,color:C.text,padding:"1px 0"}}>{d}</div>)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Per-truck checklists with individual search */}
                {selDispatch.assignments.map((asgn,ai)=>{
                  const v=fleetList.find(x=>x.id===asgn.vehicleId)||{name:asgn.vehicleId,icon:"🚛"};
                  const dispatchedByOthers=getDispatchedByOthers(ai);
                  const [truckSrch,setTruckSrch]=[null,null]; // placeholder — use DOM approach

                  const loadDone  = asgn.loadingList.filter(i=>i.checked).length;
                  const unloadDone= asgn.unloadingList.filter(i=>i.checked).length;

                  return (
                    <div key={ai} style={{marginBottom:16,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                      {/* Truck header */}
                      <div style={{padding:"10px 14px",background:C.bg,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:18}}>{v.icon}</span>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:C.text}}>{v.name}</div>
                            <div style={{fontSize:10,color:C.muted}}>Dispatch: {asgn.dispatchTime} · Driver: {asgn.driver||"—"} · {asgn.status}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:14}}>
                          <div style={{textAlign:"center"}}>
                            <div style={{fontSize:14,fontWeight:700,color:loadDone===asgn.loadingList.length&&asgn.loadingList.length>0?C.green:C.amber}}>{loadDone}/{asgn.loadingList.length}</div>
                            <div style={{fontSize:9,color:C.muted}}>Loaded</div>
                          </div>
                          <div style={{textAlign:"center"}}>
                            <div style={{fontSize:14,fontWeight:700,color:unloadDone===asgn.unloadingList.length&&asgn.unloadingList.length>0?C.green:C.muted}}>{unloadDone}/{asgn.unloadingList.length}</div>
                            <div style={{fontSize:9,color:C.muted}}>Unloaded</div>
                          </div>
                        </div>
                      </div>

                      {/* Per-truck search box */}
                      <div style={{padding:"8px 14px",borderBottom:`1px solid ${C.borderLight}`,background:"#FAFAFA"}}>
                        <input
                          placeholder={`🔍 Search items in ${v.name}…`}
                          onChange={e=>{
                            const q=e.target.value.toLowerCase();
                            const container=e.target.closest("div").nextSibling;
                            if(container) container.querySelectorAll("[data-item]").forEach(row=>{
                              row.style.display=(!q||row.getAttribute("data-item").toLowerCase().includes(q))?"":"none";
                            });
                          }}
                          style={{width:"100%",padding:"6px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}
                        />
                      </div>

                      {/* Loading + Unloading side by side */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
                        {[
                          {key:"loadingList",  title:"📦 Loading",   sub:"Kitchen → Truck",  done:loadDone,   tot:asgn.loadingList.length},
                          {key:"unloadingList",title:"✅ Unloading", sub:"Truck → Venue",    done:unloadDone, tot:asgn.unloadingList.length},
                        ].map((list,li)=>(
                          <div key={list.key} style={{borderRight:li===0?`1px solid ${C.border}`:"none"}}>
                            <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",background:list.done===list.tot&&list.tot>0?C.greenBg:C.bg}}>
                              <div>
                                <div style={{fontSize:11,fontWeight:600,color:C.text}}>{list.title}</div>
                                <div style={{fontSize:9,color:C.muted}}>{list.sub}</div>
                              </div>
                              <div style={{textAlign:"right"}}>
                                <span style={{fontSize:12,fontWeight:700,color:list.done===list.tot&&list.tot>0?C.green:C.muted}}>{list.done}/{list.tot}</span>
                                {/* Progress bar */}
                                <div style={{height:3,width:50,background:C.border,borderRadius:2,overflow:"hidden",marginTop:3}}>
                                  <div style={{height:"100%",width:`${list.tot?Math.round(list.done/list.tot*100):0}%`,background:list.done===list.tot&&list.tot>0?C.green:C.wine,borderRadius:2}}/>
                                </div>
                              </div>
                            </div>
                            <div style={{maxHeight:300,overflowY:"auto"}}>
                              {asgn[list.key].map((item,ii)=>{
                                const alreadyDone = list.key==="loadingList" && dispatchedByOthers.has(item.name.toLowerCase().trim());
                                return (
                                  <div key={ii} data-item={item.name}
                                    onClick={()=>!alreadyDone&&toggleCheck(selEvId,ai,list.key,ii)}
                                    style={{display:"flex",gap:7,padding:"7px 12px",borderBottom:`1px solid ${C.borderLight}`,cursor:alreadyDone?"default":"pointer",
                                      background:alreadyDone?"#F0F4FF":item.checked?"#F0FAF4":"transparent",alignItems:"center",opacity:alreadyDone?.7:1}}>
                                    {alreadyDone?(
                                      <div style={{width:16,height:16,borderRadius:3,background:"#1B5EAB",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                        <span style={{color:"#fff",fontSize:9,fontWeight:700}}>↗</span>
                                      </div>
                                    ):(
                                      <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${item.checked?C.green:C.border}`,background:item.checked?C.green:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                        {item.checked&&<span style={{color:"#fff",fontSize:9,fontWeight:700}}>✓</span>}
                                      </div>
                                    )}
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:11,color:alreadyDone?"#1B5EAB":C.text,textDecoration:item.checked?"line-through":"none",opacity:item.checked?.6:1,fontStyle:alreadyDone?"italic":"normal"}}>
                                        {item.name}
                                      </div>
                                      <div style={{fontSize:9,color:alreadyDone?"#1B5EAB":C.muted}}>
                                        {item.category}{item.cold?" · ❄":""}{alreadyDone?" · ✓ Already dispatched by another truck":""}
                                      </div>
                                    </div>
                                    {item.cold&&!item.checked&&!alreadyDone&&<span style={{fontSize:11}}>❄</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}


      {activeTab==="fleet"&&(
        <div>
          {delVehId&&(
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{background:C.surface,borderRadius:14,padding:"24px 28px",maxWidth:340,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>🗑</div>
                <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>Remove {fleetList.find(v=>v.id===delVehId)?.name}?</div>
                <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                  <Btn onClick={()=>{setFleetList(p=>p.filter(v=>v.id!==delVehId));setDelVehId(null);}} color={C.red} style={{fontSize:12,padding:"7px 18px"}}>Remove</Btn>
                  <Btn onClick={()=>setDelVehId(null)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
                </div>
              </div>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text}}>Fleet — {fleetList.length} vehicles</div>
            <Btn onClick={()=>{setVehForm({id:"",name:"",icon:"🚛",type:"dry",note:""});setShowAddVeh(true);setEditVehId(null);}} color={C.wine} style={{fontSize:12,padding:"6px 14px"}}>+ Add Vehicle</Btn>
          </div>
          {(showAddVeh||editVehId)&&(
            <div style={{background:C.wineBg,border:`1px solid ${C.wineBorder}`,borderRadius:12,padding:"12px 14px",marginBottom:12}}>
              <div style={{display:"grid",gridTemplateColumns:"120px 1fr 60px 1fr 1fr",gap:8,marginBottom:8}}>
                {[{l:"Reg. No.",k:"id",ph:"DL1LAJ1250"},{l:"Name",k:"name",ph:"e.g. DL1LAJ 1250"},{l:"Icon",k:"icon",ph:"🚛"}].map(f=>(
                  <div key={f.k}>
                    <div style={{fontSize:9,color:C.wine,marginBottom:2,textTransform:"uppercase"}}>{f.l}</div>
                    <input value={vehForm[f.k]} onChange={e=>setVehForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph}
                      style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${C.wineBorder}`,fontSize:11,background:C.surface,boxSizing:"border-box"}}/>
                  </div>
                ))}
                <div>
                  <div style={{fontSize:9,color:C.wine,marginBottom:2,textTransform:"uppercase"}}>Type</div>
                  <select value={vehForm.type} onChange={e=>setVehForm(p=>({...p,type:e.target.value}))} style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${C.wineBorder}`,fontSize:11,background:C.surface}}>
                    <option value="dry">🚛 Dry/Open</option><option value="cold">❄ Cold Chain</option><option value="quick">🛺 Quick/Small</option>
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9,color:C.wine,marginBottom:2,textTransform:"uppercase"}}>Note</div>
                  <input value={vehForm.note} onChange={e=>setVehForm(p=>({...p,note:e.target.value}))} placeholder="Route / capacity…"
                    style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${C.wineBorder}`,fontSize:11,background:C.surface,boxSizing:"border-box"}}/>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={()=>{
                  if(!vehForm.id||!vehForm.name) return;
                  if(editVehId) setFleetList(p=>p.map(v=>v.id!==editVehId?v:{...vehForm}));
                  else setFleetList(p=>[...p,{...vehForm}]);
                  setShowAddVeh(false); setEditVehId(null);
                }} color={C.wine} style={{fontSize:12,padding:"6px 16px"}}>{editVehId?"Save":"Add"}</Btn>
                <Btn onClick={()=>{setShowAddVeh(false);setEditVehId(null);}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
              </div>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {fleetList.map((v,i)=>{
              const ti={dry:{c:"#C07010",bg:"#FEF6E8",l:"Dry/Open"},cold:{c:"#185FA5",bg:"#EEF4FD",l:"Cold Chain"},quick:{c:"#2B8A50",bg:"#EDF7F2",l:"Quick"}}[v.type]||{c:C.muted,bg:C.bg,l:v.type};
              const pos=gps[v.id]||{status:"—",speed:0};
              return (
                <div key={v.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{width:38,height:38,borderRadius:9,background:ti.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{v.icon}</div>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:C.text}}>{v.name}</div>
                        <div style={{fontSize:10,fontWeight:600,color:ti.c}}>{ti.l}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>{setVehForm({...v});setEditVehId(v.id);setShowAddVeh(false);}} style={{padding:"3px 7px",borderRadius:5,background:C.bg,border:`1px solid ${C.border}`,fontSize:10,cursor:"pointer"}}>Edit</button>
                      <button onClick={()=>setDelVehId(v.id)} style={{padding:"3px 6px",borderRadius:5,fontSize:10,cursor:"pointer",background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red}}>🗑</button>
                    </div>
                  </div>
                  <div style={{fontSize:10,color:pos.status==="En Route"?C.blue:pos.status==="At Venue"?C.green:C.muted,fontWeight:600}}>{pos.status}{pos.speed>0?` · ${pos.speed}km/h`:""}</div>
                  {v.note&&<div style={{fontSize:10,color:C.muted,marginTop:4,lineHeight:1.4}}>{v.note}</div>}
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
  const [odcs]=useState([{id:"ODC-2025-01",guest:"Malhotra Wedding",date:"2025-06-22",time:"7:30 PM",pax:800,distance:"12 km",special:"Generator required.",checks:{site:{},equipment:{},dispatch:{},onsite:{},teardown:{}},notes:"",inchargeAE:"Raghvendra"}]);
  const [sel]=useState("ODC-2025-01");
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
      <div style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:4,fontFamily:"Georgia,serif"}}>🏕 Outdoor Catering</div>
      <div style={{background:C.wineBg,border:`1.5px solid ${C.wineBorder}`,borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
        <Avatar name="Gopal" size={36} index={0}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.wine}}>Gopal — ODC Lead</div><div style={{fontSize:11,color:C.wine,opacity:.8}}>On ODC day venue rounds suspended.</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:10,color:C.muted}}>AP Anchor</div><div style={{fontSize:12,fontWeight:600,color:C.text}}>Yatender</div></div>
      </div>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
          <div><div style={{fontSize:15,fontWeight:700,color:C.text}}>{odc.guest}</div><div style={{fontSize:11,color:C.muted}}>{odc.date} · {odc.time} · {odc.pax} pax · {odc.distance}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:700,color:C.wine}}>{overallPct}%</div><div style={{fontSize:9,color:C.muted}}>overall</div></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div style={{background:C.wineBg,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:9,color:C.wine,fontWeight:600}}>LEAD</div><div style={{fontSize:12,fontWeight:600,color:C.wine}}>Gopal</div></div>
          <div style={{background:C.amberBg,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:9,color:C.amber,fontWeight:600}}>AE IN-CHARGE</div><div style={{fontSize:12,fontWeight:600,color:C.amber}}>{odc.inchargeAE}</div></div>
        </div>
        <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
          {Object.keys(ODC_CL).map(p=>{const p2=pct(p);const col=PC[p];const active=phase===p;return(
            <button key={p} onClick={()=>setPhase(p)} style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",background:active?col:"transparent",color:active?"#fff":C.muted,border:`1.5px solid ${active?col:C.border}`,display:"flex",alignItems:"center",gap:3}}>
              {ODC_PL[p]}<span style={{fontSize:9,padding:"1px 5px",borderRadius:10,background:active?"rgba(255,255,255,.25)":p2===100?C.greenBg:C.bg,color:active?"#fff":p2===100?C.green:C.muted}}>{p2}%</span>
            </button>
          );})}
        </div>
        <div style={{height:4,background:C.border,borderRadius:2,marginBottom:10,overflow:"hidden"}}><div style={{height:"100%",width:`${pct(phase)}%`,background:PC[phase],borderRadius:2,transition:"width .3s"}}/></div>
        {ODC_CL[phase].map(item=>{const done=!!checks[`${phase}-${item.id}`];return(
          <label key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer"}}>
            <input type="checkbox" checked={done} onChange={()=>toggle(phase,item.id)} style={{width:16,height:16,accentColor:PC[phase],cursor:"pointer"}}/>
            <span style={{fontSize:12,color:done?C.muted:C.text,textDecoration:done?"line-through":"none",flex:1}}>{item.label}</span>
            {done&&<Chip label="✓" color={C.green} bg={C.greenBg} size={10}/>}
          </label>
        );})}
        <div style={{marginTop:10}}><div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:4}}>Field notes</div><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Site observations…" style={{width:"100%",padding:"8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,resize:"none",height:60,fontFamily:"inherit",color:C.text,background:C.surface,boxSizing:"border-box"}}/></div>
      </Card>
    </div>
  );
}

// ─── EQUIPMENT & STORE ───────────────────────────────────────────


function StoreModule({events, lang="en"}) {
  const T2 = s => T(s, lang||"en");
  const safeEvs = (Array.isArray(events)?events:[]).filter(e=>e&&e.date);
  const CATEGORIES = ["Crockery & Cutlery","Equipment","Packaging","Consumables","Chemicals & Hygiene","Dry Goods","Beverages Stock"];

  const INIT = [
    {id:"cr01",name:"Dinner Plates (10 inch)",    cat:"Crockery & Cutlery",unit:"pcs",  inStock:480,minStock:200,perPax:1.1,location:"Store A"},
    {id:"cr02",name:"Side Plates (7 inch)",       cat:"Crockery & Cutlery",unit:"pcs",  inStock:320,minStock:150,perPax:0.8,location:"Store A"},
    {id:"cr03",name:"Soup Bowls",                 cat:"Crockery & Cutlery",unit:"pcs",  inStock:200,minStock:100,perPax:0.5,location:"Store A"},
    {id:"cr04",name:"Dinner Forks",               cat:"Crockery & Cutlery",unit:"pcs",  inStock:600,minStock:200,perPax:1.2,location:"Store A"},
    {id:"cr05",name:"Dinner Spoons",              cat:"Crockery & Cutlery",unit:"pcs",  inStock:600,minStock:200,perPax:1.2,location:"Store A"},
    {id:"cr06",name:"Water Glasses",              cat:"Crockery & Cutlery",unit:"pcs",  inStock:500,minStock:200,perPax:1.2,location:"Store A"},
    {id:"cr07",name:"Dessert Spoons",             cat:"Crockery & Cutlery",unit:"pcs",  inStock:400,minStock:150,perPax:1.0,location:"Store A"},
    {id:"eq01",name:"Chafing Dishes (full)",      cat:"Equipment",         unit:"pcs",  inStock:45, minStock:20, perPax:0,  location:"Store B"},
    {id:"eq02",name:"Fuel Cans (sterno)",         cat:"Equipment",         unit:"pcs",  inStock:120,minStock:50, perPax:0,  location:"Store B"},
    {id:"eq03",name:"Serving Ladles",             cat:"Equipment",         unit:"pcs",  inStock:60, minStock:25, perPax:0,  location:"Store B"},
    {id:"eq04",name:"LPG Cylinders",              cat:"Equipment",         unit:"pcs",  inStock:8,  minStock:4,  perPax:0,  location:"Store B"},
    {id:"eq05",name:"Water Cans (20L)",           cat:"Equipment",         unit:"pcs",  inStock:20, minStock:10, perPax:0,  location:"Store B"},
    {id:"pk01",name:"Foil Containers (650ml)",    cat:"Packaging",         unit:"pcs",  inStock:800,minStock:300,perPax:0,  location:"Store C"},
    {id:"pk02",name:"Foil Lids",                  cat:"Packaging",         unit:"pcs",  inStock:800,minStock:300,perPax:0,  location:"Store C"},
    {id:"pk03",name:"Cling Wrap (rolls)",         cat:"Packaging",         unit:"rolls",inStock:15, minStock:5,  perPax:0,  location:"Store C"},
    {id:"cs01",name:"Tissue Rolls",               cat:"Consumables",       unit:"rolls",inStock:60, minStock:20, perPax:0.1,location:"Store C"},
    {id:"cs02",name:"Disposable Gloves (box)",    cat:"Consumables",       unit:"boxes",inStock:30, minStock:10, perPax:0,  location:"Store C"},
    {id:"ch01",name:"Dishwash Liquid (5L)",       cat:"Chemicals & Hygiene",unit:"cans",inStock:8,  minStock:3,  perPax:0,  location:"Store D"},
    {id:"ch02",name:"Sanitizer (1L)",             cat:"Chemicals & Hygiene",unit:"btls",inStock:12, minStock:5,  perPax:0,  location:"Store D"},
    {id:"ch03",name:"Dustbin Bags (large)",       cat:"Chemicals & Hygiene",unit:"rolls",inStock:20,minStock:8,  perPax:0,  location:"Store D"},
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
          const det=new window.BarcodeDetector({formats:["ean_13","ean_8","qr_code","code_128","upc_a"]});
          function detect(){
            if(!scanVideoRef.current||!scanStreamRef.current) return;
            det.detect(scanVideoRef.current).then(codes=>{
              if(codes.length>0){setScanResult(codes[0].rawValue);setNewItem(p=>({...p,barcode:codes[0].rawValue}));stopScan();}
              else scanAnimRef.current=requestAnimationFrame(detect);
            }).catch(()=>{scanAnimRef.current=requestAnimationFrame(detect);});
          }
          scanAnimRef.current=requestAnimationFrame(detect);
        } else { setScanError("Barcode scanning not supported. Enter manually."); }
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
    const ms=!search.trim()||i.name.toLowerCase().includes(search.toLowerCase())||(i.barcode||"").includes(search)||(i.brand||"").toLowerCase().includes(search.toLowerCase());
    return mc&&ms;
  });

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>🧯 Equipment & Store</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>Inventory · Orders · Auto-requirements from events</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)} color={showAdd?C.muted:C.wine} style={{fontSize:12,padding:"7px 16px"}}>{showAdd?"✕ Cancel":"+ Add Item"}</Btn>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {[
          {l:T2("Total Items"),   v:items.length,                                    c:C.wine, bg:C.wineBg, i:"📦"},
          {l:T2("Low / Out"),     v:items.filter(i=>i.inStock<=i.minStock).length,   c:C.red,  bg:C.redBg,  i:"⚠️"},
          {l:T2("Pending Orders"),v:orders.filter(o=>o.status==="Ordered").length,   c:C.amber,bg:C.amberBg,i:"🛒"},
          {l:T2("Upcoming Events"),v:upcoming.length,                                c:C.blue, bg:C.blueBg, i:"📅"},
        ].map(m=>(
          <div key={m.l} style={{background:m.bg,borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:20,marginBottom:3}}>{m.i}</div>
            <div style={{fontSize:22,fontWeight:700,color:m.c,lineHeight:1.1}}>{m.v}</div>
            <div style={{fontSize:10,color:m.c,opacity:.8,marginTop:2}}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAdd&&(
        <div style={{background:C.wineBg,border:`1px solid ${C.wineBorder}`,borderRadius:12,padding:"14px 18px",marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:C.wine,marginBottom:10}}>📦 Add New Inventory Item</div>
          {/* Scanner */}
          <div style={{background:"rgba(107,24,24,.06)",borderRadius:9,padding:"9px 12px",marginBottom:10,border:`1px dashed ${C.wineBorder}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:scanning?8:0}}>
              <div><div style={{fontSize:11,fontWeight:600,color:C.wine}}>📷 Scan Barcode</div><div style={{fontSize:10,color:C.muted}}>Point camera at barcode · or enter manually below</div></div>
              {!scanning?<button onClick={startScan} style={{padding:"5px 12px",borderRadius:7,background:C.wine,color:"#fff",border:"none",fontSize:11,fontWeight:600,cursor:"pointer"}}>📷 Scan</button>
                        :<button onClick={stopScan}  style={{padding:"5px 10px",borderRadius:7,background:C.red, color:"#fff",border:"none",fontSize:11,fontWeight:600,cursor:"pointer"}}>✕</button>}
            </div>
            {scanning&&<video ref={scanVideoRef} autoPlay playsInline muted style={{width:"100%",maxHeight:160,borderRadius:7,objectFit:"cover",background:"#000",display:"block"}}/>}
            {scanResult&&<div style={{marginTop:5,fontSize:11,fontWeight:600,color:C.green}}>✓ Scanned: {scanResult}</div>}
            {scanError&&<div style={{marginTop:4,fontSize:10,color:C.amber}}>{scanError}</div>}
          </div>
          {/* Fields */}
          <div style={{marginBottom:7}}>
            <div style={{fontSize:9,color:C.wine,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>Item Name *</div>
            <input value={newItem.name} onChange={e=>setNewItem(p=>({...p,name:e.target.value}))} placeholder="e.g. Dinner Plates (10 inch)" style={{...fld,fontSize:12}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:7}}>
            {[{l:"Barcode",k:"barcode",ph:"Auto or manual"},{l:"Brand",k:"brand",ph:"Brand name"},{l:"Supplier",k:"supplier",ph:"Supplier name"}].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:9,color:C.wine,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>{f.l}</div>
                <input value={newItem[f.k]||""} onChange={e=>setNewItem(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={fld}/>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 80px 110px",gap:8,marginBottom:10}}>
            <div>
              <div style={{fontSize:9,color:C.wine,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>Category</div>
              <select value={newItem.cat} onChange={e=>setNewItem(p=>({...p,cat:e.target.value}))} style={fld}>
                {CATEGORIES.map(ct=><option key={ct}>{ct}</option>)}
              </select>
            </div>
            {[{l:"Unit",k:"unit",ph:"pcs"},{l:"In Stock",k:"inStock",t:"number"},{l:"Min Stock",k:"minStock",t:"number"},{l:"Per Pax",k:"perPax",t:"number"},{l:"Location",k:"location",ph:"Store A"}].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:9,color:C.wine,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>{f.l}</div>
                <input type={f.t||"text"} value={newItem[f.k]||""} onChange={e=>setNewItem(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph||"0"} style={fld}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>{setShowAdd(false);stopScan();setScanResult("");setScanError("");}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
            <Btn onClick={addItem} color={C.wine} style={{fontSize:12,padding:"8px 20px"}}>✓ Add to Inventory</Btn>
          </div>
        </div>
      )}

      {/* Order modal */}
      {showOrder&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.surface,borderRadius:14,padding:"24px 28px",width:340}}>
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
      <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>
        {[{v:"inventory",l:T2("📦 Inventory")},{v:"orders",l:T2("🛒 Orders")},{v:"requirements",l:T2("📋 Event Requirements")}].map(t=>(
          <button key={t.v} onClick={()=>setTab(t.v)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",background:tab===t.v?C.wine:"transparent",color:tab===t.v?"#fff":C.muted,border:`1.5px solid ${tab===t.v?C.wine:C.border}`}}>{lang==="hi"&&t.hi?t.hi:t.l}</button>
        ))}
      </div>

      {/* ── INVENTORY ── */}
      {tab==="inventory"&&(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search by name, barcode, brand…"
              style={{flex:1,minWidth:160,padding:"7px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
            <select value={catFil} onChange={e=>setCatFil(e.target.value)} style={{padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}>
              <option value="All">All Categories</option>
              {CATEGORIES.map(ct=><option key={ct}>{ct}</option>)}
            </select>
          </div>
          <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 80px 80px 90px 80px",background:C.bg,padding:"7px 14px",borderBottom:`1px solid ${C.border}`}}>
              {["Item",T2("Category"),"In Stock","Min","Status","Order"].map(h=><div key={h} style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>{h}</div>)}
            </div>
            {filteredItems.map((item,idx)=>{
              const low=item.inStock<=item.minStock;
              const out=item.inStock<=0;
              const sc=out?C.red:low?C.amber:C.green;
              const sb=out?C.redBg:low?C.amberBg:C.greenBg;
              return (
                <div key={item.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 80px 80px 90px 80px",padding:"8px 14px",borderBottom:`1px solid ${C.borderLight}`,alignItems:"center",background:idx%2===0?C.surface:"#FAFAFA"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:500,color:C.text}}>{item.name}</div>
                    <div style={{fontSize:9,color:C.muted}}>{item.location||"—"}{item.barcode?" · "+item.barcode:""}{item.brand?" · "+item.brand:""}</div>
                  </div>
                  <div style={{fontSize:10,color:C.muted}}>{(item.cat||"").split(" ")[0]}</div>
                  {editStock===item.id?(
                    <div style={{gridColumn:"3/5",display:"flex",gap:4}}>
                      <input type="number" value={editVal} onChange={e=>setEditVal(e.target.value)} style={{width:56,padding:"3px 5px",borderRadius:5,border:`1px solid ${C.wine}`,fontSize:11}} autoFocus/>
                      <button onClick={()=>{setItems(p=>p.map(i=>i.id!==item.id?i:{...i,inStock:+editVal||0}));setEditStock(null);}} style={{padding:"3px 6px",borderRadius:5,background:C.wine,color:"#fff",border:"none",fontSize:10,cursor:"pointer"}}>✓</button>
                      <button onClick={()=>setEditStock(null)} style={{padding:"3px 5px",borderRadius:5,background:C.bg,border:`1px solid ${C.border}`,fontSize:10,cursor:"pointer"}}>✕</button>
                    </div>
                  ):(
                    <>
                      <div style={{fontSize:13,fontWeight:700,color:sc,cursor:"pointer"}} onClick={()=>{setEditStock(item.id);setEditVal(String(item.inStock));}} title="Click to edit stock">{item.inStock}<span style={{fontSize:9,color:C.muted,fontWeight:400,marginLeft:2}}>{item.unit}</span></div>
                      <div style={{fontSize:11,color:C.muted}}>{item.minStock}</div>
                    </>
                  )}
                  <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:sb,color:sc,whiteSpace:"nowrap"}}>{out?"Out":low?"Low":"OK"}</span>
                  <button onClick={()=>{setShowOrder(item.id);setOrderQty(String(Math.max(item.minStock-item.inStock,item.minStock)));}}
                    style={{padding:"4px 9px",borderRadius:6,fontSize:10,fontWeight:600,cursor:"pointer",background:C.wine,color:"#fff",border:"none"}}>Order</button>
                </div>
              );
            })}
            {filteredItems.length===0&&<div style={{textAlign:"center",padding:20,fontSize:12,color:C.muted}}>{T2("No items found.")}</div>}
          </div>
        </div>
      )}

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
                    {ord.receivedAt&&<div style={{fontSize:10,color:C.green,marginTop:1}}>✓ Received {ord.receivedQty} at {ord.receivedAt}</div>}
                  </div>
                  <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:sb,color:sc}}>{ord.status}</span>
                </div>
                {ord.status==="Ordered"&&(
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input type="number" placeholder={`Max ${ord.qty}`} defaultValue={ord.qty} id={"rcv-"+ord.id}
                      style={{width:110,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}/>
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
            <div style={{fontSize:13,fontWeight:700,color:C.wine,fontFamily:"Georgia,serif",marginBottom:2}}>📋 Auto-Requirements for Upcoming Events</div>
            <div style={{fontSize:11,color:C.wine,opacity:.8}}>{upcoming.length} events · {totalPax.toLocaleString()} total pax</div>
          </div>
          {upcoming.length===0&&<div style={{textAlign:"center",padding:28,background:C.bg,borderRadius:10,fontSize:12,color:C.muted}}>No upcoming events. Add from Dashboard.</div>}
          {upcoming.length>0&&(
            <div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {upcoming.map(ev=>(
                  <div key={ev.id} style={{padding:"6px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:9}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.text}}>{ev.guest}</div>
                    <div style={{fontSize:10,color:C.muted}}>{ev.date} · {ev.pax} pax</div>
                  </div>
                ))}
              </div>
              <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 90px 90px 90px 90px",background:C.bg,padding:"7px 14px",borderBottom:`1px solid ${C.border}`}}>
                  {["Item","In Stock","Required","Shortfall","Action"].map(h=><div key={h} style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>{h}</div>)}
                </div>
                {items.filter(i=>i.perPax>0).map((item,idx)=>{
                  const req=Math.ceil(item.perPax*totalPax);
                  const short=Math.max(0,req-item.inStock);
                  return (
                    <div key={item.id} style={{display:"grid",gridTemplateColumns:"2fr 90px 90px 90px 90px",padding:"8px 14px",borderBottom:`1px solid ${C.borderLight}`,alignItems:"center",background:idx%2===0?C.surface:"#FAFAFA"}}>
                      <div><div style={{fontSize:12,fontWeight:500,color:C.text}}>{item.name}</div><div style={{fontSize:9,color:C.muted}}>{item.perPax}× per pax</div></div>
                      <div style={{fontSize:12,fontWeight:600,color:item.inStock>=req?C.green:C.red}}>{item.inStock}</div>
                      <div style={{fontSize:12,fontWeight:600,color:C.text}}>{req}</div>
                      <div style={{fontSize:12,fontWeight:700,color:short>0?C.red:C.green}}>{short>0?`−${short}`:"✓"}</div>
                      {short>0
                        ?<button onClick={()=>{setShowOrder(item.id);setOrderQty(String(short));}}
                            style={{padding:"4px 9px",borderRadius:6,fontSize:10,fontWeight:600,cursor:"pointer",background:C.red,color:"#fff",border:"none"}}>Order {short}</button>
                        :<span style={{fontSize:10,color:C.green,fontWeight:600}}>OK ✓</span>
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
  const [selPkg,   setSelPkg]   = useState(pkgNames[0]||"");
  const [search,   setSearch]   = useState("");
  const [secFil,   setSecFil]   = useState("All");

  const menu   = MENU_PACKAGES[selPkg]||[];
  const dishes = menu.filter(d=>{
    const ms = secFil==="All" || guessSectionForDish(d)===secFil;
    const mt = !search.trim() || d.toLowerCase().includes(search.toLowerCase());
    return ms&&mt;
  });

  // Group by section
  const bySec = {};
  dishes.forEach(d=>{ const s=guessSectionForDish(d); if(!bySec[s])bySec[s]=[]; bySec[s].push(d); });

  const PKG_META = {
    "Multi-Cuisine Veg":    {icon:"🌱",c:"#2B8A50",bg:"#EDF7F2"},
    "Multi-Cuisine Non-Veg":{icon:"🍗",c:"#6B1818",bg:"#FFF0F0"},
    "Magnum Veg":           {icon:"⭐",c:"#854F0B",bg:"#FEF6E2"},
    "Magnum Non-Veg":       {icon:"🌟",c:"#6B1818",bg:"#FFF0F0"},
    "Luxury Veg":           {icon:"👑",c:"#5A3FA0",bg:"#F0EDFC"},
    "Luxury Non-Veg":       {icon:"💎",c:"#185FA5",bg:"#EEF4FD"},
  };
  const pm = PKG_META[selPkg]||{icon:"📋",c:C.wine,bg:C.wineBg};

  return (
    <div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"Georgia,serif",marginBottom:4}}>📜 Menu Packages</div>
        <div style={{fontSize:12,color:C.muted}}>{pkgNames.length} packages · Full catering menus for all events</div>
      </div>

      {/* Package selector */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18}}>
        {pkgNames.map(pkg=>{
          const m2=PKG_META[pkg]||{icon:"📋",c:C.wine,bg:C.wineBg};
          const active=selPkg===pkg;
          return (
            <div key={pkg} onClick={()=>{setSelPkg(pkg);setSearch("");setSecFil("All");}}
              style={{background:active?m2.c:C.surface,border:`2px solid ${active?m2.c:C.border}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",transition:"all .15s"}}>
              <div style={{fontSize:22,marginBottom:6}}>{m2.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:active?"#fff":C.text}}>{pkg}</div>
              <div style={{fontSize:10,color:active?"rgba(255,255,255,.7)":C.muted,marginTop:2}}>{(MENU_PACKAGES[pkg]||[]).length} items</div>
            </div>
          );
        })}
      </div>

      {/* Selected package detail */}
      <div style={{background:pm.bg,border:`2px solid ${pm.c}20`,borderRadius:14,overflow:"hidden"}}>
        <div style={{background:pm.c,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:"#fff",fontFamily:"Georgia,serif"}}>{pm.icon} {selPkg}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.75)",marginTop:2}}>{menu.length} items total</div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {SECTIONS.map(sec=>{
              const cnt = (MENU_PACKAGES[selPkg]||[]).filter(d=>guessSectionForDish(d)===sec).length;
              const m3  = SECTION_META[sec]||{icon:"🍽"};
              if(!cnt) return null;
              return <div key={sec} style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"rgba(255,255,255,.2)",color:"#fff"}}>{m3.icon} {sec} ({cnt})</div>;
            })}
          </div>
        </div>

        {/* Search + section filter */}
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${pm.c}15`,background:pm.bg,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search dishes…"
            style={{flex:1,minWidth:140,padding:"6px 10px",borderRadius:8,border:`1px solid ${pm.c}40`,fontSize:12,color:C.text,background:C.surface}}/>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {["All",...SECTIONS].map(s=>{
              const cnt = s==="All"?menu.length:(MENU_PACKAGES[selPkg]||[]).filter(d=>guessSectionForDish(d)===s).length;
              if(s!=="All"&&!cnt) return null;
              const m3=SECTION_META[s]||{color:C.muted,icon:"🍽"};
              return <button key={s} onClick={()=>setSecFil(s)} style={{padding:"3px 10px",borderRadius:20,fontSize:10,cursor:"pointer",background:secFil===s?pm.c:"transparent",color:secFil===s?"#fff":C.muted,border:`1px solid ${secFil===s?pm.c:C.border}`}}>{s==="All"?"All":m3.icon+" "+s} ({cnt})</button>;
            })}
          </div>
        </div>

        {/* Dishes by section */}
        <div style={{padding:"14px 16px"}}>
          {Object.entries(bySec).map(([sec,dList])=>{
            const m3 = SECTION_META[sec]||{color:C.muted,icon:"🍽"};
            return (
              <div key={sec} style={{marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8,padding:"6px 10px",background:m3.color+"12",borderRadius:8}}>
                  <span style={{fontSize:16}}>{m3.icon}</span>
                  <span style={{fontSize:13,fontWeight:700,color:m3.color}}>{sec}</span>
                  <span style={{fontSize:10,color:m3.color,opacity:.7}}>· {dList.length} items</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                  {dList.map((d,i)=>(
                    <div key={i} style={{fontSize:11,padding:"6px 10px",background:C.surface,borderRadius:7,border:`1px solid ${m3.color}20`,color:C.text,display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:4,height:4,borderRadius:"50%",background:m3.color,flexShrink:0}}/>
                      {d}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {dishes.length===0&&<div style={{textAlign:"center",padding:24,color:C.muted,fontSize:12}}>No items match your search.</div>}
        </div>
      </div>
    </div>
  );
}


const VENDOR_CATEGORIES = [
  "Outside Chef","Vegetable Supplier","Dairy Supplier","Dry Goods Supplier",
  "Crockery & Equipment","Packaging Supplier","Beverage Supplier","Cleaning Supplies","Other",
];


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
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.surface,borderRadius:14,padding:"24px 28px",maxWidth:340,textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:5}}>Remove {deleteConfirm.name}?</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:14}}>
              <Btn onClick={()=>{setVendors(p=>p.filter(v=>v.id!==deleteConfirm.id));setDeleteConfirm(null);}} color={C.red} style={{fontSize:12,padding:"7px 18px"}}>Remove</Btn>
              <Btn onClick={()=>setDeleteConfirm(null)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>🤝 Vendor Directory</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{vendors.length} vendors · Outside chefs, suppliers, service partners</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)} color={showAdd?C.muted:C.wine} style={{fontSize:12,padding:"7px 16px"}}>{showAdd?"✕ Cancel":"+ Add Vendor"}</Btn>
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
              {l:"Added By", k:"addedBy",ph:"Your name"},
              {l:T2("Notes"),    k:"notes",  ph:"Speciality, experience…"},
            ].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:9,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>{f.l}</div>
                <input value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={fld}/>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 60px",gap:8,marginBottom:10}}>
            <div>
              <div style={{fontSize:9,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>Category</div>
              <select value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))} style={fld}>
                {VENDOR_CATEGORIES.map(ct=><option key={ct}>{ct}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:9,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>Section Speciality</div>
              <select value={form.section} onChange={e=>setForm(p=>({...p,section:e.target.value}))} style={fld}>
                {SECTION_OPTS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:9,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>Rating</div>
              <select value={form.rating} onChange={e=>setForm(p=>({...p,rating:+e.target.value}))} style={fld}>
                {[5,4,3,2,1].map(r=><option key={r} value={r}>{"★".repeat(r)}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>setShowAdd(false)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
            <Btn onClick={addVendor} color={C.wine} style={{fontSize:12,padding:"8px 20px"}}>✓ Add Vendor</Btn>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search vendors…"
          style={{flex:1,minWidth:160,padding:"7px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
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
                <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:8}}>Edit — {v.name}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                  {[{l:"Phone",k:"phone"},{l:T2("Email"),k:"email"},{l:T2("Address"),k:"address"},{l:T2("Notes"),k:"notes"}].map(f=>(
                    <div key={f.k}>
                      <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{f.l}</div>
                      <input value={editForm[f.k]||""} onChange={e=>setEditForm(p=>({...p,[f.k]:e.target.value}))} style={{...fld,padding:"5px 7px"}}/>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:5}}>
                  <Btn onClick={()=>{setVendors(p=>p.map(x=>x.id!==v.id?x:{...x,...editForm}));setEditId(null);}} color={C.wine} style={{fontSize:11,padding:"5px 12px"}}>Save</Btn>
                  <Btn onClick={()=>setEditId(null)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:11,padding:"5px 10px"}}>Cancel</Btn>
                </div>
              </div>
            ):(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{display:"flex",gap:9,alignItems:"center"}}>
                    <Avatar name={v.name} size={34} index={i+10}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>{v.name}</div>
                      <div style={{fontSize:10,color:C.wine,fontWeight:600,marginTop:1}}>{v.id}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={()=>{setEditId(v.id);setEditForm({phone:v.phone,email:v.email,address:v.address,notes:v.notes});}} style={{padding:"3px 8px",borderRadius:6,background:C.bg,border:`1px solid ${C.border}`,fontSize:10,cursor:"pointer",color:C.text}}>Edit</button>
                    <button onClick={()=>setVendors(p=>p.map(x=>x.id!==v.id?x:{...x,active:!x.active}))} style={{padding:"3px 8px",borderRadius:6,fontSize:10,cursor:"pointer",border:"none",background:v.active?C.greenBg:C.redBg,color:v.active?C.green:C.red}}>{v.active?"Active":"Off"}</button>
                    <button onClick={()=>setDeleteConfirm(v)} style={{padding:"3px 7px",borderRadius:6,fontSize:10,cursor:"pointer",border:`1px solid ${C.redBorder}`,background:C.redBg,color:C.red}}>🗑</button>
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
                <div style={{marginTop:6,fontSize:9,color:C.faint}}>Added by {v.addedBy} · {v.date}</div>
              </div>
            )}
          </div>
        ))}
        {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:32,background:C.bg,borderRadius:10,fontSize:12,color:C.muted}}>{T2("No vendors found.")}</div>}
      </div>
    </div>
  );
}


export default function App() {
  const [screen,setScreen]           = useState("dashboard");
  const [lang,setLang]               = useState("en"); // "en" | "hi"
  const [attendance,setAttendance]   = useState([]);
  const [leaves,setLeaves]           = useState([
    {id:1,staffId:"19",staffName:"Bipin",staffSection:"Tandoor",from:"2025-06-22",to:"2025-06-23",reason:"Personal",status:"Approved"},
  ]);
  const [events,setEvents]           = useState(LIVE_EVENTS_INIT);
  const [kitchenTracking,setKitchenTracking] = useState({});
  const [outsideChefAtt,setOutsideChefAtt] = useState([]);
  const [currentUser,setCurrentUser] = useState(null);
  const [empDb,setEmpDb]             = useState(EMPLOYEE_DB_INIT);
  const [sessionChecked,setSessionChecked] = useState(false);
  const [kioskOpen,setKioskOpen]     = useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const su = await window.storage?.get("ambria_session_user");
        if(su?.value){ const emp=JSON.parse(su.value); if(emp&&emp.id) setCurrentUser(emp); }
      }catch(e){}
      setSessionChecked(true);
    })();
  },[]);

  async function handleLogin(emp){
    setCurrentUser(emp);
    try{ await window.storage?.set("ambria_session_user",JSON.stringify(emp)); }catch(e){}
  }
  async function handleLogout(){
    setCurrentUser(null);
    try{ await window.storage?.delete("ambria_session_user"); }catch(e){}
  }

  const gAlerts   = attendance.filter(a=>a.date===TODAY&&a.groomingFailed).length;
  const pendingLv = (leaves||[]).filter(l=>l.status==="Pending").length;
  const showStaffView = currentUser&&currentUser.role==="staff";

  if(!sessionChecked) return (
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${C.wine} 0%,#2d0707 100%)`,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#fff"}}>A</div>
      <div style={{fontSize:13,color:"rgba(255,255,255,.6)"}}>Loading…</div>
    </div>
  );
  if(!currentUser) return <LoginScreen empDb={empDb} onLogin={handleLogin}/>;
  if(showStaffView) return <StaffView user={currentUser} attendance={attendance} setAttendance={setAttendance} leaves={leaves} setLeaves={setLeaves} onLogout={handleLogout}/>;

  function renderScreen(s){
    switch(s){
      case "dashboard":  return <Dashboard attendance={attendance} events={events} setEvents={setEvents} leaves={leaves} setScreen={setScreen} kitchenTracking={kitchenTracking}/>;
      case "calendar":   return <CalendarModule events={events} setEvents={setEvents}/>;
      case "team":       return <TeamHub attendance={attendance} setAttendance={setAttendance} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} events={events} lang={lang}/>;
      case "kitchen":    return <KitchenHub events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang}/>;
      case "menus":      return <MenuPackagesView lang={lang}/>;
      case "transport":  return <TransportDispatch events={events} lang={lang}/>;
      case "store":      return <StoreModule events={events} lang={lang}/>;
      case "vendors":    return <VendorDirectory lang={lang}/>;
      default:           return <Dashboard attendance={attendance} events={events} setEvents={setEvents} leaves={leaves} setScreen={setScreen} kitchenTracking={kitchenTracking}/>;
    }
  }

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Segoe UI','DM Sans',sans-serif",background:C.bg,overflow:"hidden"}}>
      {kioskOpen&&<KioskAttendance staffList={STAFF_LIST} attendance={attendance} setAttendance={setAttendance} onClose={()=>setKioskOpen(false)} lang={lang}/>}
      {/* ── SIDEBAR ── */}
      <div style={{width:220,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"18px 18px 14px",borderBottom:`1px solid ${C.borderLight}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:C.wine,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff"}}>A</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>Ambria Work Force</div>
              <div style={{fontSize:10,color:C.muted}}>F&B Kitchen Operations</div>
            </div>
          </div>
        </div>
        <nav style={{flex:1,padding:"8px",overflowY:"auto"}}>
          {NAV.map(item=>{
            const active=screen===item.id;
            const badge=item.id==="team"&&(gAlerts+pendingLv)>0?(gAlerts+pendingLv):0;
            return(
              <button key={item.id} onClick={()=>setScreen(item.id)} style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",
                width:"100%",padding:"9px 11px",borderRadius:8,marginBottom:2,
                cursor:"pointer",textAlign:"left",
                background:active?C.wineBg:"transparent",
                border:active?`1px solid ${C.wineBorder}`:"1px solid transparent",
                borderLeft:active?`3px solid ${C.wine}`:"3px solid transparent",
                color:active?C.wine:C.muted,
                fontSize:12,fontWeight:active?600:400,
              }}>
                <span style={{display:"flex",alignItems:"center",gap:9}}>
                  <span style={{fontSize:14}}>{item.icon}</span>{T(item.label,lang)}
                </span>
                {badge>0&&<span style={{background:C.wine,color:"#fff",fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10}}>{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div style={{padding:"12px 14px",borderTop:`1px solid ${C.borderLight}`}}>
          <button onClick={()=>setKioskOpen(true)} style={{width:"100%",padding:"10px 12px",borderRadius:10,marginBottom:10,background:`linear-gradient(135deg,${C.wine} 0%,#2d0707 100%)`,border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:16}}>🖥</span>
            <div style={{textAlign:"left"}}><div style={{fontSize:12,fontWeight:700}}>{T("Launch Kiosk",lang)}</div><div style={{fontSize:9,opacity:.7}}>{T("Kitchen gate attendance",lang)}</div></div>
            <span style={{marginLeft:"auto",fontSize:14,opacity:.7}}>→</span>
          </button>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Avatar name={currentUser?.name||"A"} size={28} index={0}/>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:C.text}}>{currentUser?.name}</div>
                <div style={{fontSize:9,color:C.muted}}>{currentUser?.id} · {currentUser?.role==="admin"?"Admin":"Manager"}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <button onClick={()=>setLang(l=>l==="en"?"hi":"en")} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.wine,fontSize:10,padding:"3px 8px",cursor:"pointer",fontWeight:600}}>
                {lang==="en"?"🇮🇳 हिंदी":"🇬🇧 EN"}
              </button>
              <button onClick={handleLogout} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,fontSize:10,padding:"3px 8px",cursor:"pointer"}}>{T("Sign out",lang)}</button>
            </div>
          </div>
        </div>
      </div>
      {/* ── MAIN CONTENT ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"11px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>{T(NAV.find(n=>n.id===screen)?.label||"Dashboard",lang)}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:1}}>{TODAY_LABEL}</div>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:16,fontWeight:700,color:C.wine}}>{Math.round((attendance.filter(a=>a.date===TODAY&&a.status==="Present").length/Math.max(STAFF_LIST.length,1))*100)}%</div>
              <div style={{fontSize:10,color:C.muted}}>{attendance.filter(a=>a.date===TODAY&&a.status==="Present").length}/{STAFF_LIST.length} present</div>
            </div>
            <Avatar name={currentUser?.name||"A"} size={30} index={0}/>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"22px 26px"}}>
          <ErrorBoundary key={screen}>{renderScreen(screen)}</ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
