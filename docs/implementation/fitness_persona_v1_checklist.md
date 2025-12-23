# Fitness Persona V1 Implementation Checklist

## Accessing Different Personas

### Primary Method: Persona Switcher UI

The **Persona Switcher** is available in the top-right corner of all dashboards. Click the "Mode" dropdown to switch between:

- **Default** - Legacy dashboard with Progress Rings, Goals, Activity Heatmap
- **Emotional Regulation** - Emotional Wellbeing Dashboard
- **Fitness** - Fitness Dashboard

The selection persists across page refreshes via localStorage.

### Development Fallback: Query Parameter (Dev Only)

For development/testing, you can also use the query parameter override:

```
/dashboard?persona=fitness
```

**Available persona query parameters (dev only):**
- `?persona=fitness` - Shows Fitness Dashboard
- `?persona=emotional` - Shows Emotional Wellbeing Dashboard  
- `?persona=default` - Shows Default (legacy) Dashboard

**Note:** The query parameter override is **DEV ONLY** and takes highest priority when present. It updates localStorage and triggers a re-render. The UI switcher is the preferred method for normal use.

