import type { NextFunction, Request, RequestHandler, Response } from "express";

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing route parameter: ${name}`);
  }
  return value;
}
