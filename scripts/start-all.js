const { spawn } = require('child_process');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// All backend services
const services = [
  { name: 'ingestion-service', path: 'backend/ingestion-service', color: colors.cyan },
  { name: 'notification-api', path: 'backend/notification-api', color: colors.green },
  { name: 'processing-service', path: 'backend/processing-service', color: colors.yellow },
  { name: 'social-api', path: 'backend/social-api', color: colors.blue },
  // { name: 'email-service', path: 'backend/email-service', color: colors.magenta },
  // { name: 'sms-service', path: 'backend/sms-service', color: colors.red },
  { name: 'socket-service', path: 'backend/socket-service', color: colors.cyan }
];

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function startService(service) {
  const rootDir = path.join(__dirname, '..');
  const servicePath = path.join(rootDir, service.path);
  
  log(`\n🚀 Starting ${service.name}...`, colors.bright + service.color);
  
  // Use npm run dev for development mode
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npm, ['run', 'dev'], {
    cwd: servicePath,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Prefix output with service name
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${service.color}[${service.name}]${colors.reset} ${line}`);
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${colors.red}[${service.name}] ERROR:${colors.reset} ${line}`);
    });
  });

  child.on('error', (error) => {
    log(`❌ Failed to start ${service.name}: ${error.message}`, colors.red);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      log(`⚠️  ${service.name} exited with code ${code}`, colors.yellow);
    }
  });

  return child;
}

function main() {
  log('\n========================================', colors.cyan + colors.bright);
  log('🎯 Starting All Backend Services', colors.cyan + colors.bright);
  log('========================================\n', colors.cyan + colors.bright);

  log('Services to start:', colors.bright);
  services.forEach((service, index) => {
    log(`  ${index + 1}. ${service.name}`, service.color);
  });

  log('\n' + '─'.repeat(50) + '\n', colors.cyan);

  const processes = [];
  
  // Start all services
  services.forEach(service => {
    const child = startService(service);
    processes.push({ name: service.name, process: child });
  });

  log('\n========================================', colors.green + colors.bright);
  log('✅ All services started!', colors.green + colors.bright);
  log('Press Ctrl+C to stop all services', colors.yellow);
  log('========================================\n', colors.green + colors.bright);

  // Handle graceful shutdown
  const cleanup = () => {
    log('\n\n🛑 Shutting down all services...', colors.yellow + colors.bright);
    processes.forEach(({ name, process }) => {
      log(`  Stopping ${name}...`, colors.yellow);
      process.kill();
    });
    log('✅ All services stopped!', colors.green);
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  // Keep the script running
  process.stdin.resume();
}

main();
