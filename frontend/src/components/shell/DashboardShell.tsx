import type { ReactNode } from 'react'

import ContentContainer from '@/components/shell/ContentContainer'

interface Props {
  sidebar: ReactNode
  header?: ReactNode
  children: ReactNode
}

export default function DashboardShell({ sidebar, header, children }: Props) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950">
      <div className="grid min-h-dvh lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="hidden border-r border-slate-200/80 bg-white/95 backdrop-blur-sm lg:block">
          <div className="sticky top-0 h-dvh overflow-y-auto">
            {sidebar}
          </div>
        </div>

        <div className="min-w-0">
          {header ? (
            <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-sm shadow-slate-100/50">
              <ContentContainer>{header}</ContentContainer>
            </div>
          ) : null}

          <ContentContainer>
            <div className="px-2 py-3 sm:px-3 lg:px-3 xl:px-4">{children}</div>
          </ContentContainer>
        </div>
      </div>
    </div>
  )
}
