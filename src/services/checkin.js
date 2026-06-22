import { supabase } from './db.js'
import { getProfile, getHouseholdMembers, getMembership, getCurrentSeason, insertCheckIn } from './db.js'

// ── MENU ───────────────────────────────────────────────
const menuButton = document.getElementById('menuButton')
const closeMenuBtn = document.getElementById('closeMenu')
const mobileMenu = document.getElementById('mobileMenu')
const overlay = document.getElementById('overlay')

menuButton?.addEventListener('click', () => {
    mobileMenu.classList.remove('translate-x-full')
    overlay.classList.remove('hidden')
    document.body.style.overflow = 'hidden'
})

function closeMenu() {
    mobileMenu.classList.add('translate-x-full')
    overlay.classList.add('hidden')
    document.body.style.overflow = ''
}

closeMenuBtn?.addEventListener('click', closeMenu)
overlay?.addEventListener('click', closeMenu)

// ── AUTH GUARD ─────────────────────────────────────────
const MAX_TOTAL = 10
let guestCount = 0
let currentProfile = null
let currentSeason = null
let membersPresent = 0
let gateCode = null

const successMessages = [
    "Don't worry, beach happy!",
    "Pool yourself together!",
    "Water you waiting for? Jump in!",
    "Just keep swimming!",
    "Let the good times roll.",
    "Relaxation unlocked.",
    "Seas the day!",
    "Orange you glad it's pool day!",
    "Grab the sunscreen!",
    "Cool by the pool",
    "Hakuna Matata!",

]

async function init() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        window.location.href = '/login/?redirect=/checkin/'
        return
    }

    const userId = session.user.id

    try {
        const [profile, season] = await Promise.all([
            getProfile(userId),
            getCurrentSeason(),
        ])

        const [membership, householdMembers] = await Promise.all([
            getMembership(userId, season.id),
            getHouseholdMembers(userId),
        ])

        // block non-active members
        if (membership?.status !== 'active') {
            showInactiveMessage()
            return
        }

        currentProfile = profile
        currentSeason = season
        gateCode = season.gate_code ?? 'Please contact us.'

        // set date
        document.getElementById('checkinDate').textContent =
            new Date().toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric'
            })

        renderMembers(profile, householdMembers)
        updateTotals()

        // logout button
        document.querySelectorAll('.logoutBtn').forEach(btn => {
            btn.classList.remove('hidden')
            btn.addEventListener('click', async () => {
                await supabase.auth.signOut()
                window.location.href = '/'
            })
        })

    } catch (err) {
        console.error('Error loading check-in:', err)
    }
}

// ── INACTIVE MEMBER MESSAGE ────────────────────────────
function showInactiveMessage() {
    document.getElementById('formState').innerHTML = `
    <div class="flex flex-col items-center text-center gap-4 pt-16">
      <div class="text-5xl">🔒</div>
      <h2 class="font-header font-bold text-2xl text-darkblue">Membership Not Active</h2>
      <p class="text-sm text-darkblue/60 leading-relaxed">
        Your membership needs to be active to check in.<br>
        Complete your payment to get in the pool!
      </p>
      <a href="/account/" class="text-burnedorange font-bold underline text-sm">← Back to My Account</a>
    </div>
  `
}

// ── RENDER MEMBERS ─────────────────────────────────────
function renderMembers(profile, householdMembers) {
    const list = document.getElementById('membersList')
    list.innerHTML = ''

    // primary member — checked by default
    list.appendChild(createMemberRow(
        profile.first_name,
        profile.last_name,
        true,
        true
    ))

    // household members
    householdMembers.forEach(m => {
        list.appendChild(createMemberRow(m.first_name, m.last_name, false, false))
    })

    // attach change listeners
    list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
            cb.closest('label').classList.toggle(
                'border-waterblue', cb.checked
            )
            cb.closest('label').classList.toggle(
                'bg-waterblue/5', cb.checked
            )
            updateTotals()
        })
    })
}

function createMemberRow(firstName, lastName, isPrimary, defaultChecked) {
    const initials = `${firstName[0]}${lastName[0]}`.toUpperCase()
    const label = document.createElement('label')
    label.className = `flex items-center gap-3 bg-cream border-2 rounded-xl p-4 py-2 cursor-pointer transition-all
    ${defaultChecked ? 'border-waterblue bg-waterblue/5' : 'border-mustard'}`

    label.innerHTML = `
    <input type="checkbox" ${defaultChecked ? 'checked' : ''}
      class="w-5 h-5 flex-shrink-0 cursor-pointer accent-waterblue" />
    <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0
      ${isPrimary ? 'bg-burnedorange' : 'bg-waterblue'}">
      ${initials}
    </div>
    <div class="flex flex-col gap-0.5">
      <span class="text-base font-semibold text-darkblue">${firstName} ${lastName}</span>
      ${isPrimary ? '<span class="text-xs text-darkblue/40">Primary member</span>' : ''}
    </div>
  `
    return label
}

// ── TOTALS ─────────────────────────────────────────────
function getCheckedCount() {
    return document.querySelectorAll('#membersList input[type="checkbox"]:checked').length
}

function updateTotals() {
    membersPresent = getCheckedCount()
    const total = membersPresent + guestCount
    const remaining = MAX_TOTAL - total

    document.getElementById('totalCount').textContent = total
    document.getElementById('guestAllowance').textContent =
        remaining > 0
            ? `Up to ${remaining} more allowed`
            : 'Maximum capacity reached'

    document.getElementById('guestMinus').disabled = guestCount <= 0
    document.getElementById('guestPlus').disabled = total >= MAX_TOTAL
    document.getElementById('submitBtn').disabled = membersPresent === 0
}

// ── STEPPER ────────────────────────────────────────────
document.getElementById('guestMinus').addEventListener('click', () => {
    if (guestCount <= 0) return
    guestCount--
    document.getElementById('guestValue').textContent = guestCount
    updateTotals()
})

document.getElementById('guestPlus').addEventListener('click', () => {
    if (membersPresent + guestCount >= MAX_TOTAL) return
    guestCount++
    document.getElementById('guestValue').textContent = guestCount
    updateTotals()
})

// ── SUBMIT ─────────────────────────────────────────────
document.getElementById('submitBtn').addEventListener('click', async () => {
    const btn = document.getElementById('submitBtn')
    btn.disabled = true
    btn.textContent = 'Checking in...'

    try {
        const checkedBoxes = document.querySelectorAll('#membersList input[type="checkbox"]:checked')
        const checkedCount = checkedBoxes.length

        // determine checked_in_by:
        // if only one member checked use their name, otherwise use primary
        let checkedInBy
        if (checkedCount === 1) {
            const label = checkedBoxes[0].closest('label')
            checkedInBy = label.querySelector('span.font-semibold').textContent.trim()
        } else {
            checkedInBy = `${currentProfile.first_name} ${currentProfile.last_name}`
        }

        await insertCheckIn(
            currentProfile.id,
            currentSeason.id,
            checkedInBy,
            checkedCount,
            guestCount,
        )

        showSuccess(checkedCount, guestCount)

    } catch (err) {
        console.error('Check-in failed:', err)
        btn.disabled = false
        btn.textContent = 'Confirm Check-In'
        alert('Something went wrong. Please try again.')
    }
})

// ── SUCCESS ────────────────────────────────────────────
async function showSuccess(members, guests) {
    const now = new Date()
    const msg = successMessages[Math.floor(Math.random() * successMessages.length)]

    document.getElementById('successTitle').textContent = msg
    document.getElementById('successMembers').textContent = members
    document.getElementById('successGuests').textContent = guests
    document.getElementById('successTotal').textContent = members + guests
    document.getElementById('successTime').textContent =
        now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

    document.getElementById('formState').classList.add('hidden')
    document.getElementById('successState').classList.remove('hidden')
    document.getElementById('successState').classList.add('flex')
    await getCurrentTemp()
    document.getElementById('gateCode').textContent = gateCode

    window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function getCurrentTemp() {
    // El Paso coordinates and Fahrenheit setting
    const url = "https://api.open-meteo.com/v1/forecast?latitude=31.7587&longitude=-106.4869&current=temperature_2m&temperature_unit=fahrenheit";

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("Weather data fetch failed");
            return response.json();
        })
        .then(data => {
            // Round the temperature to a whole number
            const temp = Math.round(data.current.temperature_2m);

            // Select your HTML element and update it
            const weatherDisplay = document.getElementById('weather-display');
            weatherDisplay.innerText = `${temp}°F`;
        })
        .catch(error => {
            console.error("Error fetching weather:", error);
            // Fallback text if the API fails so the page doesn't look broken
            document.getElementById('weather-display').innerText = "Checked In!";
        });
}

// ── RUN ────────────────────────────────────────────────
init()