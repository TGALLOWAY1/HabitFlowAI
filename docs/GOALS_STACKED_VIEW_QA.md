# Goals Stacked View - QA Checklist

## Overview
This document tracks QA testing for the Goals page stacked view with drag-and-drop functionality.

## Test Scenarios

### iPhone Width (390px) - Mobile Testing

#### Layout & Scrolling
- [ ] **Single Column Layout**: Goals display in single column (no multi-column grid)
- [ ] **No Horizontal Scroll**: Page does not overflow horizontally
- [ ] **Vertical Scrolling**: Page scrolls vertically smoothly
- [ ] **Stack Spacing**: Adequate spacing between stacks (not cramped)
- [ ] **Card Spacing**: Goal cards have proper spacing within stacks

#### Stack Interactions
- [ ] **Collapse/Expand**: Tap stack header toggles expand/collapse
- [ ] **Stack Header Touch Target**: Entire header area is tappable (not just chevron)
- [ ] **Stack Drag Handle**: Visible and tappable on mobile (44px minimum)
- [ ] **Stack Reorder**: Can drag stacks to reorder categories
- [ ] **Stack Header Text**: Category name and goal count are readable and not truncated unnecessarily

#### Goal Interactions
- [ ] **Goal Drag Handle**: Visible and tappable on mobile (44px minimum)
- [ ] **Goal Reorder**: Can drag goals within a stack to reorder
- [ ] **Cross-Stack Move**: Can drag goal from one stack to another
- [ ] **Goal Card Tap**: Tapping goal card (not drag handle) opens goal details
- [ ] **Goal Card Actions**: Edit and manual progress buttons work on mobile

#### Visual Feedback
- [ ] **Drag Feedback**: Dragging shows visual feedback (opacity change, highlight)
- [ ] **Drop Zone Highlight**: Target stack highlights when dragging goal over it
- [ ] **Touch Feedback**: Buttons show active state on tap

### Desktop Width (1024px+) - Desktop Testing

#### Layout
- [ ] **Multi-Column Grid**: Goals display in 2-3 column grid on larger screens
- [ ] **Responsive Breakpoints**: Layout adapts correctly at md (768px) and lg (1024px)
- [ ] **Stack Spacing**: Adequate spacing between stacks
- [ ] **No Overflow**: No horizontal scroll at any desktop width

#### Stack Interactions
- [ ] **Collapse/Expand**: Click stack header toggles expand/collapse
- [ ] **Stack Drag Handle**: Appears on hover (desktop-only behavior)
- [ ] **Stack Reorder**: Can drag stacks to reorder categories
- [ ] **Hover States**: Stack headers show hover effects

#### Goal Interactions
- [ ] **Goal Drag Handle**: Appears on hover for goal cards (desktop-only)
- [ ] **Goal Reorder**: Can drag goals within a stack to reorder
- [ ] **Cross-Stack Move**: Can drag goal from one stack to another
- [ ] **Goal Card Click**: Clicking goal card opens goal details
- [ ] **Goal Card Actions**: Edit and manual progress buttons work

#### Visual Feedback
- [ ] **Drag Feedback**: Dragging shows visual feedback
- [ ] **Drop Zone Highlight**: Target stack highlights when dragging goal over it
- [ ] **Hover States**: All interactive elements show hover states

### Win Archive - Completed Goals

#### Access
- [ ] **Win Archive Button**: Button is visible and accessible
- [ ] **Completed Goals**: Completed goals appear in Win Archive
- [ ] **No Active Stacks**: Completed goals do not appear in main stacked view
- [ ] **Archive Navigation**: Can navigate to/from Win Archive

### Edge Cases

#### Empty States
- [ ] **No Goals**: Empty state displays correctly when no goals exist
- [ ] **Empty Category**: Categories with no goals do not appear in stacks
- [ ] **All Completed**: If all goals completed, main view shows empty state

#### Data Persistence
- [ ] **Stack Order Persists**: Stack reorder persists after page reload
- [ ] **Goal Order Persists**: Goal reorder within stack persists after reload
- [ ] **Category Change Persists**: Moving goal between stacks persists after reload
- [ ] **SortOrder Normalization**: sortOrder values are normalized (0..n-1) after operations

#### Error Handling
- [ ] **Network Errors**: Failed API calls show appropriate error messages
- [ ] **Rollback**: Failed operations roll back UI state correctly
- [ ] **Loading States**: Loading indicators show during async operations

## Touch Target Guidelines

### Minimum Touch Target Sizes (Mobile)
- **Drag Handles**: 44px × 44px minimum
- **Stack Headers**: Full width, minimum 44px height
- **Goal Cards**: Full width, adequate height for content
- **Action Buttons**: 44px × 44px minimum

### Touch Target Separation
- **Stack Drag Handle**: Separate from collapse/expand button (left side)
- **Goal Drag Handle**: Positioned to not interfere with card click
- **Action Buttons**: Adequate spacing between interactive elements

## Browser Testing

### Mobile Browsers
- [ ] Safari iOS (iPhone)
- [ ] Chrome iOS (iPhone)
- [ ] Chrome Android
- [ ] Firefox Mobile

### Desktop Browsers
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

## Performance

- [ ] **Smooth Scrolling**: No jank during scroll
- [ ] **Drag Performance**: Dragging feels smooth (60fps)
- [ ] **Large Lists**: Performance acceptable with 20+ goals per stack
- [ ] **Many Stacks**: Performance acceptable with 10+ category stacks

## Accessibility

- [ ] **Keyboard Navigation**: Can navigate and interact with keyboard
- [ ] **Screen Reader**: Screen reader announces stack headers and goal cards
- [ ] **Focus Indicators**: Focus states are visible
- [ ] **ARIA Labels**: Appropriate ARIA labels on interactive elements

## Notes

- Drag handles are always visible on mobile for better touch accessibility
- Drag handles appear on hover on desktop to reduce visual clutter
- Stack headers are split: drag handle on left, toggle button on right
- Goal cards maintain full-width clickability while drag handle is separate

