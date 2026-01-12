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

// Services with Prisma schemas
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
  
  log('\n========================================', colors.cyan);
  log('🔧 Prisma Setup Script', colors.bright + colors.cyan);
  log('========================================\n', colors.cyan);

  prismaServices.forEach((service, index) => {
    const servicePath = path.join(rootDir, service.path);
    const schemaPath = path.join(servicePath, 'prisma', 'schema.prisma');
    
    // Check if schema exists
    if (!fs.existsSync(schemaPath)) {
      log(`⚠️  Schema not found for ${service.name}, skipping...`, colors.yellow);
      return;
    }

    log(`\n[${index + 1}/${prismaServices.length}] Processing: ${service.name}`, colors.blue + colors.bright);
    log('─'.repeat(50), colors.blue);

    // Generate Prisma Client
    if (mode === 'all' || mode === 'generate') {
      log(`📦 Generating Prisma Client...`, colors.yellow);
      const success = execCommand('npx prisma generate', servicePath);
      if (success) {
        log(`✅ Prisma Client generated successfully!`, colors.green);
      } else {
        log(`❌ Failed to generate Prisma Client`, colors.red);
      }
    }

    // Run migrations (only in migrate mode or all mode)
    if (mode === 'all' || mode === 'migrate') {
      log(`🔄 Running migrations...`, colors.yellow);
      // Use migrate deploy for production-like setup or migrate dev for development
      const migrateCommand = process.env.NODE_ENV === 'production' 
        ? 'npx prisma migrate deploy' 
        : 'npx prisma migrate dev';
      
      const success = execCommand(migrateCommand, servicePath);
      if (success) {
        log(`✅ Migrations completed successfully!`, colors.green);
      } else {
        log(`❌ Failed to run migrations`, colors.red);
      }
    }
  });

  log('\n========================================', colors.cyan);
  log('✨ Prisma Setup Completed!', colors.bright + colors.green);
  log('========================================\n', colors.cyan);
}

// Get command line argument
const mode = process.argv[2] || 'all'; // all, generate, or migrate

if (!['all', 'generate', 'migrate'].includes(mode)) {
  log('Invalid mode. Use: all, generate, or migrate', colors.red);
  process.exit(1);
}

setupPrisma(mode);
