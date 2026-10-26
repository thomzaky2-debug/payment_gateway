# Keep Kotlinx Serialization annotations and generated serializers
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keepclassmembers class * {
    *** Companion;
}
-keepclasseswithmembers class * {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep Keystore and Crypto classes
-keep class com.nilepay.core.security.** { *; }

# Keep models
-keep class com.nilepay.core.model.** { *; }
