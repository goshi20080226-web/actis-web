import "./Privacy.css"

function Privacy() {
  return (
    <div className="privacy-page">
      <div className="privacy-header">
        <p className="eyebrow">PRIVACY POLICY</p>
        <h1>プライバシーポリシー</h1>
        <p>ACTIS（Advanced Crew & Train Information System）における個人情報等の取扱いについて定めます。</p>
      </div>

      <div className="privacy-content">
        <section>
          <h2>1. 収集する情報</h2>
          <p>ACTISでは、サービスの提供に必要な範囲で、以下の情報を取り扱う場合があります。</p>
          <ul>
            <li>メールアドレス、Firebase AuthenticationのユーザーIDなどのアカウント情報</li>
            <li>GoogleやDiscordなど、ユーザーが任意で連携した外部サービスのアカウント情報</li>
            <li>ユーザーがACTIS上で作成・アップロードしたダイヤ、列車、路線、スタフ等のデータ</li>
            <li>サービスの動作確認、障害対応、セキュリティ確保のために必要となる技術情報</li>
          </ul>
        </section>

        <section>
          <h2>2. 情報の利用目的</h2>
          <p>取得した情報は、主に以下の目的で利用します。</p>
          <ul>
            <li>ACTISへのログインおよびアカウント管理</li>
            <li>ダイヤ、列車、路線、スタフ等の機能を提供するため</li>
            <li>Google・Discord等とのアカウント連携を提供するため</li>
            <li>不正利用、迷惑行為、セキュリティ上の問題への対応</li>
            <li>障害の調査、サービスの改善および運用管理</li>
          </ul>
        </section>

        <section>
          <h2>3. 外部サービスの利用</h2>
          <p>ACTISでは、認証・データ保存・サービス運用のために、Firebase、Cloudflare等の外部サービスを利用しています。また、ユーザーが任意でGoogleまたはDiscordとの連携を行った場合、各サービスから提供される認証情報をACTISのアカウント連携に利用します。</p>
          <p>外部サービスにおける情報の取扱いについては、それぞれのサービスが定めるプライバシーポリシー等もご確認ください。</p>
        </section>

        <section>
          <h2>4. データの保存・管理</h2>
          <p>ACTISのアカウント情報やユーザーが保存したデータは、サービス運営に必要な期間、利用する場合があります。取得した情報について、適切なアクセス制御等を行い、不正アクセスや漏えいの防止に努めます。</p>
        </section>

        <section>
          <h2>5. 第三者への提供</h2>
          <p>取得した個人情報を、本人の同意なく、原則として第三者へ販売または提供することはありません。ただし、法令に基づく場合、サービスの提供に必要な外部サービスへの送信、その他正当な理由がある場合を除きます。</p>
        </section>

        <section>
          <h2>6. ユーザーによるデータ削除</h2>
          <p>ACTISでは、ユーザーが作成したダイヤ、列車、路線等のデータを、サービス上の機能から削除できる場合があります。アカウント情報の削除や、サービス上から削除できない情報については、下記の問い合わせ先までご連絡ください。</p>
        </section>

        <section>
          <h2>7. 著作権・知的財産権</h2>
          <p>ACTIS（Advanced Crew & Train Information System）のプログラム、画面デザイン、ロゴ、文章、その他のコンテンツに関する著作権その他の知的財産権は、特に記載がない限り、<strong>goshi4058</strong>に帰属します。</p>
          <p>ACTIS上でユーザーが作成・アップロードしたダイヤ、列車、路線、スタフ等のデータについては、ユーザー自身が権利を有する範囲を除き、ACTISまたは第三者が権利を有するものを無断で利用してはなりません。</p>
          <p>法令で認められる場合を除き、ACTISのコンテンツを無断で複製、転載、改変、再配布、販売等することを禁止します。</p>
        </section>

        <section>
          <h2>8. プライバシーポリシーの変更</h2>
          <p>本ポリシーは、サービスの変更や法令等への対応のため、必要に応じて変更することがあります。変更後のポリシーは、ACTIS上に掲載した時点から適用します。</p>
        </section>

        <section>
          <h2>9. お問い合わせ</h2>
          <p>ACTISの個人情報の取扱いに関するお問い合わせは、ACTISの運営者までご連絡ください。</p>
          <p className="privacy-note">※連絡先は今後、ACTIS上に掲載する予定です。</p>
        </section>

        <section className="privacy-meta">
          <p>著作権者：goshi4058</p>
          <p>制定日：2026年9月30日</p>
          <p>対象サービス：ACTIS（Advanced Crew & Train Information System）</p>
        </section>
      </div>
    </div>
  )
}

export default Privacy
