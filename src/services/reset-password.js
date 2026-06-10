import { supabase } from '../services/db.js'

const resetBtn = document.getElementById('resetBtn')
const resetError = document.getElementById('resetError')
let isSession = false
const guideText = document.getElementById('guideText')

// allow enter key to submit
document.getElementById('loginEmail').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') resetBtn.click()
})

function showError(message) {
    resetError.textContent = message
    resetError.classList.remove('hidden')
}

function hideError() {
    resetError.classList.add('hidden')
}

function setLoading(loading) {
    resetBtn.disabled = loading
    resetBtn.textContent = loading ? 'Working...' : 'RESET PASSWORD'
}

async function getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {

        return true
    }
    return false
}

function showPasswordField() {
    guideText.textContent = "Enter a new password. Your password must be at least 8 characters long."
    document.getElementById('emailField').classList.add('hidden')
    document.getElementById('passwordField').classList.remove('hidden')
}
function showEmailField() {
    guideText.textContent = "Enter the email used during sign-up to reset your password."
    document.getElementById('emailField').classList.remove('hidden')
    document.getElementById('passwordField').classList.add('hidden')
}
async function init() {
    const hash = window.location.hash
    if (hash.includes('error=')) {
        const params = new URLSearchParams(hash.replace('#', ''))
        showError(params.get('error_description') || 'This reset link has expired.')
        return
    }
    await new Promise(resolve => setTimeout(resolve, 1500))
    isSession = await getSession()
    if (isSession) {
        showPasswordField()
    } else {
        showEmailField()
    }
}

init()

resetBtn.addEventListener('click', async () => {
    hideError()
    const sessionActive = await getSession()

    if (!sessionActive) {
        const email = document.getElementById('loginEmail').value.trim()
        try {
            if (!email) {
                showError('Please enter your email.')
                return
            }
            setLoading(true)

            const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'https://mountainparkpooleptx.com/login/forgot-password/',
            })

            // check email message
            document.getElementById('resetPwCard').classList.add('hidden')
            const msg = document.createElement('div')
            msg.className = 'flex flex-col items-center text-center gap-5 py-10'
            msg.innerHTML = `
            <div class="bg-mustard p-4 rounded-full">
                <img src="/icons/email-darkblue.svg" alt="email" class="w-10 h-10">
            </div>
            
            <h2 class="font-header font-bold text-2xl text-waterblue">Check your email!</h2>
            <p class="text-sm text-darkblue/60 leading-relaxed max-w-xs">
                We sent a password reset link to <strong class="text-darkblue">${email}</strong>. 
                Click the link to finish resetting your password.
            </p>
            <p class="text-xs text-darkblue/40 leading-relaxed">
                Didn't get it? Check your spam folder or contact us at
                <a href="mailto:themountainparkpool@gmail.com" class="text-burnedorange underline">themountainparkpool@gmail.com</a>
            </p>
            
        `
            document.querySelector('main').appendChild(msg)
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

    } else {
        const password = document.getElementById('newPassword').value
        if (!password || password.length < 8) {
            showError('Password must be at least 8 characters.')
            return
        }
        setLoading(true)
        try {
            const { data, error } = await supabase.auth.updateUser({
                password: password
            })
            if (error) throw error
            // check email message
            document.getElementById('resetPwCard').classList.add('hidden')
            const msg = document.createElement('div')
            msg.className = 'flex flex-col items-center text-center gap-5 py-10'
            msg.innerHTML = `
            <div class="bg-mustard p-4 rounded-full">
                <img src="/icons/checkmark-darkblue.svg" alt="email" class="w-10 h-10">
            </div>
            
            <h2 class="font-header font-bold text-2xl text-waterblue">Password reset successful.</h2>
            <a href="/account/" class="text-burnedorange font-bold underline">Sign in →</a>
            
        `
            document.querySelector('main').appendChild(msg)
        } catch (err) {
            if (err.message?.includes('Invalid login credentials')) {
                showError('Invalid email or password. Please try again.')
            } else if (err.message?.includes('Password should be')) {
                showError('Password must be at least 8 characters.')
            } else {
                showError('Something went wrong. Please try again.')
            }
            setLoading(false)
        }


    }


})