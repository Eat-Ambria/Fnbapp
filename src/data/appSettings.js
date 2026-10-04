// Ambria FnB — small admin-controlled global settings (key/value).
// Mutable module-level object hydrated at boot from Supabase `app_settings`,
// same pattern as PRESET_ROLES in permissions.js / DEPT_CONFIGS in
// salesConfig.js: Supabase is the source of truth, this is the in-memory
// mirror consumers read directly, kept live by Access Manager's save calling
// setAppSetting() right after its own upsert.
export const APP_SETTINGS = {};

export function hydrateAppSettings(rows) {
  Object.keys(APP_SETTINGS).forEach(k => delete APP_SETTINGS[k]);
  (rows || []).forEach(r => { if (r && r.key) APP_SETTINGS[r.key] = r.value; });
}

export function setAppSetting(key, value) {
  if (value) APP_SETTINGS[key] = value;
  else delete APP_SETTINGS[key];
}

// The code staff must enter to re-open a Function Plan that's been marked
// final. Empty/unset means the admin hasn't configured one yet — unlocking
// then falls back to just the reason prompt, same as before this existed.
export function getFpUnlockCode() {
  return (APP_SETTINGS.fp_unlock_code || '').trim();
}
