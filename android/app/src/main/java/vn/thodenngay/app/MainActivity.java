package vn.thodenngay.app;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ServiceWorkerController;
import android.webkit.ServiceWorkerWebSettings;
import android.webkit.URLUtil;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.Bridge;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONTokener;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String HOME_URL = "https://thodenngay.vn";
    private static final String ANDROID_START_URL = "https://thodenngay.vn/login?app=android";
    private static final String WORKER_START_URL = "https://thodenngay.vn/worker";
    private static final String APP_HOST = "thodenngay.vn";
    private static final String PDF_MIME_TYPE = "application/pdf";
    private static final String OFFLINE_PREFS = "tdn_android_offline_shell";
    private static final String KEY_LAST_URL = "last_success_url";
    private static final String KEY_LAST_HTML = "last_success_html";
    private static final String KEY_ANDROID_BUILD = "android_build_fingerprint";
    private static final String KEY_WEB_DEPLOY_VERSION = "web_deploy_version";
    private static final String DEPLOY_VERSION_URL = HOME_URL + "/api/app-version";
    private static final int MAX_SNAPSHOT_CHARS = 2_500_000;
    private static final int STARTUP_TIMEOUT_MS = 3_000;
    private static final int STARTUP_RECOVERY_TIMEOUT_MS = 8_000;
    private static final int VERSION_CHECK_TIMEOUT_MS = 3_000;

    private FrameLayout rootView;
    private LinearLayout errorView;
    private FrameLayout startupSplashView;
    private WebView webView;
    private SharedPreferences offlinePrefs;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean loadingOfflineFallback = false;
    private boolean startupRecoveryAttempted = false;
    private int freshReloadSequence = 0;
    private String lastMainFrameErrorUrl;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        offlinePrefs = getSharedPreferences(OFFLINE_PREFS, Context.MODE_PRIVATE);
        registerBackHandler();
    }

    @Override
    protected void load() {
        if (offlinePrefs == null) {
            offlinePrefs = getSharedPreferences(OFFLINE_PREFS, Context.MODE_PRIVATE);
        }
        super.load();
        configureWebView();
        createNetworkErrorView();
        createStartupSplashView();
        invalidateCacheAfterAndroidUpdate();
        checkRemoteDeployVersion();
        scheduleStartupWatchdog();
        if (!hasNetworkConnection()) {
            webView.postDelayed(() -> loadOfflineStartup(null), 250);
        }
    }

    private void configureWebView() {
        webView = bridge.getWebView();
        WebSettings settings = webView.getSettings();

        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setTextZoom(100);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        webView.setInitialScale(100);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(true);
        settings.setCacheMode(hasNetworkConnection() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            ServiceWorkerWebSettings swSettings = ServiceWorkerController.getInstance().getServiceWorkerWebSettings();
            swSettings.setAllowContentAccess(true);
            swSettings.setAllowFileAccess(false);
            swSettings.setCacheMode(hasNetworkConnection() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            settings.setOffscreenPreRaster(true);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        bridge.setWebViewClient(new ThoDenNgayWebViewClient(bridge));
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> downloadFile(
            url,
            userAgent,
            contentDisposition,
            mimeType
        ));
    }

    private void registerBackHandler() {
        getOnBackPressedDispatcher()
            .addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        if (webView != null && webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            finish();
                        }
                    }
                }
            );
    }

    private void createNetworkErrorView() {
        View content = findViewById(android.R.id.content);
        if (!(content instanceof FrameLayout)) {
            return;
        }

        rootView = (FrameLayout) content;
        errorView = new LinearLayout(this);
        errorView.setOrientation(LinearLayout.VERTICAL);
        errorView.setGravity(Gravity.CENTER);
        errorView.setPadding(48, 48, 48, 48);
        errorView.setBackgroundColor(0xFFFFFFFF);
        errorView.setVisibility(View.GONE);

        TextView title = new TextView(this);
        title.setText(getString(R.string.network_error_title));
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER);
        title.setTextColor(0xFF123047);

        TextView message = new TextView(this);
        message.setText(getString(R.string.network_error_message));
        message.setTextSize(15);
        message.setGravity(Gravity.CENTER);
        message.setTextColor(0xFF476173);
        message.setPadding(0, 16, 0, 24);

        Button retry = new Button(this);
        retry.setText(getString(R.string.network_error_retry));
        retry.setOnClickListener(v -> {
            hideNetworkError();
            loadingOfflineFallback = false;
            configureCacheModeForNetwork();
            webView.loadUrl(ANDROID_START_URL);
        });

        errorView.addView(title);
        errorView.addView(message);
        errorView.addView(retry);
        rootView.addView(
            errorView,
            new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        );
    }

    private void createStartupSplashView() {
        if (rootView == null) {
            return;
        }

        startupSplashView = new FrameLayout(this);
        startupSplashView.setBackgroundColor(0xFFFFFFFF);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        content.setPadding(dp(32), dp(32), dp(32), dp(32));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        logo.setAdjustViewBounds(true);
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(112), dp(112));
        logoParams.setMargins(0, 0, 0, dp(18));

        TextView appName = new TextView(this);
        appName.setText(getString(R.string.app_name));
        appName.setTextColor(0xFF123047);
        appName.setTextSize(24);
        appName.setGravity(Gravity.CENTER);
        appName.setTypeface(appName.getTypeface(), android.graphics.Typeface.BOLD);

        TextView version = new TextView(this);
        version.setText(getStartupVersionLabel());
        version.setTextColor(0xFF476173);
        version.setTextSize(14);
        version.setGravity(Gravity.CENTER);
        version.setPadding(0, dp(6), 0, dp(22));

        TextView status = new TextView(this);
        status.setText(getString(R.string.startup_status));
        status.setTextColor(0xFF1F648D);
        status.setTextSize(13);
        status.setGravity(Gravity.CENTER);

        content.addView(logo, logoParams);
        content.addView(appName);
        content.addView(version);
        content.addView(status);

        startupSplashView.addView(
            content,
            new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        );
        rootView.addView(
            startupSplashView,
            new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        );
    }

    private void showNetworkError() {
        hideStartupSplash();
        if (errorView != null) {
            errorView.setVisibility(View.VISIBLE);
        }
    }

    private void hideNetworkError() {
        if (errorView != null) {
            errorView.setVisibility(View.GONE);
        }
    }

    private void hideStartupSplash() {
        if (startupSplashView != null) {
            startupSplashView.setVisibility(View.GONE);
        }
    }

    private boolean isStartupSplashVisible() {
        return startupSplashView != null && startupSplashView.getVisibility() == View.VISIBLE;
    }

    private String getStartupVersionLabel() {
        try {
            String versionName = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            if (versionName != null && versionName.trim().length() > 0) {
                return "v" + versionName.trim();
            }
        } catch (Exception ignored) {
            // Fall through to the resource fallback.
        }
        return getString(R.string.startup_version_fallback);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private boolean hasNetworkConnection() {
        ConnectivityManager connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network network = connectivityManager.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(network);
            return capabilities != null && (
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                    || capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
                    || capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                    || capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
            );
        }

        NetworkInfo networkInfo = connectivityManager.getActiveNetworkInfo();
        return networkInfo != null && networkInfo.isConnected();
    }

    private void configureCacheModeForNetwork() {
        int cacheMode = hasNetworkConnection() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK;
        if (webView != null) {
            webView.getSettings().setCacheMode(cacheMode);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            ServiceWorkerController.getInstance().getServiceWorkerWebSettings().setCacheMode(cacheMode);
        }
    }


    private String getAndroidBuildFingerprint() {
        try {
            String versionName = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode()
                : getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
            return versionName + ":" + versionCode;
        } catch (Exception error) {
            return "unknown";
        }
    }

    private void invalidateCacheAfterAndroidUpdate() {
        String nextFingerprint = getAndroidBuildFingerprint();
        String currentFingerprint = offlinePrefs.getString(KEY_ANDROID_BUILD, null);
        if (nextFingerprint.equals(currentFingerprint)) return;

        offlinePrefs.edit().putString(KEY_ANDROID_BUILD, nextFingerprint).apply();
        if (currentFingerprint == null) return;

        if (hasNetworkConnection()) {
            reloadFreshAfterCacheInvalidation("android-version-change");
        } else if (webView != null) {
            webView.clearCache(false);
        }
    }

    private void checkRemoteDeployVersion() {
        if (!hasNetworkConnection()) return;

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(DEPLOY_VERSION_URL + "?android=1&t=" + System.currentTimeMillis());
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(VERSION_CHECK_TIMEOUT_MS);
                connection.setReadTimeout(VERSION_CHECK_TIMEOUT_MS);
                connection.setUseCaches(false);
                connection.setRequestProperty("Cache-Control", "no-cache");
                connection.setRequestProperty("Pragma", "no-cache");
                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return;

                StringBuilder body = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        body.append(line);
                    }
                }

                JSONObject payload = new JSONObject(body.toString());
                String nextVersion = payload.optString("version", "").trim();
                if (nextVersion.length() == 0) return;

                String currentVersion = offlinePrefs.getString(KEY_WEB_DEPLOY_VERSION, null);
                offlinePrefs.edit().putString(KEY_WEB_DEPLOY_VERSION, nextVersion).apply();
                if (currentVersion != null && !nextVersion.equals(currentVersion)) {
                    mainHandler.post(() -> reloadFreshAfterCacheInvalidation("deploy-version-change"));
                }
            } catch (Exception ignored) {
                // Startup must never depend on the version endpoint.
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }).start();
    }

    private void scheduleStartupWatchdog() {
        mainHandler.postDelayed(() -> {
            if (!isStartupSplashVisible() || webView == null || startupRecoveryAttempted) return;
            startupRecoveryAttempted = true;
            if (hasNetworkConnection()) {
                reloadFreshAfterCacheInvalidation("startup-timeout");
                mainHandler.postDelayed(() -> {
                    if (isStartupSplashVisible() && !loadCachedHtmlSnapshot(lastMainFrameErrorUrl)) {
                        showNetworkError();
                    }
                }, STARTUP_RECOVERY_TIMEOUT_MS);
                return;
            }
            loadOfflineStartup(lastMainFrameErrorUrl);
        }, STARTUP_TIMEOUT_MS);
    }

    private String escapeJavascriptString(String value) {
        return value.replace("\\", "\\\\").replace("'", "\\'");
    }

    private void loadFreshStartUrl(String reason) {
        if (webView == null) return;
        loadingOfflineFallback = false;
        hideNetworkError();
        configureCacheModeForNetwork();
        webView.stopLoading();
        webView.clearCache(true);
        String refreshUrl = Uri.parse(ANDROID_START_URL)
            .buildUpon()
            .appendQueryParameter("nativeRefresh", reason)
            .appendQueryParameter("t", String.valueOf(System.currentTimeMillis()))
            .build()
            .toString();
        webView.loadUrl(refreshUrl);
    }

    private void reloadFreshAfterCacheInvalidation(String reason) {
        if (webView == null) return;

        int reloadSequence = ++freshReloadSequence;
        String escapedReason = escapeJavascriptString(reason);
        String cleanupScript = "(async function(){try{"
            + "if('serviceWorker' in navigator){var regs=await navigator.serviceWorker.getRegistrations();"
            + "await Promise.all(regs.filter(function(r){return r.scope.indexOf(location.origin)===0}).map(function(r){return r.unregister()}));}"
            + "if('caches' in window){var keys=await caches.keys();"
            + "await Promise.all(keys.filter(function(k){return k.indexOf('tdn-')===0}).map(function(k){return caches.delete(k)}));}"
            + "try{sessionStorage.setItem('tdn.nativeRefresh.cleaned.v1','" + escapedReason + "')}catch(e){}"
            + "return 'ok'}catch(error){return 'error:'+String(error&&error.message||error)}})();";

        try {
            webView.evaluateJavascript(cleanupScript, value -> {
                if (reloadSequence != freshReloadSequence) return;
                freshReloadSequence++;
                loadFreshStartUrl(reason);
            });
        } catch (Exception error) {
            loadFreshStartUrl(reason);
            return;
        }

        mainHandler.postDelayed(() -> {
            if (reloadSequence != freshReloadSequence) return;
            freshReloadSequence++;
            loadFreshStartUrl(reason);
        }, 1_200);
    }

    private void inspectWebRuntimeState(WebView view) {
        if (view == null) return;
        view.evaluateJavascript(
            "(async function(){try{var cacheKeys=(self.caches&&await caches.keys())||[];var regs=(navigator.serviceWorker&&await navigator.serviceWorker.getRegistrations())||[];return JSON.stringify({cacheKeys:cacheKeys,serviceWorkerScopes:regs.map(function(r){return r.scope}),controller:!!navigator.serviceWorker.controller});}catch(error){return JSON.stringify({error:String(error&&error.message||error)})}})();",
            value -> {
                try {
                    Object parsed = new JSONTokener(value).nextValue();
                    if (parsed instanceof String) {
                        System.out.println("[TDN-STARTUP] Web runtime state " + parsed);
                    }
                } catch (Exception ignored) {
                    // Runtime inspection is diagnostic only.
                }
            }
        );
    }
    private boolean isRemoteAppUrl(String url) {
        try {
            Uri uri = Uri.parse(url);
            return ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) && APP_HOST.equalsIgnoreCase(uri.getHost());
        } catch (Exception error) {
            return false;
        }
    }

    private String getFallbackUrl(String failedUrl) {
        String storedUrl = offlinePrefs.getString(KEY_LAST_URL, null);
        if (isRemoteAppUrl(storedUrl) && !isAndroidLoginUrl(storedUrl)) return storedUrl;
        if (isRemoteAppUrl(failedUrl) && !isAndroidLoginUrl(failedUrl)) return failedUrl;
        if (isAndroidLoginUrl(failedUrl)) return WORKER_START_URL;
        return ANDROID_START_URL;
    }

    private boolean isAndroidLoginUrl(String url) {
        try {
            Uri uri = Uri.parse(url);
            return APP_HOST.equalsIgnoreCase(uri.getHost())
                && "/login".equals(uri.getPath())
                && "android".equals(uri.getQueryParameter("app"));
        } catch (Exception error) {
            return false;
        }
    }

    private void rememberSuccessfulShell(WebView view, String url) {
        if (!hasNetworkConnection() || !isRemoteAppUrl(url)) return;
        String cacheUrl = isAndroidLoginUrl(url) ? WORKER_START_URL : url;
        offlinePrefs.edit().putString(KEY_LAST_URL, cacheUrl).apply();
        view.evaluateJavascript(
            "(function(){try{return document.documentElement.outerHTML}catch(error){return ''}})();",
            value -> {
                try {
                    Object parsed = new JSONTokener(value).nextValue();
                    if (!(parsed instanceof String)) return;
                    String html = (String) parsed;
                    if (html.length() < 500 || !html.contains("__next")) return;
                    if (html.length() > MAX_SNAPSHOT_CHARS) return;
                    offlinePrefs.edit()
                        .putString(KEY_LAST_URL, cacheUrl)
                        .putString(KEY_LAST_HTML, html)
                        .apply();
                } catch (Exception ignored) {
                    // Keep the previous Android offline shell snapshot.
                }
            }
        );
    }

    private boolean loadCachedHtmlSnapshot(String failedUrl) {
        String html = offlinePrefs.getString(KEY_LAST_HTML, null);
        if (html == null || html.length() < 500) return false;

        String baseUrl = getFallbackUrl(failedUrl);
        loadingOfflineFallback = true;
        hideNetworkError();
        configureCacheModeForNetwork();
        webView.stopLoading();
        webView.loadDataWithBaseURL(baseUrl, html, "text/html", "UTF-8", baseUrl);
        return true;
    }

    private void loadOfflineStartup(String failedUrl) {
        String fallbackUrl = getFallbackUrl(failedUrl);
        if (!hasNetworkConnection() && isAndroidLoginUrl(fallbackUrl)) {
            fallbackUrl = WORKER_START_URL;
        }
        loadingOfflineFallback = true;
        hideNetworkError();
        configureCacheModeForNetwork();

        if (!hasNetworkConnection() && loadCachedHtmlSnapshot(fallbackUrl)) {
            return;
        }

        try {
            webView.stopLoading();
            webView.loadUrl(fallbackUrl);
        } catch (Exception error) {
            if (!loadCachedHtmlSnapshot(fallbackUrl)) {
                showNetworkError();
            }
        }
    }

    private boolean isLikelyNetworkError(int errorCode) {
        return errorCode == WebViewClient.ERROR_HOST_LOOKUP
            || errorCode == WebViewClient.ERROR_CONNECT
            || errorCode == WebViewClient.ERROR_TIMEOUT
            || errorCode == WebViewClient.ERROR_IO
            || errorCode == WebViewClient.ERROR_UNKNOWN;
    }

    private void handleMainFrameLoadError(String failedUrl, int errorCode) {
        if (isLikelyNetworkError(errorCode)) {
            if (!loadingOfflineFallback) {
                loadOfflineStartup(failedUrl);
                return;
            }
            if (loadCachedHtmlSnapshot(failedUrl)) {
                return;
            }
        }
        showNetworkError();
    }

    private void downloadFile(String url, String userAgent, String contentDisposition, String mimeType) {
        try {
            Uri uri = Uri.parse(url);
            DownloadManager.Request request = new DownloadManager.Request(uri);
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            String cookies = CookieManager.getInstance().getCookie(url);

            request.setMimeType(mimeType);
            request.addRequestHeader("User-Agent", userAgent);
            if (cookies != null) {
                request.addRequestHeader("Cookie", cookies);
            }
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            manager.enqueue(request);
            Toast.makeText(this, getString(R.string.download_started), Toast.LENGTH_SHORT).show();
        } catch (Exception error) {
            Toast.makeText(this, getString(R.string.download_failed), Toast.LENGTH_LONG).show();
        }
    }

    private boolean openExternal(Uri uri, String mimeType) {
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        if (mimeType != null) {
            intent.setDataAndType(uri, mimeType);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            startActivity(intent);
            return true;
        } catch (ActivityNotFoundException error) {
            return false;
        }
    }

    private class ThoDenNgayWebViewClient extends BridgeWebViewClient {
        ThoDenNgayWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase();

            if (path.endsWith(".pdf") || PDF_MIME_TYPE.equals(request.getRequestHeaders().get("Accept"))) {
                return openExternal(uri, PDF_MIME_TYPE);
            }

            if (!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) {
                return bridge.launchIntent(uri);
            }

            return super.shouldOverrideUrlLoading(view, request);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            hideNetworkError();
            hideStartupSplash();
            inspectWebRuntimeState(view);
            if (loadingOfflineFallback) {
                if (hasNetworkConnection()) {
                    rememberSuccessfulShell(view, url);
                }
                loadingOfflineFallback = false;
                return;
            }
            rememberSuccessfulShell(view, url);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);
            if (request.isForMainFrame()) {
                lastMainFrameErrorUrl = request.getUrl().toString();
                int errorCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? error.getErrorCode() : WebViewClient.ERROR_UNKNOWN;
                handleMainFrameLoadError(lastMainFrameErrorUrl, errorCode);
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            super.onReceivedHttpError(view, request, errorResponse);
            if (request.isForMainFrame() && errorResponse.getStatusCode() >= 500) {
                lastMainFrameErrorUrl = request.getUrl().toString();
                if (!loadingOfflineFallback && !hasNetworkConnection()) {
                    loadOfflineStartup(lastMainFrameErrorUrl);
                    return;
                }
                showNetworkError();
            }
        }
    }
}

