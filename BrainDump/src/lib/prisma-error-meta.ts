/** Extract Prisma-style { code, message } from thrown errors. */

export function prismaErrorMeta(e: unknown): { code?: string; message: string } {
  if (e && typeof e === "object") {
    const o = e as { code?: string; message?: unknown };
    return {
      code: typeof o.code === "string" ? o.code : undefined,
      message: typeof o.message === "string" ? o.message : String(e),
    };
  }
  return { message: String(e) };
}
