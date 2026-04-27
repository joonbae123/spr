# IPR Design System Documentation

## 📋 목차
1. [디자인 스택](#디자인-스택)
2. [컬러 시스템](#컬러-시스템)
3. [타이포그래피](#타이포그래피)
4. [컴포넌트 라이브러리](#컴포넌트-라이브러리)
5. [레이아웃 시스템](#레이아웃-시스템)
6. [인터랙션 & 애니메이션](#인터랙션--애니메이션)
7. [차트 스타일](#차트-스타일)
8. [반응형 디자인](#반응형-디자인)

---

## 🎨 디자인 스택

### Core Technologies
```html
<!-- CSS Framework -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Font -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<!-- Icons -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">

<!-- Charts -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3"></script>

<!-- Data Processing -->
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
```

### Technology Stack Summary
| Category | Technology | Purpose |
|----------|-----------|---------|
| **CSS Framework** | Tailwind CSS | Utility-first CSS framework |
| **Font** | Inter | Modern, readable sans-serif |
| **Icons** | Font Awesome 6.4.0 | Icon library |
| **Charts** | Chart.js 4.x | Data visualization |
| **Excel** | SheetJS (XLSX) | Excel file processing |
| **Backend** | Hono + TypeScript | Lightweight web framework |
| **Database** | Cloudflare D1 (SQLite) | Edge database |
| **Deployment** | Cloudflare Pages | Edge deployment |

---

## 🎨 컬러 시스템

### Primary Colors
```css
/* Blue (Primary) */
--color-primary: #3b82f6;        /* Blue 500 */
--color-primary-hover: #2563eb;  /* Blue 600 */
--color-primary-dark: #1d4ed8;   /* Blue 700 */
--color-primary-light: #eff6ff;  /* Blue 50 */
--color-primary-border: #dbeafe; /* Blue 100 */

/* Purple (Secondary - Efficiency) */
--color-secondary: #a855f7;      /* Purple 500 */
--color-secondary-hover: #9333ea;/* Purple 600 */
--color-secondary-light: #faf5ff;/* Purple 50 */
```

### Semantic Colors
```css
/* Success (Green) */
--color-success: #10b981;        /* Emerald 500 */
--color-success-hover: #059669;  /* Emerald 600 */
--color-success-bg: #d1fae5;     /* Emerald 100 */
--color-success-text: #065f46;   /* Emerald 800 */

/* Warning (Yellow) */
--color-warning: #f59e0b;        /* Amber 500 */
--color-warning-hover: #d97706;  /* Amber 600 */
--color-warning-bg: #fef3c7;     /* Amber 100 */
--color-warning-text: #92400e;   /* Amber 800 */

/* Danger (Red) */
--color-danger: #ef4444;         /* Red 500 */
--color-danger-hover: #dc2626;   /* Red 600 */
--color-danger-bg: #fee2e2;      /* Red 100 */
--color-danger-text: #991b1b;    /* Red 800 */

/* Info (Blue) */
--color-info: #3b82f6;           /* Blue 500 */
--color-info-bg: #dbeafe;        /* Blue 100 */
--color-info-text: #1e40af;      /* Blue 800 */
```

### Gray Scale
```css
/* Gray (Neutral) */
--color-gray-50: #f8fafc;   /* Slate 50 - Background */
--color-gray-100: #f1f5f9;  /* Slate 100 - Light background */
--color-gray-200: #e2e8f0;  /* Slate 200 - Border */
--color-gray-300: #cbd5e1;  /* Slate 300 - Border hover */
--color-gray-400: #94a3b8;  /* Slate 400 - Disabled text */
--color-gray-500: #64748b;  /* Slate 500 - Secondary text */
--color-gray-600: #475569;  /* Slate 600 - Primary text */
--color-gray-700: #334155;  /* Slate 700 - Headings */
--color-gray-800: #1e293b;  /* Slate 800 - Dark headings */
--color-gray-900: #0f172a;  /* Slate 900 - Darkest */
```

### Grade Colors (Performance Badges)
```css
/* S Grade (Excellent) */
--grade-s-bg: #d1fae5;      /* Emerald 100 */
--grade-s-text: #065f46;    /* Emerald 800 */
--grade-s-border: #10b981;  /* Emerald 500 */

/* A Grade (Good) */
--grade-a-bg: #dbeafe;      /* Blue 100 */
--grade-a-text: #1e40af;    /* Blue 800 */
--grade-a-border: #3b82f6;  /* Blue 500 */

/* B Grade (Average) */
--grade-b-bg: #fef3c7;      /* Amber 100 */
--grade-b-text: #92400e;    /* Amber 800 */
--grade-b-border: #f59e0b;  /* Amber 500 */

/* C/D Grade (Poor) */
--grade-c-bg: #fee2e2;      /* Red 100 */
--grade-c-text: #991b1b;    /* Red 800 */
--grade-c-border: #ef4444;  /* Red 500 */
```

---

## 📝 타이포그래피

### Font Family
```css
body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

### Font Sizes
```css
/* Headings */
--text-4xl: 2.25rem;  /* 36px - Page title */
--text-3xl: 1.875rem; /* 30px - Section title */
--text-2xl: 1.5rem;   /* 24px - Card title */
--text-xl: 1.25rem;   /* 20px - Subsection */
--text-lg: 1.125rem;  /* 18px - Large text */

/* Body */
--text-base: 1rem;    /* 16px - Body text */
--text-sm: 0.875rem;  /* 14px - Small text */
--text-xs: 0.75rem;   /* 12px - Caption */
```

### Font Weights
```css
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Line Heights
```css
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

---

## 🧩 컴포넌트 라이브러리

### 1. Cards

#### Standard Card
```css
.card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    transition: all 0.3s ease;
}

.card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
}
```

#### KPI Card
```css
.kpi-card {
    background: white;
    color: #1f2937;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1rem;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid #f3f4f6;
}

.kpi-card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.kpi-card .kpi-value {
    font-size: 2rem;
    font-weight: 700;
    margin: 0.5rem 0;
    color: #111827;
}

.kpi-card .kpi-label {
    font-size: 0.875rem;
    opacity: 0.9;
    color: #6b7280;
}
```

**HTML Example:**
```html
<div class="kpi-card">
    <div class="kpi-label">Total Score</div>
    <div class="kpi-value">89.9</div>
    <div class="text-sm text-gray-500">points</div>
</div>
```

### 2. Buttons

#### Button Base Styles
```css
.btn {
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.btn:active {
    transform: translateY(0);
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}
```

#### Button Variants
```css
/* Primary Button (Blue) */
.btn-primary {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
}

.btn-primary:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
}

/* Success Button (Green) */
.btn-success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
}

.btn-success:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

/* Secondary Button (Gray) */
.btn-secondary {
    background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
    color: white;
}

.btn-secondary:hover {
    background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
}
```

**HTML Example:**
```html
<button class="btn btn-primary">
    <i class="fas fa-download"></i>
    Download PDF
</button>

<button class="btn btn-success">
    <i class="fas fa-file-excel"></i>
    Export Excel
</button>

<button class="btn btn-secondary">
    <i class="fas fa-redo"></i>
    Reset
</button>
```

### 3. Tabs

```css
.tab-btn {
    position: relative;
    transition: all 0.2s ease;
    padding: 0.75rem 1.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: #6b7280;
    font-weight: 500;
}

/* Hover Effect */
.tab-btn:hover:not(.tab-active) {
    background: #f1f5f9;
    color: #1f2937;
}

/* Underline Animation */
.tab-btn::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 0;
    height: 2px;
    background: #cbd5e1;
    transition: width 0.3s ease;
    transform: translateX(-50%);
}

.tab-btn:hover::after {
    width: 60%;
}

/* Active Tab */
.tab-active {
    border-bottom: 3px solid #3b82f6;
    color: #3b82f6;
}

.tab-active::after {
    display: none;
}
```

### 4. Badges

```css
.worker-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
    margin: 0.25rem;
}

.badge-excellent {
    background: #d1fae5;
    color: #065f46;
}

.badge-normal {
    background: #dbeafe;
    color: #1e40af;
}

.badge-poor {
    background: #fef3c7;
    color: #92400e;
}

.badge-critical {
    background: #fee2e2;
    color: #991b1b;
}
```

### 5. Tables

#### Standard Table
```css
table {
    width: 100%;
    border-collapse: collapse;
}

th {
    background: #f1f5f9;
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid #e2e8f0;
    color: #1f2937;
}

td {
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    background-color: #ffffff;
}

tr:hover {
    background: #f8fafc;
}
```

#### Dark Header Table
```css
.detailed-data-table thead {
    background: #1f2937;
    position: sticky;
    top: 0;
    z-index: 10;
}

.detailed-data-table thead th {
    background: #1f2937 !important;
    color: white !important;
    padding: 0.75rem;
    text-align: center;
    font-weight: 600;
    border: 1px solid #e5e7eb !important;
}

.detailed-data-table tbody td {
    text-align: center;
    padding: 0.75rem;
    border: 1px solid #e5e7eb !important;
    background-color: #ffffff;
}

.detailed-data-table tbody tr:hover td {
    background-color: #f8fafc !important;
}
```

#### Outlier Row Styling
```css
.detailed-data-table tbody tr.outlier-row td {
    background-color: #ffcdd2 !important;
}

.detailed-data-table tbody tr.outlier-row:hover td {
    background-color: #ef9a9a !important;
}
```

### 6. Forms & Inputs

```css
select, input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    background: white;
    color: #1f2937;
}

select:focus, input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.filter-section {
    background: #f8fafc;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
}
```

### 7. Upload Zone

```css
.upload-zone {
    border: 3px dashed #cbd5e1;
    border-radius: 12px;
    padding: 3rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    background: white;
}

.upload-zone:hover {
    border-color: #3b82f6;
    background: #f8fafc;
}

.upload-zone.dragover {
    border-color: #3b82f6;
    background: #eff6ff;
}
```

---

## 📐 레이아웃 시스템

### Grid System
```css
/* 2-column grid */
.grid-cols-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
}

/* 3-column grid */
.grid-cols-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
}

/* 4-column grid */
.grid-cols-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
}

/* Auto-fit responsive grid */
.grid-auto-fit {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
}
```

### Container
```css
.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
}
```

### Spacing Scale
```css
--spacing-xs: 0.25rem;   /* 4px */
--spacing-sm: 0.5rem;    /* 8px */
--spacing-md: 1rem;      /* 16px */
--spacing-lg: 1.5rem;    /* 24px */
--spacing-xl: 2rem;      /* 32px */
--spacing-2xl: 3rem;     /* 48px */
--spacing-3xl: 4rem;     /* 64px */
```

---

## 🎬 인터랙션 & 애니메이션

### Transitions
```css
/* Standard transition */
.transition-standard {
    transition: all 0.3s ease;
}

/* Fast transition */
.transition-fast {
    transition: all 0.2s ease;
}

/* Slow transition */
.transition-slow {
    transition: all 0.4s ease;
}
```

### Hover Effects
```css
/* Lift on hover */
.hover-lift:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Scale on hover */
.hover-scale:hover {
    transform: scale(1.05);
}

/* Glow on hover */
.hover-glow:hover {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
}
```

### Fade In Animation
```css
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.fade-in {
    animation: fadeIn 0.4s ease-in-out;
}
```

---

## 📊 차트 스타일

### Chart.js 기본 설정
```javascript
const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: true,
            position: 'bottom',
            labels: {
                font: {
                    family: 'Inter',
                    size: 12
                },
                padding: 15,
                usePointStyle: true
            }
        },
        tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: {
                family: 'Inter',
                size: 14,
                weight: '600'
            },
            bodyFont: {
                family: 'Inter',
                size: 12
            },
            padding: 12,
            cornerRadius: 8
        }
    }
};
```

### 색상 팔레트
```javascript
const chartColors = {
    primary: '#3b82f6',      // Blue
    secondary: '#a855f7',    // Purple
    success: '#10b981',      // Green
    warning: '#f59e0b',      // Amber
    danger: '#ef4444',       // Red
    info: '#06b6d4',         // Cyan
    gray: '#6b7280'          // Gray
};

const chartColorsWithAlpha = {
    primary: 'rgba(59, 130, 246, 0.8)',
    secondary: 'rgba(168, 85, 247, 0.8)',
    success: 'rgba(16, 185, 129, 0.8)',
    warning: 'rgba(245, 158, 11, 0.8)',
    danger: 'rgba(239, 68, 68, 0.8)'
};
```

---

## 📱 반응형 디자인

### Breakpoints
```css
/* Mobile First Approach */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

### Responsive Grid
```css
@media (max-width: 768px) {
    .grid-cols-4 {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .grid-cols-3 {
        grid-template-columns: repeat(1, 1fr);
    }
}

@media (max-width: 480px) {
    .grid-cols-2 {
        grid-template-columns: repeat(1, 1fr);
    }
}
```

---

## 🎯 스크롤바 스타일

```css
/* Webkit (Chrome, Safari, Edge) */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
}

::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: #64748b;
}

/* Firefox */
* {
    scrollbar-width: thin;
    scrollbar-color: #94a3b8 #f1f5f9;
}
```

---

## 📋 모달 스타일

```css
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 12px;
    max-width: 90%;
    max-height: 90%;
    overflow: auto;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    animation: modalFadeIn 0.3s ease-out;
}

@keyframes modalFadeIn {
    from {
        opacity: 0;
        transform: scale(0.9);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}
```

---

## 🎨 사용 예시

### 완전한 페이지 예시
```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IPR Design System Example</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
    <style>
        body { font-family: 'Inter', sans-serif; }
        /* Include all CSS from above */
    </style>
</head>
<body class="bg-gray-50">
    <div class="container mx-auto py-8">
        <!-- Tabs -->
        <div class="flex gap-4 mb-6 border-b border-gray-200">
            <button class="tab-btn tab-active">Dashboard</button>
            <button class="tab-btn">Report</button>
            <button class="tab-btn">Scorecard</button>
        </div>
        
        <!-- KPI Cards Grid -->
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="kpi-card">
                <div class="kpi-label">Total Workers</div>
                <div class="kpi-value">547</div>
                <div class="text-sm text-gray-500">employees</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Avg Utilization</div>
                <div class="kpi-value">89.8%</div>
                <div class="text-sm text-gray-500">time usage</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Avg Efficiency</div>
                <div class="kpi-value">90.2%</div>
                <div class="text-sm text-gray-500">productivity</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Total Score</div>
                <div class="kpi-value">89.9</div>
                <div class="text-sm text-gray-500">points</div>
            </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex gap-4 mb-6">
            <button class="btn btn-primary">
                <i class="fas fa-download"></i>
                Download PDF
            </button>
            <button class="btn btn-success">
                <i class="fas fa-file-excel"></i>
                Export Excel
            </button>
            <button class="btn btn-secondary">
                <i class="fas fa-redo"></i>
                Reset Filters
            </button>
        </div>
        
        <!-- Data Table Card -->
        <div class="card">
            <h3 class="text-xl font-semibold mb-4">Worker Performance</h3>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Worker Name</th>
                        <th>Score</th>
                        <th>Grade</th>
                        <th>Utilization</th>
                        <th>Efficiency</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1</td>
                        <td>John Doe</td>
                        <td>95.2</td>
                        <td><span class="worker-badge badge-excellent">S</span></td>
                        <td>92.5%</td>
                        <td>97.8%</td>
                    </tr>
                    <!-- More rows... -->
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
```

---

## 📌 디자인 원칙

### 1. **일관성 (Consistency)**
- 모든 버튼, 카드, 입력 필드는 동일한 스타일 적용
- 색상, 간격, 타이포그래피 규칙 준수
- 컴포넌트 재사용 우선

### 2. **단순성 (Simplicity)**
- 불필요한 장식 최소화
- 명확한 시각적 계층 구조
- 핵심 기능에 집중

### 3. **접근성 (Accessibility)**
- 충분한 색상 대비 (WCAG AA 이상)
- 키보드 네비게이션 지원
- 명확한 포커스 상태

### 4. **반응성 (Responsiveness)**
- Mobile-first 접근
- 유연한 레이아웃
- 터치 친화적 인터페이스

### 5. **성능 (Performance)**
- CSS 애니메이션 사용 (JavaScript 최소화)
- CDN 라이브러리 활용
- 이미지 최적화

---

## 🔗 리소스

### 공식 문서
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Chart.js](https://www.chartjs.org/docs/latest/)
- [Font Awesome](https://fontawesome.com/icons)
- [Inter Font](https://rsms.me/inter/)

### 도구
- [Color Palette Generator](https://coolors.co/)
- [CSS Gradient Generator](https://cssgradient.io/)
- [Box Shadow Generator](https://box-shadow.dev/)

---

**Last Updated:** 2026-04-15  
**Version:** 1.0.0  
**Author:** AIX Team
