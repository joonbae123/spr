import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 설정
app.use('/api/*', cors())

// 정적 파일은 Cloudflare Pages가 자동으로 서빙 (_routes.json에서 /static/* 제외됨)
// serveStatic은 로컬 개발 환경에서만 필요하므로 제거

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
      teeth_brush,
      feet_wash
    } = data

    // pts수 계산
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
      teeth_brush,
      feet_wash
    } = data

    // pts수 재계산
    const scores = await calculateScores({
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
    } = scores

    // 데이터 업데이트
    await DB.prepare(`
      UPDATE shower_records SET
        date = ?,
        start_time = ?,
        duration = ?,
        body_soap = ?,
        hair_wash = ?,
        teeth_brush = ?,
        feet_wash = ?,
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
      teeth_brush ? 1 : 0,
      feet_wash ? 1 : 0,
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
        ROUND(AVG(days_since_last), 1) as avg_days_between
      FROM shower_records
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
// pts수 계산 함수
// ============================================
async function calculateScores(data: any, DB: D1Database) {
  const { body_soap, hair_wash, teeth_brush, feet_wash, duration } = data

  // 1. Completeness pts수 (Checklist)
  const checkedItems = [body_soap, hair_wash, teeth_brush, feet_wash].filter(Boolean).length
  const completeness_score = (checkedItems / 4) * 100

  // 2. Time pts수 (10-20min이 이상적)
  let duration_score = 100
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

  // 3. Frequency pts수 (마지막 샤워 이후 경과일)
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

      // Frequency pts수 계산
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

  // 4. Score (가중 Avg)
  const total_score = Math.round(
    completeness_score * 0.4 +
    frequency_score * 0.3 +
    duration_score * 0.3
  )

  // 5. Grade 산정
  let grade = 'D'
  if (total_score >= 90) grade = 'S'
  else if (total_score >= 80) grade = 'A'
  else if (total_score >= 70) grade = 'B'
  else if (total_score >= 60) grade = 'C'

  // 6. Cat Shower 판정
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
        <style>
            body { 
                font-family: 'Inter', sans-serif; 
            }
        </style>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            body { font-family: 'Inter', sans-serif; }
        </style>
    </head>
    <body class="bg-gray-50 min-h-screen flex flex-col">
        <!-- Header -->
        <div class="bg-white shadow-sm">
            <div class="max-w-7xl mx-auto px-6 py-6">
                <div class="flex items-start justify-between">
                    <div>
                        <img src="/static/waiv-logo-clean.png" alt="WAIV Logo" class="h-10 mb-4">
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
        </div>

        <!-- Main Content -->
        <div class="flex-grow">

        <!-- Tabs -->
        <div class="bg-white shadow-sm mb-6">
            <div class="max-w-7xl mx-auto px-6">
                <div class="flex border-b">
                    <button onclick="showTab('report')" id="tab-report" class="px-6 py-3 font-medium text-blue-600 border-b-2 border-blue-500">
                        <i class="fas fa-chart-line mr-2"></i>Report
                    </button>
                    <button onclick="showTab('scorecard')" id="tab-scorecard" class="px-6 py-3 font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-800">
                        <i class="fas fa-trophy mr-2"></i>Scorecard
                    </button>
                </div>
            </div>
        </div>

        <!-- Report 탭 -->
        <div id="content-report" class="max-w-7xl mx-auto px-4 py-6">
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
            <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6" id="grade-cards"></div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">pts수 트렌드</h3>
                    <canvas id="trend-chart"></canvas>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">Cat Shower 통계</h3>
                    <div id="cat-shower-stats"></div>
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
                        <label class="block text-sm font-medium text-gray-700 mb-1">시작 Time</label>
                        <input type="time" id="input-time" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">소요 Time (min)</label>
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
                            <input type="checkbox" id="input-teeth-brush" class="rounded">
                            <span>Teeth Brush 🪥</span>
                        </label>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="input-feet-wash" class="rounded">
                            <span>Feet Wash 🦶</span>
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
                        <img src="/static/waiv-logo-clean.png" alt="WAIV Logo" class="h-8 mb-3">
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
                        <h3 class="text-sm font-semibold text-gray-900 mb-3">현재 Status</h3>
                        <div class="text-sm text-gray-600 space-y-1" id="footer-stats">
                            <p>Total Records: <span class="font-medium text-gray-900">-</span></p>
                            <p>Avg pts수: <span class="font-medium text-gray-900">-</span></p>
                            <p>Cat Shower Rate: <span class="font-medium text-red-600">-</span></p>
                        </div>
                    </div>
                </div>
                
                <div class="border-t mt-6 pt-6 text-center text-sm text-gray-500">
                    <p>© 2026 WAIV SPR Project. Made with 💙 for HW's hygiene improvement.</p>
                    <p class="mt-1">IPR Parody Edition | v1.1.0</p>
                </div>
            </div>
        </footer>
        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
