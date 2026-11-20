import { Router } from "express";
import { getVolumes } from "../core/volumes";
import { asyncHandler } from "./helpers";

export function createVolumesRouter(): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const force = req.query.refresh === "1";
      res.json(await getVolumes(force));
    })
  );

  return router;
}
