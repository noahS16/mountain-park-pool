import { getProfile, getCurrentSeason, insertEventBooking, supabase, signOutUser, getBookingsForDate } from './db.js'

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

document.getElementById('footer-year').textContent = new Date().getFullYear()

// ── AUTH STATE ─────────────────────────────────────────
let currentProfile = null
let isMember = false

async function init() {
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
        try {
            currentProfile = await getProfile(session.user.id)
            isMember = true

            // show logout
            document.querySelectorAll('.logoutBtn').forEach(btn => {
                btn.classList.remove('hidden')
                btn.addEventListener('click', async () => {
                    await signOutUser()
                    window.location.href = '/'
                })
            })

            // show admin link if admin
            if (currentProfile.role === 'admin') {
                document.querySelectorAll('.adminMenu').forEach(el => el.classList.remove('hidden'))
            }

            // hide member toggle, show prefill notice
            document.getElementById('memberToggleSection').classList.add('hidden')
            document.getElementById('prefillNotice').classList.remove('hidden')

            // prefill contact info
            document.getElementById('contactFirst').value = currentProfile.first_name
            document.getElementById('contactLast').value = currentProfile.last_name
            document.getElementById('contactEmail').value = currentProfile.email
            document.getElementById('contactPhone').value = currentProfile.phone

        } catch (err) {
            console.error('Error loading profile:', err)
        }
    } else {
        // not logged in — default to non-member, show toggle
        const noRadio = document.querySelector('input[name="isMember"][value="no"]')
        if (noRadio) noRadio.checked = true
    }
}

// ── MEMBER TOGGLE ──────────────────────────────────────
document.querySelectorAll('input[name="isMember"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        isMember = e.target.value === 'yes'
    })
})

// ── FORM SUBMISSION ────────────────────────────────────
const form = document.getElementById('eventForm')
const submitBtn = document.getElementById('submitBtn')
const formError = document.getElementById('formError')

function showError(msg) {
    formError.textContent = msg
    formError.classList.remove('hidden')
    formError.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function clearError() {
    formError.classList.add('hidden')
}

function setLoading(loading) {
    submitBtn.disabled = loading
    submitBtn.textContent = loading ? 'Submitting...' : 'Submit Booking Request'
}

form.addEventListener('submit', async (e) => {
    e.preventDefault()
    clearError()

    const contactFirst = document.getElementById('contactFirst').value.trim()
    const contactLast = document.getElementById('contactLast').value.trim()
    const contactEmail = document.getElementById('contactEmail').value.trim()
    const contactPhone = document.getElementById('contactPhone').value.trim()
    const eventDate = document.getElementById('eventDate').value
    const startTime = document.getElementById('startTime').value
    const endTime = document.getElementById('endTime').value
    const headcount = parseInt(document.getElementById('headcount').value)
    const notes = document.getElementById('eventNotes').value.trim()

    // validation
    if (!contactFirst || !contactLast || !contactEmail || !contactPhone) {
        showError('Please fill in all contact fields.')
        return
    }

    if (!eventDate) {
        showError('Please select an event date.')
        return
    }

    try {
        const existingBookings = await getBookingsForDate(eventDate)

        const hasConflict = existingBookings.some(booking => {
            return startTime < booking.event_end_time && endTime > booking.event_start_time
        })

        if (hasConflict) {
            showError('This date already has an event booked during that time. Please choose a different time or date.')
            return
        }
    } catch (err) {
        console.error('Failed to check availability:', err)
        showError('Unable to verify availability right now. Please try again.')
        return
    }

    const isSunday = new Date(eventDate + 'T00:00:00').getDay()

    if (isSunday === 0) {
        showError('Sorry, we don\'t take bookings on Sundays.')
        return
    }

    if (!startTime || !endTime) {
        showError('Please select a start and end time.')
        return
    }

    if (startTime >= endTime) {
        showError('End time must be after start time.')
        return
    }
    const toMinutes = (t) => {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
    }

    const durationMinutes = toMinutes(endTime) - toMinutes(startTime)

    if (durationMinutes > 6 * 60) {
        showError('Events cannot be longer than 6 hours.')
        return
    }

    if (!headcount || headcount < 1) {
        showError('Please enter an expected headcount.')
        return
    }

    setLoading(true)

    try {
        const profileId = currentProfile?.id ?? null

        await insertEventBooking({
            isMember,
            contactName: `${contactFirst} ${contactLast}`,
            contactEmail,
            contactPhone,
            eventDate,
            eventStartTime: startTime,
            eventEndTime: endTime,
            headcount,
            notes,
        }, profileId)

        showSuccess(eventDate, startTime, endTime, headcount, isMember, `${contactFirst} ${contactLast}`)

    } catch (err) {
        console.error('Booking submission failed:', err)
        showError('Something went wrong. Please try again or contact us directly.')
        setLoading(false)
    }
})

// ── SUCCESS ────────────────────────────────────────────
function showSuccess(date, startTime, endTime, headcount, member, name) {
    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    })

    const formatTime = (t) => {
        const [h, m] = t.split(':')
        const hour = parseInt(h)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const display = hour % 12 || 12
        return `${display}:${m} ${ampm}`
    }

    document.getElementById('successName').textContent = name
    document.getElementById('successDate').textContent = formattedDate
    document.getElementById('successTime').textContent = `${formatTime(startTime)} – ${formatTime(endTime)}`
    document.getElementById('successHeadcount').textContent = `${headcount} guests`
    //document.getElementById('successPrice').textContent = member ? '$400 (member rate)' : '$500'

    form.classList.add('hidden')
    const success = document.getElementById('successState')
    success.classList.remove('hidden')
    success.classList.add('flex')
    //window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ── RUN ────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0]
document.getElementById('eventDate').min = today // or minDateStr
init()