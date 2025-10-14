"""
Formatting utilities for displaying benchmark data with emojis.
"""

from typing import Any, Optional
from datetime import datetime


def format_platform(platform: str) -> str:
    """Format platform with emoji."""
    emoji_map = {
        "node": "🟢",
        "web": "🌐",
    }
    emoji = emoji_map.get(platform, "")
    return f"{emoji} {platform}" if emoji else platform


def format_device(device: str) -> str:
    """Format device with emoji."""
    emoji_map = {
        "wasm": "📦",
        "webgpu": "⚡",
        "cpu": "🖥️",
        "cuda": "🎮",
    }
    emoji = emoji_map.get(device, "")
    return f"{emoji} {device}" if emoji else device


def format_browser(browser: str) -> str:
    """Format browser with emoji."""
    if not browser:
        return ""

    emoji_map = {
        "chromium": "🔵",
        "chrome": "🔵",
        "firefox": "🦊",
        "webkit": "🧭",
        "safari": "🧭",
    }
    emoji = emoji_map.get(browser.lower(), "")
    return f"{emoji} {browser}" if emoji else browser


def format_status(status: str) -> str:
    """Format status with emoji."""
    emoji_map = {
        "completed": "✅",
        "failed": "❌",
        "running": "🔄",
        "pending": "⏳",
    }
    emoji = emoji_map.get(status, "")
    return f"{emoji} {status}" if emoji else status


def format_mode(mode: str) -> str:
    """Format mode with emoji."""
    emoji_map = {
        "warm": "🔥",
        "cold": "❄️",
    }
    emoji = emoji_map.get(mode, "")
    return f"{emoji} {mode}" if emoji else mode


def format_headed(headed: bool) -> str:
    """Format headed mode with emoji."""
    return "👁️ Yes" if headed else "No"


def format_metric_ms(value: Optional[float], metric_type: str = "inference") -> str:
    """Format metric in milliseconds with performance emoji.

    Args:
        value: Metric value in milliseconds
        metric_type: Type of metric ('load', 'inference')

    Returns:
        Formatted string with emoji
    """
    if value is None or value == 0:
        return "-"

    # Different thresholds for different metric types
    if metric_type == "load":
        # Load time thresholds (in ms)
        if value < 100:
            emoji = "🚀"  # Very fast
        elif value < 500:
            emoji = "⚡"  # Fast
        elif value < 2000:
            emoji = "✅"  # Good
        elif value < 5000:
            emoji = "⚠️"  # Slow
        else:
            emoji = "🐌"  # Very slow
    else:  # inference
        # Inference time thresholds (in ms)
        if value < 5:
            emoji = "🚀"  # Very fast
        elif value < 20:
            emoji = "⚡"  # Fast
        elif value < 50:
            emoji = "✅"  # Good
        elif value < 100:
            emoji = "⚠️"  # Slow
        else:
            emoji = "🐌"  # Very slow

    return f"{emoji} {value:.1f}ms"


def format_duration(duration_s: Optional[float]) -> str:
    """Format duration with emoji."""
    if duration_s is None or duration_s == 0:
        return "-"

    if duration_s < 5:
        emoji = "🚀"  # Very fast
    elif duration_s < 15:
        emoji = "⚡"  # Fast
    elif duration_s < 60:
        emoji = "✅"  # Good
    elif duration_s < 300:
        emoji = "⚠️"  # Slow
    else:
        emoji = "🐌"  # Very slow

    return f"{emoji} {duration_s:.1f}s"


def format_memory(memory_gb: Optional[int]) -> str:
    """Format memory with emoji."""
    if memory_gb is None or memory_gb == 0:
        return "-"

    if memory_gb >= 32:
        emoji = "💪"  # High
    elif memory_gb >= 16:
        emoji = "✅"  # Good
    elif memory_gb >= 8:
        emoji = "⚠️"  # Medium
    else:
        emoji = "📉"  # Low

    return f"{emoji} {memory_gb}GB"


def format_cpu_cores(cores: Optional[int]) -> str:
    """Format CPU cores with emoji."""
    if cores is None or cores == 0:
        return "-"

    if cores >= 16:
        emoji = "💪"  # Many
    elif cores >= 8:
        emoji = "✅"  # Good
    elif cores >= 4:
        emoji = "⚠️"  # Medium
    else:
        emoji = "📉"  # Few

    return f"{emoji} {cores} cores"


def format_timestamp(timestamp: Optional[datetime]) -> str:
    """Format timestamp as datetime string.

    Args:
        timestamp: datetime object

    Returns:
        Formatted datetime string
    """
    if timestamp is None:
        return "-"

    try:
        # Format as readable datetime
        return timestamp.strftime("%Y-%m-%d %H:%M:%S")
    except (ValueError, AttributeError):
        return str(timestamp)


def apply_formatting(df_dict: dict) -> dict:
    """Apply emoji formatting to a benchmark result dictionary.

    Args:
        df_dict: Dictionary containing benchmark data (one row)

    Returns:
        Dictionary with formatted values
    """
    formatted = df_dict.copy()

    # Format categorical fields
    if "platform" in formatted:
        formatted["platform"] = format_platform(formatted["platform"])

    if "device" in formatted:
        formatted["device"] = format_device(formatted["device"])

    if "browser" in formatted:
        formatted["browser"] = format_browser(formatted["browser"])

    if "status" in formatted:
        formatted["status"] = format_status(formatted["status"])

    if "mode" in formatted:
        formatted["mode"] = format_mode(formatted["mode"])

    if "headed" in formatted:
        formatted["headed"] = format_headed(formatted["headed"])

    # Format metrics
    if "load_ms_p50" in formatted:
        formatted["load_ms_p50"] = format_metric_ms(formatted["load_ms_p50"], "load")

    if "load_ms_p90" in formatted:
        formatted["load_ms_p90"] = format_metric_ms(formatted["load_ms_p90"], "load")

    if "first_infer_ms_p50" in formatted:
        formatted["first_infer_ms_p50"] = format_metric_ms(formatted["first_infer_ms_p50"], "inference")

    if "first_infer_ms_p90" in formatted:
        formatted["first_infer_ms_p90"] = format_metric_ms(formatted["first_infer_ms_p90"], "inference")

    if "subsequent_infer_ms_p50" in formatted:
        formatted["subsequent_infer_ms_p50"] = format_metric_ms(formatted["subsequent_infer_ms_p50"], "inference")

    if "subsequent_infer_ms_p90" in formatted:
        formatted["subsequent_infer_ms_p90"] = format_metric_ms(formatted["subsequent_infer_ms_p90"], "inference")

    # Format environment info
    if "memory_gb" in formatted:
        formatted["memory_gb"] = format_memory(formatted["memory_gb"])

    if "cpuCores" in formatted:
        formatted["cpuCores"] = format_cpu_cores(formatted["cpuCores"])

    if "duration_s" in formatted:
        formatted["duration_s"] = format_duration(formatted["duration_s"])

    # Format timestamp
    if "timestamp" in formatted:
        formatted["timestamp"] = format_timestamp(formatted["timestamp"])

    return formatted
