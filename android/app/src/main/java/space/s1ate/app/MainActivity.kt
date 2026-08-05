package space.s1ate.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import space.s1ate.app.ui.SlateRoot

class MainActivity : ComponentActivity() {
    private var sharedText by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        sharedText = intent.sharedText()
        val graph = (application as SlateApplication).graph
        setContent { SlateRoot(graph = graph, sharedText = sharedText) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        sharedText = intent.sharedText()
    }
}

private fun Intent.sharedText(): String? {
    if (action == Intent.ACTION_SEND && type == "text/plain") {
        return getStringExtra(Intent.EXTRA_TEXT)
    }
    if (action == Intent.ACTION_VIEW) return dataString
    return null
}
