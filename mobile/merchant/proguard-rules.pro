# Keep Kotlinx Serialization
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keepclassmembers class * {
    *** Companion;
}
-keepclasseswithmembers class * {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep Hilt generated classes
-keep class * extends android.app.Application
-keep class * extends android.app.Activity
-keep class * extends androidx.fragment.app.Fragment

# Keep Room generated implementations
-keep class * extends androidx.room.RoomDatabase

# Keep Compose view models
-keepclassmembers class * extends androidx.lifecycle.ViewModel {
    <init>(...);
}
