-- Lets an admin correct categorizeIngredient()'s "Other" bucket by hand, from
-- either the Ordering Sheet or the Ingredient Map screen.
alter table ingredient_item_map
  add column if not exists category_override text;
