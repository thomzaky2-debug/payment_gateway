plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val gatewayBaseUrl = providers.gradleProperty("GATEWAY_BASE_URL").orNull
val releaseRequested = gradle.startParameter.taskNames.any { it.contains("release", ignoreCase = true) }

if (releaseRequested && (gatewayBaseUrl == null || !gatewayBaseUrl.startsWith("https://"))) {
    throw org.gradle.api.GradleException("Release builds require -PGATEWAY_BASE_URL=https://your-gateway.example")
}

android {
    namespace = "com.instapaydetector.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.instapaydetector.app"
        // Android 8.0 (API 26) — matches the "Android 8+" requirement.
        minSdk = 26
        targetSdk = 34
        versionCode = 9
        versionName = "2.2.5"
        resValue("string", "app_name", "InstaPay Detector")
        buildConfigField("String", "GATEWAY_BASE_URL", "\"${gatewayBaseUrl ?: "https://gateway.example.invalid"}\"")
    }

    val releaseStoreFile = providers.gradleProperty("RELEASE_STORE_FILE").orNull
    val releaseStorePassword = providers.gradleProperty("RELEASE_STORE_PASSWORD").orNull
    val releaseKeyAlias = providers.gradleProperty("RELEASE_KEY_ALIAS").orNull
    val releaseKeyPassword = providers.gradleProperty("RELEASE_KEY_PASSWORD").orNull
    val releaseSigning = if (
        releaseStoreFile != null && releaseStorePassword != null &&
        releaseKeyAlias != null && releaseKeyPassword != null
    ) {
        signingConfigs.create("release") {
            storeFile = file(releaseStoreFile)
            storePassword = releaseStorePassword
            keyAlias = releaseKeyAlias
            keyPassword = releaseKeyPassword
        }
    } else null

    if (releaseRequested && releaseSigning == null) {
        throw org.gradle.api.GradleException("Release builds require all RELEASE_* signing properties")
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            buildConfigField("String", "GATEWAY_BASE_URL", "\"http://10.0.2.2:3001\"")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = releaseSigning
        }
    }



    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    // AndroidX core
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.cardview:cardview:1.0.0")

    // RecyclerView for efficient transaction lists
    implementation("androidx.recyclerview:recyclerview:1.3.2")

    // Fragment (for Fragment superclass in fragments)
    implementation("androidx.fragment:fragment-ktx:1.8.2")

    // SwipeRefreshLayout for pull-to-refresh
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")

    // Lifecycle ViewModel + LiveData for the dashboard
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.8.4")

    // MPAndroidChart for revenue charts
    implementation("com.github.PhilJay:MPAndroidChart:v3.1.0")

    // OkHttp for HTTP + WebSocket
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // JSON parsing
    implementation("org.json:json:20240303")
}
