import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 설정
app.use('/api/*', cors())

// 정적 파일은 Cloudflare Pages가 자동으로 서빙 (_routes.json 제외)

// ============================================
// API: Shower Records Search (Date 필터링 지원)
// ============================================
app.get('/api/records', async (c) => {
  const { DB } = c.env

  try {
    // 쿼리 파라미터에서 Date 범위 가져오기
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const limit = parseInt(c.req.query('limit') || '100')

    let query = `SELECT * FROM shower_records WHERE 1=1`
    const params: any[] = []

    // Start Date 필터
    if (startDate) {
      query += ` AND date >= ?`
      params.push(startDate)
    }

    // End Date 필터
    if (endDate) {
      query += ` AND date <= ?`
      params.push(endDate)
    }

    query += ` ORDER BY date DESC, start_time DESC LIMIT ?`
    params.push(limit)

    const result = await DB.prepare(query).bind(...params).all()

    return c.json({ 
      success: true, 
      records: result.results,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        count: result.results.length
      }
    })
  } catch (error) {
    console.error('Error fetching records:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch records' 
    }, 500)
  }
})

// ============================================
// API: Add new shower record
// ============================================
app.post('/api/records', async (c) => {
  const { DB } = c.env

  try {
    const data = await c.req.json()
    const {
      date,
      start_time,
      duration,
      body_soap,
      hair_wash,
      dry_shampoo,
      face_wash,
      cat_shower,
      teeth_brush,
      feet_wash,
      bath,
      exfoliation
    } = data

    // pts수 계산
    const scores = calculateScores({
      date,
      body_soap,
      hair_wash,
      dry_shampoo,
      face_wash,
      cat_shower,
      teeth_brush,
      feet_wash,
      bath,
      exfoliation,
      duration
    }, DB)

    const { 
      completeness_score, 
      duration_score, 
      frequency_score, 
      total_score, 
      grade,
      is_cat_shower,
      days_since_last
    } = await scores

    // 데이터 삽입
    const result = await DB.prepare(`
      INSERT INTO shower_records (
        date, start_time, duration,
        body_soap, hair_wash, dry_shampoo, face_wash, cat_shower, teeth_brush, feet_wash,
        bath, exfoliation,
        completeness_score, frequency_score, duration_score, total_score, grade,
        is_cat_shower, days_since_last
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      date, start_time, duration,
      body_soap ? 1 : 0, 
      hair_wash ? 1 : 0,
      dry_shampoo ? 1 : 0,
      face_wash ? 1 : 0,
      cat_shower ? 1 : 0,
      teeth_brush ? 1 : 0, 
      feet_wash ? 1 : 0,
      bath ? 1 : 0,
      exfoliation ? 1 : 0,
      completeness_score,
      frequency_score,
      duration_score,
      total_score,
      grade,
      is_cat_shower ? 1 : 0,
      days_since_last
    ).run()

    // 포인트 계산 및 적립
    const points = calculatePoints(total_score)
    
    // user_points 테이블 초기화 또는 업데이트
    await DB.prepare(`
      INSERT INTO user_points (id, total_points, lifetime_points, last_updated)
      VALUES (1, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        total_points = total_points + ?,
        lifetime_points = lifetime_points + ?,
        last_updated = CURRENT_TIMESTAMP
    `).bind(points, points, points, points).run()
    
    // point_transactions 기록
    await DB.prepare(`
      INSERT INTO point_transactions (
        transaction_type, amount, reason, created_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind('earn', points, `Shower record: ${total_score} pts (${grade} grade)`).run()

    return c.json({
      success: true,
      id: result.meta.last_row_id,
      scores: {
        completeness_score,
        frequency_score,
        duration_score,
        total_score,
        grade,
        is_cat_shower
      },
      points_earned: points
    })
  } catch (error) {
    console.error('Error adding record:', error)
    return c.json({
      success: false,
      error: 'Failed to add record'
    }, 500)
  }
})

// ============================================
// API: Shower Records 삭제
// ============================================
app.delete('/api/records/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')

  try {
    await DB.prepare(`DELETE FROM shower_records WHERE id = ?`).bind(id).run()

    return c.json({
      success: true,
      message: 'Record deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting record:', error)
    return c.json({
      success: false,
      error: 'Failed to delete record'
    }, 500)
  }
})

// ============================================
// API: Shower Records 수정
// ============================================
app.put('/api/records/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')

  try {
    const data = await c.req.json()
    const {
      date,
      start_time,
      duration,
      body_soap,
      hair_wash,
      dry_shampoo,
      face_wash,
      cat_shower,
      teeth_brush,
      feet_wash,
      bath,
      exfoliation
    } = data

    // pts수 재계산
    const scores = await calculateScores({
      date,
      body_soap,
      hair_wash,
      dry_shampoo,
      face_wash,
      cat_shower,
      teeth_brush,
      feet_wash,
      bath,
      exfoliation,
      duration
    }, DB)

    const {
      completeness_score,
      duration_score,
      frequency_score,
      total_score,
      grade,
      is_cat_shower,
      days_since_last
    } = scores

    // 데이터 업데이트
    await DB.prepare(`
      UPDATE shower_records SET
        date = ?,
        start_time = ?,
        duration = ?,
        body_soap = ?,
        hair_wash = ?,
        dry_shampoo = ?,
        face_wash = ?,
        cat_shower = ?,
        teeth_brush = ?,
        feet_wash = ?,
        bath = ?,
        exfoliation = ?,
        completeness_score = ?,
        frequency_score = ?,
        duration_score = ?,
        total_score = ?,
        grade = ?,
        is_cat_shower = ?,
        days_since_last = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      date, start_time, duration,
      body_soap ? 1 : 0,
      hair_wash ? 1 : 0,
      dry_shampoo ? 1 : 0,
      face_wash ? 1 : 0,
      cat_shower ? 1 : 0,
      teeth_brush ? 1 : 0,
      feet_wash ? 1 : 0,
      bath ? 1 : 0,
      exfoliation ? 1 : 0,
      completeness_score,
      frequency_score,
      duration_score,
      total_score,
      grade,
      is_cat_shower ? 1 : 0,
      days_since_last,
      id
    ).run()

    return c.json({
      success: true,
      message: 'Record updated successfully',
      scores: {
        completeness_score,
        frequency_score,
        duration_score,
        total_score,
        grade,
        is_cat_shower
      }
    })
  } catch (error) {
    console.error('Error updating record:', error)
    return c.json({
      success: false,
      error: 'Failed to update record'
    }, 500)
  }
})

// ============================================
// API: 통계 Search
// ============================================
app.get('/api/stats', async (c) => {
  const { DB } = c.env

  try {
    // Grade별 min포
    const gradeDistribution = await DB.prepare(`
      SELECT 
        grade,
        COUNT(*) as count,
        ROUND(AVG(total_score), 1) as avg_score,
        ROUND(AVG(completeness_score), 1) as avg_completeness,
        ROUND(AVG(duration), 1) as avg_duration
      FROM shower_records
      GROUP BY grade
      ORDER BY 
        CASE grade
          WHEN 'S' THEN 1
          WHEN 'A' THEN 2
          WHEN 'B' THEN 3
          WHEN 'C' THEN 4
          WHEN 'D' THEN 5
        END
    `).all()

    // Cat Shower 통계
    const catShowerStats = await DB.prepare(`
      SELECT 
        COUNT(*) as total_showers,
        SUM(CASE WHEN is_cat_shower = 1 THEN 1 ELSE 0 END) as cat_showers,
        ROUND(AVG(days_since_last), 1) as avg_days_between_all
      FROM shower_records
    `).first()

    // 실제 샤워만 통계 (body_soap=1 OR hair_wash=1)
    const actualShowerStats = await DB.prepare(`
      SELECT 
        COUNT(*) as actual_shower_count,
        ROUND(AVG(days_since_last), 1) as avg_days_between_showers
      FROM shower_records
      WHERE body_soap = 1 OR hair_wash = 1
    `).first()

    // 최근 트렌드 (Last 30 Days)
    const recentTrend = await DB.prepare(`
      SELECT 
        date,
        total_score,
        grade,
        is_cat_shower
      FROM shower_records
      WHERE date >= date('now', '-30 days')
      ORDER BY date DESC
    `).all()

    // 전체 평균 점수 계산
    const overallStats = await DB.prepare(`
      SELECT 
        COUNT(*) as total_count,
        ROUND(AVG(total_score), 1) as avg_score,
        ROUND((SUM(CASE WHEN is_cat_shower = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 1) as cat_shower_rate
      FROM shower_records
    `).first()

    return c.json({
      success: true,
      stats: {
        gradeDistribution: gradeDistribution.results,
        catShowerStats,
        actualShowerStats,
        recentTrend: recentTrend.results,
        avg_score: overallStats.avg_score || 0,
        total_count: overallStats.total_count || 0,
        cat_shower_rate: overallStats.cat_shower_rate || 0
      }
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch stats'
    }, 500)
  }
})

// ============================================
// API: Badges
// ============================================
app.get('/api/badges', async (c) => {
  const { DB } = c.env

  try {
    // 모든 기록 가져오기
    const allRecords = await DB.prepare(`
      SELECT * FROM shower_records ORDER BY date DESC, start_time DESC
    `).all()

    // 통계 계산
    const stats = await DB.prepare(`
      SELECT 
        COUNT(*) as total_count,
        ROUND(AVG(total_score), 1) as avg_score,
        SUM(CASE WHEN is_cat_shower = 1 THEN 1 ELSE 0 END) as cat_shower_count,
        SUM(CASE WHEN body_soap = 1 THEN 1 ELSE 0 END) as body_soap_count,
        SUM(CASE WHEN dry_shampoo = 1 THEN 1 ELSE 0 END) as dry_shampoo_count,
        SUM(CASE WHEN cat_shower = 1 THEN 1 ELSE 0 END) as face_wash_count,
        SUM(CASE WHEN body_soap = 1 OR hair_wash = 1 THEN 1 ELSE 0 END) as actual_shower_count
      FROM shower_records
    `).first()

    // 뱃지 체크
    const badges = await checkBadges(allRecords.results, stats, DB)

    return c.json({
      success: true,
      badges
    })
  } catch (error) {
    console.error('Error fetching badges:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch badges'
    }, 500)
  }
})

// ============================================
// API: Rewards & Points
// ============================================
app.get('/api/rewards', async (c) => {
  const { DB } = c.env

  try {
    // Get user points
    const userPoints = await DB.prepare(`
      SELECT * FROM user_points WHERE id = 1
    `).first()

    // Get pending rewards
    const pendingRewards = await DB.prepare(`
      SELECT * FROM rewards WHERE status = 'pending' ORDER BY achieved_date DESC
    `).all()

    // Get claimed rewards (last 10)
    const claimedRewards = await DB.prepare(`
      SELECT * FROM rewards WHERE status != 'pending' ORDER BY claimed_date DESC LIMIT 10
    `).all()

    // Get recent point transactions (last 20)
    const recentTransactions = await DB.prepare(`
      SELECT * FROM point_transactions ORDER BY created_at DESC LIMIT 20
    `).all()

    return c.json({
      success: true,
      points: {
        total: userPoints?.total_points || 0,
        lifetime: userPoints?.lifetime_points || 0
      },
      rewards: {
        pending: pendingRewards.results,
        claimed: claimedRewards.results
      },
      transactions: recentTransactions.results
    })
  } catch (error) {
    console.error('Error fetching rewards:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch rewards'
    }, 500)
  }
})

// Claim reward
app.post('/api/rewards/:id/claim', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')

  try {
    await DB.prepare(`
      UPDATE rewards SET 
        status = 'claimed',
        claimed_date = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(id).run()

    return c.json({
      success: true,
      message: 'Reward claimed! Check KakaoTalk for details.'
    })
  } catch (error) {
    console.error('Error claiming reward:', error)
    return c.json({
      success: false,
      error: 'Failed to claim reward'
    }, 500)
  }
})

// Redeem points
app.post('/api/rewards/redeem', async (c) => {
  const { DB } = c.env

  try {
    const { item_name, points_cost } = await c.req.json()

    // Check if user has enough points
    const userPoints = await DB.prepare(`
      SELECT total_points FROM user_points WHERE id = 1
    `).first()

    if (!userPoints || userPoints.total_points < points_cost) {
      return c.json({
        success: false,
        error: 'Not enough points'
      }, 400)
    }

    // Deduct points
    await DB.prepare(`
      UPDATE user_points SET 
        total_points = total_points - ?
      WHERE id = 1
    `).bind(points_cost).run()

    // Record transaction
    await DB.prepare(`
      INSERT INTO point_transactions (amount, reason, transaction_type)
      VALUES (?, ?, 'spend')
    `).bind(-points_cost, `Redeemed: ${item_name}`).run()

    // Record redemption
    await DB.prepare(`
      INSERT INTO point_redemptions (item_name, points_cost)
      VALUES (?, ?)
    `).bind(item_name, points_cost).run()

    return c.json({
      success: true,
      message: 'Item redeemed! Check KakaoTalk for confirmation.'
    })
  } catch (error) {
    console.error('Error redeeming points:', error)
    return c.json({
      success: false,
      error: 'Failed to redeem points'
    }, 500)
  }
})

// Claim a goal reward
app.post('/api/rewards/goals/:goal_id/claim', async (c) => {
  const { DB } = c.env
  const goalId = c.req.param('goal_id')

  try {
    // Get all records to recalculate goals
    const allRecords = await DB.prepare(`
      SELECT * FROM shower_records ORDER BY date DESC, start_time DESC
    `).all()

    const records = allRecords.results
    const goals = await calculateGoals(records, DB)
    
    // Find the specific goal
    const goal = goals.find((g: any) => g.id === goalId)
    if (!goal) {
      return c.json({
        success: false,
        error: 'Goal not found'
      }, 404)
    }

    // Check if goal is completed
    if (goal.status !== 'completed') {
      return c.json({
        success: false,
        error: 'Goal not yet achieved'
      }, 400)
    }

    // Check if can claim (cooldown check)
    if (!goal.can_claim) {
      return c.json({
        success: false,
        error: goal.type === 'streak' 
          ? 'This streak reward has already been claimed'
          : 'Please wait 7 days before claiming this weekly goal again'
      }, 400)
    }

    // Record the claim in goal_claims table
    const today = new Date().toISOString().split('T')[0]
    await DB.prepare(`
      INSERT INTO goal_claims (
        goal_id, 
        claimed_date, 
        period_start, 
        period_end, 
        average_score, 
        streak_count
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      goalId,
      today,
      goal.period_start || null,
      goal.period_end || null,
      goal.current || null,
      goal.type === 'streak' ? goal.current : null
    ).run()

    // Add to rewards table as pending
    await DB.prepare(`
      INSERT INTO rewards (
        reward_type,
        title,
        description,
        value,
        achieved_date
      )
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      'direct',
      goal.title,
      goal.description,
      goal.reward,
      today
    ).run()

    return c.json({
      success: true,
      message: 'Goal reward claimed! Check Pending Rewards.'
    })
  } catch (error) {
    console.error('Error claiming goal:', error)
    return c.json({
      success: false,
      error: 'Failed to claim goal reward'
    }, 500)
  }
})

// 백필: 기존 기록들에 대한 포인트 일괄 적립
app.post('/api/rewards/backfill', async (c) => {
  const { DB } = c.env
  
  try {
    // 모든 샤워 기록 가져오기
    const records = await DB.prepare(`
      SELECT id, total_score, grade, date FROM shower_records ORDER BY date ASC
    `).all()
    
    if (!records.results || records.results.length === 0) {
      return c.json({
        success: false,
        error: 'No records found to backfill'
      }, 404)
    }
    
    let totalPointsAdded = 0
    const transactions = []
    
    // 각 기록에 대해 포인트 계산
    for (const record of records.results) {
      const points = calculatePoints(record.total_score)
      totalPointsAdded += points
      
      transactions.push({
        record_id: record.id,
        date: record.date,
        score: record.total_score,
        grade: record.grade,
        points: points
      })
      
      // point_transactions에 기록 추가
      await DB.prepare(`
        INSERT INTO point_transactions (
          transaction_type, amount, reason, created_at
        ) VALUES (?, ?, ?, ?)
      `).bind(
        'earn', 
        points, 
        `Backfill: ${record.total_score} pts (${record.grade} grade) - ${record.date}`,
        record.date + ' 23:59:59'  // 해당 날짜의 끝으로 설정
      ).run()
    }
    
    // user_points 테이블 업데이트
    await DB.prepare(`
      INSERT INTO user_points (id, total_points, lifetime_points, last_updated)
      VALUES (1, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        total_points = total_points + ?,
        lifetime_points = lifetime_points + ?,
        last_updated = CURRENT_TIMESTAMP
    `).bind(totalPointsAdded, totalPointsAdded, totalPointsAdded, totalPointsAdded).run()
    
    return c.json({
      success: true,
      message: `Successfully backfilled ${records.results.length} records`,
      total_points_added: totalPointsAdded,
      transactions: transactions
    })
  } catch (error) {
    console.error('Error backfilling points:', error)
    return c.json({
      success: false,
      error: 'Failed to backfill points: ' + error.message
    }, 500)
  }
})

// Get active goals progress
app.get('/api/rewards/goals', async (c) => {
  const { DB } = c.env

  try {
    // Get all records
    const allRecords = await DB.prepare(`
      SELECT * FROM shower_records ORDER BY date DESC, start_time DESC
    `).all()

    const records = allRecords.results

    // Calculate goals
    const goals = await calculateGoals(records, DB)

    return c.json({
      success: true,
      goals
    })
  } catch (error) {
    console.error('Error calculating goals:', error)
    return c.json({
      success: false,
      error: 'Failed to calculate goals'
    }, 500)
  }
})

// ============================================
// Goals Calculation
// ============================================
async function calculateGoals(records: any[], DB: D1Database) {
  const goals: any[] = []

  // Check streak
  const streak = calculateStreak(records)

  // Get last claims for each goal
  const lastClaims = await DB.prepare(`
    SELECT goal_id, MAX(claimed_date) as last_claimed
    FROM goal_claims
    GROUP BY goal_id
  `).all()

  const claimMap = new Map(
    lastClaims.results.map((c: any) => [c.goal_id, c.last_claimed])
  )

  // Check if goal can be claimed (cooldown check)
  async function canClaim(goalId: string, goalType: string): Promise<boolean> {
    const lastClaimed = claimMap.get(goalId)
    if (!lastClaimed) return true

    if (goalType === 'weekly') {
      // Weekly goals: 7 days cooldown
      const daysSinceLastClaim = Math.floor(
        (new Date().getTime() - new Date(lastClaimed).getTime()) / (1000 * 60 * 60 * 24)
      )
      return daysSinceLastClaim >= 7
    } else if (goalType === 'streak') {
      // Streak goals: can only claim once
      return false
    }
    return true
  }

  // Weekly goals (last 7 days)
  const last7Days = records.slice(0, 7)
  if (last7Days.length >= 7) {
    const weeklyAvg = last7Days.reduce((sum: number, r: any) => sum + r.total_score, 0) / 7
    const periodStart = last7Days[6].date
    const periodEnd = last7Days[0].date

    const strongWeekCanClaim = await canClaim('strong_week', 'weekly')
    goals.push({
      id: 'strong_week',
      title: 'Strong Week',
      description: '7 days avg 80+',
      progress: Math.round(weeklyAvg),
      target: 80,
      current: Math.round(weeklyAvg),
      status: weeklyAvg >= 80 ? 'completed' : 'in_progress',
      reward: 'Choose any meal (~$30)',
      reward_type: 'direct',
      type: 'weekly',
      can_claim: weeklyAvg >= 80 && strongWeekCanClaim,
      last_claimed: claimMap.get('strong_week') || null,
      period_start: periodStart,
      period_end: periodEnd
    })

    const greatWeekCanClaim = await canClaim('great_week', 'weekly')
    goals.push({
      id: 'great_week',
      title: 'Great Week',
      description: '7 days avg 85+',
      progress: Math.round(weeklyAvg),
      target: 85,
      current: Math.round(weeklyAvg),
      status: weeklyAvg >= 85 ? 'completed' : 'in_progress',
      reward: 'Meal + dessert (~$40)',
      reward_type: 'direct',
      type: 'weekly',
      can_claim: weeklyAvg >= 85 && greatWeekCanClaim,
      last_claimed: claimMap.get('great_week') || null,
      period_start: periodStart,
      period_end: periodEnd
    })
  }

  // Streak goals (70+ score quality showers)
  const streak14CanClaim = await canClaim('14_day_streak', 'streak')
  goals.push({
    id: '14_day_streak',
    title: '14-day Quality Streak',
    description: '70+ score for 14 days straight',
    progress: streak,
    target: 14,
    current: streak,
    status: streak >= 14 ? 'completed' : 'in_progress',
    reward: 'Nice meal (~$40)',
    reward_type: 'direct',
    type: 'streak',
    can_claim: streak >= 14 && streak14CanClaim,
    last_claimed: claimMap.get('14_day_streak') || null
  })

  const streak30CanClaim = await canClaim('30_day_streak', 'streak')
  goals.push({
    id: '30_day_streak',
    title: '30-day Quality Streak',
    description: '70+ score for 30 days straight',
    progress: streak,
    target: 30,
    current: streak,
    status: streak >= 30 ? 'completed' : 'in_progress',
    reward: 'Korea care package (~$80)',
    reward_type: 'direct',
    type: 'streak',
    can_claim: streak >= 30 && streak30CanClaim,
    last_claimed: claimMap.get('30_day_streak') || null
  })

  const streak60CanClaim = await canClaim('60_day_streak', 'streak')
  goals.push({
    id: '60_day_streak',
    title: '60-day Quality Streak',
    description: '70+ score for 60 days straight',
    progress: streak,
    target: 60,
    current: streak,
    status: streak >= 60 ? 'completed' : 'in_progress',
    reward: 'Korea mega box (~$150)',
    reward_type: 'direct',
    type: 'streak',
    can_claim: streak >= 60 && streak60CanClaim,
    last_claimed: claimMap.get('60_day_streak') || null
  })

  const streak100CanClaim = await canClaim('100_day_streak', 'streak')
  goals.push({
    id: '100_day_streak',
    title: '100-day Quality Streak',
    description: '70+ score for 100 days straight',
    progress: streak,
    target: 100,
    current: streak,
    status: streak >= 100 ? 'completed' : 'in_progress',
    reward: '✈️ USA Trip!',
    reward_type: 'direct',
    type: 'legendary',
    can_claim: streak >= 100 && streak100CanClaim,
    last_claimed: claimMap.get('100_day_streak') || null
  })

  return goals
}

function calculateStreak(records: any[]): number {
  if (records.length === 0) return 0

  // Filter only quality showers (70+ score with Body Soap OR Hair Wash)
  // Must be real shower with good score, not cat showers or partial hygiene
  const qualityShowers = records.filter((r: any) => 
    (r.body_soap === 1 || r.hair_wash === 1) && r.total_score >= 70
  )
  
  if (qualityShowers.length === 0) return 0

  let streak = 1
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check if recorded today or yesterday
  const lastRecord = new Date(qualityShowers[0].date)
  lastRecord.setHours(0, 0, 0, 0)
  const daysSinceLastRecord = Math.floor((today.getTime() - lastRecord.getTime()) / (1000 * 60 * 60 * 24))

  if (daysSinceLastRecord > 1) {
    return 0 // Streak broken
  }

  // Count consecutive days
  for (let i = 0; i < qualityShowers.length - 1; i++) {
    const currentDate = new Date(qualityShowers[i].date)
    const nextDate = new Date(qualityShowers[i + 1].date)
    currentDate.setHours(0, 0, 0, 0)
    nextDate.setHours(0, 0, 0, 0)

    const daysDiff = Math.floor((currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff === 1) {
      streak++
    } else {
      break
    }
  }

  return streak
}

// ============================================
// 뱃지 체크 함수
// ============================================
async function checkBadges(records: any[], stats: any, DB: D1Database) {
  const badges: any[] = []
  
  // 뱃지 정의
  const BADGE_DEFINITIONS = [
    // ✨ 좋은 뱃지
    { id: 'hygiene_master', name: 'Hygiene Master', icon: '🏆', type: 'good', description: 'Maintain 90+ average score' },
    { id: 'perfect_week', name: 'Perfect Week', icon: '⭐', type: 'good', description: '7 days of S grade in a row' },
    { id: 'diamond_clean', name: 'Diamond Clean', icon: '💎', type: 'good', description: '30 days of A+ grade' },
    { id: 'hot_streak', name: 'Hot Streak', icon: '🔥', type: 'good', description: '10 consecutive normal showers' },
    { id: 'shower_enthusiast', name: 'Shower Enthusiast', icon: '🚿', type: 'good', description: 'Complete 100 showers' },
    { id: 'bacteria_killer', name: 'Bacteria Killer', icon: '✨', type: 'good', description: 'Keep bacteria under 1000 for 7 days' },
    { id: 'soap_master', name: 'Soap Master', icon: '🧼', type: 'good', description: 'Use body soap 100 times' },
    
    // 💀 나쁜 뱃지
    { id: 'bacteria_hotel', name: 'Bacteria Hotel', icon: '💩', type: 'bad', description: 'Reach 10,000+ bacteria' },
    { id: 'microbe_mansion', name: 'Microbe Mansion', icon: '🦠', type: 'bad', description: 'Don\'t shower for 3+ days' },
    { id: 'bio_hazard', name: 'Bio-Hazard', icon: '😷', type: 'bad', description: 'Average score below 60' },
    { id: 'cat_shower_king', name: 'Cat Shower King', icon: '🐱', type: 'bad', description: 'Cat Shower rate 50%+' },
    { id: 'the_unwashed', name: 'The Unwashed', icon: '💀', type: 'bad', description: 'Don\'t shower for 5+ days' },
    { id: 'stink_lord', name: 'Stink Lord', icon: '🤢', type: 'bad', description: 'Reach 5,000+ bacteria 3 times' },
    { id: 'bacteria_mayor', name: 'Bacteria City Mayor', icon: '🏚️', type: 'bad', description: '7 consecutive D grades' },
    
    // 😂 재밌는 뱃지
    { id: 'night_owl', name: 'Night Owl', icon: '🌙', type: 'funny', description: 'Shower after midnight 10 times' },
    { id: 'early_bird', name: 'Early Bird', icon: '🐓', type: 'funny', description: 'Shower before 6 AM 10 times' },
    { id: 'speed_runner', name: 'Speed Runner', icon: '⚡', type: 'funny', description: 'Complete 20 showers under 3 min' },
    { id: 'marathon_shower', name: 'Marathon Shower', icon: '🐌', type: 'funny', description: 'Shower for 40+ min 5 times' },
    { id: 'dry_shampoo_addict', name: 'Dry Shampoo Addict', icon: '🧴', type: 'funny', description: 'Use dry shampoo 30 times' },
    { id: 'face_splash_pro', name: 'Face Splash Pro', icon: '🐱', type: 'funny', description: 'Face wash only 50 times' },
    { id: 'feet_only_gang', name: 'Feet Only Gang', icon: '🦶', type: 'funny', description: 'Feet wash only 10 times' },
    
    // 🎯 히든 뱃지
    { id: 'lucky_7', name: 'Lucky 7', icon: '🎰', type: 'hidden', description: 'Score exactly 77 points' },
    { id: 'perfect_score', name: 'Perfect Score', icon: '💯', type: 'hidden', description: 'Achieve 100 points' },
    { id: 'full_rainbow', name: 'Full Rainbow', icon: '🌈', type: 'hidden', description: 'Get all grades S/A/B/C/D' },
    { id: 'rock_bottom', name: 'Rock Bottom', icon: '📉', type: 'hidden', description: 'Score 30 or below' },
    { id: 'comeback_kid', name: 'Comeback Kid', icon: '🔄', type: 'hidden', description: 'Get S grade right after D grade' }
  ]
  
  // 각 뱃지 체크
  for (const def of BADGE_DEFINITIONS) {
    const unlocked = await checkBadgeCondition(def.id, records, stats, DB)
    const progress = await getBadgeProgress(def.id, records, stats, DB)
    
    badges.push({
      ...def,
      unlocked,
      progress
    })
  }
  
  return badges
}

// ============================================
// 개별 뱃지 조건 체크
// ============================================
async function checkBadgeCondition(badgeId: string, records: any[], stats: any, DB: D1Database): Promise<boolean> {
  const avgScore = parseFloat(stats.avg_score) || 0
  const totalCount = parseInt(stats.total_count) || 0
  const catShowerCount = parseInt(stats.cat_shower_count) || 0
  const bodySoapCount = parseInt(stats.body_soap_count) || 0
  const actualShowerCount = parseInt(stats.actual_shower_count) || 0
  const dryShampooCount = parseInt(stats.dry_shampoo_count) || 0
  const faceWashCount = parseInt(stats.face_wash_count) || 0
  
  switch (badgeId) {
    // 좋은 뱃지
    case 'hygiene_master':
      return avgScore >= 90
    
    case 'perfect_week':
      // 최근 7개 기록이 모두 S등급
      return records.slice(0, 7).every((r: any) => r.grade === 'S') && records.length >= 7
    
    case 'diamond_clean':
      // 최근 30개 기록이 모두 A 이상
      return records.slice(0, 30).every((r: any) => ['S', 'A'].includes(r.grade)) && records.length >= 30
    
    case 'hot_streak':
      // 최근 10개가 모두 실제 샤워
      const recentShowers = records.slice(0, 10)
      return recentShowers.every((r: any) => r.body_soap === 1 || r.hair_wash === 1) && records.length >= 10
    
    case 'shower_enthusiast':
      return actualShowerCount >= 100
    
    case 'bacteria_killer':
      // 최근 7개 기록 모두 A 이상 (박테리아 낮음)
      return records.slice(0, 7).every((r: any) => ['S', 'A'].includes(r.grade)) && records.length >= 7
    
    case 'soap_master':
      return bodySoapCount >= 100
    
    // 나쁜 뱃지
    case 'bacteria_hotel':
      // 5일 이상 안 씻은 기록이 있는지 체크
      return records.some((r: any) => r.days_since_last >= 5)
    
    case 'microbe_mansion':
      return records.some((r: any) => r.days_since_last >= 3)
    
    case 'bio_hazard':
      return avgScore < 60 && totalCount >= 10
    
    case 'cat_shower_king':
      const catRate = actualShowerCount > 0 ? (catShowerCount / actualShowerCount) * 100 : 0
      return catRate >= 50 && actualShowerCount >= 10
    
    case 'the_unwashed':
      return records.some((r: any) => r.days_since_last >= 5)
    
    case 'stink_lord':
      // days_since_last >= 4인 기록이 3개 이상
      return records.filter((r: any) => r.days_since_last >= 4).length >= 3
    
    case 'bacteria_mayor':
      // 최근 7개가 모두 D등급
      return records.slice(0, 7).every((r: any) => r.grade === 'D') && records.length >= 7
    
    // 재밌는 뱃지
    case 'night_owl':
      // 시간이 00:00 ~ 05:59인 기록 10개 이상
      return records.filter((r: any) => {
        const hour = parseInt(r.start_time.split(':')[0])
        return hour >= 0 && hour < 6
      }).length >= 10
    
    case 'early_bird':
      return records.filter((r: any) => {
        const hour = parseInt(r.start_time.split(':')[0])
        return hour >= 4 && hour < 6
      }).length >= 10
    
    case 'speed_runner':
      return records.filter((r: any) => r.duration < 3).length >= 20
    
    case 'marathon_shower':
      return records.filter((r: any) => r.duration >= 40).length >= 5
    
    case 'dry_shampoo_addict':
      return dryShampooCount >= 30
    
    case 'face_splash_pro':
      return faceWashCount >= 50
    
    case 'feet_only_gang':
      // feet_wash만 체크한 기록
      return records.filter((r: any) => 
        r.feet_wash === 1 && 
        r.body_soap === 0 && 
        r.hair_wash === 0 && 
        r.teeth_brush === 0
      ).length >= 10
    
    // 히든 뱃지
    case 'lucky_7':
      return records.some((r: any) => r.total_score === 77)
    
    case 'perfect_score':
      return records.some((r: any) => r.total_score === 100)
    
    case 'full_rainbow':
      const grades = new Set(records.map((r: any) => r.grade))
      return grades.has('S') && grades.has('A') && grades.has('B') && grades.has('C') && grades.has('D')
    
    case 'rock_bottom':
      return records.some((r: any) => r.total_score <= 30)
    
    case 'comeback_kid':
      // D 다음에 바로 S가 온 경우
      for (let i = 0; i < records.length - 1; i++) {
        if (records[i].grade === 'S' && records[i + 1].grade === 'D') {
          return true
        }
      }
      return false
    
    default:
      return false
  }
}

// ============================================
// 뱃지 진행도 계산
// ============================================
async function getBadgeProgress(badgeId: string, records: any[], stats: any, DB: D1Database): Promise<number> {
  const avgScore = parseFloat(stats.avg_score) || 0
  const totalCount = parseInt(stats.total_count) || 0
  const catShowerCount = parseInt(stats.cat_shower_count) || 0
  const bodySoapCount = parseInt(stats.body_soap_count) || 0
  const actualShowerCount = parseInt(stats.actual_shower_count) || 0
  const dryShampooCount = parseInt(stats.dry_shampoo_count) || 0
  const faceWashCount = parseInt(stats.face_wash_count) || 0
  
  switch (badgeId) {
    case 'hygiene_master':
      return Math.min(100, (avgScore / 90) * 100)
    
    case 'perfect_week':
      const sGradeStreak = records.slice(0, 7).filter((r: any) => r.grade === 'S').length
      return (sGradeStreak / 7) * 100
    
    case 'hot_streak':
      const normalShowerStreak = records.slice(0, 10).filter((r: any) => r.body_soap === 1 || r.hair_wash === 1).length
      return (normalShowerStreak / 10) * 100
    
    case 'shower_enthusiast':
      return Math.min(100, (actualShowerCount / 100) * 100)
    
    case 'soap_master':
      return Math.min(100, (bodySoapCount / 100) * 100)
    
    case 'speed_runner':
      const speedCount = records.filter((r: any) => r.duration < 3).length
      return Math.min(100, (speedCount / 20) * 100)
    
    case 'dry_shampoo_addict':
      return Math.min(100, (dryShampooCount / 30) * 100)
    
    case 'face_splash_pro':
      return Math.min(100, (faceWashCount / 50) * 100)
    
    default:
      return 0
  }
}

// ============================================
// pts수 계산 함수
// ============================================
// 포인트 계산 함수
function calculatePoints(totalScore: number): number {
  if (totalScore >= 95) return 10
  if (totalScore >= 85) return 7
  if (totalScore >= 70) return 5
  if (totalScore >= 60) return 3
  return 1
}

async function calculateScores(data: any, DB: D1Database) {
  const { body_soap, hair_wash, dry_shampoo, face_wash, cat_shower, teeth_brush, feet_wash, bath, exfoliation, duration } = data

  // 1. Completeness 점수 (Checklist)
  // 새로운 배점: Body Soap (25%), Hair Wash (25%), Face Wash (20%), Teeth Brush (15%), Feet Wash (15%)
  // ✨ Body Soap 체크 시 Feet Wash 자동 포함 (몸 씻으면 발도 씻게 됨)
  // 🛁 Bath 체크 시 Body Soap + Feet Wash 자동 포함 + 10점 보너스
  // 🧽 Exfoliation은 Bath와 함께만 가능, +5점 보너스
  let completenessPoints = 0
  
  if (bath) {
    // 목욕 = Body Soap + Feet Wash 자동 포함 + 보너스
    completenessPoints += 25  // Body Soap 자동
    completenessPoints += 15  // Feet Wash 자동
    completenessPoints += 10  // Bath 보너스
    
    if (exfoliation) {
      completenessPoints += 5  // Exfoliation 보너스 (목욕과 함께만)
    }
  } else if (body_soap) {
    completenessPoints += 25  // Body Soap
    completenessPoints += 15  // Feet Wash 자동 포함
  } else if (feet_wash) {
    completenessPoints += 15  // 발만 씻은 경우
  }
  
  if (hair_wash) completenessPoints += 25
  else if (dry_shampoo) completenessPoints += 12.5  // 머리 안 감았지만 드라이샴푸는 절반 인정
  if (face_wash) completenessPoints += 20  // 제대로 세수 (세안제 사용)
  // cat_shower는 점수에 포함 안 됨 (나쁜 습관 마커)
  if (teeth_brush) completenessPoints += 15
  
  const completeness_score = completenessPoints

  // 2. Time pts수 (10-20min이 이상적, 목욕은 20-40min 권장)
  let duration_score = 100
  if (bath) {
    // 목욕은 더 긴 시간 권장
    if (duration < 15) {
      duration_score = 60  // 목욕치고 너무 짧음
    } else if (duration < 20) {
      duration_score = 80  // 좀 짧음
    } else if (duration <= 40) {
      duration_score = 100 // 적정 (목욕 시간)
    } else if (duration <= 50) {
      duration_score = 90  // 좀 김
    } else {
      duration_score = 70  // 너무 김
    }
  } else {
    // 일반 샤워
    if (duration < 5) {
      duration_score = 40  // 너무 짧음 (Cat Shower 의심)
    } else if (duration < 10) {
      duration_score = 70  // 좀 짧음
    } else if (duration <= 20) {
      duration_score = 100 // 적정
    } else if (duration <= 30) {
      duration_score = 90  // 좀 김
    } else {
      duration_score = 70  // 너무 김 (물 낭비)
    }
  }

  // 3. Frequency pts수 (마지막 실제 샤워 이후 경과일)
  let frequency_score = 100  // 첫 기록이면 기본 100점
  let days_since_last = 1

  try {
    // 마지막 실제 샤워 기록만 찾기 (양치질/발만 씻기 제외)
    // body_soap=1 OR hair_wash=1 OR bath=1인 기록만
    const lastShower = await DB.prepare(`
      SELECT date, start_time FROM shower_records 
      WHERE body_soap = 1 OR hair_wash = 1 OR bath = 1
      ORDER BY date DESC, start_time DESC 
      LIMIT 1
    `).first()

    if (lastShower) {
      const lastDate = new Date(lastShower.date as string)
      const currentDate = new Date(data.date)  // 입력된 date 사용
      days_since_last = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

      // Frequency pts수 계산
      if (days_since_last <= 0) {
        // 같은 날 또는 과거 날짜: 하루에 여러 번 샤워 (정상)
        frequency_score = 100
        days_since_last = 0
      } else if (days_since_last === 1) {
        frequency_score = 100
      } else if (days_since_last === 2) {
        frequency_score = 80
      } else if (days_since_last === 3) {
        frequency_score = 60
      } else if (days_since_last === 4) {
        frequency_score = 40
      } else {
        frequency_score = 20
      }
    }
  } catch (error) {
    console.error('Error calculating frequency:', error)
  }

  // 4. 실제 샤워 여부 판단
  const isActualShower = body_soap || hair_wash || bath  // 몸/머리/목욕 중 하나라도 해야 샤워로 인정
  const isDryShampooOnly = dry_shampoo && !hair_wash && !body_soap && !bath  // 드라이샴푸만 사용
  
  // 5. Score (가중 Avg) - 실제 샤워인 경우에만 계산
  const total_score = Math.round(
    completeness_score * 0.4 +
    frequency_score * 0.3 +
    duration_score * 0.3
  )

  // 6. Grade 산정
  let grade = 'D'
  if (total_score >= 90) grade = 'S'
  else if (total_score >= 80) grade = 'A'
  else if (total_score >= 70) grade = 'B'
  else if (total_score >= 60) grade = 'C'

  // 7. Cat Shower 판정
  // - 실제 샤워(body_soap or hair_wash)를 했는데 5분 미만이면 Cat Shower
  // - 양치질/발만 씻기는 샤워가 아니므로 Cat Shower 판정 안 함
  const is_cat_shower = isActualShower && duration < 5

  return {
    completeness_score: Math.round(completeness_score),
    frequency_score,
    duration_score,
    total_score,
    grade,
    is_cat_shower,
    days_since_last,
    is_actual_shower: isActualShower,  // 실제 샤워 여부 반환
    is_dry_shampoo_only: isDryShampooOnly  // 드라이샴푸만 사용 여부
  }
}

// ============================================
// 메인 페이지
// ============================================
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SPR - Shower Performance Report</title>
        <style>
            body { 
                font-family: 'Montserrat', sans-serif; 
            }
        </style>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            body { font-family: 'Montserrat', sans-serif; }
        </style>
    </head>
    <body class="bg-gray-50 min-h-screen flex flex-col pt-32">
        <!-- Header (Fixed) -->
        <div class="bg-white shadow-md fixed top-0 left-0 right-0 z-50">
            <div class="max-w-7xl mx-auto px-6 py-6">
                <div class="flex items-start justify-between">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-800 mb-2">
                            Shower Performance Report
                        </h1>
                        <p class="text-gray-600">
                            Individual Shower Habit Reports & Hygiene Tracking
                        </p>
                    </div>
                    <button onclick="showAddForm()" class="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg flex items-center space-x-2 transition-all shadow-sm">
                        <i class="fas fa-plus"></i>
                        <span>Add Record</span>
                    </button>
                </div>
            </div>

            <!-- Tabs (부분적으로 헤더 안에 포함) -->
            <div class="bg-white border-t">
                <div class="max-w-7xl mx-auto px-6">
                    <div class="flex border-b">
                        <button onclick="showTab('report')" id="tab-report" class="px-6 py-3 font-medium text-blue-600 border-b-2 border-blue-500">
                            <i class="fas fa-chart-line mr-2"></i>Report
                        </button>
                        <button onclick="showTab('scorecard')" id="tab-scorecard" class="px-6 py-3 font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-800">
                            <i class="fas fa-trophy mr-2"></i>Scorecard
                        </button>
                        <button onclick="showTab('rewards')" id="tab-rewards" class="px-6 py-3 font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-800">
                            <i class="fas fa-gift mr-2"></i>Rewards
                        </button>
                        <button onclick="showTab('settings')" id="tab-settings" class="px-6 py-3 font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-800">
                            <i class="fas fa-cog mr-2"></i>Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="flex-grow">

        <!-- Report 탭 -->
        <div id="content-report" class="max-w-7xl mx-auto px-4 py-6">
            <!-- 현재 위생 상태 카드 -->
            <div id="hygiene-status-card" class="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg shadow-lg p-6 mb-6">
                <div class="text-center" id="hygiene-status-content">
                    <div class="text-6xl mb-3">😊</div>
                    <h3 class="text-2xl font-bold text-gray-800 mb-2">Loading...</h3>
                    <p class="text-gray-600 mb-3">Checking your hygiene status...</p>
                    <div class="inline-block px-4 py-2 bg-white rounded-full shadow-sm">
                        <span class="text-3xl">🦠</span>
                        <span class="text-sm text-gray-600 ml-2">Bacteria Level: ?</span>
                    </div>
                </div>
            </div>
            
            <!-- Date 필터 섹션 -->
            <div class="bg-white rounded-lg shadow p-4 mb-4">
                <h3 class="text-lg font-semibold text-gray-900 mb-3">
                    <i class="fas fa-filter text-blue-600 mr-2"></i>Date Filter
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input type="date" id="filter-start-date" placeholder="YYYY-MM-DD" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input type="date" id="filter-end-date" placeholder="YYYY-MM-DD" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div class="flex items-end">
                        <button onclick="applyDateFilter()" class="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2">
                            <i class="fas fa-search"></i>
                            <span>Search</span>
                        </button>
                    </div>
                    <div class="flex items-end">
                        <button onclick="resetDateFilter()" class="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center justify-center space-x-2">
                            <i class="fas fa-redo"></i>
                            <span>Reset</span>
                        </button>
                    </div>
                </div>
                
                <!-- Quick Filter Buttons -->
                <div class="flex flex-wrap gap-2 mt-4">
                    <button onclick="quickFilter('today')" class="px-3 py-1 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full">
                        <i class="fas fa-calendar-day mr-1"></i>Today
                    </button>
                    <button onclick="quickFilter('week')" class="px-3 py-1 text-sm bg-green-50 hover:bg-green-100 text-green-700 rounded-full">
                        <i class="fas fa-calendar-week mr-1"></i>Last 7 Days
                    </button>
                    <button onclick="quickFilter('month')" class="px-3 py-1 text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-full">
                        <i class="fas fa-calendar-alt mr-1"></i>Last 30 Days
                    </button>
                    <button onclick="quickFilter('all')" class="px-3 py-1 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full">
                        <i class="fas fa-list mr-1"></i>All
                    </button>
                </div>
                
                <!-- 필터 결과 표시 -->
                <div id="filter-result" class="mt-3 text-sm text-gray-600 hidden">
                    <i class="fas fa-info-circle text-blue-500 mr-1"></i>
                    <span id="filter-result-text"></span>
                </div>
            </div>
            
            <!-- Shower Records 테이블 -->
            <div class="bg-white rounded-lg shadow">
                <div class="p-6">
                    <h2 class="text-xl font-bold text-gray-900 mb-4">Shower Records</h2>
                    <div id="records-list"></div>
                </div>
            </div>
        </div>

        <!-- Scorecard 탭 -->
        <div id="content-scorecard" class="max-w-7xl mx-auto px-4 py-6 hidden">
            <!-- 전체 위생 등급 카드 -->
            <div id="overall-hygiene-card" class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow-lg p-6 mb-6">
                <div class="text-center" id="overall-hygiene-content">
                    <div class="text-6xl mb-3">😊</div>
                    <h3 class="text-2xl font-bold text-gray-800 mb-2">Overall Hygiene Level</h3>
                    <p class="text-gray-600 mb-3">Based on your average performance</p>
                    <div class="inline-block px-4 py-2 bg-white rounded-full shadow-sm">
                        <span class="text-3xl">🦠🦠🦠</span>
                        <span class="text-sm text-gray-600 ml-2">Avg Score: ?</span>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6" id="grade-cards"></div>
            
            <!-- Badges Section -->
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <h3 class="text-lg font-bold text-gray-900 mb-4">
                    🏆 Achievements & Badges
                </h3>
                <div id="badges-container">
                    <p class="text-gray-500">Loading badges...</p>
                </div>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">Points Trend</h3>
                    <canvas id="trend-chart"></canvas>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">
                        Cat Shower Stats 
                        <i class="fas fa-info-circle text-gray-400 cursor-help ml-2" title="Cat Shower: Duration < 5min (quick wash without proper cleaning)"></i>
                    </h3>
                    <div id="cat-shower-stats"></div>
                </div>
            </div>
        </div>

        <!-- Settings 탭 -->
        <div id="content-settings" class="max-w-7xl mx-auto px-4 py-6 hidden">
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-2xl font-bold text-gray-900 mb-6">
                    <i class="fas fa-cog mr-2"></i>Settings
                </h2>
                
                <!-- Timezone Setting -->
                <div class="mb-6 pb-6 border-b">
                    <label class="block text-lg font-medium text-gray-900 mb-2">
                        <i class="fas fa-globe-americas mr-2"></i>Timezone
                    </label>
                    <p class="text-sm text-gray-600 mb-3">
                        Select your timezone for accurate date/time calculations and bacteria growth tracking.
                    </p>
                    <select id="timezone-select" class="w-full md:w-96 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                        <optgroup label="United States">
                            <option value="America/New_York">Eastern Time (ET) - New York</option>
                            <option value="America/Chicago">Central Time (CT) - Chicago</option>
                            <option value="America/Denver">Mountain Time (MT) - Denver</option>
                            <option value="America/Los_Angeles">Pacific Time (PT) - Los Angeles</option>
                            <option value="America/Anchorage">Alaska Time (AKT) - Anchorage</option>
                            <option value="America/Phoenix">Arizona Time (MST) - Phoenix</option>
                        </optgroup>
                        <optgroup label="Asia">
                            <option value="Asia/Seoul">Korea Standard Time (KST) - Seoul</option>
                            <option value="Asia/Tokyo">Japan Standard Time (JST) - Tokyo</option>
                            <option value="Asia/Shanghai">China Standard Time (CST) - Shanghai</option>
                        </optgroup>
                        <optgroup label="Europe">
                            <option value="Europe/London">Greenwich Mean Time (GMT) - London</option>
                            <option value="Europe/Paris">Central European Time (CET) - Paris</option>
                        </optgroup>
                        <optgroup label="Other">
                            <option value="UTC">UTC (Coordinated Universal Time)</option>
                        </optgroup>
                    </select>
                    <div class="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p class="text-sm text-blue-800">
                            <i class="fas fa-clock mr-1"></i>
                            <strong>Current time in selected timezone:</strong> <span id="current-timezone-time" class="font-mono">Loading...</span>
                        </p>
                    </div>
                </div>

                <!-- Date Format Setting -->
                <div class="mb-6 pb-6 border-b">
                    <label class="block text-lg font-medium text-gray-900 mb-2">
                        <i class="fas fa-calendar mr-2"></i>Date Format
                    </label>
                    <select id="date-format-select" class="w-full md:w-96 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="en-US">MM/DD/YYYY (US Format)</option>
                        <option value="en-GB">DD/MM/YYYY (UK Format)</option>
                        <option value="en-CA">YYYY-MM-DD (ISO Format)</option>
                        <option value="ko-KR">YYYY년 MM월 DD일 (Korean)</option>
                    </select>
                </div>

                <!-- Time Format Setting -->
                <div class="mb-6">
                    <label class="block text-lg font-medium text-gray-900 mb-2">
                        <i class="fas fa-clock mr-2"></i>Time Format
                    </label>
                    <select id="time-format-select" class="w-full md:w-96 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="12h">12-hour (1:00 PM)</option>
                        <option value="24h">24-hour (13:00)</option>
                    </select>
                </div>

                <!-- Save Button -->
                <div class="flex items-center space-x-3">
                    <button onclick="saveSettings()" class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg transition-all">
                        <i class="fas fa-save mr-2"></i>Save Settings
                    </button>
                    <button onclick="resetSettings()" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2.5 rounded-lg transition-all">
                        <i class="fas fa-undo mr-2"></i>Reset to Default
                    </button>
                </div>

                <!-- Glossary Section -->
                <div class="mt-8 pt-8 border-t">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">
                        <i class="fas fa-book mr-2"></i>📚 Scoring System Glossary
                    </h2>
                    
                    <!-- Total Score Formula -->
                    <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-6 border-l-4 border-blue-500">
                        <h3 class="text-xl font-bold text-gray-900 mb-3">🎯 Total Score Formula</h3>
                        <div class="bg-white rounded-lg p-4 font-mono text-sm mb-3">
                            Total Score = (Completeness × 40%) + (Frequency × 30%) + (Duration × 30%)
                        </div>
                        <p class="text-gray-700">
                            Your final score is calculated by combining three key factors with weighted importance.
                        </p>
                    </div>

                    <!-- 1. Completeness Score -->
                    <div class="bg-white rounded-lg shadow-sm p-6 mb-4">
                        <h3 class="text-lg font-bold text-gray-900 mb-3">
                            <span class="text-blue-600">1️⃣ Completeness Score (40%)</span>
                        </h3>
                        <p class="text-gray-700 mb-3">
                            Measures how thoroughly you completed the hygiene checklist. Each item contributes to a maximum of 100 points.
                        </p>
                        <div class="space-y-2 ml-4">
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-40">🧼 Body Soap:</span>
                                <span class="text-gray-700">25 points (essential) + <strong class="text-green-600">Auto includes Feet Wash (+15pts)</strong></span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-40">🧴 Hair Wash:</span>
                                <span class="text-gray-700">25 points (essential)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-40">🧴✨ Dry Shampoo:</span>
                                <span class="text-gray-700">12.5 points (half credit when not washing hair)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-40">🧼😊 Face Wash:</span>
                                <span class="text-gray-700">20 points (with cleanser, highly recommended)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-40">🐱💧 Cat Shower:</span>
                                <span class="text-red-600">0 points (water only, not recommended - bad habit marker)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-40">🪥 Teeth Brush:</span>
                                <span class="text-gray-700">15 points (important for hygiene)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-40">🦶 Feet Wash:</span>
                                <span class="text-gray-700">15 points (automatically included with Body Soap)</span>
                            </div>
                        </div>
                        <div class="mt-3 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                            <p class="text-sm text-blue-900">
                                <strong>💡 Tip:</strong> A perfect completeness score is 100 points (Body + Hair + Face + Teeth). <strong>Feet Wash is automatically included when you use Body Soap!</strong>
                            </p>
                        </div>
                        <div class="mt-2 p-3 bg-green-50 rounded border-l-4 border-green-400">
                            <p class="text-sm text-green-900">
                                <strong>✨ Auto-Include Logic:</strong> When you check "Body Soap", the system automatically awards Feet Wash points since washing your body naturally includes washing your feet. You don't need to check Feet Wash separately!
                            </p>
                        </div>
                    </div>

                    <!-- 2. Frequency Score -->
                    <div class="bg-white rounded-lg shadow-sm p-6 mb-4">
                        <h3 class="text-lg font-bold text-gray-900 mb-3">
                            <span class="text-green-600">2️⃣ Frequency Score (30%)</span>
                        </h3>
                        <p class="text-gray-700 mb-3">
                            Measures how regularly you shower. Based on days since your last <strong>actual shower</strong> (body soap OR hair wash).
                        </p>
                        <div class="space-y-2 ml-4">
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-32">1 day ago:</span>
                                <span class="text-green-600">100 points ✅ (excellent hygiene)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-32">2 days ago:</span>
                                <span class="text-yellow-600">80 points (acceptable)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-32">3 days ago:</span>
                                <span class="text-orange-600">60 points (needs improvement)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-32">4 days ago:</span>
                                <span class="text-red-600">40 points ⚠️ (poor hygiene)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-32">5+ days ago:</span>
                                <span class="text-red-600">20 points 💀 (bacteria party!)</span>
                            </div>
                        </div>
                        <div class="mt-3 p-3 bg-green-50 rounded border-l-4 border-green-400">
                            <p class="text-sm text-green-900">
                                <strong>💡 Tip:</strong> Showering every 1-2 days maintains optimal hygiene and maximizes your frequency score.
                            </p>
                        </div>
                    </div>

                    <!-- 3. Duration Score -->
                    <div class="bg-white rounded-lg shadow-sm p-6 mb-4">
                        <h3 class="text-lg font-bold text-gray-900 mb-3">
                            <span class="text-purple-600">3️⃣ Duration Score (30%)</span>
                        </h3>
                        <p class="text-gray-700 mb-3">
                            Measures shower duration quality. Too short suggests rushed cleaning; too long wastes water.
                        </p>
                        <div class="space-y-2 ml-4">
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-32">&lt; 5 minutes:</span>
                                <span class="text-red-600">40 points 🐱 (cat shower risk - too rushed)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-32">5-9 minutes:</span>
                                <span class="text-yellow-600">70 points (a bit short)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-32">10-20 minutes:</span>
                                <span class="text-green-600">100 points ✅ (optimal duration)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-32">21-30 minutes:</span>
                                <span class="text-yellow-600">90 points (a bit long)</span>
                            </div>
                            <div class="flex items-start">
                                <span class="font-semibold text-gray-900 w-32">&gt; 30 minutes:</span>
                                <span class="text-orange-600">70 points 💧 (water waste concern)</span>
                            </div>
                        </div>
                        <div class="mt-3 p-3 bg-purple-50 rounded border-l-4 border-purple-400">
                            <p class="text-sm text-purple-900">
                                <strong>💡 Tip:</strong> Aim for 10-20 minutes: thorough cleaning without wasting water.
                            </p>
                        </div>
                    </div>

                    <!-- Grade System -->
                    <div class="bg-white rounded-lg shadow-sm p-6 mb-4">
                        <h3 class="text-lg font-bold text-gray-900 mb-3">
                            <span class="text-indigo-600">🏆 Grade System</span>
                        </h3>
                        <p class="text-gray-700 mb-3">
                            Your total score is converted to a letter grade for easy understanding.
                        </p>
                        <div class="space-y-2 ml-4">
                            <div class="flex items-start">
                                <span class="px-3 py-1 rounded font-bold bg-purple-100 text-purple-800 w-16 text-center mr-3">S</span>
                                <span class="text-gray-700">90-100 points: Hygiene Master! 😇✨</span>
                            </div>
                            <div class="flex items-start">
                                <span class="px-3 py-1 rounded font-bold bg-blue-100 text-blue-800 w-16 text-center mr-3">A</span>
                                <span class="text-gray-700">80-89 points: Excellent hygiene! 😊</span>
                            </div>
                            <div class="flex items-start">
                                <span class="px-3 py-1 rounded font-bold bg-green-100 text-green-800 w-16 text-center mr-3">B</span>
                                <span class="text-gray-700">70-79 points: Good job! 😐</span>
                            </div>
                            <div class="flex items-start">
                                <span class="px-3 py-1 rounded font-bold bg-yellow-100 text-yellow-800 w-16 text-center mr-3">C</span>
                                <span class="text-gray-700">60-69 points: Needs improvement 😷</span>
                            </div>
                            <div class="flex items-start">
                                <span class="px-3 py-1 rounded font-bold bg-red-100 text-red-800 w-16 text-center mr-3">D</span>
                                <span class="text-gray-700">&lt; 60 points: Bacteria civilization! 🤢</span>
                            </div>
                        </div>
                    </div>

                    <!-- Special Markers -->
                    <div class="bg-white rounded-lg shadow-sm p-6">
                        <h3 class="text-lg font-bold text-gray-900 mb-3">
                            <span class="text-orange-600">⚠️ Special Markers</span>
                        </h3>
                        <div class="space-y-3">
                            <div class="p-3 bg-red-50 rounded border-l-4 border-red-400">
                                <p class="font-semibold text-red-900 mb-1">🐱💧 Cat Shower Detection</p>
                                <p class="text-sm text-red-800">
                                    Triggered when you check "Cat Shower" OR shower duration is less than 5 minutes without proper cleaning. This is a bad habit marker and contributes 0 points.
                                </p>
                            </div>
                            <div class="p-3 bg-green-50 rounded border-l-4 border-green-400">
                                <p class="font-semibold text-green-900 mb-1">🦠 Bacteria Reduction Rate</p>
                                <p class="text-sm text-green-800">
                                    • Face Wash + Teeth Brush: ~40% bacteria reduction<br>
                                    • Cat Shower + Teeth Brush: ~25% bacteria reduction<br>
                                    • Full shower (Body + Hair + Face + Teeth): ~60% bacteria reduction
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Rewards 탭 -->
        <div id="content-rewards" class="max-w-7xl mx-auto px-4 py-6 hidden">
            <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow-lg p-6 mb-6">
                <div class="text-center">
                    <div class="text-6xl mb-3">🎁</div>
                    <h2 class="text-3xl font-bold text-gray-800 mb-2">Rewards & Points</h2>
                    <p class="text-gray-600">Earn rewards for your hygiene achievements!</p>
                </div>
            </div>

            <!-- Points Summary -->
            <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-2xl font-bold text-gray-900">
                        <i class="fas fa-coins text-yellow-500 mr-2"></i>Your Points
                    </h3>
                    <div class="text-right">
                        <div class="text-4xl font-bold text-purple-600" id="total-points">0</div>
                        <div class="text-sm text-gray-500">Lifetime: <span id="lifetime-points">0</span> pts</div>
                    </div>
                </div>
                <button onclick="showPointShop()" class="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 rounded-lg font-semibold">
                    <i class="fas fa-shopping-cart mr-2"></i>Open Point Shop
                </button>
            </div>

            <!-- Active Goals -->
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <h3 class="text-xl font-bold text-gray-900 mb-4">
                    <i class="fas fa-bullseye text-blue-600 mr-2"></i>Active Goals
                </h3>
                <div id="active-goals-container">
                    <p class="text-gray-500">Loading goals...</p>
                </div>
            </div>

            <!-- Pending Rewards -->
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <h3 class="text-xl font-bold text-gray-900 mb-4">
                    <i class="fas fa-gift text-green-600 mr-2"></i>Pending Rewards
                    <span id="pending-count" class="ml-2 px-3 py-1 bg-red-500 text-white text-sm rounded-full">0</span>
                </h3>
                <div id="pending-rewards-container">
                    <p class="text-gray-500">No pending rewards yet. Keep showering!</p>
                </div>
            </div>
        </div>

        <!-- Add Record Modal -->
        <div id="add-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-xl font-bold text-gray-900 mb-4">Add Record</h3>
                <form id="add-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input type="date" id="input-date" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                        <input type="time" id="input-time" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                        <input type="number" id="input-duration" required min="1" max="60" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-medium text-gray-700">Checklist</label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-body-soap" class="rounded">
                            <span>Proper Body Soap 🧼</span>
                        </label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-hair-wash" class="rounded">
                            <span>Hair Wash 🧴</span>
                        </label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-dry-shampoo" class="rounded">
                            <span>Dry Shampoo 🧴✨ <span class="text-xs text-gray-500">(when not washing hair)</span></span>
                        </label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-face-wash" class="rounded">
                            <span>Face Wash 🧼😊 <span class="text-xs text-green-600">(with cleanser +20%)</span></span>
                        </label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-cat-shower" class="rounded">
                            <span>Cat Face Wash 🐱💧 <span class="text-xs text-orange-600">(water only - not recommended)</span></span>
                        </label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-teeth-brush" class="rounded">
                            <span>Teeth Brush 🪥</span>
                        </label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-feet-wash" class="rounded">
                            <span>Feet Wash 🦶 <span class="text-xs text-gray-500">(auto-included with Body Soap)</span></span>
                        </label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-bath" class="rounded">
                            <span>Bath 🛁 <span class="text-xs text-purple-600">(includes Body Soap & Feet +10pts)</span></span>
                        </label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-exfoliation" class="rounded">
                            <span>Exfoliation 🧽 <span class="text-xs text-purple-600">(only with Bath +5pts)</span></span>
                        </label>
                    </div>
                    <div class="flex space-x-3 pt-4">
                        <button type="submit" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg">
                            Save
                        </button>
                        <button type="button" onclick="hideAddForm()" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 푸터 -->
        <footer class="bg-white border-t mt-12">
            <div class="max-w-7xl mx-auto px-4 py-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- 왼쪽: 로고 & 설명 -->
                    <div>
                        <p class="text-sm text-gray-600">
                            SPR (Shower Performance Report)<br>
                            Data-driven Hygiene Improvement Solution
                        </p>
                    </div>
                    
                    <!-- 중앙: Quick Links -->
                    <div>
                        <h3 class="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
                        <ul class="space-y-2 text-sm text-gray-600">
                            <li><a href="#" onclick="showTab('report'); return false;" class="hover:text-blue-600">Report View</a></li>
                            <li><a href="#" onclick="showTab('scorecard'); return false;" class="hover:text-blue-600">Scorecard View</a></li>
                            <li><a href="#" onclick="showAddForm(); return false;" class="hover:text-blue-600 transition-colors">Add Record</a></li>
                        </ul>
                    </div>
                    
                    <!-- 오른쪽: 통계 -->
                    <div>
                        <h3 class="text-sm font-semibold text-gray-900 mb-3">Current Status</h3>
                        <div class="text-sm text-gray-600 space-y-1" id="footer-stats">
                            <p>Total Records: <span class="font-medium text-gray-900">-</span></p>
                            <p>Avg Points: <span class="font-medium text-gray-900">-</span></p>
                            <p>Cat Shower Rate: <span class="font-medium text-red-600">-</span></p>
                        </div>
                    </div>
                </div>
                
                <div class="border-t mt-6 pt-6 text-center text-sm text-gray-500">
                    <p>© 2026 WAIV SPR Project. Made with 💙 for HW's hygiene improvement.</p>
                    <p class="mt-1">IPR Parody Edition | v1.2.0</p>
                    <p class="mt-2 text-xs">
                        <a href="#" onclick="showChangelog(); return false;" class="text-blue-600 hover:text-blue-800 underline">
                            📝 Changelog
                        </a>
                    </p>
                </div>
            </div>
        </footer>

        <!-- Changelog Modal -->
        <div id="changelog-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-2xl font-bold text-gray-900">📝 Version History</h3>
                    <button onclick="hideChangelog()" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <div class="space-y-6">
                    <!-- v1.2.0 -->
                    <div class="border-l-4 border-blue-500 pl-4">
                        <div class="flex items-center space-x-2 mb-2">
                            <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold text-sm">v1.2.0</span>
                            <span class="text-gray-500 text-sm">2026-05-11</span>
                        </div>
                        <h4 class="font-bold text-gray-900 mb-2">🧼 Face Wash Update & Auto-Include Logic</h4>
                        <ul class="space-y-1 text-sm text-gray-700">
                            <li>✨ <strong>Added Face Wash (🧼😊)</strong>: New checklist item for proper face washing with cleanser (+20 points)</li>
                            <li>🐱 <strong>Separated Cat Shower</strong>: Cat Shower now only for water-only face rinsing (0 points, bad habit marker)</li>
                            <li>🦶 <strong>Auto-Include Logic</strong>: Body Soap now automatically includes Feet Wash points (no need to check separately!)</li>
                            <li>📊 <strong>Updated Scoring</strong>: Body 25% + Hair 25% + Face 20% + Teeth 15% + Feet 15% (auto with Body)</li>
                            <li>📚 <strong>Added Glossary</strong>: Comprehensive scoring system guide in Settings tab</li>
                            <li>🎯 <strong>Fixed Avg Score</strong>: Scorecard now displays average score correctly</li>
                            <li>📌 <strong>Fixed Header</strong>: Header and tabs now stay at top when scrolling</li>
                        </ul>
                    </div>

                    <!-- v1.1.0 -->
                    <div class="border-l-4 border-green-500 pl-4">
                        <div class="flex items-center space-x-2 mb-2">
                            <span class="px-3 py-1 bg-green-100 text-green-800 rounded-full font-semibold text-sm">v1.1.0</span>
                            <span class="text-gray-500 text-sm">2026-04-30</span>
                        </div>
                        <h4 class="font-bold text-gray-900 mb-2">🚀 Initial Production Release</h4>
                        <ul class="space-y-1 text-sm text-gray-700">
                            <li>🎯 <strong>Core Features</strong>: Shower tracking with completeness, frequency, and duration scoring</li>
                            <li>📈 <strong>Statistics</strong>: Grade distribution, cat shower stats, trend charts</li>
                            <li>🏆 <strong>Badge System</strong>: Good, bad, funny, and hidden achievement badges</li>
                            <li>🕐 <strong>Timezone Support</strong>: US, Asia, Europe timezones with custom date/time formats</li>
                            <li>🔍 <strong>Date Filters</strong>: Filter records by date range with quick filters</li>
                            <li>🦠 <strong>Bacteria Tracking</strong>: Real-time bacteria level based on last shower</li>
                            <li>☁️ <strong>Cloudflare D1</strong>: Production database with migration support</li>
                        </ul>
                    </div>

                    <!-- v1.0.0 -->
                    <div class="border-l-4 border-purple-500 pl-4">
                        <div class="flex items-center space-x-2 mb-2">
                            <span class="px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-semibold text-sm">v1.0.0</span>
                            <span class="text-gray-500 text-sm">2026-04-26</span>
                        </div>
                        <h4 class="font-bold text-gray-900 mb-2">🎉 Project Launch</h4>
                        <ul class="space-y-1 text-sm text-gray-700">
                            <li>🚿 <strong>Basic Tracking</strong>: Record shower date, time, duration, and checklist items</li>
                            <li>📊 <strong>Simple Scoring</strong>: Basic completeness and frequency scoring</li>
                            <li>💾 <strong>Local Storage</strong>: Data persistence in local development</li>
                            <li>🎨 <strong>UI Design</strong>: Clean, responsive interface with Tailwind CSS</li>
                        </ul>
                    </div>
                </div>

                <div class="mt-6 pt-4 border-t text-center">
                    <button onclick="hideChangelog()" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg">
                        Close
                    </button>
                </div>
            </div>
        </div>

        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
