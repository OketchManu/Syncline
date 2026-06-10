import { API_ORIGIN } from '../config.js';

let warmed = false;

/** Ping the API so Render cold starts happen before auth, not during Google sign-in. */
export function warmupApi() {
    if (warmed) return;
    warmed = true;
    fetch(`${API_ORIGIN}/health`, { mode: 'no-cors' }).catch(() => {});
}
