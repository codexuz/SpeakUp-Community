import bcrypt from 'bcryptjs';
import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

export interface AuthTokenClaims {
  userId: string;
  role: string;
  username: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthTokenClaims;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function isPasswordHash(value: string) {
  return value.startsWith('$2a$') || value.startsWith('$2b$') || value.startsWith('$2y$');
}

export function signAuthToken(payload: AuthTokenClaims) {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];

  return jwt.sign(
    {
      role: payload.role,
      username: payload.username,
    },
    getJwtSecret(),
    {
      expiresIn,
      subject: payload.userId,
    }
  );
}

export function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization token is required' });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    const subject = typeof decoded.sub === 'string' ? decoded.sub : null;

    if (!subject || typeof decoded.role !== 'string' || typeof decoded.username !== 'string') {
      res.status(401).json({ error: 'Invalid authorization token' });
      return;
    }

    (req as AuthenticatedRequest).auth = {
      userId: subject,
      role: decoded.role,
      username: decoded.username,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authorization token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({ error: 'Authentication is required' });
      return;
    }

    if (!roles.includes(auth.role)) {
      res.status(403).json({ error: 'You do not have access to this resource' });
      return;
    }

    next();
  };
}