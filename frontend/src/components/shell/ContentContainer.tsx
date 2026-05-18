import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

export default function ContentContainer({ children, className = '' }: Props) {
  return (
    <div className={['w-full', className].join(' ')}>{children}</div>
  )
}
