import { supabase } from './db.js'
import { getProfile, getCurrentSeason, getAllMembers, getAllEventBookings, adminUpdateMembership, adminDeleteMember, getAllCheckins } from './db.js'



// ── STATE ──────────────────────────────────────────────
let allMembers = []
let allBookings = []
let allCheckins = []
let currentSeason = null

// ── AUTH + ROLE GUARD ──────────────────────────────────
async function init() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        window.location.href = '/login/?redirect=/admin/'
        return
    }

    const profile = await getProfile(session.user.id)

    if (profile.role !== 'admin') {
        document.getElementById('accessDenied').classList.remove('hidden')
        document.getElementById('accessDenied').classList.add('flex')
        //console.log(profile.role)
        return
    }

    // show admin content
    document.getElementById('adminContent').classList.remove('hidden')
    document.getElementById('adminContent').classList.add('flex')

    // logout
    document.querySelectorAll('.logoutBtn').forEach(btn => {
        btn.classList.remove('hidden')
        btn.addEventListener('click', async () => {
            await supabase.auth.signOut()
            window.location.href = '/'
        })
    })

    try {
        currentSeason = await getCurrentSeason()
        document.getElementById('seasonLabel').textContent = `${currentSeason.year} Season`
        await seasonSettings(currentSeason)

        const [members, bookings, checkins] = await Promise.all([
            getAllMembers(),
            getAllEventBookings(),
            getAllCheckins(currentSeason.id),
        ])

        allMembers = members
        allBookings = bookings
        allCheckins = checkins

        renderStats()
        renderMembers(allMembers)
        renderBookings(allBookings)
        renderCheckins(allCheckins)
        setupTabs()
        setupSearch()
        setupExport()

    } catch (err) {
        console.error('Admin load error:', err)
    }
}

// SEASON SETTINGS
async function seasonSettings(currentSeason) {
    // populate season settings
    document.getElementById('gateCodeInput').value = currentSeason.gate_code ?? ''
    document.getElementById('wifiNameInput').value = currentSeason.wifi_name ?? ''
    document.getElementById('wifiPassInput').value = currentSeason.wifi_password ?? ''

    // toggle
    const toggleBtn = document.getElementById('toggleSettings')
    const panel = document.getElementById('settingsPanel')
    const chevron = document.getElementById('settingsChevron')
    let settingsOpen = false

    toggleBtn.addEventListener('click', () => {
        settingsOpen = !settingsOpen
        panel.style.maxHeight = settingsOpen ? panel.scrollHeight + 'px' : '0px'
        chevron.style.transform = settingsOpen ? 'rotate(180deg)' : ''
        toggleBtn.classList.toggle('rounded-xl', !settingsOpen)
        toggleBtn.classList.toggle('rounded-t-xl', settingsOpen)
        toggleBtn.classList.toggle('rounded-b-none', settingsOpen)
    })

    // save
    document.getElementById('saveSeasonSettings').addEventListener('click', async () => {
        const btn = document.getElementById('saveSeasonSettings')
        try {
            const { error } = await supabase
                .from('seasons')
                .update({
                    gate_code: document.getElementById('gateCodeInput').value.trim(),
                    wifi_name: document.getElementById('wifiNameInput').value.trim(),
                    wifi_password: document.getElementById('wifiPassInput').value.trim(),
                })
                .eq('id', currentSeason.id)
            if (error) throw error
            showSaveConfirm(btn)
        } catch (err) {
            console.error('Settings save failed:', err)
            alert('Failed to save settings.')
        }
    })
}

// ── STATS ──────────────────────────────────────────────
function renderStats() {
    const active = allMembers.filter(m =>
        m.memberships?.some(mb => mb.status === 'active')
    ).length
    const pending = allMembers.filter(m =>
        m.memberships?.some(mb => mb.status === 'pending')
    ).length

    document.getElementById('statTotal').textContent = allMembers.length
    document.getElementById('statActive').textContent = active
    document.getElementById('statPending').textContent = pending
}

// ── MEMBERS ────────────────────────────────────────────
function renderMembers(members) {
    const list = document.getElementById('membersList')
    list.innerHTML = ''

    if (members.length === 0) {
        list.innerHTML = `<p class="text-sm text-darkblue/40 text-center py-8">No members found.</p>`
        return
    }

    members.forEach(member => {
        const membership = member.memberships?.find(mb => mb.season_id === currentSeason.id)
        const status = membership?.status ?? 'pending'
        const checkInCount = member.check_ins?.length ?? 0
        const initials = `${member.first_name[0]}${member.last_name[0]}`.toUpperCase()
        const joinedDate = new Date(member.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
        })
        const memberRole = member.role;
        const nameColor = memberRole === 'admin' ? 'burnedorange' : 'waterblue';
        console.log(membership)
        const card = document.createElement('div')
        card.className = 'member-card bg-cream border border-mustard rounded-xl overflow-hidden'
        card.dataset.memberId = member.id
        card.dataset.seasonId = membership?.season_id ?? ''

        card.innerHTML = `
      <div class="member-row flex items-center gap-3 px-4 py-3 cursor-pointer" data-toggle>
        <div class="w-9 h-9 rounded-full bg-${nameColor} flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
          ${initials}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-darkblue truncate">${member.first_name} ${member.last_name}</div>
          <div class="text-xs text-darkblue/40 mt-0.5">${capitalize(member.payment_preference ?? '—')} · Joined ${joinedDate}</div>
        </div>
        <div class="flex flex-col items-end gap-1 flex-shrink-0">
          <select class=" status-select text-xs font-bold rounded-full px-3 py-1 border cursor-pointer  ${statusClass(status)}" data-status-select>
            <option value="active" ${status === 'active' ? 'selected' : ''}>Active</option>
            <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="expired" ${status === 'expired' ? 'selected' : ''}>Expired</option>
          </select>
          <span class="text-xs text-darkblue/30">${checkInCount} check-ins</span>
          
        </div>
        <span class="text-darkblue/30 text-xs ml-2 chevron transition-transform duration-200">▼</span>
      </div>

      <div class="member-detail max-h-0 overflow-hidden transition-all duration-300" style="border-top: 0px solid #e8d98a;">
        <div class="p-4 flex flex-col gap-4">

          <div>
            
            <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-0.5 col-span-2">
                <span class="text-xs font-bold uppercase tracking-wider text-darkblue/30">Email Verified</span>
                <span class="text-xs font-medium ${member.email_confirmed ? 'text-green-600' : 'text-red-500'}">
                    ${member.email_confirmed ? '✓ Verified' : '✗ Not verified'}
                </span>
            </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-xs font-bold uppercase tracking-wider text-darkblue/30">Address</span>
                <span class="text-xs font-medium text-darkblue">${member.address}</span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-xs font-bold uppercase tracking-wider text-darkblue/30">Phone</span>
                <span class="text-xs font-medium text-darkblue">${member.phone}</span>
              </div>
              <div class="flex flex-col gap-0.5 col-span-2">
                <span class="text-xs font-bold uppercase tracking-wider text-darkblue/30">Email</span>
                <span class="text-xs font-medium text-darkblue">${member.email}</span>
              </div>
              <div class="flex flex-col gap-0.5 col-span-2">
                <span class="text-xs font-bold uppercase tracking-wider text-darkblue/30">Emergency Contact</span>
                <span class="text-xs font-medium text-darkblue">
                  ${member.emergency_contact_name ?? '—'} · ${member.emergency_contact_phone ?? '—'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-darkblue/40 mb-2">Household</p>
            <div class="flex flex-wrap gap-2">
              <span class="bg-white border border-mustard rounded-full px-3 py-1 text-xs font-medium text-darkblue">
                ${member.first_name} ${member.last_name} ★
              </span>
              ${(member.household_members ?? []).map(hm => `
                <span class="bg-white border border-mustard rounded-full px-3 py-1 text-xs font-medium text-darkblue">
                  ${hm.first_name} ${hm.last_name}
                </span>
              `).join('')}
            </div>
          </div>

          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-darkblue/40 mb-2">Notes</p>
            <textarea data-notes class="w-full bg-white border border-mustard rounded-lg px-3 py-2 text-xs text-darkblue resize-none focus:outline-none focus:ring-2 focus:ring-waterblue" rows="3" placeholder="Add notes...">${membership?.notes ?? ''}</textarea>
          </div>

          <div class="flex gap-2">
            <button data-save class="flex-1 bg-waterblue text-white text-xs font-bold py-2.5 rounded-lg hover:bg-waterblue-dark transition-colors">
              Save Notes
            </button>
            <button data-delete class="bg-red-100 text-red-800 text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-red-200 transition-colors">
              Delete Member
            </button>
          </div>

        </div>
      </div>
    `

        // toggle drawer
        card.querySelector('[data-toggle]').addEventListener('click', (e) => {
            if (e.target.closest('[data-status-select]')) return
            toggleDrawer(card)
        })

        // status change
        card.querySelector('[data-status-select]').addEventListener('change', async (e) => {
            const newStatus = e.target.value
            e.target.className = `status-select text-xs font-bold rounded-full px-3 py-1 border-none cursor-pointer appearance-none ${statusClass(newStatus)}`
            try {
                await adminUpdateMembership(member.id, currentSeason.id, {
                    status: newStatus,
                    payment_confirmed: newStatus === 'active',
                    payment_confirmed_at: newStatus === 'active' ? new Date().toISOString() : null,
                })
                renderStats()
            } catch (err) {
                console.error('Status update failed:', err)
                alert('Failed to update status. Please try again.')
            }
        })

        // save notes
        card.querySelector('[data-save]').addEventListener('click', async () => {
            const notes = card.querySelector('[data-notes]').value
            try {
                await adminUpdateMembership(member.id, currentSeason.id, { notes })
                showSaveConfirm(card.querySelector('[data-save]'))
            } catch (err) {
                console.error('Notes save failed:', err)
                alert('Failed to save notes.')
            }
        })

        // delete member
        card.querySelector('[data-delete]').addEventListener('click', async () => {
            const confirmed = confirm(`Delete ${member.first_name} ${member.last_name}? This cannot be undone.`)
            if (!confirmed) return
            try {
                await adminDeleteMember(member.id)
                card.remove()
                allMembers = allMembers.filter(m => m.id !== member.id)
                renderStats()
            } catch (err) {
                console.error('Delete failed:', err)
                alert('Failed to delete member.')
            }
        })

        list.appendChild(card)
    })
}

// ── BOOKINGS ───────────────────────────────────────────
function renderBookings(bookings) {
    const list = document.getElementById('bookingsList')
    list.innerHTML = ''

    if (bookings.length === 0) {
        list.innerHTML = `<p class="text-sm text-darkblue/40 text-center py-8">No bookings found.</p>`
        return
    }

    bookings.forEach(booking => {
        const card = document.createElement('div')
        card.className = 'booking-card bg-cream border border-mustard rounded-xl overflow-hidden'
        card.dataset.bookingId = booking.id

        const eventDate = new Date(booking.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const eventStartTime = convertMilitaryTo12Hour(booking.event_start_time)
        const eventEndTime = convertMilitaryTo12Hour(booking.event_end_time)

        card.innerHTML = `
      <div class="booking-row px-4 py-3 cursor-pointer flex flex-col gap-3" data-toggle>
        <div class="flex items-center justify-between gap-2">
            <div class="flex flex-row gap-1">
                <span class="text-sm font-semibold text-darkblue">${booking.contact_name}</span>
            <span class="text-xs font-bold rounded-full px-2 py-0.5 ${booking.is_member
                ? 'bg-waterblue/10 text-waterblue'
                : 'bg-burnedorange/10 text-burnedorange'}">
                ${booking.is_member ? 'Member' : 'Non-member'}
            </span>
            </div>
          
          <div class="flex items-center gap-2">
            <select class="booking-status text-xs font-bold rounded-full px-3 py-1 border cursor-pointer  ${bookingStatusClass(booking.status)}" data-booking-status>
              <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
            <span class="text-darkblue/30 text-xs chevron transition-transform duration-200">▼</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-5 items-center">
          <div class="flex flex-col gap-2">
            <span class="text-xs text-darkblue/50 flex flex-row gap-1 items-center"><img src="/icons/calendar-darkblue.svg" alt="cal" class="w-4 h-4"> ${eventDate}</span>
            <span class="text-xs text-darkblue/50 flex flex-row gap-1 items-center"><img src="/icons/clock-darkblue.svg" alt="cal" class="w-4 h-4"> ${eventStartTime} - ${eventEndTime}</span>
          </div>
          <div class="flex flex-col gap-2">
            <span class="text-xs text-darkblue/50 flex flex-row gap-1 items-center"><img src="/icons/person-darkblue.svg" alt="cal" class="w-4 h-4"> ${booking.headcount}</span>
          
            <label class="flex items-center gap-1.5 text-xs font-semibold text-darkblue cursor-pointer" onclick="event.stopPropagation()">
                <input type="checkbox" ${booking.deposit_paid ? 'checked' : ''} data-deposit class="accent-waterblue cursor-pointer" />
                Deposit paid
            </label>
          </div>
          

          
        </div>
      </div>

      <div class="booking-detail max-h-0 overflow-hidden transition-all duration-300" style="border-top: 0px solid #e8d98a;">
        <div class="p-4 flex flex-col gap-4">
          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-bold uppercase tracking-wider text-darkblue/30">Phone</span>
              <span class="text-xs font-medium text-darkblue">${booking.contact_phone}</span>
            </div>
            <div class="flex flex-col gap-0.5 col-span-2">
              <span class="text-xs font-bold uppercase tracking-wider text-darkblue/30">Email</span>
              <span class="text-xs font-medium text-darkblue">${booking.contact_email}</span>
            </div>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-darkblue/40 mb-2">Notes</p>
            <textarea data-notes class="w-full bg-white border border-mustard rounded-lg px-3 py-2 text-xs text-darkblue resize-none focus:outline-none focus:ring-2 focus:ring-waterblue" rows="3" placeholder="Add notes...">${booking.notes ?? ''}</textarea>
          </div>
          <div class="flex gap-2">
                <button data-save class="flex-1 bg-waterblue text-white text-xs font-bold py-2.5 rounded-lg hover:bg-waterblue-dark transition-colors">
                    Save Notes
                </button>
                <button data-delete-booking class="bg-red-100 text-red-800 text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-red-200 transition-colors">
                    Delete Event
                </button>
            </div>
        </div>
      </div>
    `

        // toggle drawer
        card.querySelector('[data-toggle]').addEventListener('click', (e) => {
            if (e.target.closest('[data-booking-status]') || e.target.closest('[data-deposit]')) return
            toggleDrawer(card)
        })

        // booking status change
        card.querySelector('[data-booking-status]').addEventListener('change', async (e) => {
            const newStatus = e.target.value
            e.target.className = `booking-status text-xs font-bold rounded-full px-3 py-1 border-none cursor-pointer appearance-none ${bookingStatusClass(newStatus)}`
            try {
                await supabase.from('event_bookings').update({ status: newStatus }).eq('id', booking.id)
            } catch (err) {
                console.error('Booking status update failed:', err)
            }
        })

        // deposit toggle
        card.querySelector('[data-deposit]').addEventListener('change', async (e) => {
            try {
                await supabase.from('event_bookings').update({ deposit_paid: e.target.checked }).eq('id', booking.id)
            } catch (err) {
                console.error('Deposit update failed:', err)
            }
        })

        // save notes
        card.querySelector('[data-save]').addEventListener('click', async () => {
            const notes = card.querySelector('[data-notes]').value
            try {
                await supabase.from('event_bookings').update({ notes }).eq('id', booking.id)
                showSaveConfirm(card.querySelector('[data-save]'))
            } catch (err) {
                console.error('Notes save failed:', err)
            }
        })

        // delete booking
        card.querySelector('[data-delete-booking]').addEventListener('click', async () => {
            const confirmed = confirm(`Delete booking for ${booking.contact_name}? This cannot be undone.`)
            if (!confirmed) return
            try {
                const { error } = await supabase
                    .from('event_bookings')
                    .delete()
                    .eq('id', booking.id)
                if (error) throw error
                card.remove()
                allBookings = allBookings.filter(b => b.id !== booking.id)
            } catch (err) {
                console.error('Delete booking failed:', err)
                alert('Failed to delete booking.')
            }
        })

        list.appendChild(card)
    })


}

// ── CHECKINS ────────────────────────────────────────────
function renderCheckins(checkins) {
    const list = document.getElementById('checkinsList')
    list.innerHTML = ''
    if (checkins.length === 0) {
        list.innerHTML = `<p class="text-sm text-darkblue/40 text-center py-8">No checkins found.</p>`
        return
    }

    checkins.forEach(checkin => {
        const name = checkin.checked_in_by
        const totalPresent = checkin.total_present
        const totalGuests = checkin.guest_count
        const initials = `${name.split(" ")[0][0] + name.split(" ")[1][0]}`.toUpperCase()
        //console.log(initials)
        const checkinDate = new Date(checkin.checked_in_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
        })
        const checkinTime = new Date(checkin.checked_in_at).toLocaleTimeString('en-US', { timeStyle: 'short' })

        const card = document.createElement('div')
        card.className = 'checkin-card bg-cream border border-mustard rounded-xl overflow-hidden'
        card.dataset.checkinId = checkin.id
        card.dataset.seasonId = checkin?.season_id ?? ''

        card.innerHTML = `
            <div class="flex items-center gap-3 px-4 py-3">
                <div class="w-9 h-9 rounded-full bg-seagreen flex items-center justify-center text-sm font-bold text-darkseagreen flex-shrink-0">
                ${initials}
                </div>
                <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-darkblue truncate">${name}</div>
                <div class="text-xs text-darkblue/40 mt-0.5">${checkinDate} · ${checkinTime}</div>
                </div>
                <div class="flex flex-col items-end gap-1 flex-shrink-0">
                <span class="text-xs font-bold text-darkblue">${checkin.members_present} member${checkin.members_present !== 1 ? 's' : ''}</span>
                <span class="text-xs text-darkblue/40">${totalGuests} guest${totalGuests !== 1 ? 's' : ''} · ${totalPresent} total</span>
                </div>
            </div>
        `

        list.appendChild(card)
    })
}


// ── TABS ───────────────────────────────────────────────
function setupTabs() {
    document.getElementById('tabMembers').addEventListener('click', () => {
        document.getElementById('membersTab').classList.remove('hidden')
        document.getElementById('membersTab').classList.add('flex')
        document.getElementById('bookingsTab').classList.add('hidden')
        document.getElementById('bookingsTab').classList.remove('flex')
        document.getElementById('checkinsTab').classList.add('hidden')
        document.getElementById('checkinsTab').classList.remove('flex')
        document.getElementById('tabMembers').className = 'tab-btn flex-1 py-2 rounded-lg text-xs font-bold bg-waterblue text-white transition-all'
        document.getElementById('tabBookings').className = 'tab-btn flex-1 py-2 rounded-lg text-xs font-bold text-darkblue/50 transition-all'
        document.getElementById('tabCheckins').className = 'tab-btn flex-1 py-2 rounded-lg text-xs font-bold text-darkblue/50 transition-all'

    })

    document.getElementById('tabBookings').addEventListener('click', () => {
        document.getElementById('bookingsTab').classList.remove('hidden')
        document.getElementById('bookingsTab').classList.add('flex')
        document.getElementById('membersTab').classList.add('hidden')
        document.getElementById('membersTab').classList.remove('flex')
        document.getElementById('checkinsTab').classList.add('hidden')
        document.getElementById('checkinsTab').classList.remove('flex')
        document.getElementById('tabBookings').className = 'tab-btn flex-1 py-2 rounded-lg text-xs font-bold bg-waterblue text-white transition-all'
        document.getElementById('tabMembers').className = 'tab-btn flex-1 py-2 rounded-lg text-xs font-bold text-darkblue/50 transition-all'
        document.getElementById('tabCheckins').className = 'tab-btn flex-1 py-2 rounded-lg text-xs font-bold text-darkblue/50 transition-all'

    })

    document.getElementById('tabCheckins').addEventListener('click', () => {
        document.getElementById('bookingsTab').classList.add('hidden')
        document.getElementById('bookingsTab').classList.remove('flex')
        document.getElementById('membersTab').classList.add('hidden')
        document.getElementById('membersTab').classList.remove('flex')
        document.getElementById('checkinsTab').classList.remove('hidden')
        document.getElementById('checkinsTab').classList.add('flex')
        document.getElementById('tabCheckins').className = 'tab-btn flex-1 py-2 rounded-lg text-xs font-bold bg-waterblue text-white transition-all'
        document.getElementById('tabMembers').className = 'tab-btn flex-1 py-2 rounded-lg text-xs font-bold text-darkblue/50 transition-all'
        document.getElementById('tabBookings').className = 'tab-btn flex-1 py-2 rounded-lg text-xs font-bold text-darkblue/50 transition-all'

    })
}

// ── SEARCH + FILTER ────────────────────────────────────
function setupSearch() {
    document.getElementById('memberSearch').addEventListener('input', filterMembers)
    document.getElementById('memberFilter').addEventListener('change', filterMembers)
    document.getElementById('bookingSearch').addEventListener('input', filterBookings)
    document.getElementById('bookingFilter').addEventListener('change', filterBookings)
    document.getElementById('checkinSearch').addEventListener('input', filterCheckins)
    document.getElementById('checkinsFilter').addEventListener('change', filterCheckins)
}

function filterMembers() {
    const query = document.getElementById('memberSearch').value.toLowerCase()
    const status = document.getElementById('memberFilter').value

    const filtered = allMembers.filter(m => {
        const matchesQuery =
            `${m.first_name} ${m.last_name}`.toLowerCase().includes(query) ||
            m.email.toLowerCase().includes(query)
        const memberStatus = m.memberships?.find(mb => mb.season_id === currentSeason.id)?.status ?? 'pending'
        const matchesStatus = status === 'all' || memberStatus === status
        return matchesQuery && matchesStatus
    })

    renderMembers(filtered)
}

function filterBookings() {
    const query = document.getElementById('bookingSearch').value.toLowerCase()
    const status = document.getElementById('bookingFilter').value

    const filtered = allBookings.filter(b => {
        const matchesQuery = b.contact_name.toLowerCase().includes(query) ||
            b.contact_email.toLowerCase().includes(query)
        const matchesStatus = status === 'all' || b.status === status
        return matchesQuery && matchesStatus
    })

    renderBookings(filtered)
}
function filterCheckins() {
    const query = document.getElementById('checkinSearch').value.toLowerCase()
    const order = document.getElementById('checkinsFilter').value

    let filtered = allCheckins.filter(c =>
        c.checked_in_by.toLowerCase().includes(query)
    )

    if (order === 'pending') { // oldest
        filtered = [...filtered].reverse()
    }

    renderCheckins(filtered)
}

// ── EXPORT CSV ─────────────────────────────────────────
function setupExport() {
    // document.getElementById('exportBtn').addEventListener('click', () => {
    //     const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Address', 'Payment Preference', 'Status', 'Joined']
    //     const rows = allMembers.map(m => {
    //         const status = m.memberships?.find(mb => mb.season_id === currentSeason.id)?.status ?? 'pending'
    //         return [
    //             m.first_name,
    //             m.last_name,
    //             m.email,
    //             m.phone,
    //             m.address,
    //             m.payment_preference ?? '',
    //             status,
    //             new Date(m.created_at).toLocaleDateString(),
    //         ]
    //     })

    //     const csv = [headers, ...rows]
    //         .map(row => row.map(val => `"${val}"`).join(','))
    //         .join('\n')

    //     const blob = new Blob([csv], { type: 'text/csv' })
    //     const url = URL.createObjectURL(blob)
    //     const a = document.createElement('a')
    //     a.href = url
    //     a.download = `mpp-members-${currentSeason.year}.csv`
    //     a.click()
    //     URL.revokeObjectURL(url)
    // })

    // Export emails.txt
    document.getElementById('exportEmailsBtn').addEventListener('click', () => {
        const emails = allMembers
            .filter(m => m.memberships?.some(mb => mb.season_id === currentSeason.id && mb.status === 'active'))
            .map(m => m.email)
            .join(', ')

        const blob = new Blob([emails], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `mpp-emails-${currentSeason.year}.txt`
        a.click()
        URL.revokeObjectURL(url)
    })
}

// ── HELPERS ────────────────────────────────────────────
function toggleDrawer(card) {
    const detail = card.querySelector('.member-detail') || card.querySelector('.booking-detail')
    const chevron = card.querySelector('.chevron')
    const isOpen = detail.style.maxHeight && detail.style.maxHeight !== '0px'

    // close all
    document.querySelectorAll('.member-detail, .booking-detail').forEach(d => {
        d.style.maxHeight = '0px'
        d.style.borderTopWidth = '0px'
    })
    document.querySelectorAll('.chevron').forEach(c => c.style.transform = '')

    if (!isOpen) {
        detail.style.maxHeight = detail.scrollHeight + 'px'
        detail.style.borderTopWidth = '1px'
        chevron.style.transform = 'rotate(180deg)'
    }
}

function statusClass(status) {
    return {
        active: 'bg-green-100 text-green-800 text-center',
        pending: 'bg-mustard text-yellow-900 border',
        expired: 'bg-red-100 text-red-800 border',
    }[status] ?? 'bg-mustard text-yellow-900 border'
}

function bookingStatusClass(status) {
    return {
        pending: 'bg-mustard text-yellow-900 border',
        confirmed: 'bg-green-100 text-green-800 border',
        cancelled: 'bg-red-100 text-red-800 border',
    }[status] ?? 'bg-mustard text-yellow-900'
}

function capitalize(str) {
    if (!str) return '—'
    return str.charAt(0).toUpperCase() + str.slice(1)
}

function showSaveConfirm(btn) {
    const original = btn.textContent
    btn.textContent = 'Saved ✓'
    btn.classList.add('bg-green-500')
    btn.classList.remove('bg-waterblue')
    setTimeout(() => {
        btn.textContent = original
        btn.classList.remove('bg-green-500')
        btn.classList.add('bg-waterblue')
    }, 2000)
}

function convertMilitaryTo12Hour(timeStr) {
    // 1. Split the string into hours, minutes, and seconds
    let [hours, minutes, seconds] = timeStr.split(':');

    // Convert hours to an integer for math
    hours = parseInt(hours, 10);

    // 2. Determine am or pm
    const ampm = hours >= 12 ? 'pm' : 'am';

    // 3. Convert 24-hour clock to 12-hour clock
    // (12 % 12 = 0, so we use || 12 to turn 0 into 12 for midnight)
    hours = hours % 12 || 12;

    // 4. Return the formatted string (excluding seconds as per your example)
    return `${hours}:${minutes}${ampm}`;
}


// ── RUN ────────────────────────────────────────────────
init()