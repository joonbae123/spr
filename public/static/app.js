// ============================================
// 전역 변수
// ============================================
let currentTab = 'report'
let allRecords = []
let allStats = {}
let currentFilters = {
  startDate: null,
  endDate: null
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
  
  // 폼 제출 이벤트
  document.getElementById('add-form').addEventListener('submit', handleAddRecord)
})

// ============================================
// 탭 전환
// ============================================
function showTab(tab) {
  currentTab = tab
  
  // 탭 버튼 스타일
  document.querySelectorAll('[id^="tab-"]').forEach(btn => {
    btn.classList.remove('border-blue-500', 'text-blue-600')
    btn.classList.add('border-transparent', 'text-gray-500')
  })
  document.getElementById(`tab-${tab}`).classList.remove('border-transparent', 'text-gray-500')
  document.getElementById(`tab-${tab}`).classList.add('border-blue-500', 'text-blue-600')
  
  // 콘텐츠 표시
  document.querySelectorAll('[id^="content-"]').forEach(content => {
    content.classList.add('hidden')
  })
  document.getElementById(`content-${tab}`).classList.remove('hidden')
  
  // Scorecard 탭이면 차트 렌더링
  if (tab === 'scorecard') {
    renderScorecard()
  }
}

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
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completeness</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
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
                ${record.is_cat_shower ? '<span class="text-orange-600">🐱 Cat Shower</span>' : '<span class="text-green-600">✓ Normal</span>'}
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
}

// ============================================
// Scorecard 렌더링
// ============================================
function renderScorecard() {
  renderGradeCards()
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
  const stats = allStats.catShowerStats || { total_showers: 0, cat_showers: 0, avg_days_between: 0 }
  
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
          <div class="text-sm text-gray-600">Total Showers</div>
          <div class="text-2xl font-bold text-blue-600">${stats.total_showers}</div>
        </div>
        <div class="text-4xl">🚿</div>
      </div>
      
      <div class="flex items-center justify-between p-4 bg-green-50 rounded-lg">
        <div>
          <div class="text-sm text-gray-600">Avg Shower Frequency</div>
          <div class="text-2xl font-bold text-green-600">${stats.avg_days_between} days</div>
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
      
      // Scorecard 탭이면 다시 렌더링
      if (currentTab === 'scorecard') {
        renderScorecard()
      }
      
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
