import { supabase } from '../services/db.js'
import { signInUser, getCurrentSeason } from '../services/db.js'

// ── SEASON BADGE ──────────────────────────────────────
async function loadSeasonBadge() {
    try {
        const season = await getCurrentSeason()
        if (season) {
            document.getElementById('seasonText').textContent =
                `${season.year} Season Open · ${formatDate(season.start_date)} – ${formatDate(season.end_date)}`
        }
    } catch {
        // silently fail — badge is cosmetic
    }
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', timeZone: 'UTC'
    })
}

loadSeasonBadge()

// ── REDIRECT HELPER ───────────────────────────────────
function getRedirectUrl() {
    const params = new URLSearchParams(window.location.search)
    return params.get('redirect') || '/account/'
}

// ── REDIRECT IF ALREADY LOGGED IN ────────────────────
async function checkExistingSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
        window.location.href = getRedirectUrl()
    }
}

checkExistingSession()

// ── LOGIN ─────────────────────────────────────────────
const loginBtn = document.getElementById('loginBtn')
const loginError = document.getElementById('loginError')

function showError(message) {
    loginError.textContent = message
    loginError.classList.remove('hidden')
}

function hideError() {
    loginError.classList.add('hidden')
}

function setLoading(loading) {
    loginBtn.disabled = loading
    loginBtn.textContent = loading ? 'Signing in...' : 'Sign In'
}

// allow enter key to submit
document.getElementById('loginPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click()
})

loginBtn.addEventListener('click', async () => {
    hideError()

    const email = document.getElementById('loginEmail').value.trim()
    const password = document.getElementById('loginPassword').value

    if (!email || !password) {
        showError('Please enter your email and password.')
        return
    }

    setLoading(true)

    try {
        await signInUser(email, password)
        window.location.href = getRedirectUrl()
    } catch (err) {
        console.error(err)
        if (err.message?.includes('Invalid login credentials')) {
            showError('Invalid email or password. Please try again.')
        } else if (err.message?.includes('Email not confirmed')) {
            showError('Please confirm your email address before signing in.')
        } else {
            showError('Something went wrong. Please try again.')
        }
        setLoading(false)
    }
})

// ── FORGOT PASSWORD (placeholder) ────────────────────
document.getElementById('forgotPassword').addEventListener('click', () => {
    // wire up later with supabase.auth.resetPasswordForEmail()
    alert('Password reset coming soon. Contact us at themountainparkpool@gmail.com for help.')
})