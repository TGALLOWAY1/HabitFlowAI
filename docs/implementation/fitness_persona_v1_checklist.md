# Fitness Persona V1 Implementation Checklist

## Development Access

### Opening the Fitness Dashboard in Dev Mode

To view the Fitness dashboard during development, use the query parameter override:

```
/dashboard?persona=fitness
```

**Available persona query parameters (dev only):**
- `?persona=fitness` - Shows Fitness Dashboard
- `?persona=emotional` - Shows Emotional Wellbeing Dashboard  
- `?persona=default` - Shows Default (legacy) Dashboard

**Note:** This query parameter override is **DEV ONLY** and will not work in production builds. It updates the `habitflow_active_user_mode` localStorage key and triggers a re-render of the ProgressDashboard component.

