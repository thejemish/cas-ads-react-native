# CAS Ads Expo Config Plugin

Custom Expo config plugin for integrating [CAS.AI (Clever Ad Solutions)](https://cas.ai) SDK into Expo-managed React Native projects.

Since `react-native-cas` does not natively support Expo, this plugin bridges the gap by automatically modifying native Android and iOS files during `expo prebuild`.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Plugin Configuration](#plugin-configuration)
  - [All Settings](#all-settings)
  - [Ad Solutions](#ad-solutions)
    - [Optimal Ads](#1-optimal-ads-default)
    - [Families Ads](#2-families-ads)
    - [Choice Networks](#3-choice-networks)
  - [Available Adapters](#available-adapters)
- [What the Plugin Modifies](#what-the-plugin-modifies)
  - [Android](#android)
  - [iOS](#ios)
- [Usage](#usage)
- [Adapter Reference](#adapter-reference)
  - [Universal Adapters](#universal-adapters-coppa-safe)
  - [COPPA-Restricted Adapters](#coppa-restricted-adapters)
  - [Closed Beta Adapters](#closed-beta-adapters)
  - [Cross-Promotion](#cross-promotion)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement        | Minimum Version |
| ------------------ | --------------- |
| Expo SDK           | 54+             |
| React Native       | 0.81+           |
| react-native-cas   | 4.6.0           |
| Android minSdk     | 23              |
| iOS deployment     | 13.0            |
| Xcode              | 26.0+           |

---

## Installation

1. Install the CAS React Native package:

```bash
npm install react-native-cas
```

2. The plugin file is located at `plugins/withCasAds.js`. Register it in your `app.json`:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      ["./plugins/withCasAds", { "adSolution": "optimal" }]
    ]
  }
}
```

3. Run prebuild to generate native files:

```bash
npx expo prebuild --clean
```

---

## Plugin Configuration

### All Settings

| Property              | Type       | Default     | Description                                                                 |
| --------------------- | ---------- | ----------- | --------------------------------------------------------------------------- |
| `adSolution`          | `string`   | `"optimal"` | Ad solution mode: `"optimal"`, `"families"`, or `"choice"`                  |
| `useAdvertisingId`    | `boolean`  | `true`      | Enable Google Advertising ID (GAID). Auto-disabled for `"families"` mode    |
| `trackingDescription` | `string`   | See below   | iOS App Tracking Transparency description shown to the user                 |
| `adapters`            | `string[]` | `[]`        | List of adapter names. **Only used when `adSolution` is `"choice"`**        |

**Default `trackingDescription`:**
> "Your data will remain confidential and will only be used to provide you a better and personalised ad experience."

---

### Ad Solutions

CAS provides three ways to configure which ad networks are included in your app.

#### 1. Optimal Ads (Default)

Recommended for most apps targeting a **general or mixed audience**. Automatically includes a curated set of high-performance, stable ad networks for maximum fill rate and revenue.

```json
["./plugins/withCasAds", {
  "adSolution": "optimal",
  "useAdvertisingId": true
}]
```

**What it generates:**

- **Android** `app/build.gradle`:
  ```groovy
  cas {
      includeOptimalAds = true
      useAdvertisingId = true
  }
  ```
- **iOS** `Podfile`:
  ```ruby
  pod 'CleverAdsSolutions-SDK/Optimal', '4.6.0'
  ```

**Pros:** Zero configuration, best out-of-the-box performance.
**Cons:** Larger app size (includes all optimal networks), no granular control.

---

#### 2. Families Ads

Required for apps **exclusively directed at children**. Compliant with Google Play Families Policy and COPPA (Children's Online Privacy Protection Act).

```json
["./plugins/withCasAds", {
  "adSolution": "families"
}]
```

**What it generates:**

- **Android** `app/build.gradle`:
  ```groovy
  cas {
      includeFamiliesAds = true
      useAdvertisingId = false
  }
  ```
- **iOS** `Podfile`:
  ```ruby
  pod 'CleverAdsSolutions-SDK/Families', '4.6.0'
  ```

**Important:**
- `useAdvertisingId` is **automatically set to `false`** (prohibited for child-directed apps).
- Only includes child-safe ad networks (e.g., Kidoz, SuperAwesome).
- Smaller app size compared to Optimal.

---

#### 3. Choice Networks

For **advanced publishers** who want full control over which ad networks are included. You manually specify each adapter by name.

```json
["./plugins/withCasAds", {
  "adSolution": "choice",
  "useAdvertisingId": true,
  "adapters": [
    "googleAds",
    "unityAds",
    "appLovin",
    "mintegral",
    "ironSource"
  ]
}]
```

**What it generates:**

- **Android** `app/build.gradle`:
  ```groovy
  cas {
      adapters {
          googleAds = true
          unityAds = true
          appLovin = true
          mintegral = true
          ironSource = true
      }
      useAdvertisingId = true
  }
  ```
- **iOS** `Podfile`:
  ```ruby
  pod 'CASMediationGoogleAds'
  pod 'CASMediationUnityAds'
  pod 'CASMediationAppLovin'
  pod 'CASMediationMintegral'
  pod 'CASMediationIronSource'
  ```

**Pros:** Full control over app size, compliance, and network selection.
**Cons:** Requires knowledge of which networks suit your audience and region.

---

### Comparison Table

| Feature              | Optimal                    | Families               | Choice                  |
| -------------------- | -------------------------- | ---------------------- | ----------------------- |
| Network selection    | Automatic (broad)          | Automatic (child-safe) | Manual                  |
| COPPA compliant      | No                         | Yes                    | Depends on your picks   |
| Advertising ID       | Allowed                    | Prohibited             | Your choice             |
| App size impact      | Largest                    | Smaller                | You control             |
| Configuration effort | None                       | None                   | Per-adapter             |
| Best for             | General/mixed audience     | Kids-only apps         | Advanced publishers     |

---

## Available Adapters

Use these exact names in the `adapters` array when using `"adSolution": "choice"`.

Each adapter is added to **both** Android and iOS. The plugin automatically maps the adapter name to the correct Android Gradle config and iOS CocoaPods pod.

### Universal Adapters (COPPA-safe)

These networks monetize all users, including those under COPPA restrictions.

| Adapter Name       | Android Gradle Key   | iOS Pod                        | Notes                |
| ------------------ | -------------------- | ------------------------------ | -------------------- |
| `chartboost`       | `chartboost`         | `CASMediationChartboost`       |                      |
| `dtExchange`       | `dtExchange`         | `CASMediationDTExchange`       |                      |
| `googleAds`        | `googleAds`          | `CASMediationGoogleAds`        |                      |
| `inMobi`           | `inMobi`             | `CASMediationInMobi`           |                      |
| `ironSource`       | `ironSource`         | `CASMediationIronSource`       |                      |
| `kidoz`            | `kidoz`              | `CASMediationKidoz`            |                      |
| `liftoffMonetize`  | `liftoffMonetize`    | `CASMediationLiftoffMonetize`  |                      |
| `mintegral`        | `mintegral`          | `CASMediationMintegral`        |                      |
| `superAwesome`     | `superAwesome`       | `CASMediationSuperAwesome`     |                      |
| `unityAds`         | `unityAds`           | `CASMediationUnityAds`         |                      |

### COPPA-Restricted Adapters

These networks do **NOT** monetize users under COPPA restrictions. Do not use in child-directed apps.

| Adapter Name       | Android Gradle Key   | iOS Pod                        | Notes                       |
| ------------------ | -------------------- | ------------------------------ | --------------------------- |
| `appLovin`         | `appLovin`           | `CASMediationAppLovin`         |                             |
| `audienceNetwork`  | `audienceNetwork`    | `CASMediationAudienceNetwork`  | Meta; extra setup required  |
| `bigoAds`          | `bigoAds`            | `CASMediationBigo`             |                             |
| `casExchange`      | `casExchange`        | `CASMediationCASExchange`      |                             |
| `hyprMX`           | `hyprMX`             | `CASMediationHyprMX`           | USA/Canada only             |
| `maticoo`          | `maticoo`            | `CASMediationMaticoo`          |                             |
| `ogury`            | `ogury`              | `CASMediationOgury`            |                             |
| `pangle`           | `pangle`             | `CASMediationPangle`           |                             |
| `prado`            | `prado`              | `CASMediationPrado`            |                             |
| `smaato`           | `smaato`             | `CASMediationSmaato`           |                             |
| `startIO`          | `startIO`            | `CASMediationStartIO`          |                             |
| `verve`            | `verve`              | `CASMediationVerve`            |                             |
| `yangoAds`         | `yangoAds`           | `CASMediationYangoAds`         |                             |
| `ysoNetwork`       | `ysoNetwork`         | `CASMediationYsoNetwork`       |                             |

### Closed Beta Adapters

Requires approval from your CAS account manager before use.

| Adapter Name | Android Gradle Key | iOS Pod                | Notes            |
| ------------ | ------------------ | ---------------------- | ---------------- |
| `madex`      | `madex`            | `CASMediationMadex`    | CIS region only  |
| `pubmatic`   | `pubmatic`         | `CASMediationPubMatic` |                  |

### Cross-Promotion

For developers managing multiple app titles who want to cross-promote between them.

| Adapter Name | Android Gradle Key | iOS Pod                    |
| ------------ | ------------------ | -------------------------- |
| `crossPromo` | `crossPromo`       | `CASMediationCrossPromo`   |

---

## What the Plugin Modifies

During `npx expo prebuild`, the plugin automatically modifies the following native files:

### Android

#### 1. `android/settings.gradle`

Adds plugin repositories to `pluginManagement` so the CAS Gradle plugin can be resolved:

```groovy
pluginManagement {
  repositories {
    gradlePluginPortal()
    mavenCentral()
    google()
  }
  // ... existing Expo/RN config
}
```

#### 2. `android/build.gradle` (root)

Adds ad-network Maven repositories to `allprojects.repositories`:

```groovy
allprojects {
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
    // CAS Ad Network Repositories
    maven { url 'https://dl-maven-android.mintegral.com/repository/mbridge_android_sdk_oversea' }
    maven { url 'https://artifact.bytedance.com/repository/pangle' }
    maven { url 'https://cboost.jfrog.io/artifactory/chartboost-ads/' }
    maven { url 'https://ysonetwork.s3.eu-west-3.amazonaws.com/sdk/android' }
    maven { url 'https://maven.ogury.co' }
    maven { url 'https://aa-sdk.s3-eu-west-1.amazonaws.com/android_repo' }
    maven { url 'https://s3.amazonaws.com/smaato-sdk-releases/' }
    maven { url 'https://verve.jfrog.io/artifactory/verve-gradle-release' }
    maven { url 'https://repo.pubmatic.com/artifactory/public-repos' }
    maven { url 'https://sdkpkg.sspnet.tech' }
  }
}
```

#### 3. `android/app/build.gradle`

- Adds CAS Gradle plugin at the top:
  ```groovy
  plugins {
      id("com.cleveradssolutions.gradle-plugin") version "4.6.0"
  }
  ```
- Adds `cas {}` configuration block at the end (varies by `adSolution` mode).

### iOS

#### 1. `ios/Podfile`

- Adds CAS CocoaPods source repositories at the top:
  ```ruby
  source 'https://github.com/CocoaPods/Specs.git'
  source 'https://github.com/cleveradssolutions/CAS-Specs.git'
  ```
- Adds mediation pods inside the target block (bundled pod for optimal/families, or individual pods for choice).

#### 2. `ios/<AppName>/Info.plist`

Adds the App Tracking Transparency usage description (required by Apple for IDFA access):

```xml
<key>NSUserTrackingUsageDescription</key>
<string>Your data will remain confidential and will only be used to provide you a better and personalised ad experience.</string>
```

---

## Usage

### After prebuild, initialize CAS in your app:

```typescript
import { Platform } from 'react-native';
import CASMobileAds, {
  InitializationStatus,
  Audience,
  ConsentFlowStatus,
} from 'react-native-cas';

function initCAS() {
  const casId = Platform.select({
    ios: 'YOUR_CAS_ID_IOS',
    android: 'YOUR_CAS_ID_ANDROID',
  });

  CASMobileAds.initialize(casId, {
    showConsentFormIfRequired: true,
    targetAudience: Audience.NOT_CHILDREN,
    forceTestAds: __DEV__,
  }).then((status: InitializationStatus) => {
    if (status.error) {
      console.log(`CAS initialization failed: ${status.error}`);
    } else {
      console.log('CAS initialized successfully');
    }

    if (status.consentFlowStatus === ConsentFlowStatus.OBTAINED) {
      console.log('User consent obtained');
    }
  });
}
```

Use `"demo"` as the CAS ID for testing before registering your app.

---

## Troubleshooting

### Pod install fails or takes very long

The first `pod install` after adding CAS needs to clone the CAS-Specs repository. This can take several minutes. If it fails:

```bash
cd ios
pod install --repo-update
```

### Android build fails with "plugin not found"

Ensure `gradlePluginPortal()` is in `settings.gradle > pluginManagement > repositories`. Run `npx expo prebuild --clean` to regenerate.

### Duplicate CAS sources in Podfile

If you see duplicate `source` lines after multiple prebuilds, run `npx expo prebuild --clean` to regenerate fresh native files.

### Version mismatch

The CAS Gradle plugin version must match the `react-native-cas` package version. Both should be `4.6.0`. Update `CAS_VERSION` in `plugins/withCasAds.js` if you upgrade the npm package.

---

## References

- [CAS.AI React Native Docs](https://docs.page/cleveradssolutions/docs/ReactNative)
- [CAS.AI Android Mediated Networks](https://docs.page/cleveradssolutions/docs/Android/Mediated-Networks)
- [CAS.AI iOS Mediated Networks](https://docs.page/cleveradssolutions/docs/iOS/Mediated-Networks)
- [CAS.AI SDK Initialization](https://docs.page/cleveradssolutions/docs/ReactNative/Initialize-CAS)
- [Expo Config Plugins](https://docs.expo.dev/config-plugins/introduction/)
