import { getPool } from "../config/database.js";
import { parseBigIntId } from "./sqlBigInt.js";

/**
 * @param {import('mysql2').RowDataPacket} row
 */
function mapGoalType(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    code: row.code,
    name: row.name,
    description: row.description,
    is_active: Boolean(row.is_active),
  };
}

/**
 * @param {import('mysql2').RowDataPacket} row
 */
function mapConfig(row) {
  if (!row) return null;
  return {
    goal_type_code: row.goal_type_code,
    calorie_mode: row.calorie_mode,
    calorie_adjustment_percent: Number(row.calorie_adjustment_percent),
    soft_deficit_percent: Number(row.soft_deficit_percent),
    protein_multiplier_per_kg: Number(row.protein_multiplier_per_kg),
    fat_percent_of_calories: Number(row.fat_percent_of_calories),
    default_exercise_min_per_day: Number(row.default_exercise_min_per_day),
    default_workout_per_week: Number(row.default_workout_per_week),
    default_steps_per_day: Number(row.default_steps_per_day),
    exercise_min_bonus: Number(row.exercise_min_bonus),
    steps_bonus: Number(row.steps_bonus),
    workout_week_bonus: Number(row.workout_week_bonus),
    default_water_ml: Number(row.default_water_ml),
    default_sugar_limit_g: Number(row.default_sugar_limit_g),
    default_sodium_limit_mg: Number(row.default_sodium_limit_mg),
    intensity_easy_factor: Number(row.intensity_easy_factor),
    intensity_normal_factor: Number(row.intensity_normal_factor),
    intensity_aggressive_factor: Number(row.intensity_aggressive_factor),
  };
}

export async function listGoalTypes() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, code, name, description, is_active FROM goal_types WHERE is_active = 1 ORDER BY id`
  );
  return (Array.isArray(rows) ? rows : []).map((r) => mapGoalType(r)).filter(Boolean);
}

export async function findGoalTypeByCode(code) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, code, name, description, is_active FROM goal_types WHERE code = :code LIMIT 1`,
    { code: String(code) }
  );
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  return mapGoalType(row);
}

export async function findCalculationConfig(goalTypeCode) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM goal_calculation_configs WHERE goal_type_code = :c AND is_active = 1 LIMIT 1`,
    { c: String(goalTypeCode) }
  );
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  return mapConfig(row);
}

export async function findActivityMultiplier(levelCode) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT multiplier FROM activity_level_multipliers WHERE level_code = :l LIMIT 1`,
    { l: String(levelCode) }
  );
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  return row ? Number(row.multiplier) : null;
}

/**
 * @param {string} userId
 */
export async function findActiveGoalByUserId(userId) {
  const uid = parseBigIntId(userId);
  if (uid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT ug.*, gt.code AS goal_type_code, gt.name AS goal_type_name
     FROM user_goals ug
     JOIN goal_types gt ON gt.id = ug.goal_type_id
     WHERE ug.user_id = :uid AND ug.status = 'active' LIMIT 1`,
    { uid }
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function listGoalsForUser(userId) {
  const uid = parseBigIntId(userId);
  if (uid == null) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT ug.*, gt.code AS goal_type_code, gt.name AS goal_type_name
     FROM user_goals ug
     JOIN goal_types gt ON gt.id = ug.goal_type_id
     WHERE ug.user_id = :uid
     ORDER BY ug.updated_at DESC`,
    { uid }
  );
  return Array.isArray(rows) ? rows : [];
}

export async function findGoalByIdForUser(goalId, userId) {
  const gid = parseBigIntId(goalId);
  const uid = parseBigIntId(userId);
  if (gid == null || uid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT ug.*, gt.code AS goal_type_code, gt.name AS goal_type_name
     FROM user_goals ug
     JOIN goal_types gt ON gt.id = ug.goal_type_id
     WHERE ug.id = :gid AND ug.user_id = :uid LIMIT 1`,
    { gid, uid }
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * @param {object} data
 */
export async function insertUserGoalWithConnection(conn, data) {
  const [res] = await conn.execute(
    `INSERT INTO user_goals (
      user_id, goal_type_id, goal_name, start_date, target_date,
      start_weight_kg, target_weight_kg, target_body_fat_percent,
      target_workout_per_week, target_steps_per_day,
      intensity_level, activity_level, exercise_preferences, food_restrictions,
      status, notes
    ) VALUES (
      :user_id, :goal_type_id, :goal_name, :start_date, :target_date,
      :start_weight_kg, :target_weight_kg, :target_body_fat_percent,
      :target_workout_per_week, :target_steps_per_day,
      :intensity_level, :activity_level, :exercise_preferences, :food_restrictions,
      :status, :notes
    )`,
    {
      user_id: parseBigIntId(data.user_id),
      goal_type_id: parseBigIntId(data.goal_type_id),
      goal_name: data.goal_name,
      start_date: data.start_date,
      target_date: data.target_date,
      start_weight_kg: data.start_weight_kg,
      target_weight_kg: data.target_weight_kg,
      target_body_fat_percent: data.target_body_fat_percent ?? null,
      target_workout_per_week: data.target_workout_per_week ?? null,
      target_steps_per_day: data.target_steps_per_day ?? null,
      intensity_level: data.intensity_level,
      activity_level: data.activity_level,
      exercise_preferences: data.exercise_preferences ?? null,
      food_restrictions: data.food_restrictions ?? null,
      status: data.status ?? "draft",
      notes: data.notes ?? null,
    }
  );
  return res.insertId != null ? String(res.insertId) : null;
}

export async function insertUserGoal(data) {
  const pool = getPool();
  return insertUserGoalWithConnection(pool, data);
}

export async function insertDailyTargetsBatchWithConnection(conn, rows) {
  if (!rows.length) return;
  for (const r of rows) {
    await conn.execute(
        `INSERT INTO goal_daily_targets (
          user_goal_id, user_id, target_date, calorie_target, protein_target_g, carb_target_g, fat_target_g,
          sugar_limit_g, sodium_limit_mg, water_target_ml, step_target, exercise_duration_target_min, workout_plan_id
        ) VALUES (
          :user_goal_id, :user_id, :target_date, :calorie_target, :protein_target_g, :carb_target_g, :fat_target_g,
          :sugar_limit_g, :sodium_limit_mg, :water_target_ml, :step_target, :exercise_duration_target_min, :workout_plan_id
        )`,
        {
          user_goal_id: parseBigIntId(r.user_goal_id),
          user_id: parseBigIntId(r.user_id),
          target_date: r.target_date,
          calorie_target: r.calorie_target,
          protein_target_g: r.protein_target_g,
          carb_target_g: r.carb_target_g,
          fat_target_g: r.fat_target_g,
          sugar_limit_g: r.sugar_limit_g,
          sodium_limit_mg: r.sodium_limit_mg,
          water_target_ml: r.water_target_ml,
          step_target: r.step_target,
          exercise_duration_target_min: r.exercise_duration_target_min,
          workout_plan_id: r.workout_plan_id != null ? parseBigIntId(r.workout_plan_id) : null,
        }
    );
  }
}

export async function insertDailyTargetsBatch(rows) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await insertDailyTargetsBatchWithConnection(conn, rows);
  } finally {
    conn.release();
  }
}

export async function insertMilestonesBatchWithConnection(conn, rows) {
  if (!rows.length) return;
  for (const r of rows) {
    await conn.execute(
        `INSERT INTO goal_milestones (
          user_goal_id, milestone_date, expected_weight_kg, expected_body_fat_percent, expected_workout_count, expected_avg_calorie, status
        ) VALUES (
          :user_goal_id, :milestone_date, :expected_weight_kg, :expected_body_fat_percent, :expected_workout_count, :expected_avg_calorie, :status
        )`,
        {
          user_goal_id: parseBigIntId(r.user_goal_id),
          milestone_date: r.milestone_date,
          expected_weight_kg: r.expected_weight_kg,
          expected_body_fat_percent: r.expected_body_fat_percent ?? null,
          expected_workout_count: r.expected_workout_count ?? null,
          expected_avg_calorie: r.expected_avg_calorie ?? null,
          status: r.status ?? "pending",
        }
    );
  }
}

export async function insertMilestonesBatch(rows) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await insertMilestonesBatchWithConnection(conn, rows);
  } finally {
    conn.release();
  }
}

export async function deleteDailyTargetsForGoal(userGoalId) {
  const gid = parseBigIntId(userGoalId);
  if (gid == null) return;
  const pool = getPool();
  await pool.execute(`DELETE FROM goal_daily_targets WHERE user_goal_id = :gid`, { gid });
}

export async function deleteMilestonesForGoal(userGoalId) {
  const gid = parseBigIntId(userGoalId);
  if (gid == null) return;
  const pool = getPool();
  await pool.execute(`DELETE FROM goal_milestones WHERE user_goal_id = :gid`, { gid });
}

export async function deleteRecommendationsForGoalFromDate(userGoalId, fromDate) {
  const gid = parseBigIntId(userGoalId);
  if (gid == null) return;
  const pool = getPool();
  await pool.execute(
    `DELETE FROM recommendation_logs WHERE user_goal_id = :gid AND recommendation_date >= :d`,
    { gid, d: fromDate }
  );
}

export async function deleteRecommendationsForGoalOnDate(userGoalId, dateStr) {
  const gid = parseBigIntId(userGoalId);
  if (gid == null) return;
  const pool = getPool();
  await pool.execute(
    `DELETE FROM recommendation_logs WHERE user_goal_id = :gid AND recommendation_date = :d`,
    { gid, d: dateStr }
  );
}

export async function deleteDailyScoresForGoalFromDate(userGoalId, fromDate) {
  const gid = parseBigIntId(userGoalId);
  if (gid == null) return;
  const pool = getPool();
  await pool.execute(
    `DELETE FROM daily_health_scores WHERE user_goal_id = :gid AND score_date >= :d`,
    { gid, d: fromDate }
  );
}

export async function setGoalStatus(goalId, userId, status) {
  const gid = parseBigIntId(goalId);
  const uid = parseBigIntId(userId);
  if (gid == null || uid == null) return;
  const pool = getPool();
  await pool.execute(
    `UPDATE user_goals SET status = :s, updated_at = CURRENT_TIMESTAMP(3) WHERE id = :gid AND user_id = :uid`,
    { s: status, gid, uid }
  );
}

export async function pauseOtherActiveGoals(userId, exceptGoalId) {
  const uid = parseBigIntId(userId);
  const ex = parseBigIntId(exceptGoalId);
  if (uid == null) return;
  const pool = getPool();
  if (ex != null) {
    await pool.execute(
      `UPDATE user_goals SET status = 'paused', updated_at = CURRENT_TIMESTAMP(3)
       WHERE user_id = :uid AND status = 'active' AND id <> :ex`,
      { uid, ex }
    );
  } else {
    await pool.execute(
      `UPDATE user_goals SET status = 'paused', updated_at = CURRENT_TIMESTAMP(3)
       WHERE user_id = :uid AND status = 'active'`,
      { uid }
    );
  }
}

export async function findDailyTarget(userGoalId, dateStr) {
  const gid = parseBigIntId(userGoalId);
  if (gid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM goal_daily_targets WHERE user_goal_id = :gid AND target_date = :d LIMIT 1`,
    { gid, d: dateStr }
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * Agregasi food_analyses per tanggal (DATE(created_at) = dateStr di zona server DB).
 */
export async function aggregateFoodForUserDate(userId, dateStr) {
  const uid = parseBigIntId(userId);
  if (uid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
       COALESCE(SUM(total_calories), 0) AS calories,
       COALESCE(SUM(protein_g), 0) AS protein_g,
       COALESCE(SUM(carbs_g), 0) AS carbs_g,
       COALESCE(SUM(fats_g), 0) AS fats_g,
       COALESCE(SUM(fiber_g), 0) AS fiber_g,
       COALESCE(SUM(water_ml), 0) AS water_ml,
       COUNT(*) AS meal_count
     FROM food_analyses
     WHERE user_id = :uid AND DATE(created_at) = :d`,
    { uid, d: dateStr }
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function listWorkoutsForUserDate(userId, dateStr) {
  const uid = parseBigIntId(userId);
  if (uid == null) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT calories_kcal, workout_time FROM workout_analyses
     WHERE user_id = :uid AND DATE(created_at) = :d`,
    { uid, d: dateStr }
  );
  return Array.isArray(rows) ? rows : [];
}

export async function countFoodLogDaysInRange(userId, startDate, endDate) {
  const uid = parseBigIntId(userId);
  if (uid == null) return 0;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT COUNT(DISTINCT DATE(created_at)) AS c FROM food_analyses
     WHERE user_id = :uid AND DATE(created_at) >= :a AND DATE(created_at) <= :b`,
    { uid, a: startDate, b: endDate }
  );
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  return row ? Number(row.c) : 0;
}

export async function upsertDailyHealthScore(row) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO daily_health_scores (
      user_goal_id, user_id, score_date,
      calorie_score, protein_score, macro_score, exercise_score, consistency_score, habit_score,
      total_score, category,
      calorie_actual, protein_actual_g, carb_actual_g, fat_actual_g,
      exercise_actual_min, steps_actual, water_actual_ml
    ) VALUES (
      :user_goal_id, :user_id, :score_date,
      :calorie_score, :protein_score, :macro_score, :exercise_score, :consistency_score, :habit_score,
      :total_score, :category,
      :calorie_actual, :protein_actual_g, :carb_actual_g, :fat_actual_g,
      :exercise_actual_min, :steps_actual, :water_actual_ml
    )
    ON DUPLICATE KEY UPDATE
      calorie_score = VALUES(calorie_score),
      protein_score = VALUES(protein_score),
      macro_score = VALUES(macro_score),
      exercise_score = VALUES(exercise_score),
      consistency_score = VALUES(consistency_score),
      habit_score = VALUES(habit_score),
      total_score = VALUES(total_score),
      category = VALUES(category),
      calorie_actual = VALUES(calorie_actual),
      protein_actual_g = VALUES(protein_actual_g),
      carb_actual_g = VALUES(carb_actual_g),
      fat_actual_g = VALUES(fat_actual_g),
      exercise_actual_min = VALUES(exercise_actual_min),
      steps_actual = VALUES(steps_actual),
      water_actual_ml = VALUES(water_actual_ml),
      updated_at = CURRENT_TIMESTAMP(3)`,
    {
      user_goal_id: parseBigIntId(row.user_goal_id),
      user_id: parseBigIntId(row.user_id),
      score_date: row.score_date,
      calorie_score: row.calorie_score,
      protein_score: row.protein_score,
      macro_score: row.macro_score,
      exercise_score: row.exercise_score,
      consistency_score: row.consistency_score,
      habit_score: row.habit_score,
      total_score: row.total_score,
      category: row.category,
      calorie_actual: row.calorie_actual,
      protein_actual_g: row.protein_actual_g,
      carb_actual_g: row.carb_actual_g,
      fat_actual_g: row.fat_actual_g,
      exercise_actual_min: row.exercise_actual_min,
      steps_actual: row.steps_actual,
      water_actual_ml: row.water_actual_ml,
    }
  );
}

export async function findDailyHealthScore(userGoalId, dateStr) {
  const gid = parseBigIntId(userGoalId);
  if (gid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM daily_health_scores WHERE user_goal_id = :gid AND score_date = :d LIMIT 1`,
    { gid, d: dateStr }
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function listDailyHealthScoresRange(userGoalId, startDate, endDate) {
  const gid = parseBigIntId(userGoalId);
  if (gid == null) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM daily_health_scores
     WHERE user_goal_id = :gid AND score_date >= :a AND score_date <= :b
     ORDER BY score_date ASC`,
    { gid, a: startDate, b: endDate }
  );
  return Array.isArray(rows) ? rows : [];
}

export async function insertRecommendation(row) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO recommendation_logs (
      user_goal_id, user_id, recommendation_date, category, code, title, body, payload_json, status
    ) VALUES (
      :user_goal_id, :user_id, :recommendation_date, :category, :code, :title, :body, CAST(:payload_json AS JSON), :status
    )`,
    {
      user_goal_id: parseBigIntId(row.user_goal_id),
      user_id: parseBigIntId(row.user_id),
      recommendation_date: row.recommendation_date,
      category: row.category,
      code: row.code,
      title: row.title,
      body: row.body,
      payload_json: row.payload_json ? JSON.stringify(row.payload_json) : null,
      status: row.status ?? "unread",
    }
  );
}

export async function listRecommendationsForDate(userGoalId, dateStr) {
  const gid = parseBigIntId(userGoalId);
  if (gid == null) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM recommendation_logs
     WHERE user_goal_id = :gid AND recommendation_date = :d
     ORDER BY id DESC`,
    { gid, d: dateStr }
  );
  return Array.isArray(rows) ? rows : [];
}

export async function listMilestones(userGoalId) {
  const gid = parseBigIntId(userGoalId);
  if (gid == null) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM goal_milestones WHERE user_goal_id = :gid ORDER BY milestone_date ASC`,
    { gid }
  );
  return Array.isArray(rows) ? rows : [];
}
