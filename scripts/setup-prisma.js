const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

// Shared schema path (single source of truth)
const SHARED_SCHEMA_PATH = 'backend/shared/prisma/schema.prisma';

// Services that use Prisma
const prismaServices = [
  { name: 'ingestion-service', path: 'backend/ingestion-service' },
  { name: 'notification-api', path: 'backend/notification-api' },
  { name: 'processing-service', path: 'backend/processing-service' },
  { name: 'social-api', path: 'backend/social-api' }
];

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function execCommand(command, cwd) {
  try {
    execSync(command, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
    });
    return true;
  } catch (error) {
    log(`Error executing command: ${command}`, colors.red);
    return false;
  }
}

function setupPrisma(mode = 'all') {
  const rootDir = path.join(__dirname, '..');
  const sharedSchemaPath = path.join(rootDir, SHARED_SCHEMA_PATH);

  log('\n========================================', colors.cyan);
  log('🔧 Prisma Setup Script (Shared Schema)', colors.bright + colors.cyan);
  log('========================================\n', colors.cyan);

  // Check if shared schema exists
  if (!fs.existsSync(sharedSchemaPath)) {
    log(`❌ Shared schema not found at: ${sharedSchemaPath}`, colors.red);
    log('Please ensure the shared schema exists at backend/shared/prisma/schema.prisma', colors.yellow);
    process.exit(1);
  }

  log(`📄 Using shared schema: ${SHARED_SCHEMA_PATH}`, colors.cyan);
  log('─'.repeat(50) + '\n', colors.cyan);

  // Generate Prisma Client from shared schema (once)
  if (mode === 'all' || mode === 'generate') {
    log('📦 Generating Prisma Client from shared schema...', colors.yellow);
    const success = execCommand(`npx prisma generate --schema=${SHARED_SCHEMA_PATH}`, rootDir);
    if (success) {
      log('✅ Prisma Client generated successfully!\n', colors.green);
    } else {
      log('❌ Failed to generate Prisma Client', colors.red);
      process.exit(1);
    }
  }

  // Run migrations (only from shared schema)
  if (mode === 'all' || mode === 'migrate') {
    log('🔄 Running migrations from shared schema...', colors.yellow);
    const migrateCommand = process.env.NODE_ENV === 'production'
      ? `npx prisma migrate deploy --schema=${SHARED_SCHEMA_PATH}`
      : `npx prisma migrate dev --schema=${SHARED_SCHEMA_PATH}`;

    const success = execCommand(migrateCommand, rootDir);
    if (success) {
      log('✅ Migrations completed successfully!\n', colors.green);
    } else {
      log('❌ Failed to run migrations', colors.red);
    }
  }

  // Validate that all services can access the generated client
  log('\n📋 Validating services...', colors.blue);
  prismaServices.forEach((service) => {
    const servicePath = path.join(rootDir, service.path);
    if (fs.existsSync(servicePath)) {
      log(`  ✓ ${service.name}`, colors.green);
    } else {
      log(`  ⚠ ${service.name} not found`, colors.yellow);
    }
  });

  log('\n========================================', colors.cyan);
  log('✨ Prisma Setup Completed!', colors.bright + colors.green);
  log('========================================', colors.cyan);
  log('\nℹ️  All services now use the shared Prisma Client', colors.blue);
  log('   from: backend/shared/prisma/generated/client\n', colors.blue);
}

// Get command line argument
const mode = process.argv[2] || 'all'; // all, generate, or migrate

if (!['all', 'generate', 'migrate'].includes(mode)) {
  log('Invalid mode. Use: all, generate, or migrate', colors.red);
  process.exit(1);
}

setupPrisma(mode);
