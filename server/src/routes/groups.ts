import { Request, Response, Router } from 'express';
import prisma from '../prisma';

const router = Router();

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/groups/teacher/:teacherId
router.get('/teacher/:teacherId', async (req: Request, res: Response) => {
  try {
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
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
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
router.get('/:id/submissions', async (req: Request, res: Response) => {
  try {
    const members = await prisma.groupMember.findMany({
      where: { groupId: req.params.id as string },
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, teacherId } = req.body;
    if (!name || !teacherId) {
      res.status(400).json({ error: 'name and teacherId are required' });
      return;
    }

    const referralCode = generateReferralCode();
    const group = await prisma.group.create({
      data: { name, description, teacherId, referralCode },
    });

    res.status(201).json(group);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/groups/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const group = await prisma.group.update({
      where: { id: req.params.id as string },
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
    await prisma.group.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/groups/:id/regenerate-code
router.post('/:id/regenerate-code', async (req: Request, res: Response) => {
  try {
    const newCode = generateReferralCode();
    await prisma.group.update({
      where: { id: req.params.id as string },
      data: { referralCode: newCode },
    });
    res.json({ referralCode: newCode });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/groups/join
router.post('/join', async (req: Request, res: Response) => {
  try {
    const { referralCode, studentId } = req.body;
    if (!referralCode || !studentId) {
      res.status(400).json({ error: 'referralCode and studentId are required' });
      return;
    }

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
router.post('/:id/leave', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.body;
    await prisma.groupMember.delete({
      where: { groupId_studentId: { groupId: req.params.id as string, studentId } },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/groups/:id/remove-member
router.post('/:id/remove-member', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.body;
    await prisma.groupMember.delete({
      where: { groupId_studentId: { groupId: req.params.id as string, studentId } },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
