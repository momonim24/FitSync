/**
 * Runtime shape checks for the Version 2.0 `fitness` sections of the
 * dashboards (QA fix H2).
 *
 * The TypeScript types describe what the current API sends, but a browser can
 * still receive something else — for example an older backend without the
 * `fitness` key, or a partial response. Each dashboard card checks ONLY the
 * data it renders; a card whose data is missing or malformed shows an
 * "unavailable" notice instead of crashing or showing invented zeros.
 */
import type { AdminFitness, FitnessGoal, MemberFitness, TrainerFeedback, TrainerFitness, TrainerFitnessMember } from '../api/types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const nums = (o: Obj, keys: string[]) => keys.every((k) => isNum(o[k]));
const listOf = <T>(v: unknown, item: (x: unknown) => boolean): v is T[] => Array.isArray(v) && v.every(item);

const isPerson = (v: unknown) => isObj(v) && isNum(v.userId) && isStr(v.fullName);

export const isGoal = (v: unknown): v is FitnessGoal =>
  isObj(v) && isNum(v.goalId) && isStr(v.goalName) && isStr(v.targetDate) && isObj(v.progress) && isStr(v.progress.state) && isNumOrNull(v.progress.progressPercent);

export const isFeedback = (v: unknown): v is TrainerFeedback =>
  isObj(v) && isNum(v.feedbackId) && isStr(v.feedbackMessage) && isStr(v.feedbackType) && isStr(v.createdAt);

const isAdherencePlan = (v: unknown) => isObj(v) && isNum(v.planId) && isStr(v.planName) && isNumOrNull(v.completionPercent);

// ------------------------------------------------------------------ member

export function memberPlanCompletion(f: unknown): MemberFitness['planCompletion'] | null {
  const pc = isObj(f) ? f.planCompletion : undefined;
  return isObj(pc) &&
    nums(pc, ['prescribedExercises', 'completedExercises', 'partialExercises', 'pendingExercises']) &&
    isNumOrNull(pc.completionPercent) &&
    listOf(pc.plans, isAdherencePlan)
    ? (pc as unknown as MemberFitness['planCompletion'])
    : null;
}

export function memberActiveGoals(f: unknown): FitnessGoal[] | null {
  const goals = isObj(f) ? f.activeGoals : undefined;
  return listOf<FitnessGoal>(goals, isGoal) ? goals : null;
}

export function memberFeedback(f: unknown): MemberFitness['feedback'] | null {
  const fb = isObj(f) ? f.feedback : undefined;
  return isObj(fb) && isNum(fb.unread) && listOf(fb.recent, isFeedback) ? (fb as unknown as MemberFitness['feedback']) : null;
}

// ------------------------------------------------------------------ trainer

const isTrainerMember = (v: unknown): v is TrainerFitnessMember =>
  isObj(v) && isPerson(v.member) && isNumOrNull(v.completionPercent) && listOf(v.attentionReasons, isStr);

export function trainerSummary(f: unknown): TrainerFitness['summary'] | null {
  const s = isObj(f) ? f.summary : undefined;
  return isObj(s) &&
    isNumOrNull(s.averageCompletionPercent) &&
    nums(s, ['membersWithPlans', 'membersRequiringAttention', 'activeGoals', 'goalsOnTrack', 'goalsBehind', 'goalsNoData', 'feedbackSentLast30Days', 'feedbackUnreadByMembers'])
    ? (s as unknown as TrainerFitness['summary'])
    : null;
}

export function trainerMembers(f: unknown): TrainerFitnessMember[] | null {
  const m = isObj(f) ? f.members : undefined;
  return listOf<TrainerFitnessMember>(m, isTrainerMember) ? m : null;
}

export function trainerCriteria(f: unknown): string[] | null {
  const c = isObj(f) ? f.attentionCriteria : undefined;
  return listOf<string>(c, isStr) ? c : null;
}

export function trainerRecentFeedback(f: unknown): TrainerFeedback[] | null {
  const r = isObj(f) ? f.recentFeedback : undefined;
  return listOf<TrainerFeedback>(r, isFeedback) ? r : null;
}

export function trainerActiveGoals(f: unknown): FitnessGoal[] | null {
  const g = isObj(f) ? f.activeGoals : undefined;
  return listOf<FitnessGoal>(g, isGoal) ? g : null;
}

// ------------------------------------------------------------------ admin

export function adminCompletion(f: unknown): AdminFitness['completion'] | null {
  const c = isObj(f) ? f.completion : undefined;
  return isObj(c) &&
    isNumOrNull(c.averageCompletionPercent) &&
    nums(c, ['membersWithPlans', 'prescribedExercises', 'completedExercises', 'partialExercises', 'pendingExercises', 'planWorkouts', 'otherWorkouts'])
    ? (c as unknown as AdminFitness['completion'])
    : null;
}

export function adminGoals(f: unknown): AdminFitness['goals'] | null {
  const g = isObj(f) ? f.goals : undefined;
  return isObj(g) &&
    isNum(g.total) &&
    isObj(g.byStatus) &&
    nums(g.byStatus, ['Active', 'Completed', 'Missed', 'Cancelled']) &&
    isObj(g.activeByState) &&
    nums(g.activeByState, ['onTrack', 'behind']) &&
    isNumOrNull(g.achievementRatePercent) &&
    isNumOrNull(g.averageActiveProgressPercent) &&
    isNum(g.membersWithActiveGoals) &&
    listOf(g.byType, (t) => isObj(t) && isStr(t.goalType) && nums(t, ['total', 'active', 'completed']))
    ? (g as unknown as AdminFitness['goals'])
    : null;
}

export function adminFeedback(f: unknown): AdminFitness['feedback'] | null {
  const fb = isObj(f) ? f.feedback : undefined;
  return isObj(fb) &&
    nums(fb, ['total', 'last30Days', 'read', 'trainersGivingFeedback', 'membersReceivingFeedback', 'aboutGoals', 'aboutPlans']) &&
    isNumOrNull(fb.readRatePercent) &&
    listOf(fb.byType, (t) => isObj(t) && isStr(t.feedbackType) && isNum(t.count))
    ? (fb as unknown as AdminFitness['feedback'])
    : null;
}

/** True when the response has no usable `fitness` object at all. */
export const fitnessMissing = (f: unknown) => !isObj(f);
