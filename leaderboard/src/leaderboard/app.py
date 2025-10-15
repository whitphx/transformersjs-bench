"""
Transformers.js Benchmark Leaderboard

A Gradio app that displays benchmark results from a HuggingFace Dataset repository.
"""

import os
import pandas as pd
import gradio as gr
from dotenv import load_dotenv

from leaderboard.data_loader import (
    load_benchmark_data,
    get_unique_values,
)
from leaderboard.formatters import apply_formatting

# Load environment variables
load_dotenv()

HF_DATASET_REPO = os.getenv("HF_DATASET_REPO")
HF_TOKEN = os.getenv("HF_TOKEN")


def load_data() -> pd.DataFrame:
    """Load benchmark data from configured HF Dataset repository."""
    # Load raw data
    df = load_benchmark_data(
        dataset_repo=HF_DATASET_REPO,
        token=HF_TOKEN,
    )

    # Apply formatting to each row
    if not df.empty:
        df = df.apply(lambda row: pd.Series(apply_formatting(row.to_dict())), axis=1)

    return df


def filter_data(
    df: pd.DataFrame,
    model_filter: str,
    task_filter: str,
    platform_filter: str,
    device_filter: str,
    mode_filter: str,
    dtype_filter: str,
) -> pd.DataFrame:
    """Filter benchmark data based on user inputs."""
    if df.empty:
        return df

    filtered = df.copy()

    # Model name filter
    if model_filter:
        filtered = filtered[
            filtered["modelId"].str.contains(model_filter, case=False, na=False)
        ]

    # Task filter
    if task_filter and task_filter != "All":
        filtered = filtered[filtered["task"] == task_filter]

    # Platform filter
    if platform_filter and platform_filter != "All":
        filtered = filtered[filtered["platform"] == platform_filter]

    # Device filter
    if device_filter and device_filter != "All":
        filtered = filtered[filtered["device"] == device_filter]

    # Mode filter
    if mode_filter and mode_filter != "All":
        filtered = filtered[filtered["mode"] == mode_filter]

    # DType filter
    if dtype_filter and dtype_filter != "All":
        filtered = filtered[filtered["dtype"] == dtype_filter]

    return filtered


def create_leaderboard_ui():
    """Create the Gradio UI for the leaderboard."""

    # Load initial data
    df = load_data()

    with gr.Blocks(title="Transformers.js Benchmark Leaderboard") as demo:
        gr.Markdown("# 🏆 Transformers.js Benchmark Leaderboard")
        gr.Markdown(
            "Compare benchmark results for different models, platforms, and configurations."
        )

        if not HF_DATASET_REPO:
            gr.Markdown(
                "⚠️ **HF_DATASET_REPO not configured.** "
                "Please set the environment variable to load benchmark data."
            )

        with gr.Row():
            refresh_btn = gr.Button("🔄 Refresh Data", variant="primary")

        with gr.Row():
            model_filter = gr.Textbox(
                label="Model Name",
                placeholder="Filter by model name (e.g., 'bert', 'gpt')",
            )
            task_filter = gr.Dropdown(
                label="Task",
                choices=get_unique_values(df, "task"),
                value="All",
            )

        with gr.Row():
            platform_filter = gr.Dropdown(
                label="Platform",
                choices=get_unique_values(df, "platform"),
                value="All",
            )
            device_filter = gr.Dropdown(
                label="Device",
                choices=get_unique_values(df, "device"),
                value="All",
            )

        with gr.Row():
            mode_filter = gr.Dropdown(
                label="Mode",
                choices=get_unique_values(df, "mode"),
                value="All",
            )
            dtype_filter = gr.Dropdown(
                label="DType",
                choices=get_unique_values(df, "dtype"),
                value="All",
            )

        results_table = gr.DataFrame(
            value=df,
            label="Benchmark Results",
            interactive=False,
            wrap=True,
        )

        gr.Markdown("### 📊 Metrics")
        gr.Markdown(
            "**Benchmark Metrics:**\n"
            "- **load_ms**: Model loading time in milliseconds\n"
            "- **first_infer_ms**: First inference time in milliseconds\n"
            "- **subsequent_infer_ms**: Subsequent inference time in milliseconds\n"
            "- **p50/p90**: 50th and 90th percentile values\n\n"
            "**HuggingFace Metrics:**\n"
            "- **downloads**: Total downloads from HuggingFace Hub\n"
            "- **likes**: Number of likes on HuggingFace Hub"
        )

        def update_data():
            """Reload data from HuggingFace."""
            new_df = load_data()
            return (
                new_df,
                gr.update(choices=get_unique_values(new_df, "task")),
                gr.update(choices=get_unique_values(new_df, "platform")),
                gr.update(choices=get_unique_values(new_df, "device")),
                gr.update(choices=get_unique_values(new_df, "mode")),
                gr.update(choices=get_unique_values(new_df, "dtype")),
            )

        def apply_filters(df, model, task, platform, device, mode, dtype):
            """Apply filters and return filtered DataFrame."""
            return filter_data(df, model, task, platform, device, mode, dtype)

        # Refresh button updates data and resets filters
        refresh_btn.click(
            fn=update_data,
            outputs=[
                results_table,
                task_filter,
                platform_filter,
                device_filter,
                mode_filter,
                dtype_filter,
            ],
        )

        # Filter inputs update the table
        filter_inputs = [
            results_table,
            model_filter,
            task_filter,
            platform_filter,
            device_filter,
            mode_filter,
            dtype_filter,
        ]

        model_filter.change(
            fn=apply_filters,
            inputs=filter_inputs,
            outputs=results_table,
        )
        task_filter.change(
            fn=apply_filters,
            inputs=filter_inputs,
            outputs=results_table,
        )
        platform_filter.change(
            fn=apply_filters,
            inputs=filter_inputs,
            outputs=results_table,
        )
        device_filter.change(
            fn=apply_filters,
            inputs=filter_inputs,
            outputs=results_table,
        )
        mode_filter.change(
            fn=apply_filters,
            inputs=filter_inputs,
            outputs=results_table,
        )
        dtype_filter.change(
            fn=apply_filters,
            inputs=filter_inputs,
            outputs=results_table,
        )

    return demo


demo = create_leaderboard_ui()
demo.launch(server_name="0.0.0.0", server_port=7861)
