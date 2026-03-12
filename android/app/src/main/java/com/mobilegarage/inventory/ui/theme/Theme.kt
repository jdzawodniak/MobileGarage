package com.mobilegarage.inventory.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF7EB8DA),
    secondary = Color(0xFF0F3460),
    background = Color(0xFF1A1A2E),
    surface = Color(0xFF16213E),
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF0F3460),
    secondary = Color(0xFF16213E),
    background = Color(0xFFF5F5F5),
    surface = Color.White,
)

@Composable
fun InventoryTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        content = content,
    )
}
