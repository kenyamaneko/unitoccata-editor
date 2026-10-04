import { ContactLine } from './ContactLine.tsx'
import { LegalDialog } from './LegalDialog.tsx'
import { LegalSection } from './LegalSection.tsx'
import { OPERATOR_NAME, SERVICE_NAME } from './legalContact.ts'

/** プライバシーポリシー。 */
export function PrivacyDialog() {
  return (
    <LegalDialog title="プライバシーポリシー">
      <p>
        {OPERATOR_NAME} (以下「当方」といいます) は、譜面エディタ「{SERVICE_NAME}」(以下「本サービス」といいます)
        における利用者の情報の取り扱いを、次のとおり定めます。
      </p>
      <LegalSection title="取得する情報">
        <ul className="list-disc pl-5">
          <li>ログインして利用する場合のアカウント情報 (メールアドレス、Google アカウントの識別子、表示名)</li>
          <li>ログインして利用する場合に利用者が保存した音源、プロジェクト情報、譜面</li>
          <li>サービスの提供に伴って Google Cloud と Firebase が記録するアクセスログ</li>
        </ul>
        <p>
          ログインせずに利用する場合、利用者の音源と譜面ファイルは利用者の端末のブラウザ内でのみ処理され、当方のサーバーには送信されません。
        </p>
      </LegalSection>
      <LegalSection title="利用目的">
        <ul className="list-disc pl-5">
          <li>本サービスの提供、本人の確認、利用者のファイルの保存と読み出しのため</li>
          <li>不具合の調査と、不正な利用の防止のため</li>
          <li>権利侵害のご連絡への対応のため</li>
        </ul>
      </LegalSection>
      <LegalSection title="第三者提供・委託先">
        <p>
          当方は、法令に基づく場合を除き、利用者の個人情報を第三者に提供しません。本サービスの運営には、Google LLC
          が提供する Firebase と Google Cloud を利用し、情報の保存と処理を委託しています。
        </p>
      </LegalSection>
      <LegalSection title="情報の開示・訂正・削除">
        <p>
          利用者は、当方が保有する自己の情報について、開示、訂正、削除を求めることができます。下記の窓口に連絡してください。
        </p>
      </LegalSection>
      <LegalSection title="お問い合わせ窓口">
        <ContactLine />
      </LegalSection>
      <LegalSection title="本ポリシーの変更">
        <p>
          当方は、必要に応じて本ポリシーを変更します。変更後の内容は、本サービス上に表示した時点から効力を生じます。
        </p>
      </LegalSection>
    </LegalDialog>
  )
}
