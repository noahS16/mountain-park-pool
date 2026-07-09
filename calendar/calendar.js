// calendar.js
import { getTodayEvent, getUpcomingEvents } from '../src/services/db.js'

let viewingDate = new Date()

const dayLabel = document.getElementById('dayLabel')
const eventCard = document.getElementById('eventCard')
const eventTime = document.getElementById('eventTime')
const eventHeadcount = document.getElementById('eventHeadcount')
const noEventState = document.getElementById('noEventState')
const upcomingList = document.getElementById('upcomingList')

function toDateStr(date) {
    return date.toISOString().split('T')[0]
}

function formatTime(t) {
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const display = hour % 12 || 12
    return `${display}:${m} ${ampm}`
}

function formatDayLabel(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

async function renderDay() {
    dayLabel.textContent = formatDayLabel(viewingDate)
    const dateStr = toDateStr(viewingDate)

    try {
        const event = await getTodayEvent(dateStr)

        if (event) {
            eventCard.classList.remove('hidden')
            noEventState.classList.add('hidden')
            eventTime.textContent = `${formatTime(event.event_start_time)} – ${formatTime(event.event_end_time)}`
            eventHeadcount.textContent = `${event.headcount} guests`
        } else {
            eventCard.classList.add('hidden')
            noEventState.classList.remove('hidden')
        }
    } catch (err) {
        console.error('Failed to load event:', err)
        noEventState.classList.remove('hidden')
    }
}

async function renderUpcoming() {
    try {
        const today = toDateStr(new Date())
        const events = await getUpcomingEvents(today)

        upcomingList.innerHTML = ''

        if (!events.length) {
            upcomingList.innerHTML = '<p class="text-sm text-darkblue/40">Nothing coming up yet.</p>'
            return
        }

        events.forEach(event => {
            const date = new Date(event.event_date + 'T00:00:00')
            const month = date.toLocaleDateString('en-US', { month: 'short' })
            const day = date.getDate()

            const row = document.createElement('div')
            row.className = 'flex items-center gap-3 border border-mustard rounded-lg px-3 py-2'
            row.innerHTML = `
                <div class="text-center min-w-[36px]">
                    <p class="text-xs text-darkblue/40 uppercase">${month}</p>
                    <p class="text-base font-bold text-darkblue">${day}</p>
                </div>
                <div class="flex-1">
                    <p class="text-sm font-semibold text-darkblue">${formatTime(event.event_start_time)} – ${formatTime(event.event_end_time)}</p>
                    <p class="text-xs text-darkblue/50">${event.headcount} guests</p>
                </div>
            `
            upcomingList.appendChild(row)
        })
    } catch (err) {
        console.error('Failed to load upcoming events:', err)
    }
}

document.getElementById('prevDay').addEventListener('click', () => {
    viewingDate.setDate(viewingDate.getDate() - 1)
    renderDay()
})

document.getElementById('nextDay').addEventListener('click', () => {
    viewingDate.setDate(viewingDate.getDate() + 1)
    renderDay()
})

renderDay()
renderUpcoming()