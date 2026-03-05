const errorMap = {
  'Invalid login credentials': 'Incorrect email or password. Please try again.',
  'invalid login credentials': 'Incorrect email or password. Please try again.',
  'User already registered': 'An account with this email already exists. Try logging in instead.',
  'Email not confirmed': 'Please check your email and click the confirmation link.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
  'Unable to validate email address: invalid format': 'Please enter a valid email address.',
  'Signup requires a valid password': 'Please enter a password (at least 6 characters).',
  'For security purposes, you can only request this after': 'Too many attempts. Please wait a moment before trying again.',
  'Email rate limit exceeded': 'Too many emails sent. Please wait a few minutes and try again.',
  'User not found': 'No account found with this email address.',
  'New password should be different from the old password': 'Your new password must be different from your current password.',
};

/**
 * Maps a Supabase auth error message to a user-friendly message.
 * @param {string} message - The raw error message from Supabase
 * @returns {string} A friendly error message
 */
export function friendlyAuthError(message) {
  if (!message) return 'Something went wrong. Please try again.';

  // Check for exact matches
  if (errorMap[message]) return errorMap[message];

  // Check for partial matches (some Supabase errors include timestamps)
  for (const [key, friendly] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) return friendly;
  }

  return message;
}
