/**
 * Presentational rendering of a journal summary's markdown-ish text. Shared by
 * the dashboard card (live generation) and the history modal (archived reports).
 */
export function JournalSummaryBody({ summary }: { summary: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none text-neutral-300 leading-relaxed [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-white [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-neutral-200 [&_strong]:text-white [&_ul]:space-y-1 [&_li]:text-sm">
      {summary.split('\n').map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        const formatted = line
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/^### (.*)/, '<h3>$1</h3>')
          .replace(/^## (.*)/, '<h2>$1</h2>')
          .replace(/^# (.*)/, '<h1>$1</h1>')
          .replace(/^[*-] (.*)/, '<li>$1</li>');
        return <div key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
      })}
    </div>
  );
}
