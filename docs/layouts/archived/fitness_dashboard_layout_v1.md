# Fitness Persona Dashboard Layout Contract

> **Canonical Layout Document**
>
> This document defines the explicit layout contract for the Fitness Persona dashboard.
> Any implementation that violates this layout contract is incorrect.

---

## Grid Definition

### Desktop Layout
The Fitness Persona dashboard uses a **3-column grid**:

- **Left column**: Primary content
- **Center column**: Primary content  
- **Right column**: Secondary / utility content

---

## Placement Rules (Non-Negotiable)

### Daily Context Card
- **Spans**: Left + Center columns
- **Position**: Top row

### Quick Log
- **Lives in**: Top-right column
- **Alignment**: Aligned with Daily Context card (same row)

### Sleep Quality Trend + Energy Level Trend
- **Layout**: Stacked vertically
- **Container**: Half-width card
- **Width**: **NOT full-width**
- **Position**: Right column, below Quick Log

### Action Cards
- **Arrangement**: 2×2 grid
- **Span**: Left + Center columns
- **Position**: Below Daily Context card

### Activity Map + Goals
- **Position**: Below Action Cards
- **Layout**: Follow existing default dashboard placement
- **Span**: Left + Center columns

---

## Layout Contract Enforcement

**Any implementation that violates this layout contract is incorrect.**

This file is now referenced by all future fitness dashboard work.

---

## Visual Layout Summary

```
┌─────────────────────────────────────┬──────────────┐
│                                     │              │
│   Daily Context Card                │  Quick Log   │
│   (spans left + center)             │  (right)     │
│                                     │              │
├─────────────────────────────────────┼──────────────┤
│                                     │ Sleep Quality│
│   Action Cards (2×2 grid)           │ Trend        │
│   (spans left + center)             ├──────────────┤
│                                     │ Energy Level │
│                                     │ Trend        │
├─────────────────────────────────────┴──────────────┤
│                                                   │
│   Activity Map + Goals                            │
│   (spans left + center)                          │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## Status

**This layout contract is complete and canonical.**

