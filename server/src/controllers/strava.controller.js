import * as stravaAuth from "../services/stravaAuth.service.js";
import * as stravaSync from "../services/stravaSync.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getStatus = asyncHandler(async (req, res) => {
  const data = await stravaSync.getStatus(req.auth.userId);
  res.json(data);
});

export const getAuthUrl = asyncHandler(async (req, res) => {
  const { url } = stravaAuth.buildAuthUrl(req.auth.userId);
  res.json({ url });
});

export const callback = asyncHandler(async (req, res) => {
  const redirectTo = await stravaSync.handleCallback(req.query.code, req.query.state);
  res.redirect(302, redirectTo);
});

export const sync = asyncHandler(async (req, res) => {
  const data = await stravaSync.syncActivities(req.auth.userId);
  res.json(data);
});

export const disconnect = asyncHandler(async (req, res) => {
  const data = await stravaSync.disconnect(req.auth.userId);
  res.json(data);
});

export const listActivities = asyncHandler(async (req, res) => {
  const activities = await stravaSync.listActivities(req.auth.userId, req.query);
  res.json({ activities });
});

export const getActivity = asyncHandler(async (req, res) => {
  const enrich = req.query.enrich === "0" || req.query.enrich === "false" ? false : true;
  const data = await stravaSync.getActivity(req.auth.userId, req.params.id, { enrich });
  res.json(data);
});
