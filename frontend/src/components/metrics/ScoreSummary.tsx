import type { PipelineSummary } from '../../types/metrics'

export interface ScoreSummaryProps {
  pipeline: PipelineSummary
}

const NOT_AVAILABLE_YET = 'Not available yet'

function formatScore(value: number): string {
  return value.toFixed(2)
}

/**
 * Pipeline detail display, grouped by RAG stage (020-metrics-stage-groups spec FR-001–FR-004):
 * a "Retrieval" section (chunking technique, embedding model, retrieval strategy, Context
 * Precision, Context Recall) and a "Generation" section (generation LLM, Response Relevancy,
 * Faithfulness), with the judge LLM shown once since a single judge call scores both sections.
 * Extracted from MetricsScreen so it can be reused both for the single-pipeline view and (US2's)
 * selected pipeline.
 */
export function ScoreSummary({ pipeline }: ScoreSummaryProps) {
  const hasScores = pipeline.scores !== null

  return (
    <div>
      <dl className="grid grid-cols-3 gap-4">
        <div>
          <dt className="text-xs uppercase text-on-surface-variant">Questions asked</dt>
          <dd data-testid="metrics-question-count" className="text-lg text-on-surface">
            {pipeline.questionCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-on-surface-variant">Answers received</dt>
          <dd data-testid="metrics-answer-count" className="text-lg text-on-surface">
            {pipeline.answerCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-on-surface-variant">Question scope</dt>
          <dd data-testid="metrics-scope-breakdown" className="text-lg text-on-surface">
            {pipeline.scopeBreakdown.corpus} entire corpus / {pipeline.scopeBreakdown.document}{' '}
            individual document
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-on-surface-variant">
        Scored by: <span data-testid="metrics-judge-llm">{pipeline.judgeLlm ?? NOT_AVAILABLE_YET}</span>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <section data-testid="metrics-retrieval-section" aria-labelledby="metrics-retrieval-heading">
          <h3 id="metrics-retrieval-heading" className="text-sm font-semibold text-on-surface">
            Retrieval
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs uppercase text-on-surface-variant">Chunking technique</dt>
              <dd data-testid="metrics-technique" className="text-lg text-on-surface">
                {pipeline.chunkingStrategy}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-on-surface-variant">Embedding model</dt>
              <dd data-testid="metrics-embedding-model" className="text-lg text-on-surface">
                {pipeline.embeddingModel}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-on-surface-variant">Retrieval strategy</dt>
              <dd data-testid="metrics-retrieval-strategy" className="text-lg text-on-surface">
                {pipeline.retrievalStrategy}
              </dd>
            </div>
          </dl>
          {hasScores ? (
            <dl data-testid="metrics-retrieval-scores" className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs uppercase text-on-surface-variant">Context Precision</dt>
                <dd className="text-lg text-on-surface">{formatScore(pipeline.scores!.contextPrecision)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-on-surface-variant">Context Recall</dt>
                <dd className="text-lg text-on-surface">{formatScore(pipeline.scores!.contextRecall)}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        <section data-testid="metrics-generation-section" aria-labelledby="metrics-generation-heading">
          <h3 id="metrics-generation-heading" className="text-sm font-semibold text-on-surface">
            Generation
          </h3>
          <dl className="mt-2 grid grid-cols-1 gap-4">
            <div>
              <dt className="text-xs uppercase text-on-surface-variant">Generation LLM</dt>
              <dd data-testid="metrics-generation-llm" className="text-lg text-on-surface">
                {pipeline.generationLlm ?? NOT_AVAILABLE_YET}
              </dd>
            </div>
          </dl>
          {hasScores ? (
            <dl data-testid="metrics-generation-scores" className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs uppercase text-on-surface-variant">Response Relevancy</dt>
                <dd className="text-lg text-on-surface">{formatScore(pipeline.scores!.responseRelevancy)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-on-surface-variant">Faithfulness</dt>
                <dd className="text-lg text-on-surface">{formatScore(pipeline.scores!.faithfulness)}</dd>
              </div>
            </dl>
          ) : null}
        </section>
      </div>

      {!hasScores && (
        <p data-testid="metrics-no-scores" className="mt-6 text-on-surface-variant">
          Not enough data yet — quality scores appear once questions have been asked and
          answered.
        </p>
      )}
    </div>
  )
}
