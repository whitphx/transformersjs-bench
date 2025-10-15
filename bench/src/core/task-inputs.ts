/**
 * Task-specific input generation for benchmarking
 * Based on Transformers.js usage examples
 */

export interface TaskInput {
  inputs: any;
  options?: any;
}

/**
 * Generate appropriate input for a given task type
 */
export function getTaskInput(task: string, batchSize: number = 1): TaskInput {
  // Normalize task name
  const normalizedTask = task.toLowerCase().trim();

  // Text tasks
  if (normalizedTask === "fill-mask") {
    const inputs = Array(batchSize).fill("The goal of life is [MASK].");
    return { inputs };
  }

  if (normalizedTask === "question-answering") {
    const question = "Who was Jim Henson?";
    const context = "Jim Henson was a nice puppet.";
    // For batch, repeat the same question-context pair
    const inputs = Array(batchSize).fill({ question, context });
    return { inputs: batchSize === 1 ? { question, context } : inputs };
  }

  if (normalizedTask === "summarization") {
    const text =
      "The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building, " +
      "and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on each side. " +
      "During its construction, the Eiffel Tower surpassed the Washington Monument to become the tallest " +
      "man-made structure in the world, a title it held for 41 years until the Chrysler Building in New " +
      "York City was finished in 1930.";
    const inputs = Array(batchSize).fill(text);
    return { inputs, options: { max_new_tokens: 100 } };
  }

  if (normalizedTask === "sentiment-analysis" || normalizedTask === "text-classification") {
    const inputs = Array(batchSize).fill("I love transformers!");
    return { inputs };
  }

  if (normalizedTask === "text-generation") {
    const inputs = Array(batchSize).fill("Once upon a time, there was");
    return { inputs, options: { max_new_tokens: 10 } };
  }

  if (normalizedTask === "text2text-generation") {
    const inputs = Array(batchSize).fill("how can I become more healthy?");
    return { inputs, options: { max_new_tokens: 100 } };
  }

  if (normalizedTask === "token-classification" || normalizedTask === "ner") {
    const inputs = Array(batchSize).fill("My name is Sarah and I live in London");
    return { inputs };
  }

  if (normalizedTask === "translation") {
    const inputs = Array(batchSize).fill("Life is like a box of chocolate.");
    return { inputs, options: { src_lang: "eng_Latn", tgt_lang: "fra_Latn" } };
  }

  if (normalizedTask === "zero-shot-classification") {
    const text = "I love transformers!";
    const labels = ["positive", "negative"];
    // For batching, would need to handle differently - for now use single input
    return { inputs: batchSize === 1 ? [text, labels] : Array(batchSize).fill([text, labels]) };
  }

  if (normalizedTask === "feature-extraction") {
    const inputs = Array(batchSize).fill("This is a simple test.");
    return { inputs };
  }

  // Vision tasks - use public image URLs
  if (normalizedTask === "background-removal") {
    const url = "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/portrait-of-woman_small.jpg";
    const inputs = Array(batchSize).fill(url);
    return { inputs };
  }

  if (normalizedTask === "depth-estimation") {
    const url = "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg";
    const inputs = Array(batchSize).fill(url);
    return { inputs };
  }

  if (normalizedTask === "image-classification") {
    const url = "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg";
    const inputs = Array(batchSize).fill(url);
    return { inputs };
  }

  if (normalizedTask === "image-segmentation") {
    const url = "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg";
    const inputs = Array(batchSize).fill(url);
    return { inputs };
  }

  if (normalizedTask === "image-to-image") {
    const url = "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg";
    const inputs = Array(batchSize).fill(url);
    return { inputs };
  }

  if (normalizedTask === "object-detection") {
    const url = "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg";
    const inputs = Array(batchSize).fill(url);
    return { inputs, options: { threshold: 0.9 } };
  }

  if (normalizedTask === "image-feature-extraction") {
    const url = "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/cats.png";
    const inputs = Array(batchSize).fill(url);
    return { inputs };
  }

  // Audio tasks
  if (normalizedTask === "audio-classification") {
    const url = "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav";
    const inputs = Array(batchSize).fill(url);
    return { inputs };
  }

  if (normalizedTask === "automatic-speech-recognition") {
    const url = "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav";
    const inputs = Array(batchSize).fill(url);
    return { inputs };
  }

  // Default fallback for unknown tasks - use text
  console.warn(`Unknown task type: ${task}, using default text input`);
  const inputs = Array(batchSize).fill("The quick brown fox jumps over the lazy dog.");
  return { inputs };
}
