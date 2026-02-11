const {
  withAppBuildGradle,
  withProjectBuildGradle,
  withSettingsGradle,
  withInfoPlist,
  withDangerousMod,
  withXcodeProject,
  createRunOncePlugin,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
// Uses withInfoPlist (Expo's managed base mod) so changes are applied in the
// final plist write and not overwritten. casconfig.rb (dangerous mod) runs
// first and adds SKAdNetworkItems to disk; the base mod reads those, then
// our callback adds the remaining keys. The ATS warning from casconfig.rb
// is harmless — this callback sets it correctly in the final output.
function withCasInfoPlist(config, props) {
  return withInfoPlist(config, (config) => {
    const plist = config.modResults;

    // NSUserTrackingUsageDescription (required for IDFA)
    if (!plist.NSUserTrackingUsageDescription) {
      plist.NSUserTrackingUsageDescription =
        props.trackingDescription ||
        'Your data will remain confidential and will only be used to provide you a better and personalised ad experience.';
    }

    // NSAppTransportSecurity - allow cleartext HTTP for ad networks
    if (!plist.NSAppTransportSecurity || !plist.NSAppTransportSecurity.NSAllowsArbitraryLoads) {
      plist.NSAppTransportSecurity = {
        ...(plist.NSAppTransportSecurity || {}),
        NSAllowsArbitraryLoads: true,
      };
    }

    // GADApplicationIdentifier - required when using Google Ads adapter
    const hasGoogleAds =
      props.adSolution === 'optimal' ||
      !props.adSolution ||
      (Array.isArray(props.adapters) && props.adapters.includes('googleAds'));
    if (hasGoogleAds && !plist.GADApplicationIdentifier) {
      // Test ID; casconfig.rb will set the real one from CAS config when using a real CAS ID
      plist.GADApplicationIdentifier = 'ca-app-pub-3940256099942544~1458002511';
      plist.GADDelayAppMeasurementInit = true;
    }

    return config;
  });
}

// ─── iOS: Xcode project build settings ─────────────────────────────────────
// Ensure OTHER_LDFLAGS contains -ObjC (required by CAS SDK)
// Note: Values in pbxproj can be quoted ("$(inherited)") or unquoted ($(inherited))
function withCasXcodeProject(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const targets = project.pbxNativeTargetSection();

    const hasFlag = (flags, flag) =>
      flags.some((f) => f === flag || f === `"${flag}"`);

    for (const key in targets) {
      const target = targets[key];
      if (typeof target !== 'object' || !target.buildConfigurationList) continue;

      const configList = project.pbxXCConfigurationList()[target.buildConfigurationList];
      if (!configList) continue;

      for (const buildConfig of configList.buildConfigurations) {
        const cfg = project.pbxXCBuildConfigurationSection()[buildConfig.value];
        if (!cfg || !cfg.buildSettings) continue;

        let flags = cfg.buildSettings.OTHER_LDFLAGS || [];
        if (typeof flags === 'string') flags = [flags];

        let modified = false;
        if (!hasFlag(flags, '$(inherited)')) {
          flags.unshift('"$(inherited)"');
          modified = true;
        }
        if (!hasFlag(flags, '-ObjC')) {
          flags.push('"-ObjC"');
          modified = true;
        }
        if (modified) {
          cfg.buildSettings.OTHER_LDFLAGS = flags;
        }
      }
    }

    return config;
  });
}

// ─── iOS: Run casconfig.rb ─────────────────────────────────────────────────
// Copy casconfig.rb from plugins/ to ios/ and run it with the CAS ID
// This fetches SKAdNetwork IDs, downloads cas_settings.json, and updates the Xcode project
function withCasConfigScript(config, props) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const casId = props.casId || 'demo';
      const iosDir = config.modRequest.platformProjectRoot;
      // eslint-disable-next-line no-undef -- Node.js CJS global
      const scriptSrc = path.join(__dirname, 'casconfig.rb');
      const scriptDst = path.join(iosDir, 'casconfig.rb');

      // Copy casconfig.rb from plugins/ to ios/
      if (!fs.existsSync(scriptSrc)) {
        console.warn('[CAS] casconfig.rb not found in plugins/ directory, skipping iOS config script');
        return config;
      }
      fs.copyFileSync(scriptSrc, scriptDst);

      // Build the command arguments
      const args = [casId];
      const hasGoogleAds =
        props.adSolution === 'optimal' ||
        !props.adSolution ||
        (Array.isArray(props.adapters) && props.adapters.includes('googleAds'));
      if (!hasGoogleAds) {
        args.push('--no-gad');
      }

      try {
        console.log(`[CAS] Running casconfig.rb with CAS ID: ${casId}`);
        execSync(`ruby casconfig.rb ${args.join(' ')}`, {
          cwd: iosDir,
          stdio: 'inherit',
        });
        console.log('[CAS] casconfig.rb completed successfully');
      } catch (error) {
        console.warn(`[CAS] casconfig.rb failed: ${error.message}`);
        console.warn('[CAS] Make sure the xcodeproj gem is installed: gem install xcodeproj');
        console.warn('[CAS] Continuing with plugin-only configuration...');
      }

      return config;
    },
  ]);
}

// ─── Main plugin ────────────────────────────────────────────────────────────
function withCasAds(config, props = {}) {
  // Android
  config = withCasSettingsGradle(config);
  config = withCasProjectBuildGradle(config);
  config = withCasAppBuildGradle(config, props);

  // iOS
  // Order matters: dangerous mods (Podfile, casconfig.rb) run first and write to disk.
  // Then base mods (InfoPlist, XcodeProject) read the updated files and apply final changes.
  config = withCasIosPodfile(config, props);
  config = withCasConfigScript(config, props);
  config = withCasInfoPlist(config, props);
  config = withCasXcodeProject(config);

  return config;
}

module.exports = createRunOncePlugin(withCasAds, 'withCasAds', CAS_VERSION);
