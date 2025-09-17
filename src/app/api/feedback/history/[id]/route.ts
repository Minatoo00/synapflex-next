import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { id: string };
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const feedback = await prisma.feedback.findUnique({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });

  if (!feedback) {
    return NextResponse.json({ error: "対象の履歴が見つかりません" }, { status: 404 });
  }

  await prisma.feedback.delete({ where: { id: feedback.id } });

  return NextResponse.json({ success: true });
}
