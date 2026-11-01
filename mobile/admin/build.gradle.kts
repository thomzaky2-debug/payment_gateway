import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.nilepay.admin"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.nilepay.admin"
        minSdk = 26
        targetSdk = 36
        versionCode = 4
        versionName = "1.2.0"

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
            applicationIdSuffix = ".debug"
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

    testOptions { unitTests.isIncludeAndroidResources = true }

    buildFeatures {
        compose = true
        buildConfig = true
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

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
}

// Rebuild the admin-only website from the same sources used by the portal.
val bundleAdminPortal by tasks.registering(Exec::class) {
    val repository = rootProject.projectDir.parentFile
    workingDir(repository)
    commandLine("node", "scripts/build-admin-apk-ui.mjs")
    inputs.files(fileTree(File(repository, "src")), File(repository, "admin.html"),
        File(repository, "vite.admin.config.js"), File(repository, "scripts/build-admin-apk-ui.mjs"),
        File(repository, "package-lock.json"), fileTree(File(repository, "public/brand")))
    outputs.dir("src/main/assets/portal")
}
tasks.named("preBuild") { dependsOn(bundleAdminPortal) }
