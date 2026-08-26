package com.biotech.biology;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final long MAX_APK_SIZE = 250L * 1024L * 1024L;

    @PluginMethod
    public void installUpdate(PluginCall call) {
        String downloadUrl = call.getString("url", "").trim();
        String expectedSha256 = call.getString("sha256", "").trim().toLowerCase(Locale.ROOT);

        if (!downloadUrl.startsWith("https://")) {
            call.reject("Only HTTPS update URLs are allowed", "INVALID_URL");
            return;
        }
        if (!expectedSha256.matches("^[a-f0-9]{64}$")) {
            call.reject("A valid SHA-256 checksum is required", "INVALID_CHECKSUM");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settingsIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName())
            );
            getActivity().startActivity(settingsIntent);
            JSObject result = new JSObject();
            result.put("permissionRequired", true);
            call.resolve(result);
            return;
        }

        new Thread(() -> downloadVerifyAndInstall(call, downloadUrl, expectedSha256)).start();
    }

    private void downloadVerifyAndInstall(PluginCall call, String downloadUrl, String expectedSha256) {
        File updateDirectory = new File(getContext().getCacheDir(), "app-updates");
        File apkFile = new File(updateDirectory, "biology7-update.apk");

        try {
            if (!updateDirectory.exists() && !updateDirectory.mkdirs()) {
                throw new IllegalStateException("Unable to prepare the update directory");
            }

            HttpURLConnection connection = (HttpURLConnection) new URL(downloadUrl).openConnection();
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(30_000);
            connection.setRequestProperty("User-Agent", "Biology7-Android-Updater");
            connection.setInstanceFollowRedirects(true);
            connection.connect();

            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) {
                throw new IllegalStateException("Update server returned HTTP " + responseCode);
            }
            if (!"https".equalsIgnoreCase(connection.getURL().getProtocol())) {
                throw new SecurityException("Update redirected to a non-HTTPS address");
            }

            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_APK_SIZE) {
                throw new SecurityException("Update package is too large");
            }

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long downloaded = 0;
            byte[] buffer = new byte[32 * 1024];
            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(apkFile, false)) {
                int read;
                while ((read = input.read(buffer)) != -1) {
                    downloaded += read;
                    if (downloaded > MAX_APK_SIZE) {
                        throw new SecurityException("Update package exceeded the size limit");
                    }
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    if (contentLength > 0) {
                        JSObject progress = new JSObject();
                        progress.put("percent", (int) Math.min(100, downloaded * 100 / contentLength));
                        notifyListeners("downloadProgress", progress);
                    }
                }
                output.flush();
            } finally {
                connection.disconnect();
            }

            String actualSha256 = toHex(digest.digest());
            if (!MessageDigest.isEqual(
                    actualSha256.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                    expectedSha256.getBytes(java.nio.charset.StandardCharsets.US_ASCII))) {
                throw new SecurityException("Downloaded APK checksum does not match");
            }

            verifyPackageIdentityAndVersion(apkFile);

            Uri contentUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apkFile
            );
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(contentUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

            getActivity().runOnUiThread(() -> {
                JSObject result = new JSObject();
                result.put("started", true);
                call.resolve(result);
                getContext().startActivity(installIntent);
            });
        } catch (Exception error) {
            if (apkFile.exists()) {
                //noinspection ResultOfMethodCallIgnored
                apkFile.delete();
            }
            call.reject("Update verification or installation failed", error.getClass().getSimpleName(), error);
        }
    }

    private void verifyPackageIdentityAndVersion(File apkFile) throws Exception {
        PackageManager packageManager = getContext().getPackageManager();
        int signatureFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES
                : PackageManager.GET_SIGNATURES;
        PackageInfo archive = packageManager.getPackageArchiveInfo(apkFile.getAbsolutePath(), signatureFlag);
        PackageInfo current = packageManager.getPackageInfo(getContext().getPackageName(), signatureFlag);

        if (archive == null || !getContext().getPackageName().equals(archive.packageName)) {
            throw new SecurityException("APK package name does not match this app");
        }
        if (getVersionCode(archive) <= getVersionCode(current)) {
            throw new SecurityException("APK version is not newer than the installed app");
        }
        if (!sameSigningCertificate(current, archive)) {
            throw new SecurityException("APK signing certificate does not match the installed app");
        }
    }

    private long getVersionCode(PackageInfo packageInfo) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return packageInfo.getLongVersionCode();
        }
        //noinspection deprecation
        return packageInfo.versionCode;
    }

    private boolean sameSigningCertificate(PackageInfo current, PackageInfo archive) {
        Signature[] currentSignatures;
        Signature[] archiveSignatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            currentSignatures = current.signingInfo == null ? null : current.signingInfo.getApkContentsSigners();
            archiveSignatures = archive.signingInfo == null ? null : archive.signingInfo.getApkContentsSigners();
        } else {
            //noinspection deprecation
            currentSignatures = current.signatures;
            //noinspection deprecation
            archiveSignatures = archive.signatures;
        }
        if (currentSignatures == null || archiveSignatures == null
                || currentSignatures.length != 1 || archiveSignatures.length != 1) {
            return false;
        }
        return MessageDigest.isEqual(currentSignatures[0].toByteArray(), archiveSignatures[0].toByteArray());
    }

    private String toHex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            result.append(String.format(Locale.ROOT, "%02x", value));
        }
        return result.toString();
    }
}
