// Where Supabase's confirmation emails send people back to. The domain must
// also be listed under Authentication → URL Configuration → Redirect URLs.
export const CONFIRM_REDIRECT = window.location.origin;

// Plain-language version of Supabase's rate-limit error on resend.
export function friendlyResendError(error) {
  if (error.status === 429 || /security purposes|rate limit/i.test(error.message)) {
    return 'An email was just sent. Please wait a minute before asking for another one.';
  }
  return error.message;
}
