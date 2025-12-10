# **📘 PRD — Wellbeing Visualization: Morning & Evening Mood Trends**

## **1\. 🎯 Purpose & Scope**

Users track **depression and anxiety levels twice per day** (morning & evening).  
 Currently, both values appear in a single combined graph, making it difficult to distinguish which point represents which check-in.

This feature introduces a **clear, simple, reliable visualization** that allows the user to quickly understand:

* How morning mood changes over time

* How evening mood changes over time

* Whether days tend to end better or worse than they began

* How emotional trends correlate with habit performance (future, not in this PRD)

The guiding principle:  
 **Maximum clarity, minimum complexity.**

---

## **2\. ✨ High-Level Feature Summary**

We will use **stacked line charts**, one for morning values and one for evening values, both:

* Synchronized on the **same x-axis (dates)**

* Rendered with **their own y-axes** for maximum clarity

* Displaying **two metrics**:

  * Depression

  * Anxiety

Total: **4 simple lines**, but never overlapping.

This creates a clean interpretation surface without clutter.

---

## **3\. 🖼️ User Experience Overview**

### **3.1 Dashboard Placement**

The visualization appears under the **Wellbeing** or **Mindset** section of the Dashboard.

Layout:

`Depression — Morning (line chart)`  
`--------------------------------`

`Depression — Evening (line chart)`  
`--------------------------------`

`Anxiety — Morning (line chart)`  
`------------------------------`

`Anxiety — Evening (line chart)`  
`------------------------------`

Charts are stacked vertically in collapsible groups:

* **Depression**

  * Morning chart

  * Evening chart

* **Anxiety**

  * Morning chart

  * Evening chart

User can collapse each category to simplify the view.

---

## **4\. 🎨 UX Details**

### **4.1 Visual Design**

**Morning charts:**

* Line color: *Blue-toned palette*

* Marker shape: circle

**Evening charts:**

* Line color: *Purple-toned palette*

* Marker shape: diamond

Each chart includes:

* Clear title:

  * “Depression — Morning”

  * “Depression — Evening”

  * “Anxiety — Morning”

  * “Anxiety — Evening”

* Light gridlines

* Tooltip on hover:

  * Date

  * Recorded value

  * Time of entry (AM/PM)

Charts auto-scale independently.

### **4.2 Shared X-Axis Behavior**

All four charts share the same date axis:

* Clicking/hovering on a date highlights the corresponding values in all charts

* Ensures intuitive cross-comparison

### **4.3 Date Range Controls**

Top-right controls:

* Last 7 days

* Last 14 days

* Last 30 days

* Custom date picker (optional in later version)

Default: **30 days**

---

## **5\. 🔧 Data Model & Storage**

We already store mood entries as:

`MoodEntry {`  
  `id: string`  
  `date: Date`  
  `timeOfDay: "morning" | "evening"`  
  `depression: number`  
  `anxiety: number`  
  `createdAt: Date`  
`}`

### **No changes to data model required.**

---

## **6\. 🔌 API / Query Requirements**

### **6.1 Fetch Mood Entries**

`GET /mood?start=<date>&end=<date>`

Returns all mood entries within range, sorted by date/time.

### **6.2 Frontend Aggregation**

For each date, the frontend groups:

* morning depression

* evening depression

* morning anxiety

* evening anxiety

Missing entries appear as gaps (null values), which chart libraries should ignore gracefully.

---

## **7\. 📊 Chart Rendering Logic**

### **7.1 Separate Charts**

Each metric/time combination is its own `<LineChart>` component instance.

### **7.2 Shared X-Axis Linking**

Charts are aligned vertically.  
 The x-axis labels must match.

### **7.3 Handling Missing Data**

If a day lacks a morning or evening entry:

* The line breaks

* Marker does not render

* Tooltip will show “No entry recorded”

---

## **8\. 🧪 Acceptance Criteria**

### **8.1 Visual Separation**

* Morning and evening values never overlap in the same chart

* Each chart clearly communicates which values are displayed

* Colors and shapes are consistent across charts

### **8.2 User Understanding**

* Users can immediately see trend direction for morning vs evening

* Users can identify whether their days tend to improve or worsen

* Users can distinguish depression and anxiety at a glance

### **8.3 Technical Functionality**

* Charts load under 300ms for 30 days of data

* Charts handle missing entries correctly

* Shared x-axis alignment remains visually clean

* Tooltip displays correct values

---

## **9\. 🚫 Out of Scope (for now)**

These are potential future enhancements but **NOT** part of this PRD:

* Mood ↔ Habit completion correlations

* Day improvement arrows (AM → PM delta)

* Predictive analytics (“You tend to improve on days you walk \> 6k steps”)

* Color-coded emotional recovery patterns

* Combined mood dashboard summary cards

This PRD is strictly the **visual clarity** upgrade.

---

## **10\. 🛠️ Implementation Notes**

### **Frontend Framework Assumptions**

* Using Recharts, Chart.js, or similar

* Stacked vertical layout is easiest with flex-column

### **Component Structure**

`WellbeingDashboard`  
 `├── MoodSection`  
 `│     ├── DepressionCharts`  
 `│     │     ├── DepressionMorningChart`  
 `│     │     └── DepressionEveningChart`  
 `│     ├── AnxietyCharts`  
 `│     │     ├── AnxietyMorningChart`  
 `│     │     └── AnxietyEveningChart`

### **Chart Props**

Each chart receives:

`{`  
  `title: string,`  
  `data: { date: string, value: number | null }[],`  
  `color: string,`  
  `markerShape: "circle" | "diamond"`  
`}`

---

# **✅ Summary**

This feature delivers a **simple, highly readable** visualization of morning vs evening mood data:

* No overlapping points

* Immediate clarity of trends

* Clean UI

* Easy comparison between morning and evening patterns

* Zero over-engineering

Exactly the right level for the current stage of HabitFlow.

