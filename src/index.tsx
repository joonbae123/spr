import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 설정
app.use('/api/*', cors())

// 정적 파일 서빙
app.use('/static/*', serveStatic({ root: './public' }))
app.use('/favicon.ico', serveStatic({ path: './public/favicon.ico' }))

// ============================================
// API: 샤워 기록 조회
// ============================================
app.get('/api/records', async (c) => {
  const { DB } = c.env

  try {
    const result = await DB.prepare(`
      SELECT * FROM shower_records 
      ORDER BY date DESC, start_time DESC
      LIMIT 100
    `).all()

    return c.json({ 
      success: true, 
      records: result.results 
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
// API: 새 샤워 기록 추가
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
      teeth_brush,
      feet_wash
    } = data

    // 점수 계산
    const scores = calculateScores({
      body_soap,
      hair_wash,
      teeth_brush,
      feet_wash,
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
        body_soap, hair_wash, teeth_brush, feet_wash,
        completeness_score, frequency_score, duration_score, total_score, grade,
        is_cat_shower, days_since_last
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      date, start_time, duration,
      body_soap ? 1 : 0, 
      hair_wash ? 1 : 0, 
      teeth_brush ? 1 : 0, 
      feet_wash ? 1 : 0,
      completeness_score,
      frequency_score,
      duration_score,
      total_score,
      grade,
      is_cat_shower ? 1 : 0,
      days_since_last
    ).run()

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
      }
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
// API: 통계 조회
// ============================================
app.get('/api/stats', async (c) => {
  const { DB } = c.env

  try {
    // 등급별 분포
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

    // 고양이샤워 통계
    const catShowerStats = await DB.prepare(`
      SELECT 
        COUNT(*) as total_showers,
        SUM(CASE WHEN is_cat_shower = 1 THEN 1 ELSE 0 END) as cat_showers,
        ROUND(AVG(days_since_last), 1) as avg_days_between
      FROM shower_records
    `).first()

    // 최근 트렌드 (최근 30일)
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

    return c.json({
      success: true,
      stats: {
        gradeDistribution: gradeDistribution.results,
        catShowerStats,
        recentTrend: recentTrend.results
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
// 점수 계산 함수
// ============================================
async function calculateScores(data: any, DB: D1Database) {
  const { body_soap, hair_wash, teeth_brush, feet_wash, duration } = data

  // 1. 완성도 점수 (체크리스트)
  const checkedItems = [body_soap, hair_wash, teeth_brush, feet_wash].filter(Boolean).length
  const completeness_score = (checkedItems / 4) * 100

  // 2. 시간 점수 (10-20분이 이상적)
  let duration_score = 100
  if (duration < 5) {
    duration_score = 40  // 너무 짧음 (고양이샤워 의심)
  } else if (duration < 10) {
    duration_score = 70  // 좀 짧음
  } else if (duration <= 20) {
    duration_score = 100 // 적정
  } else if (duration <= 30) {
    duration_score = 90  // 좀 김
  } else {
    duration_score = 70  // 너무 김 (물 낭비)
  }

  // 3. 주기 점수 (마지막 샤워 이후 경과일)
  let frequency_score = 100
  let days_since_last = 1

  try {
    const lastShower = await DB.prepare(`
      SELECT date FROM shower_records 
      ORDER BY date DESC, start_time DESC 
      LIMIT 1
    `).first()

    if (lastShower) {
      const lastDate = new Date(lastShower.date as string)
      const today = new Date()
      days_since_last = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

      // 주기 점수 계산
      if (days_since_last === 1) {
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

  // 4. 총점 (가중 평균)
  const total_score = Math.round(
    completeness_score * 0.4 +
    frequency_score * 0.3 +
    duration_score * 0.3
  )

  // 5. 등급 산정
  let grade = 'D'
  if (total_score >= 90) grade = 'S'
  else if (total_score >= 80) grade = 'A'
  else if (total_score >= 70) grade = 'B'
  else if (total_score >= 60) grade = 'C'

  // 6. 고양이샤워 판정
  const is_cat_shower = completeness_score < 50 && duration < 8

  return {
    completeness_score: Math.round(completeness_score),
    frequency_score,
    duration_score,
    total_score,
    grade,
    is_cat_shower,
    days_since_last
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
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            body { font-family: 'Inter', sans-serif; }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- 헤더 -->
        <div class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                            <i class="fas fa-shower text-white text-xl"></i>
                        </div>
                        <div>
                            <h1 class="text-2xl font-bold text-gray-900">SPR</h1>
                            <p class="text-sm text-gray-500">Shower Performance Report</p>
                        </div>
                    </div>
                    <button onclick="showAddForm()" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
                        <i class="fas fa-plus"></i>
                        <span>샤워 기록 추가</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- 탭 -->
        <div class="max-w-7xl mx-auto px-4 mt-6">
            <div class="flex space-x-4 border-b">
                <button onclick="showTab('report')" id="tab-report" class="px-4 py-2 font-medium border-b-2 border-blue-500 text-blue-600">
                    <i class="fas fa-list mr-2"></i>Report
                </button>
                <button onclick="showTab('scorecard')" id="tab-scorecard" class="px-4 py-2 font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                    <i class="fas fa-chart-bar mr-2"></i>Scorecard
                </button>
            </div>
        </div>

        <!-- Report 탭 -->
        <div id="content-report" class="max-w-7xl mx-auto px-4 py-6">
            <div class="bg-white rounded-lg shadow">
                <div class="p-6">
                    <h2 class="text-xl font-bold text-gray-900 mb-4">샤워 기록</h2>
                    <div id="records-list"></div>
                </div>
            </div>
        </div>

        <!-- Scorecard 탭 -->
        <div id="content-scorecard" class="max-w-7xl mx-auto px-4 py-6 hidden">
            <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6" id="grade-cards"></div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">점수 트렌드</h3>
                    <canvas id="trend-chart"></canvas>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">고양이샤워 통계</h3>
                    <div id="cat-shower-stats"></div>
                </div>
            </div>
        </div>

        <!-- 샤워 기록 추가 모달 -->
        <div id="add-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-xl font-bold text-gray-900 mb-4">샤워 기록 추가</h3>
                <form id="add-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                        <input type="date" id="input-date" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
                        <input type="time" id="input-time" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">소요 시간 (분)</label>
                        <input type="number" id="input-duration" required min="1" max="60" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-medium text-gray-700">체크리스트</label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-body-soap" class="rounded">
                            <span>비누칠 제대로 함 🧼</span>
                        </label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-hair-wash" class="rounded">
                            <span>머리 감음 🧴</span>
                        </label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-teeth-brush" class="rounded">
                            <span>이 닦음 🪥</span>
                        </label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-feet-wash" class="rounded">
                            <span>발 씻음 🦶</span>
                        </label>
                    </div>
                    <div class="flex space-x-3 pt-4">
                        <button type="submit" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg">
                            저장
                        </button>
                        <button type="button" onclick="hideAddForm()" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg">
                            취소
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
