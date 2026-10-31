// Runs in every test worker before modules are imported.
process.env.NODE_ENV = 'test';
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DEV_MODE = 'true';
process.env.JWT_SECRET ||= 'test-secret-test-secret-test-secret';
process.env.TELEGRAM_BOT_TOKEN = '123456:TEST_TOKEN_FOR_SIGNATURE_CHECKS';
