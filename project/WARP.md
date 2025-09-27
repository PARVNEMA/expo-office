# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Core Development Workflow
```bash
# Start the development server (metro bundler)
npm run dev

# Build for web platform
npm run build:web

# Run linting
npm run lint
```

### Platform-Specific Testing
Once `npm run dev` is running:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator  
- Press `w` for Web browser
- Press `r` to reload the app
- Press `m` to toggle menu

### Single Component Development
When developing individual screens or components:
```bash
# Navigate to the specific screen in the running app via the router paths:
# /(auth)/login - Login screen
# /(auth)/register - Registration screen  
# /(tabs)/home - Main home screen
# /(tabs)/profile - User profile
# /(tabs)/settings - App settings
```

## Architecture Overview

### Project Structure
This is an **Expo SDK 53** React Native app with **file-based routing** using Expo Router v4. The architecture follows a modular approach with clear separation of concerns:

- **`app/`** - File-based routing with Expo Router
  - **`(auth)/`** - Authentication routes (login, register)
  - **`(tabs)/`** - Main app navigation (home, profile, settings)
  - **`_layout.tsx`** - Root layout with auth guards

- **`context/`** - React Context providers (AuthContext for global auth state)
- **`services/`** - Business logic layer (API client with interceptors, auth service)  
- **`types/`** - TypeScript definitions for API responses, auth, etc.
- **`hooks/`** - Custom React hooks (useApi for API calls)
- **`config/`** - App configuration constants

### Authentication Flow
The app uses a **protected routing system** with automatic redirection:

1. **AuthContext** manages global auth state (user, token, loading)
2. **Secure storage** persists tokens using Expo SecureStore
3. **API interceptors** automatically attach auth headers and handle token refresh
4. **Route guards** in `_layout.tsx` redirect users based on auth status
5. **Auth services** handle login/register/logout with proper error handling

### API Architecture
**Centralized HTTP client** (`services/api.service.ts`) with:
- Automatic token attachment and refresh
- Request/response interceptors for auth handling
- Retry logic for failed requests
- Type-safe error handling
- Queue management for concurrent auth refresh attempts

### State Management
- **React Context** for global state (auth)
- **Local component state** with React hooks
- **Form state** managed with React Hook Form + Zod validation
- **API state** with custom `useApi` hook

## Key Technologies

### Core Stack
- **Expo SDK 53** - React Native framework with managed workflow
- **TypeScript** - Full type safety throughout codebase
- **Expo Router v4** - File-based routing with type-safe navigation
- **NativeWind v4** - Tailwind CSS utilities for React Native styling

### Styling System
**NativeWind** provides Tailwind CSS classes for React Native. Key configuration:
- Custom color palette in `tailwind.config.js` (primary, secondary, accent, neutral)
- Custom animations (fade-in, slide-up, bounce-light)
- Responsive design utilities
- Dark mode support

### Form Handling
- **React Hook Form** for performant form state management
- **Zod** for schema validation (see `VALIDATION_RULES` in `config/constants.ts`)
- Form components in `components/forms/` directory

## Development Workflow

### Environment Setup
Environment variables are configured in `.env` file:
```env
EXPO_PUBLIC_API_BASE_URL=your_api_base_url
EXPO_PUBLIC_API_TIMEOUT=10000
EXPO_PUBLIC_APP_NAME=your_app_name
```

### Working with APIs
Use the centralized `apiService` for all HTTP requests:
```typescript
import { apiService } from '@/services/api.service';

// Automatically handles auth headers, retries, and error handling
const data = await apiService.get('/endpoint');
const result = await apiService.post('/endpoint', payload);
```

For React components, use the `useApi` hook:
```typescript
import { useApi } from '@/hooks/useApi';

const { data, loading, error, execute } = useApi(
  () => apiService.get('/users'),
  { immediate: true }
);
```

### Adding New Screens
1. Create `.tsx` file in appropriate `app/` subdirectory
2. Follow the file-based routing convention
3. Use `useAuth()` hook for auth-dependent logic
4. Apply NativeWind classes for consistent styling

### Path Aliases
The project uses TypeScript path mapping with `@/*` alias pointing to the root directory. Import any file using this alias for cleaner imports.

## Office App Requirements Context

Based on `Requirements.md`, this is the foundation for **OfficeConnect** - an office engagement app targeting:
- **Authentication & Profiles** (foundation implemented)
- **Push Notifications & Announcements** (to be added)
- **Real-time Games** (buzzer, trivia, etc.) - will use Supabase Realtime
- **Leaderboards & Stats** (to be added)
- **Admin Panel** functionality (role-based access already structured)

The current implementation provides the **authentication foundation** and **modular architecture** needed to build the full office engagement features on top of this base project.