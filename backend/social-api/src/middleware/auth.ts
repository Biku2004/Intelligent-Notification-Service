import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// SECURITY: P0 Fix - Validate JWT_SECRET at module load
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key') {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set or using default value!');
  console.error('   Please set a strong JWT_SECRET in your .env file');
  process.exit(1);
}

export interface AuthRequest extends Request {
  userId?: string;
}


/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches userId to request
 */
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;

    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

/**
 * Optional Authentication Middleware
 * Attaches userId if token exists, but doesn't require it
 */
export const optionalAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      req.userId = decoded.userId;
    }

    next();
  } catch (error) {
    // Token invalid, but that's okay for optional auth
    next();
  }
};
