package vn.thodenngay.app;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
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

public class MainActivity extends BridgeActivity {
    private static final String HOME_URL = "https://thodenngay.vn";
    private static final String PDF_MIME_TYPE = "application/pdf";

    private FrameLayout rootView;
    private LinearLayout errorView;
    private FrameLayout startupSplashView;
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerBackHandler();
    }

    @Override
    protected void load() {
        super.load();
        configureWebView();
        createNetworkErrorView();
        createStartupSplashView();
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
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

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
            webView.loadUrl(HOME_URL);
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
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);
            if (request.isForMainFrame()) {
                showNetworkError();
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            super.onReceivedHttpError(view, request, errorResponse);
            if (request.isForMainFrame() && errorResponse.getStatusCode() >= 500) {
                showNetworkError();
            }
        }
    }
}
