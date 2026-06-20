// Ambria FnB — Store & Inventory
import React, { useState, useRef, useEffect } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, safeArr, safeNum, TOMORROW } from '../utils/helpers.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { Card, Btn, Chip, SectionHeader } from './SharedUI.jsx';
import { dbLoad, dbUpsert, dbDelete } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';
import { getCatForDish, RECIPE_DB, getIngrForDish } from '../data/recipeData.js';
import { hasPerm } from '../data/permissions.js';

function StoreModule({events, lang="en", currentUser=null}) {
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
            {hasPerm(currentUser,"store.edit_stock")&&<Btn onClick={addItem} color={C.gold} style={{fontSize:12,padding:"8px 20px"}}>✓ Add to Inventory</Btn>}
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
            {hasPerm(currentUser,"store.receive")&&<button onClick={()=>setScanMode("in")} style={{flex:1,padding:"12px",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",
              background:scanMode==="in"?"#1A3A1A":"transparent",color:scanMode==="in"?C.green:C.muted}}>📥 {T2("Stock In")}</button>}
            {hasPerm(currentUser,"store.issue")&&<button onClick={()=>setScanMode("out")} style={{flex:1,padding:"12px",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",
              background:scanMode==="out"?"#3A1A1A":"transparent",color:scanMode==="out"?C.red:C.muted}}>📤 {T2("Stock Out")}</button>}
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
            const cat = getCatForDish(dishName);
            if(cat.id==="beverages") return;
            const sec = cat.name;
            const secMeta = {color:cat.color||C.muted, icon:cat.icon||"🍽"};
            const ingr = getIngrForDish(dishName, pax);
            if(!ingr || ingr.length===0) return;
            const isNew = ingr[0]?._newFmt;
            if(!sectionBags[sec]) sectionBags[sec] = {items:{},events:[],totalPax:0,meta:secMeta};
            if(!sectionBags[sec].events.find(e=>e.id===ev.id)) sectionBags[sec].events.push(ev);
            sectionBags[sec].totalPax += pax;
            if(!sectionBags[sec].meta) sectionBags[sec].meta = secMeta;
            ingr.forEach(ing=>{
              const key = ing.n;
              if(!sectionBags[sec].items[key]) sectionBags[sec].items[key] = {name:ing.n,hindi:ing.h||"",unit:ing.u,totalQty:0,dishes:[]};
              const qty = isNew ? ing.q : ing.q * pax;
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
              const m2 = bag.meta||{color:C.muted,icon:"🍽"};
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
                  {!allDone&&hasPerm(currentUser,"store.smart_issue")&&(
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



export { StoreModule };
