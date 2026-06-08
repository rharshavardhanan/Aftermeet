"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateTaskSchema, type UpdateTaskInput } from "@/lib/validations";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function assertOwner(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { userId: true } });
  return task?.userId === userId;
}

export async function updateTask(input: UpdateTaskInput): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid task update." };
  if (!(await assertOwner(parsed.data.id, session.user.id)))
    return { ok: false, error: "Not found" };

  const { id, ...rest } = parsed.data;
  await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      dueDate: rest.dueDate === undefined ? undefined : rest.dueDate ? new Date(rest.dueDate) : null,
    },
  });
  revalidatePath("/dashboard");
  return { ok: true, data: null };
}

export async function toggleTaskDone(id: string, done: boolean): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!(await assertOwner(id, session.user.id))) return { ok: false, error: "Not found" };
  await prisma.task.update({ where: { id }, data: { status: done ? "DONE" : "OPEN" } });
  revalidatePath("/dashboard");
  return { ok: true, data: null };
}

export async function archiveTask(id: string): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!(await assertOwner(id, session.user.id))) return { ok: false, error: "Not found" };
  await prisma.task.update({ where: { id }, data: { status: "ARCHIVED" } });
  revalidatePath("/dashboard");
  return { ok: true, data: null };
}
