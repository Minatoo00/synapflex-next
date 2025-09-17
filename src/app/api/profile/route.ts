import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const cognitiveStyles = [
  "multiTasking",
  "singleFocus",
  "intuitive",
  "planning",
  "persistent",
  "ruminative",
  "sensitive",
  "moodDependent",
] as const;

const focusTimes = [
  "earlyMorning",
  "lateMorning",
  "earlyAfternoon",
  "lateAfternoon",
  "evening",
  "night",
] as const;

const expectations = [
  "understanding",
  "immediateAction",
  "longTermPlan",
  "selfTherapy",
  "community",
  "other",
] as const;

const surveySchema = z.object({
  age: z.string().max(3).optional().or(z.literal("")),
  gender: z.string(),
  otherGender: z.string().optional().or(z.literal("")),
  occupation: z.string(),
  otherOccupation: z.string().optional().or(z.literal("")),
  sleepQuality: z.coerce.number().min(1).max(5),
  exerciseHabit: z.coerce.number().min(1).max(5),
  cognitiveStyle: z.array(z.enum(cognitiveStyles)).max(cognitiveStyles.length),
  thinkingSpeed: z.coerce.number().min(1).max(5),
  thinkingFlexibility: z.coerce.number().min(1).max(5),
  focusTime: z.array(z.enum(focusTimes)).max(focusTimes.length),
  deviceUsage: z.string(),
  expectations: z.array(z.enum(expectations)).max(2),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      survey: true,
      surveyCompleted: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = surveySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      survey: {
        initialSurvey: payload,
        surveySubmittedAt: new Date().toISOString(),
      },
      surveyCompleted: true,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
