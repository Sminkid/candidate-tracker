import { Router } from "express";
import type { Summarizer } from "../ai/summarizer";
import type { Database } from "../db";
import * as candidateService from "../services/candidateService";
import {
  addNoteBody,
  candidateIdParams,
  createCandidateBody,
  listCandidatesQuery,
  moveStageBody,
} from "./candidateSchemas";
import { validate } from "./http";

// HTTP only: validate the request with Zod, call one service function, send JSON.
// Any thrown error (bad input, not found, unexpected) goes to the error handler in http.ts.

export type CandidatesRouterDependencies = {
  db: Database;
  summarizer: Summarizer;
};

export function createCandidatesRouter({ db, summarizer }: CandidatesRouterDependencies): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const input = validate(createCandidateBody, req.body);
    const candidate = await candidateService.createCandidate(db, input);
    res.status(201).json(candidate);
  });

  router.get("/", async (req, res) => {
    const query = validate(listCandidatesQuery, req.query);
    const candidates = await candidateService.listCandidates(db, query);
    res.json(candidates);
  });

  router.get("/:id", async (req, res) => {
    const { id } = validate(candidateIdParams, req.params);
    res.json(await candidateService.getCandidate(db, id));
  });

  router.patch("/:id/stage", async (req, res) => {
    const { id } = validate(candidateIdParams, req.params);
    const { stage } = validate(moveStageBody, req.body);
    res.json(await candidateService.moveStage(db, id, stage));
  });

  router.post("/:id/archive", async (req, res) => {
    const { id } = validate(candidateIdParams, req.params);
    res.json(await candidateService.archiveCandidate(db, id));
  });

  router.post("/:id/notes", async (req, res) => {
    const { id } = validate(candidateIdParams, req.params);
    const { body } = validate(addNoteBody, req.body);
    res.status(201).json(await candidateService.addNote(db, id, body));
  });

  // Always 200 when the candidate exists: an AI failure is reported in the
  // returned candidate (summaryStatus + summaryReason), not as an HTTP error.
  router.post("/:id/summary", async (req, res) => {
    const { id } = validate(candidateIdParams, req.params);
    res.json(await candidateService.generateSummary(db, id, { summarizer }));
  });

  return router;
}
