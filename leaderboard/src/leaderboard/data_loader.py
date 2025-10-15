"""
Data loader module for loading benchmark results from HuggingFace Dataset.
"""

import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import pandas as pd
from huggingface_hub import HfApi, hf_hub_download, list_models

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
        api = HfApi(token=token)

        # List all files in the dataset repo
        files = api.list_repo_files(
            repo_id=dataset_repo,
            repo_type="dataset",
            token=token,
        )

        # Filter for .json files
        json_files = [f for f in files if f.endswith(".json")]

        if not json_files:
            return pd.DataFrame()

        # Load all benchmark results
        all_results = []
        for file_path in json_files:
            try:
                result = load_single_benchmark_file(
                    dataset_repo=dataset_repo,
                    file_path=file_path,
                    token=token,
                )
                if result:
                    flattened = flatten_result(result)
                    all_results.append(flattened)
            except Exception as e:
                logger.error(f"Error loading {file_path}: {e}")
                continue

        if not all_results:
            return pd.DataFrame()

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


def load_single_benchmark_file(
    dataset_repo: str,
    file_path: str,
    token: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Load a single benchmark result file from HuggingFace Dataset.

    Args:
        dataset_repo: HuggingFace dataset repository ID
        file_path: Path to the JSON file within the dataset
        token: HuggingFace API token (optional)

    Returns:
        Dictionary containing the benchmark result, or None if failed
    """
    try:
        # Download the file
        local_path = hf_hub_download(
            repo_id=dataset_repo,
            filename=file_path,
            repo_type="dataset",
            token=token,
        )

        # Read JSON file (single object per file)
        with open(local_path, "r") as f:
            return json.load(f)

    except Exception as e:
        logger.error(f"Error loading file {file_path}: {e}")
        return None


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
