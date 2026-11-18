package space.s1ate.app

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import space.s1ate.app.ui.SlateRoot

class MainActivity : ComponentActivity() {
    private var sharedText by mutableStateOf<String?>(null)
    private var listSlug by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        sharedText = intent.sharedText()
        listSlug = intent.listSlug()
        val graph = (application as SlateApplication).graph
        setContent { SlateRoot(graph = graph, sharedText = sharedText, listSlug = listSlug) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        sharedText = intent.sharedText()
        listSlug = intent.listSlug()
    }
}

private fun Intent.sharedText(): String? {
    if (action == Intent.ACTION_SEND && type == "text/plain") {
        return getStringExtra(Intent.EXTRA_TEXT)
    }
    return null
}

/** s1ate.space/l/<slug> or slate://l/<slug>: a list made by Slate. */
private fun Intent.listSlug(): String? {
    if (action != Intent.ACTION_VIEW) return null
    val uri = data ?: return null
    val segments = uri.pathSegments
    return when {
        uri.scheme == "slate" && uri.host == "l" -> segments.firstOrNull()
        segments.size >= 2 && segments[0] == "l" -> segments[1]
        else -> null
    }
}
