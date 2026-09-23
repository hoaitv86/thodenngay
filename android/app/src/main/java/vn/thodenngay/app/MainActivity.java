package vn.thodenngay.app;

import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.res.ColorStateList;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
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
import android.provider.Settings;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewParent;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ServiceWorkerController;
import android.webkit.ServiceWorkerWebSettings;
import android.webkit.URLUtil;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebBackForwardList;
import android.webkit.WebHistoryItem;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Space;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.Bridge;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONTokener;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "TDN-WebView";
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
    private static final String UPDATE_METADATA_URL = "https://github.com/hoaitv86/thodenngay/releases/latest/download/latest.json";
    private static final String UPDATE_APK_URL = "https://github.com/hoaitv86/thodenngay/releases/latest/download/thodenngay.apk";
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";
    private static final int MAX_SNAPSHOT_CHARS = 2_500_000;
    private static final int STARTUP_TIMEOUT_MS = 3_000;
    private static final int STARTUP_RECOVERY_TIMEOUT_MS = 8_000;
    private static final int VERSION_CHECK_TIMEOUT_MS = 3_000;
    private static final int BRAND_NAVY = 0xFF0F3D63;
    private static final int BRAND_BLUE = 0xFF1478C8;
    private static final int BRAND_ORANGE = 0xFFFF8A00;
    private static final int BRAND_GREEN = 0xFF10983B;
    private static final int BRAND_MUTED = 0xFF59738A;
    private static final int ICON_FAST = 0;
    private static final int ICON_TRUSTED = 1;
    private static final int ICON_CARING = 2;

    private FrameLayout rootView;
    private LinearLayout errorView;
    private FrameLayout startupSplashView;
    private WebView webView;
    private SharedPreferences offlinePrefs;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean loadingOfflineFallback = false;
    private boolean startupRecoveryAttempted = false;
    private boolean waitingForWebStartupReadiness = false;
    private int freshReloadSequence = 0;
    private String lastMainFrameErrorUrl;
    private boolean updatePromptDismissedThisSession = false;
    private boolean updateDownloadReceiverRegistered = false;
    private long updateDownloadId = -1L;
    private String pendingInstallApkPath;
    private long pendingInstallVersionCode = -1L;
    private final BroadcastReceiver updateDownloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) {
                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (downloadId == updateDownloadId) {
                    handleUpdateDownloadComplete(downloadId);
                }
            }
        }
    };

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
        checkForApkUpdate();
        scheduleStartupWatchdog();
        if (!hasNetworkConnection()) {
            webView.postDelayed(() -> loadOfflineStartup(null), 250);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (pendingInstallApkPath != null && canRequestPackageInstalls()) {
            String apkPath = pendingInstallApkPath;
            pendingInstallApkPath = null;
            openDownloadedUpdateApk(apkPath);
        }
    }

    @Override
    public void onDestroy() {
        unregisterUpdateDownloadReceiver();
        super.onDestroy();
    }

    private void configureWebView() {
        WebView.setWebContentsDebuggingEnabled(true);
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
                        handleAndroidBackPressed();
                    }
                }
            );
    }

    private void handleAndroidBackPressed() {
        if (webView == null) {
            moveTaskToBack(true);
            return;
        }

        int backOffset = findPreviousValidHistoryOffset();
        if (backOffset < 0) {
            hideNetworkError();
            webView.goBackOrForward(backOffset);
            return;
        }

        moveTaskToBack(true);
    }

    private int findPreviousValidHistoryOffset() {
        if (webView == null || !webView.canGoBack()) return 0;

        WebBackForwardList history = webView.copyBackForwardList();
        int currentIndex = history.getCurrentIndex();
        for (int index = currentIndex - 1; index >= 0; index--) {
            WebHistoryItem item = history.getItemAtIndex(index);
            String url = item != null ? item.getUrl() : null;
            if (isValidBackHistoryUrl(url)) {
                return index - currentIndex;
            }
            Log.i(TAG, "[TDN-BACK] skipping history url=" + url);
        }
        return 0;
    }

    private boolean isValidBackHistoryUrl(String url) {
        if (url == null || url.length() == 0) return false;
        if (isAndroidLoginUrl(url)) return false;
        if ("about:blank".equals(url)) return false;
        return isRemoteAppUrl(url) || url.startsWith("data:text/html");
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

        int screenHeightDp = getResources().getConfiguration().screenHeightDp;
        boolean compact = screenHeightDp > 0 && screenHeightDp < 660;

        startupSplashView = new FrameLayout(this);
        startupSplashView.setBackgroundColor(0xFFFFFFFF);
        startupSplashView.setFitsSystemWindows(true);

        startupSplashView.addView(
            new BottomBrandWaveView(this),
            new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        );

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(24), dp(compact ? 18 : 28), dp(24), dp(compact ? 16 : 24));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.tdn_splash_logo);
        logo.setAdjustViewBounds(true);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(compact ? 118 : 154), dp(compact ? 118 : 154));
        logoParams.setMargins(0, 0, 0, dp(compact ? 6 : 8));

        TextView appName = createBrandNameText(compact);
        TextView slogan = createCenteredText(getString(R.string.startup_slogan), BRAND_NAVY, compact ? 15 : 17, Typeface.NORMAL);
        slogan.setPadding(0, dp(4), 0, dp(compact ? 12 : 16));

        ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            progress.setIndeterminateTintList(ColorStateList.valueOf(BRAND_BLUE));
            progress.setProgressBackgroundTintList(ColorStateList.valueOf(0xFFE1E8EE));
        }
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(dp(compact ? 168 : 220), dp(5));
        progressParams.setMargins(0, 0, 0, dp(compact ? 10 : 12));

        TextView status = createCenteredText(getString(R.string.startup_status), BRAND_NAVY, compact ? 13 : 14, Typeface.NORMAL);
        status.setPadding(0, 0, 0, dp(compact ? 14 : 22));

        LinearLayout values = new LinearLayout(this);
        values.setOrientation(LinearLayout.HORIZONTAL);
        values.setGravity(Gravity.CENTER);
        values.setBaselineAligned(false);
        LinearLayout.LayoutParams valuesParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        valuesParams.setMargins(0, 0, 0, dp(compact ? 10 : 18));
        values.addView(createBrandValueItem(ICON_FAST, BRAND_BLUE, 0xFFE7F3FF, getString(R.string.startup_value_fast), compact), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        values.addView(createValueSeparator(compact));
        values.addView(createBrandValueItem(ICON_TRUSTED, BRAND_ORANGE, 0xFFFFF0DD, getString(R.string.startup_value_trusted), compact), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        values.addView(createValueSeparator(compact));
        values.addView(createBrandValueItem(ICON_CARING, BRAND_GREEN, 0xFFE5F7EA, getString(R.string.startup_value_caring), compact), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        TextView version = createCenteredText(getStartupVersionLabel(), BRAND_MUTED, compact ? 12 : 13, Typeface.NORMAL);
        version.setPadding(0, 0, 0, dp(compact ? 4 : 6));

        LinearLayout dots = new LinearLayout(this);
        dots.setOrientation(LinearLayout.HORIZONTAL);
        dots.setGravity(Gravity.CENTER);
        dots.addView(createDot(BRAND_BLUE));
        dots.addView(createDot(BRAND_ORANGE));
        dots.addView(createDot(0xFFDDE5EC));
        LinearLayout.LayoutParams dotsParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        dotsParams.setMargins(0, 0, 0, dp(compact ? 8 : 12));

        TextView footer = createCenteredText(getString(R.string.startup_footer), BRAND_NAVY, compact ? 9 : 10, Typeface.NORMAL);
        footer.setLetterSpacing(0.12f);

        content.addView(new Space(this), new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, compact ? 0.25f : 0.5f));
        content.addView(logo, logoParams);
        content.addView(appName);
        content.addView(slogan);
        content.addView(progress, progressParams);
        content.addView(status);
        content.addView(values, valuesParams);
        content.addView(new Space(this), new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, compact ? 0.18f : 0.45f));
        content.addView(version);
        content.addView(dots, dotsParams);
        content.addView(footer);
        content.addView(new Space(this), new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, compact ? 0.12f : 0.22f));

        startupSplashView.addView(
            content,
            new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        );
        rootView.addView(
            startupSplashView,
            new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        );
    }

    private TextView createBrandNameText(boolean compact) {
        SpannableString name = new SpannableString("THỢ ĐẾN NGAY");
        name.setSpan(new ForegroundColorSpan(BRAND_NAVY), 0, 3, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        name.setSpan(new ForegroundColorSpan(BRAND_ORANGE), 4, name.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        name.setSpan(new StyleSpan(Typeface.BOLD), 0, name.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);

        TextView appName = createCenteredText("", BRAND_NAVY, compact ? 29 : 34, Typeface.BOLD);
        appName.setText(name);
        appName.setIncludeFontPadding(false);
        return appName;
    }

    private TextView createCenteredText(String text, int color, int sp, int typefaceStyle) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(color);
        view.setTextSize(sp);
        view.setGravity(Gravity.CENTER);
        view.setTypeface(Typeface.DEFAULT, typefaceStyle);
        view.setIncludeFontPadding(true);
        return view;
    }

    private View createBrandValueItem(int iconType, int accentColor, int backgroundColor, String label, boolean compact) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setGravity(Gravity.CENTER);

        BrandIconView icon = new BrandIconView(this, iconType, accentColor, backgroundColor);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dp(compact ? 48 : 58), dp(compact ? 48 : 58));
        iconParams.setMargins(0, 0, 0, dp(6));

        TextView text = createCenteredText(label, BRAND_NAVY, compact ? 12 : 13, Typeface.NORMAL);
        text.setSingleLine(false);

        item.addView(icon, iconParams);
        item.addView(text, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        return item;
    }

    private View createValueSeparator(boolean compact) {
        View separator = new View(this);
        separator.setBackgroundColor(0xFFD4DEE7);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(1), dp(compact ? 28 : 34));
        params.setMargins(dp(4), dp(compact ? 9 : 12), dp(4), 0);
        separator.setLayoutParams(params);
        return separator;
    }

    private View createDot(int color) {
        View dot = new View(this);
        android.graphics.drawable.GradientDrawable shape = new android.graphics.drawable.GradientDrawable();
        shape.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        shape.setColor(color);
        dot.setBackground(shape);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(8), dp(8));
        params.setMargins(dp(3), 0, dp(3), 0);
        dot.setLayoutParams(params);
        return dot;
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
        waitingForWebStartupReadiness = false;
        if (startupSplashView != null) {
            startupSplashView.setVisibility(View.GONE);
        }
    }

    private boolean isStartupSplashVisible() {
        return startupSplashView != null && startupSplashView.getVisibility() == View.VISIBLE;
    }

    private void hideStartupSplashWhenWebAppReady(WebView view, String url) {
        if (!isStartupSplashVisible()) return;
        if (isAndroidLoginUrl(url)) {
            waitForAndroidLoginStartup(view);
            return;
        }
        hideStartupSplash();
    }

    private void waitForAndroidLoginStartup(WebView view) {
        if (!isStartupSplashVisible() || view == null) return;
        waitingForWebStartupReadiness = true;
        view.evaluateJavascript(
            "(function(){var marker=!!document.querySelector('[data-tdn-android-startup=checking]');var text=(document.body&&document.body.innerText)||'';return marker||text.indexOf('Đang khởi động...')!==-1||text.indexOf('v0.1.1 Beta')!==-1;})()",
            value -> {
                boolean stillChecking = "true".equals(value);
                if (!stillChecking) {
                    waitingForWebStartupReadiness = false;
                    hideStartupSplash();
                    return;
                }
                mainHandler.postDelayed(() -> waitForAndroidLoginStartup(view), 120);
            }
        );
    }
    private static class BrandIconView extends View {
        private final int iconType;
        private final int accentColor;
        private final int backgroundColor;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();

        BrandIconView(Context context, int iconType, int accentColor, int backgroundColor) {
            super(context);
            this.iconType = iconType;
            this.accentColor = accentColor;
            this.backgroundColor = backgroundColor;
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float width = getWidth();
            float height = getHeight();
            float size = Math.min(width, height);
            float cx = width / 2f;
            float cy = height / 2f;
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(backgroundColor);
            canvas.drawCircle(cx, cy, size * 0.48f, paint);
            paint.setColor(accentColor);
            if (iconType == ICON_FAST) {
                drawLightning(canvas, cx, cy, size);
            } else if (iconType == ICON_TRUSTED) {
                drawGroup(canvas, cx, cy, size);
            } else {
                drawHeart(canvas, cx, cy, size);
            }
        }

        private void drawLightning(Canvas canvas, float cx, float cy, float size) {
            path.reset();
            path.moveTo(cx + size * 0.03f, cy - size * 0.34f);
            path.lineTo(cx - size * 0.22f, cy + size * 0.04f);
            path.lineTo(cx - size * 0.02f, cy + size * 0.04f);
            path.lineTo(cx - size * 0.12f, cy + size * 0.35f);
            path.lineTo(cx + size * 0.24f, cy - size * 0.08f);
            path.lineTo(cx + size * 0.04f, cy - size * 0.08f);
            path.close();
            canvas.drawPath(path, paint);
        }

        private void drawGroup(Canvas canvas, float cx, float cy, float size) {
            float r = size * 0.09f;
            canvas.drawCircle(cx, cy - size * 0.18f, r * 1.12f, paint);
            canvas.drawCircle(cx - size * 0.18f, cy - size * 0.11f, r, paint);
            canvas.drawCircle(cx + size * 0.18f, cy - size * 0.11f, r, paint);
            RectF center = new RectF(cx - size * 0.18f, cy - size * 0.04f, cx + size * 0.18f, cy + size * 0.24f);
            RectF left = new RectF(cx - size * 0.34f, cy + size * 0.01f, cx - size * 0.07f, cy + size * 0.22f);
            RectF right = new RectF(cx + size * 0.07f, cy + size * 0.01f, cx + size * 0.34f, cy + size * 0.22f);
            canvas.drawRoundRect(left, size * 0.08f, size * 0.08f, paint);
            canvas.drawRoundRect(right, size * 0.08f, size * 0.08f, paint);
            canvas.drawRoundRect(center, size * 0.1f, size * 0.1f, paint);
        }

        private void drawHeart(Canvas canvas, float cx, float cy, float size) {
            path.reset();
            path.moveTo(cx, cy + size * 0.27f);
            path.cubicTo(cx - size * 0.34f, cy + size * 0.05f, cx - size * 0.32f, cy - size * 0.24f, cx - size * 0.1f, cy - size * 0.24f);
            path.cubicTo(cx - size * 0.01f, cy - size * 0.24f, cx + size * 0.05f, cy - size * 0.18f, cx, cy - size * 0.1f);
            path.cubicTo(cx + size * 0.11f, cy - size * 0.31f, cx + size * 0.42f, cy - size * 0.19f, cx + size * 0.34f, cy + size * 0.06f);
            path.cubicTo(cx + size * 0.3f, cy + size * 0.17f, cx + size * 0.16f, cy + size * 0.24f, cx, cy + size * 0.27f);
            path.close();
            canvas.drawPath(path, paint);
        }
    }

    private static class BottomBrandWaveView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();

        BottomBrandWaveView(Context context) {
            super(context);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float width = getWidth();
            float height = getHeight();
            if (width <= 0 || height <= 0) return;

            drawCity(canvas, width, height);
            drawWave(canvas, width, height, BRAND_BLUE, height * 0.82f, -0.1f, 0.92f);
            drawWave(canvas, width, height, BRAND_ORANGE, height * 0.84f, 0.46f, 0.82f);
            drawWave(canvas, width, height, 0x20FF8A00, height * 0.88f, -0.04f, 1f);
        }

        private void drawCity(Canvas canvas, float width, float height) {
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(0x1F1478C8);
            float base = height * 0.82f;
            float unit = width / 12f;
            for (int i = 0; i < 9; i++) {
                float left = i * unit + unit * 0.12f;
                float buildingWidth = unit * (i % 3 == 0 ? 0.36f : 0.48f);
                float buildingHeight = height * (0.035f + (i % 4) * 0.014f);
                canvas.drawRect(left, base - buildingHeight, left + buildingWidth, base, paint);
            }
            drawHouse(canvas, width * 0.38f, base, width * 0.07f);
            drawHouse(canvas, width * 0.66f, base, width * 0.06f);
        }

        private void drawHouse(Canvas canvas, float cx, float base, float size) {
            path.reset();
            path.moveTo(cx - size * 0.5f, base - size * 0.28f);
            path.lineTo(cx, base - size * 0.72f);
            path.lineTo(cx + size * 0.5f, base - size * 0.28f);
            path.close();
            canvas.drawPath(path, paint);
            canvas.drawRect(cx - size * 0.36f, base - size * 0.28f, cx + size * 0.36f, base, paint);
        }

        private void drawWave(Canvas canvas, float width, float height, int color, float startY, float phase, float bottomFactor) {
            path.reset();
            path.moveTo(0, startY);
            path.cubicTo(width * 0.24f, startY + height * (0.08f + phase * 0.02f), width * 0.42f, startY + height * 0.12f, width * 0.64f, startY + height * 0.05f);
            path.cubicTo(width * 0.78f, startY, width * 0.9f, startY - height * 0.03f, width, startY - height * 0.01f);
            path.lineTo(width, height * bottomFactor);
            path.lineTo(0, height * bottomFactor);
            path.close();
            paint.setShader(new LinearGradient(0, startY, width, height, color, color & 0x66FFFFFF, Shader.TileMode.CLAMP));
            canvas.drawPath(path, paint);
            paint.setShader(null);
        }
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
        return "";
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
        Log.i(TAG, "[TDN-STARTUP] cache mode configured mode=" + cacheMode + " online=" + hasNetworkConnection());
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

    private void checkForApkUpdate() {
        if (!hasNetworkConnection() || updatePromptDismissedThisSession) return;

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(UPDATE_METADATA_URL + "?t=" + System.currentTimeMillis());
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(VERSION_CHECK_TIMEOUT_MS);
                connection.setReadTimeout(VERSION_CHECK_TIMEOUT_MS);
                connection.setUseCaches(false);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Cache-Control", "no-cache");
                connection.setRequestProperty("Pragma", "no-cache");

                int responseCode = connection.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    Log.w(TAG, "[TDN-UPDATE] metadata request failed status=" + responseCode);
                    return;
                }

                StringBuilder body = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        body.append(line);
                    }
                }

                UpdateInfo updateInfo = parseUpdateInfo(new JSONObject(body.toString()));
                long installedVersionCode = getInstalledVersionCode();
                if (updateInfo.versionCode <= installedVersionCode) {
                    Log.i(TAG, "[TDN-UPDATE] no update installed=" + installedVersionCode + " remote=" + updateInfo.versionCode);
                    return;
                }

                mainHandler.post(() -> showApkUpdateDialog(updateInfo));
            } catch (Exception error) {
                Log.w(TAG, "[TDN-UPDATE] update check failed", error);
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }).start();
    }

    private UpdateInfo parseUpdateInfo(JSONObject payload) {
        long versionCode = payload.optLong("versionCode", -1L);
        if (versionCode <= 0) {
            throw new IllegalArgumentException("Update metadata is missing a valid versionCode.");
        }

        String apkUrl = normalizeApkUrl(payload.optString("apkUrl", UPDATE_APK_URL));
        if (!isHttpsUrl(apkUrl)) {
            throw new IllegalArgumentException("Update metadata contains an invalid apkUrl.");
        }

        return new UpdateInfo(
            versionCode,
            payload.optString("versionName", "").trim(),
            payload.optString("releaseNotes", "").trim(),
            apkUrl
        );
    }

    private String normalizeApkUrl(String value) {
        String url = value == null ? "" : value.trim();
        int markdownStart = url.indexOf("](");
        if (markdownStart >= 0 && url.endsWith(")")) {
            url = url.substring(markdownStart + 2, url.length() - 1).trim();
        }
        if (url.startsWith("<") && url.endsWith(">")) {
            url = url.substring(1, url.length() - 1).trim();
        }
        return url.length() == 0 ? UPDATE_APK_URL : url;
    }

    private boolean isHttpsUrl(String value) {
        try {
            Uri uri = Uri.parse(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getHost().length() > 0;
        } catch (Exception error) {
            return false;
        }
    }

    private long getInstalledVersionCode() throws Exception {
        android.content.pm.PackageInfo packageInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? packageInfo.getLongVersionCode() : packageInfo.versionCode;
    }

    private void showApkUpdateDialog(UpdateInfo updateInfo) {
        if (updatePromptDismissedThisSession || isFinishing() || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && isDestroyed())) return;

        String versionName = updateInfo.versionName.length() == 0 ? String.valueOf(updateInfo.versionCode) : updateInfo.versionName;
        String releaseNotes = updateInfo.releaseNotes.length() == 0 ? "Có bản cập nhật mới sẵn sàng." : updateInfo.releaseNotes;
        String message = "Phiên bản mới: " + versionName + "\n\n" + releaseNotes;

        new AlertDialog.Builder(this)
            .setTitle("Có phiên bản Thợ Đến Ngay mới")
            .setMessage(message)
            .setNegativeButton("Để sau", (dialog, which) -> {
                updatePromptDismissedThisSession = true;
                dialog.dismiss();
            })
            .setPositiveButton("Cập nhật ngay", (dialog, which) -> downloadUpdateApk(updateInfo))
            .show();
    }

    private void downloadUpdateApk(UpdateInfo updateInfo) {
        try {
            if (!hasNetworkConnection()) {
                Toast.makeText(this, "Không có kết nối mạng để tải bản cập nhật.", Toast.LENGTH_LONG).show();
                return;
            }
            if (updateInfo.versionCode <= getInstalledVersionCode()) {
                Toast.makeText(this, "Bạn đang dùng phiên bản mới nhất.", Toast.LENGTH_SHORT).show();
                return;
            }

            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) {
                Toast.makeText(this, "Không thể mở trình tải cập nhật.", Toast.LENGTH_LONG).show();
                return;
            }

            String fileName = "thodenngay-update-" + updateInfo.versionCode + ".apk";
            File downloadsDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (downloadsDir == null) {
                Toast.makeText(this, "Không thể chuẩn bị thư mục tải cập nhật.", Toast.LENGTH_LONG).show();
                return;
            }

            File apkFile = new File(downloadsDir, fileName);
            if (apkFile.exists() && !apkFile.delete()) {
                Log.w(TAG, "[TDN-UPDATE] could not delete stale update apk " + apkFile.getAbsolutePath());
            }
            pendingInstallApkPath = apkFile.getAbsolutePath();
            pendingInstallVersionCode = updateInfo.versionCode;
            updatePromptDismissedThisSession = true;

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(updateInfo.apkUrl));
            request.setTitle("Thợ Đến Ngay " + (updateInfo.versionName.length() == 0 ? "mới" : updateInfo.versionName));
            request.setDescription("Đang tải bản cập nhật...");
            request.setMimeType(APK_MIME_TYPE);
            request.addRequestHeader("Accept", APK_MIME_TYPE);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, fileName);

            registerUpdateDownloadReceiver();
            updateDownloadId = manager.enqueue(request);
            Toast.makeText(this, "Đang tải bản cập nhật...", Toast.LENGTH_SHORT).show();
        } catch (Exception error) {
            updateDownloadId = -1L;
            clearPendingUpdateInstall();
            unregisterUpdateDownloadReceiver();
            Log.e(TAG, "[TDN-UPDATE] download failed", error);
            Toast.makeText(this, "Không thể tải bản cập nhật. Vui lòng kiểm tra mạng rồi thử lại.", Toast.LENGTH_LONG).show();
        }
    }

    private void handleUpdateDownloadComplete(long downloadId) {
        DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) return;

        DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
        try (Cursor cursor = manager.query(query)) {
            if (cursor == null || !cursor.moveToFirst()) return;
            int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            int status = statusIndex >= 0 ? cursor.getInt(statusIndex) : DownloadManager.STATUS_FAILED;
            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                String apkPath = getDownloadedApkPath(cursor);
                if (apkPath == null || apkPath.length() == 0) apkPath = pendingInstallApkPath;
                if (apkPath != null && validateDownloadedUpdateApk(apkPath)) {
                    pendingInstallApkPath = apkPath;
                    Toast.makeText(this, "Đã tải xong bản cập nhật.", Toast.LENGTH_SHORT).show();
                    openDownloadedUpdateApk(apkPath);
                }
            } else if (status == DownloadManager.STATUS_FAILED) {
                Toast.makeText(this, getDownloadFailureMessage(cursor), Toast.LENGTH_LONG).show();
                clearPendingUpdateInstall();
            }
        } finally {
            updateDownloadId = -1L;
            unregisterUpdateDownloadReceiver();
        }
    }

    private String getDownloadedApkPath(Cursor cursor) {
        int localUriIndex = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);
        if (localUriIndex < 0) return null;
        String localUri = cursor.getString(localUriIndex);
        if (localUri == null || localUri.length() == 0) return null;
        Uri uri = Uri.parse(localUri);
        return "file".equalsIgnoreCase(uri.getScheme()) ? uri.getPath() : null;
    }

    private String getDownloadFailureMessage(Cursor cursor) {
        int reasonIndex = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);
        int reason = reasonIndex >= 0 ? cursor.getInt(reasonIndex) : -1;
        Log.w(TAG, "[TDN-UPDATE] download failed reason=" + reason);
        if (reason == DownloadManager.ERROR_CANNOT_RESUME || reason == DownloadManager.ERROR_DEVICE_NOT_FOUND) {
            return "Không thể lưu bản cập nhật trên thiết bị.";
        }
        if (reason == DownloadManager.ERROR_INSUFFICIENT_SPACE) {
            return "Thiết bị không đủ dung lượng để tải bản cập nhật.";
        }
        return "Tải bản cập nhật thất bại. Vui lòng kiểm tra mạng rồi thử lại.";
    }

    private void registerUpdateDownloadReceiver() {
        if (updateDownloadReceiverRegistered) return;
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(updateDownloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(updateDownloadReceiver, filter);
        }
        updateDownloadReceiverRegistered = true;
    }

    private void unregisterUpdateDownloadReceiver() {
        if (!updateDownloadReceiverRegistered) return;
        try {
            unregisterReceiver(updateDownloadReceiver);
        } catch (IllegalArgumentException ignored) {
            // Receiver may already be gone if Android cleaned up after the activity.
        }
        updateDownloadReceiverRegistered = false;
    }

    private boolean canRequestPackageInstalls() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getPackageManager().canRequestPackageInstalls();
    }

    private boolean validateDownloadedUpdateApk(String apkPath) {
        try {
            File apkFile = new File(apkPath);
            if (!apkFile.exists()) {
                Toast.makeText(this, "Không tìm thấy file cập nhật đã tải.", Toast.LENGTH_LONG).show();
                clearPendingUpdateInstall();
                return false;
            }

            android.content.pm.PackageInfo packageInfo = getPackageManager().getPackageArchiveInfo(apkPath, 0);
            if (packageInfo == null) {
                Toast.makeText(this, "File cập nhật không hợp lệ.", Toast.LENGTH_LONG).show();
                clearPendingUpdateInstall();
                return false;
            }
            if (!getPackageName().equals(packageInfo.packageName)) {
                Toast.makeText(this, "File cập nhật không đúng ứng dụng Thợ Đến Ngay.", Toast.LENGTH_LONG).show();
                clearPendingUpdateInstall();
                return false;
            }

            long downloadedVersionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? packageInfo.getLongVersionCode() : packageInfo.versionCode;
            long installedVersionCode = getInstalledVersionCode();
            if (downloadedVersionCode <= installedVersionCode) {
                Toast.makeText(this, "Bản cập nhật tải về không mới hơn phiên bản đang cài.", Toast.LENGTH_LONG).show();
                clearPendingUpdateInstall();
                return false;
            }
            if (pendingInstallVersionCode > 0 && downloadedVersionCode < pendingInstallVersionCode) {
                Toast.makeText(this, "Bản cập nhật tải về không khớp metadata phát hành.", Toast.LENGTH_LONG).show();
                clearPendingUpdateInstall();
                return false;
            }
            return true;
        } catch (Exception error) {
            Log.e(TAG, "[TDN-UPDATE] validate downloaded apk failed", error);
            Toast.makeText(this, "Không thể kiểm tra file cập nhật đã tải.", Toast.LENGTH_LONG).show();
            clearPendingUpdateInstall();
            return false;
        }
    }

    private void clearPendingUpdateInstall() {
        pendingInstallApkPath = null;
        pendingInstallVersionCode = -1L;
    }

    private void openDownloadedUpdateApk(String apkPath) {
        File apkFile = new File(apkPath);
        if (!apkFile.exists()) {
            Toast.makeText(this, "Không tìm thấy file cập nhật đã tải.", Toast.LENGTH_LONG).show();
            clearPendingUpdateInstall();
            return;
        }

        if (!canRequestPackageInstalls()) {
            pendingInstallApkPath = apkPath;
            Toast.makeText(this, "Hãy cho phép Thợ Đến Ngay cài đặt ứng dụng từ nguồn này rồi quay lại để tiếp tục.", Toast.LENGTH_LONG).show();
            Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()));
            try {
                startActivity(settingsIntent);
            } catch (ActivityNotFoundException error) {
                startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
            }
            return;
        }

        try {
            Uri apkUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apkFile);
            Intent installIntent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            installIntent.setData(apkUri);
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
            installIntent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
            startActivity(installIntent);
        } catch (ActivityNotFoundException error) {
            try {
                Uri apkUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apkFile);
                Intent fallbackIntent = new Intent(Intent.ACTION_VIEW);
                fallbackIntent.setDataAndType(apkUri, APK_MIME_TYPE);
                fallbackIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(fallbackIntent);
            } catch (Exception fallbackError) {
                Log.e(TAG, "[TDN-UPDATE] open installer fallback failed", fallbackError);
                Toast.makeText(this, "Không thể mở trình cài đặt bản cập nhật.", Toast.LENGTH_LONG).show();
            }
        } catch (Exception error) {
            Log.e(TAG, "[TDN-UPDATE] open installer failed", error);
            Toast.makeText(this, "Không thể mở trình cài đặt bản cập nhật.", Toast.LENGTH_LONG).show();
        }
    }

    private static class UpdateInfo {
        final long versionCode;
        final String versionName;
        final String releaseNotes;
        final String apkUrl;

        UpdateInfo(long versionCode, String versionName, String releaseNotes, String apkUrl) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.releaseNotes = releaseNotes;
            this.apkUrl = apkUrl;
        }
    }

    private void scheduleStartupWatchdog() {
        mainHandler.postDelayed(() -> {
            if (!isStartupSplashVisible() || webView == null || startupRecoveryAttempted || waitingForWebStartupReadiness) return;
            startupRecoveryAttempted = true;
            Log.w(TAG, "[TDN-STARTUP] watchdog fired online=" + hasNetworkConnection() + " url=" + webView.getUrl() + " lastErrorUrl=" + lastMainFrameErrorUrl);
            inspectWebRuntimeState(webView);
            if (hasNetworkConnection()) {
                webView.reload();
                mainHandler.postDelayed(() -> {
                    if (isStartupSplashVisible() && !loadCachedHtmlSnapshot(lastMainFrameErrorUrl)) {
                        Log.e(TAG, "[TDN-STARTUP] watchdog recovery failed; showing network error");
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
        Log.w(TAG, "[TDN-STARTUP] loading fresh start url reason=" + reason);
        loadingOfflineFallback = false;
        hideNetworkError();
        configureCacheModeForNetwork();
        webView.stopLoading();
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
        String refreshScript = "(async function(){try{"
            + "if('serviceWorker' in navigator){var regs=await navigator.serviceWorker.getRegistrations();"
            + "await Promise.all(regs.filter(function(r){return r.scope.indexOf(location.origin)===0}).map(function(r){return r.update()}));}"
            + "try{sessionStorage.setItem('tdn.nativeRefresh.cleaned.v1','" + escapedReason + "')}catch(e){}"
            + "return 'ok'}catch(error){return 'error:'+String(error&&error.message||error)}})();";

        try {
            webView.evaluateJavascript(refreshScript, value -> {
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
                        Log.i(TAG, "[TDN-STARTUP] Web runtime state " + parsed);
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
        Log.w(TAG, "[TDN-STARTUP] loading cached html snapshot baseUrl=" + baseUrl + " failedUrl=" + failedUrl);
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
        Log.w(TAG, "[TDN-STARTUP] loading offline startup fallbackUrl=" + fallbackUrl + " failedUrl=" + failedUrl + " online=" + hasNetworkConnection());

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
            || errorCode == WebViewClient.ERROR_IO;
    }

    private boolean isLikelyNavigationCancellation(WebView view, String failedUrl, int errorCode) {
        if (errorCode != WebViewClient.ERROR_UNKNOWN) return false;
        if (!hasNetworkConnection() || failedUrl == null) return false;

        String currentUrl = view != null ? view.getUrl() : null;
        if (currentUrl == null || currentUrl.length() == 0) return false;
        if (failedUrl.equals(currentUrl)) return false;

        return isRemoteAppUrl(currentUrl) || currentUrl.startsWith("data:text/html");
    }

    private void handleMainFrameLoadError(String failedUrl, int errorCode) {
        Log.e(TAG, "[TDN-STARTUP] main frame load error code=" + errorCode + " failedUrl=" + failedUrl + " offlineFallback=" + loadingOfflineFallback + " online=" + hasNetworkConnection());
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
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            waitingForWebStartupReadiness = false;
            super.onPageStarted(view, url, favicon);
            Log.i(TAG, "[TDN-STARTUP] page started url=" + url + " online=" + hasNetworkConnection());
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            Log.i(TAG, "[TDN-STARTUP] page finished url=" + url + " progress=" + view.getProgress() + " offlineFallback=" + loadingOfflineFallback);
            hideNetworkError();
            hideStartupSplashWhenWebAppReady(view, url);
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
            if (!request.isForMainFrame()) {
                super.onReceivedError(view, request, error);
                return;
            }

            String failedUrl = request.getUrl() != null ? request.getUrl().toString() : null;
            int errorCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? error.getErrorCode() : WebViewClient.ERROR_UNKNOWN;
            if (isLikelyNavigationCancellation(view, failedUrl, errorCode)) {
                Log.i(TAG, "[TDN-STARTUP] ignored cancelled navigation error code=" + errorCode + " failedUrl=" + failedUrl + " currentUrl=" + (view != null ? view.getUrl() : null));
                return;
            }

            lastMainFrameErrorUrl = failedUrl;
            handleMainFrameLoadError(lastMainFrameErrorUrl, errorCode);
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            super.onReceivedHttpError(view, request, errorResponse);
            if (request.isForMainFrame() && errorResponse.getStatusCode() >= 500) {
                lastMainFrameErrorUrl = request.getUrl().toString();
                Log.e(TAG, "[TDN-STARTUP] main frame http error status=" + errorResponse.getStatusCode() + " reason=" + errorResponse.getReasonPhrase() + " url=" + lastMainFrameErrorUrl);
                if (!loadingOfflineFallback && !hasNetworkConnection()) {
                    loadOfflineStartup(lastMainFrameErrorUrl);
                    return;
                }
                showNetworkError();
            }
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            String url = view != null ? view.getUrl() : null;
            Log.e(TAG, "[TDN-RENDERER] render process gone didCrash=" + detail.didCrash() + " priorityAtExit=" + detail.rendererPriorityAtExit() + " url=" + url);
            if (view != null) {
                try {
                    ViewParent parent = view.getParent();
                    if (parent instanceof FrameLayout) {
                        ((FrameLayout) parent).removeView(view);
                    }
                    view.destroy();
                } catch (Exception error) {
                    Log.e(TAG, "[TDN-RENDERER] failed to dispose dead WebView", error);
                }
            }
            mainHandler.post(() -> recreate());
            return true;
        }
    }
}




