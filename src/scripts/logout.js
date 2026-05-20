import { signOutUser } from '../services/db.js'

// logout button — works for both header and mobile menu
document.querySelectorAll('.logoutBtn').forEach(btn => {
  btn.addEventListener('click', async () => {
    try {
      await signOutUser()
      window.location.href = '/'
    } catch (err) {
      console.error(err)
    }
  })
})