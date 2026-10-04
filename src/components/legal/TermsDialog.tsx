import { BYTES_PER_MEGABYTE, MAX_AUDIO_FILE_BYTES } from '../../domain/constants.ts'
import { ContactLine } from './ContactLine.tsx'
import { LegalDialog } from './LegalDialog.tsx'
import { LegalSection } from './LegalSection.tsx'
import { OPERATOR_NAME, SERVICE_NAME } from './legalContact.ts'

/** 利用規約。 */
export function TermsDialog() {
  return (
    <LegalDialog title="利用規約">
      <p>
        この利用規約 (以下「本規約」といいます) は、{OPERATOR_NAME} (以下「当方」といいます) が提供する譜面エディタ「
        {SERVICE_NAME}」(以下「本サービス」といいます) の利用条件を定めるものです。本サービスを利用する方
        (以下「利用者」といいます) は、本規約に同意したうえで利用するものとします。
      </p>
      <LegalSection title="第1条 (適用)">
        <p>本規約は、本サービスの利用に関わる当方と利用者との間の一切の関係に適用されます。</p>
      </LegalSection>
      <LegalSection title="第2条 (ログインと保存)">
        <p>
          ログインせずに利用する場合、利用者は音源と譜面ファイルを、利用のたびに自分の端末からアップロードし、変更後のファイルを自分の端末へダウンロードします。この場合、これらのファイルは当方のサーバーには保存されません。
        </p>
        <p>
          ログインして利用する場合、利用者のファイルは当方が管理する Google Cloud
          のデータベースとストレージに保存されます。ログインには Google の Firebase Authentication
          を利用します。利用者は、認証情報を自己の責任で管理するものとします。
        </p>
      </LegalSection>
      <LegalSection title="第3条 (利用料金)">
        <p>本サービスの利用料金は、当方が別に定めない限り無料です。</p>
      </LegalSection>
      <LegalSection title="第4条 (利用者のファイル)">
        <p>
          利用者は、アップロードする音源、譜面その他のファイルについて、自らが権利を有するか、権利者から利用の許諾を得たものに限ってアップロードするものとします。
        </p>
        <p>
          利用者のファイルの権利は、利用者または正当な権利者に帰属します。当方は、本サービスの提供に必要な範囲に限って、利用者のファイルを保存し、処理します。
        </p>
      </LegalSection>
      <LegalSection title="第5条 (ファイルの大きさの上限)">
        <p>
          1 ファイルの大きさは {MAX_AUDIO_FILE_BYTES / BYTES_PER_MEGABYTE} MB
          までです。当方は、運営上必要な場合に、この上限を変更することがあります。
        </p>
      </LegalSection>
      <LegalSection title="第6条 (禁止事項)">
        <p>利用者は、本サービスの利用にあたり、次の行為をしてはなりません。</p>
        <ul className="list-disc pl-5">
          <li>法令または公序良俗に違反する行為</li>
          <li>第三者の著作権その他の権利を侵害するファイルをアップロードする行為</li>
          <li>当方または第三者の権利・利益を侵害する行為</li>
          <li>本サービスの運営を妨害する行為</li>
          <li>不正アクセスその他本サービスのセキュリティを侵害する行為</li>
        </ul>
      </LegalSection>
      <LegalSection title="第7条 (権利侵害のご連絡と削除)">
        <p>
          本サービスに保存されたファイルが自らの権利を侵害していると考える権利者は、次のメールアドレスに連絡してください。当方は、連絡の内容を確認し、権利侵害が認められる場合は、該当するファイルを削除します。
        </p>
        <ContactLine />
      </LegalSection>
      <LegalSection title="第8条 (本サービスの変更・中断・終了)">
        <p>当方は、利用者に通知したうえで、本サービスの内容を変更し、または提供を中断・終了することがあります。</p>
      </LegalSection>
      <LegalSection title="第9条 (免責事項)">
        <p>当方は、本サービスに事実上または法律上の瑕疵がないことを保証するものではありません。</p>
        <p>
          本サービスの利用により生じた損害について、当方に故意または重過失がある場合を除き、当方は責任を負いません。
        </p>
      </LegalSection>
      <LegalSection title="第10条 (本規約の変更)">
        <p>
          当方は、必要と判断した場合に、利用者に通知したうえで本規約を変更できます。変更後の本規約は、本サービス上に表示した時点から効力を生じます。
        </p>
      </LegalSection>
      <LegalSection title="第11条 (準拠法・管轄裁判所)">
        <p>
          本規約は日本法に従って解釈します。本サービスに関して紛争が生じた場合は、当方の所在地を管轄する裁判所を専属的合意管轄とします。
        </p>
      </LegalSection>
    </LegalDialog>
  )
}
