// Supabase Auth needs an email-shaped identifier and a reasonably long
// password per account; staff log in with a 4-digit PIN on a shared tablet,
// not an email+password. These two helpers are the single place that
// bridges the two: a synthetic, non-routable email per staff_id, and a
// password that folds staff_id into the PIN so it comfortably clears
// GoTrue's minimum length regardless of the PIN's own length. Neither value
// is ever shown to anyone or treated as a real credential on its own -- the
// PIN is still the only thing a person actually types.
//
// This exact formula is duplicated (not imported) in every edge function
// that also needs it (backfill-staff-auth, admin-staff-auth) since those run
// on Deno, not through this bundle -- keep all copies in sync if this ever
// changes.
export function staffAuthEmail(staffId) {
  return `${String(staffId).trim().toUpperCase()}@staff.ambria.local`;
}

export function staffAuthPassword(staffId, pin) {
  return `${String(staffId).trim().toUpperCase()}:${String(pin).trim()}`;
}

// Classifies a supabase-js auth error so callers can show a distinct message
// for each case instead of lumping every failure into "wrong PIN":
// - 'network': no HTTP response at all, or the auth server itself errored
//   (5xx) -- a flaky connection, not a credential problem.
// - 'rate_limited': GoTrue's per-IP sign-in rate limit (429) -- all tablets
//   at one venue share a NAT IP, so a shift change plus repeated attempts
//   can trip this; it is not the same as a wrong PIN and retrying
//   immediately won't help.
// - 'credentials': a real invalid_credentials-shaped rejection.
export function classifyAuthError(error) {
  if (!error) return null;
  if (error.status === 429) return 'rate_limited';
  if (!error.status || error.status >= 500 || error.name === 'AuthRetryableFetchError') return 'network';
  return 'credentials';
}
