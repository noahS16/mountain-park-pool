import { supabase } from './db.js'
import { getProfile, getHouseholdMembers, getMembership, getCurrentSeason, getCheckInHistory, getPaymentMethod } from './db.js'

// ── AUTH GUARD ─────────────────────────────────────────
async function init() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        window.location.href = '/login/?redirect=/account/'
        return
    }

    const userId = session.user.id

    try {
        // fetch everything in parallel
        const [profile, season] = await Promise.all([
            getProfile(userId),
            getCurrentSeason(),
        ])

        const [membership, householdMembers, checkIns] = await Promise.all([
            getMembership(userId, season.id),
            getHouseholdMembers(userId),
            getCheckInHistory(userId),
        ])

        renderGreeting(profile)
        renderStatusCard(profile, membership, season)
        renderCheckinButton(membership)
        renderActivity(checkIns)
        renderMemberInfo(profile)
        renderHousehold(profile, householdMembers)

    } catch (err) {
        console.error('Error loading account:', err)
    }
}

// ── GREETING ───────────────────────────────────────────
function renderGreeting(profile) {
    document.getElementById('memberGreeting').textContent =
        `Hi, ${profile.first_name}`
}

// ── STATUS CARD ────────────────────────────────────────
function renderStatusCard(profile, membership, season) {
    const card = document.getElementById('statusCard')
    const badge = document.getElementById('statusBadge')
    const dot = document.getElementById('statusDot')
    const status = membership?.status ?? 'pending'
    const gateSection = document.getElementById('gateCodeSection')
    const gateCode = document.getElementById('gateCode')
    const toggleBtn = document.getElementById('toggleCode')
    const GATE_CODE = season.gate_code ?? '-'
    const WIFI_NAME = season.wifi_name ?? '-'
    const WIFI_PASS = season.wifi_password ?? '_'

    if (status === 'active') {
        gateSection.classList.remove('hidden')

        let visible = false
        

        toggleBtn.addEventListener('click', () => {
            visible = !visible
            gateCode.textContent = visible ? GATE_CODE : '••••'
            toggleBtn.textContent = visible ? 'Hide' : 'Show'
        })
        document.getElementById('wifiName').textContent = WIFI_NAME
        document.getElementById('wifiPassword').textContent = WIFI_PASS
    }

    // card styles per status
    const styles = {
        active: {
            card: 'bg-green-50 border-green-300 text-darkblue',
            stripe: 'border-l-green-500',
            badge: 'bg-green-100 text-green-800',
            dot: 'bg-green-500',
            label: 'Active',
            paymentStatus: 'Confirmed ✓',
        },
        pending: {
            card: 'bg-yellow-50 border-yellow-200 text-darkblue',
            stripe: 'border-l-yellow-400',
            badge: 'bg-mustard text-yellow-900',
            dot: 'bg-yellow-500',
            label: 'Pending',
            paymentStatus: 'Awaiting payment',
        },
        expired: {
            card: 'bg-red-50 border-red-200 text-darkblue',
            stripe: 'border-l-red-400',
            badge: 'bg-red-100 text-red-800',
            dot: 'bg-red-500',
            label: 'Expired',
            paymentStatus: 'Expired',
        },
    }

    const s = styles[status] ?? styles.pending

    card.className = `rounded-xl p-5 flex flex-col gap-4 border border-l-4 relative overflow-hidden ${s.card} ${s.stripe}`
    badge.className = `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold flex-shrink-0 ${s.badge}`
    dot.className = `w-2 h-2 rounded-full ${s.dot}`

    document.getElementById('statusText').textContent = s.label
    document.getElementById('statusSeasonLabel').textContent = `${season.year} Season Pass`
    document.getElementById('statusFamilyName').textContent = `${profile.last_name} Family`
    document.getElementById('statusSeason').textContent =
        `${formatDate(season.start_date)} – ${formatDate(season.end_date)}`
    document.getElementById('statusJoined').textContent =
        formatDate(profile.created_at)
    document.getElementById('statusPayment').textContent =
        capitalize(profile.payment_preference ?? '—')
    document.getElementById('statusPaymentStatus').textContent = s.paymentStatus

    // show pending notice only when pending

    // replace the existing pending notice toggle line with this
    if (status === 'pending') {
        document.getElementById('pendingNotice').classList.remove('hidden')
        document.getElementById('pendingNoticeText').innerHTML = getPendingNoticeText(profile.payment_preference)
    } else {
        document.getElementById('pendingNotice').classList.add('hidden')
    }
}
function getPendingNoticeText(preference) {
    switch (preference) {
        case 'zelle':
            return `
        <strong class="block uppercase tracking-wide text-xs mb-1">⚠ Awaiting Payment</strong>
        Send <strong>$475</strong> via Zelle to <strong>themountainparkpool@gmail.com</strong> — please include your full name in the memo.
      `
        case 'check':
            return `
        <strong class="block uppercase tracking-wide text-xs mb-1">⚠ Awaiting Payment</strong>
        Mail a check for <strong>$475</strong> payable to <strong>Mountain Park Pool</strong> to 3405 Montridge Ct, El Paso, TX 79904 — include your full name on the memo line.
      `
        case 'cash':
            return `
        <strong class="block uppercase tracking-wide text-xs mb-1">⚠ Awaiting Payment</strong>
        Bring <strong>$475 cash</strong> to the pool on <strong>Memorial Day, May 25th</strong> or <a href="tel:+19152608231" class="underline font-bold">contact us</a> to schedule a time.
      `
        default:
            return `
        <strong class="block uppercase tracking-wide text-xs mb-1">⚠ Awaiting Payment</strong>
        Please complete your payment of <strong>$475</strong> to activate your membership. <a href="/join/" class="underline font-bold">View payment options →</a>
      `
    }
}

// ── CHECK IN BUTTON ────────────────────────────────────
function renderCheckinButton(membership) {
    const btn = document.getElementById('checkinBtn')
    const isActive = membership?.status === 'active'

    btn.disabled = !isActive

    if (isActive) {
        btn.addEventListener('click', () => {
            window.location.href = '/checkin/'
        })
    }
}

// ── ACTIVITY ───────────────────────────────────────────
function renderActivity(checkIns) {
    const count = checkIns?.length ?? 0
    document.getElementById('checkinCount').textContent = count

    if (count > 0) {
        const last = checkIns[0] // already ordered by desc in db.js
        const lastDate = new Date(last.checked_in_at)
        console.log(lastDate)
        document.getElementById('lastVisitDate').textContent =
            lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        document.getElementById('lastVisitRelative').textContent =
            getRelativeTime(lastDate)
    } else {
        document.getElementById('lastVisitDate').textContent = '—'
        document.getElementById('lastVisitRelative').textContent = 'No visits yet'
    }
}

// ── MEMBER INFO ────────────────────────────────────────
function renderMemberInfo(profile) {
    document.getElementById('infoName').textContent =
        `${profile.first_name} ${profile.last_name}`
    document.getElementById('infoAddress').textContent = profile.address
    document.getElementById('infoEmail').textContent = profile.email
    document.getElementById('infoPhone').textContent = profile.phone
    document.getElementById('infoEc').textContent =
        profile.emergency_contact_name && profile.emergency_contact_phone
            ? `${profile.emergency_contact_name} · ${profile.emergency_contact_phone}`
            : '—'
}

// ── HOUSEHOLD ──────────────────────────────────────────
function renderHousehold(profile, members) {
    const list = document.getElementById('householdList')
    list.innerHTML = ''

    // primary member first
    list.appendChild(createMemberRow(
        profile.first_name,
        profile.last_name,
        true
    ))

    // household members
    members.forEach(m => {
        list.appendChild(createMemberRow(m.first_name, m.last_name, false))
    })
}

function createMemberRow(firstName, lastName, isPrimary) {
    const initials = `${firstName[0]}${lastName[0]}`.toUpperCase()
    const div = document.createElement('div')
    div.className = 'flex items-center gap-3 bg-cream border border-mustard rounded-xl px-4 py-3'
    div.innerHTML = `
    <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
      ${isPrimary ? 'bg-mustard text-darkblue' : 'bg-waterblue text-white'}">
      ${initials}
    </div>
    <div class="flex flex-col gap-0.5">
      <span class="text-sm font-semibold text-darkblue">${firstName} ${lastName}</span>
      ${isPrimary ? '<span class="text-xs text-darkblue opacity-40">Primary member</span>' : ''}
    </div>
  `
    return div
}

// ── HELPERS ────────────────────────────────────────────
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
    })
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

function getRelativeTime(date) {
    const diff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 18))
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    return `${diff} days ago`
}

// ── RUN ────────────────────────────────────────────────
init()