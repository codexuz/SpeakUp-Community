import { Request, Response, Router } from 'express';
import multer from 'multer';
import { AuthenticatedRequest, authenticateRequest, requireRole } from '../middleware/auth';
import { sendPushNotification, sendPushToMultiple } from '../notifications';
import prisma from '../prisma';
import { supabase } from '../supabase';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authenticateRequest);

// POST /api/responses — submit a speaking response (with audio upload)
router.post('/', requireRole('student'), upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const { questionId } = req.body;
    if (!questionId) {
      res.status(400).json({ error: 'questionId is required' });
      return;
    }

    const studentId = auth.userId;

    let remoteUrl: string | null = null;

    // Upload audio to Supabase Storage if file provided
    if (req.file) {
      const fileName = `${studentId}/${Date.now()}_${req.file.originalname || 'audio.m4a'}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audios')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype || 'audio/m4a',
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: publicData } = supabase.storage.from('audios').getPublicUrl(fileName);
        remoteUrl = publicData.publicUrl;
      }
    }

    const response = await prisma.response.create({
      data: {
        questionId: parseInt(questionId),
        studentId,
        remoteUrl,
      },
      include: {
        student: { select: { fullName: true } },
        question: { select: { qText: true } },
      },
    });

    // Notify all teachers about new submission
    const teachers = await prisma.user.findMany({
      where: { role: 'teacher', pushToken: { not: null } },
      select: { pushToken: true },
    });

    const teacherTokens = teachers
      .map((t: any) => t.pushToken)
      .filter((t: any): t is string => !!t);

    if (teacherTokens.length > 0) {
      await sendPushToMultiple(
        teacherTokens,
        'New Speaking Submission',
        `${response.student.fullName} submitted a response for: "${response.question.qText.slice(0, 50)}..."`,
        { type: 'new_submission', responseId: response.id.toString() }
      );
    }

    res.status(201).json({
      ...response,
      id: response.id.toString(), // BigInt serialization
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/responses/student/:id — student's responses
router.get('/student/:id', async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    if (auth.role === 'student' && auth.userId !== (req.params.id as string)) {
      res.status(403).json({ error: 'You do not have access to these responses' });
      return;
    }

    const responses = await prisma.response.findMany({
      where: { studentId: req.params.id as string },
      orderBy: { createdAt: 'desc' },
      include: {
        question: { select: { qText: true, part: true } },
      },
    });
    res.json(responses.map((r: any) => ({ ...r, id: r.id.toString() })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/responses/pending — ungraded responses (for teachers)
router.get('/pending', requireRole('teacher'), async (_req: Request, res: Response) => {
  try {
    const responses = await prisma.response.findMany({
      where: { teacherScore: null },
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

// GET /api/responses/community — all responses with student + question info
router.get('/community', async (_req: Request, res: Response) => {
  try {
    const responses = await prisma.response.findMany({
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

// PUT /api/responses/:id/grade — teacher grades a submission
router.put('/:id/grade', requireRole('teacher'), async (req: Request, res: Response) => {
  try {
    const { score, feedback } = req.body;
    if (score === undefined || score === null) {
      res.status(400).json({ error: 'score is required' });
      return;
    }

    const numScore = parseInt(score);
    if (isNaN(numScore) || numScore < 0 || numScore > 9) {
      res.status(400).json({ error: 'Score must be between 0 and 9' });
      return;
    }

    const response = await prisma.response.update({
      where: { id: BigInt(req.params.id as string) },
      data: { teacherScore: numScore, teacherFeedback: feedback || null },
      include: {
        student: { select: { id: true, fullName: true, pushToken: true } },
        question: { select: { qText: true } },
      },
    });

    // Notify the student about the grade
    if (response.student.pushToken) {
      await sendPushNotification(
        response.student.pushToken,
        'Your Speaking Was Graded!',
        `You received ${numScore}/9 for: "${response.question.qText.slice(0, 50)}..."`,
        { type: 'graded', responseId: response.id.toString() }
      );
    }

    res.json({ ...response, id: response.id.toString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/responses/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const responseToDelete = await prisma.response.findUnique({
      where: { id: BigInt(req.params.id as string) },
      select: { studentId: true },
    });

    if (!responseToDelete) {
      res.status(404).json({ error: 'Response not found' });
      return;
    }

    if (auth.role === 'student' && responseToDelete.studentId !== auth.userId) {
      res.status(403).json({ error: 'You do not have access to delete this response' });
      return;
    }

    await prisma.response.delete({ where: { id: BigInt(req.params.id as string) } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
