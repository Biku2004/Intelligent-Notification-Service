import { defineConfig } from '@prisma/client';

export default defineConfig({
  datasourceUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/notification_db',
});
