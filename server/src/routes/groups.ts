import { Request, Response, Router } from 'express';
import { AuthenticatedRequest, authenticateRequest, requireRole } from '../middleware/auth';
import prisma from '../prisma';

const router = Router();

router.use(authenticateRequest);

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function ensureTeacherOwnsGroup(groupId: string, teacherId: string, res: Response) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return null;
  }

  if (group.teacherId !== teacherId) {
    res.status(403).json({ error: 'You do not have access to this group' });
    return null;
  }

  return group;
}

async function ensureGroupAccess(groupId: string, auth: { userId: string; role: string }, res: Response) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return null;
  }

  if (auth.role === 'teacher') {
    if (group.teacherId !== auth.userId) {
      res.status(403).json({ error: 'You do not have access to this group' });
      return null;
    }

    return group;
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_studentId: { groupId, studentId: auth.userId } },
  });

  if (!membership) {
    res.status(403).json({ error: 'You do not have access to this group' });
    return null;
  }

  return group;
}

// GET /api/groups/teacher/:teacherId
router.get('/teacher/:teacherId', requireRole('teacher'), async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    if (auth.userId !== (req.params.teacherId as string)) {
      res.status(403).json({ error: 'You do not have access to these groups' });
      return;
    }

    const groups = await prisma.group.findMany({
      where: { teacherId: req.params.teacherId as string },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true } } },
    });
    res.json(groups.map((g: any) => ({ ...g, member_count: g._count.members })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/groups/student/:studentId
router.get('/student/:studentId', requireRole('student'), async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    if (auth.userId !== (req.params.studentId as string)) {
      res.status(403).json({ error: 'You do not have access to these groups' });
      return;
    }

    const memberships = await prisma.groupMember.findMany({
      where: { studentId: req.params.studentId as string },
      include: {
        group: {
          include: { _count: { select: { members: true } } },
        },
      },
    });
    res.json(
      memberships.map((m: any) => ({
        ...m.group,
        member_count: m.group._count.members,
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/groups/:id — single group
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const access = await ensureGroupAccess(req.params.id as string, auth, res);
    if (!access) {
      return;
    }

    const group = await prisma.group.findUnique({
      where: { id: req.params.id as string },
      include: {
        teacher: { select: { fullName: true, avatarUrl: true } },
      },
    });
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    res.json(group);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/groups/:id/members
router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const access = await ensureGroupAccess(req.params.id as string, auth, res);
    if (!access) {
      return;
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId: req.params.id as string },
      orderBy: { joinedAt: 'asc' },
      include: {
        student: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });
    res.json(members.map((m: any) => ({ ...m, id: m.id.toString() })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/groups/:id/submissions
router.get('/:id/submissions', requireRole('teacher'), async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const group = await ensureTeacherOwnsGroup(req.params.id as string, auth.userId, res);
    if (!group) {
      return;
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId: group.id },
      select: { studentId: true },
    });
    const studentIds = members.map((m: any) => m.studentId);

    if (studentIds.length === 0) {
      res.json([]);
      return;
    }

    const responses = await prisma.response.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        question: { select: { qText: true, part: true } },
      },
    });
    res.json(responses.map((r: any) => ({ ...r, id: r.id.toString() })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/groups — create group
router.post('/', requireRole('teacher'), async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const referralCode = generateReferralCode();
    const group = await prisma.group.create({
      data: { name, description, teacherId: auth.userId, referralCode },
    });

    res.status(201).json(group);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/groups/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    if (auth.role !== 'teacher') {
      res.status(403).json({ error: 'You do not have access to update this group' });
      return;
    }

    const existingGroup = await ensureTeacherOwnsGroup(req.params.id as string, auth.userId, res);
    if (!existingGroup) {
      return;
    }

    const { name, description } = req.body;
    const group = await prisma.group.update({
      where: { id: existingGroup.id },
      data: { name, description },
    });
    res.json(group);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/groups/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    if (auth.role !== 'teacher') {
      res.status(403).json({ error: 'You do not have access to delete this group' });
      return;
    }

    const group = await ensureTeacherOwnsGroup(req.params.id as string, auth.userId, res);
    if (!group) {
      return;
    }

    await prisma.group.delete({ where: { id: group.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/groups/:id/regenerate-code
router.post('/:id/regenerate-code', requireRole('teacher'), async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const group = await ensureTeacherOwnsGroup(req.params.id as string, auth.userId, res);
    if (!group) {
      return;
    }

    const newCode = generateReferralCode();
    await prisma.group.update({
      where: { id: group.id },
      data: { referralCode: newCode },
    });
    res.json({ referralCode: newCode });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/groups/join
router.post('/join', requireRole('student'), async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const { referralCode } = req.body;
    if (!referralCode) {
      res.status(400).json({ error: 'referralCode is required' });
      return;
    }

    const studentId = auth.userId;

    const group = await prisma.group.findUnique({
      where: { referralCode: referralCode.toUpperCase().trim() },
    });
    if (!group) {
      res.status(404).json({ error: 'Invalid referral code' });
      return;
    }

    // Check existing membership
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_studentId: { groupId: group.id, studentId } },
    });
    if (existing) {
      res.status(409).json({ error: 'You are already a member of this group' });
      return;
    }

    await prisma.groupMember.create({
      data: { groupId: group.id, studentId },
    });

    res.json(group);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/groups/:id/leave
router.post('/:id/leave', requireRole('student'), async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    await prisma.groupMember.delete({
      where: { groupId_studentId: { groupId: req.params.id as string, studentId: auth.userId } },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/groups/:id/remove-member
router.post('/:id/remove-member', requireRole('teacher'), async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const group = await ensureTeacherOwnsGroup(req.params.id as string, auth.userId, res);
    if (!group) {
      return;
    }

    const { studentId } = req.body;
    if (!studentId) {
      res.status(400).json({ error: 'studentId is required' });
      return;
    }

    await prisma.groupMember.delete({
      where: { groupId_studentId: { groupId: group.id, studentId } },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
