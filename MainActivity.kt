package com.browserku

import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import org.json.JSONObject

class MainActivity : Activity() {
    private val BG = 0xFF131722.toInt()
    private lateinit var root: FrameLayout
    private lateinit var shell: WebView
    private val pages = mutableListOf<WebView>()
    private var cur = -1
    private var overlay = false
    private var topPx = 0
    private var pendingUrl: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = BG
        window.navigationBarColor = BG
        pendingUrl = intent?.data?.toString()

        root = FrameLayout(this)
        root.setBackgroundColor(BG)
        shell = WebView(this)
        shell.setBackgroundColor(BG)
        shell.settings.javaScriptEnabled = true
        shell.settings.domStorageEnabled = true
        shell.addJavascriptInterface(Bridge(), "Android")
        shell.webViewClient = object : WebViewClient() {
            override fun onPageFinished(v: WebView, url: String) {
                pendingUrl?.let { js("openUrl(" + JSONObject.quote(it) + ")") }
                pendingUrl = null
            }
        }
        shell.loadUrl("file:///android_asset/index.html")
        root.addView(shell, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)
    }

    private fun js(code: String) = shell.evaluateJavascript(code, null)

    private fun refresh() {
        for (j in pages.indices) {
            pages[j].visibility = if (j == cur && !overlay) View.VISIBLE else View.GONE
        }
    }

    private fun notifyPage(v: WebView, url: String?, title: String?) {
        val i = pages.indexOf(v)
        if (i < 0 || url == null) return
        js("onPage($i," + JSONObject.quote(url) + "," + JSONObject.quote(title ?: "") + ")")
    }

    private fun newPage() {
        val wv = WebView(this)
        val s = wv.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.builtInZoomControls = true
        s.displayZoomControls = false
        s.loadWithOverviewMode = true
        s.useWideViewPort = true
        s.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        wv.webViewClient = object : WebViewClient() {
            override fun onPageStarted(v: WebView, url: String, f: Bitmap?) = notifyPage(v, url, null)
            override fun onPageFinished(v: WebView, url: String) {
                notifyPage(v, url, v.title)
                js("onProg(" + pages.indexOf(v) + ",100)")
            }
        }
        wv.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(v: WebView, p: Int) { js("onProg(" + pages.indexOf(v) + "," + p + ")") }
            override fun onReceivedTitle(v: WebView, t: String?) = notifyPage(v, v.url, t)
        }
        wv.setDownloadListener { url, ua, cd, mime, _ ->
            val r = DownloadManager.Request(Uri.parse(url))
            r.setMimeType(mime)
            r.addRequestHeader("User-Agent", ua)
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, cd, mime))
            (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(r)
            Toast.makeText(this, "Mengunduh…", Toast.LENGTH_SHORT).show()
        }
        wv.visibility = View.GONE
        val lp = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        lp.topMargin = topPx
        root.addView(wv, lp)
        pages.add(wv)
    }

    private fun command(i: Int, c: String) {
        val w = pages.getOrNull(i) ?: return
        if (c == "back") { if (w.canGoBack()) w.goBack() }
        else if (c == "fwd") { if (w.canGoForward()) w.goForward() }
        else if (c == "reload") w.reload()
    }

    private fun closePage(i: Int) {
        val w = pages.getOrNull(i) ?: return
        root.removeView(w)
        w.destroy()
        pages.removeAt(i)
    }

    inner class Bridge {
        @JavascriptInterface fun nt() { runOnUiThread { newPage() } }
        @JavascriptInterface fun st(i: Int) { runOnUiThread { cur = i; refresh() } }
        @JavascriptInterface fun load(i: Int, u: String) { runOnUiThread { pages.getOrNull(i)?.loadUrl(u) } }
        @JavascriptInterface fun cmd(i: Int, c: String) { runOnUiThread { command(i, c) } }
        @JavascriptInterface fun close(i: Int) { runOnUiThread { closePage(i) } }
        @JavascriptInterface fun vis(v: Boolean) { runOnUiThread { overlay = !v; refresh() } }
        @JavascriptInterface fun exit() { runOnUiThread { finish() } }
        @JavascriptInterface fun setTop(px: Float) {
            runOnUiThread {
                topPx = (px * resources.displayMetrics.density).toInt()
                for (w in pages) {
                    (w.layoutParams as FrameLayout.LayoutParams).topMargin = topPx
                    w.requestLayout()
                }
            }
        }
        @JavascriptInterface fun clearData() {
            runOnUiThread {
                CookieManager.getInstance().removeAllCookies(null)
                for (w in pages) { w.clearCache(true); w.clearHistory() }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val w = pages.getOrNull(cur)
        if (!overlay && w != null && w.visibility == View.VISIBLE && w.canGoBack()) w.goBack()
        else js("window.nativeBack && nativeBack()")
    }
}
