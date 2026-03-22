function LegalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-page text-text" role="dialog" aria-modal="true" aria-labelledby="legal-page-title">
      <div className="shrink-0 border-b border-border/50 px-5 pt-4 pb-3">
        <button
          type="button"
          onClick={onClose}
          className="p-2 -ml-2 rounded-lg text-muted-strong hover:bg-card-alt border border-transparent hover:border-border transition-colors"
          aria-label="Close"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="max-w-2xl mx-auto px-5 py-6">
          <h1 id="legal-page-title" className="text-2xl font-bold text-text mb-1">
            {title}
          </h1>
          <p className="text-sm text-muted-strong mb-8">Last updated: March 2026</p>
          {children}
        </div>
      </div>
    </div>
  )
}

const h2 = 'text-base font-bold text-text mt-8 mb-3'
const body = 'text-sm text-muted-strong leading-relaxed'
const list = 'space-y-1 text-sm text-muted-strong'
const subHead = 'text-sm font-bold text-text mt-4 mb-2'

export function PrivacyPolicy({ onClose }) {
  return (
    <LegalShell title="REPLIQE — Privacy Policy" onClose={onClose}>
      <section className={body}>
        <h2 className={h2}>1. Who we are</h2>
        <p className="mb-3">
          REPLIQE is a fitness tracking application developed and operated by REPLIQE, Frederikskaj 2D, 2450 Copenhagen SV,
          Denmark. Contact:{' '}
          <a href="mailto:admin@repliqe.com" className="text-accent underline underline-offset-2">
            admin@repliqe.com
          </a>
        </p>

        <h2 className={h2}>2. What data we collect</h2>
        <h3 className={subHead}>Account data</h3>
        <ul className={`${list} mb-4`}>
          <li>Email address and password (via Firebase Authentication)</li>
        </ul>
        <h3 className={subHead}>Training data</h3>
        <ul className={`${list} mb-4`}>
          <li>Workout sessions, exercises, sets, reps and weight</li>
          <li>Training programmes and routines</li>
          <li>Personal records</li>
        </ul>
        <h3 className={subHead}>Progress data</h3>
        <ul className={`${list} mb-4`}>
          <li>Progress photos you choose to upload</li>
          <li>Body measurements if entered</li>
        </ul>
        <h3 className={subHead}>Usage data</h3>
        <ul className={`${list} mb-4`}>
          <li>App interactions and feature usage</li>
          <li>Crash reports and performance data</li>
        </ul>
        <h3 className={subHead}>AI interaction data</h3>
        <ul className={`${list} mb-4`}>
          <li>Messages sent to REPLIQE Coach</li>
          <li>Training preferences entered during programme creation</li>
        </ul>

        <h2 className={h2}>3. Why we collect it</h2>
        <p className="mb-3">We collect and process your data to:</p>
        <ul className={`${list} mb-4`}>
          <li>Provide and operate the REPLIQE app</li>
          <li>Generate AI-powered training programmes and coaching responses</li>
          <li>Show you your progress over time</li>
          <li>Improve the app and fix bugs</li>
          <li>Send important account notifications</li>
        </ul>
        <p className="mb-2 font-semibold text-text text-sm">Legal basis under GDPR:</p>
        <ul className={list}>
          <li>Contract — processing necessary to deliver the service</li>
          <li>Consent — for AI processing of your training data</li>
          <li>Legitimate interest — for analytics and app improvement</li>
        </ul>

        <h2 className={h2}>4. Who we share your data with</h2>
        <p className="mb-3">We do not sell your data. We share data with:</p>
        <div className="overflow-x-auto -mx-1 px-1 mb-4">
          <table className="w-full text-sm border-collapse min-w-[280px]">
            <thead>
              <tr>
                <th className="text-left text-xs font-bold text-muted-strong uppercase tracking-wider pb-2">Provider</th>
                <th className="text-left text-xs font-bold text-muted-strong uppercase tracking-wider pb-2">Purpose</th>
                <th className="text-left text-xs font-bold text-muted-strong uppercase tracking-wider pb-2">Location</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 text-sm text-muted-strong border-t border-border">Google Firebase</td>
                <td className="py-2 text-sm text-muted-strong border-t border-border">Authentication, database, storage, analytics</td>
                <td className="py-2 text-sm text-muted-strong border-t border-border">EU (europe-west1)</td>
              </tr>
              <tr>
                <td className="py-2 text-sm text-muted-strong border-t border-border">Anthropic</td>
                <td className="py-2 text-sm text-muted-strong border-t border-border">AI processing for REPLIQE Coach and programme generation</td>
                <td className="py-2 text-sm text-muted-strong border-t border-border">USA</td>
              </tr>
              <tr>
                <td className="py-2 text-sm text-muted-strong border-t border-border">Apple / Google</td>
                <td className="py-2 text-sm text-muted-strong border-t border-border">App distribution and in-app purchases</td>
                <td className="py-2 text-sm text-muted-strong border-t border-border">USA</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mb-3">
          When you use REPLIQE Coach or generate an AI programme, your training preferences and relevant workout data are sent to
          Anthropic for processing. This is disclosed at the point of use and requires your explicit consent.
        </p>
        <p>All providers are bound by data processing agreements and appropriate safeguards for international transfers.</p>

        <h2 className={h2}>5. How long we keep your data</h2>
        <p className="mb-3">We keep your data for as long as your account is active. When you delete your account:</p>
        <ul className={list}>
          <li>Your personal data is deleted within 30 days</li>
          <li>Anonymised, aggregated data may be retained for analytics</li>
        </ul>

        <h2 className={h2}>6. Your rights</h2>
        <p className="mb-3">Under GDPR you have the right to:</p>
        <ul className={`${list} mb-4`}>
          <li>Access — request a copy of your data</li>
          <li>Rectification — correct inaccurate data</li>
          <li>Erasure — delete your account and data (Profile → Delete account)</li>
          <li>Portability — receive your data in a machine-readable format</li>
          <li>Object — object to processing based on legitimate interest</li>
          <li>Withdraw consent — for AI processing at any time</li>
        </ul>
        <p className="mb-3">
          Contact{' '}
          <a href="mailto:admin@repliqe.com" className="text-accent underline underline-offset-2">
            admin@repliqe.com
          </a>{' '}
          to exercise these rights. We will respond within 30 days.
        </p>
        <p>You have the right to lodge a complaint with your local data protection authority.</p>

        <h2 className={h2}>7. Data security</h2>
        <p>
          Your data is stored in Google Firebase in the EU (europe-west1 region). We use encryption in transit and at rest, and
          enforce strict access controls via Firebase Security Rules.
        </p>

        <h2 className={h2}>8. Children</h2>
        <p>
          REPLIQE is not intended for users under the age of 16. We do not knowingly collect data from children. Contact{' '}
          <a href="mailto:admin@repliqe.com" className="text-accent underline underline-offset-2">
            admin@repliqe.com
          </a>{' '}
          if you believe a child has created an account.
        </p>

        <h2 className={h2}>9. Changes to this policy</h2>
        <p>We will notify you of significant changes via email or in-app notification. Continued use of REPLIQE after changes constitutes acceptance.</p>
      </section>
    </LegalShell>
  )
}

export function TermsOfService({ onClose }) {
  return (
    <LegalShell title="REPLIQE — Terms of Service" onClose={onClose}>
      <section className={body}>
        <h2 className={h2}>1. Acceptance of terms</h2>
        <p>By creating an account and using REPLIQE, you agree to these Terms of Service. If you do not agree, do not use the app.</p>

        <h2 className={h2}>2. What REPLIQE is</h2>
        <p className="mb-3">REPLIQE is a fitness tracking and AI-assisted training app.</p>
        <p>
          REPLIQE is not a medical product. Nothing in the app constitutes medical advice, diagnosis or treatment. Always consult a
          qualified healthcare professional before starting a new exercise programme, especially if you have any health conditions,
          injuries or concerns.
        </p>

        <h2 className={h2}>3. Your account</h2>
        <p className="mb-3">You are responsible for:</p>
        <ul className={`${list} mb-3`}>
          <li>Keeping your login credentials secure</li>
          <li>All activity that occurs under your account</li>
          <li>Providing accurate information</li>
        </ul>
        <p>You must be at least 16 years old to create an account.</p>

        <h2 className={h2}>4. Acceptable use</h2>
        <p className="mb-3">You agree not to:</p>
        <ul className={list}>
          <li>Use REPLIQE for any unlawful purpose</li>
          <li>Attempt to reverse engineer or copy the app</li>
          <li>Share your account with others</li>
          <li>Upload content that is offensive, illegal or infringes third-party rights</li>
        </ul>

        <h2 className={h2}>5. Subscriptions and payments</h2>
        <p className="mb-3">
          <strong className="text-text">Free plan</strong> — available to all users at no cost.
        </p>
        <p className="mb-3">
          <strong className="text-text">Pro and Elite plans</strong> — paid subscriptions billed monthly or annually. Prices are shown in the app at the time of purchase.
        </p>
        <p className="mb-2 font-semibold text-text text-sm">Billing</p>
        <ul className={`${list} mb-4`}>
          <li>Subscriptions are processed via Apple App Store or Google Play</li>
          <li>Payment is charged at confirmation of purchase</li>
          <li>Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period</li>
        </ul>
        <p className="mb-2 font-semibold text-text text-sm">Cancellation</p>
        <ul className={`${list} mb-4`}>
          <li>Cancel anytime via App Store or Play Store account settings</li>
          <li>Cancellation takes effect at the end of the current period</li>
          <li>No refunds for unused portions except where required by law</li>
        </ul>
        <p className="mb-2 font-semibold text-text text-sm">Refunds</p>
        <ul className={list}>
          <li>Handled by Apple or Google per their respective policies</li>
          <li>
            Contact{' '}
            <a href="mailto:admin@repliqe.com" className="text-accent underline underline-offset-2">
              admin@repliqe.com
            </a>{' '}
            if you believe you were charged incorrectly
          </li>
        </ul>

        <h2 className={h2}>6. AI features</h2>
        <p className="mb-3">By using REPLIQE Coach and AI programme generation you acknowledge:</p>
        <ul className={list}>
          <li>AI responses are for informational purposes only</li>
          <li>AI may occasionally produce inaccurate suggestions</li>
          <li>Your training data is processed by Anthropic as described in our Privacy Policy</li>
        </ul>

        <h2 className={h2}>7. Intellectual property</h2>
        <p>
          REPLIQE and all app content are owned by REPLIQE and protected by intellectual property laws. You retain ownership of your
          workout data and progress photos.
        </p>

        <h2 className={h2}>8. Limitation of liability</h2>
        <p className="mb-3">To the fullest extent permitted by law, REPLIQE is not liable for:</p>
        <ul className={`${list} mb-3`}>
          <li>Any injury, loss or damage from use of the app or AI advice</li>
          <li>Interruptions to the service</li>
          <li>Loss of data</li>
        </ul>
        <p>Our total liability shall not exceed the amount you paid for REPLIQE in the 12 months preceding the claim.</p>

        <h2 className={h2}>9. Termination</h2>
        <p>
          We may suspend or terminate your account for violations of these terms. You may delete your account at any time via Profile →
          Delete account.
        </p>

        <h2 className={h2}>10. Governing law</h2>
        <p>Any disputes will be resolved through good faith negotiation before any formal proceedings are initiated.</p>

        <h2 className={h2}>11. Changes to these terms</h2>
        <p>We will notify you of significant changes via email or in-app notification. Continued use after changes constitutes acceptance.</p>

        <h2 className={h2}>12. Contact</h2>
        <p className="whitespace-pre-line">
          REPLIQE{'\n'}
          Frederikskaj 2D{'\n'}
          2450 Copenhagen SV{'\n'}
          Denmark{'\n'}
          <a href="mailto:admin@repliqe.com" className="text-accent underline underline-offset-2">
            admin@repliqe.com
          </a>
        </p>
      </section>
    </LegalShell>
  )
}
