package space.s1ate.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import space.s1ate.app.model.SlateProfile

internal val SlateBackground = Color(0xFF0A0A0B)
internal val SlateSurface = Color(0xFF111113)
internal val SlateViolet = Color(0xFFA382FF)
internal val SlateMuted = Color.White.copy(alpha = 0.52f)
internal val SlateHairline = Color.White.copy(alpha = 0.085f)

@Composable
internal fun SlateTopBar(
    profile: SlateProfile?,
    avatarBytes: ByteArray?,
    profileIsOpen: Boolean,
    onLogo: () -> Unit,
    onProfile: () -> Unit,
    onSearch: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().background(SlateBackground)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.statusBars)
                .height(56.dp)
                .padding(horizontal = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SlateWordmark(Modifier.slateClickable(onLogo))
            Spacer(Modifier.weight(1f))
            Icon(
                Icons.Outlined.DarkMode,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.62f),
                modifier = Modifier.size(22.dp),
            )
            Spacer(Modifier.width(17.dp))
            Box {
                ProfileAvatarButton(profile, avatarBytes, onProfile)
                if (profileIsOpen) {
                    Box(
                        Modifier
                            .matchParentSize()
                            .padding((-3).dp)
                            .clip(CircleShape)
                            .background(Color.Transparent),
                    )
                }
            }
            Spacer(Modifier.width(17.dp))
            Icon(
                Icons.Outlined.Search,
                contentDescription = "Search",
                tint = Color.White.copy(alpha = 0.72f),
                modifier = Modifier.size(25.dp).slateClickable(onSearch),
            )
        }
        HorizontalDivider(color = SlateHairline, thickness = 0.7.dp)
    }
}

@Composable
internal fun SlateWordmark(modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Column(verticalArrangement = Arrangement.spacedBy(2.5.dp)) {
            Box(Modifier.width(12.dp).height(3.5.dp).clip(CircleShape).background(Color.White))
            Row(horizontalArrangement = Arrangement.spacedBy(2.5.dp)) {
                Box(Modifier.width(4.75.dp).height(3.5.dp).clip(CircleShape).background(Color.White))
                Box(Modifier.width(4.75.dp).height(3.5.dp).clip(CircleShape).background(Color.White))
            }
        }
        Spacer(Modifier.width(6.dp))
        Text(
            "slate",
            color = Color.White,
            fontSize = 24.sp,
            letterSpacing = (-1.1).sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
internal fun SlateBottomBar(
    items: List<Triple<String, ImageVector, Boolean>>,
    onSelect: (Int) -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(SlateBackground.copy(alpha = 0.985f))
            .windowInsetsPadding(WindowInsets.navigationBars),
    ) {
        HorizontalDivider(color = SlateHairline, thickness = 0.7.dp)
        Row(Modifier.fillMaxWidth().height(70.dp).padding(horizontal = 3.dp)) {
            items.forEachIndexed { index, (label, icon, selected) ->
                val pressedScale by animateFloatAsState(if (selected) 1f else 0.99f, label = "nav-$label")
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .height(70.dp)
                        .scale(pressedScale)
                        .slateClickable { onSelect(index) },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Top,
                ) {
                    Box(
                        Modifier
                            .width(42.dp)
                            .height(2.dp)
                            .background(if (selected) SlateViolet else Color.Transparent, CircleShape),
                    )
                    Spacer(Modifier.height(8.dp))
                    Icon(
                        icon,
                        contentDescription = label,
                        tint = if (selected) SlateViolet else Color.White.copy(alpha = 0.57f),
                        modifier = Modifier.size(22.dp),
                    )
                    Spacer(Modifier.height(5.dp))
                    Text(
                        label,
                        color = if (selected) SlateViolet else Color.White.copy(alpha = 0.57f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Clip,
                    )
                }
            }
        }
    }
}

@Composable
internal fun SlateSectionHeader(
    eyebrow: String,
    title: String,
    modifier: Modifier = Modifier,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(
                eyebrow.uppercase(),
                color = SlateMuted,
                fontSize = 12.sp,
                letterSpacing = 2.4.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Monospace,
            )
            Text(
                title,
                color = Color.White,
                fontSize = 38.sp,
                lineHeight = 40.sp,
                letterSpacing = (-1.6).sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Spacer(Modifier.weight(1f))
        trailing?.invoke()
    }
}

private fun Modifier.slateClickable(onClick: () -> Unit): Modifier = clickable(
    interactionSource = MutableInteractionSource(),
    indication = null,
    onClick = onClick,
)
