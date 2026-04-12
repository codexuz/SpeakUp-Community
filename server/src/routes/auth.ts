import { Request, Response, Router } from 'express';
import prisma from '../prisma';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.password !== password) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      region: user.region,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, fullName, password, gender, region, avatarUrl } = req.body;
    if (!username || !fullName || !password) {
      res.status(400).json({ error: 'Username, fullName, and password are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const user = await prisma.user.create({
      data: { username, fullName, password, role: 'student', gender, region, avatarUrl },
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      region: user.region,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/auth/push-token
router.put('/push-token', async (req: Request, res: Response) => {
  try {
    const { userId, pushToken } = req.body;
    if (!userId || !pushToken) {
      res.status(400).json({ error: 'userId and pushToken are required' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { pushToken },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
