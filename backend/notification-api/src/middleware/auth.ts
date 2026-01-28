/**
 * Authentication Middleware for Notification API
 * Validates JWT tokens and protects endpoints from unauthorized access
 * 
 * SECURITY: P0 Fix #4 - Add auth middleware to notification-api
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Validate JWT_SECRET at module load
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
 * Required Authentication Middleware
 * Returns 401 if no valid token is provided
 */
export const authMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: 'Authorization required. Please provide a valid token.'
            });
            return;
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
            req.userId = decoded.userId;
            next();
        } catch (jwtError) {
            res.status(401).json({
                success: false,
                error: 'Invalid or expired token. Please login again.'
            });
            return;
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

/**
 * Optional Authentication Middleware
 * Attaches userId if token is valid, but allows request to proceed if not
 */
export const optionalAuthMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            next();
            return;
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
            req.userId = decoded.userId;
        } catch {
            // Token invalid, but we allow the request to proceed
        }

        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        next();
    }
};

/**
 * Authorization check: Verify the authenticated user can access this resource
 * Use after authMiddleware to verify userId param matches authenticated user
 */
export const authorizeUser = (paramName: string = 'userId') => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        const resourceUserId = req.params[paramName];

        if (!resourceUserId) {
            res.status(400).json({
                success: false,
                error: 'User ID parameter is required'
            });
            return;
        }

        if (req.userId !== resourceUserId) {
            res.status(403).json({
                success: false,
                error: 'Forbidden: You can only access your own resources'
            });
            return;
        }

        next();
    };
};
