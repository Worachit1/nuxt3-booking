# 🎨 Design System - Nuxt3 Booking

## สีหลัก (Color Palette)

### Primary Colors

- **Dark Gradient**: `#2d2d2d → #1a1a1a` (Headers, Primary Buttons)
- **Gold Accent**: `#fbbf24 → #f59e0b` (Icons, Highlights, Active States)

### Status Colors

- **Success/Available**: `#10b981 → #059669` (Green)
- **Warning/Pending**: `#fbbf24 → #f59e0b` (Yellow/Gold)
- **Danger/Error**: `#dc3545 → #c82333` (Red)
- **Neutral/Disabled**: `#6c757d → #5a6268` (Gray)

### Background & Borders

- **Page Background**: `#f5f5f5`
- **Card Background**: `#ffffff`
- **Border**: `#e0e0e0` (2px standard)
- **Border Focus**: `#fbbf24`

### Text Colors

- **Primary**: `#2d2d2d`
- **Secondary**: `#6b7280`
- **Light**: `#9ca3af`
- **White**: `#ffffff`

---

## Component Patterns

### 1. Page Container

```css
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 100px 20px 40px 20px;
}
```

### 2. Hero Header

```css
.page-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  padding: 32px 40px;
  margin: 0 auto 32px auto;
  max-width: 1400px;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.header-icon {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}
```

### 3. Buttons

#### Primary Button (Gold)

```css
.btn-primary {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  padding: 14px 28px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
  border: none;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
}
```

#### Secondary Button (Dark)

```css
.btn-secondary {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
```

#### Danger Button (Red)

```css
.btn-danger {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}
```

### 4. Cards

```css
.card {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: #fbbf24;
}
```

### 5. Tables

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
}

.data-table thead {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
}

.data-table th {
  padding: 16px 12px;
  text-align: left;
  font-weight: 600;
  color: white;
}

.data-table th i {
  margin-right: 6px;
  color: #fbbf24;
}

.data-table tbody tr {
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.2s ease;
}

.data-table tbody tr:hover {
  background: #f8f9fa;
}

.data-table td {
  padding: 16px 12px;
  vertical-align: middle;
}
```

### 6. Form Inputs

```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
  color: #2d2d2d;
}

.form-group label i {
  color: #fbbf24;
}

.form-input {
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  transition: all 0.2s ease;
  background: #f8f9fa;
}

.form-input:focus {
  outline: none;
  border-color: #fbbf24;
  background: white;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
}
```

### 7. Modals

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.modal {
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

.modal-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  padding: 24px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 3px solid #fbbf24;
}
```

### 8. Status Badges

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
}

.status-badge.available {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.status-badge.pending {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
  border: 1px solid #fbbf24;
}

.status-badge.unavailable {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
  border: 1px solid #fca5a5;
}
```

### 9. Empty States

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  background: #ffffff;
  border-radius: 16px;
  border: 2px dashed #e0e0e0;
}

.empty-state i {
  font-size: 80px;
  color: #e5e7eb;
  margin-bottom: 20px;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #374151;
}

.empty-state p {
  margin: 0 0 24px 0;
  font-size: 16px;
  color: #6b7280;
}
```

---

## Spacing Scale

- **xs**: 4px
- **sm**: 8px
- **md**: 12px
- **base**: 16px
- **lg**: 20px
- **xl**: 24px
- **2xl**: 32px
- **3xl**: 40px

## Border Radius

- **Small**: 8px
- **Medium**: 12px
- **Large**: 16px
- **XLarge**: 20px
- **Pill**: 9999px

## Shadows

```css
/* Light */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

/* Medium */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);

/* Heavy */
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);

/* Gold Glow */
box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
```

## Animations

```css
/* Fade In */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Slide Up */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Hover Lift */
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}
```

## Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 768px) {
}

/* Tablet */
@media (max-width: 1024px) {
}

/* Desktop */
@media (min-width: 1025px) {
}
```

---

## Icon Guidelines

- **Font Awesome** version 6+
- Icon color: `#fbbf24` (gold) for labels
- Icon size in labels: 16-18px
- Icon size in headers: 32px
- Icon size in empty states: 64-80px

## Typography

```css
h1 {
  font-size: 28px;
  font-weight: 700;
  color: #2d2d2d;
  line-height: 1.2;
}

h2 {
  font-size: 24px;
  font-weight: 700;
  color: #2d2d2d;
}

h3 {
  font-size: 20px;
  font-weight: 700;
  color: #2d2d2d;
}

body {
  font-family: "Kanit", sans-serif;
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
}
```

---

**✨ ใช้ Design System นี้สำหรับทุกหน้าเพื่อความสอดคล้องกัน**
