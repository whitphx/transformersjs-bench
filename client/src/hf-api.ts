/**
 * Hugging Face API Client
 *
 * Uses the official @huggingface/hub library to search and retrieve models
 */

import { listModels } from "@huggingface/hub";
import type { ModelEntry, PipelineType } from "@huggingface/hub";
import { config as dotenvConfig } from "dotenv";

// Load environment variables from .env file
dotenvConfig();

export interface SearchModelsOptions {
  task?: PipelineType;
  search?: string;
  limit?: number;
}

/**
 * Search models on Hugging Face Hub
 */
export async function searchModels(options: SearchModelsOptions = {}): Promise<ModelEntry[]> {
  const { task, search, limit } = options;

  const resultGenerator = listModels({
    search: {
      task: task,
      query: search,
      tags: ["transformers.js"]
    },
    limit: limit,
    credentials: {
      accessToken: process.env.HF_TOKEN,
    },
  });

  const models: ModelEntry[] = [];
  // Fetch models using the official HF Hub library
  for await (const model of resultGenerator) {
    // Filter out private and gated models
    if (!model.private && !model.gated) {
      models.push(model);
    }

    // Stop when we reach the limit (if specified)
    if (limit !== undefined && models.length >= limit) {
      break;
    }
  }

  return models;
}

/**
 * Format model for display
 */
export function formatModel(model: ModelEntry): string {
  const downloads = model.downloads ? `${(model.downloads / 1000).toFixed(1)}k` : "N/A";
  const likes = model.likes || 0;
  const task = model.task || "unknown";
  const name = model.name || model.id;

  return `${name} | Task: ${task} | Downloads: ${downloads} | Likes: ${likes}`;
}
