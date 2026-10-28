# WireGuard: GoBackend has JNI entry points and the native library looks up
# classes by name.
-keep class com.wireguard.android.backend.** { *; }
-keep class com.wireguard.crypto.** { *; }
-keep class com.wireguard.config.** { *; }

# Flutter Play Store deferred components are not used.
-dontwarn com.google.android.play.core.**
