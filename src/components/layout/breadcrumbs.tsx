import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Breadcrumb = {
  label: string
  to?: '/objects' | '/objects/$objectId'
  objectId?: string
}

export function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  const { t } = useTranslation()

  return (
    <nav aria-label={t('breadcrumbs.label')} className="mb-5">
      <ol className="text-muted-ink flex min-w-0 items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const current = index === items.length - 1
          const label = item.to ? (
            item.to === '/objects/$objectId' && item.objectId ? (
              <Link
                to="/objects/$objectId"
                params={{ objectId: item.objectId }}
                className="hover:text-ink rounded-sm focus-visible:outline-2"
              >
                {item.label}
              </Link>
            ) : (
              <Link
                to="/objects"
                className="hover:text-ink rounded-sm focus-visible:outline-2"
              >
                {item.label}
              </Link>
            )
          ) : (
            <span
              aria-current={current ? 'page' : undefined}
              className="truncate"
            >
              {item.label}
            </span>
          )

          return (
            <li
              key={`${item.label}-${index}`}
              className="flex min-w-0 items-center gap-1.5"
            >
              {index > 0 && (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
              )}
              {label}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
