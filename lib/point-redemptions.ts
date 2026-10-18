import { env } from "cloudflare:workers";

export type PointRedemption = {
  id: number;
  reward_name: string;
  points: number;
  created_at: string;
  updated_at: string;
};

function database() {
  if (!env.DB) throw new Error("学习记录数据库暂时不可用。");
  return env.DB;
}

export function validateRedemption(rewardName: string, points: number) {
  if (!rewardName || rewardName.length > 80) return "兑换内容需填写且不超过 80 个字。";
  if (!Number.isSafeInteger(points) || points < 1 || points > 1_000_000) return "兑换积分需为 1 到 1,000,000 的整数。";
  return null;
}

export async function listPointRedemptions(userId: string, offset = 0) {
  const db = database();
  const [balance, redemptions] = await Promise.all([
    db.prepare(
      `SELECT COALESCE((
         SELECT SUM(r.intensity_score * p.importance)
         FROM study_records r
         JOIN projects p ON p.id = r.project_id AND p.user_id = r.user_id AND p.deleted_at IS NULL
         WHERE r.user_id = ? AND r.deleted_at IS NULL
       ), 0) AS earned_points,
       COALESCE((SELECT SUM(points) FROM point_redemptions WHERE user_id = ? AND deleted_at IS NULL), 0) AS redeemed_points,
       (SELECT COUNT(*) FROM point_redemptions WHERE user_id = ? AND deleted_at IS NULL) AS total`,
    ).bind(userId, userId, userId).first<{ earned_points: number; redeemed_points: number; total: number }>(),
    db.prepare(
      `SELECT id, reward_name, points, created_at, updated_at
       FROM point_redemptions
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC
       LIMIT 50 OFFSET ?`,
    ).bind(userId, offset).all<PointRedemption>(),
  ]);
  const earnedPoints = Number(balance?.earned_points || 0);
  const redeemedPoints = Number(balance?.redeemed_points || 0);
  return {
    earned_points: earnedPoints,
    redeemed_points: redeemedPoints,
    available_points: earnedPoints - redeemedPoints,
    total: Number(balance?.total || 0),
    redemptions: redemptions.results.map((item) => ({ ...item, points: Number(item.points) })),
  };
}

export async function createPointRedemption(userId: string, rewardName: string, points: number) {
  return database()
    .prepare(
      `INSERT INTO point_redemptions (user_id, reward_name, points)
       VALUES (?, ?, ?)
       RETURNING id, reward_name, points, created_at, updated_at`,
    )
    .bind(userId, rewardName, points)
    .first<PointRedemption>();
}

export async function editPointRedemption(userId: string, id: number, rewardName: string, points: number) {
  return database().prepare(
    `UPDATE point_redemptions SET reward_name = ?, points = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL
     RETURNING id, reward_name, points, created_at, updated_at`,
  ).bind(rewardName, points, id, userId).first<PointRedemption>();
}

export async function removePointRedemption(userId: string, id: number, deletedAt: string) {
  const result = await database().prepare(
    `UPDATE point_redemptions SET deleted_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
  ).bind(deletedAt, id, userId).run();
  return result.meta.changes > 0;
}
