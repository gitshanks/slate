import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
}

// Release signing is read from android/keystore.properties, which is never
// committed (see docs/native-apps.md). Without it the release build still
// compiles, unsigned, so the build can be checked on any machine.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use(::load)
}

android {
    namespace = "space.s1ate.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "space.s1ate.app"
        minSdk = 23
        targetSdk = 37
        // Every upload to Play or Firebase needs a higher code: -PSLATE_VERSION_CODE=3
        versionCode = providers.gradleProperty("SLATE_VERSION_CODE").orNull?.toInt() ?: 2
        versionName = "0.2.0"

        buildConfigField("String", "SLATE_API_BASE_URL", "\"https://www.s1ate.space/api/v1/\"")
        val googleServerClientId = providers.gradleProperty("SLATE_GOOGLE_SERVER_CLIENT_ID")
            .orElse("")
            .get()
        buildConfigField("String", "GOOGLE_SERVER_CLIENT_ID", "\"$googleServerClientId\"")
    }

    signingConfigs {
        if (keystoreProperties.isNotEmpty()) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Not shrunk yet: the first tester builds favour matching the
            // debug app exactly over a smaller download.
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // java.time on Android 6 and 7 (the Library's "out Tue" labels).
        isCoreLibraryDesugaringEnabled = true
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            all {
                it.systemProperty("robolectric.pixelCopyRenderMode", "hardware")
                // Always write the PNGs; nothing is compared against a baseline.
                it.systemProperty("roborazzi.test.record", "true")
            }
        }
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.06.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")

    implementation("androidx.credentials:credentials:1.6.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.6.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.2.0")

    implementation("androidx.room:room-runtime:2.8.4")
    implementation("androidx.room:room-ktx:2.8.4")
    ksp("androidx.room:room-compiler:2.8.4")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")
    implementation("io.coil-kt.coil3:coil-compose:3.5.0")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.5.0")

    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    testImplementation(composeBom)
    testImplementation("junit:junit:4.13.2")
    testImplementation("androidx.compose.ui:ui-test-junit4")
    // Screens rendered to PNG on the JVM, so layout can be checked at phone
    // sizes without an emulator: ./gradlew :app:testDebugUnitTest
    testImplementation("org.robolectric:robolectric:4.18.1")
    testImplementation("io.github.takahirom.roborazzi:roborazzi:1.79.0")
    testImplementation("io.github.takahirom.roborazzi:roborazzi-compose:1.79.0")
    testImplementation("io.coil-kt.coil3:coil-test:3.5.0")
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}
