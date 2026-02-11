const {
  withAppBuildGradle,
  withProjectBuildGradle,
  withSettingsGradle,
  withInfoPlist,
  withDangerousMod,
  createRunOncePlugin,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CAS_VERSION = '4.6.0';

// ─── Adapter name → iOS pod name mapping ────────────────────────────────────
const ADAPTER_TO_IOS_POD = {
  appLovin: 'CASMediationAppLovin',
  audienceNetwork: 'CASMediationAudienceNetwork',
  bigoAds: 'CASMediationBigo',
  casExchange: 'CASMediationCASExchange',
  chartboost: 'CASMediationChartboost',
  crossPromo: 'CASMediationCrossPromo',
  dtExchange: 'CASMediationDTExchange',
  googleAds: 'CASMediationGoogleAds',
  hyprMX: 'CASMediationHyprMX',
  inMobi: 'CASMediationInMobi',
  ironSource: 'CASMediationIronSource',
  kidoz: 'CASMediationKidoz',
  liftoffMonetize: 'CASMediationLiftoffMonetize',
  madex: 'CASMediationMadex',
  maticoo: 'CASMediationMaticoo',
  mintegral: 'CASMediationMintegral',
  ogury: 'CASMediationOgury',
  pangle: 'CASMediationPangle',
  prado: 'CASMediationPrado',
  pubmatic: 'CASMediationPubMatic',
  smaato: 'CASMediationSmaato',
  startIO: 'CASMediationStartIO',
  superAwesome: 'CASMediationSuperAwesome',
  unityAds: 'CASMediationUnityAds',
  verve: 'CASMediationVerve',
  yangoAds: 'CASMediationYangoAds',
  ysoNetwork: 'CASMediationYsoNetwork',
};

// ─── Android: settings.gradle ───────────────────────────────────────────────
// Add gradlePluginPortal() so the CAS gradle plugin can be resolved
function withCasSettingsGradle(config) {
  return withSettingsGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes('gradlePluginPortal()')) return config;

    // Insert repositories block inside pluginManagement
    contents = contents.replace(
      /pluginManagement\s*\{/,
      `pluginManagement {\n  repositories {\n    gradlePluginPortal()\n    mavenCentral()\n    google()\n  }`
    );

    config.modResults.contents = contents;
    return config;
  });
}

// ─── Android: root build.gradle ─────────────────────────────────────────────
// Add ad-network Maven repositories to allprojects.repositories
function withCasProjectBuildGradle(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes('CAS Ad Network Repositories')) return config;

    const casRepos = [
      `    // CAS Ad Network Repositories`,
      `    maven { url 'https://dl-maven-android.mintegral.com/repository/mbridge_android_sdk_oversea' }`,
      `    maven { url 'https://artifact.bytedance.com/repository/pangle' }`,
      `    maven { url 'https://cboost.jfrog.io/artifactory/chartboost-ads/' }`,
      `    maven { url 'https://ysonetwork.s3.eu-west-3.amazonaws.com/sdk/android' }`,
      `    maven { url 'https://maven.ogury.co' }`,
      `    maven { url 'https://aa-sdk.s3-eu-west-1.amazonaws.com/android_repo' }`,
      `    maven { url 'https://s3.amazonaws.com/smaato-sdk-releases/' }`,
      `    maven { url 'https://verve.jfrog.io/artifactory/verve-gradle-release' }`,
      `    maven { url 'https://repo.pubmatic.com/artifactory/public-repos' }`,
      `    maven { url 'https://sdkpkg.sspnet.tech' }`,
    ].join('\n');

    // Insert after the jitpack line inside allprojects > repositories
    if (contents.includes('jitpack.io')) {
      contents = contents.replace(
        /maven\s*\{\s*url\s*'https:\/\/www\.jitpack\.io'\s*\}/,
        (match) => `${match}\n${casRepos}`
      );
    } else {
      // Fallback: add inside allprojects > repositories after mavenCentral()
      contents = contents.replace(
        /(allprojects\s*\{[\s\S]*?repositories\s*\{[\s\S]*?mavenCentral\(\))/,
        (match) => `${match}\n${casRepos}`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

// ─── Android: app/build.gradle ──────────────────────────────────────────────
// 1. Replace apply plugin: lines with plugins {} block (CAS must come AFTER com.android.application)
// 2. Add cas {} configuration block (optimal, families, or choice adapters)
function withCasAppBuildGradle(config, props) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // 1. Replace the three apply plugin: lines with a single plugins {} block
    //    CAS plugin MUST come after com.android.application (it needs the 'implementation' configuration)
    if (!contents.includes('com.cleveradssolutions.gradle-plugin')) {
      contents = contents.replace(
        /apply plugin: "com\.android\.application"\napply plugin: "org\.jetbrains\.kotlin\.android"\napply plugin: "com\.facebook\.react"/,
        [
          'plugins {',
          '    id("com.android.application")',
          '    id("org.jetbrains.kotlin.android")',
          '    id("com.facebook.react")',
          `    id("com.cleveradssolutions.gradle-plugin") version "${CAS_VERSION}"`,
          '}',
        ].join('\n')
      );
    }

    // 2. Add cas {} configuration block at the end
    if (!contents.includes('cas {')) {
      const useAdvertisingId =
        props.adSolution === 'families' ? false : props.useAdvertisingId !== false;

      const casLines = ['', '// CAS Ads configuration', 'cas {'];

      if (props.adSolution === 'choice' && Array.isArray(props.adapters) && props.adapters.length) {
        // Choice networks: list individual adapters
        casLines.push('    adapters {');
        for (const adapter of props.adapters) {
          casLines.push(`        ${adapter} = true`);
        }
        casLines.push('    }');
      } else if (props.adSolution === 'families') {
        casLines.push('    includeFamiliesAds = true');
      } else {
        // Default: optimal
        casLines.push('    includeOptimalAds = true');
      }

      casLines.push(`    useAdvertisingId = ${useAdvertisingId}`);
      casLines.push('}');
      casLines.push('');

      contents = contents + casLines.join('\n');
    }

    config.modResults.contents = contents;
    return config;
  });
}

// ─── iOS: Podfile ───────────────────────────────────────────────────────────
// 1. Add CAS CocoaPods source repos
// 2. Add CAS mediation pods (bundled or individual choice adapters)
function withCasIosPodfile(config, props) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // 1. Add CAS source repos at the top of Podfile
      if (!contents.includes('CAS-Specs.git')) {
        const sources = [
          "source 'https://github.com/CocoaPods/Specs.git'",
          "source 'https://github.com/cleveradssolutions/CAS-Specs.git'",
          '',
        ].join('\n');
        contents = sources + contents;
      }

      // 2. Add CAS mediation pods in the target block
      if (!contents.includes('CAS Ads Mediation')) {
        let podLines;

        if (
          props.adSolution === 'choice' &&
          Array.isArray(props.adapters) &&
          props.adapters.length
        ) {
          // Choice networks: add individual mediation pods
          podLines = ['  # CAS Ads Mediation (Choice networks)'];
          for (const adapter of props.adapters) {
            const podName = ADAPTER_TO_IOS_POD[adapter];
            if (podName) {
              podLines.push(`  pod '${podName}'`);
            }
          }
        } else if (props.adSolution === 'families') {
          podLines = [
            '  # CAS Ads Mediation',
            `  pod 'CleverAdsSolutions-SDK/Families', '${CAS_VERSION}'`,
          ];
        } else {
          // Default: optimal
          podLines = [
            '  # CAS Ads Mediation',
            `  pod 'CleverAdsSolutions-SDK/Optimal', '${CAS_VERSION}'`,
          ];
        }

        contents = contents.replace(
          /use_expo_modules!/,
          (match) => `${match}\n\n${podLines.join('\n')}`
        );
      }

      fs.writeFileSync(podfilePath, contents, 'utf-8');
      return config;
    },
  ]);
}

// ─── iOS: Info.plist ────────────────────────────────────────────────────────
// Add App Tracking Transparency usage description (required for IDFA)
function withCasInfoPlist(config, props) {
  return withInfoPlist(config, (config) => {
    if (!config.modResults.NSUserTrackingUsageDescription) {
      config.modResults.NSUserTrackingUsageDescription =
        props.trackingDescription ||
        'Your data will remain confidential and will only be used to provide you a better and personalised ad experience.';
    }
    config.modResults.SKAdNetworkItems = config.modResults.SKAdNetworkItems || [];
    return config;
  });
}

// ─── Main plugin ────────────────────────────────────────────────────────────
function withCasAds(config, props = {}) {
  // Android
  config = withCasSettingsGradle(config);
  config = withCasProjectBuildGradle(config);
  config = withCasAppBuildGradle(config, props);

  // iOS
  config = withCasIosPodfile(config, props);
  config = withCasInfoPlist(config, props);

  return config;
}

module.exports = createRunOncePlugin(withCasAds, 'withCasAds', CAS_VERSION);
