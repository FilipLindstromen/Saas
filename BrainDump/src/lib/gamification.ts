/**
 * Dual-track gamification: voice/text dumps (capture) and completing tasks.
 * XP is derived from lifetime counters; levels use a gentle escalating curve.
 */
import type { PrismaClient } from "../../prisma/generated/prisma/client";

export const XP_PER_DUMP_CAPTURE = 18;
export const XP_PER_TASK_COMPLETE = 28;

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

export type GamificationTrackSnapshot = {
  count: number;
  xp: number;
  level: number;
  rankKey: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPct: number;
};

export type GamificationClientPayload = {
  capture: GamificationTrackSnapshot;
  task: GamificationTrackSnapshot;
  /** Present on mutation responses: what to celebrate in the UI */
  celebrate?: {
    dumpCapture?: boolean;
    taskDone?: boolean;
    levelUpCapture?: boolean;
    levelUpTask?: boolean;
  };
};

function xpToReachNextLevel(fromLevel: number): number {
  return 40 + fromLevel * 16;
}

export function cumulativeXpToEnterLevel(level: number): number {
  if (level <= 1) return 0;
  let s = 0;
  for (let k = 1; k < level; k++) {
    s += xpToReachNextLevel(k);
  }
  return s;
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  for (let guard = 0; guard < 999; guard++) {
    const nextThreshold = cumulativeXpToEnterLevel(level + 1);
    if (totalXp < nextThreshold) break;
    level++;
  }
  return level;
}

function rankKeyForLevel(level: number): string {
  const idx = Math.min(8, Math.max(1, 1 + Math.floor((level - 1) / 3)));
  return `gamification.rank.${idx}`;
}

export function trackFromCount(count: number, xpPerUnit: number): GamificationTrackSnapshot {
  const xp = Math.max(0, count) * xpPerUnit;
  const level = levelFromXp(xp);
  const start = cumulativeXpToEnterLevel(level);
  const xpIntoLevel = xp - start;
  const xpForNextLevel = xpToReachNextLevel(level);
  const progressPct =
    xpForNextLevel > 0 ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)) : 100;
  return {
    count: Math.max(0, count),
    xp,
    level,
    rankKey: rankKeyForLevel(level),
    xpIntoLevel,
    xpForNextLevel,
    progressPct,
  };
}

export function snapshotFromRow(row: {
  dumpsCapturedCount: number;
  tasksCompletedLifetime: number;
}): Omit<GamificationClientPayload, "celebrate"> {
  return {
    capture: trackFromCount(row.dumpsCapturedCount, XP_PER_DUMP_CAPTURE),
    task: trackFromCount(row.tasksCompletedLifetime, XP_PER_TASK_COMPLETE),
  };
}

export async function ensureUserGamification(tx: Tx, userId: string) {
  const existing = await tx.userGamification.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  const [dumpCount, taskBaseline] = await Promise.all([
    tx.dump.count({ where: { userId } }),
    tx.organizedItem.count({
      where: {
        userId,
        deletedAt: null,
        OR: [
          { itemType: "task_completed" },
          {
            itemType: { in: ["task", "task_completed"] },
            progress: "completed",
          },
          {
            itemType: { in: ["task", "task_completed"] },
            kanbanColumn: "completed",
          },
        ],
      },
    }),
  ]);

  return tx.userGamification.create({
    data: {
      userId,
      dumpsCapturedCount: dumpCount,
      tasksCompletedLifetime: taskBaseline,
    },
  });
}

export function isTaskCompletableItem(itemType: string): boolean {
  return itemType === "task" || itemType === "task_completed";
}

export function itemRepresentsCompletedTask(state: {
  itemType: string;
  progress: string;
  kanbanColumn: string | null;
}): boolean {
  if (!isTaskCompletableItem(state.itemType)) return false;
  return (
    state.itemType === "task_completed" ||
    state.progress === "completed" ||
    state.kanbanColumn === "completed"
  );
}

export async function recordDumpCaptured(client: PrismaClient, userId: string): Promise<GamificationClientPayload> {
  const [dumpCount, taskBaseline] = await Promise.all([
    client.dump.count({ where: { userId } }),
    countCompletedTasksForUser(client, userId),
  ]);
  const beforeRow = await client.userGamification.findUnique({ where: { userId } });
  const snapBefore = beforeRow ? snapshotFromRow(beforeRow) : null;

  const afterRow = await client.userGamification.upsert({
    where: { userId },
    create: {
      userId,
      dumpsCapturedCount: dumpCount,
      tasksCompletedLifetime: taskBaseline,
    },
    update: {
      dumpsCapturedCount: { increment: 1 },
    },
  });

  const snapAfter = snapshotFromRow(afterRow);
  const beforeCapture =
    snapBefore?.capture ??
    trackFromCount(Math.max(0, afterRow.dumpsCapturedCount - 1), XP_PER_DUMP_CAPTURE);

  return {
    ...snapAfter,
    celebrate: {
      dumpCapture: true,
      levelUpCapture: snapAfter.capture.level > beforeCapture.level,
    },
  };
}

export async function recordTaskCompletions(
  client: PrismaClient,
  userId: string,
  delta: number
): Promise<GamificationClientPayload | null> {
  if (delta <= 0) return null;
  const existing = await client.userGamification.findUnique({ where: { userId } });
  if (!existing) {
    const row = await ensureUserGamification(client, userId);
    const snapAfter = snapshotFromRow(row);
    const snapBefore = snapshotFromRow({
      dumpsCapturedCount: row.dumpsCapturedCount,
      tasksCompletedLifetime: Math.max(0, row.tasksCompletedLifetime - delta),
    });
    return {
      ...snapAfter,
      celebrate: {
        taskDone: true,
        levelUpTask: snapAfter.task.level > snapBefore.task.level,
      },
    };
  }
  const snapBefore = snapshotFromRow(existing);
  const after = await client.userGamification.update({
    where: { userId },
    data: { tasksCompletedLifetime: { increment: delta } },
  });
  const snapAfter = snapshotFromRow(after);
  return {
    ...snapAfter,
    celebrate: {
      taskDone: true,
      levelUpTask: snapAfter.task.level > snapBefore.task.level,
    },
  };
}

export async function maybeRecordSingleTaskCompletion(
  client: PrismaClient,
  userId: string,
  before: { itemType: string; progress: string; kanbanColumn: string | null },
  after: { itemType: string; progress: string; kanbanColumn: string | null }
): Promise<GamificationClientPayload | null> {
  if (!isTaskCompletableItem(before.itemType) && !isTaskCompletableItem(after.itemType)) {
    return null;
  }
  const was = itemRepresentsCompletedTask(before);
  const now = itemRepresentsCompletedTask(after);
  if (was || !now) return null;
  return recordTaskCompletions(client, userId, 1);
}
