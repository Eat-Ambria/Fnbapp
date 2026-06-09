/**
 * AMBRIA FnB — Seed Recipes + Ingredients into Supabase
 * 
 * Run AFTER the SQL migration (supabase_migration.sql).
 * 
 * Usage:
 *   cd C:\GYV\Fnbapp
 *   node scripts/seed_recipes.js
 * 
 * Requires: npm install @supabase/supabase-js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ozibklsaweqizzyfwqmm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aWJrbHNhd2VxaXp6eWZ3cW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzk1MTIsImV4cCI6MjA5NTg1NTUxMn0.NrSFhjxRYorsnIvnEvq3Q4QromwTZoj-XRc8k9emI-0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Import your data files (adjust paths if needed) ──
import { RECIPE_DB } from '../src/data/recipeData.js';
import { RECIPE_INGREDIENTS } from '../src/data/recipeData.js';

async function seedRecipes() {
  console.log('🍳 Seeding recipes...');
  let count = 0;

  for (const cat of RECIPE_DB.cats) {
    const recipes = RECIPE_DB.recipes[cat.id] || [];
    for (const recipe of recipes) {
      const { error } = await supabase.from('recipes').upsert({
        dish_name: recipe.n,
        category_id: cat.id,
        sub: recipe.sub || null,
        steps: JSON.stringify(recipe.steps || []),
      }, { onConflict: 'dish_name,category_id' });

      if (error) {
        console.error(`  ✗ ${recipe.n}: ${error.message}`);
      } else {
        count++;
      }
    }
  }
  console.log(`  ✓ ${count} recipes inserted`);
}

async function seedIngredients() {
  console.log('🧂 Seeding recipe ingredients...');
  let count = 0;

  for (const [dishName, ingredients] of Object.entries(RECIPE_INGREDIENTS)) {
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      const { error } = await supabase.from('recipe_ingredients').upsert({
        dish_name: dishName,
        name: ing.n,
        hindi_name: ing.h || null,
        qty: ing.q || 0,
        unit: ing.u || null,
        scale_exempt: (!ing.q || ing.q === 0),
        sort_order: i,
      }, { onConflict: 'dish_name,name' });

      if (error) {
        console.error(`  ✗ ${dishName} → ${ing.n}: ${error.message}`);
      } else {
        count++;
      }
    }
  }
  console.log(`  ✓ ${count} ingredient rows inserted`);
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  AMBRIA — Recipe & Ingredient Seeder');
  console.log('═══════════════════════════════════════');
  console.log('');

  await seedRecipes();
  console.log('');
  await seedIngredients();

  console.log('');
  console.log('✅ Done! Verify in Supabase dashboard:');
  console.log('   https://supabase.com/dashboard/project/ozibklsaweqizzyfwqmm/editor');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
