/**
 * Authentication Routes
 * /api/auth/register - Register new user
 * /api/auth/login - Login existing user
 */
import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, username, password, name } = req.body;

    // Validation
    if (!email || !username || !password) {
      res.status(400).json({ success: false, error: 'Email, username, and password are required' });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      res.status(409).json({ 
        success: false, 
        error: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with default preferences
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name: name || username,
        preferences: {
          create: {
            emailEnabled: true,
            smsEnabled: false,
            pushEnabled: true,
            marketing: false,
            activity: true,
            social: true,
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
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      success: true,
      user,
      token
    });
  } catch (error: any) {
    console.error('❌ Register error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Login existing user
 */
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
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
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      user: userWithoutPassword,
      token
    });
  } catch (error: any) {
    console.error('❌ Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as authRouter };
