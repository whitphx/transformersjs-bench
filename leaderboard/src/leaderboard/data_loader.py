"""
Data loader module for loading benchmark results from HuggingFace Dataset.
"""

import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
import pandas as pd
from huggingface_hub import snapshot_download, list_models

logger = logging.getLogger(__name__)


def load_benchmark_data(
    dataset_repo: str,
    token: Optional[str] = None,
) -> pd.DataFrame:
    """Load benchmark data from HuggingFace Dataset repository.

    Args:
        dataset_repo: HuggingFace dataset repository ID (e.g., "username/dataset-name")
        token: HuggingFace API token (optional, for private datasets)

    Returns:
        DataFrame containing all benchmark results
    """
    if not dataset_repo:
        return pd.DataFrame()

    try:
        # Download the entire repository snapshot
        logger.info(f"Downloading dataset snapshot from {dataset_repo}...")
        local_dir = snapshot_download(
            repo_id=dataset_repo,
            repo_type="dataset",
            token=token,
        )
        logger.info(f"Dataset downloaded to {local_dir}")

        # Find all JSON files in the downloaded directory
        local_path = Path(local_dir)
        json_files = list(local_path.rglob("*.json"))

        if not json_files:
            logger.warning("No JSON files found in dataset")
            return pd.DataFrame()

        logger.info(f"Found {len(json_files)} JSON files")

        # Load all benchmark results
        all_results = []
        for file_path in json_files:
            try:
                with open(file_path, "r") as f:
                    result = json.load(f)

                if result:
                    flattened = flatten_result(result)
                    all_results.append(flattened)
            except Exception as e:
                logger.error(f"Error loading {file_path}: {e}")
                continue

        if not all_results:
            return pd.DataFrame()

        logger.info(f"Loaded {len(all_results)} benchmark results")

        # Convert to DataFrame
        df = pd.DataFrame(all_results)

        # Enrich with HuggingFace model metadata
        df = enrich_with_hf_metadata(df)

        # Sort by model name and timestamp
        if "modelId" in df.columns and "timestamp" in df.columns:
            df = df.sort_values(["modelId", "timestamp"], ascending=[True, False])

        return df

    except Exception as e:
        logger.error(f"Error loading benchmark data: {e}")
        return pd.DataFrame()


def flatten_result(result: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten nested benchmark result for display.

    The HF Dataset format is already flattened by the bench service,
    so we just need to extract the relevant fields.

    Args:
        result: Raw benchmark result dictionary

    Returns:
        Flattened dictionary with extracted fields
    """
    # Convert timestamp from milliseconds to datetime
    timestamp_ms = result.get("timestamp", 0)
    timestamp_dt = None
    if timestamp_ms:
        try:
            timestamp_dt = datetime.fromtimestamp(timestamp_ms / 1000)
        except (ValueError, OSError):
            timestamp_dt = None

    flat = {
        "id": result.get("id", ""),
        "platform": result.get("platform", ""),
        "modelId": result.get("modelId", ""),
        "task": result.get("task", ""),
        "mode": result.get("mode", ""),
        "repeats": result.get("repeats", 0),
        "batchSize": result.get("batchSize", 0),
        "device": result.get("device", ""),
        "browser": result.get("browser", ""),
        "dtype": result.get("dtype", ""),
        "headed": result.get("headed", False),
        "status": result.get("status", ""),
        "timestamp": timestamp_dt,
        "runtime": result.get("runtime", ""),
    }

    # Extract metrics if available (already at top level)
    if "metrics" in result:
        metrics = result["metrics"]

        # Load time
        if "load_ms" in metrics and "p50" in metrics["load_ms"]:
            flat["load_ms_p50"] = metrics["load_ms"]["p50"]
            flat["load_ms_p90"] = metrics["load_ms"]["p90"]

        # First inference time
        if "first_infer_ms" in metrics and "p50" in metrics["first_infer_ms"]:
            flat["first_infer_ms_p50"] = metrics["first_infer_ms"]["p50"]
            flat["first_infer_ms_p90"] = metrics["first_infer_ms"]["p90"]

        # Subsequent inference time
        if "subsequent_infer_ms" in metrics and "p50" in metrics["subsequent_infer_ms"]:
            flat["subsequent_infer_ms_p50"] = metrics["subsequent_infer_ms"]["p50"]
            flat["subsequent_infer_ms_p90"] = metrics["subsequent_infer_ms"]["p90"]

    # Extract environment info (already at top level)
    if "environment" in result:
        env = result["environment"]
        flat["cpuCores"] = env.get("cpuCores", 0)
        if "memory" in env:
            flat["memory_gb"] = env["memory"].get("deviceMemory", 0)

    # Calculate duration
    if "completedAt" in result and "startedAt" in result:
        flat["duration_s"] = (result["completedAt"] - result["startedAt"]) / 1000

    return flat


def enrich_with_hf_metadata(df: pd.DataFrame) -> pd.DataFrame:
    """Enrich benchmark data with HuggingFace model metadata (downloads, likes).

    Args:
        df: DataFrame containing benchmark results
        token: HuggingFace API token (optional)

    Returns:
        DataFrame with added downloads and likes columns
    """
    if df.empty or "modelId" not in df.columns:
        return df

    # Get unique model IDs
    model_ids = df["modelId"].unique().tolist()

    # Fetch metadata for all models
    model_metadata = {}
    logger.info(f"Fetching metadata for {len(model_ids)} models from HuggingFace...")

    try:
        for model in list_models(filter=["transformers.js"]):
            if model.id in model_ids:
                model_metadata[model.id] = {
                    "downloads": model.downloads or 0,
                    "likes": model.likes or 0,
                }

                # Break early if we have all models
                if len(model_metadata) == len(model_ids):
                    break

    except Exception as e:
        logger.error(f"Error fetching HuggingFace metadata: {e}")

    # Add metadata to dataframe
    df["downloads"] = df["modelId"].map(lambda x: model_metadata.get(x, {}).get("downloads", 0))
    df["likes"] = df["modelId"].map(lambda x: model_metadata.get(x, {}).get("likes", 0))

    return df


def get_first_timer_friendly_models(df: pd.DataFrame, limit_per_task: int = 3) -> pd.DataFrame:
    """Identify first-timer-friendly models based on popularity and performance, grouped by task.

    A model is considered first-timer-friendly if it:
    - Has high downloads (popular)
    - Has fast load times (easy to start)
    - Has fast inference times (quick results)
    - Successfully completed benchmarks

    Args:
        df: DataFrame containing benchmark results
        limit_per_task: Maximum number of models to return per task

    Returns:
        DataFrame with top first-timer-friendly models per task
    """
    if df.empty:
        return pd.DataFrame()

    # Filter only successful benchmarks
    filtered = df[df["status"] == "completed"].copy() if "status" in df.columns else df.copy()

    if filtered.empty:
        return pd.DataFrame()

    # Check if task column exists
    if "task" not in filtered.columns:
        logger.warning("Task column not found in dataframe")
        return pd.DataFrame()

    # Calculate first-timer-friendliness score per task
    all_results = []

    for task in filtered["task"].unique():
        task_df = filtered[filtered["task"] == task].copy()

        if task_df.empty:
            continue

        # Normalize metrics within this task (lower is better for times, higher is better for popularity)

        # Downloads score (0-1, higher is better)
        if "downloads" in task_df.columns:
            max_downloads = task_df["downloads"].max()
            task_df["downloads_score"] = task_df["downloads"] / max_downloads if max_downloads > 0 else 0
        else:
            task_df["downloads_score"] = 0

        # Likes score (0-1, higher is better)
        if "likes" in task_df.columns:
            max_likes = task_df["likes"].max()
            task_df["likes_score"] = task_df["likes"] / max_likes if max_likes > 0 else 0
        else:
            task_df["likes_score"] = 0

        # Load time score (0-1, lower time is better)
        if "load_ms_p50" in task_df.columns:
            max_load = task_df["load_ms_p50"].max()
            task_df["load_score"] = 1 - (task_df["load_ms_p50"] / max_load) if max_load > 0 else 0
        else:
            task_df["load_score"] = 0

        # Inference time score (0-1, lower time is better)
        if "first_infer_ms_p50" in task_df.columns:
            max_infer = task_df["first_infer_ms_p50"].max()
            task_df["infer_score"] = 1 - (task_df["first_infer_ms_p50"] / max_infer) if max_infer > 0 else 0
        else:
            task_df["infer_score"] = 0

        # Calculate weighted first-timer-friendliness score
        # Weights: popularity (40%), load time (30%), inference time (30%)
        task_df["first_timer_score"] = (
            (task_df["downloads_score"] * 0.25) +
            (task_df["likes_score"] * 0.15) +
            (task_df["load_score"] * 0.30) +
            (task_df["infer_score"] * 0.30)
        )

        # Group by model and take best score for each model within this task
        # Filter out NaN scores before getting idxmax
        idx_max_series = task_df.groupby("modelId")["first_timer_score"].idxmax()
        # Drop NaN indices
        valid_indices = idx_max_series.dropna()
        if valid_indices.empty:
            continue
        best_per_model = task_df.loc[valid_indices]

        # Sort by first-timer score and take top N for this task
        top_for_task = best_per_model.sort_values("first_timer_score", ascending=False).head(limit_per_task)

        # Drop intermediate scoring columns
        score_cols = ["downloads_score", "likes_score", "load_score", "infer_score", "first_timer_score"]
        top_for_task = top_for_task.drop(columns=[col for col in score_cols if col in top_for_task.columns])

        all_results.append(top_for_task)

    if not all_results:
        return pd.DataFrame()

    # Combine all results
    result = pd.concat(all_results, ignore_index=True)

    # Sort by task name for better organization
    if "task" in result.columns:
        result = result.sort_values("task")

    return result


def get_unique_values(df: pd.DataFrame, column: str) -> List[str]:
    """Get unique values from a column for dropdown choices.

    Args:
        df: DataFrame to extract values from
        column: Column name

    Returns:
        List of unique values with "All" as first item
    """
    if df.empty or column not in df.columns:
        return ["All"]

    values = df[column].dropna().unique().tolist()
    return ["All"] + sorted([str(v) for v in values])
