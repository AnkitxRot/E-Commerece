import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { IMAGE_CREDITS } from '../data/imageCredits.js';

export default function ImageCreditsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs items={[{ label: 'Image credits' }]} />
      <h1 className="mb-2 text-2xl font-semibold tracking-[-0.01em] text-ink">Image credits</h1>
      <p className="mb-8 max-w-2xl text-sm text-ink-muted">
        Product photography on this demo storefront is sourced from Wikimedia Commons. Each photo is
        credited below to its author and license, as required by the license terms.
      </p>
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {IMAGE_CREDITS.map((credit) => (
          <li key={credit.filename} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-4">
            <img
              src={credit.url}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              decoding="async"
              className="h-16 w-16 shrink-0 rounded-md border border-border object-cover"
            />
            <div className="min-w-0 text-sm">
              <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline">
                {credit.filename}
              </a>
              <p className="text-ink-muted">
                {credit.artist ? <>© {credit.artist} — </> : null}
                {credit.licenseUrl ? (
                  <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {credit.license}
                  </a>
                ) : (
                  credit.license
                )}
                {!credit.artist ? ' — see file page for full credit' : null}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
