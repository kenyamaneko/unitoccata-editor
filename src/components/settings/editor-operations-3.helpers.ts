import type { AppDriver } from '../../test/app.tsx'

export async function closeProjectInfoAndScrollToTop(app: AppDriver): Promise<void> {
  await app.projectInfo.close()
  await app.scrollbar.dragThumbToTop()
}
