import * as openPlayService from "../services/openPlay.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getHub = asyncHandler(async (req, res) => {
  const data = await openPlayService.getHub(req.auth.userId, req.query);
  res.json(data);
});

export const listMine = asyncHandler(async (req, res) => {
  const data = await openPlayService.getMine(req.auth.userId);
  res.json(data);
});

export const create = asyncHandler(async (req, res) => {
  const event = await openPlayService.create(req.auth.userId, req.body);
  res.status(201).json({ event });
});

export const getDetail = asyncHandler(async (req, res) => {
  const data = await openPlayService.getDetail(req.auth.userId, req.params.id);
  res.json(data);
});

export const update = asyncHandler(async (req, res) => {
  const event = await openPlayService.update(req.auth.userId, req.params.id, req.body);
  res.json({ event });
});

export const join = asyncHandler(async (req, res) => {
  const event = await openPlayService.join(req.auth.userId, req.params.id, req.body);
  res.json({ event });
});

export const leave = asyncHandler(async (req, res) => {
  const event = await openPlayService.leave(req.auth.userId, req.params.id);
  res.json({ event });
});

export const listChat = asyncHandler(async (req, res) => {
  const data = await openPlayService.listChat(
    req.auth.userId,
    req.params.id,
    req.query.after || null
  );
  res.json(data);
});

export const sendChat = asyncHandler(async (req, res) => {
  const message = await openPlayService.sendChat(req.auth.userId, req.params.id, req.body);
  res.status(201).json({ message });
});

export const decide = asyncHandler(async (req, res) => {
  const data = await openPlayService.decide(
    req.auth.userId,
    req.params.id,
    req.params.userId,
    req.body?.decision
  );
  res.json(data);
});
