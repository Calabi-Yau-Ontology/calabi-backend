export const ERROR_MESSAGES = {
  AUTH: {
    UNAUTHORIZED: 'Unauthorized',
    INVALID_CREDENTIALS: 'Email or password is incorrect.',
    EMAIL_IN_USE: 'Email is already in use.',
    GOOGLE_EMAIL_MISSING: 'Google 계정에서 이메일을 받을 수 없습니다.',
  },
  USER: {
    NOT_FOUND: 'User not found',
  },
  CATEGORY: {
    NOT_FOUND: 'Category not found',
  },
  EVENT: {
    NOT_FOUND: 'Event not found',
  },
} as const;
