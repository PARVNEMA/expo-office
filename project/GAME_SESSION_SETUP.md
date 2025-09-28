# Game Session Management Setup Guide

This guide explains how to set up and use the game session management system with admin controls and Supabase integration.

## 📋 Overview

The game session management system implements the following key features:

1. **Admin-Only Session Control**: Only administrators can start game sessions
2. **Session-Based Game Visibility**: Games are only visible to users when sessions are active
3. **Minimum Player Requirements**: Each game requires at least 2 players to start
4. **Admin-Only Spin Control**: For "Spin the Bottle" games, only admins can spin the bottle
5. **Real-time Updates**: All changes are synchronized in real-time across all users

## 🗄️ Database Setup

### Step 1: Apply Schema Updates

Run the SQL script in your Supabase SQL Editor:

```bash
# Execute the content of supabase-game-sessions.sql in your Supabase dashboard
```

This will:
- Add session management columns to the games table
- Create game session management functions
- Update Row Level Security (RLS) policies
- Create a view for easier querying
- Set up indexes for better performance

### Step 2: Create an Admin User

1. Create a user account through your app's registration flow or Supabase Auth dashboard
2. Update their role to admin:

```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'your-admin-email@company.com';
```

## 🎮 How the System Works

### Game Visibility
- **Regular Users**: Can only see games with active sessions
- **Admins**: Can see all games (active sessions, games they created, or all games)
- **Game Creators**: Can see games they created regardless of session status

### Game Session Lifecycle

1. **Game Creation**: Anyone can create a game (initially no session is active)
2. **Player Joining**: Users can only join games with active sessions
3. **Session Starting**: Only admins can start sessions (requires minimum 2 players)
4. **Game Playing**: Users can play games with active sessions
5. **Session Ending**: Admins or game creators can end sessions

### Game-Specific Rules

#### Spin the Bottle
- Only administrators can spin the bottle
- Requires at least 2 players to spin
- Real-time updates for all participants

#### Buzzer Games
- Any participant can press the buzzer
- Results are tracked and synchronized

#### Trivia Games
- Standard session management applies
- Score tracking for participants

## 🚀 Usage Guide

### For Administrators

#### Starting a Game Session
1. Navigate to the Games tab
2. Find a game with "Ready to Start" status (has minimum players)
3. Click "Start Session" button
4. The game becomes visible and playable to all users

#### Managing Games (Admin Panel)
1. Go to Admin tab
2. View all games in the "Game Management" section
3. Start/End sessions as needed
4. Delete games if necessary

#### Spinning the Bottle (Spin the Bottle Games)
1. Join the game with active session
2. Only admins will see the active "Spin the Bottle" button
3. Click to spin - results are synchronized to all participants

### For Regular Users

#### Joining Games
1. Navigate to Games tab
2. Only games with active sessions will show "Join Game" button
3. Games without active sessions show "Session Not Started"

#### Playing Games
- **Buzzer Games**: Press the buzzer when active
- **Spin the Bottle**: Wait for admin to spin, view results
- **Trivia**: Answer questions when prompted

## 📱 Key Features Implemented

### Real-time Synchronization
- Game state updates are pushed to all participants instantly
- Session status changes are reflected immediately
- Participant joins/leaves are synchronized

### Admin Controls
```typescript
// Key admin functions in GameService
GameService.startGameSession(gameId)    // Start a game session
GameService.endGameSession(gameId)      // End a game session
GameService.spinBottle(gameId)          // Spin bottle (admin only)
GameService.isCurrentUserAdmin()        // Check admin status
```

### Session Management
```typescript
// Key session functions
GameService.joinGame(gameId)            // Join active session
GameService.leaveGame(gameId)           // Leave session
GameService.getGameParticipants(gameId) // Get current players
```

## 🔧 Technical Details

### Database Schema Changes
- `session_active`: Boolean flag for active sessions
- `session_started_at`: Timestamp when session started
- `session_ended_at`: Timestamp when session ended
- `min_players`: Minimum players required (default: 2)

### RLS Policies
Games are only visible if:
- Session is active, OR
- User is the creator, OR
- User is an admin

### Functions Added
- `start_game_session(game_id)`: Admin-only session starting
- `end_game_session(game_id)`: Session ending (admin/creator)
- `join_game(game_id)`: Join active session
- `leave_game(game_id)`: Leave session

## 🎯 Game Flow Example

### Typical Game Session Flow:

1. **Admin creates "Quick Buzzer Game"**
   - Game exists but no session is active
   - Only admin can see the game initially

2. **Users join the game lobby**
   - Admin starts session once minimum players join
   - Game becomes visible to all users

3. **Users join the active session**
   - Game reaches required player count
   - Admin can now start the session

4. **Game session is active**
   - All users can see and join the game
   - Game-specific features become available

5. **Admin ends session**
   - Game becomes invisible to regular users again
   - Stats and history are preserved

## ⚠️ Important Notes

1. **Admin Privileges**: Make sure to set up at least one admin user before testing
2. **Minimum Players**: Games require at least 2 players to start sessions
3. **Real-time**: Changes may take a moment to sync across all devices
4. **Session State**: Games remember their state even when sessions end
5. **Permissions**: Regular users cannot start/stop sessions or spin bottles

## 🐛 Troubleshooting

### Common Issues:
- **"Only administrators can start game sessions"**: User needs admin role
- **Games not visible**: Session may not be active, check admin panel
- **Can't join game**: Session might be full or ended
- **Spin button disabled**: Only admins can spin in Spin the Bottle games

### Debug Steps:
1. Check user role in Supabase profiles table
2. Verify game session_active status
3. Check participant count vs max_players limit
4. Review Supabase logs for RLS policy issues

## 📊 Database Views

The `games_with_participants` view provides:
- Game details with participant counts
- Session status calculation
- Easy querying for the frontend

This system ensures proper game session management with admin oversight while maintaining real-time synchronization across all participants.