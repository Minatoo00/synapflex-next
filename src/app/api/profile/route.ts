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

const genders = ["Male", "Female", "Other", "PreferNotToSay"] as const;

const occupations = [
  "KnowledgeWorker",
  "Creative",
  "Student",
  "Caregiver",
  "Healthcare",
  "Education",
  "Other",
  "PreferNotToSay",
] as const;

const deviceUsages = ["under2h", "2to4h", "4to6h", "6to8h", "over8h"] as const;

const surveySchema = z.object({
  age: z.string().max(3).optional().or(z.literal("")),
  gender: z.enum(genders, { required_error: "性別を選択してください" }),
  otherGender: z.string().max(40).optional().or(z.literal("")),
  occupation: z.enum(occupations, { required_error: "職業を選択してください" }),
  otherOccupation: z.string().max(80).optional().or(z.literal("")),
  sleepQuality: z.coerce.number().min(1).max(5),
  exerciseHabit: z.coerce.number().min(1).max(5),
  cognitiveStyle: z.array(z.enum(cognitiveStyles)).max(cognitiveStyles.length),
  thinkingSpeed: z.coerce.number().min(1).max(5),
  thinkingFlexibility: z.coerce.number().min(1).max(5),
  focusTime: z.array(z.enum(focusTimes)).max(focusTimes.length),
  deviceUsage: z.enum(deviceUsages, { required_error: "デバイス利用時間を選択してください" }),
  expectations: z.array(z.enum(expectations)).max(2),
}).superRefine((data, ctx) => {
  if (data.gender === "Other" && !data.otherGender?.trim()) {
    ctx.addIssue({
      path: ["otherGender"],
      code: z.ZodIssueCode.custom,
      message: "その他を選んだ場合は具体的に入力してください",
    });
  }
  if (data.occupation === "Other" && !data.otherOccupation?.trim()) {
    ctx.addIssue({
      path: ["otherOccupation"],
      code: z.ZodIssueCode.custom,
      message: "その他を選んだ場合は具体的に入力してください",
    });
  }
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
