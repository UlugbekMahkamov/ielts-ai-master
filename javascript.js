// Articles
{
  id, title, content, created_at,
  comprehension_questions: [...],
  speaking_prompts: [...],
  writing_prompts: [...],
  vocabulary_tiers: {...},
  collocations: [...],
  sentence_patterns: [...]
}

// Vocabulary
{
  id, word, translation, ipa, level,
  interval_stage, next_review_date,
  repetitions, is_learned
}

// Mistakes
{
  id, original_text, corrected_text,
  explanation, error_type, source_type
}