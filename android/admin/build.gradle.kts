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
    namespace = "com.instapaydetector.admin"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.instapaydetector.admin"
        minSdk = 26
        targetSdk = 34
        versionCode = 3
        versionName = "1.2.0-admin-portal-parity"
        resValue("string", "app_name", "InstaPay Admin")
        buildConfigField(
            "String",
            "GATEWAY_BASE_URL",
            "\"${gatewayBaseUrl ?: "https://gateway.example.invalid"}\""
        )
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
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.viewpager2:viewpager2:1.1.0")
    implementation("androidx.fragment:fragment-ktx:1.8.2")
    
    // OkHttp for connection check
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    
    // Coroutines for background verification
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // Security
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
}
