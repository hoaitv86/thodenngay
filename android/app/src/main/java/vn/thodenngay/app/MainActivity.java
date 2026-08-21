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
import org.json.JSONTokener;

public class MainActivity extends BridgeActivity {
    private static final String HOME_URL = "https://thodenngay.vn";
    private static final String ANDROID_START_URL = "https://thodenngay.vn/login?app=android";
    private static final String APP_HOST = "thodenngay.vn";
    private static final String PDF_MIME_TYPE = "application/pdf";
    private static final String OFFLINE_PREFS = "tdn_android_offline_shell";
    private static final String KEY_LAST_URL = "last_success_url";
    private static final String KEY_LAST_HTML = "last_success_html";
    private static final int MAX_SNAPSHOT_CHARS = 2_500_000;

    private FrameLayout rootView;
    private LinearLayout errorView;
    private FrameLayout startupSplashView;
    private WebView webView;
    private SharedPreferences offlinePrefs;
    private boolean loadingOfflineFallback = false;
    private String lastMainFrameErrorUrl;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        offlinePrefs = getSharedPreferences(OFFLINE_PREFS, Context.MODE_PRIVATE);
        registerBackHandler();
    }

    @Override
    protected void load() {
        super.load();
        configureWebView();
        createNetworkErrorView();
        createStartupSplashView();
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
        version.setText(getString(R.string.startup_version));
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

    private boolean isRemoteAppUrl(String url) {
        try {
            Uri uri = Uri.parse(url);
            return ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) && APP_HOST.equalsIgnoreCase(uri.getHost());
        } catch (Exception error) {
            return false;
        }
    }

    private String getFallbackUrl(String failedUrl) {
        if (isRemoteAppUrl(failedUrl)) return failedUrl;
        String storedUrl = offlinePrefs.getString(KEY_LAST_URL, null);
        if (isRemoteAppUrl(storedUrl)) return storedUrl;
        return ANDROID_START_URL;
    }

    private void rememberSuccessfulShell(WebView view, String url) {
        if (!hasNetworkConnection() || !isRemoteAppUrl(url)) return;

        offlinePrefs.edit().putString(KEY_LAST_URL, url).apply();
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
                        .putString(KEY_LAST_URL, url)
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
        loadingOfflineFallback = true;
        hideNetworkError();
        configureCacheModeForNetwork();

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
            if (loadingOfflineFallback) {
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
