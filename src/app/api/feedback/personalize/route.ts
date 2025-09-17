import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { personalizeSuggestions } from "@/lib/llm";

const personalizeSchema = z.object({
  feedbackId: z.string().cuid(),
  selectedTypes: z.array(z.string()).min(1).max(5),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = personalizeSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { feedbackId, selectedTypes } = parsed.data;

  const feedback = await prisma.feedback.findUnique({
    where: { id: feedbackId, userId: session.user.id },
    select: { analysisResult: true },
  });

  if (!feedback?.analysisResult) {
    return NextResponse.json(
      { error: "解析結果がまだ得られていません" },
      { status: 400 }
    );
  }

  const hypothesis = (feedback.analysisResult as any)?.hypothesis;
  if (!hypothesis) {
    return NextResponse.json(
      { error: "原因仮説が見つかりません" },
      { status: 400 }
    );
  }

  const suggestions = await personalizeSuggestions(hypothesis, selectedTypes);

  if (suggestions.error) {
    return NextResponse.json({ error: suggestions.error }, { status: 502 });
  }

  await prisma.feedback.update({
    where: { id: feedbackId },
    data: { personalizedSuggestions: suggestions },
  });

  return NextResponse.json({ feedbackId, ...suggestions });
}
