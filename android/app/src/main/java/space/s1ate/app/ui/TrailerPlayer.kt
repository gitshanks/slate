package space.s1ate.app.ui

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TrailerPlayer(
    videoId: String,
    title: String,
    onDismiss: () -> Unit,
) {
    val webViewHolder = remember { arrayOfNulls<WebView>(1) }
    var loadingProgress by remember { mutableIntStateOf(0) }
    var failed by remember { mutableStateOf(false) }
    var customView by remember { mutableStateOf<View?>(null) }
    var customViewCallback by remember { mutableStateOf<WebChromeClient.CustomViewCallback?>(null) }

    val chromeClient = remember {
        object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                loadingProgress = newProgress
            }

            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (view == null || callback == null) return
                customViewCallback?.onCustomViewHidden()
                customView = view
                customViewCallback = callback
            }

            override fun onHideCustomView() {
                customView = null
                customViewCallback?.onCustomViewHidden()
                customViewCallback = null
            }
        }
    }

    DisposableEffect(videoId) {
        onDispose {
            customViewCallback?.onCustomViewHidden()
            webViewHolder[0]?.apply {
                stopLoading()
                loadUrl("about:blank")
                webChromeClient = null
                destroy()
            }
            webViewHolder[0] = null
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = true,
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
        ),
    ) {
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            val fullscreenView = customView
            if (fullscreenView != null) {
                AndroidView(
                    factory = {
                        (fullscreenView.parent as? ViewGroup)?.removeView(fullscreenView)
                        fullscreenView
                    },
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Column(
                    Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing),
                ) {
                    TrailerHeader(title = title, onDismiss = onDismiss)
                    Spacer(Modifier.weight(1f))

                    Box(
                        Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black),
                        contentAlignment = Alignment.Center,
                    ) {
                        AndroidView(
                            factory = { context ->
                                webViewHolder[0] ?: WebView(context).apply {
                                    webViewHolder[0] = this
                                    setBackgroundColor(AndroidColor.BLACK)
                                    setLayerType(View.LAYER_TYPE_HARDWARE, null)
                                    settings.javaScriptEnabled = true
                                    settings.domStorageEnabled = true
                                    settings.mediaPlaybackRequiresUserGesture = false
                                    settings.allowFileAccess = false
                                    settings.allowContentAccess = false
                                    settings.setSupportMultipleWindows(false)
                                    webChromeClient = chromeClient
                                    webViewClient = object : WebViewClient() {
                                        override fun onPageFinished(view: WebView?, url: String?) {
                                            loadingProgress = 100
                                        }

                                        override fun shouldOverrideUrlLoading(
                                            view: WebView?,
                                            request: WebResourceRequest?,
                                        ): Boolean {
                                            if (request?.isForMainFrame != true) return false
                                            val host = request.url.host.orEmpty()
                                            return host != "www.s1ate.space" &&
                                                host != "www.youtube.com" &&
                                                host != "www.youtube-nocookie.com"
                                        }

                                        override fun onReceivedError(
                                            view: WebView?,
                                            request: WebResourceRequest?,
                                            error: android.webkit.WebResourceError?,
                                        ) {
                                            if (request?.isForMainFrame == true) failed = true
                                        }
                                    }
                                    loadDataWithBaseURL(
                                        "https://www.s1ate.space",
                                        trailerHTML(videoId),
                                        "text/html",
                                        "utf-8",
                                        null,
                                    )
                                }
                            },
                            modifier = Modifier.fillMaxSize(),
                        )

                        if (loadingProgress < 100 && !failed) {
                            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp)
                        }
                        if (failed) {
                            Text(
                                "The trailer could not be loaded.",
                                color = Color.White.copy(alpha = 0.72f),
                                fontSize = 14.sp,
                            )
                        }
                    }

                    Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun TrailerHeader(title: String, onDismiss: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().height(64.dp).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        IconButton(
            onClick = onDismiss,
            modifier = Modifier.size(40.dp).background(Color.White.copy(alpha = 0.1f), CircleShape),
        ) {
            Icon(Icons.Outlined.Close, contentDescription = "Close trailer", tint = Color.White)
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "TRAILER",
                color = Color.White.copy(alpha = 0.48f),
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 1.5.sp,
            )
            Text(
                title,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private fun trailerHTML(videoId: String): String {
    val safeId = videoId.filter { it.isLetterOrDigit() || it == '-' || it == '_' }
    val origin = Uri.encode("https://www.s1ate.space")
    return """
        <!doctype html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
            <style>
              html, body, iframe { width: 100%; height: 100%; margin: 0; padding: 0; border: 0; background: #000; overflow: hidden; }
            </style>
          </head>
          <body>
            <iframe
              src="https://www.youtube-nocookie.com/embed/$safeId?autoplay=1&playsinline=1&controls=1&rel=0&modestbranding=1&origin=$origin"
              title="Trailer"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowfullscreen>
            </iframe>
          </body>
        </html>
    """.trimIndent()
}
