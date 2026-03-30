/**
 * Sletter KUN Firestore: users/<UID>/workoutSessions
 * Rører ikke: workoutPlans, appData/main (foto m.m.), Storage.
 *
 * Kræver Admin (service account eller ADC):
 *   cd functions
 *   GOOGLE_APPLICATION_CREDENTIALS=/sti/til/key.json node tools/deleteWorkoutSessionsOnly.js <UID>
 *
 * Eller Firebase CLI (samme begrænsning — kun workoutSessions):
 *   firebase firestore:delete users/<UID>/workoutSessions -r -f --project repliqe-710d2
 */

const admin = require('firebase-admin')

const uid = process.argv[2]
if (!uid || uid.startsWith('-')) {
  console.error('Usage: node tools/deleteWorkoutSessionsOnly.js <USER_UID>')
  console.error('Deletes ONLY users/<UID>/workoutSessions.')
  process.exit(1)
}

admin.initializeApp()
const db = admin.firestore()

async function main() {
  const col = db.collection('users').doc(uid).collection('workoutSessions')
  let total = 0
  for (;;) {
    const snap = await col.limit(500).get()
    if (snap.empty) break
    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    total += snap.size
    console.log(`Deleted ${snap.size} docs (running total: ${total})`)
  }
  console.log(`Done. Removed ${total} document(s) under users/${uid}/workoutSessions`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
