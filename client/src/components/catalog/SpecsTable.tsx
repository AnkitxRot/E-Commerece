export function SpecsTable({ specs }: { specs: Record<string, string> }) {
  const entries = Object.entries(specs);
  if (entries.length === 0) return null;
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key} className="border-b border-border last:border-0">
            <th scope="row" className="w-2/5 py-3 pr-4 text-left font-medium text-ink-muted">
              {key}
            </th>
            <td className="py-3 text-ink">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
