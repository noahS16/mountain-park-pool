import { signUpUser, insertProfile, insertHouseholdMembers, insertMembership, getCurrentSeason } from '../services/db.js';
import { supabase } from '../services/db.js';

// ── DYNAMIC HOUSEHOLD MEMBERS ──────────────────────────
const membersList = document.getElementById('membersList')
const addMemberBtn = document.getElementById('addMember')
const MAX_MEMBERS = 3
let memberCount = 0

function createMemberRow(index) {
    const row = document.createElement('div')
    row.className = 'member-row flex gap-3 items-start'
    row.dataset.index = index
    row.innerHTML = `
    <div class="flex gap-3 flex-1 min-w-0">
      <div class="flex flex-col gap-1.5 flex-1">
        <label class="text-xs font-bold uppercase tracking-widest text-darkblue">First Name</label>
        <input
          required
          type="text"
          name="member_${index}_first"
          autocomplete="off"
          class="rounded-lg border border-mustard bg-cream px-4 py-3 text-sm text-darkblue placeholder:text-darkblue/40 focus:outline-none focus:ring-2 focus:ring-waterblue"
          placeholder="John"
        />
      </div>
      <div class="flex flex-col gap-1.5 flex-1 min-w-0">
        <label class="text-xs font-bold uppercase tracking-widest text-darkblue">Last Name</label>
        <input
          required
          type="text"
          name="member_${index}_last"
          autocomplete="off"
          class="rounded-lg border border-mustard bg-cream px-4 py-3 text-sm text-darkblue placeholder:text-darkblue/40 focus:outline-none focus:ring-2 focus:ring-waterblue"
          placeholder="Doe"
        />
      </div>
    </div>
    <button
      type="button"
      class="remove-member mt-6 flex-shrink-0 text-darkblue/30 hover:text-burnedorange transition-colors"
      aria-label="Remove member">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  `

    row.querySelector('.remove-member').addEventListener('click', () => {
        row.remove()
        memberCount--
        updateAddButton()
        renumberMembers()
    })

    return row
}

function updateAddButton() {
    addMemberBtn.classList.toggle('hidden', memberCount >= MAX_MEMBERS)
}

function renumberMembers() {
    document.querySelectorAll('.member-row').forEach((row, i) => {
        const num = i + 1
        row.dataset.index = num
        row.querySelectorAll('input')[0].name = `member_${num}_first`
        row.querySelectorAll('input')[1].name = `member_${num}_last`
        row.querySelector('label').textContent = `Member ${num} First`
    })
}

addMemberBtn.addEventListener('click', () => {
    if (memberCount >= MAX_MEMBERS) return
    memberCount++
    membersList.appendChild(createMemberRow(memberCount))
    updateAddButton()
})


// ── FORM SUBMISSION ────────────────────────────────────
const form = document.getElementById('joinForm')
const submitBtn = form.querySelector('button[type="submit"]')

// helper to show inline error messages
function setError(message) {
    let errorEl = document.getElementById('form-error')
    if (!errorEl) {
        errorEl = document.createElement('p')
        errorEl.id = 'form-error'
        errorEl.className = 'text-sm text-red-500 text-center font-semibold'
        submitBtn.insertAdjacentElement('beforebegin', errorEl)
    }
    errorEl.textContent = message
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function clearError() {
    const errorEl = document.getElementById('form-error')
    if (errorEl) errorEl.textContent = ''
}

function setLoading(loading) {
    submitBtn.disabled = loading
    submitBtn.textContent = loading ? 'Submitting...' : 'Submit Application'
}

function collectHouseholdMembers() {
    const members = []
    document.querySelectorAll('.member-row').forEach(row => {
        const inputs = row.querySelectorAll('input')
        members.push({
            first: inputs[0].value.trim(),
            last: inputs[1].value.trim(),
        })
    })
    return members
}

form.addEventListener('submit', async (e) => {
    e.preventDefault()
    clearError()

    // collect values
    const firstName = document.getElementById('firstName').value.trim()
    const lastName = document.getElementById('lastName').value.trim()
    const address = document.getElementById('address').value.trim()
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value
    const confirmPassword = document.getElementById('confirmPassword').value
    const phone = document.getElementById('phone').value.trim()
    const ecName = document.getElementById('ecName').value.trim()
    const ecPhone = document.getElementById('ecPhone').value.trim()
    const payment = form.querySelector('input[name="payment"]:checked')?.value
    const photoConsent = form.querySelector('input[name="photoConsent"]').checked
    const householdMembers = collectHouseholdMembers()
    console.log({
        firstName,
        lastName,
        address,
        email,
        phone,
        ecName,
        ecPhone,
        payment,
        photoConsent,
        householdMembers,
    })

    // client-side validation
    if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
    }

    if (!payment) {
        setError('Please select a payment preference.')
        return
    }

    setLoading(true)

    try {

        const user = await signUpUser(email, password, {
            firstName,
            lastName,
            address,
            email,
            phone,
            ecName,
            ecPhone,
            payment,
            photoConsent,
            householdMembers
        })

        // check email message
        document.getElementById('joinForm').classList.add('hidden')
        const msg = document.createElement('div')
        msg.className = 'flex flex-col items-center text-center gap-5 py-10'
        msg.innerHTML = `
            <div class="bg-mustard p-4 rounded-full">
                <img src="/icons/email-darkblue.svg" alt="email" class="w-10 h-10">
            </div>
            
            <h2 class="font-header font-bold text-2xl text-waterblue">Check your email!</h2>
            <p class="text-sm text-darkblue/60 leading-relaxed max-w-xs">
                We sent a confirmation link to <strong class="text-darkblue">${email}</strong>. 
                Click the link to activate your account, then come back to sign in.
            </p>
            <p class="text-xs text-darkblue/40 leading-relaxed">
                Didn't get it? Check your spam folder or
                <button id="resendBtn" class="text-burnedorange underline font-semibold">resend the email</button>.
            </p>
            <p class="text-xs text-darkblue/40 leading-relaxed">
                Still having trouble? Contact us at
                <a href="mailto:themountainparkpool@gmail.com" class="text-burnedorange underline">themountainparkpool@gmail.com</a>
            </p>
            <a href="/login/" class="text-sm font-bold text-burnedorange underline mt-2">← Go to Sign In</a>
        `
        document.querySelector('main').appendChild(msg)
        // resend button
        document.getElementById('resendBtn').addEventListener('click', async () => {
            const btn = document.getElementById('resendBtn')
            btn.textContent = 'Sending...'
            btn.disabled = true

            try {
                const { error } = await supabase.auth.resend({
                    type: 'signup',
                    email: email,
                    options: {
                        emailRedirectTo: `${window.location.origin}/confirm/`
                    }
                })
                if (error) throw error
                btn.textContent = 'Sent! Check your inbox.'
            } catch (err) {
                console.error(err)
                btn.textContent = 'Failed — try again'
                btn.disabled = false
            }
        })

    } catch (err) {
        console.error(err)

        // surface friendly error messages for common cases
        if (err.message?.includes('already registered')) {
            setError('An account with this email already exists. Try logging in instead.')
        } else if (err.message?.includes('Password should be')) {
            setError('Password must be at least 8 characters.')
        } else {
            setError('Something went wrong. Please try again or contact us for help.')
        }

        setLoading(false)
    }
})