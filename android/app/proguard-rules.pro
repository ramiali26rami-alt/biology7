# android/app/proguard-rules.pro
# ProGuard rules to ensure minification does not break Capacitor, Supabase, and CryptoJS.

# 1. Protect Capacitor framework reflection
-keep class com.getcapacitor.** { *; }
-keep class com.biotech.biology.** { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# 2. Protect Supabase & OkHttp networking
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**

# 3. Protect CryptoJS and encryption helpers
-keep class javax.crypto.** { *; }
-dontwarn javax.crypto.**
-keep class org.spongycastle.** { *; }
-dontwarn org.spongycastle.**

# 4. Protect MainActivity entry point name
-keepnames class com.biotech.biology.MainActivity
