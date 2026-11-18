package space.s1ate.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import space.s1ate.app.model.SlateProfile

// The web app's dark tokens (app/globals.css, `.dark`).
internal val SlateBackground = Color(0xFF0A0A0B)
internal val SlateSurface = Color(0xFF111113)
internal val SlateAccent = Color(0xFFADEBB3)
internal val SlateOnAccent = Color(0xFF0F1F12)
internal val SlateMutedText = Color(0xFF95959D)
internal val SlateMuted = Color.White.copy(alpha = 0.52f)
internal val SlateHairline = Color.White.copy(alpha = 0.085f)
internal val SlateBorder = Color(0xFF222225)
internal val SlateFill = Color.White.copy(alpha = 0.055f)

/** Page gutter on a phone, shared by every screen. */
internal val SlateGutter = 16.dp

/** The web's `cubic-bezier(0.33, 1, 0.68, 1)`, used wherever a screen arrives. */
internal val SlateArriveEasing = CubicBezierEasing(0.33f, 1f, 0.68f, 1f)

/**
 * A screen or a whole result set that replaces another fades up over 220 ms
 * from 45% opacity, never from nothing (DESIGN.md, Motion).
 */
@Composable
internal fun Modifier.arriveOn(key: Any?): Modifier {
    val still = reduceMotion()
    val alpha = remember { Animatable(1f) }
    LaunchedEffect(key) {
        if (still) return@LaunchedEffect
        alpha.snapTo(0.45f)
        alpha.animateTo(1f, tween(220, easing = SlateArriveEasing))
    }
    return graphicsLayer { this.alpha = alpha.value }
}

/** Press feedback for anything tappable: a small, quick scale. */
@Composable
internal fun Modifier.pressable(
    role: Role? = Role.Button,
    enabled: Boolean = true,
    onClick: () -> Unit,
): Modifier {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(
        if (pressed) 0.97f else 1f,
        tween(if (pressed) 90 else 160, easing = SlateArriveEasing),
        label = "press",
    )
    return graphicsLayer { scaleX = scale; scaleY = scale }
        .clickable(interactionSource = source, indication = null, enabled = enabled, role = role, onClick = onClick)
}

@Composable
internal fun SlateTopBar(
    profile: SlateProfile?,
    avatarBytes: ByteArray?,
    onLogo: () -> Unit,
    onProfile: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SlateBackground)
            .windowInsetsPadding(WindowInsets.statusBars)
            .height(56.dp)
            .padding(start = SlateGutter, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SlateWordmark(Modifier.pressable(onClick = onLogo))
        Spacer(Modifier.weight(1f))
        ProfileAvatarButton(profile, avatarBytes, onProfile)
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
            letterSpacing = (-0.9).sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/** How much room the floating dock takes above the system navigation bar. */
internal val SlateDockHeight = 76.dp

/**
 * The floating dock of the web app (`components/bottom-nav.tsx`): the primary
 * destinations in one liquid selector, and a round button that finds and adds
 * a title.
 */
@Composable
internal fun SlateDock(
    items: List<Pair<String, ImageVector>>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    onAdd: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(
                    listOf(Color.Transparent, SlateBackground.copy(alpha = 0.92f), SlateBackground),
                ),
            )
            .windowInsetsPadding(WindowInsets.navigationBars),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            Modifier
                .widthIn(max = 430.dp)
                .fillMaxWidth()
                .height(SlateDockHeight)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            LiquidSelector(
                count = items.size,
                selectedIndex = selectedIndex,
                onSelect = onSelect,
                springs = LiquidDock,
                trackColor = Color(0xFF161618),
                modifier = Modifier
                    .weight(1f)
                    .height(60.dp)
                    .border(1.dp, Color.White.copy(alpha = 0.12f), CircleShape),
            ) { index ->
                val (label, icon) = items[index]
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp))
                    Text(
                        label,
                        color = LocalContentColor.current,
                        fontSize = 11.sp,
                        lineHeight = 12.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Clip,
                    )
                }
            }
            Box(
                Modifier
                    .size(60.dp)
                    .pressable(onClick = onAdd)
                    .clip(CircleShape)
                    .background(Color(0xFF161618))
                    .border(1.dp, Color.White.copy(alpha = 0.14f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Outlined.Add,
                    contentDescription = "Find and add a title",
                    tint = SlateAccent,
                    modifier = Modifier.size(26.dp),
                )
            }
        }
    }
}

/** A screen's name. No label sits above it: the heading carries its own weight. */
@Composable
internal fun SlateScreenTitle(
    title: String,
    modifier: Modifier = Modifier,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            title,
            color = Color.White,
            fontSize = 30.sp,
            lineHeight = 34.sp,
            letterSpacing = (-0.8).sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
        )
        trailing?.invoke()
    }
}

/** A filled pill in the theme colour: the one primary action of a card or sheet. */
@Composable
internal fun SlatePrimaryButton(
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Box(
        modifier
            .height(44.dp)
            .pressable(enabled = enabled, onClick = onClick)
            .clip(CircleShape)
            .background(SlateAccent.copy(alpha = if (enabled) 1f else 0.6f))
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = SlateOnAccent, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

/** A quiet pill beside or under a primary one. */
@Composable
internal fun SlateSecondaryButton(
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier
            .height(44.dp)
            .pressable(onClick = onClick)
            .clip(CircleShape)
            .background(SlateFill)
            .border(1.dp, SlateBorder, CircleShape)
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}
