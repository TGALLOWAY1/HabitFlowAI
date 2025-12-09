# **📘 PRD — Weekly Habits (Quota-Based Tracking)**

### **HabitFlow Feature Specification**

**Version:** 1.0  
 **Owner:** HabitFlow AI  
 **Purpose:** Introduce weekly habits that track completions against a weekly quota (e.g., "Lift 3× per week") to eliminate empty daily cells and support habits with non-daily cadence.

---

# **1\. 🎯 Purpose & Goals**

The goal of this feature is to support habits that are meant to be completed a certain number of times **per week**, without creating unused cells on the daily tracking grid.

This solves numerous UX issues, including:

* Users with weekly habits feeling like they are “failing” on days where the habit is not scheduled

* Cluttered daily views

* Difficulty tracking quota-based habits such as lifting, rehearsals, songwriting replication, deep work sessions, and social habits

The new model gives users clarity, momentum, and accurate representations of their weekly progress.

---

# **2\. 👤 User Stories**

### **Primary**

* As a user, I want to track habits that occur **multiple times per week**, not daily.

* As a user, I want my habit tracker to only show **quota progress**, not empty calendar boxes.

* As a user, I want quota-based habits to **reset automatically every week**.

* As a user, I want weekly habits to also appear on my **calendar view** on their assigned days.

### **Secondary**

* As a user, I want to complete a weekly habit from:

  * Daily habit list

  * Habit detail page

  * Activity runner (Habit Steps)

  * Calendar day view

* As a user, I want to see **which days** I fulfilled the quota.

* As a user, I want the UI to encourage consistent habits without punishing flexibility.

---

# **3\. 🧩 Feature Overview**

## **3.1 Habit Frequency Types**

A habit now has a frequency type:

frequency: "daily" | "weekly"

### **Daily Habit**

* Shown on the daily habit grid

* Can be completed once per day

* Streak-based

### **Weekly Habit**

* No daily grid cells

* Track number of completions toward a weekly quota

Shown as a **progress bar or progress ring:**

 Lift: 2 / 3  
Run: 1 / 1  
Rehearsals: 2 / 3  
Replicate Songs: 1 / 2

*   
* Week resets automatically on Monday (or user setting later)

---

# **4\. 🧱 Data Model Changes**

### **Habit**

Extend the Habit model with:

frequency: "daily" | "weekly"  
weeklyTarget?: number  // required for weekly habits  
assignedDays?: number\[\] // optional: \[1, 3, 5\] for Mon/Wed/Fri, enhances calendar display

Notes:

* `assignedDays` DOES NOT limit when a user can complete the habit, it only affects calendar display.

* Weekly habits may have zero assigned days (e.g., “Meditate 3× weekly”).

---

### **HabitCompletion**

Weekly habits still use the same completion object:

HabitCompletion {  
  habitId: string  
  completedAt: Date  
}

But aggregations differ:

* Daily: one completion per day

* Weekly: unlimited per week until target reached

---

# **5\. 📅 Calendar Integration**

Weekly habits appear in the calendar view in two ways:

### **A. If assignedDays is set:**

They appear as blocks on those days (e.g., Lift on Mon/Wed/Fri).

### **B. If assignedDays is empty:**

Show completed days only OR a subtle indicator like:

(3x this week)

Daily view:

* Tapping a weekly-habit block opens the habit detail modal

* User can log a completion immediately

Weekly view sidebar:

* Show progress rings or bar

* Display: *2/3 completions*

* Display success when quota is met

---

# **6\. 🎨 UI/UX Specifications**

## **6.1 Habit List Page**

Split into two sections:

### **Daily Habits**

* Shown as the traditional daily grid

### **Weekly Habits**

Each habit is shown as a horizontal card:

\[Lifting\]        2/3      ○○●   
\[TENS\]           1/3      ○●○  
\[Rehearsal\]      2/3      ●●○  
\[Replicate Song\] 0/2      ○○

Tapping increments or opens detail.

---

## **6.2 Habit Detail Modal**

For weekly habits:

* Show a graph or history of which days were completed

* Show week progress ring

* Allow “Log Completion” button

* Show assigned\_days (if any)

---

## **6.3 Activity Runner**

If an Activity contains a Habit Step linked to a weekly habit:

* Completing the step counts as a completion

* Weekly progress updates immediately

* Activity logs do not need to know about quotas; backend handles it

---

## **6.4 Completion Logic UI**

When a weekly habit is completed:

* Progress fills

* Completed state shows

* Users can still add extra completions (not counted toward quota)

---

# **7\. 🔄 Logic & Behavior**

### **Weekly Reset**

* All weekly habit completions reset **automatically at Monday 00:00**

* Streaks are calculated for weekly habits 

### **Completion Limits**

* Weekly habits can be completed more than the quota

UI displays:

 Completed: 4 / 3

*  but does **not** expand quota automatically

### **Editing Weekly Target**

* Does NOT affect previous weeks

* Only changes the new week’s tracking

---

# **8\. ⚠ Edge Cases & Rules**

### **Switching Daily → Weekly**

Ask user:  
 “How many times per week do you want to complete this habit?”

### **Switching Weekly → Daily**

Show warning:  
 “You will now track this habit every day.”

### **Deleting a weekly habit**

No special behavior (same as daily).

### **Weekly habits with assigned days but no completions**

Calendar shows them as “upcoming”  
 Weekly sidebar shows *0/x*

### **Activity Completion**

If a weekly habit is inside an activity and user completes that step:

* Count \+1 for weekly quota

* Does NOT create empty days

---

# **9\. 🚀 MVP Scope**

### **Included**

* New weekly frequency field

* Weekly target field

* Weekly progress calculations

* Weekly quota UI on habit list

* Calendar integration (with assignedDays)

* Tracking weekly habit steps via Activity Runner

* Weekly reset logic

### **Excluded (Future Versions)**

* Custom week start day

* Monthly quota habits

* Habit scheduling notifications

---

# **10\. 📐 Backend Tasks**

* Add fields to Habit schema

* Implement weekly aggregation logic

* Update habit completion service to support weekly quotas

* Add automatic weekly reset job (cron or on-demand when week changes)

* Modify GET /habits and GET /completions to include weekly state

---

# **11\. 🖥️ Frontend Tasks**

* Update Habit creation/edit UI with frequency selector

* Add weekly habit cards to Habit List

* Add progress ring component

* Modify calendar view to render weekly habit blocks

* Update Activity Runner to handle weekly completions

* Style modifications for new sections

---

# **12\. 📈 Success Criteria**

* Users with weekly habits no longer see empty grid cells

* Weekly habits feel encouraging instead of punishing

* Weekly goals accurately reset and track

* UI clearly differentiates daily vs weekly habits

* Calendar view becomes more useful and personalized  
