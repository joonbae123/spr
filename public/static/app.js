// ============================================
// 시간대 관리
// ============================================

// 기본 시간대 설정 (미국 동부)
const DEFAULT_TIMEZONE = 'America/New_York'
const DEFAULT_DATE_FORMAT = 'en-US'
const DEFAULT_TIME_FORMAT = '12h'

// LocalStorage에서 설정 가져오기
function getTimezone() {
  return localStorage.getItem('timezone') || DEFAULT_TIMEZONE
}

function getDateFormat() {
  return localStorage.getItem('dateFormat') || DEFAULT_DATE_FORMAT
}

function getTimeFormat() {
  return localStorage.getItem('timeFormat') || DEFAULT_TIME_FORMAT
}

// 현재 시간대 기준으로 현재 날짜/시간 가져오기
function getCurrentDateInTimezone() {
  const tz = getTimezone()
  const now = new Date()
  
  // YYYY-MM-DD 형식으로 반환 (input[type=date]용)
  return now.toLocaleDateString('en-CA', { timeZone: tz })
}

function getCurrentTimeInTimezone() {
  const tz = getTimezone()
  const now = new Date()
  
  // HH:MM 형식으로 반환 (input[type=time]용)
  return now.toLocaleTimeString('en-GB', { 
    timeZone: tz, 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

// 날짜/시간 파싱 (시간대 고려)
function parseDateTimeInTimezone(dateStr, timeStr) {
  const tz = getTimezone()
  const dateTimeStr = `${dateStr}T${timeStr}:00`
  
  // 선택한 시간대의 날짜/시간을 UTC로 변환
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  
  return new Date(dateTimeStr)
}

// 두 날짜 사이의 분 차이 계산 (시간대 고려)
function getMinutesDifference(dateStr1, timeStr1, dateStr2, timeStr2) {
  const tz = getTimezone()
  
  const dt1 = new Date(`${dateStr1}T${timeStr1}:00`)
  const dt2 = new Date(`${dateStr2}T${timeStr2}:00`)
  
  return Math.floor((dt2 - dt1) / (1000 * 60))
}

// ============================================
// 전역 변수
// ============================================
let currentTab = 'report'
let allRecords = []
let allStats = {}
let allBadges = []
let currentFilters = {
  startDate: null,
  endDate: null
}

// ============================================
// 위생 상태 계산 함수들
// ============================================

// 박테리아 수 계산 (과학적(?) 모델)
function calculateBacteriaCount(lastRecord, minutesSinceShower) {
  // 초기 박테리아 수 = 100 - 마지막 샤워 점수
  let initialBacteria = 100 - lastRecord.total_score
  
  // Cat Shower면 박테리아 +30 보너스 (대충 씻었으니까)
  if (lastRecord.is_cat_shower) {
    initialBacteria += 30
  }
  
  // Dry Shampoo만 사용한 경우 박테리아 -30% 감소 효과만 (냄새만 가림)
  const isDryShampooOnly = lastRecord.dry_shampoo === 1 && lastRecord.hair_wash === 0 && lastRecord.body_soap === 0
  if (isDryShampooOnly) {
    initialBacteria = initialBacteria * 0.7  // 30% 감소 효과
  }
  
  // Face Wash만 사용한 경우 박테리아 -20% 감소 효과만 (얼굴만 헹굼)
  const isFaceWashOnly = lastRecord.cat_shower === 1 && lastRecord.hair_wash === 0 && lastRecord.body_soap === 0
  if (isFaceWashOnly) {
    initialBacteria = initialBacteria * 0.8  // 20% 감소 효과
  }
  
  // 최소 10마리는 있어야 함 (완전 무균은 불가능)
  initialBacteria = Math.max(10, initialBacteria)
  
  // 증식률: 2시간(120분)마다 1.15배
  // 공식: 현재 박테리아 = 초기 × (1.15 ^ (경과시간(분) ÷ 120))
  const growthRate = 1.15
  const intervalMinutes = 120
  const currentBacteria = initialBacteria * Math.pow(growthRate, minutesSinceShower / intervalMinutes)
  
  // 분당 증가율 계산
  const growthPerMinute = currentBacteria * (growthRate - 1) / intervalMinutes
  
  return {
    count: Math.round(currentBacteria),
    growthPerMinute: growthPerMinute.toFixed(1),
    initialCount: Math.round(initialBacteria)
  }
}

// 박테리아 수에 따른 위생 상태
function getBacteriaStatus(bacteriaCount) {
  if (bacteriaCount < 50) {
    return {
      emoji: '😊✨',
      title: 'Sparkling Clean!',
      message: 'Practically sterile! You\'re doing great!',
      bacteria: '🦠',
      bgColor: 'from-green-50 to-blue-50',
      level: 'Minimal',
      advice: 'Keep up this excellent hygiene routine! ✨'
    }
  } else if (bacteriaCount < 200) {
    return {
      emoji: '😊',
      title: 'Still Fresh!',
      message: 'Bacteria levels are under control.',
      bacteria: '🦠🦠',
      bgColor: 'from-blue-50 to-green-50',
      level: 'Low',
      advice: 'You\'re doing fine, but don\'t wait too long! 👍'
    }
  } else if (bacteriaCount < 1000) {
    return {
      emoji: '😐',
      title: 'Getting Funky...',
      message: 'Your bacteria are starting to multiply.',
      bacteria: '🦠🦠🦠',
      bgColor: 'from-yellow-50 to-orange-50',
      level: 'Moderate',
      advice: '⚠️ Consider showering soon. They\'re building houses now.'
    }
  } else if (bacteriaCount < 5000) {
    return {
      emoji: '😷',
      title: 'You Should Shower!',
      message: 'Bacteria colony detected on your skin!',
      bacteria: '🦠🦠🦠🦠',
      bgColor: 'from-orange-50 to-red-50',
      level: 'High',
      advice: '🚨 Shower NOW! Your bacteria have elected a mayor!'
    }
  } else if (bacteriaCount < 10000) {
    return {
      emoji: '🤢',
      title: 'Bacteria Civilization!',
      message: 'Your bacteria have built a city!',
      bacteria: '🦠🦠🦠🦠💩',
      bgColor: 'from-red-100 to-orange-100',
      level: 'Very High',
      advice: '💀 URGENT! Your bacteria are filing for statehood!'
    }
  } else {
    return {
      emoji: '🤢💀',
      title: 'BIOHAZARD ALERT!',
      message: 'You are now a biological weapon!',
      bacteria: '🦠🦠🦠🦠🦠💩💀',
      bgColor: 'from-red-200 to-pink-200',
      level: 'CRITICAL',
      advice: '☢️ SHOWER IMMEDIATELY! Your bacteria have launched a space program!'
    }
  }
}

// 시간에 따른 재밌는 메시지
function getFunnyTimeMessage(hours, bacteriaCount) {
  if (hours < 12) {
    return '👏 Fresh out of the shower! Your skin is grateful!'
  } else if (hours < 24) {
    return '😌 Still in the safe zone. But tick-tock...'
  } else if (hours < 36) {
    return `⏰ ${hours} hours... Your bacteria are getting comfortable.`
  } else if (hours < 48) {
    return `😰 ${hours} hours! Your bacteria are throwing a house party! 🎉`
  } else if (hours < 72) {
    return `🤢 ${hours} hours... Your bacteria have elected a government.`
  } else {
    return `💀 ${hours} hours!!! Your bacteria have developed written language!`
  }
}

// 누적 평균 점수 기반 전체 위생 등급
function getOverallHygieneGrade(avgScore) {
  if (avgScore >= 90) {
    return {
      emoji: '😇✨',
      title: 'Hygiene Master!',
      message: "Cleaner than 99% of cats! You're a legend!",
      bacteria: '🦠',
      bgColor: 'from-green-100 to-emerald-100',
      bacteriaCount: 1
    }
  } else if (avgScore >= 80) {
    return {
      emoji: '😊',
      title: 'Good Hygiene!',
      message: 'Keep up the excellent work!',
      bacteria: '🦠🦠',
      bgColor: 'from-blue-100 to-cyan-100',
      bacteriaCount: 2
    }
  } else if (avgScore >= 70) {
    return {
      emoji: '😐',
      title: 'Could Be Better...',
      message: 'Try to improve your shower routine!',
      bacteria: '🦠🦠🦠',
      bgColor: 'from-yellow-100 to-amber-100',
      bacteriaCount: 3
    }
  } else if (avgScore >= 60) {
    return {
      emoji: '😷',
      title: 'Bacteria Are Multiplying...',
      message: 'Your hygiene needs serious attention!',
      bacteria: '🦠🦠🦠🦠',
      bgColor: 'from-orange-100 to-red-100',
      bacteriaCount: 4
    }
  } else {
    return {
      emoji: '🤢',
      title: 'Your Bacteria Have Names Now!',
      message: "They've formed a civilization on your skin!",
      bacteria: '🦠🦠🦠🦠💩',
      bgColor: 'from-red-200 to-pink-200',
      bacteriaCount: 5
    }
  }
}

// 현재 위생 상태 카드 업데이트
function updateHygieneStatusCard() {
  if (allRecords.length === 0) {
    const content = `
      <div class="text-6xl mb-3">🚿</div>
      <h3 class="text-2xl font-bold text-gray-800 mb-2">No Shower Records Yet</h3>
      <p class="text-gray-600 mb-3">Add your first shower record to start tracking bacteria!</p>
      <div class="inline-block px-4 py-2 bg-white rounded-full shadow-sm">
        <span class="text-3xl">🦠</span>
        <span class="text-sm text-gray-600 ml-2">Bacteria Level: Unknown</span>
      </div>
    `
    document.getElementById('hygiene-status-content').innerHTML = content
    return
  }

  // 마지막 실제 샤워 기록 찾기 (body_soap=1 OR hair_wash=1)
  const lastShowerRecord = allRecords.find(record => record.body_soap === 1 || record.hair_wash === 1)
  
  if (!lastShowerRecord) {
    // 샤워 기록이 없고 양치질/발만 씻은 기록만 있는 경우
    const content = `
      <div class="text-6xl mb-3">🦷🦶</div>
      <h3 class="text-2xl font-bold text-gray-800 mb-2">No Actual Shower Yet</h3>
      <p class="text-gray-600 mb-3">You only have teeth/feet hygiene records. Time for a real shower!</p>
      <div class="inline-block px-4 py-2 bg-orange-100 rounded-full shadow-sm border-2 border-orange-500">
        <span class="text-3xl">🦠🦠🦠🦠💩</span>
        <span class="text-sm text-orange-800 ml-2">Bacteria Level: MAXIMUM</span>
      </div>
      <p class="text-sm text-orange-600 mt-3">⚠️ Warning: Brushing teeth doesn't count as showering!</p>
    `
    document.getElementById('hygiene-status-content').innerHTML = content
    return
  }
  
  const lastRecord = lastShowerRecord
  
  // 시간대 기준으로 현재 시간과 마지막 샤워 시간 계산
  const tz = getTimezone()
  const now = new Date()
  
  // 마지막 샤워 시간을 시간대 기준으로 파싱
  const lastDateTime = new Date(lastRecord.date + 'T' + lastRecord.start_time)
  
  const minutesSince = Math.floor((now - lastDateTime) / (1000 * 60))
  const hoursSince = Math.floor(minutesSince / 60)
  const daysSince = Math.floor(hoursSince / 24)
  
  // 박테리아 계산
  const bacteria = calculateBacteriaCount(lastRecord, minutesSince)
  const status = getBacteriaStatus(bacteria.count)
  const funnyMessage = getFunnyTimeMessage(hoursSince, bacteria.count)
  
  const card = document.getElementById('hygiene-status-card')
  card.className = `bg-gradient-to-r ${status.bgColor} rounded-lg shadow-lg p-6 mb-6 border-2 ${bacteria.count > 5000 ? 'border-red-500 animate-pulse' : 'border-transparent'}`
  
  // 시간 표시 문자열
  let timeString = ''
  if (minutesSince < 60) {
    timeString = `${minutesSince} minute${minutesSince !== 1 ? 's' : ''} ago`
  } else if (hoursSince < 24) {
    timeString = `${hoursSince} hour${hoursSince !== 1 ? 's' : ''} ago`
  } else {
    timeString = `${daysSince} day${daysSince !== 1 ? 's' : ''} ago (${hoursSince}h)`
  }
  
  const content = `
    <div class="text-6xl mb-3">${status.emoji}</div>
    <h3 class="text-2xl font-bold text-gray-800 mb-2">${status.title}</h3>
    <p class="text-gray-600 mb-2">${status.message}</p>
    <p class="text-sm text-gray-500 italic mb-4">${funnyMessage}</p>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <div class="bg-white rounded-lg shadow-sm p-3">
        <div class="text-2xl mb-1">${status.bacteria}</div>
        <div class="text-xs text-gray-500">Bacteria Level</div>
        <div class="text-sm font-bold text-gray-900">${status.level}</div>
      </div>
      
      <div class="bg-white rounded-lg shadow-sm p-3">
        <div class="text-2xl mb-1">🧫</div>
        <div class="text-xs text-gray-500">Current Population</div>
        <div class="text-sm font-bold text-gray-900">${bacteria.count.toLocaleString()} cells</div>
      </div>
      
      <div class="bg-white rounded-lg shadow-sm p-3">
        <div class="text-2xl mb-1">📈</div>
        <div class="text-xs text-gray-500">Growth Rate</div>
        <div class="text-sm font-bold text-gray-900">+${bacteria.growthPerMinute}/min</div>
      </div>
    </div>
    
    <div class="flex items-center justify-center gap-3 flex-wrap">
      <div class="inline-block px-4 py-2 bg-white rounded-full shadow-sm">
        <span class="text-sm text-gray-600">⏰ Last shower: <strong>${timeString}</strong></span>
      </div>
      <div class="inline-block px-4 py-2 bg-white rounded-full shadow-sm">
        <span class="text-sm text-gray-600">🎯 Last score: <strong>${lastRecord.total_score}pts (${lastRecord.grade})</strong></span>
      </div>
      ${lastRecord.is_cat_shower ? '<div class="inline-block px-3 py-2 bg-orange-100 rounded-full shadow-sm"><span class="text-sm text-orange-800">🐱 Cat Shower detected!</span></div>' : ''}
    </div>
    
    <div class="mt-4 p-3 ${bacteria.count > 1000 ? 'bg-red-50 border-l-4 border-red-500' : 'bg-blue-50 border-l-4 border-blue-500'} rounded">
      <p class="text-sm ${bacteria.count > 1000 ? 'text-red-800' : 'text-blue-800'}">
        <strong>💡 ${bacteria.count > 1000 ? 'URGENT' : 'Advice'}:</strong> ${status.advice}
      </p>
      ${bacteria.count > 1000 ? `<p class="text-xs text-red-600 mt-1">Started with ${bacteria.initialCount} bacteria, now at ${bacteria.count.toLocaleString()}! That's ${Math.round(bacteria.count / bacteria.initialCount)}x growth! 📊</p>` : ''}
    </div>
  `
  
  document.getElementById('hygiene-status-content').innerHTML = content
}

// 전체 위생 등급 카드 업데이트
function updateOverallHygieneCard() {
  if (!allStats.avg_score) {
    const content = `
      <div class="text-6xl mb-3">📊</div>
      <h3 class="text-2xl font-bold text-gray-800 mb-2">Overall Hygiene Level</h3>
      <p class="text-gray-600 mb-3">No data yet. Start tracking your showers!</p>
      <div class="inline-block px-4 py-2 bg-white rounded-full shadow-sm">
        <span class="text-3xl">🦠</span>
        <span class="text-sm text-gray-600 ml-2">Avg Score: -</span>
      </div>
    `
    document.getElementById('overall-hygiene-content').innerHTML = content
    return
  }

  const avgScore = parseFloat(allStats.avg_score)
  const grade = getOverallHygieneGrade(avgScore)
  
  const card = document.getElementById('overall-hygiene-card')
  card.className = `bg-gradient-to-r ${grade.bgColor} rounded-lg shadow-lg p-6 mb-6`
  
  // Cat Shower 경고
  const catShowerWarning = allStats.cat_shower_rate >= 30 ? `
    <div class="mt-4 p-3 bg-orange-100 border-l-4 border-orange-500 rounded">
      <p class="text-sm text-orange-800">
        <strong>⚠️ Warning:</strong> ${allStats.cat_shower_rate}% Cat Shower rate detected! That's not real cleaning!
      </p>
    </div>
  ` : ''
  
  const content = `
    <div class="text-6xl mb-3">${grade.emoji}</div>
    <h3 class="text-2xl font-bold text-gray-800 mb-2">${grade.title}</h3>
    <p class="text-gray-600 mb-3">${grade.message}</p>
    <div class="inline-block px-4 py-2 bg-white rounded-full shadow-sm">
      <span class="text-2xl">${grade.bacteria}</span>
      <span class="text-sm text-gray-600 ml-2">Avg Score: <strong>${avgScore.toFixed(1)} pts</strong></span>
    </div>
    ${catShowerWarning}
  `
  
  document.getElementById('overall-hygiene-content').innerHTML = content
}

// ============================================
// Reset
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Today Date로 기본값 설정
  const today = new Date().toISOString().split('T')[0]
  document.getElementById('input-date').value = today
  
  // 현재 Time으로 기본값 설정
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  document.getElementById('input-time').value = `${hours}:${minutes}`
  
  // 데이터 로드
  loadRecords()
  loadStats()
  loadBadges()  // 뱃지 로드
  
  // 폼 제출 이벤트
  document.getElementById('add-form').addEventListener('submit', handleAddRecord)
})

// ============================================
// 탭 전환
// ============================================
// ============================================
// Shower Records 로드 (Date 필터 지원)
// ============================================
async function loadRecords(startDate = null, endDate = null) {
  try {
    let url = '/api/records'
    const params = new URLSearchParams()
    
    if (startDate) {
      params.append('startDate', startDate)
      currentFilters.startDate = startDate
    }
    
    if (endDate) {
      params.append('endDate', endDate)
      currentFilters.endDate = endDate
    }
    
    if (params.toString()) {
      url += '?' + params.toString()
    }
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.success) {
      allRecords = data.records
      renderRecords()
      
      // 필터 결과 표시
      if (data.filters && (data.filters.startDate || data.filters.endDate)) {
        showFilterResult(data.filters)
      } else {
        hideFilterResult()
      }
    }
  } catch (error) {
    console.error('Failed to load records:', error)
  }
}

// ============================================
// Date 필터 적용
// ============================================
function applyDateFilter() {
  const startDate = document.getElementById('filter-start-date').value
  const endDate = document.getElementById('filter-end-date').value
  
  loadRecords(startDate || null, endDate || null)
}

// ============================================
// Date 필터 Reset
// ============================================
function resetDateFilter() {
  document.getElementById('filter-start-date').value = ''
  document.getElementById('filter-end-date').value = ''
  currentFilters.startDate = null
  currentFilters.endDate = null
  loadRecords()
  hideFilterResult()
}

// ============================================
// 빠른 필터
// ============================================
function quickFilter(type) {
  const today = new Date()
  let startDate = null
  let endDate = today.toISOString().split('T')[0]
  
  switch(type) {
    case 'today':
      startDate = endDate
      break
    case 'week':
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      startDate = weekAgo.toISOString().split('T')[0]
      break
    case 'month':
      const monthAgo = new Date(today)
      monthAgo.setDate(monthAgo.getDate() - 30)
      startDate = monthAgo.toISOString().split('T')[0]
      break
    case 'all':
      startDate = null
      endDate = null
      break
  }
  
  // 필터 입력 필드 업데이트
  document.getElementById('filter-start-date').value = startDate || ''
  document.getElementById('filter-end-date').value = endDate || ''
  
  loadRecords(startDate, endDate)
}

// ============================================
// 필터 결과 표시
// ============================================
function showFilterResult(filters) {
  const resultDiv = document.getElementById('filter-result')
  const resultText = document.getElementById('filter-result-text')
  
  let text = ''
  if (filters.startDate && filters.endDate) {
    text = `${filters.count} records from ${filters.startDate} to ${filters.endDate}`
  } else if (filters.startDate) {
    text = `${filters.count} records since ${filters.startDate}`
  } else if (filters.endDate) {
    text = `${filters.count} records until ${filters.endDate}`
  }
  
  resultText.textContent = text
  resultDiv.classList.remove('hidden')
}

// ============================================
// 필터 결과 숨김
// ============================================
function hideFilterResult() {
  const resultDiv = document.getElementById('filter-result')
  resultDiv.classList.add('hidden')
}

// ============================================
// 통계 로드
// ============================================
async function loadStats() {
  try {
    const response = await fetch('/api/stats')
    const data = await response.json()
    
    if (data.success) {
      allStats = data.stats
    }
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

// ============================================
// Badges 로드
// ============================================
async function loadBadges() {
  try {
    const response = await fetch('/api/badges')
    const data = await response.json()
    
    if (data.success) {
      allBadges = data.badges
    }
  } catch (error) {
    console.error('Failed to load badges:', error)
  }
}

// ============================================
// Shower Records 렌더링
// ============================================
function renderRecords() {
  const container = document.getElementById('records-list')
  
  if (allRecords.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">No shower records yet.</p>'
    return
  }
  
  const html = `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Duration 
              <i class="fas fa-info-circle text-gray-400 cursor-help" title="Ideal: 10-20min | <5min: Cat Shower risk | >30min: Water waste"></i>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Completeness 
              <i class="fas fa-info-circle text-gray-400 cursor-help" title="40% weight: Body soap, Hair wash, Teeth brush, Feet wash"></i>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Frequency 
              <i class="fas fa-info-circle text-gray-400 cursor-help" title="30% weight: Days since last shower (1day=100pts, 2days=80pts, 3days=60pts, 4days=40pts, 5+days=20pts)"></i>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Score 
              <i class="fas fa-info-circle text-gray-400 cursor-help" title="Weighted avg: Completeness (40%) + Frequency (30%) + Duration (30%)"></i>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Grade 
              <i class="fas fa-info-circle text-gray-400 cursor-help" title="S: 90+ | A: 80+ | B: 70+ | C: 60+ | D: <60"></i>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          ${allRecords.map(record => `
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${record.date}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${record.start_time}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${record.duration}min</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <div class="flex items-center">
                  <span class="text-gray-900">${record.completeness_score}%</span>
                  <span class="ml-2 text-xs">${getChecklistIcons(record)}</span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="${record.days_since_last <= 2 ? 'text-green-600' : 'text-red-600'}">
                  ${record.days_since_last}days ago
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ${record.total_score}pts
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded ${getGradeColor(record.grade)}">
                  ${record.grade}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                ${(() => {
                  const isActualShower = record.body_soap === 1 || record.hair_wash === 1
                  const isDryShampooOnly = record.dry_shampoo === 1 && !isActualShower
                  
                  if (isDryShampooOnly) {
                    return '<span class="text-yellow-600">🧴✨ Dry Shampoo Only</span>'
                  } else if (!isActualShower) {
                    return '<span class="text-gray-500">🦷🦶 Partial Hygiene</span>'
                  } else if (record.is_cat_shower) {
                    return '<span class="text-orange-600">🐱 Cat Shower</span>'
                  } else {
                    return '<span class="text-green-600">✓ Normal Shower</span>'
                  }
                })()}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <div class="flex items-center justify-center space-x-2">
                  <button onclick="editRecord(${record.id})" class="text-blue-600 hover:text-blue-800" title="Edit">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button onclick="deleteRecord(${record.id})" class="text-red-600 hover:text-red-800" title="Delete">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
  
  container.innerHTML = html
  updateFooterStats()
  updateHygieneStatusCard()  // 위생 상태 카드 업데이트
}

// ============================================
// Scorecard 렌더링
// ============================================
function renderScorecard() {
  updateOverallHygieneCard()  // 전체 위생 등급 카드 업데이트
  renderGradeCards()
  renderBadges()  // 뱃지 렌더링
  renderTrendChart()
  renderCatShowerStats()
}

// ============================================
// Grade 카드 렌더링
// ============================================
function renderGradeCards() {
  const container = document.getElementById('grade-cards')
  const grades = ['S', 'A', 'B', 'C', 'D']
  
  const html = grades.map(grade => {
    const gradeData = allStats.gradeDistribution?.find(g => g.grade === grade) || {
      count: 0,
      avg_score: 0,
      avg_completeness: 0
    }
    
    return `
      <div class="bg-white rounded-lg shadow p-4 border-l-4 ${getGradeBorderColor(grade)}">
        <div class="flex items-center justify-between mb-2">
          <span class="text-3xl font-bold ${getGradeTextColor(grade)}">${grade}</span>
          <span class="text-2xl font-bold text-gray-900">${gradeData.count}</span>
        </div>
        <div class="text-sm text-gray-600">
          <div>Avg: ${gradeData.avg_score}pts</div>
          <div>Completeness: ${gradeData.avg_completeness}%</div>
        </div>
      </div>
    `
  }).join('')
  
  container.innerHTML = html
}

// ============================================
// Badges 렌더링
// ============================================
function renderBadges() {
  const container = document.getElementById('badges-container')
  
  if (allBadges.length === 0) {
    container.innerHTML = '<p class="text-gray-500">No badges data yet.</p>'
    return
  }
  
  // 타입별로 그룹화
  const good = allBadges.filter(b => b.type === 'good')
  const bad = allBadges.filter(b => b.type === 'bad')
  const funny = allBadges.filter(b => b.type === 'funny')
  const hidden = allBadges.filter(b => b.type === 'hidden')
  
  const html = `
    <!-- Good Badges -->
    <div class="mb-6">
      <h4 class="text-md font-bold text-green-700 mb-3">✨ Good Badges</h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        ${good.map(badge => renderBadgeCard(badge)).join('')}
      </div>
    </div>
    
    <!-- Bad Badges -->
    <div class="mb-6">
      <h4 class="text-md font-bold text-red-700 mb-3">💀 Bad Badges (Shame!)</h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        ${bad.map(badge => renderBadgeCard(badge)).join('')}
      </div>
    </div>
    
    <!-- Funny Badges -->
    <div class="mb-6">
      <h4 class="text-md font-bold text-blue-700 mb-3">😂 Funny Badges</h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        ${funny.map(badge => renderBadgeCard(badge)).join('')}
      </div>
    </div>
    
    <!-- Hidden Badges -->
    <div>
      <h4 class="text-md font-bold text-purple-700 mb-3">🎯 Hidden Badges</h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        ${hidden.map(badge => renderBadgeCard(badge)).join('')}
      </div>
    </div>
  `
  
  container.innerHTML = html
}

function renderBadgeCard(badge) {
  const unlocked = badge.unlocked
  const progress = Math.round(badge.progress) || 0
  
  // 잠김/해제 스타일
  const cardClass = unlocked 
    ? 'bg-white border-2 border-gray-200 hover:shadow-lg' 
    : 'bg-gray-100 border-2 border-gray-300 opacity-60'
  
  const iconClass = unlocked ? 'text-4xl' : 'text-4xl grayscale'
  const titleClass = unlocked ? 'text-gray-900 font-bold' : 'text-gray-500'
  
  return `
    <div class="${cardClass} rounded-lg p-3 text-center transition-all cursor-pointer" title="${badge.description}">
      <div class="${iconClass} mb-2">${unlocked ? badge.icon : '🔒'}</div>
      <div class="${titleClass} text-xs mb-1">${badge.name}</div>
      ${!unlocked && progress > 0 ? `
        <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2">
          <div class="bg-blue-500 h-1.5 rounded-full" style="width: ${progress}%"></div>
        </div>
        <div class="text-xs text-gray-500 mt-1">${progress}%</div>
      ` : ''}
      ${unlocked ? '<div class="text-xs text-green-600 font-bold mt-1">✓ Unlocked</div>' : ''}
    </div>
  `
}

// ============================================
// 새 뱃지 확인 (기록 추가 후)
// ============================================
function checkNewBadges(scores) {
  // 이전 뱃지 상태 저장
  const previousBadges = JSON.parse(localStorage.getItem('previousBadges') || '[]')
  const currentBadges = allBadges.filter(b => b.unlocked).map(b => b.id)
  
  // 새로 획득한 뱃지 찾기
  const newBadges = currentBadges.filter(id => !previousBadges.includes(id))
  
  if (newBadges.length > 0) {
    // 새 뱃지 정보 가져오기
    const badgeInfo = allBadges.filter(b => newBadges.includes(b.id))
    
    // 알림 표시
    const badgeNames = badgeInfo.map(b => `${b.icon} ${b.name}`).join('\n')
    alert(`
🎉 New Badge${newBadges.length > 1 ? 's' : ''} Unlocked!

${badgeNames}

Check the Scorecard tab to see all your badges!
    `)
  }
  
  // 현재 뱃지 상태 저장
  localStorage.setItem('previousBadges', JSON.stringify(currentBadges))
}

// ============================================
// 트렌드 차트 렌더링
// ============================================
function renderTrendChart() {
  const canvas = document.getElementById('trend-chart')
  const ctx = canvas.getContext('2d')
  
  // 기존 차트 파괴
  if (window.trendChart) {
    window.trendChart.destroy()
  }
  
  const trendData = allStats.recentTrend || []
  const labels = trendData.map(d => d.date).reverse()
  const scores = trendData.map(d => d.total_score).reverse()
  
  window.trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Score',
        data: scores,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  })
}

// ============================================
// Cat Shower 통계 렌더링
// ============================================
function renderCatShowerStats() {
  const container = document.getElementById('cat-shower-stats')
  const stats = allStats.catShowerStats || { total_showers: 0, cat_showers: 0, avg_days_between_all: 0 }
  const actualStats = allStats.actualShowerStats || { actual_shower_count: 0, avg_days_between_showers: 0 }
  
  const catShowerRate = stats.total_showers > 0 
    ? ((stats.cat_showers / stats.total_showers) * 100).toFixed(1)
    : 0
  
  const html = `
    <div class="space-y-4">
      <div class="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
        <div>
          <div class="text-sm text-gray-600">Cat Shower Rate</div>
          <div class="text-2xl font-bold text-orange-600">${catShowerRate}%</div>
        </div>
        <div class="text-4xl">🐱</div>
      </div>
      
      <div class="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
        <div>
          <div class="text-sm text-gray-600">Total Records</div>
          <div class="text-2xl font-bold text-blue-600">${stats.total_showers}</div>
          <div class="text-xs text-gray-500 mt-1">${actualStats.actual_shower_count} actual showers</div>
        </div>
        <div class="text-4xl">🚿</div>
      </div>
      
      <div class="flex items-center justify-between p-4 bg-green-50 rounded-lg border-2 border-green-200">
        <div class="flex-1">
          <div class="text-sm font-semibold text-green-700">Shower Frequency</div>
          <div class="text-2xl font-bold text-green-600">${actualStats.avg_days_between_showers || 0} days</div>
          <div class="text-xs text-gray-500 mt-1">All hygiene: ${stats.avg_days_between_all || 0} days</div>
        </div>
        <div class="text-4xl">📅</div>
      </div>
      
      ${catShowerRate > 30 ? `
        <div class="p-4 bg-red-50 rounded-lg border border-red-200">
          <div class="flex items-start space-x-2">
            <i class="fas fa-exclamation-triangle text-red-600 mt-1"></i>
            <div class="text-sm text-red-800">
              <strong>Warning:</strong> Cat Shower rate is too high! 
              Please shower more properly! 🧼
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `
  
  container.innerHTML = html
}

// ============================================
// 새 Add Shower Record
// ============================================
async function handleAddRecord(e) {
  e.preventDefault()
  
  const data = {
    date: document.getElementById('input-date').value,
    start_time: document.getElementById('input-time').value,
    duration: parseInt(document.getElementById('input-duration').value),
    body_soap: document.getElementById('input-body-soap').checked,
    hair_wash: document.getElementById('input-hair-wash').checked,
    dry_shampoo: document.getElementById('input-dry-shampoo').checked,
    cat_shower: document.getElementById('input-cat-shower').checked,
    teeth_brush: document.getElementById('input-teeth-brush').checked,
    feet_wash: document.getElementById('input-feet-wash').checked
  }
  
  try {
    const response = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    const result = await response.json()
    
    if (result.success) {
      // 모달 닫기
      hideAddForm()
      
      // 폼 리셋
      document.getElementById('add-form').reset()
      
      // 데이터 새로고침
      await loadRecords()
      await loadStats()
      await loadBadges()  // 뱃지 다시 로드
      
      // Scorecard 탭이면 다시 렌더링
      if (currentTab === 'scorecard') {
        renderScorecard()
      }
      
      // 새로 획득한 뱃지 체크
      checkNewBadges(result.scores)
      
      // 성공 메시지 (pts수 표시)
      const { scores } = result
      alert(`
Shower record added successfully! 🚿

Score: ${scores.total_score}pts
Grade: ${scores.grade}
${scores.is_cat_shower ? '\n⚠️ Detected as Cat Shower!' : '\n✅ Normal shower!'}
      `)
    } else {
      alert('Failed to add shower record.')
    }
  } catch (error) {
    console.error('Error adding record:', error)
    alert('Error occurred while adding shower record.')
  }
}

// ============================================
// 모달 표시/숨김
// ============================================
function showAddForm() {
  document.getElementById('add-modal').classList.remove('hidden')
  document.getElementById('add-modal').classList.add('flex')
  
  // 시간대 기준으로 현재 날짜/시간 설정
  document.getElementById('input-date').value = getCurrentDateInTimezone()
  document.getElementById('input-time').value = getCurrentTimeInTimezone()
}

function hideAddForm() {
  document.getElementById('add-modal').classList.remove('flex')
  document.getElementById('add-modal').classList.add('hidden')
}

// ============================================
// Shower Records 삭제
// ============================================
async function deleteRecord(id) {
  if (!confirm('Are you sure you want to delete this record?')) {
    return
  }
  
  try {
    const response = await fetch(`/api/records/${id}`, {
      method: 'DELETE'
    })
    
    const result = await response.json()
    
    if (result.success) {
      alert('Record deleted successfully.')
      await loadRecords(currentFilters.startDate, currentFilters.endDate)
      await loadStats()
      
      if (currentTab === 'scorecard') {
        renderScorecard()
      }
    } else {
      alert('Failed to delete record.')
    }
  } catch (error) {
    console.error('Error deleting record:', error)
    alert('Error occurred while deleting record.')
  }
}

// ============================================
// Shower Records 수정
// ============================================
async function editRecord(id) {
  const record = allRecords.find(r => r.id === id)
  if (!record) return
  
  // 모달에 기존 값 채우기
  document.getElementById('input-date').value = record.date
  document.getElementById('input-time').value = record.start_time
  document.getElementById('input-duration').value = record.duration
  document.getElementById('input-body-soap').checked = record.body_soap === 1
  document.getElementById('input-hair-wash').checked = record.hair_wash === 1
  document.getElementById('input-dry-shampoo').checked = record.dry_shampoo === 1
  document.getElementById('input-cat-shower').checked = record.cat_shower === 1
  document.getElementById('input-teeth-brush').checked = record.teeth_brush === 1
  document.getElementById('input-feet-wash').checked = record.feet_wash === 1
  
  // 폼 제출 이벤트 변경 (수정 모드)
  const form = document.getElementById('add-form')
  form.onsubmit = async (e) => {
    e.preventDefault()
    
    const data = {
      date: document.getElementById('input-date').value,
      start_time: document.getElementById('input-time').value,
      duration: parseInt(document.getElementById('input-duration').value),
      body_soap: document.getElementById('input-body-soap').checked,
      hair_wash: document.getElementById('input-hair-wash').checked,
      dry_shampoo: document.getElementById('input-dry-shampoo').checked,
      cat_shower: document.getElementById('input-cat-shower').checked,
      teeth_brush: document.getElementById('input-teeth-brush').checked,
      feet_wash: document.getElementById('input-feet-wash').checked
    }
    
    try {
      const response = await fetch(`/api/records/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      const result = await response.json()
      
      if (result.success) {
        hideAddForm()
        form.reset()
        form.onsubmit = handleAddRecord // 원래 함수로 복원
        
        await loadRecords(currentFilters.startDate, currentFilters.endDate)
        await loadStats()
        
        if (currentTab === 'scorecard') {
          renderScorecard()
        }
        
        alert(`Record updated successfully!\n\nScore: ${result.scores.total_score}pts\nGrade: ${result.scores.grade}`)
      } else {
        alert('Failed to update record.')
      }
    } catch (error) {
      console.error('Error updating record:', error)
      alert('Error occurred while updating record.')
    }
  }
  
  showAddForm()
}

// ============================================
// 푸터 통계 업데이트
// ============================================
function updateFooterStats() {
  const totalRecords = allRecords.length
  const avgScore = totalRecords > 0
    ? (allRecords.reduce((sum, r) => sum + r.total_score, 0) / totalRecords).toFixed(1)
    : 0
  const catShowers = allRecords.filter(r => r.is_cat_shower === 1).length
  const catShowerRate = totalRecords > 0
    ? ((catShowers / totalRecords) * 100).toFixed(1)
    : 0
  
  const statsHtml = `
    <p>Total Records: <span class="font-medium text-gray-900">${totalRecords} records</span></p>
    <p>Avg Score: <span class="font-medium text-gray-900">${avgScore}pts</span></p>
    <p>Cat Shower Rate: <span class="font-medium ${catShowerRate > 30 ? 'text-red-600' : 'text-green-600'}">${catShowerRate}%</span></p>
  `
  
  const footerStats = document.getElementById('footer-stats')
  if (footerStats) {
    footerStats.innerHTML = statsHtml
  }
}

// ============================================
// 유틸리티 함수
// ============================================
function getChecklistIcons(record) {
  const icons = []
  if (record.body_soap) icons.push('🧼')
  if (record.hair_wash) icons.push('🧴')
  else if (record.dry_shampoo) icons.push('🧴✨')  // 드라이샴푸 (머리 안 감은 경우만)
  if (record.cat_shower) icons.push('🐱💧')  // 얼굴만 물로 헹굼
  if (record.teeth_brush) icons.push('🪥')
  if (record.feet_wash) icons.push('🦶')
  return icons.join(' ')
}

function getGradeColor(grade) {
  const colors = {
    'S': 'bg-purple-100 text-purple-800',
    'A': 'bg-blue-100 text-blue-800',
    'B': 'bg-green-100 text-green-800',
    'C': 'bg-yellow-100 text-yellow-800',
    'D': 'bg-red-100 text-red-800'
  }
  return colors[grade] || colors['D']
}

function getGradeBorderColor(grade) {
  const colors = {
    'S': 'border-purple-500',
    'A': 'border-blue-500',
    'B': 'border-green-500',
    'C': 'border-yellow-500',
    'D': 'border-red-500'
  }
  return colors[grade] || colors['D']
}

function getGradeTextColor(grade) {
  const colors = {
    'S': 'text-purple-600',
    'A': 'text-blue-600',
    'B': 'text-green-600',
    'C': 'text-yellow-600',
    'D': 'text-red-600'
  }
  return colors[grade] || colors['D']
}

// ============================================
// Settings 관련 함수
// ============================================

function showTab(tabName) {
  currentTab = tabName
  
  // 모든 탭 숨기기
  document.getElementById('content-report').classList.add('hidden')
  document.getElementById('content-scorecard').classList.add('hidden')
  document.getElementById('content-settings').classList.add('hidden')
  
  // 모든 탭 버튼 비활성화
  document.getElementById('tab-report').className = 'px-6 py-3 font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-800'
  document.getElementById('tab-scorecard').className = 'px-6 py-3 font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-800'
  document.getElementById('tab-settings').className = 'px-6 py-3 font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-800'
  
  // 선택한 탭 표시
  if (tabName === 'report') {
    document.getElementById('content-report').classList.remove('hidden')
    document.getElementById('tab-report').className = 'px-6 py-3 font-medium text-blue-600 border-b-2 border-blue-500'
  } else if (tabName === 'scorecard') {
    document.getElementById('content-scorecard').classList.remove('hidden')
    document.getElementById('tab-scorecard').className = 'px-6 py-3 font-medium text-blue-600 border-b-2 border-blue-500'
    renderScorecard()
  } else if (tabName === 'settings') {
    document.getElementById('content-settings').classList.remove('hidden')
    document.getElementById('tab-settings').className = 'px-6 py-3 font-medium text-blue-600 border-b-2 border-blue-500'
    loadSettings()
    updateCurrentTimezoneDisplay()
  }
}

// 설정 불러오기
function loadSettings() {
  const timezone = getTimezone()
  const dateFormat = getDateFormat()
  const timeFormat = getTimeFormat()
  
  document.getElementById('timezone-select').value = timezone
  document.getElementById('date-format-select').value = dateFormat
  document.getElementById('time-format-select').value = timeFormat
}

// 현재 시간대 시간 표시 업데이트
function updateCurrentTimezoneDisplay() {
  const tz = getTimezone()
  const timeFormat = getTimeFormat()
  
  const now = new Date()
  const options = {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: timeFormat === '12h'
  }
  
  const formatted = now.toLocaleString(getDateFormat(), options)
  document.getElementById('current-timezone-time').textContent = formatted
  
  // 1초마다 업데이트
  setTimeout(updateCurrentTimezoneDisplay, 1000)
}

// 설정 저장
function saveSettings() {
  const timezone = document.getElementById('timezone-select').value
  const dateFormat = document.getElementById('date-format-select').value
  const timeFormat = document.getElementById('time-format-select').value
  
  localStorage.setItem('timezone', timezone)
  localStorage.setItem('dateFormat', dateFormat)
  localStorage.setItem('timeFormat', timeFormat)
  
  alert('✅ Settings saved successfully!')
  
  // 데이터 다시 불러오기 (시간대 변경 반영)
  loadRecords()
  loadStats()
}

// 설정 초기화
function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to default?')) {
    localStorage.removeItem('timezone')
    localStorage.removeItem('dateFormat')
    localStorage.removeItem('timeFormat')
    
    loadSettings()
    updateCurrentTimezoneDisplay()
    
    alert('✅ Settings reset to default!')
    
    // 데이터 다시 불러오기
    loadRecords()
    loadStats()
  }
}

// 시간대 선택 변경 시 실시간 시간 업데이트
document.addEventListener('DOMContentLoaded', () => {
  const timezoneSelect = document.getElementById('timezone-select')
  if (timezoneSelect) {
    timezoneSelect.addEventListener('change', () => {
      // 임시로 변경사항 반영 (저장은 안 함)
      updateCurrentTimezoneDisplay()
    })
  }
})
