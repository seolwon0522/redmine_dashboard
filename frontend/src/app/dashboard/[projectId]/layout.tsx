import type { ReactNode } from 'react'

import { SidebarNav } from '@/components/layout/SidebarNav'
import { TopHeader } from '@/components/layout/TopHeader'
import DashboardProjectLayout from '@/components/shell/DashboardProjectLayout'
import DashboardShell from '@/components/shell/DashboardShell'
import CommandPalette from '@/components/shell/CommandPalette'

type DashboardLayoutProps = {
  children: ReactNode
  params: {
    projectId?: string
  }
}

function normalizeProjectId(projectId: string | undefined): string {
  if (!projectId || projectId === 'undefined' || projectId === 'null') {
    return 'bp-cloudpos'
  }

  return decodeURIComponent(projectId)
}

export default function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const projectId = normalizeProjectId(params?.projectId)

  return (
    <DashboardProjectLayout projectId={projectId}>
      <DashboardShell
        sidebar={<SidebarNav projectId={projectId} />}
        header={
          <TopHeader
            projectId={projectId}
            title="운영 대시보드"
            description="이슈, 담당자, 보고서, 설정을 한 흐름으로 관리합니다."
          />
        }
      >
        {children}
      </DashboardShell>
      <CommandPalette />
    </DashboardProjectLayout>
  )
}
