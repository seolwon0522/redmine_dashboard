import ProjectSwitcher from '@/components/ProjectSwitcher'

type TopHeaderProps = {
  title?: string
  description?: string
  projectId?: string
}

export function TopHeader({
  title = '운영 대시보드',
  description = 'Redmine 이슈를 운영 흐름과 우선순위 관점으로 재해석합니다.',
  projectId,
}: TopHeaderProps) {
  return (
    <header className="flex min-h-16 flex-col items-stretch justify-between gap-3 px-4 py-3 sm:px-5 md:flex-row md:items-center xl:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-0.5 truncate text-sm font-medium text-slate-500">{description}</p>
      </div>

      {projectId ? (
        <div className="flex shrink-0 items-center justify-end">
          <ProjectSwitcher currentProjectId={projectId} />
        </div>
      ) : null}
    </header>
  )
}

export default TopHeader
