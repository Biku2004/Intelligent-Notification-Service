/**
 * Authentication Routes
 * /api/auth/register - Register new user
 * /api/auth/login - Login existing user
 * 
 * SECURITY FEATURES:
 * - JWT secret validation (no fallback)
 * - Email format validation
 * - Password strength requirements
 * - Rate limiting on auth endpoints
 */
import express, { Response, Request, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '../../../shared/prisma/generated/client';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// SECURITY: JWT Secret Validation (P0 Fix #1)
// ============================================
const JWT_SECRET: Secret = process.env.JWT_SECRET!;
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key') {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set or using default value!');
  console.error('   Please set a strong JWT_SECRET in your .env file');
  process.exit(1);
}
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

// ============================================
// SECURITY: Input Validation (P0 Fix #2)
// ============================================
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validateEmail = (email: string): boolean => EMAIL_REGEX.test(email);

interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

const validatePassword = (password: string): PasswordValidation => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateUsername = (username: string): boolean => {
  // Username: 3-30 chars, alphanumeric and underscores only
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
};

// ============================================
// SECURITY: Rate Limiting (P0 Fix #3)
// ============================================
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore: Map<string, RateLimitEntry> = new Map();

const createRateLimiter = (windowMs: number, maxAttempts: number, message: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      // New window
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxAttempts) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.status(429).json({
        success: false,
        error: message,
        retryAfter
      });
      return;
    }

    entry.count++;
    next();
  };
};

// Rate limiters for auth endpoints
const loginLimiter = createRateLimiter(
  15 * 60 * 1000,  // 15 minutes
  5,                // 5 attempts
  'Too many login attempts. Please try again in 15 minutes.'
);

const registerLimiter = createRateLimiter(
  60 * 60 * 1000,  // 1 hour
  3,                // 3 attempts
  'Too many registration attempts. Please try again in 1 hour.'
);

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', registerLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email, username, password, name } = req.body;

    // Basic field validation
    if (!email || !username || !password) {
      res.status(400).json({ success: false, error: 'Email, username, and password are required' });
      return;
    }

    // Email format validation
    if (!validateEmail(email)) {
      res.status(400).json({ success: false, error: 'Invalid email format' });
      return;
    }

    // Username validation
    if (!validateUsername(username)) {
      res.status(400).json({
        success: false,
        error: 'Username must be 3-30 characters and contain only letters, numbers, and underscores'
      });
      return;
    }

    // Password strength validation
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      res.status(400).json({
        success: false,
        error: passwordCheck.errors.join('. ')
      });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        error: existingUser.email === email.toLowerCase() ? 'Email already registered' : 'Username already taken'
      });
      return;
    }

    // Hash password (cost factor 12 for production)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with default preferences
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password: hashedPassword,
        name: name || username,
        preferences: {
          create: {
            emailEnabled: true,
            smsEnabled: false,
            pushEnabled: true,
            dndEnabled: false,
          }
        }
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
      }
    });

    // Generate JWT
    const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, signOptions);

    res.status(201).json({
      success: true,
      user,
      token
    });
  } catch (error: any) {
    console.error('❌ Register error:', error);
    // Don't leak internal errors to client
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});


/**
 * POST /api/auth/login
 * Login existing user
 */
router.post('/login', loginLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    // Email format validation
    if (!validateEmail(email)) {
      res.status(400).json({ success: false, error: 'Invalid email format' });
      return;
    }

    // Find user (case-insensitive email)
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        bio: true,
        avatarUrl: true,
        password: true,
        createdAt: true,
      }
    });

    // Use same error message for both cases to prevent user enumeration
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    // Generate JWT
    const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, signOptions);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      user: userWithoutPassword,
      token
    });
  } catch (error: any) {
    console.error('❌ Login error:', error);
    // Don't leak internal errors to client
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

export { router as authRouter };

