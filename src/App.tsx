import { EditorScreen } from './components/layout/EditorScreen.tsx'

/** アプリの画面。エディタ画面だけで、利用規約、プライバシーポリシー、ログインは、アドレスの hash に応じて、エディタ画面に重ねたダイアログとして出す。 */
export function App() {
  return <EditorScreen />
}
