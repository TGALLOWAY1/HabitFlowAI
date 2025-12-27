> ⚠️ Status: Historical PRD (v0)
>
> This document reflects earlier design intent and may reference
> legacy concepts or naming (e.g., Activity, DayLog).
>
> Canonical behavior is defined in:
> /docs/canonical/Canonical Domain Rules.md


# **📘 PRD: Non-Negotiable Habit System (Priority Ring Only)**

*A HabitFlowAI Feature Specification*

---

## **1. 🎯 Purpose & Scope**

Certain habits matter more than others—meal prep, training days, sleep routine, medication, weekly planning, etc.
Users need a **clear, gentle, visually distinct signal** that some habits are **non-negotiable** on specific days.

This PRD defines the **Non-Negotiable Habit** system using a single, clean visual indicator:

### **✨ The Priority Ring**

A thin glowing gold ring around the habit card that communicates importance without stress or negativity.

Tone:
**Supportive. Soft. Motivating. Not punitive.**

---

## **2. 🧩 Core Concepts**

### **2.1 Non-Negotiable Habit**

A standard habit that is flagged as **essential** for the day.

Functional properties:

* Appears visually distinct in the habit list
* Can optionally float to top of daily view


---

### **2.2 Priority Ring**

The sole visual indicator for non-negotiable habits.

#### **Design Properties:**

* A thin 1.5–2px gold stroke around the entire habit card
* Soft animated glow (breathing pulse)
* Smooth corners following card shape
* High contrast but gentle, never harsh colors

#### **Priority Ring Behavior:**

| State                        | Description                           |
| ---------------------------- | ------------------------------------- |
| **Active (incomplete)**      | Gold ring pulses gently               |
| **Completed**                | Ring becomes solid gold, no pulsing   |

#### **Purpose:**

* Immediate recognition
* Minimalist design
* Intuitive UX with low cognitive load

---

## **3. 🧭 User Interactions**

### **3.1 Marking a Habit as Non-Negotiable**

Flow:

1. Open habit edit page
2. Toggle **“Mark as Non-Negotiable”**
3. Optionally choose days of the week
5. Habit card updates immediately with Priority Ring

Backend stores:

```ts
habit.nonNegotiable: boolean
habit.nonNegotiableDays?: number[] // 0 = Sunday
habit.deadline?: string // optional HH:MM
```

---

### **3.2 Completing a Non-Negotiable Habit**

When user checks the habit:

* Priority Ring becomes a **solid gold border**
* The pulsing animation stops
* Habit behaves like any other habit inside the system

Optional micro-animation:

* Brief soft shimmer (non-confetti, minimalist)

---

### **3.3 Daily View Behavior**

* Non-negotiable habits appear with ring active
* (Optional) pinned to top of list
* Animated priority ring draws gentle attention
* Works seamlessly next to normal daily habits or weekly habits.

---

### **3.4 Weekly View Behavior**

Weekly summaries highlight non-negotiables:

* Stronger streak visualization

## **4. 🎨 UI Specifications**

### **4.1 Habit Card Layout**

```
 --------------------------------------
| (Gold Priority Ring Around Card)     |
|                                      |
|  [Habit Title]          [Checkmark]  |
|                                      |
 --------------------------------------
```

### **4.2 Priority Ring Style Guide**

* Gold gradient (#f9d976 → #f39f3f)
* Glow radius: 4–6px
* Pulse animation: 1.8–2.2s duration
* Non-intrusive, ambient

### **4.3 Accessibility**

* High contrast mode → ring becomes thicker, glow becomes static
* Motion reduction settings → pulse disabled by CSS

---

## **5. 🧱 Data Model**

### **Habit Properties**

```ts
Habit {
  id: string
  title: string
  categoryId: string
  nonNegotiable?: boolean
  nonNegotiableDays?: number[] // optional
  deadline?: string // HH:MM
}
```

### **UI State**

```ts
UIHabitState {
  isNonNegotiable: boolean
  isCompleted: boolean
  isNearDeadline: boolean
  isOverdue: boolean
}
```

---

## **6. 🔔 Notifications (Optional)**

If the user opts in:

* More prominent reminders for non-negotiables
* “Gentle nudge” phrasing:

  > “Reminder: Meal Prep is one of today’s non-negotiables.”

Controls:

* Global toggle
* Per-habit override

---

## **7. 🧪 Edge Cases**

### **Changing Habit Status**

* Turning non-negotiable OFF removes ring immediately

### **Habit Appears in Activities**

* Habit Steps inside Activities will show a **mini** priority ring
* NO cross-view inconsistencies

### **Deleting Habit**

* Removes all non-negotiable metadata

### **Deadline Without Non-Negotiable Flag**

* Deadline ignored unless habit is non-negotiable

---

## **8. 🚀 MVP Scope**

### **Included:**

* Non-negotiable toggle
* Priority Ring (active + completed states)
* Optional “pin to top” for non-negotiables
* Data model updates
* Integration with daily and weekly views
* Minimal animations

### **Deferred:**

* Near-deadline urgency animation
* Overdue fade state
* Enhanced reminders
* Coaching model integration

---

## **9. 🧩 Summary**

This feature introduces a clear, elegant, intuitive way for users to identify and prioritize the habits that matter most—**without guilt, stress, or overcomplication.**

The Priority Ring:

* Aligns with HabitFlow’s visual language
* Adds emotional importance without pressure
* Enhances consistency and meaning
* Opens future integrations with coaching
