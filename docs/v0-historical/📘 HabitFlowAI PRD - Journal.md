> ⚠️ Status: Historical PRD (v0)
>
> This document reflects earlier design intent and may reference
> legacy concepts or naming (e.g., Activity, DayLog).
>
> Canonical behavior is defined in:
> /docs/canonical/Canonical Domain Rules.md


# 📘 PRD: Journal Entries (HabitFlow) — Revised

## 1. Purpose & Goals (Unchanged)
HabitFlow Journals exist to:
* Improve habit adherence
* Improve emotional regulation
* Improve goal execution
* Reduce cognitive overload

> **Note:** This is applied psychology, not expressive blogging.

---

## 2. Design Philosophy (Refined)

### Core Principles (Expanded)
* **Psychology-first**
* **Few templates, many depths**
* **Persona-aware tone**
* **User-controlled intensity**
* **Never punitive**

> "A user should never feel behind for journaling 'less'."

---

## 3. Template Architecture (Key Change)

### Primary Insight
Your new ideas are excellent, but if exposed all at once they:
* Increase choice paralysis
* Increase time-to-complete
* Risk journaling burnout

### Solution: Template Variants + Optional Deep Mode
Each Core Template may have:
1.  **Standard Mode** (3–4 prompts, default)
2.  **Deep Mode** (expanded persona-driven prompts)

**Deep Mode is:**
* Optional
* Toggleable per entry
* Remembered per user preference

---

## 4. Final Template Set (v1)
**🧠 CORE TEMPLATES (UNCHANGED COUNT)**
We still ship 7 templates. Some get variants.

---

## 5. Template Details (Updated)

### 5.1 Morning Primer (Intention Setting)
* **Persona:** The Strategic Coach
* **Tone:** Clear, focused, grounding

**Standard Mode (Default)**
* What is the one absolute priority for today?
* When and where will I accomplish this?
* If I feel resistance, what is my If/Then plan?

> *Why unchanged: This template is already optimal. No expansion needed.*

### 5.2 Daily Retrospective (Evening Review)
* **Persona:** The Reflective Mentor
* **Tone:** Calm, learning-oriented

**Standard Mode**
* What went well today?
* What was one challenge I faced, and how did I respond?
* What would I do differently next time?

**Optional Deep Mode**
* What pattern did I notice about myself today?
* Did I act in alignment with my values?
    * *(Kept light to avoid rumination)*

### 5.3 Deep Gratitude (Positive Psychology)
* **Persona:** The Grounded Optimist
* **Tone:** Warm, embodied

**Standard Mode**
* Three specific things that went well today.
* Why did they happen?
* How did they feel in my body?

> *No changes needed — already strong.*

### 5.4 Thought Detox (CBT & Emotional Regulation)
* **Persona:** The Cognitive Reframer
* **Tone:** Rational, stabilizing

**Standard Mode**
* What situation is stressing me right now?
* What thought am I having about it?
* What is a more balanced way to see this?

### 5.5 Emotion Check-In (NEW — Variant of Thought Detox)
* **Persona:** The Compassionate Therapist
* **Tone:** Gentle, non-judgmental, grounding

**Prompts**
* **Weather Report:** "If your internal state were weather, what would it be?"
* **Somatic Scan:** "Where in your body do you feel the strongest sensation?"
* **Labeling:** "Name three emotions present right now."
* **Self-Compassion:** "What would you say to a dear friend feeling this way?"
* **Unburdening:** "What is one thought you can safely leave here for tonight?"

> *Why this works: Serves anxious users before cognitive reframing; allows emotional processing without analysis; can be surfaced contextually (e.g. late night).*

### 5.6 Habit Scientist (Behavioral Analysis)
* **Persona:** The Curious Scientist
* **Tone:** Neutral, analytical

**Standard Mode**
* What habit did I succeed or struggle with today?
* What happened right before?
* How can I adjust the cue tomorrow?

### 5.7 Workout Log (NEW — Variant of Habit Scientist)
* **Persona:** Performance-Focused Personal Trainer
* **Tone:** Analytical, motivating

**Prompts**
* **Pre-Session Scan:** Energy & mobility (1–10). Fueled properly?
* **The Highlight:** Biggest win today?
* **Mechanics & Pain Check:** Any discomfort or joint friction?
* **RPE:** How close to failure on key lifts?
* **Recovery Plan:** Sleep + nutrition tonight?

> *Why this belongs here: It’s still cue → response → adjustment. Metrics stay qualitative, not tracker duplication.*

### 5.8 Diet Journal (NEW — Variant of Habit Scientist)
* **Persona:** Life Coach & Dietitian
* **Tone:** Compassionate, reframing

**Prompts**
* Nourishment win today?
* Mindful eating moment?
* Trigger behind any challenges?
* Hydration & its effect?
* One nourishing intention for tomorrow?

> *Why this fits: Focuses on behavior, not calories. Reinforces identity-based eating.*

### 5.9 WOOP Session (Goal Overcoming)
* **Persona:** The Strategic Realist
* **Tone:** Focused, honest

> *Unchanged — already optimal.*

### 5.10 Personal Growth (NEW — Variant of WOOP / Retrospective)
* **Persona:** Growth Mindset Coach
* **Tone:** Energetic, challenging

**Prompts**
* What surprised me today?
* What did a setback teach me?
* Where did I feel resistance?
* When did I enter flow?
* What’s my 1% move tomorrow?

### 5.11 Relationship Journal (NEW — Standalone Template)
* **Persona:** The Empathetic Listener
* **Tone:** Quiet, spacious

**Prompts**
* Who has been on my mind today?
* What interaction am I replaying?
* Did I feel heard? Did I listen well?
* One thing I appreciated about someone today.
* A question I didn’t ask — and why.

> *Why separate: Different emotional safety needs; high user demand; not reducible to habits or goals. This becomes the 7th core template, replacing Free Write’s exclusivity.*

---

## 6. Free Write (Still Included)
Free Write remains available as:
* A universal option
* No persona
* No prompts

---

## 7. UX: Progressive Disclosure
**Entry Editor Behavior**
* **Default:** 3–4 prompts shown
* **Action:** “Go Deeper” toggle reveals full set
* **Memory:** User preference remembered per template

**Benefit:**
* Keeps casual users engaged.
* Keeps power users satisfied.

---

## 8. Data Model (Minimal Change)

```typescript
// Additions to the Entry model
{
  mode: "standard" | "deep" | "variant",
  variantId?: string,
  persona?: string
}
// Everything else stays intact.