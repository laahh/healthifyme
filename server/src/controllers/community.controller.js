import * as communityService from "../services/community.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getHub = asyncHandler(async (req, res) => {
  const data = await communityService.getHub(req.auth.userId, req.query);
  res.json(data);
});

export const listSports = asyncHandler(async (_req, res) => {
  const sports = await communityService.getSports();
  res.json({ sports });
});

export const listMine = asyncHandler(async (req, res) => {
  const communities = await communityService.getMine(req.auth.userId);
  res.json({ communities });
});

export const getDetail = asyncHandler(async (req, res) => {
  const data = await communityService.getDetail(req.auth.userId, req.params.id);
  res.json(data);
});

export const create = asyncHandler(async (req, res) => {
  const community = await communityService.create(req.auth.userId, req.body);
  res.status(201).json({ community });
});

export const update = asyncHandler(async (req, res) => {
  const community = await communityService.update(req.auth.userId, req.params.id, req.body);
  res.json({ community });
});

export const join = asyncHandler(async (req, res) => {
  const community = await communityService.join(req.auth.userId, req.params.id);
  res.json({ community });
});

export const leave = asyncHandler(async (req, res) => {
  const data = await communityService.leave(req.auth.userId, req.params.id);
  res.json(data);
});

export const listCommunityEvents = asyncHandler(async (req, res) => {
  const events = await communityService.listEvents(req.auth.userId, {
    communityId: req.params.id,
    eventType: req.query.type,
  });
  res.json({ events });
});

export const createCommunityEvent = asyncHandler(async (req, res) => {
  const event = await communityService.createEvent(req.auth.userId, req.params.id, req.body);
  res.status(201).json({ event });
});

export const getEvent = asyncHandler(async (req, res) => {
  const event = await communityService.getEvent(req.auth.userId, req.params.eventId);
  res.json({ event });
});

export const rsvpEvent = asyncHandler(async (req, res) => {
  const joinFlag = req.body?.join !== false;
  const event = await communityService.rsvp(req.auth.userId, req.params.eventId, joinFlag);
  res.json({ event });
});

export const listPosts = asyncHandler(async (req, res) => {
  const posts = await communityService.listPosts(req.auth.userId, req.params.id);
  res.json({ posts });
});

export const createPost = asyncHandler(async (req, res) => {
  const post = await communityService.createPost(req.auth.userId, req.params.id, req.body);
  res.status(201).json({ post });
});

export const toggleLike = asyncHandler(async (req, res) => {
  const post = await communityService.toggleLike(req.auth.userId, req.params.postId);
  res.json({ post });
});

export const addComment = asyncHandler(async (req, res) => {
  const comment = await communityService.comment(
    req.auth.userId,
    req.params.postId,
    req.body?.body,
    req.body?.parent_id
  );
  res.status(201).json({ comment });
});

export const listComments = asyncHandler(async (req, res) => {
  const comments = await communityService.listComments(req.params.postId);
  res.json({ comments });
});

export const listChat = asyncHandler(async (req, res) => {
  const messages = await communityService.listChat(req.auth.userId, req.params.id, req.query.after);
  res.json({ messages });
});

export const sendChat = asyncHandler(async (req, res) => {
  const message = await communityService.sendChat(req.auth.userId, req.params.id, req.body?.body);
  res.status(201).json({ message });
});

export const listSparring = asyncHandler(async (_req, res) => {
  const items = await communityService.listSparring();
  res.json({ sparring: items });
});

export const createSparring = asyncHandler(async (req, res) => {
  const item = await communityService.createSparring(req.auth.userId, req.body);
  res.status(201).json({ sparring: item });
});

export const patchSparring = asyncHandler(async (req, res) => {
  const item = await communityService.patchSparring(req.params.id, req.body);
  res.json({ sparring: item });
});

export const listCoaching = asyncHandler(async (req, res) => {
  const events = await communityService.listCoaching(req.auth.userId);
  res.json({ events });
});

export const listCompetitions = asyncHandler(async (_req, res) => {
  const competitions = await communityService.listCompetitions();
  res.json({ competitions });
});

export const competitionStandings = asyncHandler(async (req, res) => {
  const standings = await communityService.competitionStandings(req.params.id);
  res.json({ standings });
});

export const leaderboard = asyncHandler(async (_req, res) => {
  const leaderboard = await communityService.leaderboard();
  res.json({ leaderboard });
});

export const communityLeaderboard = asyncHandler(async (req, res) => {
  const leaderboard = await communityService.leaderboardForCommunity(req.params.id);
  res.json({ leaderboard });
});

export const myBadges = asyncHandler(async (req, res) => {
  const data = await communityService.myBadges(req.auth.userId);
  res.json(data);
});
