# Android (Capacitor) shell

A thin native WebView wrapper around the Aftermeet web app, built with
Capacitor and Gradle.

## Why a shell

The app is server-rendered (server actions, NextAuth, Stripe), so it isn't a
pure static bundle. The native app loads the deployed web app over HTTPS — one
codebase, native distribution.

## What's checked in

This folder contains the hand-authored Gradle config that Capacitor expects:
`build.gradle`, `app/build.gradle`, `variables.gradle`, `settings.gradle`,
`gradle.properties`, the `AndroidManifest.xml`, `MainActivity.java`, and base
resources.

## Generating the rest + building

Capacitor generates the Gradle wrapper (`gradlew`, `gradle/wrapper/*`), the
`capacitor.*.gradle` glue, and `capacitor-cordova-android-plugins/` for you:

```bash
# from the project root
npm install

# Production: wrap the live deployment (the app is server-rendered, so the
# native shell loads it over HTTPS — it is NOT statically exported).
export CAP_SERVER_URL="https://your-app.vercel.app"
npx cap add android        # first time only; generates wrapper + glue
npm run cap:sync           # = cap sync (copies the mobile/ offline fallback)

# build / run
npx cap open android        # open in Android Studio, or:
cd android && ./gradlew assembleDebug
```

The `webDir` is `mobile/`, which holds only an offline fallback splash. When
`CAP_SERVER_URL` is set, the WebView loads the live app and the fallback is shown
only when the device is offline.

## Permissions

`RECORD_AUDIO` is declared for in-app voice recording. The WebView is configured
for HTTPS only (`usesCleartextTraffic=false`); use `CAP_SERVER_URL` over HTTPS so
Google OAuth and microphone access work.

> Note: `gradle-wrapper.jar` is a binary produced by `npx cap add android` /
> `gradle wrapper` and is intentionally not committed here.
