import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (3 levels up: src -> config -> backend -> root)
const result = dotenv.config({
    path: path.resolve(__dirname, '../../../..', '.env')
});

if (result.error) {
    console.warn('⚠️  Warning: .env file not found at project root');
} else {
    console.log('✅ [Socket] Environment variables loaded from root .env');
}
