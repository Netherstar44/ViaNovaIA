import { Router } from "express";
import { requireAuth, sanitizeSingleLine } from "../security.js";
import { writeLimiter } from "../rate-limits.js";
import {
  establishTripRoute,
  generateTripPlan,
  getLatestTrip,
  getTripById,
} from "../trips.js";

export const tripsRouter = Router();

function intInRange(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

tripsRouter.get("/latest", requireAuth, async (req: any, res, next) => {
  try {
    const trip = await getLatestTrip(req.user.username);
    res.json({ trip });
  } catch (error) {
    next(error);
  }
});

tripsRouter.get("/:id", requireAuth, async (req: any, res, next) => {
  try {
    const trip = await getTripById(req.params.id, req.user.username);
    res.json({ trip });
  } catch (error) {
    next(error);
  }
});

tripsRouter.post("/generate", requireAuth, writeLimiter, async (req: any, res, next) => {
  try {
    const body = req.body || {};
    const destinationCity = sanitizeSingleLine(body.destinationCity, 80) || "Neiva";
    const originCity = sanitizeSingleLine(body.originCity, 80) || null;
    const days = intInRange(body.days, 3, 1, 7);
    const travelers = intInRange(body.travelers, 2, 1, 10);
    const parsedBudget = Number(body.budget);
    const budget = Number.isFinite(parsedBudget) && parsedBudget > 0
      ? Math.min(Math.round(parsedBudget), 100_000_000)
      : null;

    const trip = await generateTripPlan({
      userId: req.user.id,
      username: req.user.username,
      destinationCity,
      originCity,
      days,
      travelers,
      budget,
    });

    res.status(201).json({ trip });
  } catch (error) {
    next(error);
  }
});

tripsRouter.post("/:id/route/establish", requireAuth, writeLimiter, async (req: any, res, next) => {
  try {
    const result = await establishTripRoute(req.params.id, req.user.username, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
