# SkillSwap

SkillSwap is a premium-style mentoring and peer-learning app built with Expo, React Native, TypeScript, and an Express API.

## Features

- Register and login with persisted auth
- Profile onboarding and profile editing
- Discover mentors and learners with search and filters
- Connect, save, and book member sessions
- Session status management and calendar export
- Community events, notifications, and message threads
- Learning progress tracking
- Mobile web deployment on Vercel
- Expo development build support for Android and iOS

## Stack

- Frontend: Expo, React Native, TypeScript
- Backend: Node.js, Express
- Persistence: MongoDB-ready backend with libSQL/Turso fallback
- Hosting: Vercel
- Native build tooling: EAS Build

## Prerequisites

- Node.js 18+
- npm
- Expo account for EAS builds
- Android phone or Android emulator for Android dev builds

## Install

```bash
cd /Users/dev/Desktop/SkillsSwap
npm install
```

The root install now also installs `backend/` dependencies automatically.

## Local Development

Run the backend in one terminal:

```bash
npm run backend
```

Run the Expo app in another terminal:

```bash
npm start
```

Backend URL:
- `http://localhost:4000`

Environment:
- Copy [.env.example](/Users/dev/Desktop/SkillsSwap/.env.example) to `.env`
- If `MONGODB_URI` is set, the backend uses MongoDB
- For local-only fallback, you can omit Turso credentials and the backend will use a local file database
- For hosted persistence, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- For MongoDB Atlas, set `MONGODB_URI` and optionally `MONGODB_DB_NAME`

Expo shortcuts:
- `a` opens Android
- `i` opens iOS simulator if full Xcode is installed
- `w` opens web

## Web

Start the web app locally:

```bash
npm run web
```

Production app:
- [https://skills-swap-kappa.vercel.app](https://skills-swap-kappa.vercel.app)

## Android Development Build

This project is already configured for EAS Android development builds.

Relevant config:
- [app.json](/Users/dev/Desktop/SkillsSwap/app.json)
- [eas.json](/Users/dev/Desktop/SkillsSwap/eas.json)

### 1. Log in to Expo

```bash
npx eas-cli login
```

### 2. Start an Android development build

```bash
npx eas-cli build --platform android --profile development
```

### 3. Install the build on Android

When the build finishes, EAS gives you an install link or APK download page. Open that link on your Android phone and install the app.

### 4. Start Metro for the dev client

After the app is installed:

```bash
npm run backend
```

In another terminal:

```bash
npm run start:dev-client
```

Then open the installed SkillSwap development build on the Android phone.

## iOS Notes

- Expo Go was not reliable for this project because of SDK compatibility on the test device.
- iOS development builds require Apple Developer access.
- If Apple blocks the account, use Android development builds or install full Xcode and run the iOS simulator locally.

## Demo Login

- Email: `demo@skillsswap.app`
- Password: `demo123`

## MongoDB

This project now supports MongoDB as the primary backend store.

Required environment variables:
- `MONGODB_URI`
- `MONGODB_DB_NAME` (optional, defaults to `skillsswap`)

Recommended flow:
- Create a MongoDB Atlas cluster
- Create a database user
- Add your IP to Atlas network access
- Copy the driver connection string into `.env` as `MONGODB_URI`
- Start the backend with `npm run backend`

The backend seeds the demo data automatically into MongoDB the first time it starts against an empty database.

## Scripts

- `npm start` starts Expo
- `npm run start:dev-client` starts Expo for a development build
- `npm run backend` starts the Express backend
- `npm run web` starts Expo web
- `npm run android` starts Expo Android flow
- `npm run ios` starts Expo iOS flow
- `npm run build:web` exports the web build

## Verification

Type check:

```bash
npx tsc --noEmit
```

Web build:

```bash
npm run build:web
```

## Troubleshooting

- If Expo prompts for a different port, accept it.
- If the backend is unreachable, make sure `npm run backend` is still running.
- If Android install is blocked, confirm the EAS build finished successfully and use the generated build page link.
- If iOS simulator commands fail on macOS, full Xcode is not active yet. Run Xcode once and switch the active developer directory if needed.
