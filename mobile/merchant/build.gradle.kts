import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.nilepay.merchant"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.nilepay.merchant"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "API_BASE_URL", "\"https://nilepay-api.runasp.net/\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            val keystoreFile = project.findProperty("NILEPAY_RELEASE_KEYSTORE_FILE") as? String
                ?: System.getenv("NILEPAY_RELEASE_KEYSTORE_FILE")
            val keystorePassword = project.findProperty("NILEPAY_RELEASE_KEYSTORE_PASSWORD") as? String
                ?: System.getenv("NILEPAY_RELEASE_KEYSTORE_PASSWORD")
            val keyAlias = project.findProperty("NILEPAY_RELEASE_KEY_ALIAS") as? String
                ?: System.getenv("NILEPAY_RELEASE_KEY_ALIAS")
            val keyPassword = project.findProperty("NILEPAY_RELEASE_KEY_PASSWORD") as? String
                ?: System.getenv("NILEPAY_RELEASE_KEY_PASSWORD")

            if (!keystoreFile.isNullOrBlank() && File(keystoreFile).exists()) {
                storeFile = File(keystoreFile)
                storePassword = keystorePassword
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
            } else {
                val debugKeystore = signingConfigs.getByName("debug")
                storeFile = debugKeystore.storeFile
                storePassword = debugKeystore.storePassword
                this.keyAlias = debugKeystore.keyAlias
                this.keyPassword = debugKeystore.keyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isDebuggable = true
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
        compose = true
        buildConfig = true
    }
}

val verifyReleaseSigning by tasks.registering {
    doLast {
        val requireProd = System.getenv("CI") == "true" || System.getenv("NILEPAY_REQUIRE_PROD_SIGNING") == "true"
        if (requireProd) {
            val signing = android.signingConfigs.getByName("release")
            check(signing.storeFile?.isFile == true && !signing.storePassword.isNullOrBlank() &&
                !signing.keyAlias.isNullOrBlank() && !signing.keyPassword.isNullOrBlank()) {
                "Production signing is required in CI. Set all four NILEPAY_RELEASE_KEYSTORE_FILE, NILEPAY_RELEASE_KEYSTORE_PASSWORD, NILEPAY_RELEASE_KEY_ALIAS and NILEPAY_RELEASE_KEY_PASSWORD values."
            }
        }
    }
}
tasks.configureEach {
    if (name == "validateSigningRelease" || name == "packageRelease" || name == "packageReleaseBundle") {
        dependsOn(verifyReleaseSigning)
    }
}

dependencies {
    implementation(project(":core"))
    implementation(project(":designsystem"))

    implementation(platform(libs.compose.bom))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    implementation(libs.okhttp)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)
    implementation(libs.work.runtime.ktx)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
}
