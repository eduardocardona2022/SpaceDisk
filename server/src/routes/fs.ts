import { Router } from "express";
import { z } from "zod";
import { listDirectories } from "../core/fsBrowse";
import { asyncHandler } from "./helpers";

const querySchema = z.object({
  path: z.string().min(1).max(32_767)
});

export function createFsRouter(): Router {
  const router = Router();

  router.get(
    "/dirs",
    asyncHandler(async (req, res) => {
      const query = querySchema.parse(req.query);
      res.json(await listDirectories(query.path));
    })
  );

  return router;
}
