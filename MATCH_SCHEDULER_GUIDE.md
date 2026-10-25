# Match Scheduler - Admin Guide

## Overview

The Match Scheduler is a dedicated admin interface for creating and managing tournament match schedules. It's located in the **Schedule** tab of the Admin Panel.

---

## Accessing Match Scheduler

1. Go to Admin Panel (`/admin`)
2. Click on the **Schedule** tab (📅 icon)
3. You'll see all scheduled matches and options to create new ones

---

## Creating a Match

### Step 1: Click "Schedule Match"

Click the blue **"+ Schedule Match"** button in the top right of the Schedule tab.

### Step 2: Select Match Type

Choose between:
- **Group Match** - Regular group stage matches (Group A or B)
- **Knockout Match** - Semi-finals and finals

### Step 3: Select Group (for group matches only)

If creating a group match, select:
- **Group A**
- **Group B**

### Step 4: Select Knockout Type (for knockout matches only)

If creating a knockout match, select:
- **Semi Final 1**
- **Semi Final 2**
- **Final**

### Step 5: Select Teams

Choose **Team 1** and **Team 2** from the available teams. Teams must be different.

### Step 6: Set Match Details

Fill in the following:
- **Match Date** - Select the date using the date picker
- **Match Time** - Set the match start time (optional)
- **Venue** - Enter the venue name/location (optional)

### Step 7: Save

Click **"Schedule"** to create the match.

---

## Viewing Scheduled Matches

All scheduled matches are displayed in chronological order below the scheduler.

For each match, you'll see:
- **Match Type Badge** - Shows "Group A", "Group B", or knockout stage
- **Status Badge** - Shows "Scheduled" or "Completed"
- **Teams** - Both teams with their badges
- **Date & Time** - When the match is scheduled
- **Venue** - Match location
- **Edit Button** - Edit the match details
- **Delete Button** - Remove the match

---

## Editing a Match

1. Find the match in the list
2. Click the **Edit** button (pencil icon)
3. Update any details you want to change
4. Click **"Update"** to save

---

## Deleting a Match

1. Find the match in the list
2. Click the **Delete** button (trash icon)
3. The match will be removed immediately

---

## Important Notes

### Required Fields
- ✅ Team 1 (must be different from Team 2)
- ✅ Team 2
- ✅ Match Date

### Optional Fields
- ⏳ Match Time
- ⏳ Venue

### Validation Rules
- Teams cannot be the same
- Group matches must have a group selected
- Knockout matches must have a knockout type selected
- All required fields must be filled

---

## Match Types Explained

### Group Matches
- Part of the regular group stage
- Can be Group A or Group B
- Typically played in a round-robin format

### Knockout Matches
- Semi Final 1 & 2: Teams advancing from group stage
- Final: Winners of semi-finals

---

## Features

### ✅ Chronological Sorting
Matches are automatically sorted by date and time for easy viewing.

### ✅ Status Tracking
Matches show their current status:
- **Scheduled** - Upcoming or currently being played
- **Completed** - Match has finished

### ✅ Real-Time Updates
All changes are saved immediately and visible across the app.

### ✅ Audit Logging
All admin actions (create, edit, delete) are logged for compliance.

### ✅ Error Handling
Clear error messages guide you if something goes wrong.

---

## Workflow Example

### Setting Up a Tournament

1. **Create Group Matches**
   - Schedule Group A matches (A vs B, A vs C, B vs C, etc.)
   - Schedule Group B matches

2. **Create Knockout Matches**
   - Schedule Semi Final 1 (Group A Winner vs Group B Runner-up)
   - Schedule Semi Final 2 (Group A Runner-up vs Group B Winner)
   - Schedule Final (Winner of SF1 vs Winner of SF2)

3. **Update as Tournament Progresses**
   - Edit match details if needed
   - Delete cancelled matches
   - Add/reschedule if needed

---

## Tips & Best Practices

### 📅 Date Formatting
- Use the calendar picker for consistent date format
- Matches are sorted chronologically automatically

### ⏰ Time Setting
- Enter time in 24-hour format (e.g., 14:30 for 2:30 PM)
- Leave blank if time not yet confirmed

### 📍 Venue Names
- Use clear, consistent venue names
- Examples: "Cricket Ground 1", "Main Stadium", "Academy Field"

### 🎯 Batch Operations
- Create all matches first, then edit details as needed
- Delete and recreate if major changes needed

---

## Troubleshooting

### Issue: "Teams must be different"
**Solution:** You selected the same team twice. Choose two different teams.

### Issue: Match not appearing in list
**Solution:** 
1. Check if it was created (look for success message)
2. Refresh the page
3. Check the sort order (matches are sorted by date)

### Issue: Can't edit/delete match
**Solution:**
1. Make sure you're logged in as admin
2. Check network connection
3. Try refreshing and trying again

---

## Related Features

- **Admin Setup Tab** - Start individual matches once scheduled
- **Admin Scorer Tab** - Record live match scores
- **Match Fixtures Calendar** - Public view of all scheduled matches
- **Tournament Bracket** - View knockout tournament structure

---

## Audit Trail

All match scheduling actions are logged:
- ✅ Match created
- ✅ Match updated
- ✅ Match deleted
- ✅ Admin user who made the change
- ✅ Timestamp of change

Access logs in the admin panel under Audit Logs or Settings.

---

**Last Updated:** 2026-10-25  
**Version:** 1.0  
**Status:** Production Ready
