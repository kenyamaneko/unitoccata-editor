import type { ReactNode } from 'react'

/** 法務の文書内の、見出し付きの節。 */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </section>
  )
}
