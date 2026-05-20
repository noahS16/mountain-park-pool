import { signOutUser, getProfile, supabase } from '../services/db.js'

const menuButton = document.getElementById('menuButton')
const closeMenu = document.getElementById('closeMenu')
const mobileMenu = document.getElementById('mobileMenu')
const overlay = document.getElementById('overlay')

function openMenu() {
  mobileMenu.classList.remove('translate-x-full')
  overlay.classList.remove('hidden')
  document.body.style.overflow = 'hidden' // prevent scroll behind menu
}

function closeMenuFn() {
  mobileMenu.classList.add('translate-x-full')
  overlay.classList.add('hidden')
  document.body.style.overflow = ''
}

menuButton.addEventListener('click', openMenu)
closeMenu.addEventListener('click', closeMenuFn)
overlay.addEventListener('click', closeMenuFn)

document.querySelectorAll('#mobileMenu nav a').forEach(link => {
  if (link.href === window.location.href) {
    link.classList.add('border-l-4', 'pl-3', 'border-burnedorange')
  }
})




// show logout button only if logged in
async function updateAuthUI() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    document.querySelectorAll('.logoutBtn').forEach(btn => btn.classList.remove('hidden'))
    const profile = await getProfile(session.user.id)
    //console.log(profile.role);
    if (profile.role === 'admin') {

      document.querySelectorAll('.adminMenu').forEach(btn => btn.classList.remove('hidden'))
    }
    
  }
}

updateAuthUI()

// logout handler
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