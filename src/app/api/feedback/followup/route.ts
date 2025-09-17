import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  processFollowupInteraction,
  type FollowUpQuestion,
  type InteractionRound,
} from "@/lib/llm";

const answerItemSchema = z.object({
  choice: z.enum(["yes", "no"]),
  text: z.string().max(500).optional(),
});

const followupSchema = z.object({
  feedbackId: z.string().cuid(),
  answers: z.record(answerItemSchema),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = followupSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { feedbackId, answers } = parsed.data;

  const feedback = await prisma.feedback.findUnique({
    where: { id: feedbackId, userId: session.user.id },
    select: {
      id: true,
      feedbackText: true,
      status: true,
      initialAnalysis: true,
      followUpQuestions: true,
      interactionRounds: true,
      analysisResult: true,
      user: {
        select: { survey: true },
      },
    },
  });

  if (!feedback) {
    return NextResponse.json({ error: "フィードバックが見つかりません" }, { status: 404 });
  }

  if (feedback.status === "COMPLETED") {
    return NextResponse.json({ analysis: feedback.analysisResult }, { status: 200 });
  }

  const interactionRounds = Array.isArray(feedback.interactionRounds)
    ? (feedback.interactionRounds as InteractionRound[])
    : [];

  const previousQuestions = Array.isArray(feedback.followUpQuestions)
    ? (feedback.followUpQuestions as FollowUpQuestion[])
    : [];

  const currentRound = {
    timestamp: new Date().toISOString(),
    questions: previousQuestions,
    answers,
  };

  const llmResponse = await processFollowupInteraction(
    feedback.feedbackText,
    feedback.user?.survey?.initialSurvey ?? null,
    interactionRounds,
    previousQuestions,
    answers
  );

  if (llmResponse.error) {
    return NextResponse.json({ error: llmResponse.error }, { status: 502 });
  }

  if (llmResponse.status === "completed") {
    await prisma.feedback.update({
      where: { id: feedback.id },
      data: {
        status: "COMPLETED",
        analysisResult: llmResponse.analysis ?? null,
        followUpQuestions: [],
        interactionRounds: [...interactionRounds, currentRound],
      },
    });

    return NextResponse.json({ analysis: llmResponse.analysis }, { status: 200 });
  }

  if (llmResponse.status === "pending_more_followup") {
    await prisma.feedback.update({
      where: { id: feedback.id },
      data: {
        status: "PENDING_FOLLOWUP",
        followUpQuestions: llmResponse.next_questions ?? [],
        interactionRounds: [...interactionRounds, currentRound],
      },
    });

    return NextResponse.json({
      feedbackId: feedback.id,
      follow_up_questions: llmResponse.next_questions ?? [],
    });
  }

  return NextResponse.json(
    { error: `Unexpected LLM status: ${llmResponse.status}` },
    { status: 500 }
  );
}
