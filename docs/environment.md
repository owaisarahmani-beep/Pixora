# Pixora Environment Requirements

## Local Development

- **Node.js**: Recommended v24.x (Tested with v24.20.0).
- **Package Manager**: npm 11+ or bun.
- **Expo CLI**: Installed globally or executed via `npx expo`.
- **React Native**: v0.86.x (Bundled with Expo SDK).

### Missing Tools Workaround
- **Java / JDK**: Not available locally on this machine. We will rely on GitHub Actions or EAS Build for native Android builds. 
- **Android SDK**: Not available locally on this machine. Development will rely on Expo Go and cloud native builds for complex native integrations if needed, though most APIs are available via standard Expo SDK modules.

## Scripts
- Install dependencies: `npm install`
- Start Expo: `npx expo start`
- Lint: `npx expo lint`
- Typecheck: `npx tsc --noEmit`
