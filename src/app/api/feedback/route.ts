import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  analyzeFeedbackAndGenerateQuestions,
  generateFinalAnalysis,
} from "@/lib/llm";

const feedbackSchema = z.object({
  feedback: z
    .string()
    .min(16, "もう少し詳しく状況を教えていただけると助かります")
    .max(4000, "フィードバックは4000文字以内で入力してください"),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = feedbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { feedback } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { survey: true },
  });

  const profile = user?.survey?.initialSurvey ?? null;

  const initialAnalysis = await analyzeFeedbackAndGenerateQuestions(feedback, profile);

  if (initialAnalysis.error) {
    return NextResponse.json({ error: initialAnalysis.error }, { status: 502 });
  }

  const followUpQuestions = initialAnalysis.follow_up_questions ?? [];

  const feedbackRecord = await prisma.feedback.create({
    data: {
      userId: session.user.id,
      feedbackText: feedback,
      status: followUpQuestions.length > 0 ? "PENDING_FOLLOWUP" : "COMPLETED",
      initialAnalysis,
      followUpQuestions,
      interactionRounds: [],
      analysisResult: followUpQuestions.length === 0 ? initialAnalysis : null,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  let responsePayload: Record<string, unknown> = {
    feedbackId: feedbackRecord.id,
    brain_activity_candidates: initialAnalysis.brain_activity_candidates,
    behavioral_pattern_candidates: initialAnalysis.behavioral_pattern_candidates,
    initial_analysis_summary: initialAnalysis.initial_analysis_summary,
    follow_up_questions: followUpQuestions,
  };

  if (followUpQuestions.length === 0) {
    const forcedFinal = await generateFinalAnalysis(feedback, profile, []);
    if (!forcedFinal.error) {
      await prisma.feedback.update({
        where: { id: feedbackRecord.id },
        data: {
          status: "COMPLETED",
          analysisResult: forcedFinal.analysis ?? null,
        },
      });
      responsePayload = {
        feedbackId: feedbackRecord.id,
        analysis: forcedFinal.analysis,
      };
    }
  }

  return NextResponse.json(responsePayload, { status: 200 });
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "20");

  const history = await prisma.feedback.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      createdAt: true,
      feedbackText: true,
      status: true,
      initialAnalysis: true,
      followUpQuestions: true,
      analysisResult: true,
      personalizedSuggestions: true,
    },
  });

  return NextResponse.json({ history });
}
