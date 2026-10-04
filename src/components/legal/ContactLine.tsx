import { CONTACT_EMAIL } from './legalContact.ts'

/** お問い合わせ先を表示する。 */
export function ContactLine() {
  return (
    <p>
      メールアドレス:{' '}
      <a className="text-sky-400 underline" href={`mailto:${CONTACT_EMAIL}`}>
        {CONTACT_EMAIL}
      </a>
    </p>
  )
}
