'use client'

import type { ReactNode } from 'react'

import SidebarNav from '@/components/layout/SidebarNav'
import TopHeader from '@/components/layout/TopHeader'
import DashboardShell from '@/components/shell/DashboardShell'

interface OverviewShellProps {
  children: ReactNode
  title?: string
}

export default function OverviewShell({ children, title }: OverviewShellProps) {
  return (
    <DashboardShell
      sidebar={<SidebarNav projectSubtitle="운영 담당" />}
      header={title ? <TopHeader title={title} /> : undefined}
    >
      {children}
    </DashboardShell>
  )
}
